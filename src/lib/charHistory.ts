// Rolling history of the last 5 locally-completed characters. Lets users
// glance back at recent runs from the main menu without round-tripping the
// backend. Replaces the previous LAST_CHAR_KEY singleton (kept here as the
// 0th slot of the new array for backward compat).
import type { SpinResult } from '$lib/session/types'

export interface CharHistoryEntry {
  results: SpinResult[]
  name: string
  startedAt: string   // ISO timestamp
  savedAt: string     // ISO timestamp of when it was pushed
  // shareId is set once the character has been POSTed to the server. Absent =
  // local-only run that the user could optionally save to their profile from
  // the history viewer.
  shareId?: string
}

const KEY = 'wof_char_history_v1'
const MAX_ENTRIES = 5

function safeRead(): CharHistoryEntry[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CharHistoryEntry[]
    return Array.isArray(parsed) ? parsed.slice(0, MAX_ENTRIES) : []
  } catch { return [] }
}

function safeWrite(entries: CharHistoryEntry[]): void {
  if (typeof localStorage === 'undefined') return
  try { localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES))) } catch { /* quota — ignore */ }
}

export function loadCharHistory(): CharHistoryEntry[] {
  return safeRead()
}

export function pushCharHistory(entry: Omit<CharHistoryEntry, 'savedAt'>): CharHistoryEntry[] {
  const next: CharHistoryEntry[] = [
    { ...entry, savedAt: new Date().toISOString() },
    ...safeRead().filter(e => e.startedAt !== entry.startedAt),
  ].slice(0, MAX_ENTRIES)
  safeWrite(next)
  return next
}

export function clearCharHistory(): void {
  if (typeof localStorage === 'undefined') return
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}

// Match by startedAt (the unique per-session timestamp) and patch the entry —
// used to record a shareId once the server confirms the save.
export function markCharSaved(startedAt: string, shareId: string): CharHistoryEntry[] {
  const next = safeRead().map(e => e.startedAt === startedAt ? { ...e, shareId } : e)
  safeWrite(next)
  return next
}

// Backward-compat read of the old single-character key. Used once on the next
// page load to migrate users to the new array format.
export function migrateLegacyLastChar(legacyKey: string): CharHistoryEntry | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(legacyKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { results: SpinResult[]; name: string; startedAt?: string }
    if (!parsed?.results) return null
    const entry: CharHistoryEntry = {
      results: parsed.results,
      name: parsed.name,
      startedAt: parsed.startedAt ?? new Date().toISOString(),
      savedAt: new Date().toISOString(),
    }
    pushCharHistory(entry)
    localStorage.removeItem(legacyKey)
    return entry
  } catch { return null }
}
