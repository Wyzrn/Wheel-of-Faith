// Guild war routes — Phase 2: war lifecycle (start, searching match,
// 24h prep, active window). Attack flow + scoring + MMR resolution land
// in Phase 3 once the data model has been exercised end-to-end.

import type { FastifyInstance } from 'fastify'
import mongoose from 'mongoose'
import { War, NON_TERMINAL_STATUSES, PREP_WINDOW_MS, ACTIVE_WINDOW_MS, matchmakingTolerance, computeMmrDelta, type IWar, type WarSize, type WarMemberSnapshot } from '../models/War.js'
import { Clan, clanRoleOf } from '../models/Clan.js'
import { User } from '../models/User.js'
import { mmrRankFor } from '../lib/mmrRanks.js'

const VALID_SIZES: WarSize[] = [5, 10, 15, 20]
const MIN_CLAN_MEMBERS_TO_WAR = 5

// Fetch every war participant's frozen team snapshot. Runs at match time
// and on start (so cancel-while-searching still has the right rosters
// recorded for audit).
async function snapshotMembers(memberIds: mongoose.Types.ObjectId[]): Promise<WarMemberSnapshot[]> {
  if (memberIds.length === 0) return []
  const users = await User.find({ _id: { $in: memberIds } })
    .select('_id username clanAttackTeam clanDefenseTeam').lean()
  // Preserve the leader's selected order rather than the Mongo find order so
  // the war roster reads in the same order the leader picked.
  const byId = new Map(users.map(u => [u._id.toString(), u]))
  return memberIds.map(id => {
    const u = byId.get(id.toString())
    const defense = u?.clanDefenseTeam ?? []
    return {
      userId:           id,
      username:         u?.username ?? 'Unknown',
      attackTeam:       u?.clanAttackTeam  ?? [],
      defenseTeam:      defense,
      // Mirrors defenseTeam at start; shrinks per attack as defenders die.
      defenseTeamAlive: [...defense],
      attacksRemaining: 2,
    }
  })
}

// Shape returned to /war/current — collapses the two-sided war doc into
// "my side" / "enemy side" so the client doesn't have to know which clan
// it's looking at.
async function serializeWarForClan(war: IWar, clanId: string) {
  const isClan1 = war.clan1Id.toString() === clanId
  const mineId = isClan1 ? war.clan1Id : war.clan2Id
  const enemyId = isClan1 ? war.clan2Id : war.clan1Id
  const myMembers    = isClan1 ? war.clan1Members : war.clan2Members
  const enemyMembers = isClan1 ? war.clan2Members : war.clan1Members
  const myScore    = isClan1 ? war.clan1Score : war.clan2Score
  const enemyScore = isClan1 ? war.clan2Score : war.clan1Score
  // Pull enemy clan meta only when matched.
  let enemyClan: any = null
  if (enemyId) {
    const c = await Clan.findById(enemyId).select('name tag badge mmr').lean()
    if (c) {
      const r = mmrRankFor(c.mmr ?? 0)
      enemyClan = { _id: c._id, name: c.name, tag: c.tag, badge: c.badge, mmr: c.mmr ?? 0, rank: r.id, rankLabel: r.label }
    }
  }
  return {
    _id: war._id,
    size: war.size,
    status: war.status,
    createdAt:   war.createdAt,
    matchedAt:   war.matchedAt,
    prepStartAt: war.prepStartAt,
    warStartAt:  war.warStartAt,
    warEndAt:    war.warEndAt,
    myClanId:    mineId,
    myMembers,
    myScore,
    enemyClan,
    enemyMembers,
    enemyScore,
  }
}

