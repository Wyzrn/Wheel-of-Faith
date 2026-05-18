import { describe, it, expect } from 'vitest'
import { redemptionProbability } from './redemption'

describe('redemptionProbability', () => {
  // Score range is now [-20, 150]. Normalized: (score + 20) / 170.

  it('score -20 returns 0.85 (capped maximum — weakest possible)', () => {
    expect(redemptionProbability(-20)).toBeCloseTo(0.85)
  })

  it('score 150 returns 0.05 (capped minimum — strongest possible)', () => {
    expect(redemptionProbability(150)).toBeCloseTo(0.05)
  })

  it('score 50 returns ~0.33', () => {
    // normalized = 70/170 ≈ 0.412; p = 0.05 + 0.80 * (0.588)^2 ≈ 0.327
    expect(redemptionProbability(50)).toBeCloseTo(0.327, 2)
  })

  it('score 25 returns ~0.48', () => {
    // normalized = 45/170 ≈ 0.265; p = 0.05 + 0.80 * (0.735)^2 ≈ 0.483
    expect(redemptionProbability(25)).toBeCloseTo(0.483, 2)
  })

  it('score 75 returns ~0.21', () => {
    // normalized = 95/170 ≈ 0.559; p = 0.05 + 0.80 * (0.441)^2 ≈ 0.206
    expect(redemptionProbability(75)).toBeCloseTo(0.206, 2)
  })

  it('score 100 (SSS range) returns ~0.12', () => {
    // normalized = 120/170 ≈ 0.706; p = 0.05 + 0.80 * (0.294)^2 ≈ 0.119
    expect(redemptionProbability(100)).toBeCloseTo(0.119, 2)
  })

  it('score 130 (Primordial) returns ~0.06', () => {
    // normalized = 150/170 ≈ 0.882; p = 0.05 + 0.80 * (0.118)^2 ≈ 0.061
    expect(redemptionProbability(130)).toBeCloseTo(0.061, 2)
  })

  it('score 0 returns ~0.67', () => {
    // normalized = 20/170 ≈ 0.118; p = 0.05 + 0.80 * (0.882)^2 ≈ 0.672
    expect(redemptionProbability(0)).toBeCloseTo(0.672, 2)
  })

  it('never returns a value below 0.05', () => {
    expect(redemptionProbability(150)).toBeGreaterThanOrEqual(0.05)
    expect(redemptionProbability(999)).toBeGreaterThanOrEqual(0.05)
  })

  it('never returns a value above 0.85', () => {
    expect(redemptionProbability(-20)).toBeLessThanOrEqual(0.85)
    expect(redemptionProbability(-999)).toBeLessThanOrEqual(0.85)
  })
})
