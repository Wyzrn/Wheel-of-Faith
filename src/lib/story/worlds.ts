// Story Mode worlds system.
// 20 worlds (F → Infinite), 20 battles each. All enemies match world grade; type multipliers handle difficulty.
// Player level (1–8) is unlocked by beating specific worlds.
//
// Cosmic + Immortal are inserted between ZZZ and Celestial; Transcendent +
// Infinite extend the ladder past Absolute. Matches the post-mortal tier
// reshuffle in scoreTier.ts (Segment 1).

export type WorldGrade =
  | 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S' | 'SS' | 'SSS'
  | 'Z' | 'ZZ' | 'ZZZ'
  | 'Cosmic' | 'Immortal'
  | 'Celestial' | 'Godly' | 'Primordial' | 'Absolute'
  | 'Transcendent' | 'Infinite'

export const WORLD_GRADES: readonly WorldGrade[] = [
  'F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS',
  'Z', 'ZZ', 'ZZZ',
  'Cosmic', 'Immortal',
  'Celestial', 'Godly', 'Primordial', 'Absolute',
  'Transcendent', 'Infinite',
] as const

export const BATTLES_PER_WORLD = 20

/** Maximum number of Absolute+ difficulty tiers available beyond the base Absolute world. */
export const MAX_ABSOLUTE_PLUS = 20

// Enemy taxonomy. Each type has a distinct combat identity that the
// BattleView + EndlessView readers translate into stat / move / gimmick
// differences when building the BattleCharacter. New types unlock per
// world bracket — see BATTLE_SPECS_BY_BRACKET below.
//
//  normal       — baseline humanoid grunt (1× HP, 1× damage)
//  elite        — beefier mid-tier (1.5× HP, 1.3× damage)
//  boss         — battle finale (2.5× HP, 1.6× damage)
//  phaseShifter — fast, dodgy, low HP (0.65× HP, 55% dodge)
//  shielder     — heavy armor, low damage, slow (1.7× HP, 0.7× dmg, 0.55 armor)
//  leech        — heals from damage dealt (1.2× HP, lifesteal gimmick)
//  cursed       — applies status on every hit (poison/burn/wither)
//  bomber       — explodes on death for damage = current HP (0.6× HP, fast)
//  cloner       — on death spawns 3 mini-clones at 10% stats (1.0× HP)
//  reflector    — reflects 35% damage taken back to attacker
//  berserker    — +60% damage but takes +30% damage (glass-cannon variant)
export type EnemyType =
  | 'normal' | 'elite' | 'boss'
  | 'phaseShifter' | 'shielder' | 'leech'
  | 'cursed' | 'bomber' | 'cloner'
  | 'reflector' | 'berserker'

/** A group of enemies of one type within a wave. */
export interface WaveEnemySpec { type: EnemyType; count: number }
/** One battle = array of waves, each wave = array of enemy groups. */
export type BattleSpec = WaveEnemySpec[][]

// ─── World brackets ──────────────────────────────────────────────────────
// Worlds group into 5 difficulty brackets. Each bracket has its own
// 20-battle progression that introduces the bracket's signature enemy
// types. Higher brackets layer in the more mechanically dangerous types.

