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

export async function createApp() {
  const app = Fastify({
    logger: true,
    trustProxy: true,
  })

  await app.register(cors, {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
  })

  await app.register(rateLimit, {
    global: false,
  })

  await app.register(cookie)

  await app.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'wheel-of-fate-dev-secret-change-in-production',
    cookie: { cookieName: 'wof_token', signed: false },
  })

  await app.register(websocket)
  await app.register(mongoosePlugin)
  await app.register(characterRoutes, { prefix: '/api' })
  await app.register(authRoutes, { prefix: '/api' })
  await app.register(rivalsWsRoutes, { prefix: '/api' })

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
