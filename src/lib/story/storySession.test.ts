import { describe, it, expect, beforeEach } from 'vitest'
import {
  STORY_SESSION_KEY,
  createStorySession,
  loadStorySession,
  saveStorySession,
  clearStorySession,
  buildRosterEntryFromResults,
} from './storySession'
import type { SpinResult } from '$lib/session/types'

// ── localStorage mock ──────────────────────────────────────────────────────────
beforeEach(() => {
  const store: Record<string, string> = {}
  globalThis.localStorage = {
    getItem(k: string) { return store[k] ?? null },
    setItem(k: string, v: string) { store[k] = v },
    removeItem(k: string) { delete store[k] },
    clear() { Object.keys(store).forEach(k => delete store[k]) },
    key(i: number) { return Object.keys(store)[i] ?? null },
    get length() { return Object.keys(store).length },
  } as unknown as Storage
})

// ── Fixture spin results ───────────────────────────────────────────────────────
function makeFixtureResults(): SpinResult[] {
  return [
    { step: 1, category: 'race', resultLabel: 'Human', resultIndex: 0, timestamp: '2026-01-01T00:00:00Z' },
    { step: 2, category: 'archetype', resultLabel: 'Knight', resultIndex: 0, timestamp: '2026-01-01T00:00:01Z' },
    { step: 3, category: 'strength', resultLabel: 'Iron Fist', resultIndex: 0, timestamp: '2026-01-01T00:00:02Z', tier: 'C', score: 35 },
    { step: 4, category: 'speed', resultLabel: 'Swift Step', resultIndex: 0, timestamp: '2026-01-01T00:00:03Z', tier: 'B', score: 47 },
    { step: 5, category: 'agility', resultLabel: 'Nimble', resultIndex: 0, timestamp: '2026-01-01T00:00:04Z', tier: 'C', score: 33 },
    { step: 6, category: 'durability', resultLabel: 'Tough Hide', resultIndex: 0, timestamp: '2026-01-01T00:00:05Z', tier: 'C', score: 30 },
    { step: 7, category: 'iq', resultLabel: 'Sharp Mind', resultIndex: 0, timestamp: '2026-01-01T00:00:06Z', tier: 'B', score: 45 },
    { step: 8, category: 'charisma', resultLabel: 'Charming', resultIndex: 0, timestamp: '2026-01-01T00:00:07Z', tier: 'C', score: 32 },
    { step: 9, category: 'fightingSkill', resultLabel: 'Trained Warrior', resultIndex: 0, timestamp: '2026-01-01T00:00:08Z', tier: 'B', score: 46 },
    { step: 10, category: 'powerMastery', resultLabel: 'Controlled', resultIndex: 0, timestamp: '2026-01-01T00:00:09Z', tier: 'C', score: 33 },
    { step: 11, category: 'weaponMastery', resultLabel: 'Proficient', resultIndex: 0, timestamp: '2026-01-01T00:00:10Z', tier: 'C', score: 31 },
    { step: 12, category: 'potential', resultLabel: 'Rising Star', resultIndex: 0, timestamp: '2026-01-01T00:00:11Z', tier: 'B', score: 46 },
    { step: 13, category: 'energyLevel', resultLabel: 'Steady', resultIndex: 0, timestamp: '2026-01-01T00:00:12Z', tier: 'C', score: 33 },
  ]
}

// ── loadStorySession ───────────────────────────────────────────────────────────
describe('loadStorySession', () => {
  it('returns null when localStorage is empty', () => {
    expect(loadStorySession()).toBeNull()
  })

  it('returns null for corrupted JSON', () => {
    localStorage.setItem(STORY_SESSION_KEY, '{"bad json')
    expect(loadStorySession()).toBeNull()
  })
})

// ── saveStorySession + loadStorySession round-trip ────────────────────────────
describe('saveStorySession + loadStorySession', () => {
  it('round-trip preserves all session fields', () => {
    const session = createStorySession()
    saveStorySession(session)
    const loaded = loadStorySession()
    expect(loaded).not.toBeNull()
    expect(loaded?.sessionId).toBe(session.sessionId)
    expect(loaded?.startedAt).toBe(session.startedAt)
    expect(loaded?.currentSpinIndex).toBe(0)
    expect(loaded?.completedSpins).toEqual([])
    expect(loaded?.spinQueue.length).toBeGreaterThan(0)
  })
})

