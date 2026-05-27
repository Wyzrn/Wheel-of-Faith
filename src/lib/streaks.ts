// Streak detector. Run over the current results array to find recent
// consecutive high-tier stat rolls + emit a small banner-worthy message.
// Doesn't fire on every spin — only when a streak just CLOSED at length
// 2+, so the celebration appears once per peak.
//
// Used by both wheels via a $derived in the parent that watches results.

import type { SpinResult } from '$lib/session/types'
import { TIER_THRESHOLDS } from '$lib/game/scoreTier'

// The 28-grade tier ladder, ordered weakest → strongest.
const TIER_RANK = new Map(TIER_THRESHOLDS.map((t, i) => [t.grade, i]))

// What "high" means for streaks. Index 18 ≈ S-, anything above counts.
// Bumping the threshold means fewer false-positive streaks (every B in a
// row would be too noisy).
const HIGH_TIER_RANK = 18  // S- and above

export interface Streak {
  // Number of high-tier stat rolls in the trailing run.
  length: number
  // Lowest tier in the streak (so banner can say "3 S+ in a row" by
  // taking the floor as the label).
  floorTier: string
  // Color hint for the banner — picks from a small accent palette.
  accentColor: string
  // Banner copy.
  message: string
}

// Resolves the most recent unbroken streak of high-tier stat rolls. Walks
// backward from the end of results until a non-stat / low-tier breaks the
// chain. Returns null if length < 2 (single high rolls don't celebrate).
export function detectStreak(results: SpinResult[]): Streak | null {
  const stats: SpinResult[] = []
  // Only stat-category results have a tier; we ignore items/races/etc.
  for (const r of results) {
    if (r.tier && TIER_RANK.has(r.tier)) stats.push(r)
  }
  if (stats.length < 2) return null

  // Walk backward, count contiguous high-tier stats from the tail.
  let len = 0
  let floor: string | null = null
  for (let i = stats.length - 1; i >= 0; i--) {
    const rank = TIER_RANK.get(stats[i].tier!) ?? -1
    if (rank < HIGH_TIER_RANK) break
    len++
    const floorRank = floor ? (TIER_RANK.get(floor as never) ?? 0) : Number.POSITIVE_INFINITY
    if (rank < floorRank) {
      floor = stats[i].tier!
    }
  }
  if (len < 2 || !floor) return null

  // Banner copy + accent escalates with streak length.
  let message: string, accentColor: string
  if (len >= 5) {
    message = `🔥 ${len} ${floor}+ rolls in a row — fate adores you`
    accentColor = '#ff79c6'
  } else if (len >= 4) {
    message = `🔥 ${len} ${floor}+ in a row — this character is cooking`
    accentColor = '#f97316'
  } else if (len >= 3) {
    message = `${len} ${floor}+ in a row — heating up`
    accentColor = '#f0c040'
  } else {
    message = `Two ${floor}+ back-to-back`
    accentColor = '#48c8e0'
  }
  return { length: len, floorTier: floor, accentColor, message }
}

// Result-by-result diff: returns the streak that just FORMED on the
// latest spin. Compares the streak BEFORE and AFTER the most recent
// result. If the streak count grew (or transitioned from 0 → 2), the
// banner fires. Avoids firing the same banner repeatedly on subsequent
// non-stat spins.
export function newlyFormedStreak(
  prevResults: SpinResult[],
  nextResults: SpinResult[],
): Streak | null {
  const prev = detectStreak(prevResults)
  const next = detectStreak(nextResults)
  if (!next) return null
  // Streak length grew → it's a fresh moment.
  if (!prev || next.length > prev.length) return next
  return null
}
