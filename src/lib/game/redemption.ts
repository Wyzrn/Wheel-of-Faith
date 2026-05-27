import { SCORE_EXTENDED_MIN, SCORE_EXTENDED_MAX } from './scoreTier'

// Score range is [SCORE_EXTENDED_MIN, SCORE_EXTENDED_MAX]. Normalize so the
// weakest scores get the highest redemption probability (0.85) and the
// strongest get the lowest (0.05). The exact divisor tracks the live score
// ceiling so the curve stays sensible as new top tiers are added.
const SCORE_SPAN = SCORE_EXTENDED_MAX - SCORE_EXTENDED_MIN
export function redemptionProbability(overallScore: number): number {
  const normalized = (overallScore - SCORE_EXTENDED_MIN) / SCORE_SPAN
  const p = 0.05 + 0.80 * Math.pow(1 - normalized, 2)
  return Math.max(0.05, Math.min(0.85, p))
}
