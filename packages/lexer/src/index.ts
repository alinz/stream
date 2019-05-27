import { Readable } from 'stream'

import * as utf8 from './utf8'

class Chunks implements AsyncIterable<string> {
  input: Readable

  constructor(input: Readable) {
    this.input = input
    this.input.pause()
  }

  [Symbol.asyncIterator](): AsyncIterator<string> {
    return {
      next: () => {
        return new Promise((resolve, reject) => {
          this.input.removeAllListeners()
          this.input.once('error', (err) => reject(err))
          this.input.once('end', () => resolve({ value: null, done: true }))
          this.input.once('data', (value) => {
            this.input.pause()
            resolve({ value: value, done: false })
          })

          this.input.resume()
        })
      },
    }
  }
}

// nextByte provides a way to convert stream into callable bytes
async function* nextByte(input: Readable): AsyncIterableIterator<number> {
  const chunks = new Chunks(input)
  for await (const chunk of chunks) {
    for (const byte of chunk) {
      yield Number(byte)
    }
  }

  return null
}

const fill = async (bytes: AsyncIterableIterator<number>, n: number = 4): Promise<Buffer> => {
  const buffer = Buffer.alloc(n)

  let i = 0
  while (i < n) {
    const byte = await bytes.next()
    if (byte.done) {
      break
    }
    buffer[i] = byte.value
    i++
  }

  return buffer.slice(0, i)
}

class StreamLexer {
  source: AsyncIterableIterator<number>
  buffer: Buffer
  start: number
  pos: number
  end: number
  widths: number[]
  done: boolean

  constructor(source: Readable, size: number = 2 ** 16) {
    this.source = nextByte(source)
    this.buffer = Buffer.alloc(size)
    this.start = 0
    this.end = 0
    this.pos = 0
    this.widths = []
    this.done = false
  }

  // read some data from source and copy it into buffer
  // end pointer will be advancing.
  // NOTE 1: read should not be called directly. It is a private method
  // NOTE 2: after calling read, check the `this.done`
  async read() {
    // there is no more data remaining to read from source
    if (this.done) {
      return
    }

    // we have already some data in buffer, no need to copy the data into the buffer
    // 4 is enough data to cover utf8
    if (this.pos + 4 < this.end) {
      return
    }

    const buffer = await fill(this.source, 4)
    switch (buffer.byteLength) {
      case 0:
        // nothing's left
        this.done = true
        return
      case 4:
        // we might have more data,
        break
      default:
        // the buffer length is between 1 to 3.
        // it means that we are done but we have some stuff
        this.done = true
    }

    buffer.copy(this.buffer, this.end)
    this.end += buffer.byteLength
  }

  // next advancing pos pointer by one in buffer
  // if pos is the same as end, need to copy some data from source into buffer
  async next(): Promise<string | null> {
    await this.read()
    if (this.done && this.pos === this.end) {
      return null
    }

    // gives us how many bytes require to represent that char
    const width = utf8.count(this.buffer.slice(this.pos))
    if (width === -1) {
      throw new Error('wrong unicode')
    }
    this.widths.push(width)

    this.pos += width
    return utf8.decode(this.buffer.slice(this.pos - width, this.pos))
  }

  // backup calling backup move the pos backward by one
  backup() {
    if (this.widths.length === 0) {
      return
    }

    this.pos -= this.widths.pop()

    if (this.pos < this.start) {
      this.pos = this.start
    }
  }

  // ignore bring start to pos. it also shifts data to left to make more rooms
  // in buffer. This method is destructive and can't be reversed
  ignore() {
    const delta = this.pos - this.start
    // shift data to left
    this.buffer.copy(this.buffer, 0, this.pos, this.end)
    // reset all data. The end pointer has to be corrected
    // we could use the return value of this.buffer.copy but
    // if there is nothing to copy, we would accidentally set the end pointer to zero
    this.widths = []
    this.end -= delta
    this.pos = 0
    this.start = 0
  }

