import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { User } from '../models/User.js'
import { Character } from '../models/Character.js'
import { markEvent } from '../lib/challenges.js'

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string
  }
}

export async function authRoutes(app: FastifyInstance) {
  // ── Register with username + password ────────────────────────────────────
  app.post('/auth/register', {
    config: { rateLimit: { max: 5, timeWindow: '1m' } },
  }, async (req, reply) => {
    const { username, email, password } = req.body as { username: string; email?: string; password: string }
    if (!username || !password) return reply.status(400).send({ error: 'username and password required' })
    if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(username)) {
      return reply.status(400).send({ error: 'username may only contain letters, numbers, _, ., - (3–24 chars)' })
    }
    if (password.length < 6) return reply.status(400).send({ error: 'password must be at least 6 characters' })

    const exists = await User.findOne({ $or: [{ username }, ...(email ? [{ email }] : [])] })
    if (exists) return reply.status(409).send({ error: 'username or email already taken' })

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await User.create({ username, email, passwordHash })

    const token = (app as any).jwt.sign({ id: user._id.toString(), username: user.username }, { expiresIn: '30d' })
    reply
      .setCookie('wof_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 })
      .send({ user: { id: user._id, username: user.username, rivalsWins: 0, rivalsLosses: 0, gamesPlayed: 0 } })
  })

  // ── Login with username + password ───────────────────────────────────────
  app.post('/auth/login', {
    config: { rateLimit: { max: 10, timeWindow: '1m' } },
  }, async (req, reply) => {
    const { username, password } = req.body as { username: string; password: string }
    const user = await User.findOne({ username })
    if (!user || !(await user.comparePassword(password))) {
      return reply.status(401).send({ error: 'invalid username or password' })
    }

    const token = (app as any).jwt.sign({ id: user._id.toString(), username: user.username }, { expiresIn: '30d' })
    reply
      .setCookie('wof_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 })
      .send({ user: { id: user._id, username: user.username, rivalsWins: user.rivalsWins, rivalsLosses: user.rivalsLosses, gamesPlayed: user.gamesPlayed } })
  })

  // ── Logout ────────────────────────────────────────────────────────────────
  app.post('/auth/logout', async (req, reply) => {
    reply.clearCookie('wof_token', { path: '/' }).send({ ok: true })
  })

  // ── Get current user (me) ─────────────────────────────────────────────────
  app.get('/auth/me', async (req, reply) => {
    if (!req.userId) return reply.status(401).send({ error: 'not authenticated' })
    // Update daily streak: increment if the user was here yesterday, reset to 1
    // if they skipped a day, no-op if they already visited today.
    const today    = new Date().toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
    let user = await User.findById(req.userId)
    if (!user) return reply.status(404).send({ error: 'user not found' })
    if (user.lastVisitDate !== today) {
      user.dailyStreak = user.lastVisitDate === yesterday ? (user.dailyStreak ?? 0) + 1 : 1
      user.lastVisitDate = today
      await user.save()
    }
    // Always-on daily_login challenge event — idempotent at count=1 since /auth/me
    // can fire many times per page; first call wins and downstream calls no-op
    // because markEvent increments unguarded, so we gate on todayCount.
    try {
      const existing = (user.challengesProgress ?? []).find(c => c.type === 'daily_login' && c.date === today)
      if (!existing) await markEvent(user, 'daily_login')
    } catch (err) {
      app.log.warn({ err }, 'Failed to mark daily_login challenge event')
    }
    reply.send({ user: {
      id: user._id, username: user.username,
      rivalsWins: user.rivalsWins, rivalsLosses: user.rivalsLosses, gamesPlayed: user.gamesPlayed,
      email: user.email, shards: user.shards ?? 0, gamepasses: user.gamepasses ?? [],
      dailyStreak: user.dailyStreak ?? 0, lastVisitDate: user.lastVisitDate ?? null,
    } })
  })

  // ── Get user profile (public) ─────────────────────────────────────────────
  app.get('/users/:username/profile', async (req, reply) => {
    const { username } = req.params as { username: string }
    const user = await User.findOne({ username }).lean()
    if (!user) return reply.status(404).send({ error: 'user not found' })

    const characters = await Character.find({ userId: user._id, deleted_at: null })
      .sort({ created_at: -1 }).limit(20).lean()

    reply.send({
      user: {
        username: user.username,
        rivalsWins: user.rivalsWins,
        rivalsLosses: user.rivalsLosses,
        gamesPlayed: user.gamesPlayed,
        createdAt: user.createdAt,
      },
      characters: characters.map(c => ({
        shareId: c.shareId,
        name: c.name,
        race: c.race,
        archetype: c.archetype,
        overall_score: c.overall_score,
        overall_tier: c.overall_tier,
        created_at: c.created_at,
      })),
    })
  })

  // ── Leaderboard — top 50 users by rivals wins ────────────────────────────
  app.get('/leaderboard', async (req, reply) => {
    const users = await User.find({ rivalsWins: { $gt: 0 } })
      .sort({ rivalsWins: -1 })
      .limit(50)
      .select('username rivalsWins rivalsLosses gamesPlayed')
      .lean()
    reply.send({ users })
  })

  // ── Rivals stats are now credited inside the WebSocket battle resolver ──
  // (rivals-ws.ts, case 'battle_result'). Both clients must report agreeing
  // outcomes (one win, one loss) before the server credits. Kept here as a
  // 410 stub so any cached/older client falls back gracefully rather than
  // failing silently or, worse, being trusted.
  app.post('/auth/rivals-result', async (_req, reply) => {
    return reply.status(410).send({ error: 'deprecated — wins are credited server-side via battle WS' })
  })
}
