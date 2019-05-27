import { Readable } from 'stream'

import { TableLexer, TokenKind, Token } from './lexer'
import { FSWatcher } from 'fs'

const createIsFn = (kind: TokenKind) => (token: Token) => token.kind === kind

const isPipe = createIsFn(TokenKind.PIPE)
const isNewLine = createIsFn(TokenKind.NEW_LINE)
const isEOF = createIsFn(TokenKind.EOF)
const isConstant = createIsFn(TokenKind.CONSTANT)

class TableParser {
  lexer: TableLexer

  headers: string[]
  data: { [key: string]: string }[]

  constructor(source: Readable) {
    this.lexer = new TableLexer(source)
    this.headers = []
    this.data = []
  }

  headersState = async () => {
    let token = await this.lexer.next()
    if (!isPipe(token)) {
      throw new Error(`should got pipe but got ${token.toJSON().kind}`)
    }

    while (true) {
      token = await this.lexer.next()

      if (isEOF(token) || isNewLine(token)) {
        break
      } else if (isConstant(token)) {
        this.headers.push(token.value.trim())
      }
    }

    // pass through split line under header section
    while (true) {
      token = await this.lexer.next()
      if (isEOF(token) || isNewLine(token)) {
        break
      }
    }

    return this.dataState
  }

  dataState = async () => {
    let data: { [key: string]: string } = {}
    let idx = -1

    while (true) {
      const token = await this.lexer.next()
      if (isNewLine(token)) {
        this.data.push(data)
        data = {}
        idx = -1
      } else if (isEOF(token)) {
        if (Object.keys(data).length > 0) {
          this.data.push(data)
        }
        break
      } else if (isPipe(token)) {
        idx++
      } else if (isConstant(token)) {
        data[this.headers[idx]] = token.value.trim()
      }
    }

    return null
  }

  async parse(): Promise<{ [key: string]: string }[]> {
    let state = this.headersState
    while (state) {
      state = await state()
    }

    return this.data
  }
}

export const parse = (source: Readable): Promise<{ [key: string]: string }[]> => {
  const parser = new TableParser(source)
  return parser.parse()
}
