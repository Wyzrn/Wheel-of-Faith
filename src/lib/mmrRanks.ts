// Shared MMR rank ladder. The same 10-tier scale powers:
//   • Clan MMR (clan wars — Phase 1 onward)
//   • Player MMR (ranked Rivals — Phase 4)
//
// Thresholds are LOWER bounds; >100 means "100 or above" per the spec.
// Each tier carries a display color and an icon glyph that the Ranks tab on
// both the Clan and Rivals pages renders. The server has a mirrored copy in
// server/src/lib/mmrRanks.ts so MMR delta math doesn't have to cross the
// boundary just to label a rank.

export interface MmrRank {
  id: string                 // stable id for storage
  label: string              // display label
  threshold: number          // minimum MMR to be in this tier
  color: string              // hex tint for badges + chips
  icon: string               // single-emoji glyph used in the rank pill
}

export const MMR_RANKS: MmrRank[] = [
  { id: 'copper',   label: 'Copper',    threshold: 100,  color: '#a16f4f', icon: '🥉' },
  { id: 'steel',    label: 'Steel',     threshold: 200,  color: '#7c8a9a', icon: '⚙' },
  { id: 'gold',     label: 'Gold',      threshold: 300,  color: '#f0c040', icon: '🥇' },
  { id: 'ruby',     label: 'Ruby',      threshold: 400,  color: '#e11d48', icon: '🔻' },
  { id: 'diamond',  label: 'Diamond',   threshold: 500,  color: '#7dd3fc', icon: '💎' },
  { id: 'emerald',  label: 'Emerald',   threshold: 600,  color: '#34d399', icon: '🟢' },
  { id: 'sapphire', label: 'Sapphire',  threshold: 700,  color: '#3b82f6', icon: '🔷' },
  { id: 'hero',     label: 'Hero',      threshold: 800,  color: '#a78bfa', icon: '🦸' },
  { id: 'legend',   label: 'Legend',    threshold: 900,  color: '#f9a8d4', icon: '⭐' },
  { id: 'paragon',  label: 'Paragon',   threshold: 1000, color: '#fde68a', icon: '👑' },
]

/** Returns the rank for a given MMR. Below the Copper threshold (100) the
 *  player/clan is "Unranked" — represented by the first tier with a 0
 *  display threshold so the UI still has something to render. */
export const UNRANKED: MmrRank = {
  id: 'unranked', label: 'Unranked', threshold: 0, color: '#6b7280', icon: '·',
}

export function mmrRankFor(mmr: number): MmrRank {
  if (mmr < MMR_RANKS[0].threshold) return UNRANKED
  // Walk from highest down; first tier whose threshold is ≤ mmr wins.
  for (let i = MMR_RANKS.length - 1; i >= 0; i--) {
    if (mmr >= MMR_RANKS[i].threshold) return MMR_RANKS[i]
  }
  return UNRANKED
}

/** Progress toward the next rank, 0..1. Returns 1 when player is at the
 *  top of the ladder (Paragon has no ceiling). */
export function mmrProgressToNext(mmr: number): { current: MmrRank; next: MmrRank | null; progress: number } {
  const current = mmrRankFor(mmr)
  if (current.id === 'paragon') return { current, next: null, progress: 1 }
  // Find the next tier in MMR_RANKS strictly above current.threshold.
  const nextIdx = current.id === 'unranked' ? 0 : MMR_RANKS.findIndex(r => r.id === current.id) + 1
  const next = MMR_RANKS[nextIdx] ?? null
  if (!next) return { current, next: null, progress: 1 }
  const floor = current.id === 'unranked' ? 0 : current.threshold
  const span = next.threshold - floor
  const progress = span > 0 ? Math.min(1, Math.max(0, (mmr - floor) / span)) : 0
  return { current, next, progress }
}
