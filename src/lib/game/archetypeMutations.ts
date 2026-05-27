// archetypeMutations.ts — Race × Archetype overlay rules that mutate
// injected wheels and inject hidden outcomes. Lets a Saiyan + Berserker
// feel different from a Saiyan + Martial Artist beyond just the
// statModifiers stack.
//
// A mutation can:
//   1. Replace a race-injected wheel's segments entirely (e.g. Saiyan's
//      Transformation Wheel becomes rage-focused when paired with Berserker).
//   2. Add bonus segments to an existing wheel (e.g. Vampire + Noble adds
//      Royal Bloodline outcomes).
//   3. Bias the secret-event roll for this character (Demon + Cursed
//      Sorcerer fires Corruption events more often).
//   4. Add a hidden archetype-only segment to the standard power pool.
//
// Mutations are keyed off "${raceLabel}::${archetypeLabel}" and resolved at
// run time during race-extras splice + power-pool build. Each mutation is
// pure data so it can be authored alongside content.

import type { WeightedSegment } from '$lib/session/types'

export interface ArchetypeMutation {
  /** Per-wheel segment overrides. Key = RaceWheel.id (e.g. "transformation"). */
  wheelOverrides?: Record<string, WeightedSegment[]>
  /** Additional segments appended to the named wheel. */
  wheelAdditions?: Record<string, WeightedSegment[]>
  /** Multiplier on the secret-event base chance for this character. */
  secretEventBias?: number
  /** Free-text flavor string surfaced on the character card under "Synergy". */
  synergyFlavor?: string
}

const _mutations = new Map<string, ArchetypeMutation>()
function key(race: string, archetype: string): string { return `${race}::${archetype}` }

export function registerMutation(race: string, archetype: string, mut: ArchetypeMutation): void {
  _mutations.set(key(race, archetype), mut)
}

export function getMutation(race: string, archetype: string): ArchetypeMutation | undefined {
  return _mutations.get(key(race, archetype))
}

/** Resolves a race-wheel's final segment list, applying any archetype
 *  mutation that targets the same wheel id. Returns null if no base wheel
 *  exists for the (race, wheelId) pair. */
export function resolveMutatedSegments(
  baseSegments: WeightedSegment[] | null,
  race: string,
  archetype: string | undefined,
  wheelId: string,
): WeightedSegment[] | null {
  if (!baseSegments) return null
  if (!archetype) return baseSegments
  const mut = getMutation(race, archetype)
  if (!mut) return baseSegments
  if (mut.wheelOverrides?.[wheelId]) return mut.wheelOverrides[wheelId]
  if (mut.wheelAdditions?.[wheelId]) return [...baseSegments, ...mut.wheelAdditions[wheelId]]
  return baseSegments
}
