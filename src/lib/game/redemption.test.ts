import { describe, it, expect } from 'vitest'
import { redemptionProbability } from './redemption'

describe('redemptionProbability', () => {
  it('score 0 returns 0.85 (capped maximum)', () => {
    expect(redemptionProbability(0)).toBeCloseTo(0.85)
  })

  it('score 130 returns 0.05 (capped minimum)', () => {
    expect(redemptionProbability(130)).toBeCloseTo(0.05)
  })

  it('score 50 returns ~0.35', () => {
    // p = 0.05 + 0.80 * (80/130)^2 ≈ 0.353
    expect(redemptionProbability(50)).toBeCloseTo(0.353, 2)
  })

  it('score 25 returns ~0.57', () => {
    // p = 0.05 + 0.80 * (105/130)^2 ≈ 0.573
    expect(redemptionProbability(25)).toBeCloseTo(0.573, 2)
  })

  it('score 75 returns ~0.19', () => {
    // p = 0.05 + 0.80 * (55/130)^2 ≈ 0.193
    expect(redemptionProbability(75)).toBeCloseTo(0.193, 2)
  })

  it('score 100 (SSS range) returns ~0.09', () => {
    // p = 0.05 + 0.80 * (30/130)^2 ≈ 0.093
    expect(redemptionProbability(100)).toBeCloseTo(0.093, 2)
  })

  it('score 115 (ZZZ range) returns ~0.05 (near minimum)', () => {
    // p = 0.05 + 0.80 * (15/130)^2 ≈ 0.057
    expect(redemptionProbability(115)).toBeGreaterThanOrEqual(0.05)
    expect(redemptionProbability(115)).toBeLessThan(0.08)
  })

  it('never returns a value below 0.05', () => {
    expect(redemptionProbability(130)).toBeGreaterThanOrEqual(0.05)
    expect(redemptionProbability(200)).toBeGreaterThanOrEqual(0.05)
  })

  it('never returns a value above 0.85', () => {
    expect(redemptionProbability(0)).toBeLessThanOrEqual(0.85)
    expect(redemptionProbability(1)).toBeLessThanOrEqual(0.85)
  })
})
