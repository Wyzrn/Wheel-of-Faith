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
// Stage 2: weight >= 4 → + Paladin, Ranger, Bard, Cleric, Anti-Hero, Demon Slayer, Shinobi
// Stage 3: weight >= 3 → + Berserker, Monk, Dual Wielder, Stand User, Nen Hunter, Esper, etc.
// Stage 4: weight >= 2 → + Necromancer, Druid, Artificer, Warlock, Devil Fruit User, etc.
// Stage 5+: weight >= 1 → all archetypes
export const ARCHETYPE_STAGE_MIN_WEIGHTS = [5, 4, 3, 2, 1, 1] as const

/**
 * Returns the subset of races available at the given stage (1–6).
 * Stage 1: weight >= 12 (Common — Human, Halfling, Goblin, Gnome, Dwarf, Robot)
 * Stage 2: weight >= 7  (+ Uncommon — Elf, Orc, Half-Elf, Tiefling, Warforged, …)
 * Stage 3: weight >= 5  (+ Rare — Dragon, Vampire, Demon, Shinobi, Mutant, …)
 * Stage 4: weight >= 4  (+ Epic — Saiyan, Mindflayer, Hollow/Arrancar, Angel, …)
 * Stage 5: weight >= 2  (+ Legendary — God, Kryptonian, Asgardian, Demi-god, …)
 * Stage 6: weight >= 1  (+ Godlike — Viltrumite and all remaining)
 */
export function getRacesForStage(stage: number): Race[] {
  const clamped = Math.max(1, Math.min(6, stage))
  const minWeight = STAGE_MIN_WEIGHTS[clamped - 1]
  return races.filter(r => r.weight >= minWeight)
}

/**
 * Returns a human-readable tier label for the given stage (e.g. "Common", "Rare").
 */
export function getStageTierLabel(stage: number): string {
  const clamped = Math.max(1, Math.min(6, stage))
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
