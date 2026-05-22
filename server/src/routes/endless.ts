import type { FastifyInstance } from 'fastify'
import { EndlessScore } from '../models/EndlessScore.js'
import { User } from '../models/User.js'

export async function endlessRoutes(app: FastifyInstance) {
  // POST /endless/score — submit a score
  app.post('/endless/score', {
    config: { rateLimit: { max: 20, timeWindow: '1m' } },
  }, async (req: any, reply) => {
    if (!req.userId) return reply.status(401).send({ error: 'login required' })
    const { wave, characterName, race, archetype, tier } = req.body as {
      wave: number; characterName?: string; race?: string; archetype?: string; tier?: string
    }
    if (typeof wave !== 'number' || wave < 1) return reply.status(400).send({ error: 'invalid wave' })

    const user = await User.findById(req.userId).lean()
    if (!user) return reply.status(404).send({ error: 'user not found' })

    await EndlessScore.create({
      userId: req.userId,
      username: user.username,
      characterName: characterName ?? 'Unknown',
      race: race ?? '',
      archetype: archetype ?? '',
      tier: tier ?? '',
      wave,
    })

    reply.send({ ok: true })
  })

  // GET /endless/leaderboard — top 50 by wave
  app.get('/endless/leaderboard', {
    config: { rateLimit: { max: 60, timeWindow: '1m' } },
  }, async (req: any, reply) => {
    // One entry per user — their personal best wave
    const entries = await EndlessScore.aggregate([
      { $sort: { wave: -1 } },
      { $group: { _id: '$userId', wave: { $max: '$wave' }, username: { $first: '$username' }, characterName: { $first: '$characterName' }, race: { $first: '$race' }, archetype: { $first: '$archetype' }, tier: { $first: '$tier' } } },
      { $sort: { wave: -1 } },
      { $limit: 50 },
    ])
    reply.send({ entries })
  })

  // GET /endless/mine — personal best
  app.get('/endless/mine', async (req: any, reply) => {
    if (!req.userId) return reply.status(401).send({ error: 'login required' })
    const best = await EndlessScore.findOne({ userId: req.userId }).sort({ wave: -1 }).lean()
    reply.send({ best })
  })
}