export async function warRoutes(app: FastifyInstance) {

  // ── Matchmaking sweep ──────────────────────────────────────────────────
  // Runs every 5 seconds. Within each size bracket, sorts searching wars
  // by MMR and pairs adjacent ones whose MMR delta is within the current
  // tolerance (tolerance grows the longer they've been searching). Each
  // pair transitions to status='prep', snapshots both rosters, and
  // schedules warStartAt = now + 24h, warEndAt = now + 48h.
  const sweepInterval = setInterval(async () => {
    try {
      for (const size of VALID_SIZES) {
        const searching = await War.find({ status: 'searching', size }).sort({ clan1Mmr: 1 })
        if (searching.length < 2) continue

        // Greedy adjacent pairing — by MMR sort, neighbours have the
        // smallest delta. Skip pairs that exceed tolerance for the
        // younger of the two wars.
        const used = new Set<string>()
        for (let i = 0; i < searching.length - 1; i++) {
          const a = searching[i]
          const b = searching[i + 1]
          if (used.has(a._id!.toString()) || used.has(b._id!.toString())) continue
          // Don't match a clan with itself (defensive — shouldn't happen
          // because only one war per clan is allowed).
          if (a.clan1Id.toString() === b.clan1Id.toString()) continue

          const now = Date.now()
          const ageSec = Math.max(
            (now - (a.createdAt?.getTime() ?? now)) / 1000,
            (now - (b.createdAt?.getTime() ?? now)) / 1000,
          )
          const tolerance = matchmakingTolerance(ageSec)
          const delta = Math.abs(a.clan1Mmr - b.clan1Mmr)
          if (delta > tolerance) continue

          // Pair them. a becomes the "clan1" side of the joint war;
          // b's roster moves into clan2 fields. Then mark b cancelled
          // so the matchmaking inbox doesn't see it again.
          const matchedAt = new Date()
          const prepStartAt = matchedAt
          const warStartAt = new Date(matchedAt.getTime() + PREP_WINDOW_MS)
          const warEndAt   = new Date(matchedAt.getTime() + PREP_WINDOW_MS + ACTIVE_WINDOW_MS)

          a.clan2Id        = b.clan1Id
          a.clan2MemberIds = b.clan1MemberIds
          a.clan2Mmr       = b.clan1Mmr
          a.clan2Members   = await snapshotMembers(b.clan1MemberIds)
          // Re-snapshot clan1 too (in case team picks changed between
          // /war/start and now).
          a.clan1Members   = await snapshotMembers(a.clan1MemberIds)
          a.status         = 'prep'
          a.matchedAt      = matchedAt
          a.prepStartAt    = prepStartAt
          a.warStartAt     = warStartAt
          a.warEndAt       = warEndAt
          await a.save()

          b.status = 'cancelled'   // logical merge — its data lives in `a` now
          await b.save()

          used.add(a._id!.toString())
          used.add(b._id!.toString())
        }
      }

      // Lifecycle transitions:
      //   prep → active when warStartAt passes.
      //   active → resolved when warEndAt passes (or every defender on one
      //     side is wiped — checked on each /war/attack call).
      // Resolution applies winnerClanId + mmrDelta + adjusts both clans' MMR.
      const now = new Date()
      await War.updateMany(
        { status: 'prep', warStartAt: { $lte: now } },
        { $set: { status: 'active' } },
      )

      // Find wars that should resolve (clock expired). Process individually
      // because each one needs a winner calc + MMR write.
      const expiring = await War.find({ status: 'active', warEndAt: { $lte: now } })
      for (const war of expiring) {
        await resolveWar(war, 'timer')
      }
    } catch (err) {
      app.log.warn({ err }, '[wars] matchmaking sweep failed')
    }
  }, 5_000)

  // Resolve a war NOW — tally the winner, compute MMR delta, apply to both
  // clans, persist. Idempotent: refuses if already resolved. Called by the
  // expiry sweep AND by /war/attack when one side is fully wiped.
  async function resolveWar(war: IWar, reason: 'timer' | 'wipe') {
    if (war.status === 'resolved' || war.status === 'cancelled') return
    war.status = 'resolved'

    const c1 = war.clan1Score, c2 = war.clan2Score
    if (c1 > c2 && war.clan1Id) {
      war.winnerClanId = war.clan1Id
      const { winnerGain, loserLoss } = computeMmrDelta(c1, c2, war.size)
      war.mmrDelta = winnerGain
      await Clan.findByIdAndUpdate(war.clan1Id, { $inc: { mmr: winnerGain } })
      if (war.clan2Id) await Clan.findByIdAndUpdate(war.clan2Id, { $inc: { mmr: -loserLoss } })
    } else if (c2 > c1 && war.clan2Id) {
      war.winnerClanId = war.clan2Id
      const { winnerGain, loserLoss } = computeMmrDelta(c2, c1, war.size)
      war.mmrDelta = winnerGain
      await Clan.findByIdAndUpdate(war.clan2Id, { $inc: { mmr: winnerGain } })
      await Clan.findByIdAndUpdate(war.clan1Id, { $inc: { mmr: -loserLoss } })
    } else {
      // Draw: no MMR movement. winnerClanId stays unset.
      war.mmrDelta = 0
    }
    await war.save()
    void reason  // future telemetry hook
  }

  // Clean up the interval if the app is torn down (mostly relevant in tests).
  app.addHook('onClose', async () => clearInterval(sweepInterval))

  // ── POST /clans/:id/war/start — leader/coLeader starts a war ───────────
  app.post('/clans/:id/war/start', {
    config: { rateLimit: { max: 3, timeWindow: '5m' } },
  }, async (req: any, reply) => {
    if (!req.userId) return reply.status(401).send({ error: 'login required' })
    const { id } = req.params as { id: string }
    const body = (req.body ?? {}) as { size?: number; memberIds?: string[] }

    const sizeRaw = Number(body.size)
    if (!VALID_SIZES.includes(sizeRaw as WarSize)) {
      return reply.status(400).send({ error: 'size must be 5, 10, 15, or 20' })
    }
    const size = sizeRaw as WarSize

    if (!Array.isArray(body.memberIds)) {
      return reply.status(400).send({ error: 'memberIds required' })
    }
    const memberIds = body.memberIds.filter((x): x is string => typeof x === 'string' && mongoose.Types.ObjectId.isValid(x))
    if (memberIds.length !== size) {
      return reply.status(400).send({ error: `pick exactly ${size} members for a ${size}v${size} war` })
    }

    const clan = await Clan.findById(id)
    if (!clan) return reply.status(404).send({ error: 'guild not found' })
    const role = clanRoleOf(clan, req.userId)
    if (role !== 'leader' && role !== 'coLeader') {
      return reply.status(403).send({ error: 'leader or co-leader only' })
    }
    if (clan.memberIds.length < MIN_CLAN_MEMBERS_TO_WAR) {
      return reply.status(403).send({ error: `need at least ${MIN_CLAN_MEMBERS_TO_WAR} members in the guild to start a war` })
    }

    // Every member id must belong to this clan.
    const memberSet = new Set(clan.memberIds.map(m => m.toString()))
    const allMine = memberIds.every(m => memberSet.has(m))
    if (!allMine) return reply.status(400).send({ error: 'one or more selected members are not in your guild' })

    // Refuse if this clan already has a non-terminal war.
    const existing = await War.findOne({
      $or: [{ clan1Id: clan._id }, { clan2Id: clan._id }],
      status: { $in: NON_TERMINAL_STATUSES },
    }).lean()
    if (existing) {
      return reply.status(409).send({ error: 'your guild already has an active war' })
    }

    const memberOids = memberIds.map(m => new mongoose.Types.ObjectId(m))
    const snapshot = await snapshotMembers(memberOids)

    const war = await War.create({
      size,
      status: 'searching',
      clan1Id: clan._id,
      clan1MemberIds: memberOids,
      clan1Members: snapshot,
      clan1Mmr: clan.mmr ?? 0,
    })
    reply.status(201).send({ war: await serializeWarForClan(war, (clan._id as any).toString()) })
  })

  // ── DELETE /clans/:id/war/cancel — cancel while searching ──────────────
  app.delete('/clans/:id/war/cancel', {
    config: { rateLimit: { max: 5, timeWindow: '1m' } },
  }, async (req: any, reply) => {
    if (!req.userId) return reply.status(401).send({ error: 'login required' })
    const { id } = req.params as { id: string }

    const clan = await Clan.findById(id).lean()
    if (!clan) return reply.status(404).send({ error: 'guild not found' })
    const role = clanRoleOf(clan as any, req.userId)
    if (role !== 'leader' && role !== 'coLeader') {
      return reply.status(403).send({ error: 'leader or co-leader only' })
    }

    // Only "searching" wars can be cancelled — once matched, the war runs
    // its course (forfeit logic is Phase 3 work).
    const war = await War.findOneAndUpdate(
      {
        $or: [{ clan1Id: clan._id }, { clan2Id: clan._id }],
        status: 'searching',
      },
      { $set: { status: 'cancelled' } },
      { new: true },
    )
    if (!war) return reply.status(404).send({ error: 'no searching war to cancel' })
    reply.send({ ok: true })
  })

  // ── POST /clans/:id/war/attack/:defenderUserId — perform an attack ─────
  // The client runs the battle simulation locally (it owns the BattleArena
  // engine + has both teams via /war/current), then submits which defenders
  // died and whether they won. Server validates structure and computes the
  // score authoritatively — the client cannot inflate either field.
  //
  // Scoring rule (per the design spec):
  //   • Attacker fully cleared the defender's remaining alive list → +3
  //   • Otherwise → +1 per kill (0..2)
  //
  // Defender permadeath: killed shareIds are removed from the snapshot's
  // defenseTeamAlive permanently. Once every member on one side has an
  // empty defenseTeamAlive, that side is wiped and the war resolves early.
  app.post('/clans/:id/war/attack/:defenderUserId', {
    config: { rateLimit: { max: 30, timeWindow: '1m' } },
  }, async (req: any, reply) => {
    if (!req.userId) return reply.status(401).send({ error: 'login required' })
    const { id, defenderUserId } = req.params as { id: string; defenderUserId: string }
    if (!mongoose.Types.ObjectId.isValid(defenderUserId)) {
      return reply.status(400).send({ error: 'invalid defenderUserId' })
    }
    const body = (req.body ?? {}) as { kills?: unknown }
    const kills: string[] = Array.isArray(body.kills)
      ? body.kills.filter((x): x is string => typeof x === 'string')
      : []

    const clan = await Clan.findById(id).lean()
    if (!clan) return reply.status(404).send({ error: 'guild not found' })
    if (clanRoleOf(clan as any, req.userId) === 'none') {
      return reply.status(403).send({ error: 'not a member of this guild' })
    }

    const war = await War.findOne({
      $or: [{ clan1Id: clan._id }, { clan2Id: clan._id }],
      status: 'active',
    })
    if (!war) return reply.status(409).send({ error: 'no active war' })

    const isClan1Side = war.clan1Id.toString() === (clan._id as any).toString()
    const myMembers    = isClan1Side ? war.clan1Members : war.clan2Members
    const enemyMembers = isClan1Side ? war.clan2Members : war.clan1Members

    // Caller must be in the war roster on their side.
    const attacker = myMembers.find(m => m.userId.toString() === req.userId)
    if (!attacker) return reply.status(403).send({ error: 'not on this war roster' })
    if (attacker.attacksRemaining <= 0) {
      return reply.status(403).send({ error: 'no attacks remaining' })
    }

    const defender = enemyMembers.find(m => m.userId.toString() === defenderUserId)
    if (!defender) return reply.status(404).send({ error: 'defender not in war' })
    if (defender.defenseTeamAlive.length === 0) {
      return reply.status(409).send({ error: 'defender already wiped' })
    }

    // Drop any kill ids that aren't actually in the defender's current alive
    // list — caps the maximum impact of a malicious client to exactly what
    // it could legitimately achieve.
    const aliveSet = new Set(defender.defenseTeamAlive)
    const validKills = kills.filter(k => aliveSet.has(k))
    // Server determines win/loss from the kill set: attacker wins iff
    // every remaining alive defender died. Trust nothing from the client
    // beyond which shareIds died.
    const attackerWon = validKills.length > 0 && validKills.length === defender.defenseTeamAlive.length
    const scoreAwarded = attackerWon ? 3 : validKills.length

    // Apply state changes — remove the dead from defender's alive list.
    const killSet = new Set(validKills)
    defender.defenseTeamAlive = defender.defenseTeamAlive.filter(k => !killSet.has(k))
    attacker.attacksRemaining -= 1

    if (isClan1Side) war.clan1Score += scoreAwarded
    else             war.clan2Score += scoreAwarded

    war.attackLog.push({
      attackerUserId:   new mongoose.Types.ObjectId(req.userId),
      attackerUsername: attacker.username,
      defenderUserId:   new mongoose.Types.ObjectId(defenderUserId),
      defenderUsername: defender.username,
      killShareIds:     validKills,
      attackerWon,
      scoreAwarded,
      attackedAt:       new Date(),
    } as any)

    // If every defender on the opposing side is wiped, resolve early. The
    // war ends in attacker's favour regardless of remaining time.
    const oppositeSide = isClan1Side ? war.clan2Members : war.clan1Members
    const fullyWiped = oppositeSide.every(m => m.defenseTeamAlive.length === 0)
    if (fullyWiped) {
      await war.save()
      await resolveWar(war, 'wipe')
    } else {
      await war.save()
    }

    reply.send({
      attack: {
        attackerUsername: attacker.username,
        defenderUsername: defender.username,
        killShareIds:     validKills,
        attackerWon,
        scoreAwarded,
      },
      war: await serializeWarForClan(war, (clan._id as any).toString()),
    })
  })

  // ── GET /clans/:id/war/current — read the clan's current war ───────────
  app.get('/clans/:id/war/current', {
    config: { rateLimit: { max: 60, timeWindow: '1m' } },
  }, async (req: any, reply) => {
    if (!req.userId) return reply.status(401).send({ error: 'login required' })
    const { id } = req.params as { id: string }
    if (!mongoose.Types.ObjectId.isValid(id)) return reply.status(400).send({ error: 'invalid id' })

    const clan = await Clan.findById(id).lean()
    if (!clan) return reply.status(404).send({ error: 'guild not found' })
    if (clanRoleOf(clan as any, req.userId) === 'none') {
      return reply.status(403).send({ error: 'not a member of this guild' })
    }

    const war = await War.findOne({
      $or: [{ clan1Id: clan._id }, { clan2Id: clan._id }],
      status: { $in: NON_TERMINAL_STATUSES },
    })
    if (!war) return reply.send({ war: null })
    reply.send({ war: await serializeWarForClan(war, (clan._id as any).toString()) })
  })
}
