import type { FastifyInstance } from 'fastify'
import { User } from '../models/User.js'

const DAILY_CHALLENGES = [
  { type: 'spin_complete', name: 'Fate Seeker', description: 'Complete a full character spin session', reward: 50, icon: 'casino' },
  { type: 'rivals_win',    name: 'Battle Proven', description: 'Win any Rivals battle', reward: 100, icon: 'swords' },
  { type: 'shop_visit',   name: 'Window Shopping', description: 'Visit the Arcane Shop', reward: 25, icon: 'storefront' },
]

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function challengeRoutes(app: FastifyInstance) {
  app.get('/challenges/daily', async (req: any, reply) => {
    const today = todayStr()
    if (!req.userId) {
      return reply.send({ challenges: DAILY_CHALLENGES.map(c => ({ ...c, completed: false })) })
    }
    const user = await User.findById(req.userId).lean()
    const completedToday = new Set(
      (user?.challengesCompleted ?? []).filter(c => c.date === today).map(c => c.type)
    )
    reply.send({
      challenges: DAILY_CHALLENGES.map(c => ({ ...c, completed: completedToday.has(c.type) }))
    })
  })

  app.post('/challenges/:type/claim', {
    config: { rateLimit: { max: 10, timeWindow: '1m' } },
  }, async (req: any, reply) => {
    if (!req.userId) return reply.status(401).send({ error: 'login required' })
    const { type } = req.params as { type: string }
    const challenge = DAILY_CHALLENGES.find(c => c.type === type)
    if (!challenge) return reply.status(404).send({ error: 'unknown challenge' })

    const today = todayStr()
    const user = await User.findById(req.userId)
    if (!user) return reply.status(404).send({ error: 'user not found' })

    const alreadyClaimed = user.challengesCompleted.some(c => c.type === type && c.date === today)
    if (alreadyClaimed) return reply.status(409).send({ error: 'already claimed today' })

    user.challengesCompleted.push({ type, date: today })
    user.shards += challenge.reward
    await user.save()

    reply.send({ shards: user.shards, reward: challenge.reward })
  })
}