/** F → D worlds: only normal / elite / boss. Pure intro progression. */
const SPEC_BRACKET_INTRO: BattleSpec[] = [
  [[{ type: 'normal', count: 1 }]],
  [[{ type: 'normal', count: 1 }]],
  [[{ type: 'normal', count: 2 }]],
  [[{ type: 'normal', count: 2 }]],
  [[{ type: 'elite', count: 1 }]],
  [[{ type: 'normal', count: 2 }], [{ type: 'normal', count: 2 }]],
  [[{ type: 'normal', count: 2 }], [{ type: 'normal', count: 3 }]],
  [[{ type: 'normal', count: 3 }], [{ type: 'normal', count: 3 }]],
  [[{ type: 'normal', count: 3 }], [{ type: 'normal', count: 2 }, { type: 'elite', count: 1 }]],
  [[{ type: 'normal', count: 3 }], [{ type: 'normal', count: 3 }], [{ type: 'normal', count: 2 }, { type: 'elite', count: 1 }]],
  [[{ type: 'normal', count: 3 }], [{ type: 'normal', count: 3 }], [{ type: 'normal', count: 3 }]],
  [[{ type: 'normal', count: 3 }], [{ type: 'normal', count: 3 }], [{ type: 'normal', count: 3 }]],
  [[{ type: 'normal', count: 2 }, { type: 'elite', count: 1 }], [{ type: 'normal', count: 3 }], [{ type: 'normal', count: 4 }]],
  [[{ type: 'elite', count: 2 }], [{ type: 'elite', count: 2 }], [{ type: 'normal', count: 4 }]],
  [[{ type: 'elite', count: 1 }], [{ type: 'elite', count: 2 }], [{ type: 'elite', count: 3 }]],
  [[{ type: 'normal', count: 5 }], [{ type: 'normal', count: 5 }], [{ type: 'elite', count: 1 }]],
  [[{ type: 'normal', count: 3 }], [{ type: 'elite', count: 3 }], [{ type: 'normal', count: 5 }]],
  [[{ type: 'normal', count: 5 }], [{ type: 'normal', count: 5 }], [{ type: 'elite', count: 2 }]],
  [[{ type: 'normal', count: 5 }], [{ type: 'elite', count: 3 }], [{ type: 'elite', count: 3 }]],
  [[{ type: 'elite', count: 3 }], [{ type: 'elite', count: 3 }], [{ type: 'boss', count: 1 }]],
]

/** C → A worlds: introduces phaseShifter (dodgy) + shielder (tanks). */
const SPEC_BRACKET_RISING: BattleSpec[] = [
  [[{ type: 'normal', count: 2 }]],
  [[{ type: 'phaseShifter', count: 1 }]],
  [[{ type: 'normal', count: 2 }, { type: 'phaseShifter', count: 1 }]],
  [[{ type: 'shielder', count: 1 }]],
  [[{ type: 'normal', count: 2 }], [{ type: 'phaseShifter', count: 2 }]],
  [[{ type: 'normal', count: 3 }], [{ type: 'shielder', count: 1 }]],
  [[{ type: 'elite', count: 1 }, { type: 'phaseShifter', count: 1 }]],
  [[{ type: 'normal', count: 3 }], [{ type: 'shielder', count: 1 }, { type: 'phaseShifter', count: 1 }]],
  [[{ type: 'phaseShifter', count: 3 }]],
  [[{ type: 'normal', count: 2 }, { type: 'shielder', count: 1 }], [{ type: 'phaseShifter', count: 2 }, { type: 'elite', count: 1 }]],
  [[{ type: 'shielder', count: 2 }], [{ type: 'phaseShifter', count: 2 }]],
  [[{ type: 'normal', count: 3 }, { type: 'phaseShifter', count: 1 }], [{ type: 'elite', count: 2 }]],
  [[{ type: 'shielder', count: 1 }, { type: 'phaseShifter', count: 2 }], [{ type: 'normal', count: 4 }]],
  [[{ type: 'elite', count: 2 }], [{ type: 'shielder', count: 2 }, { type: 'phaseShifter', count: 1 }]],
  [[{ type: 'shielder', count: 3 }]],
  [[{ type: 'phaseShifter', count: 4 }]],
  [[{ type: 'elite', count: 2 }, { type: 'phaseShifter', count: 2 }], [{ type: 'shielder', count: 2 }]],
  [[{ type: 'normal', count: 4 }], [{ type: 'shielder', count: 2 }, { type: 'phaseShifter', count: 2 }]],
  [[{ type: 'elite', count: 3 }], [{ type: 'shielder', count: 2 }], [{ type: 'phaseShifter', count: 3 }]],
  [[{ type: 'elite', count: 2 }, { type: 'shielder', count: 1 }], [{ type: 'phaseShifter', count: 3 }], [{ type: 'boss', count: 1 }]],
]

