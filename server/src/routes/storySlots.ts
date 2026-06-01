import { nanoid } from 'nanoid'
import mongoose from 'mongoose'
import { StorySlot } from '../models/StorySlot.js'
import { generatePortrait, portraitsEnabled } from '../services/portraits.js'
import type { FastifyPluginAsync } from 'fastify'

export const storySlotRoutes: FastifyPluginAsync = async (fastify) => {

  // POST /story-slots — snapshot a save slot, return share URL
  fastify.post('/story-slots', {
    config: { rateLimit: { max: 10, timeWindow: '10 minutes' } },
    schema: {
      body: {
        type: 'object',
        required: ['slotData'],
        properties: {
          slotData: { type: 'object' },
        },
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).userId
    if (!userId) return reply.code(401).send({ error: 'Login required to save slots' })

    const { slotData } = request.body as { slotData: object }
    const shareId = nanoid(10)

    await StorySlot.create({
      shareId,
      userId: new mongoose.Types.ObjectId(userId),
      slotData,
    })

    return reply.code(201).send({
      shareId,
      url: `/story/slot/${shareId}`,
    })
  })

  // GET /story-slots/mine — fetch all linked slots for the current user.
  // Returns autosaves and share snapshots, newest first. Client picks the
  // most-recent per slotId, so autosaves naturally win once they exist.
  fastify.get('/story-slots/mine', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const userId = (request as any).userId
    if (!userId) return reply.code(401).send({ error: 'Login required' })
    const slots = await StorySlot.find({ userId }).sort({ updated_at: -1, created_at: -1 }).lean()
    return reply.send(slots)
  })

  // POST /story-slots/autosave — silent upsert from the client at safe
  // checkpoints (crystal open, stat-point apply, spin use, sell/dismantle,
  // battle end, endless end). Replaces the prior autosave row for the same
  // (userId, slotId) so the collection doesn't grow unbounded.
  fastify.post('/story-slots/autosave', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    schema: {
      body: {
        type: 'object',
        required: ['slotData'],
        properties: {
          slotData: { type: 'object' },
        },
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).userId
    if (!userId) return reply.code(401).send({ error: 'Login required' })

    const { slotData } = request.body as { slotData: { id?: number } & object }
    const slotId = slotData?.id
    if (typeof slotId !== 'number' || slotId < 1 || slotId > 4) {
      return reply.code(400).send({ error: 'slotData.id must be 1..4' })
    }

    const now = new Date()
    // Upsert the autosave row. New rows get a fresh shareId so the unique
    // index is satisfied — clients should never share an autosave URL since
    // it changes underneath them, but the column requires a value.
    await StorySlot.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId), slotId, isAutosave: true },
      {
        $set:         { slotData, updated_at: now },
        $setOnInsert: { shareId: `auto_${nanoid(12)}`, isAutosave: true, slotId, created_at: now, userId: new mongoose.Types.ObjectId(userId) },
      },
      { upsert: true, new: true },
    )

    return reply.code(204).send()
  })

  // POST /story-slots/roster-portrait — generate an AI portrait for an
  // Ascension roster character. Ascension chars live in the local save slot
  // (never POSTed to /api/characters), so they have no shareId and can't
  // use the /characters/:shareId/portrait endpoint. The client passes the
  // character's local UUID + identity fields; the server generates and
  // returns a URL. The client persists the URL back into the roster entry
  // via the existing cloudAutosave pipeline.
  //
  // Cache: we trust the client to send `existingUrl` when present (a fresh
  // expand of the same character before autosave has flushed). The 30/5min
  // IP rate limit caps abuse — worst case ~$0.30/5min per attacker.
  fastify.post('/story-slots/roster-portrait', {
    config: { rateLimit: { max: 30, timeWindow: '5 minutes' } },
    schema: {
      body: {
        type: 'object',
        required: ['charId', 'name', 'race', 'archetype'],
        properties: {
          charId:      { type: 'string', minLength: 1, maxLength: 64 },
          name:        { type: 'string', minLength: 1, maxLength: 80 },
          race:        { type: 'string', minLength: 1, maxLength: 80 },
          archetype:   { type: 'string', minLength: 1, maxLength: 80 },
          topPower:    { type: 'string', maxLength: 120 },
          extraPowers: { type: 'array', items: { type: 'string', maxLength: 120 }, maxItems: 3 },
          weapon:      { type: 'string', maxLength: 120 },
          gender:      { type: 'string', maxLength: 32 },
          height:      { type: 'string', maxLength: 32 },
          existingUrl: { type: 'string', maxLength: 500 },
          regenerate:  { type: 'boolean' },
        },
      },
    },
  }, async (request, reply) => {
    if (!portraitsEnabled()) {
      return reply.code(503).send({ error: 'Portrait generation is not configured on this server' })
    }
    const userId = (request as any).userId
    if (!userId) return reply.code(401).send({ error: 'Login required to generate roster portraits' })

    const body = request.body as {
      charId: string; name: string; race: string; archetype: string
      topPower?: string; extraPowers?: string[]; weapon?: string;
      gender?: string; height?: string;
      existingUrl?: string; regenerate?: boolean
    }

    // Cache hit: client has a URL and isn't asking for a re-roll.
    if (body.existingUrl && !body.regenerate) {
      return reply.send({ url: body.existingUrl, cached: true })
    }

    // Suffix the seed when regenerating so the R2 key is unique — otherwise
    // CDN caches keep serving the old image for hours.
    const seedKey = body.regenerate ? `${body.charId}-r${Date.now()}` : body.charId

    const result = await generatePortrait({
      shareId:     `ascension-${seedKey}`,
      name:        body.name,
      race:        body.race,
      archetype:   body.archetype,
      topPower:    body.topPower,
      extraPowers: body.extraPowers,
      weapon:      body.weapon,
      gender:      body.gender,
      height:      body.height,
    })

    if (!result.ok) {
      fastify.log.warn({ charId: body.charId, reason: result.reason, message: result.message },
        'roster portrait generation failed')
      return reply.code(502).send({ error: 'Portrait generation failed' })
    }

    return reply.code(201).send({ url: result.url, cached: false, regenerated: !!body.regenerate })
  })

  // GET /story-slots/:shareId — fetch a shared slot snapshot
  fastify.get('/story-slots/:shareId', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { shareId } = request.params as { shareId: string }
    const slot = await StorySlot.findOne({ shareId }).lean()
    if (!slot) return reply.code(404).send({ error: 'Slot not found' })
    return reply.send(slot)
  })
}
