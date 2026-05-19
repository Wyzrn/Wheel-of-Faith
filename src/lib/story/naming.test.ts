import { describe, it, expect, vi } from 'vitest'
import { generateCharacterName } from './naming'

describe('generateCharacterName — determinism', () => {
  it('returns the same string when called twice with identical inputs', () => {
    const a = generateCharacterName(75, 'Human')
    const b = generateCharacterName(75, 'Human')
    expect(a).toBe(b)
  })

  it('is deterministic across a range of (score, race) pairs', () => {
    const pairs: [number, string][] = [
      [1, 'Elf'], [50, 'Orc'], [100, 'Vampire'], [130, 'Dragon'], [150, 'Celestial'],
    ]
    for (const [score, race] of pairs) {
      expect(generateCharacterName(score, race)).toBe(generateCharacterName(score, race))
    }
  })
})

describe('generateCharacterName — format', () => {
  it('returns a string matching "CapitalizedWord Space CapitalizedWord"', () => {
    const name = generateCharacterName(60, 'Human')
    expect(name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/)
  })

  it('contains exactly one ASCII space', () => {
    const name = generateCharacterName(42, 'Goblin')
    const parts = name.split(' ')
    expect(parts).toHaveLength(2)
    expect(parts[0].length).toBeGreaterThan(0)
    expect(parts[1].length).toBeGreaterThan(0)
  })
})

describe('generateCharacterName — variability', () => {
  it('produces ≥ 15 distinct names from 20 different (score, race) inputs', () => {
    const inputs: [number, string][] = [
      [1, 'Human'], [5, 'Elf'], [10, 'Orc'], [20, 'Troll'], [30, 'Goblin'],
      [40, 'Dwarf'], [50, 'Gnome'], [60, 'Halfling'], [70, 'Vampire'], [80, 'Werewolf'],
      [90, 'Demon'], [100, 'Angel'], [110, 'Dragon'], [120, 'Celestial'], [130, 'Void'],
      [140, 'Primordial'], [150, 'Titan'], [25, 'Kitsune'], [75, 'Phoenix'], [45, 'Sphinx'],
    ]
    const names = new Set(inputs.map(([s, r]) => generateCharacterName(s, r)))
    expect(names.size).toBeGreaterThanOrEqual(15)
  })
})

describe('generateCharacterName — no Math.random()', () => {
  it('does not call Math.random() even when it is poisoned', () => {
    const spy = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random() is forbidden in generateCharacterName')
    })
    // Should not throw — the function uses its own seeded PRNG
    expect(() => generateCharacterName(99, 'Human')).not.toThrow()
    spy.mockRestore()
  })
})
