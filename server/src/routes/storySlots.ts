import { nanoid } from 'nanoid'
import mongoose from 'mongoose'
import { StorySlot } from '../models/StorySlot.js'
import type { FastifyPluginAsync } from 'fastify'

export const storySlotRoutes: FastifyPluginAsync = async (fastify) => {

  // POST /story-slots — snapshot a save slot, return share URL
  fastify.post('/story-slots', {
    config: { rateLimit: { max: 10, timeWindow: '10 minutes' } },
    schema: {
      body: {
        type: 'object',
        required: ['slotData'],
        properties: {
          slotData: { type: 'object' },
        },
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).userId
    if (!userId) return reply.code(401).send({ error: 'Login required to save slots' })

    const { slotData } = request.body as { slotData: object }
    const shareId = nanoid(10)

    await StorySlot.create({
      shareId,
      userId: new mongoose.Types.ObjectId(userId),
      slotData,
    })

    return reply.code(201).send({
      shareId,
      url: `/story/slot/${shareId}`,
    })
  })

  // GET /story-slots/:shareId — fetch a shared slot snapshot
  fastify.get('/story-slots/:shareId', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { shareId } = request.params as { shareId: string }
    const slot = await StorySlot.findOne({ shareId }).lean()
    if (!slot) return reply.code(404).send({ error: 'Slot not found' })
    return reply.send(slot)
  })
}
