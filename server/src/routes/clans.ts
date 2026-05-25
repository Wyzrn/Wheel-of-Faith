// CoC-style clan API. Patterned on the actual Clash of Clans clan management
// flows — open/invite/closed join types, role hierarchy with permission checks,
// promote/demote/kick/transfer/disband, join requests inbox, badge + motd.

import type { FastifyInstance } from 'fastify'
import mongoose from 'mongoose'
import { Clan, clanLevelFromXp, clanRoleOf, canManage, type ClanRole } from '../models/Clan.js'
import { User } from '../models/User.js'

// Shape returned to the client. Computed fields (memberCount, level, totalWins,
// role) are added on top of the lean clan document.
interface ClanResponse {
  _id: any
  name: string
  tag: string
  description: string
  motd: string
  badge: string
  joinType: string
  minWinsRequired: number
  maxMembers: number
  memberCount: number
  level: number
  clanXp: number
  totalWins?: number
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function totalWinsFor(memberIds: any[]): Promise<number> {
  if (memberIds.length === 0) return 0
  const members = await User.find({ _id: { $in: memberIds } }).select('rivalsWins').lean()
  return members.reduce((s, m) => s + (m.rivalsWins ?? 0), 0)
}

export async function clanRoutes(app: FastifyInstance) {

  // ── GET /clans — search + filter ────────────────────────────────────────────
  // Query: search (name prefix), joinType (open/invite/closed/any), minWins (max threshold)
  app.get('/clans', {
    config: { rateLimit: { max: 30, timeWindow: '1m' } },
  }, async (req: any, reply) => {
    const { search = '', joinType = 'any', maxRequired } = req.query as { search?: string; joinType?: string; maxRequired?: string }
    const filter: any = {}
    if (search) filter.name = { $regex: escapeRegex(search), $options: 'i' }
    if (joinType && joinType !== 'any' && ['open', 'invite', 'closed'].includes(joinType)) {
      filter.joinType = joinType
    }
    if (maxRequired && !isNaN(Number(maxRequired))) {
      filter.minWinsRequired = { $lte: Number(maxRequired) }
    }
    const clans = await Clan.find(filter).limit(40).lean()
    const result: ClanResponse[] = clans.map(c => ({
      _id: c._id, name: c.name, tag: c.tag, description: c.description, motd: c.motd, badge: c.badge,
      joinType: c.joinType, minWinsRequired: c.minWinsRequired, maxMembers: c.maxMembers,
      memberCount: c.memberIds.length, level: clanLevelFromXp(c.clanXp ?? 0), clanXp: c.clanXp ?? 0,
    }))
    reply.send({ clans: result })
  })

  // ── GET /clans/mine — current user's clan + role ────────────────────────────
  app.get('/clans/mine', async (req: any, reply) => {
    if (!req.userId) return reply.status(401).send({ error: 'login required' })
    const user = await User.findById(req.userId).lean()
    if (!user?.clanId) return reply.send({ clan: null })
    const clan = await Clan.findById(user.clanId).lean()
    if (!clan) return reply.send({ clan: null })

    // Pull member profiles + their roles
    const members = await User.find({ _id: { $in: clan.memberIds } })
      .select('username rivalsWins gamesPlayed')
      .lean()
    const role = clanRoleOf(clan as any, req.userId) as ClanRole

    // Sort: leader first, co-leaders, elders, members (each tier sorted by wins desc)
    const tierOf = (id: any) => {
      const sid = id.toString()
      if (clan.leaderId.toString() === sid) return 0
      if (clan.coLeaderIds.some((c: any) => c.toString() === sid)) return 1
      if (clan.elderIds.some((c: any) => c.toString() === sid)) return 2
      return 3
    }
    const enriched = members.map(m => ({
      ...m, role: ['leader', 'coLeader', 'elder', 'member'][tierOf(m._id)] as ClanRole, _tier: tierOf(m._id),
    }))
    enriched.sort((a, b) => a._tier - b._tier || (b.rivalsWins ?? 0) - (a.rivalsWins ?? 0))

    // Join requests (visible only to elder+)
    let joinRequests: any[] = []
    if (['leader', 'coLeader', 'elder'].includes(role)) {
      const ids = clan.joinRequests.map(r => r.userId)
      const requesters = await User.find({ _id: { $in: ids } }).select('username rivalsWins').lean()
      joinRequests = clan.joinRequests.map(jr => {
        const u = requesters.find(r => r._id.toString() === jr.userId.toString())
        return u ? { userId: u._id, username: u.username, rivalsWins: u.rivalsWins, requestedAt: jr.requestedAt } : null
      }).filter(Boolean)
    }

    reply.send({
      clan: {
        ...clan,
        members: enriched.map(({ _tier, ...rest }) => rest),
        memberCount: clan.memberIds.length,
        level: clanLevelFromXp(clan.clanXp ?? 0),
        role,
        joinRequests,
      },
    })
  })

  // ── GET /clans/leaderboard — top clans by combined wins ─────────────────────
  app.get('/clans/leaderboard', {
    config: { rateLimit: { max: 30, timeWindow: '1m' } },
  }, async (_req, reply) => {
    const clans = await Clan.find().lean()
    const enriched = await Promise.all(clans.map(async c => {
      const totalWins = await totalWinsFor(c.memberIds)
      return {
        _id: c._id, name: c.name, tag: c.tag, badge: c.badge, joinType: c.joinType,
        memberCount: c.memberIds.length, level: clanLevelFromXp(c.clanXp ?? 0), totalWins,
      }
    }))
    enriched.sort((a, b) => b.totalWins - a.totalWins)
    reply.send({ clans: enriched.slice(0, 50) })
  })

  // ── POST /clans — create ────────────────────────────────────────────────────
  app.post('/clans', {
    config: { rateLimit: { max: 3, timeWindow: '10m' } },
  }, async (req: any, reply) => {
    if (!req.userId) return reply.status(401).send({ error: 'login required' })
    const user = await User.findById(req.userId)
    if (!user) return reply.status(404).send({ error: 'user not found' })
    if (user.clanId) return reply.status(409).send({ error: 'already in a clan' })

    const { name, tag, description = '', motd = '', badge = '⚔', joinType = 'open', minWinsRequired = 0 } =
      req.body as { name: string; tag: string; description?: string; motd?: string; badge?: string; joinType?: string; minWinsRequired?: number }
    if (!name || !tag) return reply.status(400).send({ error: 'name and tag required' })
    if (!/^[a-zA-Z0-9 _-]{3,32}$/.test(name)) return reply.status(400).send({ error: 'invalid clan name' })
    if (!/^[a-zA-Z0-9]{2,5}$/.test(tag)) return reply.status(400).send({ error: 'tag must be 2-5 alphanumeric characters' })
    if (!['open', 'invite', 'closed'].includes(joinType)) return reply.status(400).send({ error: 'invalid joinType' })
    const minWins = Math.max(0, Math.min(99999, Math.floor(Number(minWinsRequired) || 0)))

    const clan = await Clan.create({
      name: name.trim(),
      tag: tag.toUpperCase(),
      description: description.slice(0, 200),
      motd: motd.slice(0, 80),
      badge: (badge || '⚔').slice(0, 4),
      leaderId: new mongoose.Types.ObjectId(req.userId),
      memberIds: [new mongoose.Types.ObjectId(req.userId)],
      coLeaderIds: [],
      elderIds: [],
      joinType: joinType as 'open' | 'invite' | 'closed',
      minWinsRequired: minWins,
    })

    user.clanId = (clan._id as mongoose.Types.ObjectId)
    await user.save()

    reply.status(201).send({ clan })
  })

  // ── PATCH /clans/:id — update settings (leader / co-leader) ─────────────────
  app.patch('/clans/:id', {
    config: { rateLimit: { max: 10, timeWindow: '1m' } },
  }, async (req: any, reply) => {
    if (!req.userId) return reply.status(401).send({ error: 'login required' })
    const { id } = req.params as { id: string }
    const clan = await Clan.findById(id)
    if (!clan) return reply.status(404).send({ error: 'clan not found' })
    const role = clanRoleOf(clan, req.userId)
    if (role !== 'leader' && role !== 'coLeader') {
      return reply.status(403).send({ error: 'only leader or co-leader can edit clan settings' })
    }
    const { description, motd, badge, joinType, minWinsRequired } = req.body as any
    if (description !== undefined) clan.description = String(description).slice(0, 200)
    if (motd !== undefined)        clan.motd        = String(motd).slice(0, 80)
    if (badge !== undefined)       clan.badge       = String(badge || '⚔').slice(0, 4)
    if (joinType !== undefined && ['open', 'invite', 'closed'].includes(joinType)) clan.joinType = joinType
    if (minWinsRequired !== undefined && !isNaN(Number(minWinsRequired))) {
      clan.minWinsRequired = Math.max(0, Math.min(99999, Math.floor(Number(minWinsRequired))))
    }
    await clan.save()
    reply.send({ ok: true })
  })

  // ── POST /clans/:id/join — join open clan directly ──────────────────────────
  app.post('/clans/:id/join', {
    config: { rateLimit: { max: 5, timeWindow: '1m' } },
  }, async (req: any, reply) => {
    if (!req.userId) return reply.status(401).send({ error: 'login required' })
    const user = await User.findById(req.userId)
    if (!user) return reply.status(404).send({ error: 'user not found' })
    if (user.clanId) return reply.status(409).send({ error: 'already in a clan — leave first' })

    const { id } = req.params as { id: string }
    const clan = await Clan.findById(id)
    if (!clan) return reply.status(404).send({ error: 'clan not found' })
    if (clan.memberIds.length >= clan.maxMembers) return reply.status(409).send({ error: `clan is full (max ${clan.maxMembers})` })
    if ((user.rivalsWins ?? 0) < clan.minWinsRequired) {
      return reply.status(403).send({ error: `${clan.minWinsRequired} rivals wins required to join` })
    }
    if (clan.joinType === 'closed') return reply.status(403).send({ error: 'clan is closed to new members' })
    if (clan.joinType === 'invite') return reply.status(403).send({ error: 'this clan accepts join requests only — use /request' })

    clan.memberIds.push(new mongoose.Types.ObjectId(req.userId))
    await clan.save()
    user.clanId = clan._id as mongoose.Types.ObjectId
    await user.save()

    reply.send({ ok: true })
  })

  // ── POST /clans/:id/request — request to join an invite-only clan ──────────
  app.post('/clans/:id/request', {
    config: { rateLimit: { max: 5, timeWindow: '5m' } },
  }, async (req: any, reply) => {
    if (!req.userId) return reply.status(401).send({ error: 'login required' })
    const user = await User.findById(req.userId)
    if (!user) return reply.status(404).send({ error: 'user not found' })
    if (user.clanId) return reply.status(409).send({ error: 'already in a clan — leave first' })

    const { id } = req.params as { id: string }
    const clan = await Clan.findById(id)
    if (!clan) return reply.status(404).send({ error: 'clan not found' })
    if (clan.joinType === 'closed') return reply.status(403).send({ error: 'clan is closed' })
    if (clan.joinType === 'open')   return reply.status(400).send({ error: 'clan is open — use /join directly' })
    if (clan.memberIds.length >= clan.maxMembers) return reply.status(409).send({ error: 'clan is full' })
    if ((user.rivalsWins ?? 0) < clan.minWinsRequired) {
      return reply.status(403).send({ error: `${clan.minWinsRequired} rivals wins required to request join` })
    }

    if (clan.joinRequests.some(r => r.userId.toString() === req.userId)) {
      return reply.status(409).send({ error: 'request already pending' })
    }
    clan.joinRequests.push({ userId: new mongoose.Types.ObjectId(req.userId), requestedAt: new Date() } as any)
    await clan.save()
    reply.send({ ok: true })
  })

  // ── POST /clans/:id/requests/:userId/:action — accept / decline ────────────
  app.post('/clans/:id/requests/:userId/:action', {
    config: { rateLimit: { max: 30, timeWindow: '1m' } },
  }, async (req: any, reply) => {
    if (!req.userId) return reply.status(401).send({ error: 'login required' })
    const { id, userId, action } = req.params as { id: string; userId: string; action: string }
    if (!['accept', 'decline'].includes(action)) return reply.status(400).send({ error: 'action must be accept or decline' })

    const clan = await Clan.findById(id)
    if (!clan) return reply.status(404).send({ error: 'clan not found' })
    const role = clanRoleOf(clan, req.userId)
    if (!['leader', 'coLeader', 'elder'].includes(role)) {
      return reply.status(403).send({ error: 'elders, co-leaders, or leader only' })
    }

    const idx = clan.joinRequests.findIndex(r => r.userId.toString() === userId)
    if (idx === -1) return reply.status(404).send({ error: 'no pending request' })
    clan.joinRequests.splice(idx, 1)

    if (action === 'accept') {
      const requester = await User.findById(userId)
      if (!requester) { await clan.save(); return reply.status(404).send({ error: 'requester not found' }) }
      if (requester.clanId) { await clan.save(); return reply.status(409).send({ error: 'requester already in a clan' }) }
      if (clan.memberIds.length >= clan.maxMembers) { await clan.save(); return reply.status(409).send({ error: 'clan is full' }) }
      clan.memberIds.push(new mongoose.Types.ObjectId(userId))
      requester.clanId = clan._id as mongoose.Types.ObjectId
      await requester.save()
    }
    await clan.save()
    reply.send({ ok: true })
  })

  // ── POST /clans/:id/promote|demote|kick/:userId — role management ─────────
  // CoC semantics: leader > co-leader > elder > member. Actor must outrank
  // target AND be at least an elder to act. Promote bumps target up one tier;
  // demote bumps them down one tier; kick removes from the clan entirely.
  app.post('/clans/:id/:action/:userId', {
    config: { rateLimit: { max: 30, timeWindow: '1m' } },
  }, async (req: any, reply) => {
    if (!req.userId) return reply.status(401).send({ error: 'login required' })
    const { id, action, userId } = req.params as { id: string; action: string; userId: string }
    if (!['promote', 'demote', 'kick'].includes(action)) {
      return reply.status(400).send({ error: 'action must be promote, demote, or kick' })
    }
    if (req.userId === userId) return reply.status(400).send({ error: "can't target yourself — use /leave or /transfer" })

    const clan = await Clan.findById(id)
    if (!clan) return reply.status(404).send({ error: 'clan not found' })
    const actorRole  = clanRoleOf(clan, req.userId)
    const targetRole = clanRoleOf(clan, userId)
    if (targetRole === 'none') return reply.status(404).send({ error: 'target not in clan' })
    if (!canManage(actorRole, targetRole)) {
      return reply.status(403).send({ error: 'insufficient permission for this action' })
    }
    // Elders cannot promote — only kick.
    if (actorRole === 'elder' && action !== 'kick') {
      return reply.status(403).send({ error: 'elders can only kick — promotions require co-leader' })
    }

    const targetOid = new mongoose.Types.ObjectId(userId)
    const removeFrom = (arr: mongoose.Types.ObjectId[]) => arr.filter(x => x.toString() !== userId)

    if (action === 'kick') {
      clan.coLeaderIds = removeFrom(clan.coLeaderIds)
      clan.elderIds    = removeFrom(clan.elderIds)
      clan.memberIds   = removeFrom(clan.memberIds)
      await clan.save()
      const kicked = await User.findById(userId)
      if (kicked) { kicked.clanId = undefined as any; await kicked.save() }
      return reply.send({ ok: true })
    }

    if (action === 'promote') {
      if (targetRole === 'member') {
        clan.elderIds.push(targetOid)
      } else if (targetRole === 'elder') {
        clan.elderIds = removeFrom(clan.elderIds)
        clan.coLeaderIds.push(targetOid)
      } else if (targetRole === 'coLeader') {
        return reply.status(400).send({ error: 'use /transfer to make co-leader the new leader' })
      }
    } else if (action === 'demote') {
      if (targetRole === 'coLeader') {
        clan.coLeaderIds = removeFrom(clan.coLeaderIds)
        clan.elderIds.push(targetOid)
      } else if (targetRole === 'elder') {
        clan.elderIds = removeFrom(clan.elderIds)
        // → demoted back to regular member (already in memberIds)
      } else if (targetRole === 'member') {
        return reply.status(400).send({ error: 'cannot demote a member further' })
      }
    }
    await clan.save()
    reply.send({ ok: true })
  })

  // ── POST /clans/:id/transfer/:userId — pass leadership ─────────────────────
  app.post('/clans/:id/transfer/:userId', {
    config: { rateLimit: { max: 5, timeWindow: '5m' } },
  }, async (req: any, reply) => {
    if (!req.userId) return reply.status(401).send({ error: 'login required' })
    const { id, userId } = req.params as { id: string; userId: string }
    const clan = await Clan.findById(id)
    if (!clan) return reply.status(404).send({ error: 'clan not found' })
    if (clanRoleOf(clan, req.userId) !== 'leader') {
      return reply.status(403).send({ error: 'only the leader can transfer leadership' })
    }
    if (req.userId === userId) return reply.status(400).send({ error: "you're already the leader" })
    const targetRole = clanRoleOf(clan, userId)
    if (targetRole === 'none') return reply.status(404).send({ error: 'target not in clan' })

    const oldLeaderId = clan.leaderId
    clan.leaderId = new mongoose.Types.ObjectId(userId)
    // Remove target from any role arrays (now leader)
    clan.coLeaderIds = clan.coLeaderIds.filter(x => x.toString() !== userId)
    clan.elderIds    = clan.elderIds.filter(x => x.toString() !== userId)
    // Old leader becomes co-leader by default
    if (oldLeaderId.toString() !== userId) clan.coLeaderIds.push(oldLeaderId)
    await clan.save()
    reply.send({ ok: true })
  })

  // ── DELETE /clans/:id/leave — leave or auto-promote next leader ────────────
  app.delete('/clans/:id/leave', {
    config: { rateLimit: { max: 5, timeWindow: '1m' } },
  }, async (req: any, reply) => {
    if (!req.userId) return reply.status(401).send({ error: 'login required' })
    const { id } = req.params as { id: string }
    const clan = await Clan.findById(id)
    if (!clan) return reply.status(404).send({ error: 'clan not found' })

    const role = clanRoleOf(clan, req.userId)
    if (role === 'none') return reply.status(404).send({ error: 'not in this clan' })

    const filter = (arr: mongoose.Types.ObjectId[]) => arr.filter(m => m.toString() !== req.userId)
    clan.memberIds   = filter(clan.memberIds)
    clan.coLeaderIds = filter(clan.coLeaderIds)
    clan.elderIds    = filter(clan.elderIds)

    const user = await User.findById(req.userId)
    if (user) { user.clanId = undefined as any; await user.save() }

    if (clan.memberIds.length === 0) {
      // Leader was the last member — disband
      await clan.deleteOne()
      return reply.send({ ok: true, disbanded: true })
    }

    if (role === 'leader') {
      // Auto-promote: co-leader > elder > most-wins member
      let nextLeader: mongoose.Types.ObjectId | null = null
      if (clan.coLeaderIds.length > 0) {
        nextLeader = clan.coLeaderIds[0]
        clan.coLeaderIds = clan.coLeaderIds.slice(1)
      } else if (clan.elderIds.length > 0) {
        nextLeader = clan.elderIds[0]
        clan.elderIds = clan.elderIds.slice(1)
      } else {
        // Fallback: pick member with highest rivalsWins
        const members = await User.find({ _id: { $in: clan.memberIds } }).select('_id rivalsWins').lean()
        members.sort((a, b) => (b.rivalsWins ?? 0) - (a.rivalsWins ?? 0))
        if (members[0]) nextLeader = members[0]._id as any
      }
      if (nextLeader) clan.leaderId = nextLeader
    }
    await clan.save()
    reply.send({ ok: true })
  })

  // ── DELETE /clans/:id — disband (leader only) ───────────────────────────────
  app.delete('/clans/:id', {
    config: { rateLimit: { max: 3, timeWindow: '10m' } },
  }, async (req: any, reply) => {
    if (!req.userId) return reply.status(401).send({ error: 'login required' })
    const { id } = req.params as { id: string }
    const clan = await Clan.findById(id)
    if (!clan) return reply.status(404).send({ error: 'clan not found' })
    if (clanRoleOf(clan, req.userId) !== 'leader') {
      return reply.status(403).send({ error: 'only the leader can disband the clan' })
    }
    // Clear every member's clanId in one query
    await User.updateMany({ _id: { $in: clan.memberIds } }, { $unset: { clanId: 1 } })
    await clan.deleteOne()
    reply.send({ ok: true, disbanded: true })
  })
}
