import { apiUrl } from '$lib/api'
// Used as `${API}/auth/me` etc., so this is the API root WITHOUT a trailing
// slash. apiUrl('') returns the configured backend origin (empty string on
// Heroku = same-origin, absolute https URL on itch.io). Then `/api/auth/me`
// appends correctly on both targets.
const API = apiUrl('/api')

export interface AuthUser {
  id: string
  username: string
  email?: string
  rivalsWins: number
  rivalsLosses: number
  gamesPlayed: number
  shards: number
  gamepasses: string[]
  dailyStreak?: number
  lastVisitDate?: string | null
  isAdmin?: boolean
  // Ranked Rivals MMR + rank tier (Copper → Paragon). Populated by /auth/me;
  // updated optimistically after each ranked match via the `ranked_result`
  // WS message so the menu chip stays fresh without a refetch.
  rankedMmr?: number
  rankedRank?: string
  rankedRankLabel?: string
}

// Svelte 5 reactive auth state
let _user = $state<AuthUser | null>(null)
let _loading = $state(true)

// Guarantee array fields the type promises but the server payload may omit
// (e.g. a freshly-registered account whose `gamepasses` hasn't been set).
// Without this, `auth.user.gamepasses.includes(...)` throws — and when that
// throw lands inside GSAP's spin onComplete it's swallowed, so the wheel
// lands but no result reveal ever fires.
function normalizeUser(u: AuthUser | null | undefined): AuthUser | null {
  if (!u) return null
  return { ...u, gamepasses: Array.isArray(u.gamepasses) ? u.gamepasses : [] }
}

export const auth = {
  get user() { return _user },
  get loading() { return _loading },
  get loggedIn() { return _user !== null },

  async init() {
    try {
      const res = await fetch(`${API}/auth/me`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        _user = normalizeUser(data.user)
      }
    } catch { /* network error — stay logged out */ }
    _loading = false
  },

  async login(username: string, password: string): Promise<string | null> {
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) return data.error ?? 'Login failed'
      _user = normalizeUser(data.user)
      return null
    } catch {
      return "Couldn't reach the server — check your connection and try again."
    }
  },

  async register(username: string, password: string, email?: string): Promise<string | null> {
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, email }),
      })
      const data = await res.json()
      if (!res.ok) return data.error ?? 'Registration failed'
      _user = normalizeUser(data.user)
      return null
    } catch {
      return "Couldn't reach the server — check your connection and try again."
    }
  },

  async logout() {
    try { await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' }) } catch { /* offline — clear locally anyway */ }
    _user = null
  },

  updateShopData(shards: number, gamepasses: string[]) {
    if (_user) _user = { ..._user, shards, gamepasses }
  },

  // Called by the rivals WS when a ranked match resolves. The server is
  // authoritative on the new MMR value; we just patch local state so the
  // menu chip reflects the change immediately. Rank label is recomputed
  // by the caller (avoids importing mmrRanks here for a single field).
  applyRankedDelta(newMmr: number, rank: string, rankLabel: string) {
    if (_user) _user = { ..._user, rankedMmr: newMmr, rankedRank: rank, rankedRankLabel: rankLabel }
  },

  // Server-truth refetch. Used after ranked matches resolve so the menu chip
  // (and any other consumer of auth.user) reflects the canonical MMR even if
  // the optimistic patch drifted from server state for any reason.
  async refresh(): Promise<void> {
    try {
      const res = await fetch(`${API}/auth/me`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        _user = normalizeUser(data.user)
      }
    } catch { /* keep optimistic state */ }
  },

  // Battle results are credited server-side via the rivals WebSocket
  // ('battle_result' message in rivals-ws.ts). The client only updates its
  // local optimistic counters here so the UI reflects the win immediately;
  // the real ledger lives on the server.
  recordBattleResult(won: boolean) {
    if (!_user) return
    if (won) _user = { ..._user, rivalsWins: _user.rivalsWins + 1, gamesPlayed: _user.gamesPlayed + 1 }
    else _user = { ..._user, rivalsLosses: _user.rivalsLosses + 1, gamesPlayed: _user.gamesPlayed + 1 }
  },
}
