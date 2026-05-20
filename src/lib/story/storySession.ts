// Story Mode session CRUD — isolated from main-game session state.
// This module never accesses the main-game wof_* localStorage namespace.

import { buildInitialQueue } from '$lib/game/spinQueue'
import type { SpinDefinition } from '$lib/game/spinQueue'
import { computeOverallScore, scoreTier } from '$lib/game/scoreTier'
import type { SpinResult } from '$lib/session/types'
import { generateCharacterName } from './naming'
import type { StoryRosterEntry } from './types'

/** The single localStorage key used for the in-progress story spin session. */
export const STORY_SESSION_KEY = 'story_session'

/** State shape for an in-progress Story Mode spin session. */
export interface StorySessionState {
  sessionId: string
  startedAt: string
  completedSpins: SpinResult[]
  spinQueue: SpinDefinition[]
  currentSpinIndex: number
}

/** Stat categories used for overall score computation (must match STAT_WEIGHTS in scoreTier.ts). */
const STAT_CATEGORIES = new Set([
  'strength', 'speed', 'agility', 'durability', 'iq',
  'charisma', 'fightingSkill', 'potential', 'energyLevel',
  'powerMastery', 'weaponMastery',
])

/**
 * Creates a fresh Story Mode session with a new UUID and filtered queue.
 * The redemptionSpin step is excluded — Story Mode defers redemption to Phase 8+.
 */
export function createStorySession(): StorySessionState {
  return {
    sessionId: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    completedSpins: [],
    spinQueue: buildInitialQueue().filter(def => def.category !== 'redemptionSpin'),
    currentSpinIndex: 0,
  }
}

/**
 * Loads the in-progress story session from localStorage.
 * Returns null when localStorage is unavailable, the key is missing, or the data is corrupted.
 */
export function loadStorySession(): StorySessionState | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORY_SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StorySessionState
  } catch {
    return null
  }
}

/**
 * Persists the story session to localStorage.
 * Caller is responsible for passing $state.snapshot(...) for any Svelte 5 proxies before invocation.
 * No-op when localStorage is unavailable.
 */
export function saveStorySession(session: StorySessionState): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORY_SESSION_KEY, JSON.stringify(session))
}

/**
 * Clears the in-progress story session from localStorage.
 * Call this after a session completes successfully.
 * No-op when localStorage is unavailable.
 */
export function clearStorySession(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(STORY_SESSION_KEY)
}

/**
 * Builds a StoryRosterEntry from the completed session results.
 * Pure function — no side effects, no localStorage access.
 * The caller must pass plain objects (not Svelte proxies) via $state.snapshot() before calling this.
 */
export function buildRosterEntryFromResults(args: {
  results: SpinResult[]
  sessionStartedAt: string
}): StoryRosterEntry {
  const { results, sessionStartedAt } = args

  const race = results.find(r => r.category === 'race')?.resultLabel ?? 'Unknown Race'
  const archetype = results.find(r => r.category === 'archetype')?.resultLabel ?? 'Unknown Archetype'

  // Build stat scores map for computeOverallScore (expects Record<string, number>)
  const statScores: Record<string, number> = {}
  for (const r of results) {
    if (STAT_CATEGORIES.has(r.category) && r.score !== undefined) {
      statScores[r.category] = r.score
    }
  }

  const overallScore = computeOverallScore(statScores)
  const overallTier = scoreTier(overallScore)
  const name = generateCharacterName(overallScore, race)

  return {
    id: crypto.randomUUID(),
    name,
    race,
    archetype,
    overallScore,
    overallTier,
    spins: JSON.parse(JSON.stringify(results)),
    level: 1,
    xp: 0,
    statBonuses: {},
    equippedWeapon: null,
    equippedArmor: null,
    equippedPower: null,
    createdAt: new Date().toISOString(),
    sessionStartedAt,
  }
}