// ── clearStorySession ─────────────────────────────────────────────────────────
describe('clearStorySession', () => {
  it('removes story_session so loadStorySession returns null', () => {
    const session = createStorySession()
    saveStorySession(session)
    clearStorySession()
    expect(loadStorySession()).toBeNull()
  })

  it('does not throw when key is already absent', () => {
    expect(() => clearStorySession()).not.toThrow()
  })
})

// ── createStorySession ────────────────────────────────────────────────────────
describe('createStorySession', () => {
  it('produces a queue including a redemptionSpin entry (Story uses full main-game queue)', () => {
    const session = createStorySession()
    const hasRedemption = session.spinQueue.some(def => def.category === 'redemptionSpin')
    expect(hasRedemption).toBe(true)
  })

  it('produces a non-empty sessionId and startedAt', () => {
    const session = createStorySession()
    expect(session.sessionId).toBeTruthy()
    expect(session.startedAt).toBeTruthy()
  })

  it('starts with empty completedSpins and currentSpinIndex of 0', () => {
    const session = createStorySession()
    expect(session.completedSpins).toEqual([])
    expect(session.currentSpinIndex).toBe(0)
  })
})

// ── buildRosterEntryFromResults ───────────────────────────────────────────────
describe('buildRosterEntryFromResults', () => {
  it('extracts race and archetype from results', () => {
    const results = makeFixtureResults()
    const entry = buildRosterEntryFromResults({ results, sessionStartedAt: '2026-01-01T00:00:00Z' })
    expect(entry.race).toBe('Human')
    expect(entry.archetype).toBe('Knight')
  })

  it('name matches capitalized Adjective Noun format', () => {
    const results = makeFixtureResults()
    const entry = buildRosterEntryFromResults({ results, sessionStartedAt: '2026-01-01T00:00:00Z' })
    expect(entry.name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+/)
  })

  it('overallTier is a non-empty string', () => {
    const results = makeFixtureResults()
    const entry = buildRosterEntryFromResults({ results, sessionStartedAt: '2026-01-01T00:00:00Z' })
    expect(typeof entry.overallTier).toBe('string')
    expect(entry.overallTier.length).toBeGreaterThan(0)
  })

  it('id is a non-empty string', () => {
    const results = makeFixtureResults()
    const entry = buildRosterEntryFromResults({ results, sessionStartedAt: '2026-01-01T00:00:00Z' })
    expect(typeof entry.id).toBe('string')
    expect(entry.id.length).toBeGreaterThan(0)
  })

  it('sessionStartedAt matches the input argument', () => {
    const results = makeFixtureResults()
    const ts = '2026-01-01T00:00:00Z'
    const entry = buildRosterEntryFromResults({ results, sessionStartedAt: ts })
    expect(entry.sessionStartedAt).toBe(ts)
  })

  it('calling twice with same fixture returns same name (determinism)', () => {
    const results = makeFixtureResults()
    const ts = '2026-01-01T00:00:00Z'
    const entry1 = buildRosterEntryFromResults({ results, sessionStartedAt: ts })
    const entry2 = buildRosterEntryFromResults({ results, sessionStartedAt: ts })
    expect(entry1.name).toBe(entry2.name)
  })

  it('spins is a deep copy of results (not same reference)', () => {
    const results = makeFixtureResults()
    const entry = buildRosterEntryFromResults({ results, sessionStartedAt: '2026-01-01T00:00:00Z' })
    expect(entry.spins).toEqual(results)
    // Mutating original results should not affect entry.spins
    results[0].resultLabel = 'MUTATED'
    expect(entry.spins[0].resultLabel).toBe('Human')
  })

  it('falls back gracefully when race/archetype are missing', () => {
    const results: SpinResult[] = []
    const entry = buildRosterEntryFromResults({ results, sessionStartedAt: '2026-01-01T00:00:00Z' })
    expect(entry.race).toBe('Unknown Race')
    expect(entry.archetype).toBe('Unknown Archetype')
  })
})

// ── wof_* isolation ───────────────────────────────────────────────────────────
describe('wof_* key isolation', () => {
  it('does not touch any wof_* localStorage key after all CRUD operations', () => {
    const session = createStorySession()
    saveStorySession(session)
    loadStorySession()
    clearStorySession()
    const results = makeFixtureResults()
    buildRosterEntryFromResults({ results, sessionStartedAt: '2026-01-01T00:00:00Z' })

    // Inspect the mock store for any wof_* key
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        expect(key).not.toMatch(/^wof_/)
      }
    }
  })
})
