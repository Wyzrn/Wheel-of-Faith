import { describe, it, expect } from 'vitest'
import { getShardValue } from './shards'
import type { TierGrade } from '$lib/game/scoreTier'

// All 46 TierGrade values — extracted from src/lib/game/scoreTier.ts
const ALL_TIER_GRADES: TierGrade[] = [
  'F-', 'F', 'F+',
  'E-', 'E', 'E+',
  'D-', 'D', 'D+',
  'C-', 'C', 'C+',
  'B-', 'B', 'B+',
  'A-', 'A', 'A+',
  'S-', 'S', 'S+',
  'SS-', 'SS', 'SS+',
  'SSS-', 'SSS', 'SSS+',
  'Z-', 'Z', 'Z+',
  'ZZ-', 'ZZ', 'ZZ+',
  'ZZZ-', 'ZZZ', 'ZZZ+',
  'Celestial-', 'Celestial', 'Celestial+',
  'Godly-', 'Godly',
  'Primordial',
  'Primordial+', 'Absolute-', 'Absolute', 'Absolute+',
]

describe('getShardValue — all 46 grades return valid numbers', () => {
  it('returns a finite number ≥ 20 for every TierGrade value', () => {
    for (const grade of ALL_TIER_GRADES) {
      const value = getShardValue(grade)
      expect(Number.isFinite(value), `${grade} must return a finite number`).toBe(true)
      expect(value, `${grade} must return ≥ 20`).toBeGreaterThanOrEqual(20)
    }
  })

  it('covers all 46 TierGrade values (no grade returns the fallback 20 on a valid grade above F-)', () => {
    // Every grade above F- should return > 20
    const aboveFMinus = ALL_TIER_GRADES.filter(g => g !== 'F-')
    for (const grade of aboveFMinus) {
      const value = getShardValue(grade)
      expect(value, `${grade} hit the fallback path (returned 20) — likely missing from bracket arrays`).toBeGreaterThan(20)
    }
  })
})

describe('getShardValue — boundary values', () => {
  // F–D bracket (20 → 55, linearly interpolated over 9 tiers)
  it('F- === 20 (bracket floor)', () => {
    expect(getShardValue('F-')).toBe(20)
  })

  it('D+ === 55 (bracket ceiling)', () => {
    expect(getShardValue('D+')).toBe(55)
  })

  // C–B bracket (70 → 130)
  it('C- === 70 (C–B bracket floor)', () => {
    expect(getShardValue('C-')).toBe(70)
  })

  it('B+ === 130 (C–B bracket ceiling)', () => {
    expect(getShardValue('B+')).toBe(130)
  })

  // A–S bracket (160 → 320)
  it('A- === 160 (A–S bracket floor)', () => {
    expect(getShardValue('A-')).toBe(160)
  })

  it('S+ === 320 (A–S bracket ceiling)', () => {
    expect(getShardValue('S+')).toBe(320)
  })

  // SS base
  it('SS- === 500', () => {
    expect(getShardValue('SS-')).toBe(500)
  })

  it('SS === 500', () => {
    expect(getShardValue('SS')).toBe(500)
  })

  // SS+ and above (500 + stepsAboveSS * 100, capped at 2000)
  it('SS+ === 600 (1 step above SS = 500 + 100)', () => {
    expect(getShardValue('SS+')).toBe(600)
  })

  it('Absolute+ === 2000 (capped at max)', () => {
    expect(getShardValue('Absolute+')).toBe(2000)
  })
})

describe('getShardValue — monotonic within brackets', () => {
  it('F-D bracket values are non-decreasing', () => {
    const fdGrades: TierGrade[] = ['F-', 'F', 'F+', 'E-', 'E', 'E+', 'D-', 'D', 'D+']
    const values = fdGrades.map(getShardValue)
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1])
    }
  })

  it('C-B bracket values are non-decreasing', () => {
    const cbGrades: TierGrade[] = ['C-', 'C', 'C+', 'B-', 'B', 'B+']
    const values = cbGrades.map(getShardValue)
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1])
    }
  })

  it('A-S bracket values are non-decreasing', () => {
    const asGrades: TierGrade[] = ['A-', 'A', 'A+', 'S-', 'S', 'S+']
    const values = asGrades.map(getShardValue)
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1])
    }
  })
})
