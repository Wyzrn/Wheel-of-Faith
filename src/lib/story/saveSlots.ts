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

// Stage = playerLevel + 1 (index 0 = L0 ... index 8 = L8). Race caps by level:
// L0 Common · L1 Uncommon · L2 Rare · L3 Legendary · L5 Mythological · L7 Divine.
export const STAGE_LABELS = ['Common', 'Uncommon', 'Rare', 'Legendary', 'Legendary', 'Mythological', 'Mythological', 'Divine', 'Divine'] as const

/** Minimum race weight allowed at each stage (index 0 = stage 1 / L0).
 *  Per-race weights after the rebalance: Common 10 · Uncommon 9 · Rare 8 ·
 *  Legendary 5 · Mythological 4 · Divine 2. The progression unlocks one
 *  rarity tier per stage; Legendary/Mythological/Divine each take two stages
 *  (the duplicates in STAGE_LABELS) so the late-game pacing is gradual. */
export const STAGE_MIN_WEIGHTS = [10, 9, 8, 5, 5, 4, 4, 2, 2] as const

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
  common:    10,
  elite:      5,
  legendary:  3,
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

/** Gems earned when selling one power/weapon/armor crystal of each grade (~10% of buy price). */
export const CRYSTAL_SELL_PRICES: Record<CrystalGrade, number> = {
  F:        500,
  E:      1_200,
  D:      3_000,
  C:      7_500,
  B:     20_000,
  A:     50_000,
  S:    150_000,
  SS:   500_000,
  SSS: 1_500_000,
  God: 5_000_000,
}

/** Gems earned when selling one stat crystal of each type (~10% of buy price). */
export const STAT_CRYSTAL_SELL_PRICES: Record<StatCrystalType, number> = {
  common:     1_000,
  elite:     10_000,
  legendary: 100_000,
}

