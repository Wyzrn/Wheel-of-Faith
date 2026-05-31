import { nanoid } from 'nanoid'
import mongoose from 'mongoose'
import { Character } from '../models/Character.js'
import { User } from '../models/User.js'
import { markEvent } from '../lib/challenges.js'
import { generatePortrait, portraitsEnabled } from '../services/portraits.js'
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
          overall_score:      { type: 'number', minimum: -20, maximum: 185 },
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

    // Mark server-verified events for daily challenges. The 90s session guard
    // above ensures these can't be triggered by a one-shot POST. We emit:
    //   • spin_complete  — always
    //   • high_tier_spin — overall_tier ∈ {A, A+, S, S+, SS, SS+, SSS, …}
    //   • s_tier_spin    — overall_tier ∈ {S, S+, SS, SS+, SSS, …}
    //   • low_tier_spin  — overall_tier starts with F or E
    //   • gallery_share  — share_in_gallery true
    try {
      const user = await User.findById(userId)
      if (user) {
        await markEvent(user, 'spin_complete')
        const tier = body.overall_tier ?? ''
        const HIGH_TIER_PREFIXES = ['A', 'S']                 // covers A-, A, A+, S-, S, S+, SS*, SSS*
        const S_TIER_PREFIXES    = ['S']                       // S, S+, SS*, SSS*, plus Celestial/Godly which don't start with S
        const LOW_TIER_PREFIXES  = ['F', 'E']
        if (HIGH_TIER_PREFIXES.some(p => tier.startsWith(p)) || /^(SS|SSS|Z|Celestial|Godly|Primordial|Absolute)/.test(tier)) {
          await markEvent(user, 'high_tier_spin')
        }
        if (S_TIER_PREFIXES.some(p => tier.startsWith(p)) || /^(Z|Celestial|Godly|Primordial|Absolute)/.test(tier)) {
          await markEvent(user, 's_tier_spin')
        }
        if (LOW_TIER_PREFIXES.some(p => tier.startsWith(p))) {
          await markEvent(user, 'low_tier_spin')
        }
        if (body.share_in_gallery) {
          await markEvent(user, 'gallery_share')
        }
      }
    } catch (err) {
      fastify.log.warn({ err }, 'Failed to mark character POST challenge events')
    }

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
        .select('shareId name race archetype overall_tier overall_score rivals_wins created_at spins elementWeaknesses portraitUrl userId')
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

  // GET /characters/:shareId — fetch character by share ID. Adds an
  // `isOwner` boolean computed from the request's auth context so the
  // frontend can show owner-only affordances (e.g. the regenerate-portrait
  // button) without leaking the owner's userId in the response.
  fastify.get('/characters/:shareId', async (request, reply) => {
    const { shareId } = request.params as { shareId: string }
    const character = await Character.findOne({ shareId })
      .select('shareId name race archetype overall_tier overall_score rivals_wins created_at spins elementWeaknesses share_in_gallery portraitUrl portraitRegeneratedAt userId')
      .lean()

    if (!character) {
      return reply.code(404).send({ error: 'Character not found' })
    }

    const viewerId = (request as any).userId as string | undefined
    const isOwner = !!viewerId && !!character.userId
      && (character.userId as mongoose.Types.ObjectId).toString() === viewerId
    // Strip userId before sending — viewers shouldn't see the owner's id.
    const { userId: _omit, ...payload } = character as typeof character & { userId?: unknown }
    void _omit
    return reply.send({ ...payload, isOwner })
  })

  // POST /characters/:shareId/portrait — generate an AI portrait.
  //
  // Two modes, both rate-limited at 10/5min per IP (each gen costs ~$0.003):
  //   • Default (no query)   — anyone can trigger lazy backfill of a missing
  //                            portrait. Returns the cached URL if already
  //                            generated. Logged-out viewers populate old
  //                            characters this way the first time they're
  //                            opened, with no auth required.
  //   • ?regenerate=1        — owner-only one-time re-roll. Replaces the
  //                            existing URL. Subsequent regen attempts get
  //                            409. The model tracks this via
  //                            portraitRegeneratedAt.
  fastify.post('/characters/:shareId/portrait', {
    config: { rateLimit: { max: 10, timeWindow: '5 minutes' } },
  }, async (request, reply) => {
    if (!portraitsEnabled()) {
      return reply.code(503).send({ error: 'Portrait generation is not configured on this server' })
    }

    const { shareId } = request.params as { shareId: string }
    const { regenerate } = request.query as { regenerate?: string }
    const wantsRegen = regenerate === '1' || regenerate === 'true'
    const userId = (request as any).userId

    const character = await Character.findOne({ shareId })
    if (!character) {
      return reply.code(404).send({ error: 'Character not found' })
    }

    if (wantsRegen) {
      // Regenerate path: must be the owner, and they only get one shot.
      if (!userId) return reply.code(401).send({ error: 'Login required to regenerate a portrait' })
      if (!character.userId || !character.userId.equals(new mongoose.Types.ObjectId(userId))) {
        return reply.code(403).send({ error: 'You can only regenerate your own characters' })
      }
      if (character.portraitRegeneratedAt) {
        return reply.code(409).send({ error: 'This character has already used its one regenerate' })
      }
      // Fall through to generation — we'll stamp portraitRegeneratedAt on success.
    } else if (character.portraitUrl) {
      // Default path: cache hit. Anyone can read this — no auth needed.
      return reply.send({ url: character.portraitUrl, cached: true })
    }

    // Pull a "signature power" from the spins blob — first power result is
    // the one the in-app summary uses too, so prompts stay consistent with
    // what the player reads on their card.
    const spins = (character.spins as Array<{ category: string; resultLabel: string }>) ?? []
    const topPower = spins.find(s => s.category === 'power')?.resultLabel

    const result = await generatePortrait({
      // Suffix the regen shareId so it lands at a new R2 key — otherwise
      // CDN caches would still serve the old image for hours via R2's
      // immutable cache-control headers.
      shareId:   wantsRegen ? `${character.shareId}-r${Date.now()}` : character.shareId,
      name:      character.name,
      race:      character.race,
      archetype: character.archetype,
      topPower,
    })

    if (!result.ok) {
      fastify.log.warn({ shareId, reason: result.reason, message: result.message }, 'portrait generation failed')
      // 502 keeps the failure visible in metrics without leaking the upstream
      // detail to the client. The frontend treats any non-2xx as "stay on
      // letter sigil", so the user just sees the existing fallback.
      return reply.code(502).send({ error: 'Portrait generation failed' })
    }

    character.portraitUrl = result.url
    if (wantsRegen) character.portraitRegeneratedAt = new Date()
    await character.save()

    return reply.code(201).send({ url: result.url, cached: false, regenerated: wantsRegen })
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
    const userId = (request as any).userId
    if (!userId) return reply.code(401).send({ error: 'not authenticated' })

    const { shareId } = request.params as { shareId: string }
    const { share_in_gallery } = request.body as { share_in_gallery: boolean }

    const character = await Character.findOneAndUpdate(
      { shareId, userId: new mongoose.Types.ObjectId(userId) },
      { share_in_gallery },
      { new: true }
    ).lean()

    if (!character) {
      return reply.code(404).send({ error: 'Character not found or not yours' })
    }

    // Mark gallery_share event when the toggle flips ON (not on toggle-off).
    if (share_in_gallery) {
      try {
        const user = await User.findById(userId)
        if (user) await markEvent(user, 'gallery_share')
      } catch (err) {
        fastify.log.warn({ err }, 'Failed to mark gallery_share challenge event')
      }
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
      .select('shareId name race archetype overall_tier overall_score rivals_wins created_at spins elementWeaknesses share_in_gallery portraitUrl portraitRegeneratedAt')
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
  // Requires authentication AND character ownership. Server-side battle resolution
  // (rivals-ws.ts) is the source of truth for whether a win actually occurred; this
  // endpoint just records it against a specific character belonging to the caller.
  fastify.patch('/characters/:shareId/rivals-win', {
    config: {
      rateLimit: {
        max: 30,
        timeWindow: '10 minutes',
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).userId
    if (!userId) return reply.code(401).send({ error: 'not authenticated' })

    const { shareId } = request.params as { shareId: string }
    const character = await Character.findOneAndUpdate(
      { shareId, userId: new mongoose.Types.ObjectId(userId) },
      { $inc: { rivals_wins: 1 } },
      { new: true }
    ).lean()

    if (!character) {
      return reply.code(404).send({ error: 'Character not found or not yours' })
    }

    return reply.send({ rivals_wins: character.rivals_wins })
  })
}
