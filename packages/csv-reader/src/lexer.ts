import { Readable } from 'stream'
import { Lexer } from '@stream/lexer'

/* 

csv data would be like this:

header1, header 2, "header,3"
1,2,3
2,"3,5",4

CONSTANT, SPLIT, CONSTANT, SPLIT, CONSTANT, SPLIT,
CONSTANT, SPLIT, CONSTANT, SPLIT, CONSTANT, SPLIT,
CONSTANT, SPLIT, CONSTANT, SPLIT, CONSTANT, SPLIT,

*/

export enum TokenKind {
  CONSTANT,
  SPLIT,
}

const strTokenKind = (kind: TokenKind) => {
  switch (kind) {
    case TokenKind.CONSTANT:
      return 'CONSTANT'
    case TokenKind.SPLIT:
      return 'SPLIT'
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

export class CSVLexer {
  lexer: Lexer
}
