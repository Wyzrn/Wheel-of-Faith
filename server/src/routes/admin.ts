import { Character } from '../models/Character.js'
import { User } from '../models/User.js'
import { requireAdmin } from '../lib/admin.js'
import type { FastifyPluginAsync } from 'fastify'

// Must stay in sync with src/lib/game/scoreTier.ts STAT_WEIGHTS
const STAT_WEIGHTS: Record<string, number> = {
  fightingSkill: 0.16,
  strength:      0.13,
  durability:    0.13,
  speed:         0.11,
  powerMastery:  0.11,
  agility:       0.09,
  energyLevel:   0.09,
  iq:            0.07,
  weaponMastery: 0.06,
  potential:     0.03,
  charisma:      0.02,
}

// Must stay in sync with src/lib/game/scoreTier.ts TIER_THRESHOLDS.
const TIER_THRESHOLDS: Array<{ min: number; max: number; grade: string }> = [
  { min:   1, max:   3, grade: 'F-'            },
  { min:   4, max:   6, grade: 'F'             },
  { min:   7, max:   9, grade: 'F+'            },
  { min:  10, max:  12, grade: 'E-'            },
  { min:  13, max:  15, grade: 'E'             },
  { min:  16, max:  18, grade: 'E+'            },
  { min:  19, max:  21, grade: 'D-'            },
  { min:  22, max:  24, grade: 'D'             },
  { min:  25, max:  27, grade: 'D+'            },
  { min:  28, max:  31, grade: 'C-'            },
  { min:  32, max:  35, grade: 'C'             },
  { min:  36, max:  39, grade: 'C+'            },
  { min:  40, max:  44, grade: 'B-'            },
  { min:  45, max:  49, grade: 'B'             },
  { min:  50, max:  54, grade: 'B+'            },
  { min:  55, max:  59, grade: 'A-'            },
  { min:  60, max:  64, grade: 'A'             },
  { min:  65, max:  69, grade: 'A+'            },
  { min:  70, max:  74, grade: 'S-'            },
  { min:  75, max:  78, grade: 'S'             },
  { min:  79, max:  82, grade: 'S+'            },
  { min:  83, max:  86, grade: 'SS-'           },
  { min:  87, max:  89, grade: 'SS'            },
  { min:  90, max:  92, grade: 'SS+'           },
  { min:  93, max:  95, grade: 'SSS-'          },
  { min:  96, max:  97, grade: 'SSS'           },
  { min:  98, max:  99, grade: 'SSS+'          },
  { min: 100, max: 101, grade: 'Z-'            },
  { min: 102, max: 103, grade: 'Z'             },
  { min: 104, max: 105, grade: 'Z+'            },
  { min: 106, max: 107, grade: 'ZZ-'           },
  { min: 108, max: 109, grade: 'ZZ'            },
  { min: 110, max: 111, grade: 'ZZ+'           },
  { min: 112, max: 113, grade: 'ZZZ-'          },
  { min: 114, max: 115, grade: 'ZZZ'           },
  { min: 116, max: 117, grade: 'ZZZ+'          },
  { min: 118, max: 119, grade: 'Cosmic-'       },
  { min: 120, max: 121, grade: 'Cosmic'        },
  { min: 122, max: 123, grade: 'Cosmic+'       },
  { min: 124, max: 125, grade: 'Immortal-'     },
  { min: 126, max: 127, grade: 'Immortal'      },
  { min: 128, max: 129, grade: 'Immortal+'     },
  { min: 130, max: 131, grade: 'Celestial-'    },
  { min: 132, max: 133, grade: 'Celestial'     },
  { min: 134, max: 135, grade: 'Celestial+'    },
  { min: 136, max: 137, grade: 'Godly-'        },
  { min: 138, max: 139, grade: 'Godly'         },
  { min: 140, max: 141, grade: 'Godly+'        },
  { min: 142, max: 143, grade: 'Primordial-'   },
  { min: 144, max: 145, grade: 'Primordial'    },
  { min: 146, max: 147, grade: 'Primordial+'   },
  { min: 148, max: 149, grade: 'Absolute-'     },
  { min: 150, max: 151, grade: 'Absolute'      },
  { min: 152, max: 153, grade: 'Absolute+'     },
  { min: 154, max: 155, grade: 'Transcendent-' },
  { min: 156, max: 157, grade: 'Transcendent'  },
  { min: 158, max: 159, grade: 'Transcendent+' },
  { min: 160, max: 161, grade: 'Infinite-'     },
  { min: 162, max: 163, grade: 'Infinite'      },
  { min: 164, max: 165, grade: 'Infinite+'     },
]

