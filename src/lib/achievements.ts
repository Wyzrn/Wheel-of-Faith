// Achievement system — local-first, evaluated against existing localStorage
// data (spin history, rivals counters via auth, story slot snapshots). No new
// server endpoints required — achievements are computed on-demand from data
// the client already has.
//
// Each achievement has:
//   id          — stable string used in storage
//   name        — display title
//   description — flavor + condition
//   icon        — material symbol name
//   color       — accent color
//   condition   — pure function returning {progress, threshold, met}
//   tier        — 'bronze' | 'silver' | 'gold' | 'mythic' (visual rarity)
//
// "Unlocked" is derived (condition.met) — not stored. We DO store the timestamp
// of first-unlock so we can show "new!" badges and award shards.
//
// Hospitality angle: a fresh unlock fires a celebration toast on the next page
// load that checks achievements (profile / hub) — players don't have to claim,
// they just see the reward arrive.

import { loadSpinHistory, type SpinHistoryEntry } from '$lib/spinHistory'
import { loadAllSlots, type StorySaveSlot } from '$lib/story/saveSlots'
import type { AuthUser } from '$lib/stores/auth.svelte'

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'mythic'

export interface AchievementCondition {
  progress: number
  threshold: number
  met: boolean
}

export interface AchievementDef {
  id: string
  name: string
  description: string
  icon: string
  tier: AchievementTier
  reward?: number  // shards awarded on first unlock (server-side credit happens
                   // via a future hook; for now we store the badge locally)
  evaluate: (ctx: AchievementContext) => AchievementCondition
}

export interface AchievementContext {
  spinHistory: SpinHistoryEntry[]
  rivalsWins:  number
  rivalsLosses: number
  slots: (StorySaveSlot | null)[]
  shards: number
  dailyStreak: number
  gamepasses: string[]
}

const TIER_COLORS: Record<AchievementTier, string> = {
  bronze: '#a16207',
  silver: '#94a3b8',
  gold:   '#f0c040',
  mythic: '#a78bfa',
}
export function colorForTier(t: AchievementTier): string { return TIER_COLORS[t] }

// Tier-comparable set helpers — share with profile's lifetime stats
const ELITE_TIERS = new Set([
  'S','S+','SS-','SS','SS+','SSS-','SSS','SSS+',
  'Z-','Z','Z+','ZZ-','ZZ','ZZ+','ZZZ-','ZZZ','ZZZ+',
  'Celestial-','Celestial','Celestial+','Godly-','Godly',
  'Primordial','Primordial+','Absolute-','Absolute','Absolute+',
])
const MYTHIC_TIERS = new Set([
  'SSS-','SSS','SSS+','Z-','Z','Z+','ZZ-','ZZ','ZZ+','ZZZ-','ZZZ','ZZZ+',
  'Celestial-','Celestial','Celestial+','Godly-','Godly',
  'Primordial','Primordial+','Absolute-','Absolute','Absolute+',
])
const GODLY_TIERS = new Set(['Godly-','Godly','Primordial','Primordial+','Absolute-','Absolute','Absolute+'])

function countMatching(history: SpinHistoryEntry[], pred: (e: SpinHistoryEntry) => boolean): number {
  let n = 0
  for (const e of history) if (pred(e)) n++
  return n
}

function uniqueRaces(history: SpinHistoryEntry[]): number {
  const s = new Set<string>()
  for (const e of history) s.add(e.race)
  return s.size
}

function thresholdCondition(progress: number, threshold: number): AchievementCondition {
  return { progress: Math.min(progress, threshold), threshold, met: progress >= threshold }
}

