// scoreTier.ts — 60-grade tier mapping and overall score computation
// Single source of truth for tier grades per CLAUDE.md rule 4.
// No imports from other project files. No default export. Pure functions only.

// Stats that cannot have negative scores (health/damage archetypes)
export const NO_NEGATIVE_STATS = new Set([
  'durability', 'armorStrength', 'strength', 'fightingSkill'
])

// Extended score boundaries: spinnable range is 1–130 from raw wheels.
// Crystal boosts, race/archetype modifiers, and Infinite+N overflow can push
// scores up to 185 (Infinite+ + 20 overflow steps).
export const SCORE_EXTENDED_MIN = -20
export const SCORE_EXTENDED_MAX = 185

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
  | 'Cosmic-' | 'Cosmic' | 'Cosmic+'
  | 'Immortal-' | 'Immortal' | 'Immortal+'
  | 'Celestial-' | 'Celestial' | 'Celestial+'
  | 'Godly-' | 'Godly' | 'Godly+'
  | 'Primordial-' | 'Primordial' | 'Primordial+'
  | 'Absolute-' | 'Absolute' | 'Absolute+'
  | 'Transcendent-' | 'Transcendent' | 'Transcendent+'
  | 'Infinite-' | 'Infinite' | 'Infinite+'

// 60 tiers across 1–165.
// F- through SSS+ unchanged at 1–99 from the original 28-tier design.
// Z- through ZZZ+ occupy 100–117 in 2-point bands (unchanged).
// Cosmic- through Infinite+ occupy 118–165 in 2-point bands — each tier group
// gets three subdivisions (-, none, +). Beyond 165, extendedTierFromScore
// produces "Infinite+N" overflow labels (capped N=20 at score 185).
export const TIER_THRESHOLDS: Array<{ min: number; max: number; grade: TierGrade }> = [
  { min:   1, max:   3, grade: 'F-'           },
  { min:   4, max:   6, grade: 'F'            },
  { min:   7, max:   9, grade: 'F+'           },
  { min:  10, max:  12, grade: 'E-'           },
  { min:  13, max:  15, grade: 'E'            },
  { min:  16, max:  18, grade: 'E+'           },
  { min:  19, max:  21, grade: 'D-'           },
  { min:  22, max:  24, grade: 'D'            },
  { min:  25, max:  27, grade: 'D+'           },
  { min:  28, max:  31, grade: 'C-'           },
  { min:  32, max:  35, grade: 'C'            },
  { min:  36, max:  39, grade: 'C+'           },
  { min:  40, max:  44, grade: 'B-'           },
  { min:  45, max:  49, grade: 'B'            },
  { min:  50, max:  54, grade: 'B+'           },
  { min:  55, max:  59, grade: 'A-'           },
  { min:  60, max:  64, grade: 'A'            },
  { min:  65, max:  69, grade: 'A+'           },
  { min:  70, max:  74, grade: 'S-'           },
  { min:  75, max:  78, grade: 'S'            },
  { min:  79, max:  82, grade: 'S+'           },
  { min:  83, max:  86, grade: 'SS-'          },
  { min:  87, max:  89, grade: 'SS'           },
  { min:  90, max:  92, grade: 'SS+'          },
  { min:  93, max:  95, grade: 'SSS-'         },
  { min:  96, max:  97, grade: 'SSS'          },
  { min:  98, max:  99, grade: 'SSS+'         },
  { min: 100, max: 101, grade: 'Z-'           },
  { min: 102, max: 103, grade: 'Z'            },
  { min: 104, max: 105, grade: 'Z+'           },
  { min: 106, max: 107, grade: 'ZZ-'          },
  { min: 108, max: 109, grade: 'ZZ'           },
  { min: 110, max: 111, grade: 'ZZ+'          },
  { min: 112, max: 113, grade: 'ZZZ-'         },
  { min: 114, max: 115, grade: 'ZZZ'          },
  { min: 116, max: 117, grade: 'ZZZ+'         },
  { min: 118, max: 119, grade: 'Cosmic-'      },
  { min: 120, max: 121, grade: 'Cosmic'       },
  { min: 122, max: 123, grade: 'Cosmic+'      },
  { min: 124, max: 125, grade: 'Immortal-'    },
  { min: 126, max: 127, grade: 'Immortal'     },
  { min: 128, max: 129, grade: 'Immortal+'    },
  { min: 130, max: 131, grade: 'Celestial-'   },
  { min: 132, max: 133, grade: 'Celestial'    },
  { min: 134, max: 135, grade: 'Celestial+'   },
  { min: 136, max: 137, grade: 'Godly-'       },
  { min: 138, max: 139, grade: 'Godly'        },
  { min: 140, max: 141, grade: 'Godly+'       },
  { min: 142, max: 143, grade: 'Primordial-'  },
  { min: 144, max: 145, grade: 'Primordial'   },
  { min: 146, max: 147, grade: 'Primordial+'  },
  { min: 148, max: 149, grade: 'Absolute-'    },
  { min: 150, max: 151, grade: 'Absolute'     },
  { min: 152, max: 153, grade: 'Absolute+'    },
  { min: 154, max: 155, grade: 'Transcendent-'},
  { min: 156, max: 157, grade: 'Transcendent' },
  { min: 158, max: 159, grade: 'Transcendent+'},
  { min: 160, max: 161, grade: 'Infinite-'    },
  { min: 162, max: 163, grade: 'Infinite'     },
  { min: 164, max: 165, grade: 'Infinite+'    },
]

