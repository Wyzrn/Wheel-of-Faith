import { describe, it, expect, beforeEach } from 'vitest'
import { loadSession, saveSession, clearSession, createSession } from './store'

beforeEach(() => {
  globalThis.localStorage = {
    store: {} as Record<string, string>,
    getItem(k: string) { return (this.store as Record<string, string>)[k] ?? null },
    setItem(k: string, v: string) { (this.store as Record<string, string>)[k] = v },
    removeItem(k: string) { delete (this.store as Record<string, string>)[k] },
  } as unknown as Storage
})

describe('loadSession', () => {
  it('returns null when localStorage is empty', () => {
    expect(loadSession()).toBeNull()
  })

  it('returns null for corrupted JSON', () => {
    localStorage.setItem('wof_session', '{"bad json')
    expect(loadSession()).toBeNull()
  })
})

describe('saveSession + loadSession', () => {
  it('round-trip preserves session data', () => {
    const session = createSession()
    saveSession(session)
    const loaded = loadSession()
    expect(loaded?.sessionId).toBe(session.sessionId)
    expect(loaded?.startedAt).toBe(session.startedAt)
    expect(loaded?.completedSpins).toEqual([])
  })
})

describe('clearSession', () => {
  it('removes wof_session so loadSession returns null', () => {
    const session = createSession()
    saveSession(session)
    clearSession()
    expect(loadSession()).toBeNull()
  })
})

describe('createSession', () => {
  it('has a non-empty sessionId and empty completedSpins', () => {
    const session = createSession()
    expect(session.sessionId).toBeTruthy()
    expect(session.completedSpins).toEqual([])
  })
})
