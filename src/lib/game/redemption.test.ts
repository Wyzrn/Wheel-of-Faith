import { describe, it, expect } from 'vitest'
import { redemptionProbability } from './redemption'

describe('redemptionProbability', () => {
  // Score range is [-20, 185]. Normalized: (score + 20) / 205.

  it('score -20 returns 0.85 (capped maximum — weakest possible)', () => {
    expect(redemptionProbability(-20)).toBeCloseTo(0.85)
  })

  it('score 185 returns 0.05 (capped minimum — strongest possible)', () => {
    expect(redemptionProbability(185)).toBeCloseTo(0.05)
  })

  it('score 50 returns ~0.40', () => {
    // normalized = 70/205 ≈ 0.341; p = 0.05 + 0.80 * (0.659)^2 ≈ 0.397
    expect(redemptionProbability(50)).toBeCloseTo(0.397, 2)
  })

  it('score 25 returns ~0.54', () => {
    // normalized = 45/205 ≈ 0.220; p = 0.05 + 0.80 * (0.780)^2 ≈ 0.537
    expect(redemptionProbability(25)).toBeCloseTo(0.537, 2)
  })

  it('score 75 returns ~0.28', () => {
    // normalized = 95/205 ≈ 0.463; p = 0.05 + 0.80 * (0.537)^2 ≈ 0.281
    expect(redemptionProbability(75)).toBeCloseTo(0.281, 2)
  })

  it('score 100 (SSS range) returns ~0.19', () => {
    // normalized = 120/205 ≈ 0.585; p = 0.05 + 0.80 * (0.415)^2 ≈ 0.188
    expect(redemptionProbability(100)).toBeCloseTo(0.188, 2)
  })

  it('score 130 (Cosmic+) returns ~0.11', () => {
    // normalized = 150/205 ≈ 0.732; p = 0.05 + 0.80 * (0.268)^2 ≈ 0.107
    expect(redemptionProbability(130)).toBeCloseTo(0.107, 2)
  })

  it('score 0 returns ~0.70', () => {
    // normalized = 20/205 ≈ 0.098; p = 0.05 + 0.80 * (0.902)^2 ≈ 0.701
    expect(redemptionProbability(0)).toBeCloseTo(0.701, 2)
  })

  it('never returns a value below 0.05', () => {
    expect(redemptionProbability(185)).toBeGreaterThanOrEqual(0.05)
    expect(redemptionProbability(999)).toBeGreaterThanOrEqual(0.05)
  })

  it('never returns a value above 0.85', () => {
    expect(redemptionProbability(-20)).toBeLessThanOrEqual(0.85)
    expect(redemptionProbability(-999)).toBeLessThanOrEqual(0.85)
  })
})