/** S → SSS worlds: introduces leech (heals from damage) + cursed (status on hit). */
const SPEC_BRACKET_ELITE: BattleSpec[] = [
  [[{ type: 'leech', count: 1 }]],
  [[{ type: 'cursed', count: 1 }]],
  [[{ type: 'leech', count: 1 }, { type: 'normal', count: 2 }]],
  [[{ type: 'cursed', count: 2 }]],
  [[{ type: 'phaseShifter', count: 2 }, { type: 'leech', count: 1 }]],
  [[{ type: 'shielder', count: 1 }, { type: 'cursed', count: 1 }]],
  [[{ type: 'leech', count: 2 }], [{ type: 'cursed', count: 2 }]],
  [[{ type: 'elite', count: 2 }], [{ type: 'leech', count: 2 }]],
  [[{ type: 'cursed', count: 3 }]],
  [[{ type: 'shielder', count: 2 }, { type: 'leech', count: 1 }], [{ type: 'cursed', count: 2 }]],
  [[{ type: 'phaseShifter', count: 2 }, { type: 'cursed', count: 1 }], [{ type: 'elite', count: 2 }]],
  [[{ type: 'leech', count: 3 }], [{ type: 'shielder', count: 2 }]],
  [[{ type: 'cursed', count: 2 }, { type: 'phaseShifter', count: 2 }], [{ type: 'leech', count: 2 }]],
  [[{ type: 'shielder', count: 3 }], [{ type: 'leech', count: 2 }, { type: 'cursed', count: 1 }]],
  [[{ type: 'elite', count: 3 }, { type: 'cursed', count: 1 }]],
  [[{ type: 'cursed', count: 4 }]],
  [[{ type: 'leech', count: 2 }, { type: 'cursed', count: 2 }], [{ type: 'phaseShifter', count: 3 }]],
  [[{ type: 'shielder', count: 2 }, { type: 'leech', count: 2 }], [{ type: 'cursed', count: 2 }, { type: 'phaseShifter', count: 1 }]],
  [[{ type: 'elite', count: 2 }, { type: 'leech', count: 2 }], [{ type: 'cursed', count: 3 }], [{ type: 'shielder', count: 3 }]],
  [[{ type: 'leech', count: 3 }, { type: 'cursed', count: 2 }], [{ type: 'shielder', count: 2 }, { type: 'phaseShifter', count: 2 }], [{ type: 'boss', count: 1 }]],
]

/** Z → ZZZ worlds: introduces bomber (explodes on death) + reflector (returns damage). */
const SPEC_BRACKET_APEX: BattleSpec[] = [
  [[{ type: 'bomber', count: 1 }]],
  [[{ type: 'reflector', count: 1 }]],
  [[{ type: 'bomber', count: 2 }]],
  [[{ type: 'reflector', count: 1 }, { type: 'cursed', count: 1 }]],
  [[{ type: 'bomber', count: 1 }, { type: 'leech', count: 1 }]],
  [[{ type: 'reflector', count: 2 }, { type: 'shielder', count: 1 }]],
  [[{ type: 'bomber', count: 2 }, { type: 'phaseShifter', count: 2 }]],
  [[{ type: 'reflector', count: 2 }], [{ type: 'cursed', count: 2 }]],
  [[{ type: 'bomber', count: 3 }], [{ type: 'leech', count: 2 }]],
  [[{ type: 'reflector', count: 2 }, { type: 'bomber', count: 1 }], [{ type: 'shielder', count: 2 }]],
  [[{ type: 'bomber', count: 2 }, { type: 'reflector', count: 1 }], [{ type: 'cursed', count: 2 }, { type: 'phaseShifter', count: 2 }]],
  [[{ type: 'leech', count: 3 }, { type: 'reflector', count: 1 }], [{ type: 'bomber', count: 2 }]],
  [[{ type: 'reflector', count: 3 }], [{ type: 'bomber', count: 3 }]],
  [[{ type: 'shielder', count: 2 }, { type: 'reflector', count: 2 }], [{ type: 'bomber', count: 2 }, { type: 'cursed', count: 1 }]],
  [[{ type: 'bomber', count: 4 }]],
  [[{ type: 'reflector', count: 3 }, { type: 'leech', count: 2 }]],
  [[{ type: 'elite', count: 3 }, { type: 'reflector', count: 1 }], [{ type: 'bomber', count: 3 }]],
  [[{ type: 'shielder', count: 3 }, { type: 'cursed', count: 2 }], [{ type: 'reflector', count: 3 }]],
  [[{ type: 'bomber', count: 3 }, { type: 'reflector', count: 2 }], [{ type: 'cursed', count: 3 }], [{ type: 'leech', count: 3 }]],
  [[{ type: 'reflector', count: 3 }, { type: 'shielder', count: 2 }], [{ type: 'bomber', count: 4 }], [{ type: 'boss', count: 1 }]],
]

