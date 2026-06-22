import type { FastifyInstance } from 'fastify'
import type { WebSocket } from '@fastify/websocket'
import { User } from '../models/User.js'
import { Character } from '../models/Character.js'
import { markEvent } from '../lib/challenges.js'

interface Player {
  ws: WebSocket
  userId?: string
  username?: string
  results: object[]
  done: boolean
  room?: Room
  // Each player self-reports their own won/lost flag once battle resolves client-side.
  // Server credits the win/loss only when both reports arrive and agree (one wins, one loses).
  battleReport?: { won: boolean }
  // Last spin index this player advanced to (highest seen on a 'spin_result').
  // Relayed to the opponent so the waiting UI shows a live progress bar.
  currentSpinIndex?: number
  // Wall-clock ms of the last forward action (spin_result or spins_complete).
  // The inactivity sweep kicks players whose lastActiveAt is more than
  // INACTIVITY_LIMIT_MS old. Bonus/wildcard spins also send spin_result so
  // they reset this timer naturally — only true idling fails the check.
  lastActiveAt?: number
  // Once the player has reported spins_complete OR the room has resolved a
  // winner, idle ticks are exempted (they're just waiting on the other side).
  idleExempt?: boolean
  // Set when the inactivity sweep kicks this player so the close handler
  // doesn't double-credit the opponent as a DC win.
  inactivityKicked?: boolean
}

interface Room {
  code: string
  p1: Player | null
  p2: Player | null
  createdAt: number
  // True once the server has credited a result for this room. Prevents double-credit
  // if either client sends battle_result twice.
  resolved?: boolean
  // When true the battle_result agreement also applies Ranked MMR delta to
  // both players. Set when the room was created by the ranked matchmaker.
  ranked?: boolean
  // MMR snapshots taken at match time so a player can't game the system by
  // climbing MMR between match and result. Only set on ranked rooms.
  p1MmrAtStart?: number
  p2MmrAtStart?: number
  // Timer that fires N seconds after the first battle_result arrives —
  // if only one client has reported by then (the other quit, crashed,
  // or its simulation diverged due to non-deterministic RNG), the
  // server resolves the room using the single report so neither side
  // is left with an unresolved match + missing MMR delta.
  singleReportTimeout?: NodeJS.Timeout
}

interface QueueEntry {
  player: Player
  score: number  // rivalsWins used as skill proxy (casual queue)
  joinedAt: number
}

// Ranked queue entries carry the player's current MMR so the matchmaker can
// pair closest brackets. Separate from `matchQueue` so a casual searcher can
// run alongside a ranked searcher without cross-contamination.
interface RankedQueueEntry {
  player: Player
  mmr: number
  joinedAt: number
}

// A lightweight character payload for "your character vs their character"
// challenges. spins is the SpinResult[] the battle simulator consumes.
interface ChallengeCharacter {
  name: string
  spins: object[]
  // Optional roster shareId — when present and the picked fighter wins, the
  // overlay PATCHes /api/characters/:shareId/rivals-win so the medal lands
  // on the actual roster character (not just the user-level rivalsWins).
  shareId?: string
}

interface PendingChallenge {
  id: string
  from: Player
  fromUserId: string
  fromUsername: string
  targetUserId: string
  mode: 'rivals' | 'character'
  // Only set for 'character' mode — the challenger's chosen fighter.
  character?: ChallengeCharacter
  createdAt: number
}

// In-memory stores
const rooms = new Map<string, Room>()
const matchQueue: QueueEntry[] = []
const rankedQueue: RankedQueueEntry[] = []
// Online presence: userId → set of live connections (a user may have several
// tabs open). Powers friend online-detection + challenge delivery.
const presence = new Map<string, Set<Player>>()
// Outstanding friend challenges keyed by a generated id.
const pendingChallenges = new Map<string, PendingChallenge>()

function registerPresence(player: Player) {
  if (!player.userId) return
  let set = presence.get(player.userId)
  if (!set) { set = new Set(); presence.set(player.userId, set) }
  set.add(player)
}

function unregisterPresence(player: Player) {
  if (!player.userId) return
  const set = presence.get(player.userId)
  if (!set) return
  set.delete(player)
  if (set.size === 0) presence.delete(player.userId)
}

