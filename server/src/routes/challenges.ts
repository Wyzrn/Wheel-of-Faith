import type { FastifyInstance } from 'fastify'
import { User } from '../models/User.js'
import {
  CHALLENGE_POOL, CLIENT_GRANTABLE_EVENTS, pickDailyChallenges, todayStr, markEvent, todayCount,
} from '../lib/challenges.js'

export async function challengeRoutes(app: FastifyInstance) {
  // ── GET /challenges/daily ───────────────────────────────────────────────────
  // Returns today's 4 deterministically-shuffled challenges with per-challenge
  // status (locked / ready / claimed) and progress fraction (current/threshold).
  app.get('/challenges/daily', async (req: any, reply) => {
    const today = todayStr()
    const todays = pickDailyChallenges(today)

    if (!req.userId) {
      return reply.send({
        challenges: todays.map(c => ({
          type: c.type, name: c.name, description: c.description, reward: c.reward, icon: c.icon,
          threshold: c.threshold, progress: 0, status: 'locked' as const, completed: false,
        })),
      })
    }
    const user = await User.findById(req.userId).lean()
    const completedToday = new Set(
      (user?.challengesCompleted ?? []).filter(c => c.date === today).map(c => c.type),
    )
    const progressByEvent = new Map<string, number>()
    for (const p of user?.challengesProgress ?? []) {
      if (p.date === today) progressByEvent.set(p.type, p.count ?? 1)
    }

    reply.send({
      challenges: todays.map(c => {
        const progress = progressByEvent.get(c.event) ?? 0
        const claimed  = completedToday.has(c.type)
        const ready    = !claimed && progress >= c.threshold
        const status: 'locked' | 'ready' | 'claimed' = claimed ? 'claimed' : ready ? 'ready' : 'locked'
        return {
          type: c.type, name: c.name, description: c.description, reward: c.reward, icon: c.icon,
          threshold: c.threshold, progress: Math.min(progress, c.threshold), status, completed: claimed,
        }
      }),
    })
  })

  // ── POST /challenges/progress ──────────────────────────────────────────────
  // Client-initiated event hint. Only events in CLIENT_GRANTABLE_EVENTS are
  // accepted; everything else must be marked by a server-side hook (POST
  // /characters, WS battle resolution, etc.) so the client can't self-grant.
  app.post('/challenges/progress', {
    config: { rateLimit: { max: 30, timeWindow: '1m' } },
  }, async (req: any, reply) => {
    if (!req.userId) return reply.status(401).send({ error: 'login required' })
    const { type } = req.body as { type: string }
    if (!CLIENT_GRANTABLE_EVENTS.has(type)) {
      return reply.status(403).send({ error: 'this event is granted by server-side hooks only' })
    }
    const user = await User.findById(req.userId)
    if (!user) return reply.status(404).send({ error: 'user not found' })
    // Idempotent per-day for visit-style events: cap at 1.
    if (todayCount(user, type) >= 1) return reply.send({ ok: true, count: 1 })
    const count = await markEvent(user, type, 1)
    reply.send({ ok: true, count })
  })

  // ── POST /challenges/:type/claim ────────────────────────────────────────────
  // Looks up the challenge by type, checks the linked event count vs threshold,
  // pays out shards and records the claim. Idempotent — second call returns 409.
  app.post('/challenges/:type/claim', {
    config: { rateLimit: { max: 20, timeWindow: '1m' } },
  }, async (req: any, reply) => {
    if (!req.userId) return reply.status(401).send({ error: 'login required' })
    const { type } = req.params as { type: string }
    const challenge = CHALLENGE_POOL.find(c => c.type === type)
    if (!challenge) return reply.status(404).send({ error: 'unknown challenge' })

    // Reject claims for challenges that aren't actually today's set — prevents
    // a user from claiming rewards from yesterday's pool that they never saw.
    const today = todayStr()
    const todaysSet = new Set(pickDailyChallenges(today).map(c => c.type))
    if (!todaysSet.has(type)) return reply.status(404).send({ error: 'not in today\'s challenges' })

    const user = await User.findById(req.userId)
    if (!user) return reply.status(404).send({ error: 'user not found' })

    const alreadyClaimed = user.challengesCompleted.some(c => c.type === type && c.date === today)
    if (alreadyClaimed) return reply.status(409).send({ error: 'already claimed today' })

    const progress = todayCount(user, challenge.event)
    if (progress < challenge.threshold) {
      return reply.status(403).send({
        error: 'challenge not completed yet',
        status: 'locked',
        progress, threshold: challenge.threshold,
      })
    }

    user.challengesCompleted.push({ type, date: today })
    user.shards += challenge.reward
    await user.save()

    reply.send({ shards: user.shards, reward: challenge.reward })
  })
}
