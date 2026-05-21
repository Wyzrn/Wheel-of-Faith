// Story Mode save slot system — 4 isolated save slots, each with its own
// roster, gems, shards, world progression, spin credits, inventory, and daily shop limits.
// Keys are story_slot_1 … story_slot_4; never overlaps the legacy story_roster/story_shards keys.

import type { StoryRosterEntry, StoryTeam, EquippedItem } from './types'
import type { WorldGrade } from './worlds'
import { WORLD_GRADES, BATTLES_PER_WORLD, MAX_ABSOLUTE_PLUS, getPlayerLevelFromWorlds } from './worlds'
export { MAX_ABSOLUTE_PLUS } from './worlds'
import { scoreTier, computeOverallScore, extendedTierFromScore, boostedTier } from '../game/scoreTier'
import type { TierGrade } from '../game/scoreTier'
import type { SpinResult } from '../session/types'
import { weapons } from '../content/weapons'
import { armors } from '../content/armors'
import { powers } from '../content/powers'

export type SlotId = 1 | 2 | 3 | 4

/** Labels displayed in the hub for each stage (legacy — kept for raceTiers compatibility). */
export const STAGE_LABELS = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Godlike'] as const

/** Minimum race weight allowed at each stage (index 0 = stage 1). */
export const STAGE_MIN_WEIGHTS = [12, 7, 5, 4, 2, 1] as const

/** Starting spin credits given to a brand-new save slot. */
export const INITIAL_SPIN_CREDITS = 10

/** Spins refresh every N milliseconds (3 hours). */
export const SPIN_REFRESH_INTERVAL_MS = 3 * 60 * 60 * 1000

/** Max spins per day. */
export const MAX_DAILY_SPINS = 10

/** Starting roster capacity (max characters). */
export const INITIAL_ROSTER_CAPACITY = 5

/** Gems cost for the first capacity upgrade; scales quadratically per upgrade. */
export const BASE_ROSTER_UPGRADE_COST = 50

/** Stat crystal shop prices in gems. */
export const STAT_CRYSTAL_COSTS = {
  common:    10_000,
  elite:    100_000,
  legendary: 1_000_000,
} as const

/** Daily purchase limits per stat crystal type. */
export const STAT_CRYSTAL_DAILY_LIMITS = {
  common:    5,
  elite:     3,
  legendary: 1,
} as const

/** @deprecated Use CRYSTAL_BUY_PRICES_GEMS['F'] instead. Kept for backward compat. */
export const F_CRYSTAL_COST = 5_000

export type StatCrystalType = 'common' | 'elite' | 'legendary'
export type CrystalGrade = 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S' | 'SS' | 'SSS' | 'God'

export const CRYSTAL_GRADE_LIST: readonly CrystalGrade[] = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'God']

/** Gem cost to buy one power/weapon/armor crystal of each grade from the shop. */
export const CRYSTAL_BUY_PRICES_GEMS: Record<CrystalGrade, number> = {
  F:      5_000,
  E:     12_000,
  D:     30_000,
  C:     75_000,
  B:    200_000,
  A:    500_000,
  S:  1_500_000,
  SS: 5_000_000,
  SSS: 15_000_000,
  God: 50_000_000,
}

/** Fate Shard cost to buy one power/weapon/armor crystal of each grade from the shop. */
export const CRYSTAL_BUY_PRICES_SHARDS: Record<CrystalGrade, number> = {
  F:       5,
  E:      12,
  D:      30,
  C:      75,
  B:     200,
  A:     500,
  S:   1_500,
  SS:  5_000,
  SSS: 15_000,
  God: 50_000,
}

/** Gems earned when selling one power/weapon/armor crystal of each grade (~30% of buy price). */
export const CRYSTAL_SELL_PRICES: Record<CrystalGrade, number> = {
  F:      1_500,
  E:      3_600,
  D:      9_000,
  C:     22_500,
  B:     60_000,
  A:    150_000,
  S:    450_000,
  SS: 1_500_000,
  SSS: 4_500_000,
  God: 15_000_000,
}

/** Gems earned when selling one stat crystal of each type (~30% of buy price). */
export const STAT_CRYSTAL_SELL_PRICES: Record<StatCrystalType, number> = {
  common:    3_000,
  elite:    30_000,
  legendary: 300_000,
}

/** Fate Shard cost to buy one stat crystal (alternative to gems). Shares the daily limit. */
export const STAT_CRYSTAL_SHARD_COSTS: Record<StatCrystalType, number> = {
  common:    100,
  elite:   1_000,
  legendary: 10_000,
}

/** Tier levels advanced per crystal type (not score points). */
export const STAT_CRYSTAL_BOOST: Record<StatCrystalType, number> = {
  common: 1, elite: 3, legendary: 5,
}

/** Stats that can be boosted via stat crystals. */
export const BOOSTABLE_STATS = [
  'strength', 'durability', 'agility', 'speed', 'fightingSkill', 'iq',
  'energyLevel', 'powerMastery', 'weaponMastery', 'potential', 'armorStrength',
  'charisma',
] as const
export type BoostableStat = typeof BOOSTABLE_STATS[number]

export const BOOSTABLE_STAT_LABELS: Record<BoostableStat, string> = {
  strength: 'Strength', durability: 'Durability', agility: 'Agility', speed: 'Speed',
  fightingSkill: 'Fighting Skill', iq: 'IQ', energyLevel: 'Energy Level',
  powerMastery: 'Power Mastery', weaponMastery: 'Weapon Mastery',
  potential: 'Potential', armorStrength: 'Armor Strength', charisma: 'Charisma',
}

