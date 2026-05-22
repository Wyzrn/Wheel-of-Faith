import type { FastifyInstance } from 'fastify'
import Stripe from 'stripe'
import { User } from '../models/User.js'
import { Purchase } from '../models/Purchase.js'

// Gamepass + shard pack definitions (duplicated here to avoid ESM cross-boundary issues)
const SHARD_PACKS: Record<string, { name: string; shards: number; priceUsd: number }> = {
  shards_500:   { name: 'Handful of Shards', shards: 500,    priceUsd: 99   },
  shards_2500:  { name: 'Shard Pouch',       shards: 2_500,  priceUsd: 399  },
  shards_10000: { name: 'Shard Chest',        shards: 10_000, priceUsd: 999  },
  shards_50000: { name: 'Shard Vault',        shards: 50_000, priceUsd: 3999 },
}

const GAMEPASS_COSTS: Record<string, number> = {
  double_shard_drop:  2_000,
  crit_surge:         1_500,
  revenge_protocol:     800,
  boss_magnet:        1_200,
  double_luck:        2_500,
  reroll_insurance:   1_800,
  blessed_wheel:      3_000,
  expanded_roster:      500,
  sell_bonus:         1_000,
  daily_booster:      3_500,
  legend_tag:           500,
  cursed_wheel:         800,
  gold_roster_frame:    600,
}

// Non-stackable passes (can only own one)
const NON_STACKABLE = new Set([
  'double_shard_drop', 'crit_surge', 'revenge_protocol', 'boss_magnet',
  'double_luck', 'reroll_insurance', 'blessed_wheel',
  'sell_bonus', 'daily_booster',
  'legend_tag', 'cursed_wheel', 'gold_roster_frame',
])

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY not set')
  return new Stripe(key)
}

export async function shopRoutes(app: FastifyInstance) {
  // ── GET /shop/me — current user's shards + gamepasses ─────────────────────
  app.get('/shop/me', async (req: any, reply) => {
    if (!req.userId) return reply.status(401).send({ error: 'login required' })
    const user = await User.findById(req.userId).lean()
    if (!user) return reply.status(404).send({ error: 'user not found' })
    reply.send({ shards: user.shards, gamepasses: user.gamepasses })
  })

  // ── POST /shop/checkout — create Stripe Checkout Session ──────────────────
  app.post('/shop/checkout', {
    config: { rateLimit: { max: 10, timeWindow: '1m' } },
  }, async (req: any, reply) => {
    if (!req.userId) return reply.status(401).send({ error: 'login required' })

    const { packId } = req.body as { packId: string }
    const pack = SHARD_PACKS[packId]
    if (!pack) return reply.status(400).send({ error: 'invalid pack' })

    const stripe = getStripe()
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173'

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: pack.priceUsd,
          product_data: {
            name: `${pack.name} — Wheel of Fate`,
            description: `${pack.shards.toLocaleString()} Fate Shards`,
          },
        },
        quantity: 1,
      }],
      metadata: {
        userId:   req.userId,
        packId,
        shards:   pack.shards.toString(),
      },
      success_url: `${frontendUrl}/shop?success=1&shards=${pack.shards}`,
      cancel_url:  `${frontendUrl}/shop?cancelled=1`,
    })

    // Record pending purchase
    await Purchase.create({
      userId:          req.userId,
      stripeSessionId: session.id,
      type:            'shard_pack',
      productId:       packId,
      shardsAwarded:   pack.shards,
      priceUsd:        pack.priceUsd,
      status:          'pending',
    })

    reply.send({ url: session.url })
  })

  // ── POST /shop/webhook — Stripe confirms payment ───────────────────────────
  // Must be registered with raw body — Stripe signature verification requires it.
  app.post('/shop/webhook', {
    config: { rawBody: true },
  }, async (req: any, reply) => {
    const sig = req.headers['stripe-signature']
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

    if (!webhookSecret) {
      app.log.warn('STRIPE_WEBHOOK_SECRET not set — skipping verification (dev only)')
    }

    let event: Stripe.Event
    try {
      const stripe = getStripe()
      const rawBody = (req as any).rawBody ?? req.body
      event = webhookSecret
        ? stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
        : (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Stripe.Event
    } catch (err: any) {
      app.log.error({ err }, 'Stripe webhook signature verification failed')
      return reply.status(400).send({ error: 'invalid signature' })
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const { userId, packId, shards } = session.metadata ?? {}

      if (!userId || !packId || !shards) {
        app.log.error({ sessionId: session.id }, 'Webhook missing metadata')
        return reply.send({ received: true })
      }

      const shardsNum = parseInt(shards)

      // Idempotency: only process once
      const existing = await Purchase.findOne({ stripeSessionId: session.id })
      if (existing?.status === 'completed') {
        return reply.send({ received: true })
      }

      await User.findByIdAndUpdate(userId, { $inc: { shards: shardsNum } })
      await Purchase.findOneAndUpdate(
        { stripeSessionId: session.id },
        { status: 'completed', stripePaymentIntentId: session.payment_intent as string, completedAt: new Date() },
        { upsert: true },
      )

      app.log.info({ userId, packId, shardsNum }, 'Shards credited via Stripe webhook')
    }

    reply.send({ received: true })
  })

  // ── POST /shop/gamepasses/:id — buy a gamepass with account shards ─────────
  app.post('/shop/gamepasses/:id', {
    config: { rateLimit: { max: 20, timeWindow: '1m' } },
  }, async (req: any, reply) => {
    if (!req.userId) return reply.status(401).send({ error: 'login required' })

    const { id } = req.params as { id: string }
    const cost = GAMEPASS_COSTS[id]
    if (cost === undefined) return reply.status(400).send({ error: 'unknown gamepass' })

    const user = await User.findById(req.userId)
    if (!user) return reply.status(404).send({ error: 'user not found' })

    // Non-stackable check
    if (NON_STACKABLE.has(id) && user.gamepasses.includes(id)) {
      return reply.status(409).send({ error: 'already owned' })
    }

    if (user.shards < cost) {
      return reply.status(402).send({ error: 'not enough shards', need: cost, have: user.shards })
    }

    user.shards -= cost
    user.gamepasses.push(id)
    await user.save()

    reply.send({ shards: user.shards, gamepasses: user.gamepasses })
  })

  // ── POST /shop/reroll-insurance/use — consume daily reroll ────────────────
  app.post('/shop/reroll-insurance/use', {
    config: { rateLimit: { max: 5, timeWindow: '1m' } },
  }, async (req: any, reply) => {
    if (!req.userId) return reply.status(401).send({ error: 'login required' })

    const user = await User.findById(req.userId).lean()
    if (!user) return reply.status(404).send({ error: 'user not found' })
    if (!user.gamepasses.includes('reroll_insurance')) {
      return reply.status(403).send({ error: 'gamepass not owned' })
    }

    // Track daily use via a lightweight cache key approach
    // We'll store the last-used date in the session/metadata — for now just authorize
    reply.send({ authorized: true })
  })

  // ── GET /shop/purchases — purchase history ─────────────────────────────────
  app.get('/shop/purchases', async (req: any, reply) => {
    if (!req.userId) return reply.status(401).send({ error: 'login required' })
    const purchases = await Purchase.find({ userId: req.userId, status: 'completed' })
      .sort({ completedAt: -1 }).limit(50).lean()
    reply.send({ purchases })
  })
}