/** Cosmic → Infinite worlds: introduces cloner (multiplies on death) + berserker.
 *  Maximum chaos — every existing type can show up alongside cloners and berserkers. */
const SPEC_BRACKET_COSMIC: BattleSpec[] = [
  [[{ type: 'cloner', count: 1 }]],
  [[{ type: 'berserker', count: 2 }]],
  [[{ type: 'cloner', count: 1 }, { type: 'bomber', count: 1 }]],
  [[{ type: 'berserker', count: 2 }, { type: 'leech', count: 1 }]],
  [[{ type: 'cloner', count: 2 }]],
  [[{ type: 'berserker', count: 3 }, { type: 'reflector', count: 1 }]],
  [[{ type: 'cloner', count: 1 }, { type: 'cursed', count: 2 }, { type: 'bomber', count: 1 }]],
  [[{ type: 'berserker', count: 2 }, { type: 'shielder', count: 2 }], [{ type: 'cloner', count: 1 }]],
  [[{ type: 'cloner', count: 2 }, { type: 'bomber', count: 2 }]],
  [[{ type: 'berserker', count: 3 }], [{ type: 'cloner', count: 1 }, { type: 'reflector', count: 2 }]],
  [[{ type: 'cloner', count: 2 }, { type: 'leech', count: 2 }], [{ type: 'berserker', count: 3 }]],
  [[{ type: 'bomber', count: 3 }, { type: 'cloner', count: 1 }], [{ type: 'berserker', count: 2 }, { type: 'shielder', count: 2 }]],
  [[{ type: 'cloner', count: 3 }]],
  [[{ type: 'berserker', count: 4 }, { type: 'reflector', count: 2 }]],
  [[{ type: 'cloner', count: 2 }, { type: 'cursed', count: 3 }, { type: 'leech', count: 2 }]],
  [[{ type: 'berserker', count: 3 }, { type: 'shielder', count: 2 }], [{ type: 'cloner', count: 2 }, { type: 'bomber', count: 2 }]],
  [[{ type: 'cloner', count: 2 }, { type: 'reflector', count: 2 }], [{ type: 'berserker', count: 3 }, { type: 'cursed', count: 2 }]],
  [[{ type: 'elite', count: 3 }, { type: 'cloner', count: 1 }], [{ type: 'berserker', count: 3 }, { type: 'leech', count: 2 }], [{ type: 'shielder', count: 3 }]],
  [[{ type: 'cloner', count: 3 }, { type: 'bomber', count: 3 }], [{ type: 'berserker', count: 4 }, { type: 'reflector', count: 2 }], [{ type: 'cursed', count: 4 }]],
  [[{ type: 'cloner', count: 3 }, { type: 'berserker', count: 3 }], [{ type: 'bomber', count: 4 }, { type: 'reflector', count: 3 }, { type: 'leech', count: 2 }], [{ type: 'boss', count: 1 }]],
]

/** Picks the BattleSpec[] used for a given world. Higher world brackets
 *  introduce more mechanically dangerous enemy types. */
function _specBracketFor(worldGrade: WorldGrade): BattleSpec[] {
  const idx = WORLD_GRADES.indexOf(worldGrade)
  if (idx <= 2)  return SPEC_BRACKET_INTRO    // F E D
  if (idx <= 5)  return SPEC_BRACKET_RISING   // C B A
  if (idx <= 8)  return SPEC_BRACKET_ELITE    // S SS SSS
  if (idx <= 11) return SPEC_BRACKET_APEX     // Z ZZ ZZZ
  return SPEC_BRACKET_COSMIC                  // Cosmic / Immortal / Celestial / Godly / Primordial / Absolute / Transcendent / Infinite
}

/** Back-compat export — points at the intro bracket so anything still
 *  importing BATTLE_SPECS gets a sensible default. Prefer
 *  getBattleWaves() / specForWorldAndBattle() in new code. */
export const BATTLE_SPECS: BattleSpec[] = SPEC_BRACKET_INTRO

/** Player level thresholds — which world must be beaten to reach each level. */
export const PLAYER_LEVEL_WORLDS: Record<number, WorldGrade> = {
  1: 'C',
  2: 'A',
  3: 'SS',
  4: 'Z',
  5: 'ZZZ',
  6: 'Immortal',
  7: 'Godly',
  8: 'Absolute',
}
/** Highest player level the progression allows. */
export const MAX_PLAYER_LEVEL = 8

