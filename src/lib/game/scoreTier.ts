// scoreTier.ts — 28-grade tier mapping and overall score computation
// Single source of truth for tier grades per CLAUDE.md rule 4.
// No imports from other project files. No default export. Pure functions only.

export type TierGrade =
  | 'F-' | 'F' | 'F+'
  | 'E-' | 'E' | 'E+'
  | 'D-' | 'D' | 'D+'
  | 'C-' | 'C' | 'C+'
  | 'B-' | 'B' | 'B+'
  | 'A-' | 'A' | 'A+'
  | 'S-' | 'S' | 'S+'
  | 'SS-' | 'SS' | 'SS+'
  | 'SSS-' | 'SSS' | 'SSS+'
  | 'God'

// 28 tiers across 1–100. Ranges from RESEARCH.md Pattern 3.
// F- through F+ occupy 1–9 (3 per grade)
// E- through E+ occupy 10–18 (3 per grade)
// D- through D+ occupy 19–27 (3 per grade)
// C- through C+ are wider (28–39): common range
// B- through B+ are wider (40–54): modal outcome for balanced character
// A- through A+ compress slightly (55–69)
// S tiers (70–82), SS tiers (83–92), SSS tiers (93–99) compress as rarity increases
// God is exactly 100 — single point
export const TIER_THRESHOLDS: Array<{ min: number; max: number; grade: TierGrade }> = [
  { min:   1, max:   3, grade: 'F-'   },
  { min:   4, max:   6, grade: 'F'    },
  { min:   7, max:   9, grade: 'F+'   },
  { min:  10, max:  12, grade: 'E-'   },
  { min:  13, max:  15, grade: 'E'    },
  { min:  16, max:  18, grade: 'E+'   },
  { min:  19, max:  21, grade: 'D-'   },
  { min:  22, max:  24, grade: 'D'    },
  { min:  25, max:  27, grade: 'D+'   },
  { min:  28, max:  31, grade: 'C-'   },
  { min:  32, max:  35, grade: 'C'    },
  { min:  36, max:  39, grade: 'C+'   },
  { min:  40, max:  44, grade: 'B-'   },
  { min:  45, max:  49, grade: 'B'    },
  { min:  50, max:  54, grade: 'B+'   },
  { min:  55, max:  59, grade: 'A-'   },
  { min:  60, max:  64, grade: 'A'    },
  { min:  65, max:  69, grade: 'A+'   },
  { min:  70, max:  74, grade: 'S-'   },
  { min:  75, max:  78, grade: 'S'    },
  { min:  79, max:  82, grade: 'S+'   },
  { min:  83, max:  86, grade: 'SS-'  },
  { min:  87, max:  89, grade: 'SS'   },
  { min:  90, max:  92, grade: 'SS+'  },
  { min:  93, max:  95, grade: 'SSS-' },
  { min:  96, max:  97, grade: 'SSS'  },
  { min:  98, max:  99, grade: 'SSS+' },
  { min: 100, max: 100, grade: 'God'  },
]

// Category weights for overall score aggregation (sum = 1.00).
// From RESEARCH.md Pattern 9. Combat-central stats (fightingSkill) weight highest.
export const STAT_WEIGHTS: Record<string, number> = {
  strength:      0.10,
  speed:         0.10,
  agility:       0.10,
  durability:    0.10,
  iq:            0.08,
  charisma:      0.07,
  fightingSkill: 0.12,
  potential:     0.10,
  energyLevel:   0.08,
  powerMastery:  0.08,
  weaponMastery: 0.07,
}

// Maps a numeric score [1–100] to the corresponding TierGrade.
// Clamped to [1, 100] before lookup. Falls back to 'F-' (unreachable safety valve).
export function scoreTier(score: number): TierGrade {
  const clamped = Math.max(1, Math.min(100, score))
  for (const t of TIER_THRESHOLDS) {
    if (clamped >= t.min && clamped <= t.max) return t.grade
  }
  return 'F-'
}

// Returns the canonical numeric score for a given TierGrade (midpoint of its range).
// Used when authoring FlavorLabel entries — author specifies grade, gets canonical score.
export function gradeToScore(grade: TierGrade): number {
  const entry = TIER_THRESHOLDS.find(t => t.grade === grade)
  if (!entry) return 1
  return Math.round((entry.min + entry.max) / 2)
}

// Computes the overall character score as a weighted average of stat scores.
// Non-stat spins (Race, Archetype, Powers, Weapons) are excluded from this computation.
// Returns a value in [1, 100], clamped and rounded.
export function computeOverallScore(statResults: Record<string, number>): number {
  let weighted = 0
  for (const [stat, weight] of Object.entries(STAT_WEIGHTS)) {
    weighted += (statResults[stat] ?? 0) * weight
  }
  return Math.round(Math.max(1, Math.min(100, weighted)))
}
