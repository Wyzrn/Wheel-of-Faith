import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { Character } from '../src/models/Character.js'

let mongod: MongoMemoryServer

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

afterEach(async () => {
  await Character.deleteMany({})
})

const validData = () => ({
  shareId: 'abc1234567',
  name: 'Kira the Bold',
  race: 'Human',
  archetype: 'Warrior',
  overall_score: 72,
  overall_tier: 'B+',
  spins: [{ category: 'race', resultLabel: 'Human', tier: 'C' }],
  session_started_at: new Date(Date.now() - 120_000),
})

describe('Character model', () => {
  it('creates a character with all required fields and defaults deleted_at=null and share_in_gallery=false', async () => {
    const char = await Character.create(validData())
    expect(char.shareId).toBe('abc1234567')
    expect(char.name).toBe('Kira the Bold')
    expect(char.deleted_at).toBeNull()
    expect(char.share_in_gallery).toBe(false)
    expect(char.created_at).toBeInstanceOf(Date)
  })

  it('rejects a character missing shareId / name / race / archetype / overall_score / overall_tier / spins / session_started_at', async () => {
    await expect(Character.create({})).rejects.toThrow()
  })

  it('enforces unique shareId — second insert with same shareId throws E11000', async () => {
    await Character.create(validData())
    await expect(Character.create(validData())).rejects.toThrow(/E11000/)
  })

  it('stores spins as Mixed — accepts a heterogeneous array (objects with different shapes)', async () => {
    const heterogeneous = [
      { category: 'race', resultLabel: 'Elf', tier: 'A' },
      { category: 'stat', score: 85, label: 'Brilliant' },
      { category: 'power', name: 'Fireball', rarity: 'epic' },
    ]
    const char = await Character.create({ ...validData(), spins: heterogeneous })
    const found = await Character.findOne({ shareId: char.shareId }).lean()
    expect(found?.spins).toEqual(heterogeneous)
  })

  it('pre-find hook excludes soft-deleted docs: after setting deleted_at = new Date(), Character.findOne({ shareId }) returns null', async () => {
    const char = await Character.create(validData())
    // Use raw collection write to bypass the pre-find hook when setting the flag
    await Character.collection.updateOne(
      { shareId: char.shareId },
      { $set: { deleted_at: new Date() } }
    )
    const found = await Character.findOne({ shareId: char.shareId })
    expect(found).toBeNull()
  })

  it('pre-find hook excludes soft-deleted docs from Character.find() results', async () => {
    const char = await Character.create(validData())
    await Character.collection.updateOne(
      { shareId: char.shareId },
      { $set: { deleted_at: new Date() } }
    )
    const results = await Character.find({ shareId: char.shareId })
    expect(results).toHaveLength(0)
  })
})
