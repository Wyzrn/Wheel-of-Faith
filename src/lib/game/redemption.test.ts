import { describe, it, expect } from 'vitest'
import { redemptionProbability } from './redemption'

describe('redemptionProbability', () => {
  it('score 0 returns 0.85 (capped maximum)', () => {
    expect(redemptionProbability(0)).toBeCloseTo(0.85)
  })

  it('score 100 returns 0.05 (capped minimum)', () => {
    expect(redemptionProbability(100)).toBeCloseTo(0.05)
  })

  it('score 50 returns ~0.25', () => {
    expect(redemptionProbability(50)).toBeCloseTo(0.25, 2)
  })

  it('score 25 returns ~0.50', () => {
    // p = 0.05 + 0.80 * (0.75)^2 = 0.05 + 0.45 = 0.50
    expect(redemptionProbability(25)).toBeCloseTo(0.50, 2)
  })

  it('score 75 returns ~0.10', () => {
    // p = 0.05 + 0.80 * (0.25)^2 = 0.05 + 0.05 = 0.10
    expect(redemptionProbability(75)).toBeCloseTo(0.10, 2)
  })

  it('never returns a value below 0.05', () => {
    expect(redemptionProbability(100)).toBeGreaterThanOrEqual(0.05)
    expect(redemptionProbability(99)).toBeGreaterThanOrEqual(0.05)
  })

  it('never returns a value above 0.85', () => {
    expect(redemptionProbability(0)).toBeLessThanOrEqual(0.85)
    expect(redemptionProbability(1)).toBeLessThanOrEqual(0.85)
  })
})
