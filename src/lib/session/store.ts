import type { SessionState } from './types'

const STORAGE_KEY = 'wof_session'

export function createSession(): SessionState {
  return {
    sessionId: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    completedSpins: [],
  }
}

export function loadSession(): SessionState | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as SessionState
  } catch {
    return null
  }
}

// Throttled session persistence. We previously serialised the entire session on
// every spin tick — for a 23-spin run with stat-bonus splices that's 25–30 large
// JSON.stringify calls hitting localStorage on the spin animation thread. Now we
// debounce by 200ms and coalesce, with an immediate flush on tab hide so resume
// still works if the user backgrounds the app or refreshes.
let _pending: SessionState | null = null
let _timer: ReturnType<typeof setTimeout> | null = null
const FLUSH_DELAY = 200

function _flush(): void {
  if (!_pending || typeof localStorage === 'undefined') return
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_pending)) } catch { /* quota — drop */ }
  _pending = null
  if (_timer) { clearTimeout(_timer); _timer = null }
}

if (typeof window !== 'undefined') {
  // Flush before the tab is hidden or unloaded so we never lose recent spins.
  window.addEventListener('pagehide', _flush)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') _flush() })
}

export function saveSession(session: SessionState): void {
  if (typeof localStorage === 'undefined') return
  _pending = session
  if (_timer) return
  _timer = setTimeout(_flush, FLUSH_DELAY)
}

// Bypass the throttle — call at session end when caller needs the next read
// (e.g. a resume check) to see the latest state synchronously.
export function flushSession(): void { _flush() }

export function clearSession(): void {
  if (typeof localStorage === 'undefined') return
  _pending = null
  if (_timer) { clearTimeout(_timer); _timer = null }
  localStorage.removeItem(STORAGE_KEY)
}
