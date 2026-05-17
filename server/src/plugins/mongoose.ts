import fp from 'fastify-plugin'
import mongoose from 'mongoose'
import type { FastifyInstance } from 'fastify'

export const mongoosePlugin = fp(async (fastify: FastifyInstance) => {
  const uri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/wheel-of-fate'

  await mongoose.connect(uri, {
    maxPoolSize: 10,
    autoIndex: process.env.NODE_ENV !== 'production',
  })

  fastify.addHook('onClose', async () => {
    await mongoose.disconnect()
  })
})