/** An item obtained by opening a power/weapon/armor crystal. */
export interface OpenedItem {
  id: string
  grade: CrystalGrade
  name: string
  element?: string
}

export interface GradedCrystalCounts {
  F: number; E: number; D: number; C: number; B: number
  A: number; S: number; SS: number; SSS: number; God: number
}

function freshGradedCrystals(): GradedCrystalCounts {
  return { F: 0, E: 0, D: 0, C: 0, B: 0, A: 0, S: 0, SS: 0, SSS: 0, God: 0 }
}

/** Picks a random item from the real content pool for the given type and grade. */
function pickCrystalItem(
  type: 'weapon' | 'armor' | 'power',
  grade: CrystalGrade,
): { name: string; element?: string } {
  const pool = (type === 'weapon' ? weapons : type === 'armor' ? armors : powers)
    .filter(item => item.grade === grade)
  if (pool.length === 0) return { name: `${grade} ${type.charAt(0).toUpperCase() + type.slice(1)}` }
  const totalWeight = pool.reduce((s, item) => s + (item.weight ?? 1), 0)
  let roll = Math.random() * totalWeight
  for (const item of pool) {
    roll -= item.weight ?? 1
    if (roll <= 0) return { name: item.label, element: item.element }
  }
  const last = pool[pool.length - 1]
  return { name: last.label, element: last.element }
}

export interface StoryInventory {
  statCrystals: {
    common: number
    elite: number
    legendary: number
  }
  powerCrystals:  GradedCrystalCounts
  weaponCrystals: GradedCrystalCounts
  armorCrystals:  GradedCrystalCounts
  openedWeapons:  OpenedItem[]
  openedArmors:   OpenedItem[]
  openedPowers:   OpenedItem[]
}

/** Per-world battle progress. */
export interface WorldProgress {
  battlesCompleted: number   // 0–20
  beaten: boolean            // true once battle 20 is won
  /** ISO timestamp when the last replay of this world was started. Used for 12h cooldown. */
  lastReplayedAt?: string
}

/** 12-hour cooldown between replays of a beaten world. */
export const WORLD_REPLAY_COOLDOWN_MS = 12 * 60 * 60 * 1000

/** Returns remaining cooldown ms for replaying a beaten world (0 = ready). */
export function worldReplayCooldownMs(slot: StorySaveSlot, world: WorldGrade): number {
  const prog = slot.worldProgress[world]
  if (!prog?.beaten || !prog.lastReplayedAt) return 0
  const elapsed = Date.now() - new Date(prog.lastReplayedAt).getTime()
  return Math.max(0, WORLD_REPLAY_COOLDOWN_MS - elapsed)
}

/** Stamps the replay start timestamp and resets battlesCompleted to the last battle (19 of 20). */
export function recordWorldReplayStart(slot: StorySaveSlot, world: WorldGrade): StorySaveSlot {
  const prev = slot.worldProgress[world]
  if (!prev?.beaten) return slot
  return {
    ...slot,
    worldProgress: {
      ...slot.worldProgress,
      [world]: { ...prev, battlesCompleted: BATTLES_PER_WORLD - 1, lastReplayedAt: new Date().toISOString() },
    },
  }
}

/** Tracks how many stat crystals have been purchased today (resets at midnight). */
export interface DailyCrystalPurchases {
  date: string   // "YYYY-MM-DD"
  statCrystals: {
    common: number
    elite: number
    legendary: number
  }
}

export interface StorySaveSlot {
  id: SlotId
  /** Legacy stage (1–6) — kept for raceTiers spin filtering; derived from playerLevel. */
  stage: number
  /** Player level 0–5, unlocked by beating specific worlds. */
  playerLevel: number
  /** World-by-world progress. */
  worldProgress: Partial<Record<WorldGrade, WorldProgress>>
  roster: StoryRosterEntry[]
  teams: StoryTeam[]
  /** Maximum characters allowed in roster. Starts at INITIAL_ROSTER_CAPACITY. */
  rosterCapacity: number
  /** How many times the roster has been upgraded (for cost scaling). */
  rosterUpgradeCount: number
  gems: number
  shards: number
  spinsRemaining: number
  /** Bonus spins earned from enemy drops and battle milestones (every 5 battles). */
  bonusSpins: number
  /** Hero Spins (2× luck + 2× battle stats). Unlocked at player level 2. */
  heroSpins: number
  /** Legend Spins (4× luck + 4× battle stats). Unlocked at player level 4. */
  legendSpins: number
  /** ISO timestamp of last spin refresh check. Used to award spins every 3 hours. */
  spinsLastRefreshedAt: string
  /** Endless Mode keys — each key grants one Endless Mode run. Unlocked at player level 3. */
  endlessKeys: number
  /** How many complete Absolute+ runs have been finished (0–MAX_ABSOLUTE_PLUS). */
  absolutePlusCompleted: number
  /** Battles finished in the currently-active Absolute+ run (resets to 0 when a run completes). */
  absolutePlusBattles: number
  /** Highest wave ever reached in Endless Mode. */
  endlessHighestWave: number
  inventory: StoryInventory
  dailyCrystalPurchases: DailyCrystalPurchases
  createdAt: string
  lastPlayedAt: string
}

function slotKey(id: SlotId): string {
  return `story_slot_${id}`
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}

