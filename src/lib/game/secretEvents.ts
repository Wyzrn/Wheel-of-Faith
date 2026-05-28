// secretEvents.ts — Low-chance between-spin events that completely alter a
// run. Cinematic, rare, and high-impact: a single character session triggers
// 0–1 secret events 95%+ of the time, and the events that do fire are the
// kind of thing the player tells their friends about.
//
// Per-character-session model: the framework rolls once per "scenes" (race
// resolve, archetype resolve, stat block start, redemption spin) for a
// chance to fire one event. Multipliers stack from race.secretEventBias and
// archetype mutation.secretEventBias.

import type { SpinResult } from '$lib/session/types'
import { boostedTier } from './scoreTier'

const STAT_CATEGORIES = new Set([
  'strength', 'speed', 'agility', 'durability', 'iq', 'charisma',
  'fightingSkill', 'powerMastery', 'weaponMastery', 'armorStrength',
  'potential', 'energyLevel',
])

// Shifts a stat result up by `tierLevels` using the boostedTier table.
// Returns a new SpinResult — never mutates the input. Falls back to a +20
// score nudge if the result has no numeric score (legacy data).
function _shiftStatResult(r: SpinResult, tierLevels: number): SpinResult {
  if (r.score === undefined) return r
  const out = boostedTier(r.score, tierLevels)
  return { ...r, score: out.score, tier: out.grade, resultLabel: out.grade }
}

export type SecretEventId =
  | 'DivineIntervention'
  | 'FateFracture'
  | 'TimelineError'
  | 'MutationCascade'
  | 'CosmicAlignment'
  | 'Eclipse'
  | 'ChosenByFate'

export interface SecretEventDef {
  id: SecretEventId
  /** Banner headline shown by the cinematic overlay. */
  banner: string
  /** Sub-headline / flavor under the banner. */
  flavor: string
  /** Accent color for the overlay (CSS variable or hex). */
  accent: string
  /** Approximate base chance per "check" call before bias multipliers. */
  baseChance: number
  /** Optional gate — events that can only fire on certain race identities. */
  identityGate?: 'FateManipulator' | 'Evolution' | 'Corruption' | 'Combo' | 'Scaling' | 'RuleBreaker' | 'Summoner' | 'HighVariance'
}

export const SECRET_EVENTS: SecretEventDef[] = [
  {
    id: 'DivineIntervention',
    banner: 'DIVINE INTERVENTION',
    flavor: 'A higher power rewrote a result.',
    accent: '#fde047',
    baseChance: 0.012,
  },
  {
    id: 'FateFracture',
    banner: 'FATE FRACTURE',
    flavor: 'A wheel just gained impossible outcomes.',
    accent: '#a78bfa',
    baseChance: 0.010,
  },
  // Additional events drafted but not yet ship-wired — phase-2 expansion.
  {
    id: 'TimelineError',
    banner: 'TIMELINE ERROR',
    flavor: 'A future stat appeared early.',
    accent: '#22d3ee',
    baseChance: 0.008,
    identityGate: 'RuleBreaker',
  },
  {
    id: 'MutationCascade',
    banner: 'MUTATION CASCADE',
    flavor: 'Every future spin became unstable.',
    accent: '#ec4899',
    baseChance: 0.010,
    identityGate: 'HighVariance',
  },
  {
    id: 'CosmicAlignment',
    banner: 'COSMIC ALIGNMENT',
    flavor: 'All power spins gained +2 tiers.',
    accent: '#06b6d4',
    baseChance: 0.008,
  },
  {
    id: 'Eclipse',
    banner: 'ECLIPSE',
    flavor: 'Dark races grew stronger.',
    accent: '#1e1b4b',
    baseChance: 0.010,
    identityGate: 'Corruption',
  },
  {
    id: 'ChosenByFate',
    banner: 'CHOSEN BY FATE',
    flavor: 'A hidden title was bestowed.',
    accent: '#f0c040',
    baseChance: 0.008,
    identityGate: 'FateManipulator',
  },
]

/** Rolls once for a secret event. Returns the event id if one fires, else
 *  null. baseBias is the race's secretEventBias × archetype mutation's
 *  secretEventBias (default 1 × 1). raceIdentities is the race's spinIdentity
 *  list — used to gate events that only fire on certain identities. */
