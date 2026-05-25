// CoC-style clan model. Roles map to Clash of Clans:
//   leader      = Leader      (exactly one — promotion replaces them)
//   coLeaderIds = Co-Leaders  (manage members, promote/demote up to elder, kick)
//   elderIds    = Elders      (limited perms: kick members, accept join requests)
//   members     = Members     (everyone else — read-only)
//
// joinType:
//   open    — anyone meeting minWinsRequired can join immediately
//   invite  — must POST /clans/:id/request, leader/co/elder accepts
//   closed  — invite-only, no requests accepted
import mongoose, { Schema, Document } from 'mongoose'

export type ClanJoinType = 'open' | 'invite' | 'closed'

export interface IClan extends Document {
  name: string
  tag: string
  description: string
  motd: string                                 // shorter "Message of the Day" shown on home
  badge: string                                // emoji or single-char glyph rendered as the clan crest
  leaderId: mongoose.Types.ObjectId
  coLeaderIds: mongoose.Types.ObjectId[]
  elderIds: mongoose.Types.ObjectId[]
  memberIds: mongoose.Types.ObjectId[]         // includes leader, co-leaders, elders, members
  joinRequests: { userId: mongoose.Types.ObjectId; requestedAt: Date }[]
  joinType: ClanJoinType
  minWinsRequired: number                      // analogous to "required trophies" in CoC
  maxMembers: number
  clanXp: number                               // accumulated; used to derive clanLevel
  createdAt: Date
}

const ClanSchema = new Schema<IClan>({
  name:           { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 32 },
  tag:            { type: String, required: true, unique: true, trim: true, minlength: 2, maxlength: 5, uppercase: true },
  description:    { type: String, default: '', maxlength: 200 },
  motd:           { type: String, default: '', maxlength: 80 },
  badge:          { type: String, default: '⚔', maxlength: 4 },
  leaderId:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
  coLeaderIds:    { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
  elderIds:       { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
  memberIds:      { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
  joinRequests:   { type: [{ userId: { type: Schema.Types.ObjectId, ref: 'User' }, requestedAt: { type: Date, default: Date.now } }], default: [] },
  joinType:       { type: String, enum: ['open', 'invite', 'closed'], default: 'open' },
  minWinsRequired: { type: Number, default: 0, min: 0 },
  maxMembers:     { type: Number, default: 50, min: 2, max: 50 },
  clanXp:         { type: Number, default: 0 },
  createdAt:      { type: Date, default: Date.now },
})

ClanSchema.index({ name: 1 })
ClanSchema.index({ joinType: 1 })

export const Clan = mongoose.model<IClan>('Clan', ClanSchema)

// Compute clan level from xp. Linear-ish for now — 100xp per level until lv5,
// then 200, then 400. Easy to tune later without migration.
export function clanLevelFromXp(xp: number): number {
  if (xp < 500)  return 1 + Math.floor(xp / 100)
  if (xp < 2500) return 5 + Math.floor((xp - 500) / 200)
  return 15 + Math.floor((xp - 2500) / 400)
}

// Helper: derive a user's role within a clan doc.
export type ClanRole = 'leader' | 'coLeader' | 'elder' | 'member' | 'none'
export function clanRoleOf(clan: IClan, userId: string): ClanRole {
  const uid = userId.toString()
  if (clan.leaderId.toString() === uid) return 'leader'
  if (clan.coLeaderIds.some(id => id.toString() === uid)) return 'coLeader'
  if (clan.elderIds.some(id => id.toString() === uid)) return 'elder'
  if (clan.memberIds.some(id => id.toString() === uid)) return 'member'
  return 'none'
}

// Role hierarchy for permission checks. Higher number = more privileged.
const ROLE_RANK: Record<ClanRole, number> = { none: 0, member: 1, elder: 2, coLeader: 3, leader: 4 }
export function canManage(actor: ClanRole, target: ClanRole): boolean {
  // Must outrank target AND be at least elder to do anything.
  return ROLE_RANK[actor] > ROLE_RANK[target] && ROLE_RANK[actor] >= 2
}
