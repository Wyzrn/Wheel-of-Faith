// content/types.ts — Shared content data interfaces for all spin categories.
// Types only — no functions, no constants, no runtime code. No default export.
// Mirrors src/lib/session/types.ts structure (interface-only file).

import type { TierGrade } from '$lib/game/scoreTier'

// Race definition — drives racial ability spin count and weakness probability.
// Used in src/lib/content/races.ts (Plan 02-02).
export interface Race {
  label: string                       // display name shown on wheel and in results
  weight: number                      // for weightedRandom(); determines rarity
  abilitySpinCount: number            // 1–4; determines how many racialAbility slots are spliced
  weaknessProbabilityModifier: number // multiplier on baseline weakness draw probability (0.5–2.0)
  description?: string                // optional flavor text for character card
}

// Archetype definition — drives archetype ability spin count.
// Used in src/lib/content/archetypes.ts (Plan 02-02).
export interface Archetype {
  label: string
  weight: number
  abilitySpinCount: number // 1–4; determines how many archetypeAbility slots are spliced
  description?: string
}

// Minimal shared type for content items with only label, weight, and optional description.
// Used as base for powers, weapons, backstories, titles, enchantments.
export interface SimpleItem {
  label: string
  weight: number          // for rarity variation within pool
  description?: string
}

// Weakness extends SimpleItem — adds a severity flag for race-modulated drawing.
// severe: true entries are drawn preferentially for high-modifier races (CONT-05).
export interface Weakness extends SimpleItem {
  severe: boolean
}

// Flavor label for stat wheels (Strength, Speed, Agility, Durability, IQ, Charisma,
// Fighting Skill, Power Mastery, Weapon Mastery, Potential, Energy Level).
// Structural superset of WeightedSegment — can be passed directly to SpinWheel.
// tier and score are baked in at authoring time; never re-derived post-spin (CORE-04).
export interface FlavorLabel {
  label: string    // e.g., "Wet Noodle Arm" — shown on wheel segment and in results panel
  weight: number   // for weightedRandom(); all labels in same tier should have equal weight
  color?: string   // optional tier-keyed color e.g. 'var(--tier-f-minus)'; used by SpinWheel for segment fill
  tier: TierGrade  // embedded grade — read directly by onSpinComplete, never re-computed
  score: number    // numeric 1–100 derived from tier's canonical midpoint score
}
