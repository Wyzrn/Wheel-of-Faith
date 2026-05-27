// Phase 2 additions — import type only to avoid circular runtime dependency risk
import type { TierGrade } from '$lib/game/scoreTier'
import type { SpinDefinition } from '$lib/game/spinQueue'
import type { ElementType, ItemGrade } from '$lib/content/types'

export type SpinStatus = 'IDLE' | 'SPINNING' | 'LANDED' | 'REVEALED'

export interface WeightedSegment {
  label: string
  weight: number
  color?: string
  dimmed?: boolean  // true = shown greyed-out on wheel, weight should be 0 (never selectable)
  element?: ElementType
  grade?: ItemGrade
  // Optional tier — when present and ≥ Cosmic, the wheel renders a gradient fill
  // (using the --tier-*-grad CSS variables) instead of the flat `color` value.
  // Carried over from FlavorLabel.tier so flavor wheels light up the high-tier
  // segments with the right post-mortal palette.
  tier?: string
}

export interface SpinResult {
  step: number
  category: string
  resultLabel: string
  resultIndex: number
  timestamp: string
  // Phase 2 additions: populated for stat spins; undefined for non-stat (Race, Power, etc.)
  tier?: TierGrade
  score?: number
  // Set when a bonus pushes a stat beyond the normal 1–130 range.
  // Examples: "F- -5" (5 tiers below F-), "Absolute+10" (10 tiers above Absolute+).
  displayLabel?: string
}

export interface SessionState {
  sessionId: string
  startedAt: string
  completedSpins: SpinResult[]
  // Phase 2 additions: persisted for mid-session resume (D-11, CORE-05)
  spinQueue?: SpinDefinition[]    // serialized queue for resume; null = rebuild from scratch
  currentSpinIndex?: number       // resume pointer into spinQueue
  // Phase 3+: tracks which stats are awaiting a bonus/penalty spin (populated by transformations/classes)
  pendingStatBonuses?: Record<string, Array<'statBonus' | 'statPenalty'>>
}
