import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { createApp } from '../src/app.js'
import type { FastifyInstance } from 'fastify'
import { Character } from '../src/models/Character.js'

let mongod: MongoMemoryServer
let app: FastifyInstance

// Override MONGODB_URI to use in-memory server
beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  process.env.MONGODB_URI = mongod.getUri()
  app = await createApp()
})

afterAll(async () => {
  await app.close()
  await mongoose.disconnect()
  await mongod.stop()
})

afterEach(async () => {
  await Character.deleteMany({})
})

const validBody = () => ({
  name: 'Kira the Bold',
  race: 'Human',
  archetype: 'Warrior',
  overall_score: 72,
  overall_tier: 'B+',
  spins: [{ category: 'race', resultLabel: 'Human' }],
  session_started_at: new Date(Date.now() - 91_000).toISOString(),
})

describe('POST /api/characters', () => {
  it('returns 201 with { shareId, url } for a valid body with session_started_at 91s ago', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/characters',
      payload: validBody(),
      headers: { 'x-forwarded-for': '203.0.113.1', 'content-type': 'application/json' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.shareId).toMatch(/^[A-Za-z0-9_-]{10}$/)
    expect(body.url).toBe(`/character/${body.shareId}`)
  })

  it('returns 422 with error "Session too short" when session_started_at is 89s ago', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/characters',
      payload: { ...validBody(), session_started_at: new Date(Date.now() - 89_000).toISOString() },
      headers: { 'x-forwarded-for': '203.0.113.2', 'content-type': 'application/json' },
    })
    expect(res.statusCode).toBe(422)
    const body = res.json()
    expect(body.error).toBe('Session too short')
  })

  it('returns 400 when name is missing (schema validation)', async () => {
    const { name: _name, ...bodyWithoutName } = validBody()
    const res = await app.inject({
      method: 'POST',
      url: '/api/characters',
      payload: bodyWithoutName,
      headers: { 'x-forwarded-for': '203.0.113.3', 'content-type': 'application/json' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when name exceeds 40 characters', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/characters',
      payload: { ...validBody(), name: 'A'.repeat(41) },
      headers: { 'x-forwarded-for': '203.0.113.4', 'content-type': 'application/json' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 429 on the 6th POST from the same IP within 10 minutes', async () => {
    // Use a unique IP to avoid pollution from other tests in the same app instance
    const ip = '10.0.0.99'
    let lastRes: Awaited<ReturnType<typeof app.inject>> | null = null

    for (let i = 0; i < 6; i++) {
      lastRes = await app.inject({
        method: 'POST',
        url: '/api/characters',
        payload: { ...validBody(), session_started_at: new Date(Date.now() - 91_000).toISOString() },
        headers: { 'x-forwarded-for': ip, 'content-type': 'application/json' },
      })
    }

    expect(lastRes!.statusCode).toBe(429)
  })
})

describe('GET /api/characters/:shareId', () => {
  it('returns 200 and the saved character doc for a valid shareId', async () => {
    // First create a character via POST
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/characters',
      payload: validBody(),
      headers: { 'x-forwarded-for': '203.0.113.10', 'content-type': 'application/json' },
    })
    const { shareId } = postRes.json()

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/characters/${shareId}`,
    })
    expect(getRes.statusCode).toBe(200)
    const doc = getRes.json()
    expect(doc.shareId).toBe(shareId)
    expect(doc.name).toBe('Kira the Bold')
  })

  it('returns 404 for an unknown shareId', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/characters/unknownid00',
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().error).toBe('Character not found')
  })

  it('returns 404 for a soft-deleted character', async () => {
    // Create via POST
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/characters',
      payload: validBody(),
      headers: { 'x-forwarded-for': '203.0.113.20', 'content-type': 'application/json' },
    })
    const { shareId } = postRes.json()

    // Soft-delete via raw collection write (bypasses pre-find hook)
    await Character.collection.updateOne(
      { shareId },
      { $set: { deleted_at: new Date() } }
    )

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/characters/${shareId}`,
    })
    expect(getRes.statusCode).toBe(404)
    expect(getRes.json().error).toBe('Character not found')
  })
})
