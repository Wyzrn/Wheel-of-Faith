// Story Mode Fate Shard sell-value lookup — pure function module.
// Covers all 46 TierGrade values from F- through Absolute+.
// No default export. No runtime state.

import type { TierGrade } from '$lib/game/scoreTier'

// Tiers above SS (in ascending order). Index 0 = SS+ → stepsAboveSS = 1 → 600 shards.
// Index grows by 1 per tier; value = Math.min(2000, 500 + (idx + 1) * 100).
// Absolute+ sits near the top of the cap so it hits 2000.
const TIERS_ABOVE_SS: TierGrade[] = [
  'SS+',
  'SSS-', 'SSS', 'SSS+',
  'Z-', 'Z', 'Z+',
  'ZZ-', 'ZZ', 'ZZ+',
  'ZZZ-', 'ZZZ', 'ZZZ+',
  'Celestial-', 'Celestial', 'Celestial+',
  'Godly-', 'Godly',
  'Primordial',
  'Primordial+', 'Absolute-', 'Absolute', 'Absolute+',
]

/**
 * Returns the gem sell value for a given TierGrade.
 * Roughly 100× the shard value, scaled to feel meaningful vs battle gem drops.
 */
export function getGemValue(tier: TierGrade): number {
  return getShardValue(tier) * 100
}

/**
 * Returns the Fate Shard sell value for a given TierGrade.
 *
 * F–D bracket  (F-, F, F+, E-, E, E+, D-, D, D+): linearly interpolated 20 → 55
 * C–B bracket  (C-, C, C+, B-, B, B+):             linearly interpolated 70 → 130
 * A–S bracket  (A-, A, A+, S-, S, S+):             linearly interpolated 160 → 320
 * SS-/SS:      500
 * SS+ and above: Math.min(2000, 500 + (stepsAboveSS) * 100)
 */
export function getShardValue(tier: TierGrade): number {
  // F–D bracket: 9 tiers, linearly from 20 (F-) to 55 (D+)
  const fdTiers: TierGrade[] = ['F-', 'F', 'F+', 'E-', 'E', 'E+', 'D-', 'D', 'D+']
  if (fdTiers.includes(tier)) {
    const idx = fdTiers.indexOf(tier)
    return 20 + Math.round((idx / (fdTiers.length - 1)) * 35)
  }

  // C–B bracket: 6 tiers, linearly from 70 (C-) to 130 (B+)
  const cbTiers: TierGrade[] = ['C-', 'C', 'C+', 'B-', 'B', 'B+']
  if (cbTiers.includes(tier)) {
    const idx = cbTiers.indexOf(tier)
    return 70 + Math.round((idx / (cbTiers.length - 1)) * 60)
  }

  // A–S bracket: 6 tiers, linearly from 160 (A-) to 320 (S+)
  const asTiers: TierGrade[] = ['A-', 'A', 'A+', 'S-', 'S', 'S+']
  if (asTiers.includes(tier)) {
    const idx = asTiers.indexOf(tier)
    return 160 + Math.round((idx / (asTiers.length - 1)) * 160)
  }

  // SS base tiers
  if (tier === 'SS-' || tier === 'SS') return 500

  // SS+ and every tier above: 500 + (stepsAboveSS) * 100, capped at 2000
  const aboveIdx = TIERS_ABOVE_SS.indexOf(tier)
  if (aboveIdx >= 0) return Math.min(2000, 500 + (aboveIdx + 1) * 100)

  // Fallback (should never be reached for a valid TierGrade)
  return 20
}
