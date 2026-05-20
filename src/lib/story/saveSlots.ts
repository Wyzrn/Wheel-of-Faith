// Story Mode save slot system — 4 isolated save slots, each with its own
// roster, shards, stage progression, and spin credits.
// Keys are story_slot_1 … story_slot_4; never overlaps the legacy story_roster/story_shards keys.

import type { StoryRosterEntry } from './types'

export type SlotId = 1 | 2 | 3 | 4

/** Progression thresholds: roster size required to reach each stage. */
export const STAGE_ROSTER_THRESHOLDS = [0, 5, 15, 25, 35, 45] as const

/** Labels displayed in the hub for each stage. */
export const STAGE_LABELS = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Godlike'] as const

/** Minimum race weight allowed at each stage (index 0 = stage 1). */
export const STAGE_MIN_WEIGHTS = [12, 7, 5, 4, 2, 1] as const

/** Starting spin credits given to a brand-new save slot. */
export const INITIAL_SPIN_CREDITS = 3

export interface StorySaveSlot {
  id: SlotId
  stage: number           // 1–6
  roster: StoryRosterEntry[]
  shards: number
  spinsRemaining: number
  createdAt: string
  lastPlayedAt: string
}

function slotKey(id: SlotId): string {
  return `story_slot_${id}`
}

/**
 * Returns the stage (1–6) that a roster of `size` characters should be on.
 * Advances automatically as the roster grows.
 */
export function getStageForRosterSize(size: number): number {
  for (let i = STAGE_ROSTER_THRESHOLDS.length - 1; i >= 0; i--) {
    if (size >= STAGE_ROSTER_THRESHOLDS[i]) return i + 1
  }
  return 1
}

/** Creates a blank save slot (does not write to localStorage). */
export function createSaveSlot(id: SlotId): StorySaveSlot {
  return {
    id,
    stage: 1,
    roster: [],
    shards: 0,
    spinsRemaining: INITIAL_SPIN_CREDITS,
    createdAt: new Date().toISOString(),
    lastPlayedAt: new Date().toISOString(),
  }
}

/** Loads a save slot from localStorage. Returns null when empty or corrupted. */
export function loadSaveSlot(id: SlotId): StorySaveSlot | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(slotKey(id))
    if (!raw) return null
    return JSON.parse(raw) as StorySaveSlot
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
 * Adds a character to a slot's roster (max 50).
 * Advances stage based on new roster size.
 * Returns updated slot or null if roster is full.
 */
export function addCharacterToSlot(
  slot: StorySaveSlot,
  entry: StoryRosterEntry,
): StorySaveSlot | null {
  if (slot.roster.length >= 50) return null
  const roster = [entry, ...slot.roster]
  const stage = Math.max(slot.stage, getStageForRosterSize(roster.length))
  return { ...slot, roster, stage }
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