function freshDailyPurchases(): DailyCrystalPurchases {
  return { date: todayString(), statCrystals: { common: 0, elite: 0, legendary: 0 } }
}

function freshInventory(): StoryInventory {
  return {
    statCrystals: { common: 0, elite: 0, legendary: 0 },
    powerCrystals:  freshGradedCrystals(),
    weaponCrystals: freshGradedCrystals(),
    armorCrystals:  freshGradedCrystals(),
    openedWeapons:  [],
    openedArmors:   [],
    openedPowers:   [],
  }
}

/** Returns daily purchase record, resetting it if the stored date is not today. */
function getOrResetDaily(slot: StorySaveSlot): DailyCrystalPurchases {
  if (!slot.dailyCrystalPurchases || slot.dailyCrystalPurchases.date !== todayString()) {
    return freshDailyPurchases()
  }
  return slot.dailyCrystalPurchases
}

/** Returns the spin stage (1–6) for the wheel filter, derived from playerLevel. */
export function getStageForPlayerLevel(playerLevel: number): number {
  return Math.max(1, Math.min(6, playerLevel + 1))
}

/** Gems cost for the Nth roster capacity upgrade (0-indexed). */
export function rosterUpgradeCost(upgradeCount: number): number {
  return Math.round(BASE_ROSTER_UPGRADE_COST * Math.pow(2, upgradeCount))
}

/** Creates a blank save slot (does not write to localStorage). */
export function createSaveSlot(id: SlotId): StorySaveSlot {
  return {
    id,
    stage: 1,
    playerLevel: 0,
    worldProgress: {},
    roster: [],
    teams: [],
    rosterCapacity: INITIAL_ROSTER_CAPACITY,
    rosterUpgradeCount: 0,
    gems: 0,
    shards: 0,
    spinsRemaining: INITIAL_SPIN_CREDITS,
    bonusSpins: 0,
    heroSpins: 0,
    legendSpins: 0,
    spinsLastRefreshedAt: new Date().toISOString(),
    endlessKeys: 0,
    absolutePlusCompleted: 0,
    absolutePlusBattles: 0,
    endlessHighestWave: 0,
    inventory: freshInventory(),
    dailyCrystalPurchases: freshDailyPurchases(),
    createdAt: new Date().toISOString(),
    lastPlayedAt: new Date().toISOString(),
  }
}

/** Merges missing inventory fields so old saves missing graded crystals still work. */
function migrateInventory(raw: Partial<StoryInventory>): StoryInventory {
  return {
    statCrystals:  raw.statCrystals  ?? { common: 0, elite: 0, legendary: 0 },
    powerCrystals:  raw.powerCrystals  ?? freshGradedCrystals(),
    weaponCrystals: raw.weaponCrystals ?? freshGradedCrystals(),
    armorCrystals:  raw.armorCrystals  ?? freshGradedCrystals(),
    openedWeapons:  raw.openedWeapons  ?? [],
    openedArmors:   raw.openedArmors   ?? [],
    openedPowers:   raw.openedPowers   ?? [],
  }
}

/** Migrates a raw parsed slot to fill in any missing fields from older saves. */
function migrateSlot(raw: Partial<StorySaveSlot> & { id: SlotId }): StorySaveSlot {
  const base = createSaveSlot(raw.id)
  const playerLevel = raw.playerLevel ?? 0
  return {
    ...base,
    ...raw,
    playerLevel,
    stage: getStageForPlayerLevel(playerLevel),
    worldProgress: raw.worldProgress ?? {},
    rosterCapacity: raw.rosterCapacity ?? INITIAL_ROSTER_CAPACITY,
    rosterUpgradeCount: raw.rosterUpgradeCount ?? 0,
    gems: raw.gems ?? 0,
    bonusSpins: raw.bonusSpins ?? 0,
    heroSpins: raw.heroSpins ?? 0,
    legendSpins: raw.legendSpins ?? 0,
    spinsLastRefreshedAt: raw.spinsLastRefreshedAt ?? new Date().toISOString(),
    inventory: migrateInventory(raw.inventory ?? {}),
    dailyCrystalPurchases: raw.dailyCrystalPurchases ?? freshDailyPurchases(),
    endlessKeys: raw.endlessKeys ?? 0,
    absolutePlusCompleted: raw.absolutePlusCompleted ?? 0,
    absolutePlusBattles: raw.absolutePlusBattles ?? 0,
    endlessHighestWave: raw.endlessHighestWave ?? 0,
    teams: raw.teams ?? [],
    // Migrate roster entries — add missing fields and burn any accumulated statBonuses into spins
    roster: (raw.roster ?? []).map(r => {
      const base = {
        ...r,
        level: r.level ?? 1,
        xp: r.xp ?? 0,
        statBonuses: {} as Record<string, number>,
        equippedWeapons: r.equippedWeapons ?? [],
        equippedArmors:  r.equippedArmors  ?? [],
        equippedPowers:  r.equippedPowers  ?? [],
      }
      const bonuses: Record<string, number> = r.statBonuses ?? {}
      if (Object.keys(bonuses).length === 0) return base
      // Burn accumulated bonuses into the actual spin results, then clear statBonuses
      const newSpins = (base.spins ?? []).map((spin: SpinResult) => {
        const bonus = bonuses[spin.category]
        return bonus ? boostSpin(spin, bonus) : spin
      })
      const { overallScore, overallTier } = recomputeOverall(newSpins)
      return { ...base, spins: newSpins, overallScore, overallTier }
    }),
  }
}

