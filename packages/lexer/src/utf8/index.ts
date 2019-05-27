import { StringDecoder } from 'string_decoder'

// The default lowest and highest continuation byte.
const locb = 0x80 // 1000 0000
const hicb = 0xbf // 1011 1111

// These names of these constants are chosen to give nice alignment in the
// table below. The first nibble is an index into acceptRanges or F for
// special one-byte cases. The second nibble is the Rune length or the
// Status for the special one-byte case.
const xx = 0xf1 // invalid: size 1
const as = 0xf0 // ASCII: size 1
const s1 = 0x02 // accept 0, size 2
const s2 = 0x13 // accept 1, size 3
const s3 = 0x03 // accept 0, size 3
const s4 = 0x23 // accept 2, size 3
const s5 = 0x34 // accept 3, size 4
const s6 = 0x04 // accept 0, size 4
const s7 = 0x44 // accept 4, size 4

// prettier-ignore
const first = [
  //   1   2   3   4   5   6   7   8   9   A   B   C   D   E   F
	as, as, as, as, as, as, as, as, as, as, as, as, as, as, as, as, // 0x00-0x0F
	as, as, as, as, as, as, as, as, as, as, as, as, as, as, as, as, // 0x10-0x1F
	as, as, as, as, as, as, as, as, as, as, as, as, as, as, as, as, // 0x20-0x2F
	as, as, as, as, as, as, as, as, as, as, as, as, as, as, as, as, // 0x30-0x3F
	as, as, as, as, as, as, as, as, as, as, as, as, as, as, as, as, // 0x40-0x4F
	as, as, as, as, as, as, as, as, as, as, as, as, as, as, as, as, // 0x50-0x5F
	as, as, as, as, as, as, as, as, as, as, as, as, as, as, as, as, // 0x60-0x6F
	as, as, as, as, as, as, as, as, as, as, as, as, as, as, as, as, // 0x70-0x7F
	//   1   2   3   4   5   6   7   8   9   A   B   C   D   E   F
	xx, xx, xx, xx, xx, xx, xx, xx, xx, xx, xx, xx, xx, xx, xx, xx, // 0x80-0x8F
	xx, xx, xx, xx, xx, xx, xx, xx, xx, xx, xx, xx, xx, xx, xx, xx, // 0x90-0x9F
	xx, xx, xx, xx, xx, xx, xx, xx, xx, xx, xx, xx, xx, xx, xx, xx, // 0xA0-0xAF
	xx, xx, xx, xx, xx, xx, xx, xx, xx, xx, xx, xx, xx, xx, xx, xx, // 0xB0-0xBF
	xx, xx, s1, s1, s1, s1, s1, s1, s1, s1, s1, s1, s1, s1, s1, s1, // 0xC0-0xCF
	s1, s1, s1, s1, s1, s1, s1, s1, s1, s1, s1, s1, s1, s1, s1, s1, // 0xD0-0xDF
  s2, s3, s3, s3, s3, s3, s3, s3, s3, s3, s3, s3, s3, s4, s3, s3, // 0xE0-0xEF
	s5, s6, s6, s6, s7, xx, xx, xx, xx, xx, xx, xx, xx, xx, xx, xx, // 0xF0-0xFF
]

type AcceptRange = {
  lo: number
  hi: number
}

const acceptRanges: Array<AcceptRange> = [
  { lo: locb, hi: hicb },
  { lo: 0xa0, hi: hicb },
  { lo: locb, hi: 0x9f },
  { lo: 0x90, hi: hicb },
  { lo: locb, hi: 0x8f },
]

export const count = (p: Buffer): number => {
  const n = p.byteLength
  if (n < 1) {
    return -1
  }

  const p0 = p[0]
  const x = first[p0]
  if (x >= as) {
    const mask = (x << 31) >> 31 // Create 0x0000 or 0xFFFF.
    const result = p[0] & ~mask
    if (!result) {
      return -1
    }
    return 1
  }

  const sz = x & 7
  const accept = acceptRanges[x >> 4]
  if (n < sz) {
    return -1
  }

  const b1 = p[1]
  if (b1 < accept.lo || accept.hi < b1) {
    return -1
  }

  if (sz === 2) {
    return 2
  }

  const b2 = p[2]
  if (b2 < locb || hicb < b2) {
    return -1
  }

  if (sz == 3) {
    return 3
  }

  const b3 = p[3]
  if (b3 < locb || hicb < b3) {
    return -1
  }

  return 4
}

const decoder = new StringDecoder('utf8')
export const decode = (buffer: Buffer): string => {
  return decoder.write(buffer)
}
