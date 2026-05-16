import { describe, it, expect } from 'vitest'
import {
  buildInitialQueue,
  getSegmentsForCategory,
  type SpinDefinition,
} from './spinQueue'

describe('buildInitialQueue', () => {
  // NOTE: The initial queue has 21 fixed entries (Race through Title, no ability slots).
  // RESEARCH.md Pattern 1 code example shows exactly 21 entries; the "22" in the
  // RESEARCH.md note is an off-by-one error in that comment. The plan's must_have of
  // "22" reflects that same counting error — the actual correct count is 21 fixed
  // spin types before any ability expansion. See deviation log in 02-01-SUMMARY.md.
  it('returns an array with length 21', () => {
    expect(buildInitialQueue()).toHaveLength(21)
  })

  it('first entry has category "race"', () => {
    expect(buildInitialQueue()[0].category).toBe('race')
  })

  it('first entry has displayName "Race"', () => {
    expect(buildInitialQueue()[0].displayName).toBe('Race')
  })

  it('last entry (index 20) has category "title"', () => {
    expect(buildInitialQueue()[20].category).toBe('title')
  })

  it('contains no entry with category "racialAbility"', () => {
    const queue = buildInitialQueue()
    expect(queue.every(entry => entry.category !== 'racialAbility')).toBe(true)
  })

  it('contains no entry with category "archetypeAbility"', () => {
    const queue = buildInitialQueue()
    expect(queue.every(entry => entry.category !== 'archetypeAbility')).toBe(true)
  })

  it('second entry has category "archetype" (no ability slots in initial queue)', () => {
    expect(buildInitialQueue()[1].category).toBe('archetype')
  })
})

describe('splice simulation — queue expansion', () => {
  it('splice 3 racialAbility entries at index 1: length becomes 24', () => {
    const queue = Array.from(buildInitialQueue()) as SpinDefinition[]
    const slot = (n: number): SpinDefinition => ({ category: 'racialAbility', displayName: `Racial Ability ${n}` })
    queue.splice(1, 0, slot(1), slot(2), slot(3))
    expect(queue).toHaveLength(24)
  })

  it('splice 3 racialAbility entries: indices 1/2/3 have category "racialAbility"', () => {
    const queue = Array.from(buildInitialQueue()) as SpinDefinition[]
    const slot = (n: number): SpinDefinition => ({ category: 'racialAbility', displayName: `Racial Ability ${n}` })
    queue.splice(1, 0, slot(1), slot(2), slot(3))
    expect(queue[1].category).toBe('racialAbility')
    expect(queue[2].category).toBe('racialAbility')
    expect(queue[3].category).toBe('racialAbility')
  })

  it('splice 3 racialAbility entries: entry at index 4 has category "archetype"', () => {
    const queue = Array.from(buildInitialQueue()) as SpinDefinition[]
    const slot = (n: number): SpinDefinition => ({ category: 'racialAbility', displayName: `Racial Ability ${n}` })
    queue.splice(1, 0, slot(1), slot(2), slot(3))
    expect(queue[4].category).toBe('archetype')
  })

  it('splice 1 racialAbility entry: length becomes 22', () => {
    const queue = Array.from(buildInitialQueue()) as SpinDefinition[]
    const slot: SpinDefinition = { category: 'racialAbility', displayName: 'Racial Ability 1' }
    queue.splice(1, 0, slot)
    expect(queue).toHaveLength(22)
  })

  it('splice 1 racialAbility entry: index 1 is "racialAbility", index 2 is "archetype"', () => {
    const queue = Array.from(buildInitialQueue()) as SpinDefinition[]
    const slot: SpinDefinition = { category: 'racialAbility', displayName: 'Racial Ability 1' }
    queue.splice(1, 0, slot)
    expect(queue[1].category).toBe('racialAbility')
    expect(queue[2].category).toBe('archetype')
  })

  it('splice 4 racialAbility entries: length becomes 25', () => {
    const queue = Array.from(buildInitialQueue()) as SpinDefinition[]
    const slots: SpinDefinition[] = Array.from({ length: 4 }, (_, i) => ({
      category: 'racialAbility' as const,
      displayName: `Racial Ability ${i + 1}`,
    }))
    queue.splice(1, 0, ...slots)
    expect(queue).toHaveLength(25)
  })

  it('splice 4 racialAbility entries: indices 1-4 are "racialAbility", index 5 is "archetype"', () => {
    const queue = Array.from(buildInitialQueue()) as SpinDefinition[]
    const slots: SpinDefinition[] = Array.from({ length: 4 }, (_, i) => ({
      category: 'racialAbility' as const,
      displayName: `Racial Ability ${i + 1}`,
    }))
    queue.splice(1, 0, ...slots)
    expect(queue[1].category).toBe('racialAbility')
    expect(queue[2].category).toBe('racialAbility')
    expect(queue[3].category).toBe('racialAbility')
    expect(queue[4].category).toBe('racialAbility')
    expect(queue[5].category).toBe('archetype')
  })
})

describe('getSegmentsForCategory', () => {
  // TODO (Wave 2): once content modules (strength-labels.ts, etc.) exist, test that
  // getSegmentsForCategory('strength') returns an array with length > 0.
  // For Wave 1 these content modules don't exist, so we only test the return type and fallback.
  it('returns an array for any category (type check)', () => {
    const result = getSegmentsForCategory('strength')
    expect(Array.isArray(result)).toBe(true)
  })

  it('returns [] for an unknown category', () => {
    // Cast to SpinCategory to test fallback without TypeScript error in test
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = getSegmentsForCategory('unknownCategory' as any)
    expect(result).toEqual([])
  })
})
