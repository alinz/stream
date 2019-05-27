import { count } from '~/src/utf8'

describe('utf8', () => {
  test('Decode', () => {
    const testCase = Buffer.from([0xc2, 0xa2, 0xe2, 0x82, 0xac])

    expect(count(testCase)).toBe(2)
    expect(count(testCase.slice(2))).toBe(3)
  })
})
