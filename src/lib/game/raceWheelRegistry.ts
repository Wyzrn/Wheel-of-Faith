// raceWheelRegistry.ts — Lookup of injected-wheel segments per race + per-wheel-id.
// Lives separately from races.ts so the race definitions stay focused on stat
// modifiers / pools / abilities, and per-race injected wheel content can grow
// independently. Archetype mutations (archetypeMutations.ts) consult this
// registry and can SWAP a wheel's segment pool keyed off (race, archetype).

import type { WeightedSegment } from '$lib/session/types'
import type { RaceWheel } from '$lib/content/types'

// Map of `${raceLabel}::${wheelId}` -> segments. Populated from each race's
// definition at module load time by registerRaceWheel(). Archetype mutation
// rules read this map and can ADD their own overrides at a separate scope.
const _raceWheels = new Map<string, RaceWheel>()

export function registerRaceWheel(raceLabel: string, wheel: RaceWheel): void {
  _raceWheels.set(`${raceLabel}::${wheel.id}`, wheel)
}

export function getRaceWheel(raceLabel: string, wheelId: string): RaceWheel | undefined {
  return _raceWheels.get(`${raceLabel}::${wheelId}`)
}

/** Returns the segments for a given race+wheel pairing. If an archetype
 *  mutation overrides the pool, the caller passes the override directly via
 *  archetypeMutations.getMutatedWheel() — this fallback is the unmutated
 *  default. */
export function getRaceWheelSegments(raceLabel: string, wheelId: string): WeightedSegment[] | null {
  const wheel = getRaceWheel(raceLabel, wheelId)
  if (!wheel) return null
  return wheel.segments as WeightedSegment[]
}

/** Internal: bulk-register a race's full injected wheel list. Called once
 *  per race from races.ts after the Race definition is finalised. */
export function bulkRegisterRaceWheels(raceLabel: string, wheels: RaceWheel[] | undefined): void {
  if (!wheels) return
  for (const w of wheels) registerRaceWheel(raceLabel, w)
}
