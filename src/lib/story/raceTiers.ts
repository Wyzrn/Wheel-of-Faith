// 6-tier race and archetype availability system for Story Mode.
// Races/archetypes are grouped by their spin weight: higher weight = more common = available earlier.
// Each stage unlocks the next tier, so rarer options only appear as the player progresses.

import { races } from '$lib/content/races'
import { archetypes } from '$lib/content/archetypes'
import type { Race, Archetype } from '$lib/content/types'
import { STAGE_MIN_WEIGHTS, STAGE_LABELS } from './saveSlots'

export type { Race, Archetype }

// Archetypes have weights 1–6, so use tighter thresholds than the race system.
// Stage 1: weight >= 5 → Warrior, Mage, Rogue, Superhero (4 archetypes)
// Stage 2: weight >= 4 → + Paladin, Ranger, Bard, Cleric, Anti-Hero, Dawnbringer, Shadowblade
// Stage 3: weight >= 3 → + Berserker, Monk, Dual Wielder, Phantom Bonded, Aura Hunter, Psion, etc.
// Stage 4: weight >= 2 → + Necromancer, Druid, Artificer, Warlock, Cursed Fruit Eater, etc.
// Stage 5+: weight >= 1 → all archetypes
export const ARCHETYPE_STAGE_MIN_WEIGHTS = [5, 4, 3, 2, 1, 1] as const

/**
 * Returns the subset of races available at the given stage (1–9).
 * Threshold ladder (matches STAGE_MIN_WEIGHTS in saveSlots.ts):
 *   Stage 1: weight >= 10 — Common only
 *   Stage 2: weight >=  9 — + Uncommon
 *   Stage 3: weight >=  8 — + Rare
 *   Stage 4–5: weight >= 5 — + Legendary
 *   Stage 6–7: weight >= 4 — + Mythological
 *   Stage 8–9: weight >= 2 — + Divine (everything)
 */
export function getRacesForStage(stage: number): Race[] {
  const clamped = Math.max(1, Math.min(STAGE_MIN_WEIGHTS.length, stage))
  const minWeight = STAGE_MIN_WEIGHTS[clamped - 1]
  return races.filter(r => r.weight >= minWeight)
}

/**
 * Returns a human-readable tier label for the given stage (e.g. "Common", "Rare").
 */
export function getStageTierLabel(stage: number): string {
  const clamped = Math.max(1, Math.min(STAGE_LABELS.length, stage))
  return STAGE_LABELS[clamped - 1]
}

/**
 * Returns the subset of archetypes available at the given stage (1–6).
 */
export function getArchetypesForStage(stage: number): Archetype[] {
  const clamped = Math.max(1, Math.min(6, stage))
  const minWeight = ARCHETYPE_STAGE_MIN_WEIGHTS[clamped - 1]
  return archetypes.filter(a => a.weight >= minWeight)
}

/**
 * Converts a race array to weighted segments compatible with SpinWheel.
 * Sorted by weight DESCENDING so the wheel reads as a rarity gradient
 * (commons cluster on one side, rares cluster on the other) instead of
 * a chaotic mix. Stable tie-breaker on label keeps the order
 * deterministic when two races share a weight.
 */
export function racesToSegments(raceList: Race[]): { label: string; weight: number }[] {
  return [...raceList]
    .sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label))
    .map(r => ({ label: r.label, weight: r.weight }))
}

/**
 * Converts an archetype array to weighted segments compatible with SpinWheel.
 * Same sort as races — high weight first → low weight last, deterministic.
 */
export function archetypesToSegments(archetypeList: Archetype[]): { label: string; weight: number }[] {
  return [...archetypeList]
    .sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label))
    .map(a => ({ label: a.label, weight: a.weight }))
}