/**
 * Awards spins based on elapsed 3-hour intervals since last refresh.
 * Returns updated slot (may be unchanged if no spins due). Does NOT save.
 */
export function applySpinRefresh(slot: StorySaveSlot): StorySaveSlot {
  const now = Date.now()
  const last = new Date(slot.spinsLastRefreshedAt).getTime()
  const intervals = Math.floor((now - last) / SPIN_REFRESH_INTERVAL_MS)
  if (intervals <= 0) return slot
  const newSpins = Math.min(slot.spinsRemaining + intervals, MAX_DAILY_SPINS)
  const newRefreshTime = new Date(last + intervals * SPIN_REFRESH_INTERVAL_MS).toISOString()
  return { ...slot, spinsRemaining: newSpins, spinsLastRefreshedAt: newRefreshTime }
}

/** Returns milliseconds until the next spin refresh (0 if spins already at max). */
export function msUntilNextRefresh(slot: StorySaveSlot): number {
  if (slot.spinsRemaining >= MAX_DAILY_SPINS) return 0
  const last = new Date(slot.spinsLastRefreshedAt).getTime()
  const nextRefresh = last + SPIN_REFRESH_INTERVAL_MS
  return Math.max(0, nextRefresh - Date.now())
}

/** Loads a save slot from localStorage. Returns null when empty or corrupted. */
export function loadSaveSlot(id: SlotId): StorySaveSlot | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(slotKey(id))
    if (!raw) return null
    return migrateSlot(JSON.parse(raw) as Partial<StorySaveSlot> & { id: SlotId })
  } catch {
    return null
  }
}

/** Persists a save slot to localStorage. Updates lastPlayedAt automatically. */
export function saveSaveSlot(slot: StorySaveSlot): void {
  if (typeof localStorage === 'undefined') return
  const updated = { ...slot, lastPlayedAt: new Date().toISOString() }
  localStorage.setItem(slotKey(slot.id), JSON.stringify(updated))
}

/** Deletes a save slot from localStorage. */
export function deleteSaveSlot(id: SlotId): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(slotKey(id))
}

/** Returns all 4 slot descriptors — null for empty slots, loaded data for occupied ones. */
export function loadAllSlots(): (StorySaveSlot | null)[] {
  return ([1, 2, 3, 4] as SlotId[]).map(id => loadSaveSlot(id))
}

/**
 * Adds a character to a slot's roster (capped at rosterCapacity).
 * Returns updated slot or null if roster is full.
 */
export function addCharacterToSlot(
  slot: StorySaveSlot,
  entry: StoryRosterEntry,
): StorySaveSlot | null {
  if (slot.roster.length >= slot.rosterCapacity) return null
  const roster = [{
    ...entry,
    level: entry.level ?? 1,
    xp: entry.xp ?? 0,
    statBonuses: entry.statBonuses ?? {},
    equippedWeapons: entry.equippedWeapons ?? [],
    equippedArmors:  entry.equippedArmors  ?? [],
    equippedPowers:  entry.equippedPowers  ?? [],
  }, ...slot.roster]
  return { ...slot, roster }
}

/** Purchases a roster capacity upgrade (+5 slots). Returns null if insufficient gems. */
export function upgradeRosterCapacity(slot: StorySaveSlot): StorySaveSlot | null {
  const cost = rosterUpgradeCost(slot.rosterUpgradeCount)
  if (slot.gems < cost) return null
  return {
    ...slot,
    gems: slot.gems - cost,
    rosterCapacity: slot.rosterCapacity + 5,
    rosterUpgradeCount: slot.rosterUpgradeCount + 1,
  }
}

/** Sells a character from a slot's roster, crediting gems. */
export function sellCharacterFromSlot(
  slot: StorySaveSlot,
  characterId: string,
  gemValue: number,
): StorySaveSlot {
  return {
    ...slot,
    roster: slot.roster.filter(r => r.id !== characterId),
    gems: slot.gems + gemValue,
  }
}

/** Purchases spin credits using shards. Returns updated slot or null if insufficient shards. */
export const SHARD_COST_PER_SPIN = 50
export function purchaseSpin(slot: StorySaveSlot): StorySaveSlot | null {
  if (slot.shards < SHARD_COST_PER_SPIN) return null
  return { ...slot, shards: slot.shards - SHARD_COST_PER_SPIN, spinsRemaining: slot.spinsRemaining + 1 }
}

/** Consumes one spin credit. Returns updated slot or null if no credits remaining. */
export function consumeSpin(slot: StorySaveSlot): StorySaveSlot | null {
  if (slot.spinsRemaining <= 0) return null
  return { ...slot, spinsRemaining: slot.spinsRemaining - 1 }
}

/** Consumes one bonus spin (from drops or milestones). Returns updated slot or null if none remaining. */
export function consumeBonusSpin(slot: StorySaveSlot): StorySaveSlot | null {
  if (slot.bonusSpins <= 0) return null
  return { ...slot, bonusSpins: slot.bonusSpins - 1 }
}

/**
 * Attempts to buy one stat crystal.
 * Returns updated slot, or 'insufficient_gems' / 'daily_limit' on failure.
 */