  revert(n: number) {
    for (let i = 0; i < n; i++) {
      this.pos -= this.widths.pop()
    }
    if (this.pos < this.start) {
      this.pos = this.start
    }
  }

  // peek shows the nth index of buffer without advancing pos pointer
  async peek(n: number = 1): Promise<string | null> {
    let i = 0
    let value: string

    if (n == 0) {
      return null
    }

    while (i < n) {
      value = await this.next()
      if (!value) {
        this.revert(i)
        return null
      }
      i++
    }

    // backup n times to put the pos back
    this.revert(i)

    return value
  }

  async accept(values: string): Promise<boolean> {
    const value = await this.next()
    if (values.indexOf(value) === -1) {
      this.backup()
      return false
    }
    return true
  }

  async acceptRun(values: string) {
    const delta = this.pos - this.start
    while (await this.accept(values));
    return delta !== this.pos - this.start
  }

  async acceptRunUntil(values: string) {
    const delta = this.pos - this.start
    while (true) {
      const value = await this.next()
      if (values.indexOf(value) !== -1) {
        this.backup()
        return delta !== this.pos - this.start
      }
    }
  }

  // content returns a copy of data between start and pos
  content(): string {
    if (this.start === this.pos) {
      return null
    }
    return utf8.decode(this.buffer.slice(this.start, this.pos))
  }
}

class PusherImpl<Kind> {
  tokens: Token<Kind>[]

  constructor() {
    this.tokens = []
  }

  push(token: Token<Kind>) {
    this.tokens.push(token)
  }
}

async function* tokens<Kind>(source: Readable, initialState: State<Kind>, size: number) {
  const lexer = new StreamLexer(source, size)
  const pusher = new PusherImpl<Kind>()

  let state = initialState
  while (state) {
    state = await state.next(lexer, pusher)
    while (pusher.tokens.length > 0) {
      yield pusher.tokens.shift()
    }
  }
}

class TokenizerImpl<Kind> {
  tokens: AsyncIterableIterator<Token<Kind>>
  cache: Token<Kind> | null

  constructor(source: Readable, initialState: State<Kind>, size: number) {
    this.tokens = tokens(source, initialState, size)
  }

  async read(): Promise<Token<Kind>> {
    const token = await this.tokens.next()
    if (token.done) {
      return null
    }

    return token.value
  }

  async next(): Promise<Token<Kind>> {
    if (this.cache) {
      const cache = this.cache
      this.cache = null
      return cache
    }

    return this.read()
  }

  async peek(): Promise<Token<Kind>> {
    if (!this.cache) {
      this.cache = await this.read()
    }

    return this.cache
  }
}

export interface Lexer {
  next(): Promise<string | null>
  backup()
  ignore()
  peek(n: number): Promise<string | null>
  content(): string
  accept(values: string): Promise<boolean>
  acceptRun(values: string): Promise<boolean>
  acceptRunUntil(values: string): Promise<boolean>
}

export class Token<Kind> {
  kind: Kind
  value: string

  constructor(kind: Kind, value: string) {
    this.kind = kind
    this.value = value
  }

  toJSON() {
    return { kind: this.kind, value: this.value }
  }
}

export interface Pusher<Kind> {
  push(token: Token<Kind>): void
}

export interface State<Kind> {
  next(l: Lexer, push: Pusher<Kind>): Promise<State<Kind>>
}

export interface Tokenizer<Kind> {
  read(): Promise<Token<Kind>>
  next(): Promise<Token<Kind>>
  peek(): Promise<Token<Kind>>
}

export const createState = <Kind>(fn: (l: Lexer, push: Pusher<Kind>) => Promise<State<Kind>>): State<Kind> => {
  return { next: fn }
}

export const createTokenizer = <Kind>(source: Readable, initialState: State<Kind>, size: number = 2 ** 16): Tokenizer<Kind> => {
  return new TokenizerImpl<Kind>(source, initialState, size)
}
