// Story Mode type definitions — interface-only module, no runtime code.
// No default export. All imports use `import type` to avoid circular runtime deps.

import type { SpinResult } from '$lib/session/types'
import type { TierGrade } from '$lib/game/scoreTier'

/** An item equipped on a roster character (from opening a graded crystal). */
export interface EquippedItem {
  id: string
  grade: string
  name: string
}

/** A single entry in the Story Mode roster — snapshot of a completed character. */
export interface StoryRosterEntry {
  /** Unique identifier, populated by `crypto.randomUUID()` at write time. */
  id: string
  /** Auto-generated fantasy name (adjective + noun), seeded from stats — permanent and never editable. */
  name: string
  /** Race label, denormalized from spins for sort/filter. */
  race: string
  /** Archetype label, denormalized from spins for sort/filter. */
  archetype: string
  /** Overall character score, computed via `computeOverallScore()` at session end. */
  overallScore: number
  /** Overall tier grade, derived from `scoreTier(overallScore)` at session end — stored, never re-derived at display time. */
  overallTier: TierGrade
  /** Full spin result array — used by CharacterCard for rendering. */
  spins: SpinResult[]
  /** Character level, increases as XP accumulates from battles. */
  level: number
  /** Total accumulated XP from battle drops. */
  xp: number
  /** Stat bonuses applied from Stat Crystals, keyed by stat category name. */
  statBonuses: Record<string, number>
  /** All weapons equipped to this character. Items are added, never replaced. */
  equippedWeapons: EquippedItem[]
  /** All armor pieces equipped to this character. */
  equippedArmors: EquippedItem[]
  /** All powers equipped to this character. */
  equippedPowers: EquippedItem[]
  /** ISO timestamp of when this entry was added to the roster. */
  createdAt: string
  /** ISO timestamp captured when the story spin session began; passed as the `startedAt` prop to CharacterCard. */
  sessionStartedAt: string
  /** Spin class used to create this character — affects battle stat multiplier and luck boost. */
  spinClass?: 'hero' | 'legend' | 'paragon'
  /** AI-generated portrait URL hosted on R2. Populated on first expand of
   *  this roster entry via POST /api/story-slots/roster-portrait. Persists
   *  with the save slot via the existing cloudAutosave pipeline. */
  portraitUrl?: string | null
  /** ISO timestamp set when the owner used their one allowed regenerate.
   *  Prevents repeated regen-clicks and matches the saved-character rule. */
  portraitRegeneratedAt?: string | null
}

/** Top-level Story Mode state shape. */
export interface StoryState {
  /** The player's roster of saved characters (max 50). */
  roster: StoryRosterEntry[]
  /** Current Fate Shard balance earned from selling characters. */
  shards: number
}

/** A named team of roster characters used for battles. */
export interface StoryTeam {
  id: string
  name: string
  /** Ordered list of character IDs from the roster. First valid member fights. */
  characterIds: string[]
  createdAt: string
}