// ── The pool ─────────────────────────────────────────────────────────────────
// Ordered roughly by difficulty within each tier so the UI can show "next up"
// suggestions naturally.
export const ACHIEVEMENTS: AchievementDef[] = [
  // ── Bronze (easy onboarding) ───────────────────────────────────────────────
  { id: 'first_spin', name: 'First Fate', description: 'Complete your first character spin session.',
    icon: 'rotate_right', tier: 'bronze', reward: 25,
    evaluate: c => thresholdCondition(c.spinHistory.length, 1) },
  { id: 'first_win', name: 'Battle Initiate', description: 'Win your first Rivals battle.',
    icon: 'swords', tier: 'bronze', reward: 25,
    evaluate: c => thresholdCondition(c.rivalsWins, 1) },
  { id: 'first_save_slot', name: 'New Beginnings', description: 'Create a Story Mode save slot.',
    icon: 'bookmark_added', tier: 'bronze', reward: 25,
    evaluate: c => thresholdCondition(c.slots.filter(s => s !== null).length, 1) },
  { id: 'five_spins', name: 'Spinning Up', description: 'Complete 5 character spin sessions.',
    icon: 'cycle', tier: 'bronze', reward: 50,
    evaluate: c => thresholdCondition(c.spinHistory.length, 5) },

  // ── Silver (steady progression) ────────────────────────────────────────────
  { id: 'twenty_spins', name: 'Devoted Spinner', description: 'Complete 20 character spin sessions.',
    icon: 'all_inclusive', tier: 'silver', reward: 100,
    evaluate: c => thresholdCondition(c.spinHistory.length, 20) },
  { id: 'five_wins', name: 'Battle Hardened', description: 'Win 5 Rivals battles.',
    icon: 'military_tech', tier: 'silver', reward: 100,
    evaluate: c => thresholdCondition(c.rivalsWins, 5) },
  { id: 'first_a_tier', name: 'Touched by Fate', description: 'Roll an A-tier or higher character.',
    icon: 'auto_awesome', tier: 'silver', reward: 150,
    evaluate: c => thresholdCondition(
      countMatching(c.spinHistory, e => e.overallTier.startsWith('A') || ELITE_TIERS.has(e.overallTier)), 1) },
  { id: 'five_races', name: 'Multicultural', description: 'Roll characters of 5 different races.',
    icon: 'diversity_3', tier: 'silver', reward: 100,
    evaluate: c => thresholdCondition(uniqueRaces(c.spinHistory), 5) },
  { id: 'streak_3', name: '3-Day Streak', description: 'Log in 3 days in a row.',
    icon: 'local_fire_department', tier: 'silver', reward: 75,
    evaluate: c => thresholdCondition(c.dailyStreak, 3) },

  // ── Gold (real grind / chase) ──────────────────────────────────────────────
  { id: 'hundred_spins', name: 'Wheelweaver', description: 'Complete 100 character spin sessions.',
    icon: 'workspace_premium', tier: 'gold', reward: 250,
    evaluate: c => thresholdCondition(c.spinHistory.length, 100) },
  { id: 'twenty_wins', name: 'Arena Champion', description: 'Win 20 Rivals battles.',
    icon: 'emoji_events', tier: 'gold', reward: 300,
    evaluate: c => thresholdCondition(c.rivalsWins, 20) },
  { id: 'first_s_tier', name: 'Mythic Forging', description: 'Roll an S-tier or higher character.',
    icon: 'star', tier: 'gold', reward: 300,
    evaluate: c => thresholdCondition(countMatching(c.spinHistory, e => ELITE_TIERS.has(e.overallTier)), 1) },
  { id: 'streak_7', name: '7-Day Devotion', description: 'Log in 7 days in a row.',
    icon: 'whatshot', tier: 'gold', reward: 200,
    evaluate: c => thresholdCondition(c.dailyStreak, 7) },
  { id: 'all_slots', name: 'Multi-Saver', description: 'Create all 4 Story Mode save slots.',
    icon: 'bookmarks', tier: 'gold', reward: 200,
    evaluate: c => thresholdCondition(c.slots.filter(s => s !== null).length, 4) },

  // ── Mythic (rare achievement-hunter territory) ─────────────────────────────
  { id: 'sss_roll', name: 'Legend Born', description: 'Roll an SSS-tier or higher character.',
    icon: 'auto_awesome_mosaic', tier: 'mythic', reward: 500,
    evaluate: c => thresholdCondition(countMatching(c.spinHistory, e => MYTHIC_TIERS.has(e.overallTier)), 1) },
  { id: 'godly_roll', name: 'Divine Spark', description: 'Roll a Godly-tier or higher character.',
    icon: 'flare', tier: 'mythic', reward: 1000,
    evaluate: c => thresholdCondition(countMatching(c.spinHistory, e => GODLY_TIERS.has(e.overallTier)), 1) },
  { id: 'fifty_wins', name: 'Undefeated', description: 'Win 50 Rivals battles.',
    icon: 'military_tech', tier: 'mythic', reward: 750,
    evaluate: c => thresholdCondition(c.rivalsWins, 50) },
  { id: 'streak_30', name: 'Iron Will', description: 'Log in 30 days in a row.',
    icon: 'local_fire_department', tier: 'mythic', reward: 1000,
    evaluate: c => thresholdCondition(c.dailyStreak, 30) },
  { id: 'ten_races', name: 'Cosmopolitan', description: 'Roll characters of 10 different races.',
    icon: 'public', tier: 'mythic', reward: 500,
    evaluate: c => thresholdCondition(uniqueRaces(c.spinHistory), 10) },
  { id: 'gamepass_collector', name: 'Tithe Master', description: 'Own 5 different gamepasses.',
    icon: 'shopping_bag', tier: 'mythic', reward: 500,
    evaluate: c => thresholdCondition(new Set(c.gamepasses).size, 5) },

  // ── More bronze additions ──────────────────────────────────────────────────
  { id: 'three_classes', name: 'Class Sampler', description: 'Roll 3 different archetypes.',
    icon: 'category', tier: 'bronze', reward: 50,
    evaluate: c => thresholdCondition(new Set(c.spinHistory.map(e => e.archetype)).size, 3) },
  { id: 'first_d_tier', name: 'Adequate', description: 'Roll a D-tier character (you tried).',
    icon: 'thumb_up', tier: 'bronze', reward: 25,
    evaluate: c => thresholdCondition(countMatching(c.spinHistory, e => e.overallTier.startsWith('D')), 1) },
  { id: 'first_f_tier', name: 'Humbled by Fate', description: 'Roll an F-tier character — embrace it.',
    icon: 'sentiment_dissatisfied', tier: 'bronze', reward: 50,
    evaluate: c => thresholdCondition(countMatching(c.spinHistory, e => e.overallTier.startsWith('F')), 1) },
  { id: 'first_story_slot', name: 'Storied Beginning', description: 'Open your first Story Mode slot.',
    icon: 'auto_stories', tier: 'bronze', reward: 25,
    evaluate: c => thresholdCondition(c.slots.filter(s => s !== null).length, 1) },
  { id: 'first_gamepass', name: 'Patron of Fate', description: 'Buy your first gamepass.',
    icon: 'shopping_cart', tier: 'bronze', reward: 50,
    evaluate: c => thresholdCondition(c.gamepasses.length, 1) },

  // ── More silver ────────────────────────────────────────────────────────────
  { id: 'ten_wins', name: 'Steady Hand', description: 'Win 10 Rivals battles.',
    icon: 'sports_kabaddi', tier: 'silver', reward: 150,
    evaluate: c => thresholdCondition(c.rivalsWins, 10) },
  { id: 'fifty_spins', name: 'Wheel-Bitten', description: 'Complete 50 spin sessions.',
    icon: 'sync', tier: 'silver', reward: 200,
    evaluate: c => thresholdCondition(c.spinHistory.length, 50) },
  { id: 'two_thousand_spins', name: 'Wheel-Reader', description: 'Spin the wheel 2,000 times across sessions.',
    icon: 'rotate_left', tier: 'silver', reward: 200,
    evaluate: c => thresholdCondition(c.spinHistory.reduce((s, e) => s + e.spinCount, 0), 2000) },
  { id: 'first_battle_loss', name: 'Educated by Defeat', description: 'Lose a Rivals battle — even great players lose.',
    icon: 'school', tier: 'silver', reward: 50,
    evaluate: c => thresholdCondition(c.rivalsLosses, 1) },
  { id: 'three_archetypes', name: 'Tactician', description: 'Roll 5 different archetypes.',
    icon: 'extension', tier: 'silver', reward: 100,
    evaluate: c => thresholdCondition(new Set(c.spinHistory.map(e => e.archetype)).size, 5) },

  // ── More gold ──────────────────────────────────────────────────────────────
  { id: 'three_a_tiers', name: 'A-Lister', description: 'Roll 3 A-tier-or-higher characters.',
    icon: 'auto_awesome', tier: 'gold', reward: 200,
    evaluate: c => thresholdCondition(
      countMatching(c.spinHistory, e => e.overallTier.startsWith('A') || ELITE_TIERS.has(e.overallTier)), 3) },
  { id: 'streak_14', name: '2-Week Devotion', description: 'Log in 14 days in a row.',
    icon: 'whatshot', tier: 'gold', reward: 400,
    evaluate: c => thresholdCondition(c.dailyStreak, 14) },
  { id: 'three_s_tiers', name: 'Forge Master', description: 'Roll 3 S-tier-or-higher characters.',
    icon: 'star_half', tier: 'gold', reward: 500,
    evaluate: c => thresholdCondition(countMatching(c.spinHistory, e => ELITE_TIERS.has(e.overallTier)), 3) },
  { id: 'five_gamepasses', name: 'Gear Collector', description: 'Own 3 different gamepasses.',
    icon: 'category', tier: 'gold', reward: 200,
    evaluate: c => thresholdCondition(new Set(c.gamepasses).size, 3) },
  { id: 'two_slots_active', name: 'Multi-Tasker', description: 'Have 2 Story Mode save slots in progress.',
    icon: 'view_carousel', tier: 'gold', reward: 150,
    evaluate: c => thresholdCondition(c.slots.filter(s => s !== null).length, 2) },

  // ── More mythic ────────────────────────────────────────────────────────────
  { id: 'five_sss_rolls', name: 'Legend Forger', description: 'Roll 5 SSS-tier-or-higher characters.',
    icon: 'auto_awesome_mosaic', tier: 'mythic', reward: 1000,
    evaluate: c => thresholdCondition(countMatching(c.spinHistory, e => MYTHIC_TIERS.has(e.overallTier)), 5) },
  { id: 'absolute_roll', name: 'Apex Predator', description: 'Roll an Absolute-tier character.',
    icon: 'flare', tier: 'mythic', reward: 2000,
    evaluate: c => thresholdCondition(
      countMatching(c.spinHistory, e => e.overallTier.startsWith('Absolute')), 1) },
  { id: 'hundred_wins', name: 'Centurion', description: 'Win 100 Rivals battles.',
    icon: 'military_tech', tier: 'mythic', reward: 1500,
    evaluate: c => thresholdCondition(c.rivalsWins, 100) },
  { id: 'streak_60', name: 'Unbreakable', description: 'Log in 60 days in a row.',
    icon: 'shield_person', tier: 'mythic', reward: 2000,
    evaluate: c => thresholdCondition(c.dailyStreak, 60) },
  { id: 'five_hundred_spins', name: 'Wheelmaster', description: 'Complete 500 spin sessions.',
    icon: 'rotate_360', tier: 'mythic', reward: 2000,
    evaluate: c => thresholdCondition(c.spinHistory.length, 500) },
]

