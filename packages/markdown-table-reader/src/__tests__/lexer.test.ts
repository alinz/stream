import { createReadStream } from 'fs'

import { tokens } from '~/src/index'

describe('markdown table lexer', () => {
  test('samples', async () => {
    const testCases = [
      {
        given: createReadStream(`${__dirname}/samples/sample1.txt`),
        expected: [
          { kind: 'PIPE', value: '|' },
          { kind: 'CONSTANT', value: ' header 1 ' },
          { kind: 'PIPE', value: '|' },
          { kind: 'CONSTANT', value: ' header 2 ' },
          { kind: 'PIPE', value: '|' },
          { kind: 'CONSTANT', value: ' header3 ' },
          { kind: 'PIPE', value: '|' },
          { kind: 'NEW_LINE', value: '\n' },
          { kind: 'PIPE', value: '|' },
          { kind: 'SPLIT', value: '----------' },
          { kind: 'PIPE', value: '|' },
          { kind: 'SPLIT', value: '----------' },
          { kind: 'PIPE', value: '|' },
          { kind: 'SPLIT', value: '---------' },
          { kind: 'PIPE', value: '|' },
          { kind: 'NEW_LINE', value: '\n' },
          { kind: 'PIPE', value: '|' },
          { kind: 'CONSTANT', value: ' value 2  ' },
          { kind: 'PIPE', value: '|' },
          { kind: 'CONSTANT', value: ' value 2  ' },
          { kind: 'PIPE', value: '|' },
          { kind: 'CONSTANT', value: '         ' },
          { kind: 'PIPE', value: '|' },
          { kind: 'EOF', value: '' },
        ],
      },
      {
        given: createReadStream(`${__dirname}/samples/sample2.txt`),
        expected: [
          { kind: 'PIPE', value: '|' },
          { kind: 'CONSTANT', value: ' header 1 ' },
          { kind: 'PIPE', value: '|' },
          { kind: 'CONSTANT', value: ' header 2 ' },
          { kind: 'PIPE', value: '|' },
          { kind: 'CONSTANT', value: ' header3 ' },
          { kind: 'PIPE', value: '|' },
          { kind: 'NEW_LINE', value: '\n' },
          { kind: 'PIPE', value: '|' },
          { kind: 'SPLIT', value: '----------' },
          { kind: 'PIPE', value: '|' },
          { kind: 'SPLIT', value: '----------' },
          { kind: 'PIPE', value: '|' },
          { kind: 'SPLIT', value: '---------' },
          { kind: 'PIPE', value: '|' },
          { kind: 'NEW_LINE', value: '\n' },
          { kind: 'PIPE', value: '|' },
          { kind: 'CONSTANT', value: ' value 2  ' },
          { kind: 'PIPE', value: '|' },
          { kind: 'CONSTANT', value: ' value 2  ' },
          { kind: 'PIPE', value: '|' },
          { kind: 'CONSTANT', value: '         ' },
          { kind: 'PIPE', value: '|' },
          { kind: 'EOF', value: '' },
        ],
      },
    ]

    for (const testCase of testCases) {
      let idx = 0
      const toks = tokens(testCase.given)
      for await (const tok of toks) {
        expect(tok.toJSON()).toStrictEqual(testCase.expected[idx])
        idx++
      }
    }
  })
})
