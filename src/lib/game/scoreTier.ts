// scoreTier.ts — 42-grade tier mapping and overall score computation
// Single source of truth for tier grades per CLAUDE.md rule 4.
// No imports from other project files. No default export. Pure functions only.

// Stats that cannot have negative scores (health/damage archetypes)
export const NO_NEGATIVE_STATS = new Set([
  'durability', 'armorStrength', 'strength', 'fightingSkill'
])

// Extended score boundaries: spinnable range is 1–130, bonus range is -20 to 150
export const SCORE_EXTENDED_MIN = -20
export const SCORE_EXTENDED_MAX = 150

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
  | 'Z-' | 'Z' | 'Z+'
  | 'ZZ-' | 'ZZ' | 'ZZ+'
  | 'ZZZ-' | 'ZZZ' | 'ZZZ+'
  | 'Celestial-' | 'Celestial' | 'Celestial+'
  | 'Godly-' | 'Godly'
  | 'Primordial'

// 42 tiers across 1–130.
// F- through SSS+ unchanged at 1–99 from original 28-tier design.
// Z through Primordial occupy 100–130 in 2-point bands (rarer = tighter range).
export const TIER_THRESHOLDS: Array<{ min: number; max: number; grade: TierGrade }> = [
  { min:   1, max:   3, grade: 'F-'        },
  { min:   4, max:   6, grade: 'F'         },
  { min:   7, max:   9, grade: 'F+'        },
  { min:  10, max:  12, grade: 'E-'        },
  { min:  13, max:  15, grade: 'E'         },
  { min:  16, max:  18, grade: 'E+'        },
  { min:  19, max:  21, grade: 'D-'        },
  { min:  22, max:  24, grade: 'D'         },
  { min:  25, max:  27, grade: 'D+'        },
  { min:  28, max:  31, grade: 'C-'        },
  { min:  32, max:  35, grade: 'C'         },
  { min:  36, max:  39, grade: 'C+'        },
  { min:  40, max:  44, grade: 'B-'        },
  { min:  45, max:  49, grade: 'B'         },
  { min:  50, max:  54, grade: 'B+'        },
  { min:  55, max:  59, grade: 'A-'        },
  { min:  60, max:  64, grade: 'A'         },
  { min:  65, max:  69, grade: 'A+'        },
  { min:  70, max:  74, grade: 'S-'        },
  { min:  75, max:  78, grade: 'S'         },
  { min:  79, max:  82, grade: 'S+'        },
  { min:  83, max:  86, grade: 'SS-'       },
  { min:  87, max:  89, grade: 'SS'        },
  { min:  90, max:  92, grade: 'SS+'       },
  { min:  93, max:  95, grade: 'SSS-'      },
  { min:  96, max:  97, grade: 'SSS'       },
  { min:  98, max:  99, grade: 'SSS+'      },
  { min: 100, max: 101, grade: 'Z-'        },
  { min: 102, max: 103, grade: 'Z'         },
  { min: 104, max: 105, grade: 'Z+'        },
  { min: 106, max: 107, grade: 'ZZ-'       },
  { min: 108, max: 109, grade: 'ZZ'        },
  { min: 110, max: 111, grade: 'ZZ+'       },
  { min: 112, max: 113, grade: 'ZZZ-'      },
  { min: 114, max: 115, grade: 'ZZZ'       },
  { min: 116, max: 117, grade: 'ZZZ+'      },
  { min: 118, max: 119, grade: 'Celestial-'},
  { min: 120, max: 121, grade: 'Celestial' },
  { min: 122, max: 123, grade: 'Celestial+'},
  { min: 124, max: 125, grade: 'Godly-'    },
  { min: 126, max: 127, grade: 'Godly'     },
  { min: 128, max: 130, grade: 'Primordial'},
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

// Maps a numeric score to the corresponding TierGrade.
// Scores ≤ 0 (extended min −20) map to 'F-'; scores ≥ 128 (extended max 150) map to 'Primordial'.
export function scoreTier(score: number): TierGrade {
  const clamped = Math.max(1, Math.min(130, score))
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
// Returns a value in [SCORE_EXTENDED_MIN, SCORE_EXTENDED_MAX], clamped and rounded.
export function computeOverallScore(statResults: Record<string, number>): number {
  let weighted = 0
  for (const [stat, weight] of Object.entries(STAT_WEIGHTS)) {
    weighted += (statResults[stat] ?? 0) * weight
  }
  return Math.round(Math.max(SCORE_EXTENDED_MIN, Math.min(SCORE_EXTENDED_MAX, weighted)))
}