// Max score covered by named tier grades. Anything above becomes Infinite+N.
const TIER_MAX_SCORE = 165
// Overflow cap — N in "Infinite+N" maxes out at 20 (matches old Absolute+N behavior).
const OVERFLOW_CAP = 20

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
// Scores ≤ 0 map to 'F-'; scores ≥ TIER_MAX_SCORE map to 'Infinite+'.
export function scoreTier(score: number): TierGrade {
  const clamped = Math.max(1, Math.min(TIER_MAX_SCORE, score))
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

// Like scoreTier but handles scores above TIER_MAX_SCORE by returning "Infinite+N" strings.
// N = score − TIER_MAX_SCORE, capped at OVERFLOW_CAP. Used by battle.ts for damage/HP tier derivation.
export function extendedTierFromScore(score: number): string {
  if (score <= TIER_MAX_SCORE) return scoreTier(score)
  return `Infinite+${Math.min(OVERFLOW_CAP, score - TIER_MAX_SCORE)}`
}

// Advances a score by N tier levels and returns the new grade + score (at band minimum).
// Used by stat crystal boosts: common=+1 tier, elite=+3 tiers, legendary=+5 tiers.
export function boostedTier(score: number, tierLevels: number): { grade: TierGrade; score: number } {
  const clamped = Math.max(1, Math.min(TIER_MAX_SCORE, score))
  const currentIdx = TIER_THRESHOLDS.findIndex(t => clamped >= t.min && clamped <= t.max)
  const fromIdx = Math.max(0, currentIdx)
  const newIdx = Math.min(TIER_THRESHOLDS.length - 1, fromIdx + tierLevels)
  const band = TIER_THRESHOLDS[newIdx]
  return { grade: band.grade, score: band.min }
}

// Re-labels persisted display strings from earlier tier ladders onto the current one.
//   • Primordial+N  → Absolute+N    (very old saves, before the Absolute tiers existed)
//   • Absolute+N    → linear-remap into the post-Absolute ladder. N=1 → Transcendent-,
//                     N=2 → Transcendent, N=3 → Transcendent+, N=4 → Infinite-, N=5 →
//                     Infinite, N=6 → Infinite+, N=7..20 → "Infinite+1".."Infinite+14".
// Returns the input unchanged if no rule matches.
const ABSOLUTE_REMAP: Record<number, string> = {
  1: 'Transcendent-', 2: 'Transcendent', 3: 'Transcendent+',
  4: 'Infinite-',     5: 'Infinite',     6: 'Infinite+',
}
export function normalizeLegacyDisplayLabel(label: string | undefined): string | undefined {
  if (!label) return label
  const m1 = /^Primordial\+(\d+)$/.exec(label)
  if (m1) {
    const n = parseInt(m1[1], 10)
    // Cascade: first turn it into Absolute+N, then through the Absolute remap.
    return remapAbsolutePlus(n)
  }
  const m2 = /^Absolute\+(\d+)$/.exec(label)
  if (m2) return remapAbsolutePlus(parseInt(m2[1], 10))
  return label
}
function remapAbsolutePlus(n: number): string {
  if (n <= 0) return 'Absolute+'
  if (n <= 6) return ABSOLUTE_REMAP[n]
  return `Infinite+${Math.min(OVERFLOW_CAP, n - 6)}`
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