export function buyStatCrystal(
  slot: StorySaveSlot,
  type: StatCrystalType,
): StorySaveSlot | 'insufficient_gems' | 'daily_limit' {
  const cost = STAT_CRYSTAL_COSTS[type]
  const limit = STAT_CRYSTAL_DAILY_LIMITS[type]
  const daily = getOrResetDaily(slot)

  if (daily.statCrystals[type] >= limit) return 'daily_limit'
  if (slot.gems < cost) return 'insufficient_gems'

  return {
    ...slot,
    gems: slot.gems - cost,
    inventory: {
      ...slot.inventory,
      statCrystals: {
        ...slot.inventory.statCrystals,
        [type]: slot.inventory.statCrystals[type] + 1,
      },
    },
    dailyCrystalPurchases: {
      ...daily,
      statCrystals: {
        ...daily.statCrystals,
        [type]: daily.statCrystals[type] + 1,
      },
    },
  }
}

/** How many of a stat crystal type the player has bought today. */
export function getDailyBought(slot: StorySaveSlot, type: StatCrystalType): number {
  const daily = getOrResetDaily(slot)
  return daily.statCrystals[type]
}

/**
 * Records a battle win for a world. Advances battlesCompleted and marks beaten when all 20 done.
 * Recomputes playerLevel and stage from beaten worlds.
 */
export function recordBattleWin(slot: StorySaveSlot, world: WorldGrade): StorySaveSlot {
  const prev = slot.worldProgress[world] ?? { battlesCompleted: 0, beaten: false }
  const battlesCompleted = Math.min(prev.battlesCompleted + 1, BATTLES_PER_WORLD)
  const beaten = battlesCompleted >= BATTLES_PER_WORLD
  const worldProgress = { ...slot.worldProgress, [world]: { battlesCompleted, beaten } }

  const beatenSet = new Set<WorldGrade>(
    (WORLD_GRADES as readonly WorldGrade[]).filter(g => worldProgress[g]?.beaten)
  )
  const playerLevel = getPlayerLevelFromWorlds(beatenSet)
  const stage = getStageForPlayerLevel(playerLevel)

  // Award 2 bonus spins every 5 battles completed in this world
  const prevCompleted = prev.battlesCompleted
  const milestonesCrossed =
    Math.floor(battlesCompleted / 5) - Math.floor(prevCompleted / 5)
  const bonusSpins = slot.bonusSpins + milestonesCrossed * 2

  return { ...slot, worldProgress, playerLevel, stage, bonusSpins }
}

export interface BattleDrops {
  gems: number
  xp: number
  chanceDrops: import('./worlds').ChanceDrop[]
}

/**
 * Applies battle drops to the slot — adds gems, shards (from fateShard drops),
 * and crystals to inventory.
 */
export function applyBattleDrops(slot: StorySaveSlot, drops: BattleDrops): StorySaveSlot {
  let shards = slot.shards
  let endlessKeys = slot.endlessKeys
  let bonusSpins = slot.bonusSpins
  const inventory = { ...slot.inventory }

  let heroSpins = slot.heroSpins ?? 0
  let legendSpins = slot.legendSpins ?? 0

  for (const drop of drops.chanceDrops) {
    if (drop === 'fateShard') {
      shards++
    } else if (drop === 'endlessKey') {
      endlessKeys++
    } else if (drop === 'spin') {
      bonusSpins++
    } else if (drop === 'heroSpin') {
      heroSpins++
    } else if (drop === 'legendSpin') {
      legendSpins++
    } else if (drop.startsWith('statCrystal:')) {
      const rarity = drop.slice('statCrystal:'.length) as StatCrystalType
      if (rarity in inventory.statCrystals) {
        inventory.statCrystals = { ...inventory.statCrystals, [rarity]: inventory.statCrystals[rarity] + 1 }
      }
    } else if (drop.startsWith('powerCrystal:')) {
      const grade = drop.slice('powerCrystal:'.length) as CrystalGrade
      inventory.powerCrystals = { ...inventory.powerCrystals, [grade]: (inventory.powerCrystals[grade] ?? 0) + 1 }
    } else if (drop.startsWith('weaponCrystal:')) {
      const grade = drop.slice('weaponCrystal:'.length) as CrystalGrade
      inventory.weaponCrystals = { ...inventory.weaponCrystals, [grade]: (inventory.weaponCrystals[grade] ?? 0) + 1 }
    } else if (drop.startsWith('armorCrystal:')) {
      const grade = drop.slice('armorCrystal:'.length) as CrystalGrade
      inventory.armorCrystals = { ...inventory.armorCrystals, [grade]: (inventory.armorCrystals[grade] ?? 0) + 1 }
    }
  }

  return { ...slot, gems: slot.gems + drops.gems, shards, endlessKeys, bonusSpins, heroSpins, legendSpins, inventory }
}

/**
 * Purchases one F-grade power, weapon, or armor crystal.
 * Returns updated slot or 'insufficient_gems' on failure.
 */
export function buyFCrystal(
  slot: StorySaveSlot,
  type: 'power' | 'weapon' | 'armor',
): StorySaveSlot | 'insufficient_gems' {
  if (slot.gems < F_CRYSTAL_COST) return 'insufficient_gems'
  const key = `${type}Crystals` as 'powerCrystals' | 'weaponCrystals' | 'armorCrystals'
  return {
    ...slot,
    gems: slot.gems - F_CRYSTAL_COST,
    inventory: {
      ...slot.inventory,
      [key]: { ...slot.inventory[key], F: slot.inventory[key].F + 1 },
    },
  }
}

/**
 * Purchases one power/weapon/armor crystal of any grade with gems.
 * Returns updated slot or 'insufficient_gems' on failure.
 */
