// Story Mode type definitions — interface-only module, no runtime code.
// No default export. All imports use `import type` to avoid circular runtime deps.

import type { SpinResult } from '$lib/session/types'
import type { TierGrade } from '$lib/game/scoreTier'

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
  /** ISO timestamp of when this entry was added to the roster. */
  createdAt: string
  /** ISO timestamp captured when the story spin session began; passed as the `startedAt` prop to CharacterCard. */
  sessionStartedAt: string
}

/** Top-level Story Mode state shape. */
export interface StoryState {
  /** The player's roster of saved characters (max 50). */
  roster: StoryRosterEntry[]
  /** Current Fate Shard balance earned from selling characters. */
  shards: number
}
