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

export function saveSession(session: SessionState): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function clearSession(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}
