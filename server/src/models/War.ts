// Guild war model — a single 1v1 clan war that proceeds through:
//
//   searching   — clan1 created the war; waiting for an opponent of the
//                 same size at a similar MMR. clan2Id is unset.
//   prep        — opponent matched; 24h prep window. Both rosters + team
//                 snapshots frozen. No attacks accepted.
//   active      — 24h combat window. Members attack with their attack team
//                 vs opposing defenders. (Attack flow + scoring land in
//                 Phase 3.)
//   resolved    — clock ran out OR every defender on one side is dead.
//                 Score is final, MMR delta applied to both clans.
//   cancelled   — leader/coLeader cancelled before matching. Terminal.
//
// Wars are matched by `size` (5/10/15/20) AND a growing MMR tolerance the
// longer they've been searching. The match-engine sweep lives in
// server/src/routes/wars.ts.

import mongoose, { Schema, Document } from 'mongoose'

export type WarSize = 5 | 10 | 15 | 20
export type WarStatus = 'searching' | 'prep' | 'active' | 'resolved' | 'cancelled'

// Snapshot of one war participant's attack + defense team at match time.
// Frozen so swapping teams mid-war can't change defenders or attack lineups.
// `defenseTeamAlive` mirrors `defenseTeam` at creation and shrinks as
// defenders die — when it reaches [] the member is fully defeated and
// can't be attacked again.
export interface WarMemberSnapshot {
  userId: mongoose.Types.ObjectId
  username: string
  attackTeam:  string[]        // shareIds — used for ALL of this member's attacks; doesn't deplete
  defenseTeam: string[]        // shareIds — original roster (immutable after match)
  defenseTeamAlive: string[]   // shareIds still alive in defense (defenders permadeath in-war)
  attacksRemaining: number     // each member starts with 2; -1 per attack
}

// Per-attack audit log. Pushed into War.attackLog on every successful
// /war/attack call. Drives the war timeline UI + end-of-war recap.
export interface WarAttackLog {
  attackerUserId: mongoose.Types.ObjectId
  attackerUsername: string
  defenderUserId: mongoose.Types.ObjectId
  defenderUsername: string
  killShareIds: string[]   // defender shareIds that died this attack
  attackerWon: boolean     // true = full clear of remaining defenders
  scoreAwarded: number     // points credited to attacker's clan
  attackedAt: Date
}

export interface IWar extends Document {
  size: WarSize
  status: WarStatus

  clan1Id: mongoose.Types.ObjectId
  clan2Id?: mongoose.Types.ObjectId

  // Member rosters chosen by each leader. Length === size at war start.
  clan1MemberIds: mongoose.Types.ObjectId[]
  clan2MemberIds: mongoose.Types.ObjectId[]

  // Team snapshots — populated when status transitions searching → prep.
  clan1Members: WarMemberSnapshot[]
  clan2Members: WarMemberSnapshot[]

  // MMR at the moment clan1 started the war. Drives matchmaking; the
  // opponent must be within an MMR tolerance of this value (the
  // tolerance grows as the war waits).
  clan1Mmr: number
  clan2Mmr?: number

  createdAt:    Date
  matchedAt?:   Date
  prepStartAt?: Date
  warStartAt?:  Date
  warEndAt?:    Date

  // Phase 3 fields (live in the schema now so the model has the shape;
  // both default to 0 until attacks land).
  clan1Score: number
  clan2Score: number
  winnerClanId?: mongoose.Types.ObjectId   // unset on draw
  mmrDelta?: number                         // amount applied at resolution
  attackLog: WarAttackLog[]
}

const WarMemberSnapshotSchema = new Schema<WarMemberSnapshot>({
  userId:           { type: Schema.Types.ObjectId, ref: 'User', required: true },
  username:         { type: String, required: true },
  attackTeam:       { type: [String], default: [] },
  defenseTeam:      { type: [String], default: [] },
  defenseTeamAlive: { type: [String], default: [] },
  attacksRemaining: { type: Number, default: 2 },
}, { _id: false })

