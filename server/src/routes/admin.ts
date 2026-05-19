import { Character } from '../models/Character.js'
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

const TIER_THRESHOLDS: Array<{ min: number; max: number; grade: string }> = [
  { min:   1, max:   3, grade: 'F-'         },
  { min:   4, max:   6, grade: 'F'          },
  { min:   7, max:   9, grade: 'F+'         },
  { min:  10, max:  12, grade: 'E-'         },
  { min:  13, max:  15, grade: 'E'          },
  { min:  16, max:  18, grade: 'E+'         },
  { min:  19, max:  21, grade: 'D-'         },
  { min:  22, max:  24, grade: 'D'          },
  { min:  25, max:  27, grade: 'D+'         },
  { min:  28, max:  31, grade: 'C-'         },
  { min:  32, max:  35, grade: 'C'          },
  { min:  36, max:  39, grade: 'C+'         },
  { min:  40, max:  44, grade: 'B-'         },
  { min:  45, max:  49, grade: 'B'          },
  { min:  50, max:  54, grade: 'B+'         },
  { min:  55, max:  59, grade: 'A-'         },
  { min:  60, max:  64, grade: 'A'          },
  { min:  65, max:  69, grade: 'A+'         },
  { min:  70, max:  74, grade: 'S-'         },
  { min:  75, max:  78, grade: 'S'          },
  { min:  79, max:  82, grade: 'S+'         },
  { min:  83, max:  86, grade: 'SS-'        },
  { min:  87, max:  89, grade: 'SS'         },
  { min:  90, max:  92, grade: 'SS+'        },
  { min:  93, max:  95, grade: 'SSS-'       },
  { min:  96, max:  97, grade: 'SSS'        },
  { min:  98, max:  99, grade: 'SSS+'       },
  { min: 100, max: 101, grade: 'Z-'         },
  { min: 102, max: 103, grade: 'Z'          },
  { min: 104, max: 105, grade: 'Z+'         },
  { min: 106, max: 107, grade: 'ZZ-'        },
  { min: 108, max: 109, grade: 'ZZ'         },
  { min: 110, max: 111, grade: 'ZZ+'        },
  { min: 112, max: 113, grade: 'ZZZ-'       },
  { min: 114, max: 115, grade: 'ZZZ'        },
  { min: 116, max: 117, grade: 'ZZZ+'       },
  { min: 118, max: 119, grade: 'Celestial-' },
  { min: 120, max: 121, grade: 'Celestial'  },
  { min: 122, max: 123, grade: 'Celestial+' },
  { min: 124, max: 125, grade: 'Godly-'     },
  { min: 126, max: 127, grade: 'Godly'      },
  { min: 128, max: 130, grade: 'Primordial' },
  { min: 131, max: 134, grade: 'Primordial+'},
  { min: 135, max: 140, grade: 'Absolute-'  },
  { min: 141, max: 146, grade: 'Absolute'   },
  { min: 147, max: 150, grade: 'Absolute+'  },
]

function scoreTier(score: number): string {
  const clamped = Math.max(1, Math.min(150, score))
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
  return Math.round(Math.max(-20, Math.min(150, weighted)))
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
}