// ── Persistence ─────────────────────────────────────────────────────────────
// Stored locally — just the unlock timestamps. The evaluation runs every time
// the achievement screen is opened; new unlocks since the last visit pop a
// celebration toast.
const STORAGE_KEY = 'wof_achievements_v1'

interface UnlockRecord {
  id: string
  unlockedAt: string
  // Set once the achievement's shard reward has been posted to the server.
  // Tracked separately from unlockedAt so that an unlock recorded while
  // logged-out or offline still credits later, exactly once.
  creditedAt?: string
}

export function loadUnlocks(): UnlockRecord[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as UnlockRecord[]
  } catch { return [] }
}

export function saveUnlocks(records: UnlockRecord[]): void {
  if (typeof localStorage === 'undefined') return
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)) } catch { /* quota — ignore */ }
}

// Build the achievement context from current client state. Pure data, no IO
// beyond reading localStorage / auth (synchronous).
export function buildContext(user: AuthUser | null): AchievementContext {
  return {
    spinHistory:  loadSpinHistory(),
    rivalsWins:   user?.rivalsWins ?? 0,
    rivalsLosses: user?.rivalsLosses ?? 0,
    slots:        loadAllSlots(),
    shards:       user?.shards ?? 0,
    dailyStreak:  user?.dailyStreak ?? 0,
    gamepasses:   user?.gamepasses ?? [],
  }
}

