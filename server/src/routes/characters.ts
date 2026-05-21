import { nanoid } from 'nanoid'
import mongoose from 'mongoose'
import { Character } from '../models/Character.js'
import type { FastifyPluginAsync } from 'fastify'

const SORT_FIELD_MAP: Record<string, Record<string, 1 | -1>> = {
  score:     { overall_score: -1 },   // overridden by dir below
  rivals:    { rivals_wins: -1 },
  date:      { created_at: -1 },
  name:      { name: 1 },
  race:      { race: 1 },
  archetype: { archetype: 1 },
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export const characterRoutes: FastifyPluginAsync = async (fastify) => {

  // POST /characters — save a completed character, return share URL
  fastify.post('/characters', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '10 minutes',
      },
    },
    schema: {
      body: {
        type: 'object',
        required: ['name', 'race', 'archetype', 'overall_score', 'overall_tier', 'spins', 'session_started_at'],
        properties: {
          name:               { type: 'string', maxLength: 40 },
          race:               { type: 'string' },
          archetype:          { type: 'string' },
          overall_score:      { type: 'number', minimum: -20, maximum: 150 },
          overall_tier:       { type: 'string' },
          spins:              { type: 'array' },
          session_started_at: { type: 'string', format: 'date-time' },
          share_in_gallery:   { type: 'boolean' },
          elementWeaknesses:  { type: 'array', items: { type: 'string' }, maxItems: 5 },
        },
      },
    },
  }, async (request, reply) => {
    const body = request.body as {
      name: string
      race: string
      archetype: string
      overall_score: number
      overall_tier: string
      spins: unknown[]
      session_started_at: string
      share_in_gallery?: boolean
      elementWeaknesses?: string[]
    }

    // 90-second session guard
    const sessionStart = new Date(body.session_started_at).getTime()
    const sessionSeconds = (Date.now() - sessionStart) / 1000
    if (sessionSeconds < 90) {
      return reply.code(422).send({
        error: 'Session too short',
        message: `Minimum session length is 90 seconds (got ${Math.floor(sessionSeconds)}s)`,
      })
    }

    const shareId = nanoid(10)

    const userId = (request as any).userId
    if (!userId) return reply.code(401).send({ error: 'Login required to save characters' })

    const character = await Character.create({
      shareId,
      name: body.name,
      race: body.race,
      archetype: body.archetype,
      overall_score: body.overall_score,
      overall_tier: body.overall_tier,
      spins: body.spins,
      session_started_at: new Date(body.session_started_at),
      share_in_gallery: body.share_in_gallery ?? false,
      elementWeaknesses: (body.elementWeaknesses ?? []).slice(0, 5),
      ...(userId ? { userId: new mongoose.Types.ObjectId(userId) } : {}),
    })

    return reply.code(201).send({
      shareId: character.shareId,
      url: `/character/${character.shareId}`,
    })
  })

  // GET /characters — public gallery (share_in_gallery=true only)
  // Query: sort(desc|asc), sortBy(score|rivals|date|name|race|archetype), page, limit, search
  fastify.get('/characters', {
    config: {
      rateLimit: { max: 60, timeWindow: '1 minute' },
    },
    schema: {
      querystring: {
        type: 'object',
        properties: {
          sort:     { type: 'string', enum: ['desc', 'asc'], default: 'desc' },
          sortBy:   { type: 'string', enum: ['score', 'rivals', 'date', 'name', 'race', 'archetype'], default: 'score' },
          page:     { type: 'integer', minimum: 0, default: 0 },
          limit:    { type: 'integer', minimum: 1, maximum: 50, default: 20 },
          search:   { type: 'string', maxLength: 80, default: '' },
          weakness: { type: 'string', maxLength: 30, default: '' },
        },
      },
    },
  }, async (request, reply) => {
    const {
      sort     = 'desc',
      sortBy   = 'score',
      page     = 0,
      limit    = 20,
      search   = '',
      weakness = '',
    } = request.query as {
      sort?: string; sortBy?: string; page?: number; limit?: number; search?: string; weakness?: string
    }

    const dir = sort === 'asc' ? 1 : -1
    const skip = (page as number) * (limit as number)

    // Build sort spec — apply direction to the primary field
    const baseSort = { ...(SORT_FIELD_MAP[sortBy as string] ?? SORT_FIELD_MAP.score) }
    const primaryKey = Object.keys(baseSort)[0]
    const sortSpec: Record<string, 1 | -1> = { [primaryKey]: dir }
    // Secondary tiebreaker: always newest first
    if (primaryKey !== 'created_at') sortSpec.created_at = -1

    // Build filter
    const filter: Record<string, unknown> = { share_in_gallery: true }
    const q = (search as string).trim()
    if (q) {
      const re = { $regex: escapeRegex(q), $options: 'i' }
      filter.$or = [{ name: re }, { race: re }, { archetype: re }]
    }
    const w = (weakness as string).trim()
    if (w) filter.elementWeaknesses = w

    const [characters, total] = await Promise.all([
      Character.find(filter)
        .sort(sortSpec)
        .skip(skip)
        .limit(limit as number)
        .select('shareId name race archetype overall_tier overall_score rivals_wins created_at spins elementWeaknesses userId')
        .populate('userId', 'username')
        .lean(),
      Character.countDocuments(filter),
    ])

    const shaped = characters.map(c => ({
      ...c,
      creatorUsername: (c.userId as any)?.username ?? null,
      userId: undefined,
    }))

    return reply.send({
      characters: shaped,
      total,
      page,
      hasMore: skip + characters.length < (total as number),
    })
  })

  // GET /characters/:shareId — fetch character by share ID
  fastify.get('/characters/:shareId', async (request, reply) => {
    const { shareId } = request.params as { shareId: string }
    const character = await Character.findOne({ shareId }).lean()

    if (!character) {
      return reply.code(404).send({ error: 'Character not found' })
    }

    return reply.send(character)
  })

  // PATCH /characters/:shareId/gallery — toggle share_in_gallery
  fastify.patch('/characters/:shareId/gallery', {
    config: {
      rateLimit: { max: 30, timeWindow: '1 minute' },
    },
    schema: {
      body: {
        type: 'object',
        required: ['share_in_gallery'],
        properties: {
          share_in_gallery: { type: 'boolean' },
        },
      },
    },
  }, async (request, reply) => {
    const { shareId } = request.params as { shareId: string }
    const { share_in_gallery } = request.body as { share_in_gallery: boolean }

    const character = await Character.findOneAndUpdate(
      { shareId },
      { share_in_gallery },
      { new: true }
    ).lean()

    if (!character) {
      return reply.code(404).send({ error: 'Character not found' })
    }

    return reply.send({ share_in_gallery: character.share_in_gallery })
  })

  // GET /characters/mine — all characters for the authenticated user
  fastify.get('/characters/mine', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const userId = (request as any).userId
    if (!userId) return reply.code(401).send({ error: 'not authenticated' })

    const characters = await Character.find({ userId: new mongoose.Types.ObjectId(userId) })
      .sort({ created_at: -1 })
      .select('shareId name race archetype overall_tier overall_score rivals_wins created_at spins elementWeaknesses share_in_gallery')
      .lean()

    return reply.send({ characters })
  })

  // PATCH /characters/:shareId/claim — link an unclaimed character to the authenticated user
  fastify.patch('/characters/:shareId/claim', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const userId = (request as any).userId
    if (!userId) return reply.code(401).send({ error: 'not authenticated' })

    const { shareId } = request.params as { shareId: string }
    const character = await Character.findOneAndUpdate(
      { shareId, userId: { $exists: false } },
      { userId: new mongoose.Types.ObjectId(userId) },
      { new: true }
    ).lean()

    if (!character) return reply.code(404).send({ error: 'Character not found or already claimed' })
    return reply.send({ ok: true, shareId })
  })

  // PATCH /characters/:shareId/rivals-win — increment rivals_wins by 1
  fastify.patch('/characters/:shareId/rivals-win', {
    config: {
      rateLimit: {
        max: 100,
        timeWindow: '10 minutes',
      },
    },
  }, async (request, reply) => {
    const { shareId } = request.params as { shareId: string }
    const character = await Character.findOneAndUpdate(
      { shareId },
      { $inc: { rivals_wins: 1 } },
      { new: true }
    ).lean()

    if (!character) {
      return reply.code(404).send({ error: 'Character not found' })
    }

    return reply.send({ rivals_wins: character.rivals_wins })
  })
}
