// Power Rating — single number summarising "how strong is this character?"
// Combines the overall score (which is a weighted blend of all 11 stats) with
// the grade quality of equipped weapons/armor/powers. Used in the roster card
// view and the rivals pre-battle preview so players can compare characters at
// a glance without staring at 12 individual stat tiers.
//
// Range: roughly 0 → 2000 in normal play, with Absolute-tier + max-gear
// approaching 3000+. Display formatted with commas and a "PWR" badge.

import type { StoryRosterEntry, EquippedItem } from './types'
import type { ItemGrade } from '$lib/content/types'
import { ITEM_GRADE_INFO } from '$lib/content/elements'

// Each gear grade contributes its battleBonus value (0–100) per item.
// 25% multiplier matches the in-battle stacking from buildBattleCharacter.
function gearContribution(items: EquippedItem[] | undefined): number {
  if (!items?.length) return 0
  return items.reduce((sum, it) => {
    const info = ITEM_GRADE_INFO[it.grade as ItemGrade]
    return sum + (info?.battleBonus ?? 0) * 0.25
  }, 0)
}

// Level contribution — flat per-level bump so a level-30 character with the
// same base stats outranks a level-1 character with identical roll.
const LEVEL_BONUS_PER = 8

export interface PowerBreakdown {
  base: number
  gear: number
  level: number
  total: number
}

export function powerRating(entry: StoryRosterEntry): number {
  return powerBreakdown(entry).total
}

export function powerBreakdown(entry: StoryRosterEntry): PowerBreakdown {
  // overallScore is 0–170-ish; multiply by 10 to get a meaty headline number.
  const base = Math.round((entry.overallScore ?? 0) * 10)
  const gear = Math.round(
    gearContribution(entry.equippedWeapons) +
    gearContribution(entry.equippedArmors) +
    gearContribution(entry.equippedPowers),
  )
  const level = Math.round(((entry.level ?? 1) - 1) * LEVEL_BONUS_PER)
  return { base, gear, level, total: base + gear + level }
}

// Format a power rating with thousands separators.
export function formatPower(n: number): string {
  return Math.round(n).toLocaleString()
}
