// Shared visual helpers used across every battle view (story, rivals quick,
// rivals team, endless, legacy). Centralising the HP-bar color ramp and a few
// other tunables means polish changes land everywhere at once.

export function hpColor(pct: number): string {
  if (pct > 0.50) return '#22c55e'   // green — healthy
  if (pct > 0.25) return '#eab308'   // amber — wounded
  return '#ef4444'                   // red — critical
}

// Smooth easing helper for HP bar transitions. Returns a CSS transition string
// callers can drop into a style attribute so the timing matches everywhere.
export const HP_TRANSITION = 'width 0.8s cubic-bezier(0.22, 0.8, 0.3, 1), background 0.5s'

// Team accent colors — pulled out so every battle view uses the same scheme.
// team1 = your side (blue-cyan), team2 = opponent (pink-magenta).
export const TEAM1_ACCENT = '#7dd3fc'
export const TEAM2_ACCENT = '#f9a8d4'
export const NEUTRAL_GOLD = '#f0c040'

// Format an HP value compactly. Match the existing formatHp in battle.ts so
// numbers look identical regardless of which view rendered them.
export function formatHpCompact(hp: number): string {
  if (hp >= 1_000_000) {
    const m = hp / 1_000_000
    return (m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)) + 'M'
  }
  if (hp >= 10_000) return Math.round(hp / 1_000) + 'K'
  return Math.max(0, hp).toString()
}
