// Story Mode localStorage CRUD — isolated from main-game session state.
// Never reads or writes wof_session, wof_spin_history, or any wof_* key.

import type { StoryRosterEntry } from './types'

const ROSTER_KEY = 'story_roster'
const SHARDS_KEY = 'story_shards'

/** Maximum number of characters allowed in the Story Mode roster. */
export const MAX_ROSTER_SIZE = 50

// ─── Roster ───────────────────────────────────────────────────────────────────

/**
 * Loads the roster from localStorage.
 * Returns [] when localStorage is unavailable, the key is missing, or the data is corrupted.
 */
export function loadRoster(): StoryRosterEntry[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(ROSTER_KEY)
    if (!raw) return []
    return JSON.parse(raw) as StoryRosterEntry[]
  } catch {
    return []
  }
}

/**
 * Persists the roster to localStorage.
 * No-op when localStorage is unavailable.
 */
export function saveRoster(roster: StoryRosterEntry[]): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(ROSTER_KEY, JSON.stringify(roster))
}

/**
 * Prepends a new entry to the roster (most-recent-first) and calls saveRoster.
 * Returns null (without writing) when the roster is already at MAX_ROSTER_SIZE.
 * Returns the updated roster array on success.
 */
export function addToRoster(
  roster: StoryRosterEntry[],
  entry: StoryRosterEntry,
): StoryRosterEntry[] | null {
  if (roster.length >= MAX_ROSTER_SIZE) return null
  const updated = [entry, ...roster]
  saveRoster(updated)
  return updated
}

// ─── Shards ───────────────────────────────────────────────────────────────────

/**
 * Loads the Fate Shard balance from localStorage.
 * Returns 0 when localStorage is unavailable, the key is missing, or the value is malformed.
 */
export function loadShards(): number {
  if (typeof localStorage === 'undefined') return 0
  const raw = parseInt(localStorage.getItem(SHARDS_KEY) ?? '0', 10)
  return isNaN(raw) ? 0 : raw
}

/**
 * Persists the Fate Shard balance to localStorage.
 * No-op when localStorage is unavailable.
 */
export function saveShards(amount: number): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(SHARDS_KEY, String(amount))
}
