// Hall of Fame — a localStorage cache of the player's past characters,
// used by lineage-aware race twists (Demi-god, future Reincarnation, etc.)
// to reference an actual previous build rather than a generic divine
// parent. Pure data layer; no UI. Capped at 25 entries so the cache
// can't grow unbounded.
//
// Inspired by — not copied from — the Wheel of Faith fandom's
// "characters reference past characters" pattern. Our version is local-
// only (no shared universe yet) but lays the groundwork.

const STORAGE_KEY = 'wof_hall_of_fame'
const MAX_ENTRIES = 25

export interface HallOfFameEntry {
  // Snapshot taken at character finalization time.
  name: string
  race: string
  archetype: string
  overallGrade?: string
  overallScore?: number
  // ISO timestamp of when the character was created.
  savedAt: string
  // Optional signature power (highest-grade power in the build).
  signaturePower?: string
}

function readAll(): HallOfFameEntry[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}
function writeAll(entries: HallOfFameEntry[]) {
  if (typeof localStorage === 'undefined') return
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES))) } catch { /* private mode */ }
}

// Save a new entry to the front. Trims to MAX_ENTRIES. Skips duplicates
// (same name + savedAt) to avoid spam from re-saves.
export function saveToHallOfFame(entry: HallOfFameEntry) {
  const existing = readAll()
  const isDup = existing.some(e => e.name === entry.name && e.savedAt === entry.savedAt)
  if (isDup) return
  writeAll([entry, ...existing])
}

// Read the most recent N entries (descending, newest first).
export function recentCharacters(limit: number = 10): HallOfFameEntry[] {
  return readAll().slice(0, limit)
}

// Pick a "parent" entry for a lineage-aware race. Filters out entries
// with the same name as the current character (no self-parenting).
// Returns null if no eligible entry exists.
export function pickLineageParent(excludeName?: string): HallOfFameEntry | null {
  const pool = readAll().filter(e => !excludeName || e.name !== excludeName)
  if (pool.length === 0) return null
  return pool[Math.floor(Math.random() * pool.length)]
}

// Clear the entire hall (settings page can offer this).
export function clearHallOfFame() {
  if (typeof localStorage === 'undefined') return
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* */ }
}
