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

/** Applies a secret event's mechanical effect to a SpinResult stream. Pure
 *  function — returns a new array. Most effects are deferred to spin-time
 *  hooks (e.g. CosmicAlignment registers a +2 tier shift to be applied at
 *  every power spin). This helper is for events whose effect is a one-shot
 *  rewrite of an existing result. */
export function applyEventToResults(eventId: SecretEventId, results: SpinResult[]): SpinResult[] {
  switch (eventId) {
    case 'DivineIntervention': {
      // Find the worst stat result and shift it up by +5 tier levels.
      const stat = [...results]
        .filter(r => r.score !== undefined && /^(strength|speed|agility|durability|iq|charisma|fightingSkill|powerMastery|weaponMastery|armorStrength|potential|energyLevel)$/.test(r.category))
        .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0]
      if (!stat) return results
      return results.map(r => r === stat ? { ...r, score: Math.min(165, (stat.score ?? 0) + 30) } : r)
    }
    // FateFracture, TimelineError, etc. influence FUTURE wheels — they're
    // applied via flag rather than result rewrite. Handled by the spin
    // controller's wheel-builder hooks.
    default:
      return results
  }
}

export function getEventDef(id: SecretEventId): SecretEventDef | undefined {
  return SECRET_EVENTS.find(e => e.id === id)
}
