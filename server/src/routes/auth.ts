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
      .send({ user: { id: user._id, username: user.username, rivalsWins: user.rivalsWins, rivalsLosses: user.rivalsLosses, gamesPlayed: user.gamesPlayed, avatarUrl: user.avatarUrl } })
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
    reply.send({ user: { id: user._id, username: user.username, rivalsWins: user.rivalsWins, rivalsLosses: user.rivalsLosses, gamesPlayed: user.gamesPlayed, avatarUrl: user.avatarUrl, email: user.email } })
  })

  // ── Google OAuth start ────────────────────────────────────────────────────
  // Redirect to Google's OAuth consent screen
  app.get('/auth/google', async (req, reply) => {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? `${process.env.FRONTEND_URL}/api/auth/google/callback`
    if (!clientId) return reply.status(503).send({ error: 'Google OAuth not configured' })
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', 'openid email profile')
    url.searchParams.set('state', 'wof')
    reply.redirect(url.toString())
  })

  // ── Google OAuth callback ─────────────────────────────────────────────────
  app.get('/auth/google/callback', async (req, reply) => {
    const { code } = req.query as { code?: string }
    if (!code) return reply.redirect('/?auth_error=no_code')

    const clientId = process.env.GOOGLE_CLIENT_ID!
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!
    const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? `${process.env.FRONTEND_URL}/api/auth/google/callback`

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    })
    const tokens = await tokenRes.json() as { id_token?: string; error?: string }
    if (tokens.error) return reply.redirect('/?auth_error=token_exchange_failed')

    // Decode id_token (base64 JWT payload — no sig verify needed here, Google signs it)
    const payload = JSON.parse(Buffer.from(tokens.id_token!.split('.')[1], 'base64url').toString())
    const { sub: googleId, email, name, picture } = payload

    // Upsert user
    let user = await User.findOne({ googleId })
    if (!user) {
      // Check if email matches an existing user (account linking)
      user = await User.findOne({ email }) ?? null
      if (user) {
        user.googleId = googleId
        user.avatarUrl = picture
        await user.save()
      } else {
        // Create new user — derive username from Google name, ensure unique
        let username = (name ?? email?.split('@')[0] ?? 'player').replace(/\s+/g, '').slice(0, 20)
        const existing = await User.findOne({ username })
        if (existing) username = username + Math.floor(Math.random() * 9000 + 1000)
        user = await User.create({ username, email, googleId, avatarUrl: picture })
      }
    }

    const jwtToken = (app as any).jwt.sign({ id: user._id.toString(), username: user.username }, { expiresIn: '30d' })
    reply
      .setCookie('wof_token', jwtToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 })
      .redirect('/?auth=google_ok')
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
        avatarUrl: user.avatarUrl,
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
