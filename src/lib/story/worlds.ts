// Story Mode worlds system.
// 16 worlds (F → Absolute), 20 battles each. Enemies scale ±1 tier around world grade.
// Player level (1–5) is unlocked by beating specific worlds.

export type WorldGrade = 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S' | 'SS' | 'SSS' | 'Z' | 'ZZ' | 'ZZZ' | 'Celestial' | 'Godly' | 'Primordial' | 'Absolute'

export const WORLD_GRADES: readonly WorldGrade[] = [
  'F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'Z', 'ZZ', 'ZZZ', 'Celestial', 'Godly', 'Primordial', 'Absolute',
] as const

export const BATTLES_PER_WORLD = 20

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

/** Chance drops per kill (roll independently). */
export const CHANCE_DROP_RATES = {
  fateShard:     0.05,   // 5% per kill
  powerCrystal:  0.08,
  statCrystal:   0.06,
  weaponCrystal: 0.07,
  armorCrystal:  0.07,
} as const

/** Endless Key drop rate — only applies at player level 3+ (caller must check). */
export const ENDLESS_KEY_DROP_RATE = 0.08

/** ChanceDrop: regular drops from CHANCE_DROP_RATES. 'endlessKey' is rolled separately by the caller. */
export type ChanceDrop = keyof typeof CHANCE_DROP_RATES | 'endlessKey'

/** Returns world index (0-based) for a given grade. */
export function worldIndex(grade: WorldGrade): number {
  return WORLD_GRADES.indexOf(grade)
}

/** Returns the enemy grade for battle N (1-based) in a world.
 *  Battle 20 is the boss (same grade as world). Battles 10, 15 are elite (+1 tier from world, capped).
 *  All other battles alternate between world-1 and world grade.
 */
export type EnemyType = 'normal' | 'elite' | 'boss'
export interface Enemy {
  grade: WorldGrade
  type: EnemyType
  name: string
}

export function getEnemy(worldGrade: WorldGrade, battleNumber: number): Enemy {
  const idx = worldIndex(worldGrade)
  const isBoss = battleNumber === BATTLES_PER_WORLD
  const isElite = !isBoss && (battleNumber === 10 || battleNumber === 15)
  const type: EnemyType = isBoss ? 'boss' : isElite ? 'elite' : 'normal'

  // Normal: alternate between world-1 and world tier; elite: world+1 (capped); boss: world grade
  let gradeIdx: number
  if (isBoss) {
    gradeIdx = idx
  } else if (isElite) {
    gradeIdx = Math.min(idx + 1, WORLD_GRADES.length - 1)
  } else {
    gradeIdx = battleNumber % 2 === 0 ? idx : Math.max(0, idx - 1)
  }

  const grade = WORLD_GRADES[gradeIdx]
  const name = isBoss ? `${worldGrade} Overlord` : isElite ? `${grade} Champion` : `${grade} Warrior`
  return { grade, type, name }
}

/** Rolls actual gem/XP drops for an enemy (includes elite/boss multiplier). */
export function rollDrops(enemy: Enemy): { gems: number; xp: number; chanceDrops: ChanceDrop[] } {
  const table = GRADE_DROPS[enemy.grade]
  const mult = enemy.type === 'boss' ? BOSS_DROP_MULT : enemy.type === 'elite' ? ELITE_DROP_MULT : 1
  const roll = (r: DropRange) => Math.floor((r.min + Math.random() * (r.max - r.min + 1)) * mult)

  const chanceDrops: ChanceDrop[] = [];
  (Object.keys(CHANCE_DROP_RATES) as Array<keyof typeof CHANCE_DROP_RATES>).forEach(key => {
    if (Math.random() < CHANCE_DROP_RATES[key]) chanceDrops.push(key)
  })

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
