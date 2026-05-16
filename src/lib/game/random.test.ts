import { describe, it, expect } from 'vitest'
import { weightedRandom } from './random'

const SIX_SEGS = [
  { label: 'A', weight: 1 },
  { label: 'B', weight: 1 },
  { label: 'C', weight: 1 },
  { label: 'D', weight: 1 },
  { label: 'E', weight: 1 },
  { label: 'F', weight: 1 },
]

describe('weightedRandom', () => {
  it('always returns a valid index over 1000 calls', () => {
    for (let i = 0; i < 1000; i++) {
      const idx = weightedRandom(SIX_SEGS)
      expect(idx).toBeGreaterThanOrEqual(0)
      expect(idx).toBeLessThan(SIX_SEGS.length)
    }
  })

  it('with one item having all weight, always returns that index', () => {
    const items = [
      { label: 'X', weight: 0 },
      { label: 'Y', weight: 10 },
      { label: 'Z', weight: 0 },
    ]
    for (let i = 0; i < 100; i++) {
      expect(weightedRandom(items)).toBe(1)
    }
  })

  it('works for equal-weight segments', () => {
    const result = weightedRandom(SIX_SEGS)
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThan(6)
  })
})
