// Server-side challenge progress + claim engine.
// Two-stage ledger:
//   challengesProgress  — set when the server observes the qualifying action
//   challengesCompleted — set by /claim only when matching progress entry exists
// This prevents the client from claiming a reward by simply POSTing /claim — they
// have to actually trigger the qualifying action server-side first.

import type { IUser } from '../models/User.js'

export const CHALLENGE_TYPES = ['spin_complete', 'rivals_win', 'shop_visit'] as const
export type ChallengeType = typeof CHALLENGE_TYPES[number]

export const DAILY_CHALLENGES = [
  { type: 'spin_complete' as ChallengeType, name: 'Fate Seeker',     description: 'Complete a full character spin session', reward: 50,  icon: 'casino' },
  { type: 'rivals_win'    as ChallengeType, name: 'Battle Proven',   description: 'Win any Rivals battle',                  reward: 100, icon: 'swords' },
  { type: 'shop_visit'    as ChallengeType, name: 'Window Shopping', description: 'Visit the Arcane Shop',                  reward: 25,  icon: 'storefront' },
]

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

// Idempotently mark today's progress for a given challenge type. Returns true if a
// new progress entry was added (i.e. this is the first qualifying event today).
export async function markChallengeProgress(user: IUser, type: ChallengeType): Promise<boolean> {
  if (!CHALLENGE_TYPES.includes(type)) return false
  const today = todayStr()
  const has = user.challengesProgress.some(c => c.type === type && c.date === today)
  if (has) return false
  user.challengesProgress.push({ type, date: today })
  // Prune older entries to keep array bounded — keep last 7 days only
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  user.challengesProgress = user.challengesProgress.filter(c => c.date >= cutoff)
  user.challengesCompleted = user.challengesCompleted.filter(c => c.date >= cutoff)
  await user.save()
  return true
}
