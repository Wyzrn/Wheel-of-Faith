// Server-side challenge progress + claim engine.
//
// Each challenge is tied to a server-observed *event*. Each (event, date) pair
// stores a count; challenges declare a threshold against that count. This
// prevents the client from claiming a reward by simply POSTing /claim — the
// qualifying event must actually be observed server-side first.
//
// The visible daily set is shuffled deterministically from a pool of 13 using
// the UTC date string as the seed. Same user sees the same set all day; a new
// set rolls in at UTC midnight along with everyone else's reset.

import type { IUser } from '../models/User.js'

export interface ProgressEntry {
  // The event name (NOT the challenge type — multiple challenges can listen to
  // one event with different thresholds, e.g. spin_complete + spin_three).
  type: string
  date: string  // YYYY-MM-DD UTC
  count: number
}

export interface ChallengeDef {
  type:        string   // unique identifier sent to UI + claim endpoint
  name:        string
  description: string
  reward:      number
  icon:        string
  event:       string   // which server event qualifies this challenge
  threshold:   number   // event count needed to qualify
}

// Master pool — 13 challenges. Server picks 4 per day deterministically.
export const CHALLENGE_POOL: ChallengeDef[] = [
  // Core trio — the original three. Easy / universally achievable.
  { type: 'spin_complete', name: 'Fate Seeker',     description: 'Complete a character spin session',   reward:  50, icon: 'casino',      event: 'spin_complete', threshold: 1 },
  { type: 'rivals_win',    name: 'Battle Proven',   description: 'Win any Rivals battle',               reward: 100, icon: 'swords',      event: 'rivals_win',    threshold: 1 },
  { type: 'shop_visit',    name: 'Window Shopping', description: 'Visit the Arcane Shop',               reward:  25, icon: 'storefront',  event: 'shop_visit',    threshold: 1 },

  // Count-based — grind challenges that reward replaying.
  { type: 'spin_three',    name: 'Triple Threat',   description: 'Complete 3 character sessions',       reward: 150, icon: 'casino',      event: 'spin_complete', threshold: 3 },
  { type: 'rivals_streak', name: 'Three of a Kind', description: 'Win 2 Rivals battles',                reward: 200, icon: 'military_tech', event: 'rivals_win',  threshold: 2 },

  // Tier-based — risk/reward and "embrace your fate" RNG flavour.
  { type: 'high_tier',     name: 'Touched by Fate', description: 'Roll an overall A-tier or higher character', reward: 250, icon: 'auto_awesome', event: 'high_tier_spin', threshold: 1 },
  { type: 's_tier',        name: 'Mythic Forging',  description: 'Roll an overall S-tier or higher character', reward: 400, icon: 'workspace_premium', event: 's_tier_spin', threshold: 1 },
  { type: 'low_tier',      name: 'Embrace the Mediocre', description: 'Roll an overall F or E-tier character',  reward: 100, icon: 'sentiment_dissatisfied', event: 'low_tier_spin', threshold: 1 },

  // Action-based — reward engaging with sub-systems.
  { type: 'gallery_share', name: 'Hall of Faces',   description: 'Share a character to the public Gallery',     reward: 100, icon: 'photo_library', event: 'gallery_share', threshold: 1 },
  { type: 'gamepass_buy',  name: 'Tithe to Fate',   description: 'Purchase any gamepass',                       reward: 150, icon: 'shopping_bag',  event: 'gamepass_buy',  threshold: 1 },
  { type: 'story_battle',  name: 'Story So Far',    description: 'Win a Story Mode battle',                     reward: 125, icon: 'auto_stories',  event: 'story_battle_win', threshold: 1 },
  { type: 'clan_visit',    name: 'Banner Bearer',   description: 'Visit your Clan page',                        reward:  50, icon: 'flag',          event: 'clan_visit',   threshold: 1 },

  // Login — always achievable, awards just for showing up.
  { type: 'daily_login',   name: 'Show Up',         description: 'Log in today',                                reward:  50, icon: 'login',         event: 'daily_login',  threshold: 1 },
]

// Number of challenges surfaced per day. Kept small so the page is scannable on
// mobile — full pool is 13; users see ~31% of it on any given day.
export const DAILY_COUNT = 4

// Events that can be marked from client requests via /challenges/progress.
// All other events are gated to server-side hooks (POST /characters, WS battle
// resolution, /shop/gamepasses/:id, etc.) so the client can't self-grant them.
//
// story_battle_win is here because story battles resolve entirely client-side
// (no server endpoint observes them). Rewards are intentionally modest so the
// minor spoof vector — POSTing the progress without actually playing — is not
// worth gaming. Visit-style events are idempotent at count=1 per day.
export const CLIENT_GRANTABLE_EVENTS = new Set(['shop_visit', 'clan_visit', 'story_battle_win'])

const ALL_EVENT_NAMES = new Set(CHALLENGE_POOL.map(c => c.event))
export function isValidEvent(event: string): boolean { return ALL_EVENT_NAMES.has(event) }

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

// Deterministic, date-seeded shuffle of the challenge pool. Same date → same
// daily set for all users; midnight UTC rolls in a new selection. Pure function
// (no DB hit) so it can be called from the daily endpoint without overhead.
function hashDate(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h = (h ^ s.charCodeAt(i)) >>> 0
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function pickDailyChallenges(date: string): ChallengeDef[] {
  const rand = mulberry32(hashDate(date))
  // Fisher-Yates on a copy
  const a = [...CHALLENGE_POOL]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a.slice(0, DAILY_COUNT)
}

// Increment today's count for an event. Used by both server hooks and the
// client-progress endpoint (for events in CLIENT_GRANTABLE_EVENTS).
// Returns the new count after increment.
export async function markEvent(user: IUser, event: string, by: number = 1): Promise<number> {
  if (!isValidEvent(event)) return 0
  const today = todayStr()
  const entry = user.challengesProgress.find(c => c.type === event && c.date === today)
  let newCount: number
  if (entry) {
    entry.count = (entry.count ?? 1) + by
    newCount = entry.count
  } else {
    user.challengesProgress.push({ type: event, date: today, count: by })
    newCount = by
  }
  // Prune progress + completed entries older than 7 days so the array stays bounded.
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  user.challengesProgress  = user.challengesProgress.filter(c  => c.date >= cutoff)
  user.challengesCompleted = user.challengesCompleted.filter(c => c.date >= cutoff)
  await user.save()
  return newCount
}

// Look up today's event count for a given event name.
export function todayCount(user: IUser, event: string): number {
  const today = todayStr()
  const entry = user.challengesProgress.find(c => c.type === event && c.date === today)
  return entry?.count ?? 0
}