const SCORE_MAX = 185

function scoreTier(score: number): string {
  const clamped = Math.max(1, Math.min(165, score))
  for (const t of TIER_THRESHOLDS) {
    if (clamped >= t.min && clamped <= t.max) return t.grade
  }
  return 'F-'
}

function computeOverallScore(statResults: Record<string, number>): number {
  let weighted = 0
  for (const [stat, weight] of Object.entries(STAT_WEIGHTS)) {
    weighted += (statResults[stat] ?? 0) * weight
  }
  return Math.round(Math.max(-20, Math.min(SCORE_MAX, weighted)))
}

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/admin/rerank — recompute overall_score + overall_tier for all characters
  // using current STAT_WEIGHTS. Protected by ADMIN_SECRET env var.
  fastify.post('/admin/rerank', async (request, reply) => {
    const secret = process.env.ADMIN_SECRET
    if (!secret || request.headers['x-admin-secret'] !== secret) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    const characters = await Character.find({}).select('_id spins').lean()

    let updated = 0
    let skipped = 0
    const bulkOps: Array<{ updateOne: { filter: object; update: object } }> = []

    for (const char of characters) {
      const spins = Array.isArray(char.spins) ? (char.spins as any[]) : []

      const statScores: Record<string, number> = {}
      for (const spin of spins) {
        if (
          spin.category &&
          typeof spin.score === 'number' &&
          STAT_WEIGHTS[spin.category as string] !== undefined
        ) {
          statScores[spin.category as string] = spin.score
        }
      }

      if (Object.keys(statScores).length === 0) {
        skipped++
        continue
      }

      const newScore = computeOverallScore(statScores)
      const newTier = scoreTier(newScore)

      bulkOps.push({
        updateOne: {
          filter: { _id: char._id },
          update: { $set: { overall_score: newScore, overall_tier: newTier } },
        },
      })
      updated++
    }

    if (bulkOps.length > 0) {
      await Character.bulkWrite(bulkOps)
    }

    return reply.send({ updated, skipped, total: characters.length })
  })

  // ── Developer sandbox endpoints (gated by username allowlist) ─────────────
  // All routes below require the caller's account to appear in ADMIN_USERNAMES.
  // The guard re-reads the user from the DB on every call so revoking admin
  // status takes effect immediately on the next request.

  // GET /admin/users?q= — search up to 25 users by username substring.
  fastify.get('/admin/users', async (req: any, reply) => {
    if (!(await requireAdmin(req, reply))) return
    const { q } = (req.query ?? {}) as { q?: string }
    const filter = q ? { username: { $regex: q.trim().slice(0, 32), $options: 'i' } } : {}
    const users = await User.find(filter)
      .sort({ createdAt: -1 })
      .limit(25)
      .select('_id username email shards gamepasses createdAt')
      .lean()
    reply.send({ users })
  })

  // PATCH /admin/users/:id — adjust shards (delta) and/or grant/revoke
  // gamepasses on a target account. Operations are independent and any
  // subset can be supplied.
  fastify.patch('/admin/users/:id', async (req: any, reply) => {
    if (!(await requireAdmin(req, reply))) return
    const { id } = req.params as { id: string }
    const body = (req.body ?? {}) as {
      shardsDelta?: number
      setShards?: number
      grantGamepass?: string
      revokeGamepass?: string
    }

    const user = await User.findById(id)
    if (!user) return reply.status(404).send({ error: 'user not found' })

    if (typeof body.setShards === 'number' && isFinite(body.setShards)) {
      user.shards = Math.max(0, Math.floor(body.setShards))
    }
    if (typeof body.shardsDelta === 'number' && isFinite(body.shardsDelta)) {
      user.shards = Math.max(0, (user.shards ?? 0) + Math.floor(body.shardsDelta))
    }
    if (typeof body.grantGamepass === 'string' && body.grantGamepass) {
      if (!user.gamepasses.includes(body.grantGamepass)) {
        user.gamepasses.push(body.grantGamepass)
      }
    }
    if (typeof body.revokeGamepass === 'string' && body.revokeGamepass) {
      user.gamepasses = user.gamepasses.filter((g) => g !== body.revokeGamepass)
    }

    await user.save()
    reply.send({
      user: {
        id: user._id, username: user.username,
        shards: user.shards, gamepasses: user.gamepasses,
      },
    })
  })

  // GET /admin/characters?q=&userId= — search characters by name, shareId,
  // race, or archetype. Optional userId narrows to a single account.
  fastify.get('/admin/characters', async (req: any, reply) => {
    if (!(await requireAdmin(req, reply))) return
    const { q, userId } = (req.query ?? {}) as { q?: string; userId?: string }
    const filter: Record<string, unknown> = {}
    if (userId) filter.userId = userId
    if (q) {
      const term = q.trim().slice(0, 64)
      filter.$or = [
        { name:      { $regex: term, $options: 'i' } },
        { shareId:   { $regex: term, $options: 'i' } },
        { race:      { $regex: term, $options: 'i' } },
        { archetype: { $regex: term, $options: 'i' } },
      ]
    }
    const characters = await Character.find(filter)
      .sort({ created_at: -1 })
      .limit(25)
      .select('_id shareId userId name race archetype overall_score overall_tier created_at')
      .lean()
    reply.send({ characters })
  })

  // GET /admin/characters/:shareId — full character document including spins.
  fastify.get('/admin/characters/:shareId', async (req: any, reply) => {
    if (!(await requireAdmin(req, reply))) return
    const { shareId } = req.params as { shareId: string }
    const character = await Character.findOne({ shareId }).lean()
    if (!character) return reply.status(404).send({ error: 'character not found' })
    reply.send({ character })
  })

  // PATCH /admin/characters/:shareId — rewrite individual spin entries by
  // index, optionally recompute overall_score/tier using current weights, or
  // overwrite name/race/archetype/elementWeaknesses directly.
  fastify.patch('/admin/characters/:shareId', async (req: any, reply) => {
    if (!(await requireAdmin(req, reply))) return
    const { shareId } = req.params as { shareId: string }
    const body = (req.body ?? {}) as {
      name?:              string
      race?:              string
      archetype?:         string
      elementWeaknesses?: string[]
      overall_score?:     number
      overall_tier?:      string
      recomputeOverall?:  boolean
      spinPatches?:       Array<{ index: number; patch: Record<string, unknown> }>
    }

    const character = await Character.findOne({ shareId })
    if (!character) return reply.status(404).send({ error: 'character not found' })

    if (typeof body.name === 'string')      character.name = body.name.slice(0, 80)
    if (typeof body.race === 'string')      character.race = body.race.slice(0, 80)
    if (typeof body.archetype === 'string') character.archetype = body.archetype.slice(0, 80)
    if (Array.isArray(body.elementWeaknesses)) {
      character.elementWeaknesses = body.elementWeaknesses
        .filter((e) => typeof e === 'string')
        .slice(0, 8)
    }

    // Apply targeted spin patches. Spins is a Mixed blob, so we read,
    // mutate, and reassign as a whole so Mongoose persists the change.
    if (Array.isArray(body.spinPatches) && body.spinPatches.length > 0) {
      const spins = Array.isArray(character.spins) ? [...(character.spins as any[])] : []
      for (const { index, patch } of body.spinPatches) {
        if (!Number.isInteger(index) || index < 0 || index >= spins.length) continue
        if (!patch || typeof patch !== 'object') continue
        spins[index] = { ...spins[index], ...patch }
      }
      character.spins = spins as any
      character.markModified('spins')
    }

    if (body.recomputeOverall) {
      const spins = Array.isArray(character.spins) ? (character.spins as any[]) : []
      const statScores: Record<string, number> = {}
      for (const spin of spins) {
        if (spin?.category && typeof spin.score === 'number' &&
            STAT_WEIGHTS[spin.category as string] !== undefined) {
          statScores[spin.category as string] = spin.score
        }
      }
      character.overall_score = computeOverallScore(statScores)
      character.overall_tier  = scoreTier(character.overall_score)
    } else {
      if (typeof body.overall_score === 'number' && isFinite(body.overall_score)) {
        character.overall_score = Math.round(body.overall_score)
      }
      if (typeof body.overall_tier === 'string') {
        character.overall_tier = body.overall_tier.slice(0, 16)
      }
    }

    await character.save()
    reply.send({ character: character.toObject() })
  })
}