function isOnline(userId: string): boolean {
  const set = presence.get(userId)
  return !!set && set.size > 0
}

function connectionsFor(userId: string): Player[] {
  return Array.from(presence.get(userId) ?? [])
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function send(ws: WebSocket, msg: object) {
  try { ws.send(JSON.stringify(msg)) } catch { /* connection closed */ }
}

function getOther(player: Player): Player | null {
  const room = player.room
  if (!room) return null
  return room.p1 === player ? room.p2 : room.p1
}

function removeFromQueue(player: Player) {
  const idx = matchQueue.findIndex(e => e.player === player)
  if (idx !== -1) matchQueue.splice(idx, 1)
  const ridx = rankedQueue.findIndex(e => e.player === player)
  if (ridx !== -1) rankedQueue.splice(ridx, 1)
}

// Ranked MMR delta per match. Win = +3 to +5, loss = -3 to -5, scaled by
// the MMR gap between players: beating someone above you is rewarded
// more (+5), losing to someone below you costs more (-5). Capped at a
// ±200 MMR difference so wildly mismatched outcomes don't snowball.
function rankedMmrDelta(
  myMmr: number, opponentMmr: number, iWon: boolean,
): { meDelta: number; oppDelta: number } {
  const cap = 200
  const diff = Math.max(-cap, Math.min(cap, opponentMmr - myMmr))   // positive = opp stronger
  const scale = Math.max(0, diff / cap)                              // 0..1 (only positive side used)
  if (iWon) {
    // 3 baseline, +2 if upset win over a much higher MMR opponent.
    const meDelta = Math.round(3 + 2 * scale)
    // Opponent loses 3..5 — heavier when they outranked us (they were
    // expected to win and didn't).
    const oppDelta = -Math.round(3 + 2 * scale)
    return { meDelta, oppDelta }
  } else {
    // We lost. -3 baseline, -2 extra if opponent was much weaker.
    const meDelta = -Math.round(3 + 2 * Math.max(0, -diff / cap))
    const oppDelta = Math.round(3 + 2 * Math.max(0, -diff / cap))
    return { meDelta, oppDelta }
  }
}

function createRoom(p1: Player, p2: Player | null): Room {
  let code = generateCode()
  while (rooms.has(code)) code = generateCode()
  const room: Room = { code, p1, p2, createdAt: Date.now() }
  rooms.set(code, room)
  // Seed activity timers immediately so the inactivity sweep can start
  // catching idle players from the moment the room exists.
  const now = Date.now()
  p1.room = room
  p1.lastActiveAt = now
  p1.currentSpinIndex = p1.currentSpinIndex ?? -1
  if (p2) {
    p2.room = room
    p2.lastActiveAt = now
    p2.currentSpinIndex = p2.currentSpinIndex ?? -1
  }
  return room
}

// Clean up rooms older than 30 minutes every 10 minutes
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000
  for (const [code, room] of rooms) {
    if (room.createdAt < cutoff) rooms.delete(code)
  }
}, 10 * 60 * 1000)

// Inactivity sweep — if a player hasn't progressed in 60s, kick them as
// inactive and award the room to their opponent. Bonus/wildcard spins
// reset the timer via 'spin_result', so only true idling triggers this.
// Once a player reports spins_complete OR battle_result has fired, they're
// idle-exempt and just waiting on their partner.
const INACTIVITY_LIMIT_MS = 60_000
function inactivityKick(player: Player) {
  const room = player.room
  if (!room || room.resolved) return
  if (player.inactivityKicked) return
  player.inactivityKicked = true
  const other = room.p1 === player ? room.p2 : room.p1
  send(player.ws, { type: 'you_timed_out' })
  if (other) send(other.ws, { type: 'opponent_timed_out' })
  // Mark the room resolved so battle_result, partner_disconnected, and a
  // second inactivity kick all become no-ops.
  room.resolved = true
}
setInterval(() => {
  const now = Date.now()
  for (const room of rooms.values()) {
    if (room.resolved) continue
    for (const player of [room.p1, room.p2]) {
      if (!player) continue
      if (player.idleExempt) continue
      if (player.lastActiveAt === undefined) continue
      if (now - player.lastActiveAt > INACTIVITY_LIMIT_MS) {
        inactivityKick(player)
        // The kick already marked the room resolved and notified both
        // sides; credit the win/loss asynchronously so account stats track
        // forfeits the same as agreed battle outcomes.
        creditRivalsResultBg(room.p1 === player ? room.p2 : room.p1, player)
      }
    }
  }
}, 5_000)

