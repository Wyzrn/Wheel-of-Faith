import type { FastifyInstance } from 'fastify'
import mongoose from 'mongoose'
import { User } from '../models/User.js'
import { Friendship } from '../models/Friendship.js'

export async function friendRoutes(app: FastifyInstance) {

  // GET /friends — accepted friends list with stats
  app.get('/friends', async (req, reply) => {
    if (!req.userId) return reply.status(401).send({ error: 'not authenticated' })
    const userId = new mongoose.Types.ObjectId(req.userId)

    const friendships = await Friendship.find({
      $or: [{ requesterId: userId }, { recipientId: userId }],
      status: 'accepted',
    }).lean()

    const friendIds = friendships.map(f =>
      f.requesterId.toString() === req.userId ? f.recipientId : f.requesterId
    )

    const friends = await User.find({ _id: { $in: friendIds } })
      .select('_id username rivalsWins rivalsLosses gamesPlayed')
      .lean()

    reply.send({ friends })
  })

  // GET /friends/requests — pending requests sent TO me
  app.get('/friends/requests', async (req, reply) => {
    if (!req.userId) return reply.status(401).send({ error: 'not authenticated' })
    const userId = new mongoose.Types.ObjectId(req.userId)

    const requests = await Friendship.find({ recipientId: userId, status: 'pending' })
      .populate('requesterId', 'username rivalsWins')
      .lean()

    const formatted = requests.map(r => ({
      id: r._id.toString(),
      requester: {
        id: (r.requesterId as any)._id?.toString(),
        username: (r.requesterId as any).username,
        rivalsWins: (r.requesterId as any).rivalsWins,
      },
      createdAt: r.createdAt,
    }))

    reply.send({ requests: formatted })
  })

  // GET /friends/status/:username — check friendship status with a specific user
  app.get('/friends/status/:username', async (req, reply) => {
    if (!req.userId) return reply.send({ status: 'none' })
    const { username } = req.params as { username: string }
    const target = await User.findOne({ username }).lean()
    if (!target) return reply.send({ status: 'none' })

    const userId = new mongoose.Types.ObjectId(req.userId)
    const targetId = target._id as mongoose.Types.ObjectId

    const friendship = await Friendship.findOne({
      $or: [
        { requesterId: userId, recipientId: targetId },
        { requesterId: targetId, recipientId: userId },
      ],
    }).lean()

    if (!friendship) return reply.send({ status: 'none' })
    if (friendship.status === 'accepted') return reply.send({ status: 'friends' })
    if (friendship.requesterId.toString() === req.userId) {
      return reply.send({ status: 'requested' })
    }
    return reply.send({ status: 'pending', requestId: friendship._id.toString() })
  })

  // POST /friends/request — send a friend request by username
  app.post('/friends/request', {
    schema: {
      body: {
        type: 'object',
        required: ['username'],
        properties: { username: { type: 'string', minLength: 1, maxLength: 24 } },
      },
    },
  }, async (req, reply) => {
    if (!req.userId) return reply.status(401).send({ error: 'not authenticated' })
    const { username } = req.body as { username: string }

    const target = await User.findOne({ username }).lean()
    if (!target) return reply.status(404).send({ error: 'User not found' })
    if (target._id.toString() === req.userId) return reply.status(400).send({ error: 'Cannot friend yourself' })

    const requesterId = new mongoose.Types.ObjectId(req.userId)
    const recipientId = target._id as mongoose.Types.ObjectId

    const existing = await Friendship.findOne({
      $or: [
        { requesterId, recipientId },
        { requesterId: recipientId, recipientId: requesterId },
      ],
    })

    if (existing) {
      if (existing.status === 'accepted') return reply.status(409).send({ error: 'Already friends' })
      return reply.status(409).send({ error: 'Friend request already pending' })
    }

    await Friendship.create({ requesterId, recipientId })
    reply.status(201).send({ ok: true })
  })

  // POST /friends/accept/:id — accept a pending request
  app.post('/friends/accept/:id', async (req, reply) => {
    if (!req.userId) return reply.status(401).send({ error: 'not authenticated' })
    const { id } = req.params as { id: string }

    const friendship = await Friendship.findOneAndUpdate(
      { _id: id, recipientId: new mongoose.Types.ObjectId(req.userId), status: 'pending' },
      { status: 'accepted' },
      { new: true }
    )

    if (!friendship) return reply.status(404).send({ error: 'Request not found' })
    reply.send({ ok: true })
  })

  // POST /friends/decline/:id — decline or cancel a request
  app.post('/friends/decline/:id', async (req, reply) => {
    if (!req.userId) return reply.status(401).send({ error: 'not authenticated' })
    const { id } = req.params as { id: string }

    await Friendship.findOneAndDelete({
      _id: id,
      $or: [
        { recipientId: new mongoose.Types.ObjectId(req.userId) },
        { requesterId: new mongoose.Types.ObjectId(req.userId) },
      ],
    })

    reply.send({ ok: true })
  })

  // DELETE /friends/:friendId — remove an accepted friend
  app.delete('/friends/:friendId', async (req, reply) => {
    if (!req.userId) return reply.status(401).send({ error: 'not authenticated' })
    const { friendId } = req.params as { friendId: string }

    let fId: mongoose.Types.ObjectId
    try { fId = new mongoose.Types.ObjectId(friendId) } catch {
      return reply.status(400).send({ error: 'Invalid friend ID' })
    }
    const userId = new mongoose.Types.ObjectId(req.userId)

    await Friendship.findOneAndDelete({
      $or: [
        { requesterId: userId, recipientId: fId },
        { requesterId: fId, recipientId: userId },
      ],
    })

    reply.send({ ok: true })
  })
}
