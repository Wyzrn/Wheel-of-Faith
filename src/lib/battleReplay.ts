// Battle replay storage — pure local first version. Stores the last 5 battle
// logs the player has fought so they can scroll back and read what happened.
// MVP scope: text replay only (the battle log lines + character names + result).
// Full frame-by-frame visual replay is a separate, much bigger project; this
// version unblocks the share-with-friends / "wait what just happened" use case
// for ~50 lines of code.

export interface ReplayEntry {
  id: string                          // crypto.randomUUID()
  savedAt: string                     // ISO timestamp
  mode: 'story' | 'rivals'
  worldGrade?: string                 // story only
  team1Label: string
  team2Label: string
  team1Chars: { name: string; race?: string; archetype?: string; tier?: string }[]
  team2Chars: { name: string; race?: string; archetype?: string; tier?: string }[]
  logLines: string[]
  playerWon: boolean
  // Optional raw battle simulation state — when present, the viewer can use
  // the existing TeamBattleScreen in replay mode (rather than just dumping
  // log lines). Stored as `unknown` because the full BattleCharacter / round
  // shape is internal to lib/game/battle and importing it here creates a
  // circular dep with the route; the viewer route does the type cast.
  fullState?: unknown
}

const STORAGE_KEY = 'wof_battle_replays_v1'
const MAX_REPLAYS = 5

function safeRead(): ReplayEntry[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ReplayEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

function safeWrite(entries: ReplayEntry[]): void {
  if (typeof localStorage === 'undefined') return
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_REPLAYS))) } catch { /* quota — drop oldest */ }
}

export function loadReplays(): ReplayEntry[] {
  return safeRead()
}

export function saveReplay(entry: Omit<ReplayEntry, 'id' | 'savedAt'>): ReplayEntry {
  const full: ReplayEntry = {
    ...entry,
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
  }
  const next = [full, ...safeRead()].slice(0, MAX_REPLAYS)
  safeWrite(next)
  return full
}

export function deleteReplay(id: string): void {
  safeWrite(safeRead().filter(r => r.id !== id))
}

export function clearReplays(): void {
  if (typeof localStorage === 'undefined') return
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
}
