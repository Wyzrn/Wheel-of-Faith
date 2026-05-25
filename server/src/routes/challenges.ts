import type { FastifyInstance } from 'fastify'
import { User } from '../models/User.js'
import { DAILY_CHALLENGES, todayStr, markChallengeProgress, CHALLENGE_TYPES, type ChallengeType } from '../lib/challenges.js'

export async function challengeRoutes(app: FastifyInstance) {
  // ── GET /challenges/daily ───────────────────────────────────────────────────
  // Returns today's challenges with three states per entry:
  //   status = 'locked'   → user has not yet qualified today
  //   status = 'ready'    → user qualified, can /claim
  //   status = 'claimed'  → already claimed today
  app.get('/challenges/daily', async (req: any, reply) => {
    const today = todayStr()
    if (!req.userId) {
      return reply.send({
        challenges: DAILY_CHALLENGES.map(c => ({ ...c, status: 'locked' as const, completed: false })),
      })
    }
    const user = await User.findById(req.userId).lean()
    const progressToday = new Set(
      (user?.challengesProgress ?? []).filter(c => c.date === today).map(c => c.type),
    )
    const completedToday = new Set(
      (user?.challengesCompleted ?? []).filter(c => c.date === today).map(c => c.type),
    )
    reply.send({
      challenges: DAILY_CHALLENGES.map(c => {
        const claimed = completedToday.has(c.type)
        const ready = progressToday.has(c.type) && !claimed
        const status: 'locked' | 'ready' | 'claimed' = claimed ? 'claimed' : ready ? 'ready' : 'locked'
        return { ...c, status, completed: claimed }
      }),
    })
  })

  // ── POST /challenges/progress ──────────────────────────────────────────────
  // Marks the authenticated user's progress for a challenge type. Idempotent.
  // Note: server-side game events (spin completion, rivals win, shop visit) also
  // call markChallengeProgress() directly. This route is a client-side hint for
  // browse-style events like shop_visit where there's no server interaction.
  app.post('/challenges/progress', {
    config: { rateLimit: { max: 30, timeWindow: '1m' } },
  }, async (req: any, reply) => {
    if (!req.userId) return reply.status(401).send({ error: 'login required' })
    const { type } = req.body as { type: string }
    if (!CHALLENGE_TYPES.includes(type as ChallengeType)) {
      return reply.status(400).send({ error: 'unknown challenge type' })
    }
    // Restrict client-initiated progress to types that genuinely lack a server hook.
    // spin_complete is granted by character POST; rivals_win by WS battle resolve.
    // Allowing the client to mark those here would re-open the original bypass.
    if (type !== 'shop_visit') {
      return reply.status(403).send({ error: 'this challenge is granted by server-side events only' })
    }
    const user = await User.findById(req.userId)
    if (!user) return reply.status(404).send({ error: 'user not found' })
    const added = await markChallengeProgress(user, type as ChallengeType)
    reply.send({ ok: true, newlyMarked: added })
  })

  // ── POST /challenges/:type/claim ────────────────────────────────────────────
  // Requires a matching progress entry from today. Fails with 403 if the user
  // hasn't qualified yet. Fails with 409 if already claimed today.
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

    const qualified = user.challengesProgress.some(c => c.type === type && c.date === today)
    if (!qualified) return reply.status(403).send({ error: 'challenge not completed yet', status: 'locked' })

    user.challengesCompleted.push({ type, date: today })
    user.shards += challenge.reward
    await user.save()

    reply.send({ shards: user.shards, reward: challenge.reward })
  })
}
