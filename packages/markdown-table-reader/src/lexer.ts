import { Readable } from 'stream'

import { createLexer, Lexer } from '@stream/lexer'

/* 

markdown table couple be like this:

| header 1 | header 2 | header3 |
|----      |----------|---------|
| value 2  | value    |         |

PIPE, CONSTANT, PIPE, CONSTANT, PIPE, CONSTANT, NEW_LINE
PIPE, SPLIT, PIPE, SPLIT, PIPE, SPLIT, NEW_LINE
PIPE, CONSTANT, PIPE, CONSTANT, PIPE, CONSTANT, EOF

*/

export enum TokenKind {
  PIPE,
  CONSTANT,
  NEW_LINE,
  SPLIT,
  EOF,
}

const strTokenKind = (kind: TokenKind) => {
  switch (kind) {
    case TokenKind.PIPE:
      return 'PIPE'
    case TokenKind.CONSTANT:
      return 'CONSTANT'
    case TokenKind.NEW_LINE:
      return 'NEW_LINE'
    case TokenKind.SPLIT:
      return 'SPLIT'
    case TokenKind.EOF:
      return 'EOF'
  }
}

export class Token {
  kind: TokenKind
  value: string

  constructor(kind: TokenKind, value: string) {
    this.kind = kind
    this.value = value
  }

  toJSON() {
    return { kind: strTokenKind(this.kind), value: this.value }
  }
}

type Push = (token: Token) => void
type StateFn = (l: Lexer, push: Push) => Promise<StateFn>

const pipeState = async (l: Lexer, push: Push) => {
  await l.next()
  push(new Token(TokenKind.PIPE, l.content()))
  l.ignore()

  return mainState
}

const splitState = async (l: Lexer, push: Push) => {
  await l.acceptRunUntil('|')
  push(new Token(TokenKind.SPLIT, l.content()))
  l.ignore()

  return mainState
}

const newlineState = async (l: Lexer, push: Push) => {
  await l.next()
  push(new Token(TokenKind.NEW_LINE, l.content()))
  l.ignore()

  return ignoreState
}

const eofState = async (l: Lexer, push: Push) => {
  await l.next()
  push(new Token(TokenKind.EOF, ''))
  l.ignore()

  return null
}

const constantState = async (l: Lexer, push: Push) => {
  await l.acceptRunUntil('|')
  push(new Token(TokenKind.CONSTANT, l.content()))
  l.ignore()

  return mainState
}

const ignoreState = async (l: Lexer, push: Push) => {
  // ignore everything until `|`
  await l.acceptRunUntil('|')
  l.ignore()
  return mainState
}

const mainState = async (l: Lexer, push: Push) => {
  switch (await l.peek(1)) {
    case '|':
      return pipeState
    case '-':
      return splitState
    case '\n':
      return newlineState
    case null:
      return eofState
    default:
      return constantState
  }
}

export async function* tokens(source: Readable) {
  const lexer = createLexer(source)
  const tokens: Token[] = []
  const push = (token: Token) => {
    tokens.push(token)
  }

  let state: StateFn = ignoreState
  while (state) {
    state = await state(lexer, push)
    while (tokens.length > 0) {
      yield tokens.shift()
    }
  }
}

export class TableLexer {
  tokens: AsyncIterableIterator<Token>
  cache: Token | null

  constructor(source: Readable) {
    this.tokens = tokens(source)
  }

  async read(): Promise<Token> {
    const token = await this.tokens.next()
    if (token.done) {
      return null
    }

    return token.value
  }

  async next(): Promise<Token> {
    if (this.cache) {
      const cache = this.cache
      this.cache = null
      return cache
    }

    return this.read()
  }

  async peek(): Promise<Token> {
    if (!this.cache) {
      this.cache = await this.read()
    }

    return this.cache
  }
}