export interface AchievementState extends AchievementDef {
  condition: AchievementCondition
  unlockedAt: string | null
  isNewlyUnlocked: boolean
}

// Evaluates all achievements + reconciles unlocks. Newly-met achievements get
// a fresh unlockedAt timestamp; previously-unlocked stay stable. Returns the
// states AND the list of newly-unlocked entries so the caller can celebrate.
export function evaluateAll(ctx: AchievementContext): { states: AchievementState[]; newlyUnlocked: AchievementState[] } {
  const records = loadUnlocks()
  const byId = new Map(records.map(r => [r.id, r.unlockedAt]))
  const newlyUnlocked: AchievementState[] = []
  const states: AchievementState[] = ACHIEVEMENTS.map(def => {
    const condition = def.evaluate(ctx)
    let unlockedAt = byId.get(def.id) ?? null
    let isNewlyUnlocked = false
    if (condition.met && !unlockedAt) {
      unlockedAt = new Date().toISOString()
      byId.set(def.id, unlockedAt)
      isNewlyUnlocked = true
    }
    const state: AchievementState = { ...def, condition, unlockedAt, isNewlyUnlocked }
    if (isNewlyUnlocked) newlyUnlocked.push(state)
    return state
  })
  // Persist updated unlocks (only matters if there were new ones). Preserve
  // existing creditedAt timestamps so we don't double-credit shards.
  if (newlyUnlocked.length > 0) {
    const creditedById = new Map(records.map(r => [r.id, r.creditedAt]))
    saveUnlocks(Array.from(byId, ([id, unlockedAt]) => ({
      id, unlockedAt, creditedAt: creditedById.get(id),
    })))
  }
  return { states, newlyUnlocked }
}

// Returns achievements that have been unlocked but whose shard reward has not
// yet been credited to the user's account. Used by the achievements / profile
// pages to deliver pending rewards on the next eligible visit (e.g. user
// unlocked while logged-out, then logs back in).
export function pendingRewardUnlocks(): { id: string; reward: number }[] {
  const records = loadUnlocks()
  const byId = new Map(ACHIEVEMENTS.map(a => [a.id, a]))
  const out: { id: string; reward: number }[] = []
  for (const r of records) {
    if (r.creditedAt) continue
    const reward = byId.get(r.id)?.reward ?? 0
    if (reward > 0) out.push({ id: r.id, reward })
  }
  return out
}

// Marks the given achievement IDs as having had their shard reward credited.
// Idempotent — safe to call multiple times with the same IDs.
export function markRewardsCredited(ids: string[]): void {
  if (ids.length === 0) return
  const records = loadUnlocks()
  const set = new Set(ids)
  const now = new Date().toISOString()
  let changed = false
  for (const r of records) {
    if (set.has(r.id) && !r.creditedAt) { r.creditedAt = now; changed = true }
  }
  if (changed) saveUnlocks(records)
}
