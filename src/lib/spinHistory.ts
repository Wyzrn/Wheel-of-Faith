import { computeOverallScore, scoreTier } from '$lib/game/scoreTier'
import type { SpinResult } from '$lib/session/types'

const HISTORY_KEY = 'wof_spin_history'
const MAX_ENTRIES = 50

export interface SpinHistoryEntry {
  sessionId: string
  completedAt: string
  name: string
  race: string
  archetype: string
  overallTier: string
  overallScore: number
  spinCount: number
}

export function loadSpinHistory(): SpinHistoryEntry[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    return JSON.parse(raw) as SpinHistoryEntry[]
  } catch {
    return []
  }
}

const STAT_WEIGHTS: Record<string, number> = {
  fightingSkill: 0.16, strength: 0.13, durability: 0.13, speed: 0.11,
  powerMastery: 0.11, agility: 0.09, energyLevel: 0.09, iq: 0.07,
  weaponMastery: 0.06, potential: 0.03, charisma: 0.02,
}

export function appendSpinHistory(results: SpinResult[], name: string, sessionId: string): void {
  if (typeof localStorage === 'undefined') return

  const statMap: Record<string, number> = {}
  for (const r of results) {
    if (r.score !== undefined && STAT_WEIGHTS[r.category] !== undefined) {
      statMap[r.category] = r.score
    }
  }

  const entry: SpinHistoryEntry = {
    sessionId,
    completedAt: new Date().toISOString(),
    name: name.trim() || 'The Unnamed',
    race: results.find(r => r.category === 'race')?.resultLabel ?? '—',
    archetype: results.find(r => r.category === 'archetype')?.resultLabel ?? '—',
    overallTier: scoreTier(computeOverallScore(statMap)),
    overallScore: computeOverallScore(statMap),
    spinCount: results.length,
  }

  const history = loadSpinHistory()
  history.unshift(entry)
  if (history.length > MAX_ENTRIES) history.splice(MAX_ENTRIES)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
}
