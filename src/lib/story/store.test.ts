import { describe, it, expect, beforeEach } from 'vitest'
import { loadRoster, saveRoster, loadShards, saveShards, addToRoster, MAX_ROSTER_SIZE } from './store'
import type { StoryRosterEntry } from './types'

// Verbatim localStorage mock from src/lib/session/store.test.ts
let mockStore: Record<string, string>

beforeEach(() => {
  mockStore = {}
  globalThis.localStorage = {
    getItem(k: string) { return mockStore[k] ?? null },
    setItem(k: string, v: string) { mockStore[k] = v },
    removeItem(k: string) { delete mockStore[k] },
  } as unknown as Storage
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<StoryRosterEntry> = {}): StoryRosterEntry {
  return {
    id: crypto.randomUUID(),
    name: 'Crimson Reaper',
    race: 'Human',
    archetype: 'Warrior',
    overallScore: 50,
    overallTier: 'B+',
    spins: [],
    level: 1,
    xp: 0,
    statBonuses: {},
    createdAt: new Date().toISOString(),
    sessionStartedAt: new Date().toISOString(),
    ...overrides,
  }
}

// ─── loadRoster ───────────────────────────────────────────────────────────────

describe('loadRoster', () => {
  it('returns [] when localStorage is empty', () => {
    expect(loadRoster()).toEqual([])
  })

  it('returns [] for corrupted JSON', () => {
    mockStore['story_roster'] = '{"not valid json'
    expect(loadRoster()).toEqual([])
  })

  it('returns [] when the key is missing', () => {
    delete mockStore['story_roster']
    expect(loadRoster()).toEqual([])
  })
})

// ─── saveRoster + loadRoster ──────────────────────────────────────────────────

describe('saveRoster + loadRoster round-trip', () => {
  it('round-trips a single entry without data loss', () => {
    const entry = makeEntry()
    saveRoster([entry])
    const loaded = loadRoster()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].id).toBe(entry.id)
    expect(loaded[0].name).toBe(entry.name)
    expect(loaded[0].race).toBe(entry.race)
    expect(loaded[0].overallTier).toBe(entry.overallTier)
    expect(loaded[0].sessionStartedAt).toBe(entry.sessionStartedAt)
  })

  it('round-trips multiple entries in the correct order', () => {
    const entries = [makeEntry({ name: 'A' }), makeEntry({ name: 'B' }), makeEntry({ name: 'C' })]
    saveRoster(entries)
    const loaded = loadRoster()
    expect(loaded.map(e => e.name)).toEqual(['A', 'B', 'C'])
  })
})

// ─── loadShards ───────────────────────────────────────────────────────────────

describe('loadShards', () => {
  it('returns 0 when localStorage is empty', () => {
    expect(loadShards()).toBe(0)
  })

  it('returns 0 when story_shards key is absent', () => {
    delete mockStore['story_shards']
    expect(loadShards()).toBe(0)
  })

  it('returns 0 when story_shards value is not a valid number', () => {
    mockStore['story_shards'] = 'not-a-number'
    expect(loadShards()).toBe(0)
  })
})

// ─── saveShards + loadShards ──────────────────────────────────────────────────

describe('saveShards + loadShards round-trip', () => {
  it('round-trips an integer without data loss', () => {
    saveShards(750)
    expect(loadShards()).toBe(750)
  })

  it('round-trips zero', () => {
    saveShards(0)
    expect(loadShards()).toBe(0)
  })

  it('overwrites a previous value', () => {
    saveShards(100)
    saveShards(500)
    expect(loadShards()).toBe(500)
  })
})

// ─── addToRoster ──────────────────────────────────────────────────────────────

describe('addToRoster — under cap', () => {
  it('prepends the new entry (most-recent-first)', () => {
    const existing = makeEntry({ name: 'Old' })
    const newEntry = makeEntry({ name: 'New' })
    const result = addToRoster([existing], newEntry)
    expect(result).not.toBeNull()
    expect(result![0].name).toBe('New')
    expect(result![1].name).toBe('Old')
  })

  it('writes the updated roster to localStorage', () => {
    const entry = makeEntry()
    addToRoster([], entry)
    const stored = loadRoster()
    expect(stored).toHaveLength(1)
    expect(stored[0].id).toBe(entry.id)
  })

  it('returns the updated array with the new entry prepended', () => {
    const result = addToRoster([], makeEntry({ name: 'Solo' }))
    expect(result).toHaveLength(1)
    expect(result![0].name).toBe('Solo')
  })
})

describe('addToRoster — at cap (MAX_ROSTER_SIZE = 50)', () => {
  it('returns null when roster length equals MAX_ROSTER_SIZE', () => {
    const fullRoster = Array.from({ length: MAX_ROSTER_SIZE }, () => makeEntry())
    const result = addToRoster(fullRoster, makeEntry({ name: 'Over Cap' }))
    expect(result).toBeNull()
  })

  it('does NOT write to localStorage when at cap', () => {
    const fullRoster = Array.from({ length: MAX_ROSTER_SIZE }, () => makeEntry())
    // Baseline: clear store so we know nothing is there
    delete mockStore['story_roster']
    addToRoster(fullRoster, makeEntry({ name: 'Over Cap' }))
    // localStorage should NOT have been written because addToRoster returned null
    expect(mockStore['story_roster']).toBeUndefined()
  })

  it('accepts exactly MAX_ROSTER_SIZE - 1 entries (boundary)', () => {
    const almostFull = Array.from({ length: MAX_ROSTER_SIZE - 1 }, () => makeEntry())
    const entry = makeEntry({ name: 'Last Slot' })
    const result = addToRoster(almostFull, entry)
    expect(result).not.toBeNull()
    expect(result).toHaveLength(MAX_ROSTER_SIZE)
  })
})

// ─── Isolation: no wof_* keys ─────────────────────────────────────────────────

describe('key isolation — no wof_* keys written', () => {
  it('loadRoster does not read any wof_* key', () => {
    mockStore['wof_session'] = '{"test":true}'
    mockStore['wof_spin_history'] = '[]'
    loadRoster()
    // story functions should not modify the main-game keys
    expect(mockStore['wof_session']).toBe('{"test":true}')
    expect(mockStore['wof_spin_history']).toBe('[]')
  })

  it('saveRoster does not write any wof_* key', () => {
    saveRoster([makeEntry()])
    const wofKeys = Object.keys(mockStore).filter(k => k.startsWith('wof_'))
    expect(wofKeys).toHaveLength(0)
  })

  it('saveShards does not write any wof_* key', () => {
    saveShards(300)
    const wofKeys = Object.keys(mockStore).filter(k => k.startsWith('wof_'))
    expect(wofKeys).toHaveLength(0)
  })

  it('addToRoster does not write any wof_* key', () => {
    addToRoster([], makeEntry())
    const wofKeys = Object.keys(mockStore).filter(k => k.startsWith('wof_'))
    expect(wofKeys).toHaveLength(0)
  })
})
