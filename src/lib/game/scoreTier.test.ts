import { describe, it, expect } from 'vitest'
import {
  scoreTier,
  gradeToScore,
  computeOverallScore,
  type TierGrade,
  TIER_THRESHOLDS,
} from './scoreTier'

const ALL_GRADES: TierGrade[] = [
  'F-', 'F', 'F+',
  'E-', 'E', 'E+',
  'D-', 'D', 'D+',
  'C-', 'C', 'C+',
  'B-', 'B', 'B+',
  'A-', 'A', 'A+',
  'S-', 'S', 'S+',
  'SS-', 'SS', 'SS+',
  'SSS-', 'SSS', 'SSS+',
  'God',
]

describe('scoreTier', () => {
  it('scoreTier(1) returns F-', () => {
    expect(scoreTier(1)).toBe('F-')
  })

  it('scoreTier(100) returns God', () => {
    expect(scoreTier(100)).toBe('God')
  })

  it('scoreTier(3) returns F-', () => {
    expect(scoreTier(3)).toBe('F-')
  })

  it('scoreTier(4) returns F', () => {
    expect(scoreTier(4)).toBe('F')
  })

  it('scoreTier(99) returns SSS+', () => {
    expect(scoreTier(99)).toBe('SSS+')
  })

  it('every integer 1-100 returns a valid TierGrade (no undefined)', () => {
    for (let i = 1; i <= 100; i++) {
      const grade = scoreTier(i)
      expect(grade).toBeDefined()
      expect(ALL_GRADES).toContain(grade)
    }
  })

  it('loop 1-100 produces exactly 100 valid results with zero undefined', () => {
    const results = Array.from({ length: 100 }, (_, i) => scoreTier(i + 1))
    expect(results).toHaveLength(100)
    expect(results.every(g => ALL_GRADES.includes(g))).toBe(true)
  })

  it('all 28 grade strings are reachable from some integer 1-100', () => {
    const achieved = new Set<TierGrade>()
    for (let i = 1; i <= 100; i++) {
      achieved.add(scoreTier(i))
    }
    for (const grade of ALL_GRADES) {
      expect(achieved.has(grade)).toBe(true)
    }
  })
})

describe('gradeToScore', () => {
  it('gradeToScore(F-) returns a number between 1 and 3 inclusive', () => {
    const score = gradeToScore('F-')
    expect(score).toBeGreaterThanOrEqual(1)
    expect(score).toBeLessThanOrEqual(3)
  })

  it('gradeToScore(God) returns 100', () => {
    expect(gradeToScore('God')).toBe(100)
  })

  it('gradeToScore applied to every TierGrade returns a number in [1, 100]', () => {
    for (const grade of ALL_GRADES) {
      const score = gradeToScore(grade)
      expect(score).toBeGreaterThanOrEqual(1)
      expect(score).toBeLessThanOrEqual(100)
    }
  })
})

describe('computeOverallScore', () => {
  it('all stats at 75 returns 75', () => {
    const stats = {
      strength: 75,
      speed: 75,
      agility: 75,
      durability: 75,
      iq: 75,
      charisma: 75,
      fightingSkill: 75,
      potential: 75,
      energyLevel: 75,
      powerMastery: 75,
      weaponMastery: 75,
    }
    expect(computeOverallScore(stats)).toBe(75)
  })

  it('empty stat record returns 1 (all stats missing, weighted sum = 0, clamped to 1)', () => {
    expect(computeOverallScore({})).toBe(1)
  })

  it('any stat scores in [1, 100] returns a value in [1, 100]', () => {
    const testCases = [
      { strength: 1, speed: 1, agility: 1, durability: 1, iq: 1, charisma: 1, fightingSkill: 1, potential: 1, energyLevel: 1, powerMastery: 1, weaponMastery: 1 },
      { strength: 100, speed: 100, agility: 100, durability: 100, iq: 100, charisma: 100, fightingSkill: 100, potential: 100, energyLevel: 100, powerMastery: 100, weaponMastery: 100 },
      { strength: 50, speed: 30, agility: 70, durability: 20, iq: 80, charisma: 10, fightingSkill: 60, potential: 40, energyLevel: 90, powerMastery: 55, weaponMastery: 45 },
    ]
    for (const stats of testCases) {
      const result = computeOverallScore(stats)
      expect(result).toBeGreaterThanOrEqual(1)
      expect(result).toBeLessThanOrEqual(100)
    }
  })

  it('TIER_THRESHOLDS has exactly 28 entries', () => {
    expect(TIER_THRESHOLDS).toHaveLength(28)
  })
})