/** Gem + XP drop range per base enemy grade (not elite/boss). */
export interface DropRange { min: number; max: number }

export interface GradeDropTable {
  gems: DropRange
  xp: DropRange
}

export const GRADE_DROPS: Record<WorldGrade, GradeDropTable> = {
  F:          { gems: { min: 1,         max: 3         }, xp: { min: 1,         max: 3         } },
  E:          { gems: { min: 5,         max: 10        }, xp: { min: 5,         max: 10        } },
  D:          { gems: { min: 12,        max: 18        }, xp: { min: 12,        max: 18        } },
  C:          { gems: { min: 22,        max: 32        }, xp: { min: 22,        max: 32        } },
  B:          { gems: { min: 35,        max: 46        }, xp: { min: 35,        max: 46        } },
  A:          { gems: { min: 52,        max: 68        }, xp: { min: 52,        max: 68        } },
  S:          { gems: { min: 70,        max: 100       }, xp: { min: 70,        max: 100       } },
  SS:         { gems: { min: 110,       max: 150       }, xp: { min: 110,       max: 150       } },
  SSS:        { gems: { min: 200,       max: 250       }, xp: { min: 200,       max: 250       } },
  Z:          { gems: { min: 400,       max: 600       }, xp: { min: 400,       max: 600       } },
  ZZ:         { gems: { min: 1_000,     max: 2_000     }, xp: { min: 1_000,     max: 2_000     } },
  ZZZ:         { gems: { min: 5_000,      max: 10_000     }, xp: { min: 5_000,      max: 10_000     } },
  Cosmic:      { gems: { min: 12_000,     max: 22_000     }, xp: { min: 12_000,     max: 22_000     } },
  Immortal:    { gems: { min: 25_000,     max: 50_000     }, xp: { min: 25_000,     max: 50_000     } },
  Celestial:   { gems: { min: 55_000,     max: 90_000     }, xp: { min: 55_000,     max: 90_000     } },
  Godly:       { gems: { min: 110_000,    max: 180_000    }, xp: { min: 110_000,    max: 180_000    } },
  Primordial:  { gems: { min: 250_000,    max: 500_000    }, xp: { min: 250_000,    max: 500_000    } },
  Absolute:    { gems: { min: 1_000_000,  max: 2_000_000  }, xp: { min: 1_000_000,  max: 2_000_000  } },
  Transcendent:{ gems: { min: 3_000_000,  max: 6_000_000  }, xp: { min: 3_000_000,  max: 6_000_000  } },
  Infinite:    { gems: { min: 10_000_000, max: 20_000_000 }, xp: { min: 10_000_000, max: 20_000_000 } },
}

/** Elite mobs give 3× drops; bosses give 5×. */
export const ELITE_DROP_MULT = 3
export const BOSS_DROP_MULT = 5

/** Crystal grades for dropped gear. */
export type CrystalDropGrade = 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S' | 'SS' | 'SSS' | 'God'
/** Stat crystal rarity: normal enemies → common, elites → elite, bosses → legendary. */
export type StatCrystalRarity = 'common' | 'elite' | 'legendary'

/** Ordered crystal grades (ascending). Used for range-based drop rolls. */
export const CRYSTAL_GRADE_ORDER: readonly CrystalDropGrade[] = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'God']

/**
 * Maps a world grade to the [min, max] crystal grade range enemies can drop.
 * The actual grade is chosen randomly within this range on each kill — higher
 * worlds have a wider range biased toward better grades.
 */
export const WORLD_CRYSTAL_DROP_RANGE: Record<WorldGrade, [CrystalDropGrade, CrystalDropGrade]> = {
  F:          ['F',  'F'  ],
  E:          ['F',  'E'  ],
  D:          ['F',  'D'  ],
  C:          ['E',  'D'  ],
  B:          ['E',  'C'  ],
  A:          ['D',  'C'  ],
  S:          ['D',  'B'  ],
  SS:         ['C',  'B'  ],
  SSS:        ['C',  'A'  ],
  Z:          ['B',  'A'  ],
  ZZ:         ['B',  'S'  ],
  ZZZ:         ['A',  'S'  ],
  Cosmic:      ['A',  'SS' ],
  Immortal:    ['S',  'SS' ],
  Celestial:   ['S',  'SSS'],
  Godly:       ['SS', 'SSS'],
  Primordial:  ['SS', 'God'],
  Absolute:    ['SSS','God'],
  Transcendent:['SSS','God'],
  Infinite:    ['SSS','God'],
}

