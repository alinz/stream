import { Token } from 'stream.lexer'

export const createIsFn = <Kind>(kind: Kind) => (token: Token<Kind>) => token.kind === kind
