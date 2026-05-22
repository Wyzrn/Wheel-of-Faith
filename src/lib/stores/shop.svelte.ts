import { auth } from './auth.svelte'
import type { GamepassId } from '$lib/shop/gamepasses'

const API = '/api'

// ── Gamepass helpers (reads from auth store) ───────────────────────────────────

export const gamepasses = {
  has(id: GamepassId): boolean {
    return auth.user?.gamepasses.includes(id) ?? false
  },
  count(id: GamepassId): number {
    return auth.user?.gamepasses.filter(g => g === id).length ?? 0
  },
  get all(): string[] {
    return auth.user?.gamepasses ?? []
  },
}

// ── Shop actions ──────────────────────────────────────────────────────────────

let _buying = $state(false)
let _error  = $state<string | null>(null)

export const shop = {
  get buying() { return _buying },
  get error()  { return _error  },

  /** Redirect to Stripe Checkout for a shard pack. */
  async buyShardPack(packId: string): Promise<void> {
    if (_buying) return
    _buying = true
    _error  = null
    try {
      const res = await fetch(`${API}/shop/checkout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId }),
      })
      const data = await res.json()
      if (!res.ok) { _error = data.error ?? 'Checkout failed'; return }
      window.location.href = data.url
    } catch {
      _error = 'Network error — try again'
    } finally {
      _buying = false
    }
  },

  /** Purchase a gamepass using account shards. */
  async buyGamepass(id: GamepassId): Promise<string | null> {
    if (_buying) return 'busy'
    _buying = true
    _error  = null
    try {
      const res = await fetch(`${API}/shop/gamepasses/${id}`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = data.error === 'already owned' ? 'Already owned'
          : data.error === 'not enough shards' ? `Need ${data.need?.toLocaleString()} shards`
          : data.error ?? 'Purchase failed'
        _error = msg
        return msg
      }
      auth.updateShopData(data.shards, data.gamepasses)
      return null
    } catch {
      _error = 'Network error — try again'
      return _error
    } finally {
      _buying = false
    }
  },

  /** Refresh account shards + gamepasses from backend. */
  async refresh(): Promise<void> {
    if (!auth.loggedIn) return
    try {
      const res = await fetch(`${API}/shop/me`, { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      auth.updateShopData(data.shards, data.gamepasses)
    } catch { /* silent */ }
  },

  clearError() { _error = null },
}