const WarAttackLogSchema = new Schema<WarAttackLog>({
  attackerUserId:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
  attackerUsername: { type: String, required: true },
  defenderUserId:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
  defenderUsername: { type: String, required: true },
  killShareIds:     { type: [String], default: [] },
  attackerWon:      { type: Boolean, required: true },
  scoreAwarded:     { type: Number, required: true },
  attackedAt:       { type: Date, default: Date.now },
}, { _id: false })

const WarSchema = new Schema<IWar>({
  size:           { type: Number, enum: [5, 10, 15, 20], required: true, index: true },
  status:         { type: String, enum: ['searching', 'prep', 'active', 'resolved', 'cancelled'], required: true, index: true },

  clan1Id:        { type: Schema.Types.ObjectId, ref: 'Clan', required: true, index: true },
  clan2Id:        { type: Schema.Types.ObjectId, ref: 'Clan', index: true },

  clan1MemberIds: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
  clan2MemberIds: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },

  clan1Members:   { type: [WarMemberSnapshotSchema], default: [] },
  clan2Members:   { type: [WarMemberSnapshotSchema], default: [] },

  clan1Mmr:       { type: Number, required: true, index: true },
  clan2Mmr:       { type: Number },

  createdAt:      { type: Date, default: Date.now, index: true },
  matchedAt:      { type: Date },
  prepStartAt:    { type: Date },
  warStartAt:     { type: Date },
  warEndAt:       { type: Date, index: true },

  clan1Score:     { type: Number, default: 0 },
  clan2Score:     { type: Number, default: 0 },
  winnerClanId:   { type: Schema.Types.ObjectId, ref: 'Clan' },
  mmrDelta:       { type: Number },
  attackLog:      { type: [WarAttackLogSchema], default: [] },
})

// Compound index for matchmaking sweep: status='searching' + same size.
WarSchema.index({ status: 1, size: 1, clan1Mmr: 1 })
// A clan can have at most one active war (searching/prep/active) at a time —
// enforced in the start-war route. Indexed for fast "current war" lookup.
WarSchema.index({ clan1Id: 1, status: 1 })
WarSchema.index({ clan2Id: 1, status: 1 })

export const War = mongoose.model<IWar>('War', WarSchema)

// ── Helpers ────────────────────────────────────────────────────────────────

/** Returns the war doc IDs the given clan is involved in right now (any
 *  non-terminal status). Used to enforce "one war at a time". */
export const NON_TERMINAL_STATUSES: WarStatus[] = ['searching', 'prep', 'active']

/** Lifecycle constants — exposed so the matchmaking sweep + frontend
 *  countdown UI agree on durations. */
export const PREP_WINDOW_MS = 24 * 60 * 60 * 1000
export const ACTIVE_WINDOW_MS = 24 * 60 * 60 * 1000

/** MMR matchmaking tolerance grows with wait time so unpopular brackets
 *  eventually find a match. Starts tight (75 MMR) and expands toward 500
 *  over the first 10 minutes of searching. */
export function matchmakingTolerance(searchSeconds: number): number {
  const minTolerance = 75
  const maxTolerance = 500
  const fullExpansionSec = 600   // 10 minutes
  const t = Math.max(0, Math.min(1, searchSeconds / fullExpansionSec))
  return Math.round(minTolerance + (maxTolerance - minTolerance) * t)
}

/** MMR delta applied at war resolution.
 *
 *  Win:  +15 to +20 MMR (small base + bonus scaled by score margin).
 *  Loss: -10 to -20 MMR (bigger swing the more lopsided the loss).
 *  Draw: 0 to both clans.
 *
 *  Margin is normalised against the theoretical max score for the war
 *  size (members × 2 attacks × 3 points per perfect clear) so a 5v5
 *  blowout (max 30) and a 20v20 blowout (max 120) scale the same way.
 */
export function computeMmrDelta(
  winnerScore: number, loserScore: number, size: WarSize,
): { winnerGain: number; loserLoss: number } {
  const maxPerSide = size * 2 * 3
  const margin = Math.max(0, winnerScore - loserScore)
  const marginPct = maxPerSide > 0 ? Math.min(1, margin / maxPerSide) : 0
  const winnerGain = Math.round(15 + 5  * marginPct)   // 15..20
  const loserLoss  = Math.round(10 + 10 * marginPct)   // 10..20
  return { winnerGain, loserLoss }
}
