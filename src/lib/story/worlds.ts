// Story Mode worlds system.
// 16 worlds (F → Absolute), 20 battles each. All enemies match world grade; type multipliers handle difficulty.
// Player level (1–5) is unlocked by beating specific worlds.

export type WorldGrade = 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S' | 'SS' | 'SSS' | 'Z' | 'ZZ' | 'ZZZ' | 'Celestial' | 'Godly' | 'Primordial' | 'Absolute'

export const WORLD_GRADES: readonly WorldGrade[] = [
  'F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'Z', 'ZZ', 'ZZZ', 'Celestial', 'Godly', 'Primordial', 'Absolute',
] as const

export const BATTLES_PER_WORLD = 20

/** Maximum number of Absolute+ difficulty tiers available beyond the base Absolute world. */
export const MAX_ABSOLUTE_PLUS = 20

export type EnemyType = 'normal' | 'elite' | 'boss'

/** A group of enemies of one type within a wave. */
export interface WaveEnemySpec { type: EnemyType; count: number }
/** One battle = array of waves, each wave = array of enemy groups. */
export type BattleSpec = WaveEnemySpec[][]

/** 20-battle wave spec. Battle N = BATTLE_SPECS[N-1]. */
export const BATTLE_SPECS: BattleSpec[] = [
  // Battle 1
  [[{ type: 'normal', count: 1 }]],
  // Battle 2
  [[{ type: 'normal', count: 1 }]],
  // Battle 3
  [[{ type: 'normal', count: 2 }]],
  // Battle 4
  [[{ type: 'normal', count: 2 }]],
  // Battle 5
  [[{ type: 'elite', count: 1 }]],
  // Battle 6
  [[{ type: 'normal', count: 2 }], [{ type: 'normal', count: 2 }]],
  // Battle 7
  [[{ type: 'normal', count: 2 }], [{ type: 'normal', count: 3 }]],
  // Battle 8
  [[{ type: 'normal', count: 3 }], [{ type: 'normal', count: 3 }]],
  // Battle 9
  [[{ type: 'normal', count: 3 }], [{ type: 'normal', count: 2 }, { type: 'elite', count: 1 }]],
  // Battle 10
  [[{ type: 'normal', count: 3 }], [{ type: 'normal', count: 3 }], [{ type: 'normal', count: 2 }, { type: 'elite', count: 1 }]],
  // Battle 11
  [[{ type: 'normal', count: 3 }], [{ type: 'normal', count: 3 }], [{ type: 'normal', count: 3 }]],
  // Battle 12
  [[{ type: 'normal', count: 3 }], [{ type: 'normal', count: 3 }], [{ type: 'normal', count: 3 }]],
  // Battle 13
  [[{ type: 'normal', count: 2 }, { type: 'elite', count: 1 }], [{ type: 'normal', count: 3 }], [{ type: 'normal', count: 4 }]],
  // Battle 14
  [[{ type: 'elite', count: 2 }], [{ type: 'elite', count: 2 }], [{ type: 'normal', count: 4 }]],
  // Battle 15
  [[{ type: 'elite', count: 1 }], [{ type: 'elite', count: 2 }], [{ type: 'elite', count: 3 }]],
  // Battle 16
  [[{ type: 'normal', count: 5 }], [{ type: 'normal', count: 5 }], [{ type: 'elite', count: 1 }]],
  // Battle 17
  [[{ type: 'normal', count: 3 }], [{ type: 'elite', count: 3 }], [{ type: 'normal', count: 5 }]],
  // Battle 18
  [[{ type: 'normal', count: 5 }], [{ type: 'normal', count: 5 }], [{ type: 'elite', count: 2 }]],
  // Battle 19
  [[{ type: 'normal', count: 5 }], [{ type: 'elite', count: 3 }], [{ type: 'elite', count: 3 }]],
  // Battle 20
  [[{ type: 'elite', count: 3 }], [{ type: 'elite', count: 3 }], [{ type: 'boss', count: 1 }]],
]

