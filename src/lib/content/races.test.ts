// races.test.ts — Structural tests for races and archetypes content arrays.
// TDD RED phase for Plan 02-02, Task 1.

import { describe, it, expect } from 'vitest'
import { races } from './races'
import { archetypes } from './archetypes'
import type { Race, Archetype } from './types'

describe('races', () => {
  it('has at least 35 entries', () => {
    expect(races.length).toBeGreaterThanOrEqual(35)
  })

  it('every Race entry has a non-empty string label', () => {
    for (const race of races) {
      expect(typeof race.label).toBe('string')
      expect(race.label.length).toBeGreaterThan(0)
    }
  })

  it('every Race entry has a positive numeric weight', () => {
    for (const race of races) {
      expect(typeof race.weight).toBe('number')
      expect(race.weight).toBeGreaterThan(0)
    }
  })

  it('every Race entry has abilitySpinCount between 0 and 4 inclusive', () => {
    // 0 is allowed for "twist" races like Hybrid that don't spin their
    // own abilities — they splice parent race spins which provide them.
    for (const race of races) {
      expect(race.abilitySpinCount).toBeGreaterThanOrEqual(0)
      expect(race.abilitySpinCount).toBeLessThanOrEqual(4)
      expect(Number.isInteger(race.abilitySpinCount)).toBe(true)
    }
  })

  it('every Race entry has a positive weaknessProbabilityModifier not exceeding 2.5', () => {
    for (const race of races) {
      expect(race.weaknessProbabilityModifier).toBeGreaterThan(0)
      expect(race.weaknessProbabilityModifier).toBeLessThanOrEqual(2.5)
    }
  })

  it('includes at least one Common race (highest-weight tier)', () => {
    const maxWeight = Math.max(...races.map((r) => r.weight))
    const commonRaces = races.filter((r) => r.weight >= maxWeight * 0.7)
    expect(commonRaces.length).toBeGreaterThan(0)
  })

  it('includes at least one Legendary race (weight <= 5)', () => {
    const legendaryRaces = races.filter((r) => r.weight <= 5)
    expect(legendaryRaces.length).toBeGreaterThan(0)
  })

  it('includes a Human race entry', () => {
    const human = races.find((r) => r.label === 'Human')
    expect(human).toBeDefined()
    expect(human!.weight).toBeGreaterThan(0)
  })

  it('total weight sum is a positive number', () => {
    const total = races.reduce((sum, r) => sum + r.weight, 0)
    expect(total).toBeGreaterThan(0)
  })

  it('no two races share the same label', () => {
    const labels = races.map((r) => r.label)
    const unique = new Set(labels)
    expect(unique.size).toBe(labels.length)
  })
})

describe('archetypes', () => {
  it('has at least 15 entries', () => {
    expect(archetypes.length).toBeGreaterThanOrEqual(15)
  })

  it('every Archetype entry has a non-empty string label', () => {
    for (const arch of archetypes) {
      expect(typeof arch.label).toBe('string')
      expect(arch.label.length).toBeGreaterThan(0)
    }
  })

  it('every Archetype entry has a positive numeric weight', () => {
    for (const arch of archetypes) {
      expect(typeof arch.weight).toBe('number')
      expect(arch.weight).toBeGreaterThan(0)
    }
  })

  it('every Archetype entry has abilitySpinCount between 0 and 4 (0 allowed for bonusSpin-only archetypes)', () => {
    for (const arch of archetypes) {
      expect(arch.abilitySpinCount).toBeGreaterThanOrEqual(0)
      expect(arch.abilitySpinCount).toBeLessThanOrEqual(4)
      expect(Number.isInteger(arch.abilitySpinCount)).toBe(true)
      if (arch.abilitySpinCount === 0) {
        expect(arch.bonusSpins?.length).toBeGreaterThan(0)
      }
    }
  })

  it('no two archetypes share the same label', () => {
    const labels = archetypes.map((a) => a.label)
    const unique = new Set(labels)
    expect(unique.size).toBe(labels.length)
  })
})