export function buyCrystalWithGems(
  slot: StorySaveSlot,
  type: 'power' | 'weapon' | 'armor',
  grade: CrystalGrade,
): StorySaveSlot | 'insufficient_gems' {
  const cost = CRYSTAL_BUY_PRICES_GEMS[grade]
  if (slot.gems < cost) return 'insufficient_gems'
  const key = `${type}Crystals` as 'powerCrystals' | 'weaponCrystals' | 'armorCrystals'
  return {
    ...slot,
    gems: slot.gems - cost,
    inventory: {
      ...slot.inventory,
      [key]: { ...slot.inventory[key], [grade]: (slot.inventory[key][grade] ?? 0) + 1 },
    },
  }
}

/**
 * Purchases one power/weapon/armor crystal of any grade with Fate Shards.
 * Returns updated slot or 'insufficient_shards' on failure.
 */
export function buyCrystalWithShards(
  slot: StorySaveSlot,
  type: 'power' | 'weapon' | 'armor',
  grade: CrystalGrade,
): StorySaveSlot | 'insufficient_shards' {
  const cost = CRYSTAL_BUY_PRICES_SHARDS[grade]
  if (slot.shards < cost) return 'insufficient_shards'
  const key = `${type}Crystals` as 'powerCrystals' | 'weaponCrystals' | 'armorCrystals'
  return {
    ...slot,
    shards: slot.shards - cost,
    inventory: {
      ...slot.inventory,
      [key]: { ...slot.inventory[key], [grade]: (slot.inventory[key][grade] ?? 0) + 1 },
    },
  }
}

/**
 * Sells N power/weapon/armor crystals of a given grade for gems.
 * Returns updated slot or 'insufficient_crystals' if fewer than count are owned.
 */
export function sellCrystal(
  slot: StorySaveSlot,
  type: 'power' | 'weapon' | 'armor',
  grade: CrystalGrade,
  count: number = 1,
): StorySaveSlot | 'insufficient_crystals' {
  const key = `${type}Crystals` as 'powerCrystals' | 'weaponCrystals' | 'armorCrystals'
  const current = slot.inventory[key][grade] ?? 0
  if (current < count) return 'insufficient_crystals'
  return {
    ...slot,
    gems: slot.gems + CRYSTAL_SELL_PRICES[grade] * count,
    inventory: {
      ...slot.inventory,
      [key]: { ...slot.inventory[key], [grade]: current - count },
    },
  }
}

/**
 * Sells N stat crystals of a given type for gems.
 * Returns updated slot or 'insufficient_crystals' if fewer than count are owned.
 */
export function sellStatCrystal(
  slot: StorySaveSlot,
  type: StatCrystalType,
  count: number = 1,
): StorySaveSlot | 'insufficient_crystals' {
  const current = slot.inventory.statCrystals[type]
  if (current < count) return 'insufficient_crystals'
  return {
    ...slot,
    gems: slot.gems + STAT_CRYSTAL_SELL_PRICES[type] * count,
    inventory: {
      ...slot.inventory,
      statCrystals: { ...slot.inventory.statCrystals, [type]: current - count },
    },
  }
}

/**
 * Purchases one stat crystal with Fate Shards (alternative to gems).
 * Shares the same daily purchase limit as the gems purchase path.
 * Returns updated slot or 'insufficient_shards' / 'daily_limit' on failure.
 */
export function buyStatCrystalWithShards(
  slot: StorySaveSlot,
  type: StatCrystalType,
): StorySaveSlot | 'insufficient_shards' | 'daily_limit' {
  const cost = STAT_CRYSTAL_SHARD_COSTS[type]
  const limit = STAT_CRYSTAL_DAILY_LIMITS[type]
  const daily = getOrResetDaily(slot)

  if (daily.statCrystals[type] >= limit) return 'daily_limit'
  if (slot.shards < cost) return 'insufficient_shards'

  return {
    ...slot,
    shards: slot.shards - cost,
    inventory: {
      ...slot.inventory,
      statCrystals: {
        ...slot.inventory.statCrystals,
        [type]: slot.inventory.statCrystals[type] + 1,
      },
    },
    dailyCrystalPurchases: {
      ...daily,
      statCrystals: {
        ...daily.statCrystals,
        [type]: daily.statCrystals[type] + 1,
      },
    },
  }
}

/** Grants one Endless Key. */
export function addEndlessKey(slot: StorySaveSlot): StorySaveSlot {
  return { ...slot, endlessKeys: slot.endlessKeys + 1 }
}

/** Updates highestWave record after an Endless Mode run ends and applies accumulated drops. */
export function recordEndlessResult(
  slot: StorySaveSlot,
  wavesCleared: number,
  drops: BattleDrops,
  teamCharIds: string[],
): StorySaveSlot {
  let updated: StorySaveSlot = {
    ...slot,
    endlessHighestWave: Math.max(slot.endlessHighestWave ?? 0, wavesCleared),
  }
  updated = applyBattleDrops(updated, drops)
  if (teamCharIds.length > 0) updated = addTeamXp(updated, teamCharIds, drops.xp)
  return updated
}

/**
 * Records a won battle in the current Absolute+ run.
 * When all 20 battles are cleared the run counter increments and battle progress resets.
 * Awards milestone bonus spins every 5 battles, same as regular worlds.
 */
