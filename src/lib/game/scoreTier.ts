// scoreTier.ts — 42-grade tier mapping and overall score computation
// Single source of truth for tier grades per CLAUDE.md rule 4.
// No imports from other project files. No default export. Pure functions only.

// Stats that cannot have negative scores (health/damage archetypes)
export const NO_NEGATIVE_STATS = new Set([
  'durability', 'armorStrength', 'strength', 'fightingSkill'
])

// Extended score boundaries: spinnable range is 1–130, bonus range is -20 to 150
export const SCORE_EXTENDED_MIN = -20
export const SCORE_EXTENDED_MAX = 170

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
  | 'Primordial+' | 'Absolute-' | 'Absolute' | 'Absolute+'

// 46 tiers across 1–150.
// F- through SSS+ unchanged at 1–99 from original 28-tier design.
// Z through Primordial occupy 100–130 in 2-point bands (rarer = tighter range).
// Primordial+ through Absolute+ occupy 131–150 — only reachable via wildcards / redemption.
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
  { min: 128, max: 130, grade: 'Primordial'  },
  { min: 131, max: 134, grade: 'Primordial+' },
  { min: 135, max: 140, grade: 'Absolute-'   },
  { min: 141, max: 146, grade: 'Absolute'    },
  { min: 147, max: 150, grade: 'Absolute+'   },
]

// Category weights for overall score aggregation (sum = 1.00).
// Weighted by combat decisiveness: raw damage + survival + technique dominate.
// Charisma and Potential barely affect the outcome of an actual fight.
export const STAT_WEIGHTS: Record<string, number> = {
  fightingSkill: 0.16,  // combat technique — highest impact on fight outcome
  strength:      0.13,  // raw damage output
  durability:    0.13,  // how long you survive
  speed:         0.11,  // first strike, evasion
  powerMastery:  0.11,  // how effectively you weaponize your abilities
  agility:       0.09,  // positioning and dodge
  energyLevel:   0.09,  // sustain across a long fight
  iq:            0.07,  // tactical thinking
  weaponMastery: 0.06,  // situational weapon usage
  potential:     0.03,  // future growth — irrelevant mid-fight
  charisma:      0.02,  // rarely decides a fight
}

// Maps a numeric score to the corresponding TierGrade.
// Scores ≤ 0 map to 'F-'; scores ≥ 147 map to 'Absolute+'.
export function scoreTier(score: number): TierGrade {
  const clamped = Math.max(1, Math.min(150, score))
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

// Like scoreTier but handles scores above 150 by returning "Absolute+N" strings.
// N = score − 150, capped at 20. Used by battle.ts for damage/HP tier derivation.
export function extendedTierFromScore(score: number): string {
  if (score <= 150) return scoreTier(score)
  return `Absolute+${Math.min(20, score - 150)}`
}

// Advances a score by N tier levels and returns the new grade + score (at band minimum).
// Used by stat crystal boosts: common=+1 tier, elite=+3 tiers, legendary=+5 tiers.
export function boostedTier(score: number, tierLevels: number): { grade: TierGrade; score: number } {
  const clamped = Math.max(1, Math.min(150, score))
  const currentIdx = TIER_THRESHOLDS.findIndex(t => clamped >= t.min && clamped <= t.max)
  const fromIdx = Math.max(0, currentIdx)
  const newIdx = Math.min(TIER_THRESHOLDS.length - 1, fromIdx + tierLevels)
  const band = TIER_THRESHOLDS[newIdx]
  return { grade: band.grade, score: band.min }
}

// Converts legacy "Primordial+N" display labels to "Absolute+N".
// Old characters stored these before Absolute tiers were added; the N maps 1:1.
export function normalizeLegacyDisplayLabel(label: string | undefined): string | undefined {
  if (!label) return label
  const m = /^Primordial\+(\d+)$/.exec(label)
  return m ? `Absolute+${m[1]}` : label
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
