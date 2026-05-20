// 6-tier race availability system for Story Mode.
// Races are grouped by their spin weight: higher weight = more common = available earlier.
// Each stage unlocks the next tier, so rarer races only appear as the player progresses.

import { races } from '$lib/content/races'
import type { Race } from '$lib/content/races'
import { STAGE_MIN_WEIGHTS, STAGE_LABELS } from './saveSlots'

export type { Race }

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
 * Converts a race array to weighted segments compatible with SpinWheel.
 */
export function racesToSegments(raceList: Race[]): { label: string; weight: number }[] {
  return raceList.map(r => ({ label: r.label, weight: r.weight }))
}