export function recordAbsolutePlusWin(slot: StorySaveSlot): StorySaveSlot {
  const prev = slot.absolutePlusBattles ?? 0
  const battles = prev + 1
  const milestonesCrossed = Math.floor(battles / 5) - Math.floor(prev / 5)
  const bonusSpins = slot.bonusSpins + milestonesCrossed * 2

  if (battles >= BATTLES_PER_WORLD) {
    return {
      ...slot,
      absolutePlusCompleted: Math.min(MAX_ABSOLUTE_PLUS, (slot.absolutePlusCompleted ?? 0) + 1),
      absolutePlusBattles: 0,
      bonusSpins,
    }
  }
  return { ...slot, absolutePlusBattles: battles, bonusSpins }
}

/** Consumes one Endless Key. Returns null if none remaining. */
export function consumeEndlessKey(slot: StorySaveSlot): StorySaveSlot | null {
  if (slot.endlessKeys <= 0) return null
  return { ...slot, endlessKeys: slot.endlessKeys - 1 }
}

/** Cost in gems to buy one Endless Key from the shop (available at player level 3+). */
export const ENDLESS_KEY_GEM_COST = 50_000

/** Gem cost for one Hero Spin (unlocked at player level 2). 2× luck boost + 2× stat multiplier in battle. */
export const HERO_SPIN_GEM_COST = 500

/** Gem cost for one Legend Spin (unlocked at player level 4). 4× luck boost + 4× stat multiplier in battle. */
export const LEGEND_SPIN_GEM_COST = 2_000

/** Purchases one Endless Key. Returns updated slot or 'insufficient_gems'. */
export function buyEndlessKey(slot: StorySaveSlot): StorySaveSlot | 'insufficient_gems' {
  if (slot.gems < ENDLESS_KEY_GEM_COST) return 'insufficient_gems'
  return { ...slot, gems: slot.gems - ENDLESS_KEY_GEM_COST, endlessKeys: slot.endlessKeys + 1 }
}

/** Purchases one Hero Spin. Returns updated slot or 'insufficient_gems' / 'locked'. */
export function buyHeroSpin(slot: StorySaveSlot): StorySaveSlot | 'insufficient_gems' | 'locked' {
  if (slot.playerLevel < 2) return 'locked'
  if (slot.gems < HERO_SPIN_GEM_COST) return 'insufficient_gems'
  return { ...slot, gems: slot.gems - HERO_SPIN_GEM_COST, heroSpins: (slot.heroSpins ?? 0) + 1 }
}

/** Purchases one Legend Spin. Returns updated slot or 'insufficient_gems' / 'locked'. */
export function buyLegendSpin(slot: StorySaveSlot): StorySaveSlot | 'insufficient_gems' | 'locked' {
  if (slot.playerLevel < 4) return 'locked'
  if (slot.gems < LEGEND_SPIN_GEM_COST) return 'insufficient_gems'
  return { ...slot, gems: slot.gems - LEGEND_SPIN_GEM_COST, legendSpins: (slot.legendSpins ?? 0) + 1 }
}

/** Consumes one Hero Spin. Returns updated slot or null if none remaining. */
export function consumeHeroSpin(slot: StorySaveSlot): StorySaveSlot | null {
  if ((slot.heroSpins ?? 0) <= 0) return null
  return { ...slot, heroSpins: (slot.heroSpins ?? 0) - 1 }
}

/** Consumes one Legend Spin. Returns updated slot or null if none remaining. */
export function consumeLegendSpin(slot: StorySaveSlot): StorySaveSlot | null {
  if ((slot.legendSpins ?? 0) <= 0) return null
  return { ...slot, legendSpins: (slot.legendSpins ?? 0) - 1 }
}

/**
 * Max characters allowed in a team.
 * Beating F world unlocks the 2nd slot. Each player level after that adds one more (cap 4).
 * Auto-detected from worldProgress — no migration needed for existing saves.
 */
export function maxTeamSize(playerLevel: number, fWorldBeaten: boolean): number {
  if (!fWorldBeaten) return 1
  return Math.min(4, 2 + playerLevel)
}

/** Creates a new named team in the slot. */
export function createTeamInSlot(slot: StorySaveSlot, name: string, characterIds: string[]): StorySaveSlot {
  const team: StoryTeam = { id: crypto.randomUUID(), name, characterIds, createdAt: new Date().toISOString() }
  return { ...slot, teams: [...slot.teams, team] }
}

/** Replaces an existing team's name and members. Returns unchanged slot if team not found. */
export function updateTeamInSlot(slot: StorySaveSlot, teamId: string, name: string, characterIds: string[]): StorySaveSlot {
  return { ...slot, teams: slot.teams.map(t => t.id === teamId ? { ...t, name, characterIds } : t) }
}

/** Removes a team from the slot. */
export function deleteTeamInSlot(slot: StorySaveSlot, teamId: string): StorySaveSlot {
  return { ...slot, teams: slot.teams.filter(t => t.id !== teamId) }
}

/** Adds XP to a character. Each level grants +1% power boost (applied in battle). */
export function addCharacterXp(slot: StorySaveSlot, characterId: string, xp: number): StorySaveSlot {
  const roster = slot.roster.map(r => {
    if (r.id !== characterId) return r
    const newXp = r.xp + xp
    const newLevel = Math.floor(1 + Math.sqrt(newXp / 200))
    return { ...r, xp: newXp, level: newLevel }
  })
  return { ...slot, roster }
}

/** Splits totalXp evenly across all characterIds (only IDs present in roster get XP). */
export function addTeamXp(slot: StorySaveSlot, characterIds: string[], totalXp: number): StorySaveSlot {
  const validIds = characterIds.filter(id => slot.roster.some(r => r.id === id))
  if (validIds.length === 0 || totalXp <= 0) return slot
  const xpEach = Math.floor(totalXp / validIds.length)
  let updated = slot
  for (const id of validIds) updated = addCharacterXp(updated, id, xpEach)
  return updated
}