/** Player level thresholds — which world must be beaten to reach each level. */
export const PLAYER_LEVEL_WORLDS: Record<number, WorldGrade> = {
  1: 'C',
  2: 'A',
  3: 'SS',
  4: 'Z',
  5: 'ZZZ',
}

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
  ZZZ:        { gems: { min: 5_000,     max: 10_000    }, xp: { min: 5_000,     max: 10_000    } },
  Celestial:  { gems: { min: 25_000,    max: 50_000    }, xp: { min: 25_000,    max: 50_000    } },
  Godly:      { gems: { min: 100_000,   max: 150_000   }, xp: { min: 100_000,   max: 150_000   } },
  Primordial: { gems: { min: 250_000,   max: 500_000   }, xp: { min: 250_000,   max: 500_000   } },
  Absolute:   { gems: { min: 1_000_000, max: 2_000_000 }, xp: { min: 1_000_000, max: 2_000_000 } },
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
  ZZZ:        ['A',  'S'  ],
  Celestial:  ['A',  'SS' ],
  Godly:      ['S',  'SS' ],
  Primordial: ['S',  'SSS'],
  Absolute:   ['SS', 'God'],
}

/** Rolls a random crystal grade within a world's drop range. */
export function rollCrystalGrade(worldGrade: WorldGrade): CrystalDropGrade {
  const [min, max] = WORLD_CRYSTAL_DROP_RANGE[worldGrade]
  const minIdx = CRYSTAL_GRADE_ORDER.indexOf(min)
  const maxIdx = CRYSTAL_GRADE_ORDER.indexOf(max)
  return CRYSTAL_GRADE_ORDER[minIdx + Math.floor(Math.random() * (maxIdx - minIdx + 1))]
}

/** Maps enemy type to the stat crystal rarity they drop. */
export const TYPE_TO_STAT_RARITY: Record<EnemyType, StatCrystalRarity> = {
  normal: 'common',
  elite:  'elite',
  boss:   'legendary',
}

/** Chance drops per kill (roll independently). */
export const CHANCE_DROP_RATES = {
  fateShard:     0.05,
  powerCrystal:  0.08,
  statCrystal:   0.005,  // reduced — were dropping too frequently
  weaponCrystal: 0.07,
  armorCrystal:  0.07,
  spin:          0.03,   // 3% — rare character spin drop
  heroSpin:      0.008,  // 0.8% — hero spin drop (unlocked at level 2)
  legendSpin:    0.002,  // 0.2% — legend spin drop (unlocked at level 4)
} as const

/** Endless Key drop rate — only applies at player level 3+ (caller must check). */
export const ENDLESS_KEY_DROP_RATE = 0.08

/**
 * A drop from a killed enemy. Crystal drops carry the grade/rarity as a colon-separated suffix:
 * e.g. 'powerCrystal:E', 'statCrystal:elite', 'weaponCrystal:God'.
 * Simple drops have no suffix: 'fateShard', 'spin', 'endlessKey', 'heroSpin', 'legendSpin'.
 */
export type ChanceDrop =
  | 'fateShard' | 'spin' | 'endlessKey' | 'heroSpin' | 'legendSpin'
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
export function getBattleWaves(worldGrade: WorldGrade, battleNumber: number): Enemy[][] {
  const idx = worldIndex(worldGrade)
  const spec = BATTLE_SPECS[Math.min(battleNumber - 1, BATTLES_PER_WORLD - 1)]
  return spec.map(wave =>
    wave.flatMap(({ type, count }) =>
      Array.from({ length: count }, (_, i) => {
        const gradeIdx = idx
        const grade = WORLD_GRADES[gradeIdx]
        const suffix = count > 1 ? ` ${i + 1}` : ''
        const name = type === 'boss' ? `${worldGrade} Overlord`
          : type === 'elite' ? `${grade} Champion${suffix}`
          : `${grade} Warrior${suffix}`
        return { grade, type, name } as Enemy
      })
    )
  )
}

/** Rolls actual gem/XP drops for an enemy (includes elite/boss multiplier). */
export function rollDrops(enemy: Enemy): { gems: number; xp: number; chanceDrops: ChanceDrop[] } {
  const table = GRADE_DROPS[enemy.grade]
  const mult = enemy.type === 'boss' ? BOSS_DROP_MULT : enemy.type === 'elite' ? ELITE_DROP_MULT : 1
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

  return { gems: roll(table.gems), xp: roll(table.xp), chanceDrops }
}

/** Returns the player level (1–5) earned from worlds beaten. */
export function getPlayerLevelFromWorlds(beaten: Set<WorldGrade>): number {
  for (let lvl = 5; lvl >= 1; lvl--) {
    if (beaten.has(PLAYER_LEVEL_WORLDS[lvl])) return lvl
  }
  return 0
}

/** Returns the next world to unlock, or null if all beaten. */
export function nextLockedWorld(beaten: Set<WorldGrade>): WorldGrade | null {
  return WORLD_GRADES.find(g => !beaten.has(g)) ?? null
}
