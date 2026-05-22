import type { FastifyInstance } from 'fastify'
import mongoose from 'mongoose'
import { Clan } from '../models/Clan.js'
import { User } from '../models/User.js'

export async function clanRoutes(app: FastifyInstance) {
  // GET /clans — search/list clans
  app.get('/clans', {
    config: { rateLimit: { max: 30, timeWindow: '1m' } },
  }, async (req: any, reply) => {
    const { search = '' } = req.query as { search?: string }
    const filter = search ? { name: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } } : {}
    const clans = await Clan.find(filter).limit(20).lean()
    // Attach member counts
    const result = clans.map(c => ({ ...c, memberCount: c.memberIds.length }))
    reply.send({ clans: result })
  })

  // GET /clans/mine — current user's clan
  app.get('/clans/mine', async (req: any, reply) => {
    if (!req.userId) return reply.status(401).send({ error: 'login required' })
    const user = await User.findById(req.userId).lean()
    if (!user?.clanId) return reply.send({ clan: null })
    const clan = await Clan.findById(user.clanId).lean()
    if (!clan) return reply.send({ clan: null })
    // Get member details
    const members = await User.find({ _id: { $in: clan.memberIds } })
      .select('username rivalsWins')
      .lean()
    reply.send({ clan: { ...clan, members, memberCount: clan.memberIds.length } })
  })

  // GET /clans/leaderboard — top clans by total member wins
  app.get('/clans/leaderboard', {
    config: { rateLimit: { max: 30, timeWindow: '1m' } },
  }, async (req: any, reply) => {
    const clans = await Clan.find().lean()
    const enriched = await Promise.all(clans.map(async c => {
      const members = await User.find({ _id: { $in: c.memberIds } }).select('rivalsWins').lean()
      const totalWins = members.reduce((s, m) => s + (m.rivalsWins ?? 0), 0)
      return { ...c, totalWins, memberCount: c.memberIds.length }
    }))
    enriched.sort((a, b) => b.totalWins - a.totalWins)
    reply.send({ clans: enriched.slice(0, 50) })
  })

  // POST /clans — create a clan
  app.post('/clans', {
    config: { rateLimit: { max: 3, timeWindow: '10m' } },
  }, async (req: any, reply) => {
    if (!req.userId) return reply.status(401).send({ error: 'login required' })
    const user = await User.findById(req.userId)
    if (!user) return reply.status(404).send({ error: 'user not found' })
    if (user.clanId) return reply.status(409).send({ error: 'already in a clan' })

    const { name, tag, description = '' } = req.body as { name: string; tag: string; description?: string }
    if (!name || !tag) return reply.status(400).send({ error: 'name and tag required' })
    if (!/^[a-zA-Z0-9 _-]{3,32}$/.test(name)) return reply.status(400).send({ error: 'invalid clan name' })
    if (!/^[a-zA-Z0-9]{2,5}$/.test(tag)) return reply.status(400).send({ error: 'tag must be 2-5 alphanumeric characters' })

    const clan = await Clan.create({
      name: name.trim(),
      tag: tag.toUpperCase(),
      description: description.slice(0, 200),
      leaderId: new mongoose.Types.ObjectId(req.userId),
      memberIds: [new mongoose.Types.ObjectId(req.userId)],
    })

    user.clanId = clan._id as mongoose.Types.ObjectId
    await user.save()

    reply.status(201).send({ clan })
  })

  // POST /clans/:id/join — join a clan
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
    if (clan.memberIds.length >= 10) return reply.status(409).send({ error: 'clan is full (max 10)' })

    clan.memberIds.push(new mongoose.Types.ObjectId(req.userId))
    await clan.save()
    user.clanId = clan._id as mongoose.Types.ObjectId
    await user.save()

    reply.send({ ok: true })
  })

  // DELETE /clans/:id/leave — leave a clan
  app.delete('/clans/:id/leave', {
    config: { rateLimit: { max: 5, timeWindow: '1m' } },
  }, async (req: any, reply) => {
    if (!req.userId) return reply.status(401).send({ error: 'login required' })
    const { id } = req.params as { id: string }
    const clan = await Clan.findById(id)
    if (!clan) return reply.status(404).send({ error: 'clan not found' })

    clan.memberIds = clan.memberIds.filter(m => m.toString() !== req.userId)
    const user = await User.findById(req.userId)
    if (user) { user.clanId = undefined as any; await user.save() }

    if (clan.memberIds.length === 0) {
      await clan.deleteOne()
    } else if (clan.leaderId.toString() === req.userId) {
      clan.leaderId = clan.memberIds[0]
      await clan.save()
    } else {
      await clan.save()
    }

    reply.send({ ok: true })
  })
}