// Fire-and-forget account-stat credit (rivalsWins/Losses + gamesPlayed +
// rivals_win challenge mark) for any non-mutual outcome — battle agreement,
// inactivity timeout, or mid-match disconnect. Uses console for failure
// telemetry because it runs outside any request scope.
function creditRivalsResultBg(winner: Player | null, loser: Player | null) {
  if (!winner || !loser) return
  ;(async () => {
    try {
      if (winner.userId) {
        await User.findByIdAndUpdate(winner.userId, { $inc: { rivalsWins: 1, gamesPlayed: 1 } })
        const winUser = await User.findById(winner.userId)
        if (winUser) await markEvent(winUser, 'rivals_win')
      }
      if (loser.userId) {
        await User.findByIdAndUpdate(loser.userId, { $inc: { rivalsLosses: 1, gamesPlayed: 1 } })
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[rivals] Failed to credit forfeit result', err)
    }
  })()
}

// Expire unanswered friend challenges after 60 seconds.
setInterval(() => {
  const cutoff = Date.now() - 60 * 1000
  for (const [id, ch] of pendingChallenges) {
    if (ch.createdAt < cutoff) {
      pendingChallenges.delete(id)
      send(ch.from.ws, { type: 'challenge_expired', challengeId: id })
    }
  }
}, 15 * 1000)

// Matchmaking: check queue every 5 seconds
setInterval(() => {
  const now = Date.now()

  // 2-minute timeout → bot match
  for (let i = matchQueue.length - 1; i >= 0; i--) {
    const entry = matchQueue[i]
    if (now - entry.joinedAt >= 2 * 60 * 1000) {
      matchQueue.splice(i, 1)
      send(entry.player.ws, { type: 'bot_match_start' })
    }
  }

  // Match closest-score pairs
  if (matchQueue.length >= 2) {
    matchQueue.sort((a, b) => a.score - b.score)
    let bestI = 0
    let bestDiff = Infinity
    for (let i = 0; i < matchQueue.length - 1; i++) {
      const diff = Math.abs(matchQueue[i].score - matchQueue[i + 1].score)
      if (diff < bestDiff) { bestDiff = diff; bestI = i }
    }
    const entryA = matchQueue[bestI]
    const entryB = matchQueue[bestI + 1]
    matchQueue.splice(bestI + 1, 1)
    matchQueue.splice(bestI, 1)

    const room = createRoom(entryA.player, entryB.player)

    // P1 = entryA, P2 = entryB
    send(entryA.player.ws, { type: 'matched', code: room.code, isP1: true,  opponentUsername: entryB.player.username })
    send(entryB.player.ws, { type: 'matched', code: room.code, isP1: false, opponentUsername: entryA.player.username })
  }

  // ── Ranked queue ─────────────────────────────────────────────────────────
  // Pairs the two closest-MMR searchers in the ranked queue. Tolerance
  // grows from 50 to 500 MMR over the first 10 minutes of waiting so
  // unpopulated brackets still find someone eventually. No bot fallback
  // for ranked — playing a bot wouldn't earn legitimate MMR.
  if (rankedQueue.length >= 2) {
    rankedQueue.sort((a, b) => a.mmr - b.mmr)
    for (let i = 0; i < rankedQueue.length - 1; i++) {
      const a = rankedQueue[i]
      const b = rankedQueue[i + 1]
      const ageSec = Math.max((now - a.joinedAt) / 1000, (now - b.joinedAt) / 1000)
      const tolerance = Math.round(50 + 450 * Math.min(1, ageSec / 600))
      const diff = Math.abs(a.mmr - b.mmr)
      if (diff > tolerance) continue
      // Pair them. Splice the higher index first so the lower index stays valid.
      rankedQueue.splice(i + 1, 1)
      rankedQueue.splice(i, 1)
      const room = createRoom(a.player, b.player)
      room.ranked = true
      room.p1MmrAtStart = a.mmr
      room.p2MmrAtStart = b.mmr
      send(a.player.ws, { type: 'matched', code: room.code, isP1: true,  opponentUsername: b.player.username, ranked: true, opponentMmr: b.mmr })
      send(b.player.ws, { type: 'matched', code: room.code, isP1: false, opponentUsername: a.player.username, ranked: true, opponentMmr: a.mmr })
      // Don't restart from the same index — return so the next tick gets
      // a fresh sweep.
      return
    }
  }
}, 5000)

export async function rivalsWsRoutes(app: FastifyInstance) {
  app.get('/rivals/ws', { websocket: true }, (socket: WebSocket) => {
    const player: Player = { ws: socket, results: [], done: false }

    // Heartbeat — Heroku's router closes idle WebSocket connections after
    // ~55 seconds of silence (https://devcenter.heroku.com/articles/websockets#timeouts).
    // The spin/wait phase regularly idles past that, so we ping every 25s
    // to keep proxies awake. Clients respond with `pong` but the server
    // doesn't require it — any inbound traffic resets the proxy timer.
    const heartbeat = setInterval(() => {
      if (socket.readyState !== 1) return
      try { send(socket, { type: 'ping', t: Date.now() }) } catch { /* socket dying */ }
    }, 25_000)
    socket.on('close', () => clearInterval(heartbeat))

    socket.on('message', async (raw: Buffer | string) => {
      let msg: { type: string; [k: string]: unknown }
      try { msg = JSON.parse(raw.toString()) } catch { return }

      switch (msg.type) {
        case 'identify': {
          // Re-identify cleanly if this connection was already registered.
          if (player.userId) unregisterPresence(player)
          player.userId   = msg.userId as string | undefined
          player.username = msg.username as string | undefined
          registerPresence(player)
          break
        }

        // ── Friend online-presence query ─────────────────────────────────
        // Client sends the userIds of its friends; we reply with the subset
        // currently connected so the friends list can show online dots.
        case 'presence_query': {
          const ids = Array.isArray(msg.userIds) ? (msg.userIds as string[]) : []
          const online = ids.filter(id => typeof id === 'string' && isOnline(id))
          send(socket, { type: 'presence_status', online })
          break
        }

        // ── Send a friend challenge ──────────────────────────────────────
        // mode 'rivals'  → both players spin fresh characters, then fight.
        // mode 'character' → challenger's chosen roster character vs one the
        //                    target picks when they accept.
        case 'challenge_send': {
          const targetUserId = msg.targetUserId as string | undefined
          const mode = (msg.mode === 'character' ? 'character' : 'rivals') as 'rivals' | 'character'
          if (!player.userId || !player.username) { send(socket, { type: 'challenge_error', message: 'Log in to challenge friends.' }); break }
          if (!targetUserId || !isOnline(targetUserId)) {
            send(socket, { type: 'challenge_unavailable', targetUserId })
            break
          }
          const id = generateCode() + generateCode()
          const challenge: PendingChallenge = {
            id,
            from: player,
            fromUserId: player.userId,
            fromUsername: player.username,
            targetUserId,
            mode,
            character: mode === 'character' ? (msg.character as ChallengeCharacter | undefined) : undefined,
            createdAt: Date.now(),
          }
          pendingChallenges.set(id, challenge)
          for (const conn of connectionsFor(targetUserId)) {
            send(conn.ws, {
              type: 'challenge_incoming',
              challengeId: id,
              fromUserId: player.userId,
              fromUsername: player.username,
              mode,
              // Surface the challenger's fighter name so the target sees who/what
              // they're up against; full spins aren't needed until battle starts.
              challengerCharacterName: challenge.character?.name,
            })
          }
          send(socket, { type: 'challenge_sent', challengeId: id, targetUserId })
          break
        }

        // ── Respond to a friend challenge (accept / decline) ─────────────
        case 'challenge_respond': {
          const id = msg.challengeId as string | undefined
          const accept = !!msg.accept
          const challenge = id ? pendingChallenges.get(id) : undefined
          if (!challenge) { send(socket, { type: 'challenge_error', message: 'This challenge expired.' }); break }
          // Only the intended target may respond.
          if (challenge.targetUserId !== player.userId) break
          pendingChallenges.delete(id!)

          if (!accept) {
            send(challenge.from.ws, { type: 'challenge_declined', challengeId: id, byUsername: player.username })
            break
          }

          // Challenger must still be connected (1 === WebSocket.OPEN).
          const challenger = challenge.from
          if (challenger.ws.readyState !== 1) {
            send(socket, { type: 'challenge_error', message: 'Challenger went offline.' })
            break
          }

          // Put both players in a room so the existing battle_result crediting
          // path (which requires both sides to agree) works unchanged.
          const room = createRoom(challenger, player)

          if (challenge.mode === 'character') {
            const responderChar = msg.character as ChallengeCharacter | undefined
            const challengerChar = challenge.character
            if (!challengerChar || !responderChar) {
              send(socket, { type: 'challenge_error', message: 'Missing character data.' })
              break
            }
            // Look up portrait URLs by shareId so the battle UI can render
            // the AI portraits in the sigil ring. Both lookups in parallel
            // since they're independent. Missing portraits fall through as
            // null and the BattleArena renders the letter sigil as before.
            const [challengerPortrait, responderPortrait] = await Promise.all([
              challengerChar.shareId
                ? Character.findOne({ shareId: challengerChar.shareId }).select('portraitUrl').lean()
                : Promise.resolve(null),
              responderChar.shareId
                ? Character.findOne({ shareId: responderChar.shareId }).select('portraitUrl').lean()
                : Promise.resolve(null),
            ])
            const challengerPortraitUrl = challengerPortrait?.portraitUrl ?? null
            const responderPortraitUrl  = responderPortrait?.portraitUrl ?? null

            // Each side gets "you" = self, "opponent" = the other fighter.
            send(challenger.ws, {
              type: 'challenge_battle_start', roomCode: room.code, mode: 'character',
              you:      { name: challengerChar.name, results: challengerChar.spins, shareId: challengerChar.shareId, portraitUrl: challengerPortraitUrl },
              opponent: { name: responderChar.name,  results: responderChar.spins,  shareId: responderChar.shareId,  portraitUrl: responderPortraitUrl  },
            })
            send(player.ws, {
              type: 'challenge_battle_start', roomCode: room.code, mode: 'character',
              you:      { name: responderChar.name,  results: responderChar.spins,  shareId: responderChar.shareId,  portraitUrl: responderPortraitUrl  },
              opponent: { name: challengerChar.name, results: challengerChar.spins, shareId: challengerChar.shareId, portraitUrl: challengerPortraitUrl },
            })
          } else {
            // rivals (fresh-spin) mode — mirror the matchmaking 'matched' flow
            // so both clients hand off to the normal spin → battle pipeline.
            send(challenger.ws, { type: 'challenge_matched', code: room.code, isP1: true,  opponentUsername: player.username })
            send(player.ws,     { type: 'challenge_matched', code: room.code, isP1: false, opponentUsername: challenge.fromUsername })
          }
          break
        }

        case 'create_room': {
          const room = createRoom(player, null)
          send(socket, { type: 'room_created', code: room.code })
          break
        }

        case 'join_room': {
          const code = (msg.code as string)?.toUpperCase()
          const room = rooms.get(code)
          if (!room) { send(socket, { type: 'error', message: 'Room not found. Check the code and try again.' }); break }
          if (room.p2) { send(socket, { type: 'error', message: 'Room is full.' }); break }
          room.p2 = player
          player.room = room
          send(socket, { type: 'room_joined', code })
          if (room.p1) send(room.p1.ws, { type: 'partner_joined', username: player.username })
          send(socket,  { type: 'partner_joined', username: room.p1?.username ?? 'Opponent' })
          break
        }

        case 'find_match': {
          // Already in queue or room — ignore
          if (player.room || matchQueue.some(e => e.player === player) || rankedQueue.some(e => e.player === player)) break
          const score = typeof msg.score === 'number' ? msg.score : 0
          matchQueue.push({ player, score, joinedAt: Date.now() })
          send(socket, { type: 'searching', queueSize: matchQueue.length })
          break
        }

        // Ranked queue — same flow as find_match but pairs by MMR proximity
        // and credits +/- MMR on battle_result. Requires a logged-in user
        // (no MMR to track for anonymous players). The handler is sync so
        // the User lookup runs in an IIFE; the queue push lands once the
        // current MMR resolves.
        case 'find_ranked': {
          if (!player.userId) { send(socket, { type: 'error', message: 'Log in to play ranked.' }); break }
          if (player.room || matchQueue.some(e => e.player === player) || rankedQueue.some(e => e.player === player)) break
          const userId = player.userId
          ;(async () => {
            try {
              const u = await User.findById(userId).select('rankedMmr').lean()
              // Re-check guards in case the player joined a room while we
              // were awaiting the lookup.
              if (player.room || rankedQueue.some(e => e.player === player)) return
              const mmr = u?.rankedMmr ?? 0
              rankedQueue.push({ player, mmr, joinedAt: Date.now() })
              send(socket, { type: 'searching', queueSize: rankedQueue.length, ranked: true })
            } catch (err) {
              app.log.warn({ err }, 'find_ranked MMR lookup failed')
              send(socket, { type: 'error', message: 'Ranked queue unavailable, try again.' })
            }
          })()
          break
        }

        case 'cancel_match': {
          removeFromQueue(player)
          send(socket, { type: 'match_cancelled' })
          break
        }

        case 'spin_result': {
          // Refresh the activity timer + record current progress. Bonus and
          // wildcard sub-spins also push spin_result, so the player can't
          // time out mid-bonus-chain.
          player.lastActiveAt = Date.now()
          const idx = typeof msg.spinIndex === 'number' ? msg.spinIndex : undefined
          if (idx !== undefined) player.currentSpinIndex = Math.max(player.currentSpinIndex ?? -1, idx)
          const other = getOther(player)
          if (other) {
            send(other.ws, { type: 'partner_spin', spinIndex: msg.spinIndex, result: msg.result })
            // Progress tick so the opponent's waiting UI can show how far
            // along you are without parsing the full spin payload.
            send(other.ws, {
              type: 'partner_progress',
              spinIndex: player.currentSpinIndex,
              totalSpins: typeof msg.totalSpins === 'number' ? msg.totalSpins : undefined,
            })
          }
          break
        }

        case 'spins_complete': {
          if (!player.room) break
          player.done = true
          player.idleExempt = true
          player.lastActiveAt = Date.now()
          player.results = (msg.results as object[]) ?? []
          if (msg.name) player.username = msg.name as string
          const other = getOther(player)
          if (other) send(other.ws, { type: 'partner_complete' })
          if (player.room.p1?.done && player.room.p2?.done) {
            const p1 = player.room.p1
            const p2 = player.room.p2
            const p1Data = { username: p1.username, results: p1.results }
            const p2Data = { username: p2.username, results: p2.results }
            send(p1.ws, { type: 'battle_start', you: p1Data, opponent: p2Data })
            send(p2.ws, { type: 'battle_start', you: p2Data, opponent: p1Data })
          }
          break
        }

        case 'battle_result': {
          const other = getOther(player)
          if (other) send(other.ws, { type: 'battle_result', won: !(msg.won as boolean) })
          // Server-side win/loss crediting: each player reports their own result, and
          // we credit only when both reports agree (one true, one false). This stops
          // a single client from inflating rivalsWins by sending {won:true} alone.
          const room = player.room
          if (!room || room.resolved) break
          player.battleReport = { won: !!msg.won }
          const p1 = room.p1, p2 = room.p2
          if (p1?.battleReport && p2?.battleReport && p1.battleReport.won !== p2.battleReport.won) {
            // Both clients reported and they agreed on a winner — credit
            // immediately. Cancel the single-report timeout if one was
            // scheduled.
            if (room.singleReportTimeout) {
              clearTimeout(room.singleReportTimeout)
              room.singleReportTimeout = undefined
            }
            resolveRoomBattle(room, p1.battleReport.won ? p1 : p2, p1.battleReport.won ? p2 : p1)
          } else if (!room.singleReportTimeout) {
            // First report in. Start a 20s fallback — if the opponent
            // hasn't reported by then (they disconnected, their tab
            // crashed, their local battle simulation diverged due to
            // non-deterministic RNG), resolve the room using just this
            // player's report so we don't strand the match unresolved
            // and skip the MMR delta.
            room.singleReportTimeout = setTimeout(() => {
              if (room.resolved) return
              const reporter = p1?.battleReport ? p1 : (p2?.battleReport ? p2 : null)
              if (!reporter) return
              const opponent = reporter === p1 ? p2 : p1
              if (!opponent) return
              const winner = reporter.battleReport!.won ? reporter : opponent
              const loser  = reporter.battleReport!.won ? opponent : reporter
              resolveRoomBattle(room, winner, loser)
            }, 20_000)
          }

          /** Inner helper: credit win/loss + MMR delta + notify clients.
           *  Hoisted into a closure so the timeout path and the agreement
           *  path share the same crediting logic. */
          function resolveRoomBattle(room: Room, winner: Player, loser: Player) {
            if (room.resolved) return
            room.resolved = true
            if (room.singleReportTimeout) {
              clearTimeout(room.singleReportTimeout)
              room.singleReportTimeout = undefined
            }
            const isRanked = room.ranked === true
            const winnerMmrAtStart = winner === room.p1 ? (room.p1MmrAtStart ?? 0) : (room.p2MmrAtStart ?? 0)
            const loserMmrAtStart  = winner === room.p1 ? (room.p2MmrAtStart ?? 0) : (room.p1MmrAtStart ?? 0)
            // Best-effort credit; failures here must not break the battle UX.
            ;(async () => {
              try {
                if (winner.userId) {
                  await User.findByIdAndUpdate(winner.userId, { $inc: { rivalsWins: 1, gamesPlayed: 1 } })
                  const winUser = await User.findById(winner.userId)
                  if (winUser) await markEvent(winUser, 'rivals_win')
                }
                if (loser.userId) {
                  await User.findByIdAndUpdate(loser.userId, { $inc: { rivalsLosses: 1, gamesPlayed: 1 } })
                }
                if (isRanked && winner.userId && loser.userId) {
                  const { meDelta: winnerDelta, oppDelta: loserDelta } = rankedMmrDelta(winnerMmrAtStart, loserMmrAtStart, true)
                  // Floor at 0 so a player can't drop below Unranked.
                  await User.findByIdAndUpdate(winner.userId, { $inc: { rankedMmr: winnerDelta } })
                  await User.updateOne(
                    { _id: loser.userId, rankedMmr: { $gte: -loserDelta } },
                    { $inc: { rankedMmr: loserDelta } },
                  )
                  await User.updateOne(
                    { _id: loser.userId, rankedMmr: { $lt: -loserDelta } },
                    { $set: { rankedMmr: 0 } },
                  )
                  const winUser = await User.findById(winner.userId).select('rankedMmr').lean()
                  const losUser = await User.findById(loser.userId).select('rankedMmr').lean()
                  send(winner.ws, { type: 'ranked_result', delta: winnerDelta, newMmr: winUser?.rankedMmr ?? 0 })
                  send(loser.ws,  { type: 'ranked_result', delta: loserDelta,  newMmr: losUser?.rankedMmr ?? 0 })
                }
              } catch (err) {
                app.log.warn({ err, roomCode: room.code }, 'Failed to credit rivals battle result')
              }
            })()
          }
          break
        }

        case 'ping':
          send(socket, { type: 'pong' })
          break
      }
    })

    socket.on('close', () => {
      removeFromQueue(player)
      unregisterPresence(player)
      // Drop any challenges this player initiated; notify the target if online.
      for (const [id, ch] of pendingChallenges) {
        if (ch.from === player) {
          pendingChallenges.delete(id)
          for (const conn of connectionsFor(ch.targetUserId)) {
            send(conn.ws, { type: 'challenge_cancelled', challengeId: id })
          }
        }
      }
      if (player.room) {
        const room = player.room
        const other = getOther(player)
        // Only count this as a forfeit if the room hadn't already resolved
        // (via battle agreement, inactivity kick, or a previous DC) — that
        // way reconnect attempts and tab swaps after the match ended don't
        // double-credit anyone.
        if (other && !room.resolved && !player.inactivityKicked) {
          send(other.ws, { type: 'partner_disconnected' })
          room.resolved = true
          creditRivalsResultBg(other, player)
        }
        if (room.p1 === player) room.p1 = null
        if (room.p2 === player) room.p2 = null
        if (!room.p1 && !room.p2) rooms.delete(room.code)
        player.room = undefined
      }
    })
  })
}
