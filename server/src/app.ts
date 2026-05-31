import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import websocket from '@fastify/websocket'
import { mongoosePlugin } from './plugins/mongoose.js'
import { characterRoutes } from './routes/characters.js'
import { authRoutes } from './routes/auth.js'
import { rivalsWsRoutes } from './routes/rivals-ws.js'
import { friendRoutes } from './routes/friends.js'
import { adminRoutes } from './routes/admin.js'
import { storySlotRoutes } from './routes/storySlots.js'
import { shopRoutes } from './routes/shop.js'
import { challengeRoutes } from './routes/challenges.js'
import { endlessRoutes } from './routes/endless.js'
import { clanRoutes } from './routes/clans.js'

export async function createApp() {
  const app = Fastify({
    logger: true,
    trustProxy: true,
  })

  // Preserve raw body for Stripe webhook signature verification
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, function (req, body, done) {
    ;(req as any).rawBody = body
    try { done(null, JSON.parse(body.toString())) } catch (err: any) { done(err) }
  })

  // CORS — accept the canonical FRONTEND_URL plus any explicit additional
  // origins listed in EXTRA_ORIGINS (comma-separated). The latter covers
  // the itch.io HTML5 game host, which serves the static build from a
  // randomized *.ssl.hwcdn.net / *.itch.zone subdomain inside an iframe.
  // localhost dev ports stay allowed unconditionally so `npm run dev`
  // continues to work without any env wiring.
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173'
  const extraOrigins = (process.env.EXTRA_ORIGINS ?? '')
    .split(',').map(s => s.trim()).filter(Boolean)
  const allowedOrigins = new Set<string>([
    frontendUrl,
    'http://localhost:5173',
    'http://localhost:4173',
    ...extraOrigins,
  ])
  const allowedOriginPatterns: RegExp[] = [
    /^https:\/\/[a-z0-9-]+\.itch\.zone$/i,        // itch HTML5 iframe host
    /^https:\/\/[a-z0-9-]+\.ssl\.hwcdn\.net$/i,   // itch CDN fallback
    /^https:\/\/html-classic\.itch\.zone$/i,      // itch alternate host
  ]
  await app.register(cors, {
    origin: (origin, cb) => {
      // Same-origin requests (no Origin header) and tools/curl are fine.
      if (!origin) return cb(null, true)
      if (allowedOrigins.has(origin)) return cb(null, true)
      if (allowedOriginPatterns.some(p => p.test(origin))) return cb(null, true)
      cb(new Error(`Origin ${origin} not allowed by CORS`), false)
    },
    credentials: true,
  })

  await app.register(rateLimit, {
    global: false,
  })

  await app.register(cookie)

  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production')
  }

  await app.register(jwt, {
    secret: jwtSecret ?? 'wheel-of-fate-dev-secret-change-in-production',
    cookie: { cookieName: 'wof_token', signed: false },
  })

  // Parse JWT on every request — non-throwing so unauthenticated routes work fine
  app.addHook('preHandler', async (req) => {
    try {
      const payload = await (req as any).jwtVerify()
      ;(req as any).userId = (payload as any).id
    } catch {
      // unauthenticated — req.userId stays undefined
    }
  })

  await app.register(websocket)
  await app.register(mongoosePlugin)
  await app.register(characterRoutes, { prefix: '/api' })
  await app.register(authRoutes, { prefix: '/api' })
  await app.register(rivalsWsRoutes, { prefix: '/api' })
  await app.register(friendRoutes, { prefix: '/api' })
  await app.register(adminRoutes, { prefix: '/api' })
  await app.register(storySlotRoutes, { prefix: '/api' })
  await app.register(shopRoutes, { prefix: '/api' })
  await app.register(challengeRoutes, { prefix: '/api' })
  await app.register(endlessRoutes, { prefix: '/api' })
  await app.register(clanRoutes, { prefix: '/api' })

  if (process.env.NODE_ENV === 'production') {
    const handlerPath = new URL('../../build/handler.js', import.meta.url).href
    const { handler } = await import(handlerPath)
    app.setNotFoundHandler((request, reply) => {
      reply.hijack()
      handler(request.raw, reply.raw)
    })
  }

  return app
}