/** Rolls a random crystal grade within a world's drop range. */
export function rollCrystalGrade(worldGrade: WorldGrade): CrystalDropGrade {
  const [min, max] = WORLD_CRYSTAL_DROP_RANGE[worldGrade]
  const minIdx = CRYSTAL_GRADE_ORDER.indexOf(min)
  const maxIdx = CRYSTAL_GRADE_ORDER.indexOf(max)
  return CRYSTAL_GRADE_ORDER[minIdx + Math.floor(Math.random() * (maxIdx - minIdx + 1))]
}

/** Maps enemy type to the stat crystal rarity they drop. Mid-tier
 *  mechanical variants (shielder, leech, cursed, phaseShifter, reflector,
 *  berserker) drop elite crystals. The two on-death threat types (bomber,
 *  cloner) drop legendary crystals — they're the hardest to handle. */
export const TYPE_TO_STAT_RARITY: Record<EnemyType, StatCrystalRarity> = {
  normal:       'common',
  elite:        'elite',
  boss:         'legendary',
  phaseShifter: 'elite',
  shielder:     'elite',
  leech:        'elite',
  cursed:       'elite',
  bomber:       'legendary',
  cloner:       'legendary',
  reflector:    'elite',
  berserker:    'elite',
}

/** Chance drops per kill (roll independently). */
export const CHANCE_DROP_RATES = {
  fateShard:     0.05,
  powerCrystal:  0.08,
  statCrystal:   0.025,  // 2.5% — stat crystals are useful, should drop reasonably often
  weaponCrystal: 0.07,
  armorCrystal:  0.07,
  spin:          0.01,   // 1% — rare bonus spin drop
  heroSpin:      0.003,    // 0.3% — hero spin drop (unlocked at level 2)
  legendSpin:    0.0005,   // 0.05% — legend spin drop (unlocked at level 4)
  paragonSpin:   0.00017,  // ~0.017% — paragon spin drop (unlocked at level 6, ~3× rarer than legend)
} as const

/** Endless Key drop rate — only applies at player level 3+ (caller must check). */
export const ENDLESS_KEY_DROP_RATE = 0.08

/**
 * A drop from a killed enemy. Crystal drops carry the grade/rarity as a colon-separated suffix:
 * e.g. 'powerCrystal:E', 'statCrystal:elite', 'weaponCrystal:God'.
 * Simple drops have no suffix: 'fateShard', 'spin', 'endlessKey', 'heroSpin', 'legendSpin'.
 */
export type ChanceDrop =
  | 'fateShard' | 'spin' | 'endlessKey' | 'heroSpin' | 'legendSpin' | 'paragonSpin'
  | `statCrystal:${StatCrystalRarity}`
  | `powerCrystal:${CrystalDropGrade}`
  | `weaponCrystal:${CrystalDropGrade}`
  | `armorCrystal:${CrystalDropGrade}`

/** Returns world index (0-based) for a given grade. */
export function worldIndex(grade: WorldGrade): number {
  return WORLD_GRADES.indexOf(grade)
}

/** Returns the enemy grade for battle N (1-based) in a world.
 *  All enemies use the world grade. Type multipliers (normal=1×, elite=1.5×, boss=2.5×) handle difficulty.
 */
export interface Enemy {
  grade: WorldGrade
  type: EnemyType
  name: string
}

/**
 * Expands a battle spec into concrete Enemy arrays for each wave.
 * All enemy types use the world grade. Difficulty difference comes from HP/damage
 * multipliers in buildEnemyChar (normal=1×, elite=1.5×, boss=2.5×), not grade offsets.
 */
/** Display-name prefixes per enemy type. Used by getBattleWaves when
 *  generating the per-enemy name shown on battle cards. */
const _TYPE_NAME: Record<EnemyType, string> = {
  normal:       'Warrior',
  elite:        'Champion',
  boss:         'Overlord',
  phaseShifter: 'Phaseling',
  shielder:     'Bulwark',
  leech:        'Bloodleech',
  cursed:       'Hexbringer',
  bomber:       'Detonator',
  cloner:       'Cloner',
  reflector:    'Mirrorblade',
  berserker:    'Berserker',
}

