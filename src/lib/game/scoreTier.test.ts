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
  'Z-', 'Z', 'Z+',
  'ZZ-', 'ZZ', 'ZZ+',
  'ZZZ-', 'ZZZ', 'ZZZ+',
  'Celestial-', 'Celestial', 'Celestial+',
  'Godly-', 'Godly',
  'Primordial',
]

describe('scoreTier', () => {
  it('scoreTier(1) returns F-', () => {
    expect(scoreTier(1)).toBe('F-')
  })

  it('scoreTier(130) returns Primordial', () => {
    expect(scoreTier(130)).toBe('Primordial')
  })

  it('scoreTier(127) returns Godly', () => {
    expect(scoreTier(127)).toBe('Godly')
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

  it('scoreTier(100) returns Z-', () => {
    expect(scoreTier(100)).toBe('Z-')
  })

  it('every integer 1-130 returns a valid TierGrade (no undefined)', () => {
    for (let i = 1; i <= 130; i++) {
      const grade = scoreTier(i)
      expect(grade).toBeDefined()
      expect(ALL_GRADES).toContain(grade)
    }
  })

  it('loop 1-130 produces exactly 130 valid results with zero undefined', () => {
    const results = Array.from({ length: 130 }, (_, i) => scoreTier(i + 1))
    expect(results).toHaveLength(130)
    expect(results.every(g => ALL_GRADES.includes(g))).toBe(true)
  })

  it('all 42 grade strings are reachable from some integer 1-130', () => {
    const achieved = new Set<TierGrade>()
    for (let i = 1; i <= 130; i++) {
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

  it('gradeToScore(Godly) returns value in Godly range', () => {
    const score = gradeToScore('Godly')
    expect(score).toBeGreaterThanOrEqual(126)
    expect(score).toBeLessThanOrEqual(127)
  })

  it('gradeToScore(Primordial) returns value in Primordial range', () => {
    const score = gradeToScore('Primordial')
    expect(score).toBeGreaterThanOrEqual(128)
    expect(score).toBeLessThanOrEqual(130)
  })

  it('gradeToScore applied to every TierGrade returns a number in [1, 130]', () => {
    for (const grade of ALL_GRADES) {
      const score = gradeToScore(grade)
      expect(score).toBeGreaterThanOrEqual(1)
      expect(score).toBeLessThanOrEqual(130)
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

  it('any stat scores in [1, 130] returns a value in [1, 130]', () => {
    const testCases = [
      { strength: 1, speed: 1, agility: 1, durability: 1, iq: 1, charisma: 1, fightingSkill: 1, potential: 1, energyLevel: 1, powerMastery: 1, weaponMastery: 1 },
      { strength: 130, speed: 130, agility: 130, durability: 130, iq: 130, charisma: 130, fightingSkill: 130, potential: 130, energyLevel: 130, powerMastery: 130, weaponMastery: 130 },
      { strength: 50, speed: 30, agility: 70, durability: 20, iq: 80, charisma: 10, fightingSkill: 60, potential: 40, energyLevel: 90, powerMastery: 55, weaponMastery: 45 },
    ]
    for (const stats of testCases) {
      const result = computeOverallScore(stats)
      expect(result).toBeGreaterThanOrEqual(1)
      expect(result).toBeLessThanOrEqual(130)
    }
  })

  it('TIER_THRESHOLDS has exactly 42 entries', () => {
    expect(TIER_THRESHOLDS).toHaveLength(42)
  })
})