/**
 * Opens a graded power/weapon/armor crystal: consumes one crystal, picks a real item
 * from the content pool, and places it in the appropriate opened items list.
 * Returns `{ slot, item }` on success or `'no_crystal'` if none available.
 */
export function openCrystal(
  slot: StorySaveSlot,
  type: 'weapon' | 'armor' | 'power',
  grade: CrystalGrade,
): { slot: StorySaveSlot; item: OpenedItem } | 'no_crystal' {
  const key = `${type}Crystals` as 'weaponCrystals' | 'armorCrystals' | 'powerCrystals'
  const crystals = slot.inventory[key] as GradedCrystalCounts
  if ((crystals[grade] ?? 0) <= 0) return 'no_crystal'

  const picked = pickCrystalItem(type, grade)
  const item: OpenedItem = { id: crypto.randomUUID(), grade, name: picked.name, element: picked.element }
  const listKey = type === 'weapon' ? 'openedWeapons' : type === 'armor' ? 'openedArmors' : 'openedPowers'

  return {
    slot: {
      ...slot,
      inventory: {
        ...slot.inventory,
        [key]: { ...crystals, [grade]: crystals[grade] - 1 },
        [listKey]: [...slot.inventory[listKey], item],
      },
    },
    item,
  }
}

/**
 * Advances a spin result by N tier levels (not raw score points).
 * Sets the new score to the minimum of the target tier band so repeated boosts
 * always cross the next boundary. Clears displayLabel (all TIER_THRESHOLDS entries ≤ 150).
 */
function boostSpin(r: SpinResult, tierLevels: number): SpinResult {
  if (r.score == null) return r
  const { grade, score: newScore } = boostedTier(r.score, tierLevels)
  return { ...r, score: newScore, tier: grade, displayLabel: undefined }
}

const OVERALL_STAT_CATS = [
  'strength','speed','agility','durability','iq','charisma',
  'fightingSkill','powerMastery','weaponMastery','armorStrength','potential','energyLevel',
] as const

/** Recomputes overallScore + overallTier from a character's spin array. */
function recomputeOverall(spins: SpinResult[]): { overallScore: number; overallTier: TierGrade } {
  const scoreMap = Object.fromEntries(
    OVERALL_STAT_CATS.map(cat => [cat, spins.find(r => r.category === cat)?.score ?? 0])
  )
  const overallScore = computeOverallScore(scoreMap)
  return { overallScore, overallTier: scoreTier(overallScore) as TierGrade }
}

// Max stat score per player level (index = playerLevel). Mirrors StorySpinView STAGE_MAX_STAT_SCORES.
const STAT_LEVEL_MAX_SCORES = [54, 92, 99, 103, 115, Infinity] as const

/** Uses a stat crystal on a character: consumes it, boosts the spin result directly, updates overall grade. */
export function useStatCrystal(
  slot: StorySaveSlot,
  characterId: string,
  stat: BoostableStat,
  type: StatCrystalType,
): StorySaveSlot | 'no_crystal' | 'char_not_found' | 'at_cap' {
  if (slot.inventory.statCrystals[type] <= 0) return 'no_crystal'
  const char = slot.roster.find(r => r.id === characterId)
  if (!char) return 'char_not_found'
  const maxScore = STAT_LEVEL_MAX_SCORES[Math.min(5, slot.playerLevel)]
  const statSpin = char.spins.find(r => r.category === stat)
  if (statSpin?.score !== undefined && statSpin.score >= maxScore) return 'at_cap'
  const boost = STAT_CRYSTAL_BOOST[type]
  const newSpins = char.spins.map(r => r.category === stat ? boostSpin(r, boost) : r)
  const { overallScore, overallTier } = recomputeOverall(newSpins)
  return {
    ...slot,
    inventory: {
      ...slot.inventory,
      statCrystals: { ...slot.inventory.statCrystals, [type]: slot.inventory.statCrystals[type] - 1 },
    },
    roster: slot.roster.map(r =>
      r.id === characterId
        ? { ...r, spins: newSpins, overallScore, overallTier }
        : r
    ),
  }
}

/** Equips an opened item to a roster character, appending it to the character's equipped list. */
export function equipOpenedItem(
  slot: StorySaveSlot,
  characterId: string,
  itemId: string,
  type: 'weapon' | 'armor' | 'power',
): StorySaveSlot | 'no_item' | 'char_not_found' {
  const listKey = type === 'weapon' ? 'openedWeapons' : type === 'armor' ? 'openedArmors' : 'openedPowers'
  const list = slot.inventory[listKey] as OpenedItem[]
  const item = list.find(i => i.id === itemId)
  if (!item) return 'no_item'
  if (!slot.roster.some(r => r.id === characterId)) return 'char_not_found'
  const equippedField = type === 'weapon' ? 'equippedWeapons' : type === 'armor' ? 'equippedArmors' : 'equippedPowers'
  const equippedItem: EquippedItem = { id: item.id, grade: item.grade, name: item.name }
  return {
    ...slot,
    inventory: { ...slot.inventory, [listKey]: list.filter(i => i.id !== itemId) },
    roster: slot.roster.map(r =>
      r.id === characterId
        ? { ...r, [equippedField]: [...(r[equippedField] ?? []), equippedItem] }
        : r
    ),
  }
}
