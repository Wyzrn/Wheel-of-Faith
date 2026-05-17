import { nanoid } from 'nanoid'
import { Character } from '../models/Character.js'
import type { FastifyPluginAsync } from 'fastify'

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
          overall_score:      { type: 'number', minimum: 0, maximum: 100 },
          overall_tier:       { type: 'string' },
          spins:              { type: 'array' },
          session_started_at: { type: 'string', format: 'date-time' },
          share_in_gallery:   { type: 'boolean' },
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
    })

    return reply.code(201).send({
      shareId: character.shareId,
      url: `/character/${character.shareId}`,
    })
  })

  // GET /characters/:shareId — fetch character by share ID (pre-find hook handles soft-delete)
  fastify.get('/characters/:shareId', async (request, reply) => {
    const { shareId } = request.params as { shareId: string }
    const character = await Character.findOne({ shareId }).lean()

    if (!character) {
      return reply.code(404).send({ error: 'Character not found' })
    }

    return reply.send(character)
  })
}