export function getBattleWaves(worldGrade: WorldGrade, battleNumber: number): Enemy[][] {
  const idx = worldIndex(worldGrade)
  const spec = _specBracketFor(worldGrade)[Math.min(battleNumber - 1, BATTLES_PER_WORLD - 1)]
  return spec.map(wave =>
    wave.flatMap(({ type, count }) =>
      Array.from({ length: count }, (_, i) => {
        const gradeIdx = idx
        const grade = WORLD_GRADES[gradeIdx]
        const suffix = count > 1 ? ` ${i + 1}` : ''
        const name = type === 'boss'
          ? `${worldGrade} Overlord`
          : `${grade} ${_TYPE_NAME[type]}${suffix}`
        return { grade, type, name } as Enemy
      })
    )
  )
}

/** Drop multipliers per enemy type. Mid-tier mechanical variants give
 *  the elite multiplier; bomber + cloner give the boss multiplier
 *  because their on-death effects make them genuinely dangerous. */
const _TYPE_DROP_MULT: Record<EnemyType, number> = {
  normal:       1,
  elite:        ELITE_DROP_MULT,
  boss:         BOSS_DROP_MULT,
  phaseShifter: ELITE_DROP_MULT,
  shielder:     ELITE_DROP_MULT,
  leech:        ELITE_DROP_MULT,
  cursed:       ELITE_DROP_MULT,
  reflector:    ELITE_DROP_MULT,
  berserker:    ELITE_DROP_MULT,
  bomber:       BOSS_DROP_MULT,
  cloner:       BOSS_DROP_MULT,
}

/** Rolls actual gem/XP drops for an enemy (includes per-type multiplier). */
export function rollDrops(enemy: Enemy): { gems: number; xp: number; chanceDrops: ChanceDrop[] } {
  const table = GRADE_DROPS[enemy.grade]
  const mult = _TYPE_DROP_MULT[enemy.type] ?? 1
  const roll = (r: DropRange) => Math.floor((r.min + Math.random() * (r.max - r.min + 1)) * mult)

  const sr = TYPE_TO_STAT_RARITY[enemy.type]

  const chanceDrops: ChanceDrop[] = []
  if (Math.random() < CHANCE_DROP_RATES.fateShard)     chanceDrops.push('fateShard')
  if (Math.random() < CHANCE_DROP_RATES.powerCrystal)  chanceDrops.push(`powerCrystal:${rollCrystalGrade(enemy.grade)}`)
  if (Math.random() < CHANCE_DROP_RATES.statCrystal)   chanceDrops.push(`statCrystal:${sr}`)
  if (Math.random() < CHANCE_DROP_RATES.weaponCrystal) chanceDrops.push(`weaponCrystal:${rollCrystalGrade(enemy.grade)}`)
  if (Math.random() < CHANCE_DROP_RATES.armorCrystal)  chanceDrops.push(`armorCrystal:${rollCrystalGrade(enemy.grade)}`)
  if (Math.random() < CHANCE_DROP_RATES.spin)          chanceDrops.push('spin')
  if (Math.random() < CHANCE_DROP_RATES.heroSpin)      chanceDrops.push('heroSpin')
  if (Math.random() < CHANCE_DROP_RATES.legendSpin)    chanceDrops.push('legendSpin')
  if (Math.random() < CHANCE_DROP_RATES.paragonSpin)   chanceDrops.push('paragonSpin')

  return { gems: roll(table.gems), xp: roll(table.xp), chanceDrops }
}

/** Returns the player level (1–MAX_PLAYER_LEVEL) earned from worlds beaten. */
export function getPlayerLevelFromWorlds(beaten: Set<WorldGrade>): number {
  for (let lvl = MAX_PLAYER_LEVEL; lvl >= 1; lvl--) {
    if (beaten.has(PLAYER_LEVEL_WORLDS[lvl])) return lvl
  }
  return 0
}

/** Returns the next world to unlock, or null if all beaten. */
export function nextLockedWorld(beaten: Set<WorldGrade>): WorldGrade | null {
  return WORLD_GRADES.find(g => !beaten.has(g)) ?? null
}
