const API = '/api'

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
}

// Svelte 5 reactive auth state
let _user = $state<AuthUser | null>(null)
let _loading = $state(true)

export const auth = {
  get user() { return _user },
  get loading() { return _loading },
  get loggedIn() { return _user !== null },

  async init() {
    try {
      const res = await fetch(`${API}/auth/me`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        _user = data.user
      }
    } catch { /* network error — stay logged out */ }
    _loading = false
  },

  async login(username: string, password: string): Promise<string | null> {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await res.json()
    if (!res.ok) return data.error ?? 'Login failed'
    _user = data.user
    return null
  },

  async register(username: string, password: string, email?: string): Promise<string | null> {
    const res = await fetch(`${API}/auth/register`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, email }),
    })
    const data = await res.json()
    if (!res.ok) return data.error ?? 'Registration failed'
    _user = data.user
    return null
  },

  async logout() {
    await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' })
    _user = null
  },

  updateShopData(shards: number, gamepasses: string[]) {
    if (_user) _user = { ..._user, shards, gamepasses }
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
