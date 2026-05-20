// Story Mode save slot system — 4 isolated save slots, each with its own
// roster, gems, shards, world progression, spin credits, inventory, and daily shop limits.
// Keys are story_slot_1 … story_slot_4; never overlaps the legacy story_roster/story_shards keys.

import type { StoryRosterEntry } from './types'
import type { WorldGrade } from './worlds'
import { WORLD_GRADES, BATTLES_PER_WORLD, getPlayerLevelFromWorlds } from './worlds'

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

export type StatCrystalType = 'common' | 'elite' | 'legendary'
export type CrystalGrade = 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S' | 'SS' | 'SSS' | 'God'

export interface GradedCrystalCounts {
  F: number; E: number; D: number; C: number; B: number
  A: number; S: number; SS: number; SSS: number; God: number
}

function freshGradedCrystals(): GradedCrystalCounts {
  return { F: 0, E: 0, D: 0, C: 0, B: 0, A: 0, S: 0, SS: 0, SSS: 0, God: 0 }
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
}

/** Per-world battle progress. */
export interface WorldProgress {
  battlesCompleted: number   // 0–20
  beaten: boolean            // true once battle 20 is won
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
  /** Maximum characters allowed in roster. Starts at INITIAL_ROSTER_CAPACITY. */
  rosterCapacity: number
  /** How many times the roster has been upgraded (for cost scaling). */
  rosterUpgradeCount: number
  gems: number
  shards: number
  spinsRemaining: number
  /** ISO timestamp of last spin refresh check. Used to award spins every 3 hours. */
  spinsLastRefreshedAt: string
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
    powerCrystals: freshGradedCrystals(),
    weaponCrystals: freshGradedCrystals(),
    armorCrystals: freshGradedCrystals(),
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
    rosterCapacity: INITIAL_ROSTER_CAPACITY,
    rosterUpgradeCount: 0,
    gems: 0,
    shards: 0,
    spinsRemaining: INITIAL_SPIN_CREDITS,
    spinsLastRefreshedAt: new Date().toISOString(),
    inventory: freshInventory(),
    dailyCrystalPurchases: freshDailyPurchases(),
    createdAt: new Date().toISOString(),
    lastPlayedAt: new Date().toISOString(),
  }
}

/** Merges missing inventory fields so old saves missing graded crystals still work. */
function migrateInventory(raw: Partial<StoryInventory>): StoryInventory {
  return {
    statCrystals: raw.statCrystals ?? { common: 0, elite: 0, legendary: 0 },
    powerCrystals: raw.powerCrystals ?? freshGradedCrystals(),
    weaponCrystals: raw.weaponCrystals ?? freshGradedCrystals(),
    armorCrystals: raw.armorCrystals ?? freshGradedCrystals(),
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
    spinsLastRefreshedAt: raw.spinsLastRefreshedAt ?? new Date().toISOString(),
    inventory: migrateInventory(raw.inventory ?? {}),
    dailyCrystalPurchases: raw.dailyCrystalPurchases ?? freshDailyPurchases(),
    // Migrate roster entries to add xp/level/statBonuses if missing
    roster: (raw.roster ?? []).map(r => ({
      ...r,
      level: r.level ?? 1,
      xp: r.xp ?? 0,
      statBonuses: r.statBonuses ?? {},
    })),
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
  const roster = [{ ...entry, level: entry.level ?? 1, xp: entry.xp ?? 0, statBonuses: entry.statBonuses ?? {} }, ...slot.roster]
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

/** Sells a character from a slot's roster, crediting shards. */
export function sellCharacterFromSlot(
  slot: StorySaveSlot,
  characterId: string,
  shardValue: number,
): StorySaveSlot {
  return {
    ...slot,
    roster: slot.roster.filter(r => r.id !== characterId),
    shards: slot.shards + shardValue,
  }
}

/** Purchases spin credits using shards. Returns updated slot or null if insufficient shards. */
export const SHARD_COST_PER_SPIN = 100
export function purchaseSpin(slot: StorySaveSlot): StorySaveSlot | null {
  if (slot.shards < SHARD_COST_PER_SPIN) return null
  return { ...slot, shards: slot.shards - SHARD_COST_PER_SPIN, spinsRemaining: slot.spinsRemaining + 1 }
}

/** Consumes one spin credit. Returns updated slot or null if no credits remaining. */
export function consumeSpin(slot: StorySaveSlot): StorySaveSlot | null {
  if (slot.spinsRemaining <= 0) return null
  return { ...slot, spinsRemaining: slot.spinsRemaining - 1 }
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

  return { ...slot, worldProgress, playerLevel, stage }
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
  const inventory = { ...slot.inventory }

  for (const drop of drops.chanceDrops) {
    if (drop === 'fateShard') {
      shards++
    } else if (drop === 'statCrystal') {
      inventory.statCrystals = { ...inventory.statCrystals, common: inventory.statCrystals.common + 1 }
    } else if (drop === 'powerCrystal') {
      inventory.powerCrystals = { ...inventory.powerCrystals, F: inventory.powerCrystals.F + 1 }
    } else if (drop === 'weaponCrystal') {
      inventory.weaponCrystals = { ...inventory.weaponCrystals, F: inventory.weaponCrystals.F + 1 }
    } else if (drop === 'armorCrystal') {
      inventory.armorCrystals = { ...inventory.armorCrystals, F: inventory.armorCrystals.F + 1 }
    }
  }

  return { ...slot, gems: slot.gems + drops.gems, shards, inventory }
}

/** Adds XP to a character in the roster. Returns updated slot. */
export function addCharacterXp(slot: StorySaveSlot, characterId: string, xp: number): StorySaveSlot {
  const roster = slot.roster.map(r => {
    if (r.id !== characterId) return r
    const newXp = r.xp + xp
    const newLevel = Math.floor(1 + Math.sqrt(newXp / 50))
    return { ...r, xp: newXp, level: newLevel }
  })
  return { ...slot, roster }
}
