import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { User } from '../models/User.js'
import { Character } from '../models/Character.js'

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string
  }
}

export async function authRoutes(app: FastifyInstance) {
  // ── Middleware: parse JWT from cookie and attach userId ──────────────────
  app.addHook('preHandler', async (req) => {
    try {
      const payload = await (req as any).jwtVerify()
      req.userId = (payload as any).id
    } catch {
      // Not authenticated — userId stays undefined
    }
  })

  // ── Register with username + password ────────────────────────────────────
  app.post('/auth/register', {
    config: { rateLimit: { max: 5, timeWindow: '1m' } },
  }, async (req, reply) => {
    const { username, email, password } = req.body as { username: string; email?: string; password: string }
    if (!username || !password) return reply.status(400).send({ error: 'username and password required' })
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
    const user = await User.findById(req.userId).lean()
    if (!user) return reply.status(404).send({ error: 'user not found' })
    reply.send({ user: { id: user._id, username: user.username, rivalsWins: user.rivalsWins, rivalsLosses: user.rivalsLosses, gamesPlayed: user.gamesPlayed, email: user.email } })
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

  // ── Update rivals stats after battle ─────────────────────────────────────
  app.post('/auth/rivals-result', async (req, reply) => {
    if (!req.userId) return reply.status(401).send({ error: 'not authenticated' })
    const { won } = req.body as { won: boolean }
    await User.findByIdAndUpdate(req.userId, {
      $inc: { gamesPlayed: 1, ...(won ? { rivalsWins: 1 } : { rivalsLosses: 1 }) },
    })
    reply.send({ ok: true })
  })
}
