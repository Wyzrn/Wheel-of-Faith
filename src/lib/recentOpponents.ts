// Local rolling list of recently-battled opponents — used on the profile page
// to surface "play again" / "view profile" links. The rivals WS already knows
// the opponent's username when battle_start fires, so we record it client-side
// each time a battle resolves.
//
// We deliberately don't try to cache opponent stats here — the user's profile
// page can re-fetch fresh data via /api/users/:username/profile when clicked.

const KEY = 'wof_recent_opponents_v1'
const MAX = 8

export interface RecentOpponent {
  username: string
  lastBattledAt: string
  myResult: 'won' | 'lost' | 'draw'
  mode: 'rivals' | 'local' | 'bot'
}

function safeRead(): RecentOpponent[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as RecentOpponent[]
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

function safeWrite(entries: RecentOpponent[]): void {
  if (typeof localStorage === 'undefined') return
  try { localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX))) } catch { /* quota */ }
}

export function loadRecentOpponents(): RecentOpponent[] {
  return safeRead()
}

export function recordOpponent(opp: Omit<RecentOpponent, 'lastBattledAt'>): RecentOpponent[] {
  if (!opp.username || opp.username === 'BOT' || opp.username === 'Opponent') return safeRead()
  const now = new Date().toISOString()
  // Move to top if exists (most-recent-first)
  const filtered = safeRead().filter(o => o.username !== opp.username)
  const next = [{ ...opp, lastBattledAt: now }, ...filtered].slice(0, MAX)
  safeWrite(next)
  return next
}
