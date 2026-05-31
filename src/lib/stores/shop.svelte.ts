import { auth } from './auth.svelte'
import { toast } from '$lib/toast.svelte'
import { GAMEPASSES, type GamepassId } from '$lib/shop/gamepasses'
import { apiUrl } from '$lib/api'

const API = apiUrl('/api').replace(/\/api$/, '')

// ── Gamepass helpers (reads from auth store) ───────────────────────────────────

export const gamepasses = {
  has(id: GamepassId): boolean {
    return auth.user?.gamepasses?.includes(id) ?? false
  },
  count(id: GamepassId): number {
    return auth.user?.gamepasses?.filter(g => g === id).length ?? 0
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

  /** Purchase a gamepass using account shards. Toasts success/failure for the
   *  caller; the returned string is the error message (kept for legacy callers
   *  that want to surface it inline in addition to the global toast). */
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
        toast.error(msg)
        return msg
      }
      auth.updateShopData(data.shards, data.gamepasses)
      const def = GAMEPASSES.find(g => g.id === id)
      toast.reward('Gamepass unlocked', def?.name ?? id)
      return null
    } catch {
      _error = 'Network error — try again'
      toast.error(_error)
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
