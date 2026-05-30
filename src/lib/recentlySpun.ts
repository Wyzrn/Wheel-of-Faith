// Rolling list of the last 10 characters the player has fully spun. Powers
// the "Recently Spun" panel on the rivals menu — when an opponent
// disconnects mid-fight or times out, the player's freshly spun fighter is
// stashed here so they don't lose it even if they chose not to save to
// their permanent roster. localStorage-only; survives page reloads but is
// device-scoped.

import type { SpinResult } from './session/types'

export interface RecentlySpunEntry {
  id: string                 // local-only id; not a backend shareId
  name: string
  race?: string
  archetype?: string
  overallScore?: number
  overallTier?: string
  results: SpinResult[]
  savedAt: string            // ISO timestamp
  // Optional context label so the panel can show why it landed here
  // (e.g. "Opponent disconnected") without leaking match identifiers.
  reason?: string
}

const KEY = 'wof_recently_spun'
const CAP = 10

function read(): RecentlySpunEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as RecentlySpunEntry[]) : []
  } catch { return [] }
}

function write(list: RecentlySpunEntry[]) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, CAP))) }
  catch { /* quota exceeded — best effort */ }
}

export function getRecentlySpun(): RecentlySpunEntry[] { return read() }

/** Push a new entry to the head. Dupes by id are de-duplicated and the
 *  list is hard-capped at CAP (10). */
export function pushRecentlySpun(entry: Omit<RecentlySpunEntry, 'id' | 'savedAt'> & { id?: string }): RecentlySpunEntry {
  const id = entry.id ?? `rs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
  const full: RecentlySpunEntry = { ...entry, id, savedAt: new Date().toISOString() }
  const list = read().filter(e => e.id !== id)
  list.unshift(full)
  write(list)
  return full
}

export function removeRecentlySpun(id: string) {
  write(read().filter(e => e.id !== id))
}

export function clearRecentlySpun() { write([]) }