/** Fate Shard cost to buy one stat crystal (alternative to gems). No daily limit for shard purchases. */
export const STAT_CRYSTAL_SHARD_COSTS: Record<StatCrystalType, number> = {
  common:     50,
  elite:     500,
  legendary: 1_000,
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
  [key: string]: number
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

/** Restarts a beaten world from battle 1 for replay. Preserves the `beaten`
 *  flag so unlocking of subsequent worlds is never affected — once a world
 *  is unlocked it stays unlocked. Clears `lastReplayedAt` so the replay
 *  cooldown timer is refreshed (player can attempt freely). Roster HP and
 *  per-character power cooldowns are battle-local and reset automatically
 *  by the controller — nothing to clear here. */
export function recordWorldReplayStart(slot: StorySaveSlot, world: WorldGrade): StorySaveSlot {
  const prev = slot.worldProgress[world]
  if (!prev?.beaten) return slot
  return {
    ...slot,
    worldProgress: {
      ...slot.worldProgress,
      [world]: { ...prev, battlesCompleted: 0, lastReplayedAt: undefined },
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
  /** Paragon Spins (8× luck + 8× battle stats). Unlocked at player level 6.
   *  ~3× rarer than Legend spins on drop tables; cost 2500 shards. */
  paragonSpins: number
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
  /** In-progress Endless run — set while a run is active so the player
   *  can quit mid-battle and resume later (or exit and claim). Cleared
   *  when the run ends (game over / final claim). null = no active run. */
  endlessRun?: EndlessRunState | null
  /** Per-world battle milestones (5, 10, 15, 20) already awarded — prevents re-awarding on replay. */
  milestonesAwarded: Partial<Record<WorldGrade, number[]>>
  /** Absolute+ run milestones awarded in the current run — resets to [] when a run completes. */
  absolutePlusMilestonesAwarded: number[]
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

/** Returns the spin stage (1–9) for the wheel filter, derived from playerLevel.
 *  Stage = playerLevel + 1 so stage 1 = L0, stage 9 = L8 (no cap). The wheel
 *  filter indexes STAGE_MAX_STAT_SCORES with stage - 1. */
export function getStageForPlayerLevel(playerLevel: number): number {
  return Math.max(1, Math.min(9, playerLevel + 1))
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
    paragonSpins: 0,
    spinsLastRefreshedAt: new Date().toISOString(),
    endlessKeys: 0,
    absolutePlusCompleted: 0,
    absolutePlusBattles: 0,
    endlessHighestWave: 0,
    endlessRun: null,
    milestonesAwarded: {},
    absolutePlusMilestonesAwarded: [],
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
    paragonSpins: raw.paragonSpins ?? 0,
    spinsLastRefreshedAt: raw.spinsLastRefreshedAt ?? new Date().toISOString(),
    inventory: migrateInventory(raw.inventory ?? {}),
    dailyCrystalPurchases: raw.dailyCrystalPurchases ?? freshDailyPurchases(),
    endlessKeys: raw.endlessKeys ?? 0,
    absolutePlusCompleted: raw.absolutePlusCompleted ?? 0,
    absolutePlusBattles: raw.absolutePlusBattles ?? 0,
    endlessHighestWave: raw.endlessHighestWave ?? 0,
    milestonesAwarded: (() => {
      const base = raw.milestonesAwarded ?? {}
      const result: Partial<Record<WorldGrade, number[]>> = { ...base }
      // For beaten worlds with incomplete milestone tracking, mark all as awarded
      for (const [world, prog] of Object.entries(raw.worldProgress ?? {})) {
        if (prog?.beaten) {
          const existing = result[world as WorldGrade] ?? []
          const all = [5, 10, 15, 20]
          if (!all.every(m => existing.includes(m))) {
            result[world as WorldGrade] = [...new Set([...existing, ...all])]
          }
        }
      }
      return result
    })(),
    absolutePlusMilestonesAwarded: raw.absolutePlusMilestonesAwarded ?? [],
    teams: raw.teams ?? [],
    // Migrate roster entries — add missing fields and burn any accumulated statBonuses into spins
    roster: (raw.roster ?? []).map(r => {
      const base = {
        ...r,
        level: Math.min(100, r.level ?? 1),
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
export function applySpinRefresh(slot: StorySaveSlot, maxSpins = MAX_DAILY_SPINS): StorySaveSlot {
  const now = Date.now()
  const last = new Date(slot.spinsLastRefreshedAt).getTime()
  const intervals = Math.floor((now - last) / SPIN_REFRESH_INTERVAL_MS)
  if (intervals <= 0) return slot
  const newSpins = Math.min(slot.spinsRemaining + intervals, maxSpins)
  const newRefreshTime = new Date(last + intervals * SPIN_REFRESH_INTERVAL_MS).toISOString()
  return { ...slot, spinsRemaining: newSpins, spinsLastRefreshedAt: newRefreshTime }
}

/** Returns milliseconds until the next spin refresh (0 if spins already at max). */
export function msUntilNextRefresh(slot: StorySaveSlot, maxSpins = MAX_DAILY_SPINS): number {
  if (slot.spinsRemaining >= maxSpins) return 0
  const last = new Date(slot.spinsLastRefreshedAt).getTime()
  const nextRefresh = last + SPIN_REFRESH_INTERVAL_MS
  return Math.max(0, nextRefresh - Date.now())
}

// ── Gamepass-aware helpers ─────────────────────────────────────────────────────

/** Effective max daily spins — doubled with daily_booster gamepass. */
export function getEffectiveMaxSpins(gamepasses: string[]): number {
  return gamepasses.includes('daily_booster') ? MAX_DAILY_SPINS * 2 : MAX_DAILY_SPINS
}

/** Effective roster capacity — +25 per expanded_roster purchase. */
export function getEffectiveRosterCapacity(slot: StorySaveSlot, gamepasses: string[]): number {
  const bonus = gamepasses.filter(g => g === 'expanded_roster').length * 25
  return slot.rosterCapacity + bonus
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

// ── Fuse ───────────────────────────────────────────────────────────────────
// Player level 6+ feature. Combines two roster characters into one — the
// baseplate keeps its identity (name, race, archetype, equipment) and each
// stat takes the maximum score across both characters. The non-baseplate
// character is consumed. Very expensive — costs 3× the higher gem value
// of the pair, paid in gems.

export const FUSE_PLAYER_LEVEL_REQUIRED = 6

const FUSE_STAT_CATEGORIES = [
  'strength','speed','agility','durability','iq','charisma','fightingSkill',
  'powerMastery','weaponMastery','armorStrength','potential','energyLevel',
] as const

/** Gem cost to fuse two characters — proportional to the higher gem value
 *  of the pair, scaled up so fusing is genuinely a late-game commitment. */
export function getFuseCost(baseValue: number, donorValue: number): number {
  return Math.ceil(Math.max(baseValue, donorValue) * 3)
}

export interface FuseResult {
  /** Final per-stat score (max across the two characters). */
  fusedScores: Record<string, number>
  /** Which character (base/donor) contributed each stat — for UI preview. */
  sources: Record<string, 'base' | 'donor' | 'tie'>
}

/** Computes the would-be fused stat block + source map without mutating
 *  anything. Lets the modal show a preview before the player confirms. */
export function previewFuse(base: StoryRosterEntry, donor: StoryRosterEntry): FuseResult {
  const fusedScores: Record<string, number> = {}
  const sources: Record<string, 'base' | 'donor' | 'tie'> = {}
  for (const cat of FUSE_STAT_CATEGORIES) {
    const baseScore  = base.spins.find(r => r.category === cat)?.score ?? 0
    const donorScore = donor.spins.find(r => r.category === cat)?.score ?? 0
    fusedScores[cat] = Math.max(baseScore, donorScore)
    sources[cat] = baseScore > donorScore ? 'base' : donorScore > baseScore ? 'donor' : 'tie'
  }
  return { fusedScores, sources }
}

/** Executes the fuse. The baseplate is replaced with a fused version; the
 *  donor is removed from the roster; gems are debited. */
export function fuseCharactersInSlot(
  slot: StorySaveSlot,
  baseId: string,
  donorId: string,
  baseGemValue: number,
  donorGemValue: number,
): { slot: StorySaveSlot; result: FuseResult } | 'locked' | 'insufficient_gems' | 'char_not_found' | 'same_char' {
  if (slot.playerLevel < FUSE_PLAYER_LEVEL_REQUIRED) return 'locked'
  if (baseId === donorId) return 'same_char'
  const base  = slot.roster.find(r => r.id === baseId)
  const donor = slot.roster.find(r => r.id === donorId)
  if (!base || !donor) return 'char_not_found'
  const cost = getFuseCost(baseGemValue, donorGemValue)
  if (slot.gems < cost) return 'insufficient_gems'

  const { fusedScores, sources } = previewFuse(base, donor)

  // Apply the max-of-two scores into the baseplate's spins. Recompute the
  // tier label from the new score so the displayed grade lands on the new
  // ladder (Cosmic / Immortal / etc.) without a separate migration.
  const newSpins = base.spins.map(r => {
    if (r.category in fusedScores) {
      const newScore = fusedScores[r.category]
      return { ...r, score: newScore, tier: scoreTier(newScore) }
    }
    return r
  })
  const { overallScore, overallTier } = recomputeOverall(newSpins)
  const fusedBase: StoryRosterEntry = { ...base, spins: newSpins, overallScore, overallTier }

  return {
    slot: {
      ...slot,
      gems: slot.gems - cost,
      roster: slot.roster
        .filter(r => r.id !== donorId)
        .map(r => r.id === baseId ? fusedBase : r),
    },
    result: { fusedScores, sources },
  }
}

// ── Dismantle ──────────────────────────────────────────────────────────────
// Player level 4+ feature. Spends gems (~half of sell value) to break a
// character into stat crystals + a chance roll on each equipped weapon /
// armor / power going to inventory. Stat crystal tier banding:
//   F-SS       → common  (T1)
//   SSS-Cosmic → elite   (T2)
//   Immortal+  → legendary (T3)
// Per-stat crystal chance scales with the character's tier-rank position in
// the relevant band (1%/stat at the band floor, ~50%/stat at the highest
// band's ceiling). Equipped items each roll independently at ~30%.

export const DISMANTLE_PLAYER_LEVEL_REQUIRED = 4

/** Tier-rank index → which stat-crystal type the dismantle yields. */
function dismantleCrystalType(tierIdx: number): StatCrystalType {
  // Tier ladder positions: F-: 0 ... SS+: 23, SSS-: 24 ... Cosmic+: 38,
  // Immortal-: 39 ... Infinite+: 59. Indices come from TIER_THRESHOLDS.
  if (tierIdx <= 23) return 'common'      // F- through SS+
  if (tierIdx <= 38) return 'elite'       // SSS- through Cosmic+
  return 'legendary'                       // Immortal- and above
}

/** Per-stat probability of getting a crystal — anchored at 1%/5% for F/SS,
 *  then climbs to ~16% by Cosmic+ and ~50% by Infinite+. */
function dismantleStatChance(tierIdx: number): number {
  // Common band: 1% at F-, 5% at SS+
  if (tierIdx <= 23) return 0.01 + (tierIdx / 23) * 0.04
  // Elite band: 6% at SSS-, 16% at Cosmic+
  if (tierIdx <= 38) return 0.06 + ((tierIdx - 24) / 14) * 0.10
  // Legendary band: 18% at Immortal-, 50% at Infinite+
  return 0.18 + ((tierIdx - 39) / 20) * 0.32
}

/** Gem cost to dismantle — half of the sell value, rounded up. */
export function getDismantleCost(gemSellValue: number): number {
  return Math.ceil(gemSellValue * 0.5)
}

/** Probability an equipped item is recovered into the inventory. */
const DISMANTLE_ITEM_RECOVER_CHANCE = 0.30

/** Result of a dismantle — exposed so the modal can show what dropped. */
export interface DismantleResult {
  crystalsByStat: Record<string, StatCrystalType>  // statCategory -> crystal type rolled
  recoveredWeapons: string[]                       // item ids
  recoveredArmors: string[]
  recoveredPowers: string[]
}

/** Dismantles a character. Subtracts gems, removes them from the roster,
 *  adds rolled crystals + recovered equipment to inventory. */
export function dismantleCharacterFromSlot(
  slot: StorySaveSlot,
  characterId: string,
  gemSellValue: number,
  tierIdx: number,
  randFn: () => number = Math.random,
): { slot: StorySaveSlot; result: DismantleResult } | 'insufficient_gems' | 'char_not_found' | 'locked' {
  if (slot.playerLevel < DISMANTLE_PLAYER_LEVEL_REQUIRED) return 'locked'
  const cost = getDismantleCost(gemSellValue)
  if (slot.gems < cost) return 'insufficient_gems'
  const char = slot.roster.find(r => r.id === characterId)
  if (!char) return 'char_not_found'

  const crystalType = dismantleCrystalType(tierIdx)
  const pStat = dismantleStatChance(tierIdx)

  // Per-stat roll across the character's spun stats. Each successful roll
  // yields one crystal of the band's type.
  const STATS = ['strength','speed','agility','durability','iq','charisma','fightingSkill','powerMastery','weaponMastery','armorStrength','potential','energyLevel']
  const crystalsByStat: Record<string, StatCrystalType> = {}
  let gainedCrystals = 0
  for (const s of STATS) {
    const hasStat = char.spins.some(r => r.category === s)
    if (!hasStat) continue
    if (randFn() < pStat) {
      crystalsByStat[s] = crystalType
      gainedCrystals++
    }
  }

  // Equipped-item recovery — each piece rolls independently.
  const recoveredWeapons: string[] = []
  const recoveredArmors: string[] = []
  const recoveredPowers: string[] = []
  for (const w of char.equippedWeapons ?? []) {
    if (randFn() < DISMANTLE_ITEM_RECOVER_CHANCE) recoveredWeapons.push(w.id)
  }
  for (const a of char.equippedArmors ?? []) {
    if (randFn() < DISMANTLE_ITEM_RECOVER_CHANCE) recoveredArmors.push(a.id)
  }
  for (const p of char.equippedPowers ?? []) {
    if (randFn() < DISMANTLE_ITEM_RECOVER_CHANCE) recoveredPowers.push(p.id)
  }

  // Build new inventory: add crystals, append recovered opened items.
  const inv = { ...slot.inventory }
  if (gainedCrystals > 0) {
    inv.statCrystals = {
      ...inv.statCrystals,
      [crystalType]: inv.statCrystals[crystalType] + gainedCrystals,
    }
  }
  // Recovered equipment goes back to the opened-item pools as proper
  // OpenedItem records (id / grade / name). The character's
  // equippedWeapons / equippedArmors / equippedPowers shape already matches.
  const recover = (list: { id: string; grade: string; name: string }[], ids: string[]): OpenedItem[] =>
    list.filter(i => ids.includes(i.id)).map(i => ({ id: i.id, grade: i.grade as CrystalGrade, name: i.name }))
  if (recoveredWeapons.length) inv.openedWeapons = [...(inv.openedWeapons ?? []), ...recover(char.equippedWeapons ?? [], recoveredWeapons)]
  if (recoveredArmors.length)  inv.openedArmors  = [...(inv.openedArmors  ?? []), ...recover(char.equippedArmors  ?? [], recoveredArmors)]
  if (recoveredPowers.length)  inv.openedPowers  = [...(inv.openedPowers  ?? []), ...recover(char.equippedPowers  ?? [], recoveredPowers)]

  return {
    slot: {
      ...slot,
      gems: slot.gems - cost,
      roster: slot.roster.filter(r => r.id !== characterId),
      inventory: inv,
    },
    result: { crystalsByStat, recoveredWeapons, recoveredArmors, recoveredPowers },
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

/** Gems earned for selling one bonus spin. */
export const BONUS_SPIN_SELL_PRICE = 100

/**
 * Sells one or more bonus spins for gems.
 * Returns updated slot or 'insufficient_spins' if fewer than count are owned.
 */
export function sellBonusSpins(
  slot: StorySaveSlot,
  count: number,
): StorySaveSlot | 'insufficient_spins' {
  if ((slot.bonusSpins ?? 0) < count) return 'insufficient_spins'
  return {
    ...slot,
    bonusSpins: slot.bonusSpins - count,
    gems: slot.gems + BONUS_SPIN_SELL_PRICE * count,
  }
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
  // `beaten` is sticky — once a world is beaten it stays beaten, even
  // during a fresh replay run where battlesCompleted has been reset to 0.
  // Replays must NEVER relock the world above; this preserves the unlock.
  const beaten = prev.beaten || battlesCompleted >= BATTLES_PER_WORLD
  const worldProgress = { ...slot.worldProgress, [world]: { battlesCompleted, beaten } }

  const beatenSet = new Set<WorldGrade>(
    (WORLD_GRADES as readonly WorldGrade[]).filter(g => worldProgress[g]?.beaten)
  )
  const playerLevel = getPlayerLevelFromWorlds(beatenSet)
  const stage = getStageForPlayerLevel(playerLevel)

  // Award 2 bonus spins at milestones 5, 10, 15, 20 — each milestone awarded only once per world
  const prevCompleted = prev.battlesCompleted
  const worldMilestones = [...(slot.milestonesAwarded?.[world] ?? [])]
  let bonusSpins = slot.bonusSpins
  for (const milestone of [5, 10, 15, 20]) {
    if (battlesCompleted >= milestone && prevCompleted < milestone && !worldMilestones.includes(milestone)) {
      bonusSpins += 2
      worldMilestones.push(milestone)
    }
  }
  const milestonesAwarded = { ...(slot.milestonesAwarded ?? {}), [world]: worldMilestones }

  return { ...slot, worldProgress, playerLevel, stage, bonusSpins, milestonesAwarded }
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
export function applyBattleDrops(slot: StorySaveSlot, drops: BattleDrops, gamepasses: string[] = []): StorySaveSlot {
  let shards = slot.shards
  let endlessKeys = slot.endlessKeys
  let bonusSpins = slot.bonusSpins
  const inventory = { ...slot.inventory }
  const shardMultiplier = gamepasses.includes('double_shard_drop') ? 2 : 1

  let heroSpins = slot.heroSpins ?? 0
  let legendSpins = slot.legendSpins ?? 0
  let paragonSpins = slot.paragonSpins ?? 0

  for (const drop of drops.chanceDrops) {
    if (drop === 'fateShard') {
      shards += shardMultiplier
    } else if (drop === 'endlessKey') {
      endlessKeys++
    } else if (drop === 'spin') {
      bonusSpins++
    } else if (drop === 'heroSpin') {
      heroSpins++
    } else if (drop === 'legendSpin') {
      legendSpins++
    } else if (drop === 'paragonSpin') {
      paragonSpins++
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

  return { ...slot, gems: slot.gems + drops.gems, shards, endlessKeys, bonusSpins, heroSpins, legendSpins, paragonSpins, inventory }
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
): StorySaveSlot | 'insufficient_shards' {
  const cost = STAT_CRYSTAL_SHARD_COSTS[type]
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
    // Any final claim / game over also clears the in-progress run so the
    // resume prompt doesn't re-offer a run that's already been cashed out.
    endlessRun: null,
  }
  updated = applyBattleDrops(updated, drops)
  if (teamCharIds.length > 0) updated = addTeamXp(updated, teamCharIds, drops.xp)
  return updated
}

/** Snapshot of an in-progress Endless run, persisted so the player can
 *  quit mid-battle and resume later. The resumable checkpoint is the
 *  START of a wave — accumulated drops + wave count + per-member HP are
 *  captured at each wave boundary. Resuming re-fights the current wave
 *  fresh from these values; no enemy mid-wave state is stored. */
export interface EndlessRunState {
  teamId: string
  currentWave: number
  wavesCleared: number
  accGems: number
  accXp: number
  accChanceDrops: string[]
  teamHp: number[]
  startedAt: string
}

/** Persists the in-progress Endless run onto the slot. */
export function saveEndlessRun(slot: StorySaveSlot, run: EndlessRunState): StorySaveSlot {
  return { ...slot, endlessRun: run }
}

/** Clears the in-progress Endless run (run ended / abandoned / claimed). */
export function clearEndlessRun(slot: StorySaveSlot): StorySaveSlot {
  return { ...slot, endlessRun: null }
}

/**
 * Records a won battle in the current Absolute+ run.
 * When all 20 battles are cleared the run counter increments and battle progress resets.
 * Awards milestone bonus spins every 5 battles, same as regular worlds.
 */
export function recordAbsolutePlusWin(slot: StorySaveSlot): StorySaveSlot {
  const prev = slot.absolutePlusBattles ?? 0
  const battles = prev + 1
  const awarded = [...(slot.absolutePlusMilestonesAwarded ?? [])]
  let bonusSpins = slot.bonusSpins
  for (const milestone of [5, 10, 15, 20]) {
    if (battles >= milestone && prev < milestone && !awarded.includes(milestone)) {
      bonusSpins += 2
      awarded.push(milestone)
    }
  }

  if (battles >= BATTLES_PER_WORLD) {
    return {
      ...slot,
      absolutePlusCompleted: Math.min(MAX_ABSOLUTE_PLUS, (slot.absolutePlusCompleted ?? 0) + 1),
      absolutePlusBattles: 0,
      bonusSpins,
      absolutePlusMilestonesAwarded: [],  // reset milestones for next run
    }
  }
  return { ...slot, absolutePlusBattles: battles, bonusSpins, absolutePlusMilestonesAwarded: awarded }
}

/** Consumes one Endless Key. Returns null if none remaining. */
export function consumeEndlessKey(slot: StorySaveSlot): StorySaveSlot | null {
  if (slot.endlessKeys <= 0) return null
  return { ...slot, endlessKeys: slot.endlessKeys - 1 }
}

/** Cost in gems to buy one Endless Key from the shop (available at player level 3+). */
export const ENDLESS_KEY_GEM_COST = 50_000

/** Fate Shard cost for one Hero Spin (unlocked at player level 2). 2× luck boost + 2× stat multiplier in battle. */
export const HERO_SPIN_SHARD_COST = 100

/** Fate Shard cost for one Legend Spin (unlocked at player level 4). 4× luck boost + 4× stat multiplier in battle. */
export const LEGEND_SPIN_SHARD_COST = 500

/** Fate Shard cost for one Paragon Spin (unlocked at player level 6). 8× luck boost + 8× stat multiplier in battle.
 *  ~3× rarer than Legend on drop tables — the jackpot tier of premium spins. */
export const PARAGON_SPIN_SHARD_COST = 2500

/** Purchases one Endless Key. Returns updated slot or 'insufficient_gems'. */
export function buyEndlessKey(slot: StorySaveSlot): StorySaveSlot | 'insufficient_gems' {
  if (slot.gems < ENDLESS_KEY_GEM_COST) return 'insufficient_gems'
  return { ...slot, gems: slot.gems - ENDLESS_KEY_GEM_COST, endlessKeys: slot.endlessKeys + 1 }
}

/** Purchases one Hero Spin. Returns updated slot or 'insufficient_shards' / 'locked'. */
export function buyHeroSpin(slot: StorySaveSlot): StorySaveSlot | 'insufficient_shards' | 'locked' {
  if (slot.playerLevel < 2) return 'locked'
  if ((slot.shards ?? 0) < HERO_SPIN_SHARD_COST) return 'insufficient_shards'
  return { ...slot, shards: (slot.shards ?? 0) - HERO_SPIN_SHARD_COST, heroSpins: (slot.heroSpins ?? 0) + 1 }
}

/** Purchases one Legend Spin. Returns updated slot or 'insufficient_shards' / 'locked'. */
export function buyLegendSpin(slot: StorySaveSlot): StorySaveSlot | 'insufficient_shards' | 'locked' {
  if (slot.playerLevel < 4) return 'locked'
  if ((slot.shards ?? 0) < LEGEND_SPIN_SHARD_COST) return 'insufficient_shards'
  return { ...slot, shards: (slot.shards ?? 0) - LEGEND_SPIN_SHARD_COST, legendSpins: (slot.legendSpins ?? 0) + 1 }
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

/** Purchases one Paragon Spin. Returns updated slot or 'insufficient_shards' / 'locked'. */
export function buyParagonSpin(slot: StorySaveSlot): StorySaveSlot | 'insufficient_shards' | 'locked' {
  if (slot.playerLevel < 6) return 'locked'
  if ((slot.shards ?? 0) < PARAGON_SPIN_SHARD_COST) return 'insufficient_shards'
  return { ...slot, shards: (slot.shards ?? 0) - PARAGON_SPIN_SHARD_COST, paragonSpins: (slot.paragonSpins ?? 0) + 1 }
}

/** Consumes one Paragon Spin. Returns updated slot or null if none remaining. */
export function consumeParagonSpin(slot: StorySaveSlot): StorySaveSlot | null {
  if ((slot.paragonSpins ?? 0) <= 0) return null
  return { ...slot, paragonSpins: (slot.paragonSpins ?? 0) - 1 }
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

export const MAX_CHARACTER_LEVEL = 100

/** Adds XP to a character. Each level grants +1% power boost (applied in battle). Level cap: 100. */
export function addCharacterXp(slot: StorySaveSlot, characterId: string, xp: number): StorySaveSlot {
  const roster = slot.roster.map(r => {
    if (r.id !== characterId) return r
    const newXp = r.xp + xp
    const newLevel = Math.min(MAX_CHARACTER_LEVEL, Math.floor(1 + Math.sqrt(newXp / 200)))
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
 * always cross the next boundary. Clears displayLabel (all TIER_THRESHOLDS entries ≤ 165).
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

// Max stat score per player level (index = playerLevel). Mirrors
// StorySpinView STAGE_MAX_STAT_SCORES. Caps scale through the new post-mortal
// ladder: L3 = ZZ-, L4 = Cosmic-, L5 = Celestial-, L6 = Primordial-,
// L7 = Transcendent-, L8 = no cap.
//
// Exported so UI code (routes/story/+page.svelte clampStatQty) can preview
// the same cap that useStatCrystal enforces — keeps the "room left" hint and
// the actual apply in lockstep.
export const STAT_LEVEL_MAX_SCORES = [
  54,        // L0 — ~F+/E-
  92,        // L1 — SS-
  99,        // L2 — SSS+
  107,       // L3 — ZZ-
  119,       // L4 — Cosmic-
  131,       // L5 — Celestial-
  143,       // L6 — Primordial-
  155,       // L7 — Transcendent-
  Infinity,  // L8 — no cap (Infinite+ and overflow open)
] as const

// Score cap when the character isn't Limit Broken. Anchored to Absolute+ band
// (TIER_THRESHOLDS row 53 in scoreTier.ts) so non-broken crystal stacking can
// at most reach Absolute+, never Transcendent or Infinite.
const NON_BROKEN_STAT_CAP_SCORE = 153

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
  const stageCap = STAT_LEVEL_MAX_SCORES[Math.min(STAT_LEVEL_MAX_SCORES.length - 1, slot.playerLevel)]
  // Apply the non-broken Absolute+ cap unless the character has rolled
  // Limit Break — broken characters can stack crystals into Transcendent/
  // Infinite, everyone else stops at Absolute+ regardless of player level.
  const isLimitBroken = char.spins.some(r => r.category === 'limitBreakLevel')
  const maxScore = isLimitBroken ? stageCap : Math.min(stageCap, NON_BROKEN_STAT_CAP_SCORE)
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
// ── Quick-equip helper ──────────────────────────────────────────────────────
// Picks the single highest-grade opened item of each slot type (weapon / armor /
// power) and equips it to the target character. Already-equipped items are not
// re-equipped. Returns the new slot + a summary of what was equipped so the
// caller can show a meaningful toast ("Equipped 3 items: Mythril Blade [B], …").
export interface QuickEquipResult {
  slot: StorySaveSlot
  equipped: { type: 'weapon' | 'armor' | 'power'; name: string; grade: string }[]
}

export function quickEquipBestGear(
  slot: StorySaveSlot,
  characterId: string,
): QuickEquipResult | 'char_not_found' {
  const char = slot.roster.find(r => r.id === characterId)
  if (!char) return 'char_not_found'

  // Grade tier order — higher index = better. Keep in sync with content/elements.GRADE_ORDER.
  const GRADE_RANK: Record<string, number> = { F: 0, E: 1, D: 2, C: 3, B: 4, A: 5, S: 6, SS: 7, SSS: 8, God: 9 }
  const rankOf = (g: string): number => GRADE_RANK[g] ?? 0

  // Pull the single best opened item from each pool that isn't already equipped.
  function bestOf(
    pool: OpenedItem[],
    alreadyEquipped: { id: string }[] | undefined,
  ): OpenedItem | null {
    const equippedIds = new Set((alreadyEquipped ?? []).map(e => e.id))
    let best: OpenedItem | null = null
    for (const item of pool) {
      if (equippedIds.has(item.id)) continue
      if (!best || rankOf(item.grade) > rankOf(best.grade)) best = item
    }
    return best
  }

  const bestWeapon = bestOf(slot.inventory.openedWeapons, char.equippedWeapons)
  const bestArmor  = bestOf(slot.inventory.openedArmors,  char.equippedArmors)
  const bestPower  = bestOf(slot.inventory.openedPowers,  char.equippedPowers)

  if (!bestWeapon && !bestArmor && !bestPower) {
    // Hospitality: don't silently no-op. Surface this back to the UI so it
    // can toast "nothing better to equip" instead of just doing nothing.
    return { slot, equipped: [] }
  }

  // Fold each pick into the slot one at a time using the existing equip helper
  // (which handles immutable update + inventory removal correctly).
  let next: StorySaveSlot = slot
  const equipped: QuickEquipResult['equipped'] = []
  for (const [type, item] of [['weapon', bestWeapon], ['armor', bestArmor], ['power', bestPower]] as const) {
    if (!item) continue
    const result = equipOpenedItem(next, characterId, item.id, type)
    if (typeof result === 'string') continue
    next = result
    equipped.push({ type, name: item.name, grade: item.grade })
  }
  return { slot: next, equipped }
}

/** Gem refund for permanently removing an equipped item, keyed by the
 *  item's ItemGrade. Roughly 2× per grade — feels appropriate next to
 *  character sell values (1000s at low tiers, 100k+ at top tiers) and
 *  makes high-grade gear genuinely valuable to remove for currency. */
const ITEM_REMOVAL_GEM_REFUND: Record<string, number> = {
  F:    50,    E:    100,   D:    200,
  C:    400,   B:    800,   A:    1600,
  S:    3200,  SS:   6400,  SSS:  12800,
  God:  25600,
}
export function getItemRemovalRefund(grade: string | undefined): number {
  if (!grade) return ITEM_REMOVAL_GEM_REFUND.F
  // Strip any +/- modifiers (shouldn't appear on ItemGrade, but defensive).
  const base = grade.replace(/[-+]/g, '')
  return ITEM_REMOVAL_GEM_REFUND[base] ?? ITEM_REMOVAL_GEM_REFUND.F
}

/** Permanently destroys a single equipped item on a character and credits
 *  the player gems based on the item's grade. Unlike dismantle (which
 *  rolls a 30% chance to recover into inventory), this is a deterministic
 *  delete — the item is gone forever. */
export function removeEquippedItem(
  slot: StorySaveSlot,
  characterId: string,
  itemId: string,
  type: 'weapon' | 'armor' | 'power',
): { slot: StorySaveSlot; refundedGems: number } | 'char_not_found' | 'item_not_found' {
  const char = slot.roster.find(r => r.id === characterId)
  if (!char) return 'char_not_found'
  const field: 'equippedWeapons' | 'equippedArmors' | 'equippedPowers' =
    type === 'weapon' ? 'equippedWeapons' : type === 'armor' ? 'equippedArmors' : 'equippedPowers'
  const item = (char[field] ?? []).find(i => i.id === itemId)
  if (!item) return 'item_not_found'
  const refundedGems = getItemRemovalRefund(item.grade)
  return {
    slot: {
      ...slot,
      gems: slot.gems + refundedGems,
      roster: slot.roster.map(r =>
        r.id === characterId
          ? { ...r, [field]: (r[field] ?? []).filter(i => i.id !== itemId) }
          : r
      ),
    },
    refundedGems,
  }
}

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
