import { describe, it, expect } from 'vitest'
import {
  scoreTier,
  gradeToScore,
  computeOverallScore,
  extendedTierFromScore,
  normalizeLegacyDisplayLabel,
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
  'Cosmic-', 'Cosmic', 'Cosmic+',
  'Immortal-', 'Immortal', 'Immortal+',
  'Celestial-', 'Celestial', 'Celestial+',
  'Godly-', 'Godly', 'Godly+',
  'Primordial-', 'Primordial', 'Primordial+',
  'Absolute-', 'Absolute', 'Absolute+',
  'Transcendent-', 'Transcendent', 'Transcendent+',
  'Infinite-', 'Infinite', 'Infinite+',
]

const TIER_COUNT = 60
const TIER_MAX_SCORE = 165

describe('scoreTier', () => {
  it('scoreTier(1) returns F-', () => {
    expect(scoreTier(1)).toBe('F-')
  })

  it('scoreTier(165) returns Infinite+', () => {
    expect(scoreTier(165)).toBe('Infinite+')
  })

  it('scoreTier(130) returns Celestial-', () => {
    expect(scoreTier(130)).toBe('Celestial-')
  })

  it('scoreTier(127) returns Immortal', () => {
    expect(scoreTier(127)).toBe('Immortal')
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

  it('scoreTier(118) returns Cosmic-', () => {
    expect(scoreTier(118)).toBe('Cosmic-')
  })

  it('every integer in score-range returns a valid TierGrade', () => {
    for (let i = 1; i <= TIER_MAX_SCORE; i++) {
      const grade = scoreTier(i)
      expect(grade).toBeDefined()
      expect(ALL_GRADES).toContain(grade)
    }
  })

  it('all grades are reachable from some integer in score-range', () => {
    const achieved = new Set<TierGrade>()
    for (let i = 1; i <= TIER_MAX_SCORE; i++) {
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

  it('gradeToScore(Immortal) returns value in Immortal range', () => {
    const score = gradeToScore('Immortal')
    expect(score).toBeGreaterThanOrEqual(126)
    expect(score).toBeLessThanOrEqual(127)
  })

  it('gradeToScore(Infinite+) returns value in Infinite+ range', () => {
    const score = gradeToScore('Infinite+')
    expect(score).toBeGreaterThanOrEqual(164)
    expect(score).toBeLessThanOrEqual(165)
  })

  it('gradeToScore applied to every TierGrade returns a number in [1, TIER_MAX_SCORE]', () => {
    for (const grade of ALL_GRADES) {
      const score = gradeToScore(grade)
      expect(score).toBeGreaterThanOrEqual(1)
      expect(score).toBeLessThanOrEqual(TIER_MAX_SCORE)
    }
  })
})

describe('extendedTierFromScore', () => {
  it('returns named tier for scores ≤ TIER_MAX_SCORE', () => {
    expect(extendedTierFromScore(50)).toBe('B+')
    expect(extendedTierFromScore(165)).toBe('Infinite+')
  })
  it('returns Infinite+N for scores above TIER_MAX_SCORE', () => {
    expect(extendedTierFromScore(166)).toBe('Infinite+1')
    expect(extendedTierFromScore(175)).toBe('Infinite+10')
  })
  it('caps overflow N at 20', () => {
    expect(extendedTierFromScore(185)).toBe('Infinite+20')
    expect(extendedTierFromScore(999)).toBe('Infinite+20')
  })
})

describe('normalizeLegacyDisplayLabel', () => {
  it('remaps Absolute+N to the new post-Absolute ladder', () => {
    expect(normalizeLegacyDisplayLabel('Absolute+1')).toBe('Transcendent-')
    expect(normalizeLegacyDisplayLabel('Absolute+3')).toBe('Transcendent+')
    expect(normalizeLegacyDisplayLabel('Absolute+6')).toBe('Infinite+')
    expect(normalizeLegacyDisplayLabel('Absolute+10')).toBe('Infinite+4')
  })
  it('cascades Primordial+N through to the new ladder', () => {
    expect(normalizeLegacyDisplayLabel('Primordial+1')).toBe('Transcendent-')
  })
  it('returns unrelated labels unchanged', () => {
    expect(normalizeLegacyDisplayLabel('SS+')).toBe('SS+')
    expect(normalizeLegacyDisplayLabel(undefined)).toBeUndefined()
  })
})

describe('computeOverallScore', () => {
  it('all stats at 75 returns 75', () => {
    const stats = {
      strength: 75, speed: 75, agility: 75, durability: 75,
      iq: 75, charisma: 75, fightingSkill: 75, potential: 75,
      energyLevel: 75, powerMastery: 75, weaponMastery: 75,
    }
    expect(computeOverallScore(stats)).toBe(75)
  })

  it('empty stat record returns 0', () => {
    expect(computeOverallScore({})).toBe(0)
  })

  it('any stat scores in [1, TIER_MAX_SCORE] returns a value in [1, TIER_MAX_SCORE]', () => {
    const testCases = [
      { strength: 1, speed: 1, agility: 1, durability: 1, iq: 1, charisma: 1, fightingSkill: 1, potential: 1, energyLevel: 1, powerMastery: 1, weaponMastery: 1 },
      { strength: 165, speed: 165, agility: 165, durability: 165, iq: 165, charisma: 165, fightingSkill: 165, potential: 165, energyLevel: 165, powerMastery: 165, weaponMastery: 165 },
      { strength: 50, speed: 30, agility: 70, durability: 20, iq: 80, charisma: 10, fightingSkill: 60, potential: 40, energyLevel: 90, powerMastery: 55, weaponMastery: 45 },
    ]
    for (const stats of testCases) {
      const result = computeOverallScore(stats)
      expect(result).toBeGreaterThanOrEqual(1)
      expect(result).toBeLessThanOrEqual(TIER_MAX_SCORE)
    }
  })

  it(`TIER_THRESHOLDS has exactly ${TIER_COUNT} entries`, () => {
    expect(TIER_THRESHOLDS).toHaveLength(TIER_COUNT)
  })
})