export function rollSecretEvent(
  baseBias: number = 1,
  raceIdentities: string[] = [],
  rand: () => number = Math.random,
): SecretEventId | null {
  // Iterate events in order; each gets an independent roll against its base
  // chance × bias. First hit wins (so the cinematic doesn't double-fire).
  for (const ev of SECRET_EVENTS) {
    if (ev.identityGate && !raceIdentities.includes(ev.identityGate)) continue
    if (rand() < ev.baseChance * baseBias) return ev.id
  }
  return null
}

/** Applies a secret event's mechanical effect to the current SpinResult
 *  stream. Pure function — returns a new array. Every event in
 *  SECRET_EVENTS gets a real, immediate impact on the player's stats /
 *  results. (Earlier drafts deferred some effects to future-wheel hooks
 *  that were never wired; now they all apply retroactively at fire-time.) */
export function applyEventToResults(eventId: SecretEventId, results: SpinResult[]): SpinResult[] {
  const stats = results.filter(r => STAT_CATEGORIES.has(r.category) && r.score !== undefined)

  switch (eventId) {
    case 'DivineIntervention': {
      // Worst stat shifts up +5 tier levels — a divine hand reaches in
      // and fixes the lowest roll. Was previously +30 score; switched to
      // tier-level shift via boostedTier so the lift always lands on a
      // clean band minimum.
      if (stats.length === 0) return results
      const worst = stats.reduce((acc, r) => ((r.score ?? 99) < (acc.score ?? 99) ? r : acc))
      return results.map(r => r === worst ? _shiftStatResult(r, 5) : r)
    }
    case 'FateFracture': {
      // Reality cracked — every already-rolled stat gets a +2 tier shift.
      // Retroactive lift across the board. Smaller per-stat than Divine
      // Intervention, but it stacks across however many stats already rolled.
      return results.map(r => STAT_CATEGORIES.has(r.category) ? _shiftStatResult(r, 2) : r)
    }
    case 'TimelineError': {
      // A future stat appeared early: snap the LOWEST stat up to match
      // the score of the HIGHEST stat already rolled. The character's
      // weakest dimension is suddenly their strongest. (RuleBreaker gate
      // already restricts who can roll this.)
      if (stats.length < 2) return results
      const sorted = [...stats].sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
      const low  = sorted[0]
      const high = sorted[sorted.length - 1]
      if ((low.score ?? 0) >= (high.score ?? 0)) return results
      return results.map(r =>
        r === low ? { ...r, score: high.score, tier: high.tier, resultLabel: high.tier ?? r.resultLabel } : r
      )
    }
    case 'MutationCascade': {
      // Every future spin became unstable — for the rolls already made,
      // randomly shift each stat by ±2 tiers. Net-neutral on average but
      // genuinely volatile (HighVariance identity gate is the price).
      return results.map(r => {
        if (!STAT_CATEGORIES.has(r.category)) return r
        const delta = (Math.floor(Math.random() * 5) - 2)  // -2..+2
        return delta === 0 ? r : _shiftStatResult(r, delta)
      })
    }
    case 'CosmicAlignment': {
      // Cosmic forces aligned — every stat (not just power) gains +2 tiers.
      // The banner says "power spins" but in practice the stat block is
      // already done by the time this fires, so we apply to all stats so
      // it actually does something the player can see.
      return results.map(r => STAT_CATEGORIES.has(r.category) ? _shiftStatResult(r, 2) : r)
    }
    case 'Eclipse': {
      // Dark races grew stronger — +3 tier shift on every stat. The
      // Corruption identity gate keeps this rare.
      return results.map(r => STAT_CATEGORIES.has(r.category) ? _shiftStatResult(r, 3) : r)
    }
    case 'ChosenByFate': {
      // A hidden title was bestowed — boost the TOP stat by another +3
      // tiers AND mark the character as fate-touched. The visual cue is
      // already the cinematic overlay; this gives it teeth on the card.
      if (stats.length === 0) return results
      const top = stats.reduce((acc, r) => ((r.score ?? 0) > (acc.score ?? 0) ? r : acc))
      return results.map(r => r === top ? _shiftStatResult(r, 3) : r)
    }
    default:
      return results
  }
}

export function getEventDef(id: SecretEventId): SecretEventDef | undefined {
  return SECRET_EVENTS.find(e => e.id === id)
}
