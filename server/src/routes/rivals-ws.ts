import type { FastifyInstance } from 'fastify'
import type { WebSocket } from '@fastify/websocket'
import { User } from '../models/User.js'
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
}

interface Room {
  code: string
  p1: Player | null
  p2: Player | null
  createdAt: number
  // True once the server has credited a result for this room. Prevents double-credit
  // if either client sends battle_result twice.
  resolved?: boolean
}

interface QueueEntry {
  player: Player
  score: number  // rivalsWins used as skill proxy
  joinedAt: number
}

// A lightweight character payload for "your character vs their character"
// challenges. spins is the SpinResult[] the battle simulator consumes.
interface ChallengeCharacter {
  name: string
  spins: object[]
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
}

function createRoom(p1: Player, p2: Player | null): Room {
  let code = generateCode()
  while (rooms.has(code)) code = generateCode()
  const room: Room = { code, p1, p2, createdAt: Date.now() }
  rooms.set(code, room)
  p1.room = room
  if (p2) p2.room = room
  return room
}

// Clean up rooms older than 30 minutes every 10 minutes
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000
  for (const [code, room] of rooms) {
    if (room.createdAt < cutoff) rooms.delete(code)
  }
}, 10 * 60 * 1000)

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
}, 5000)

export async function rivalsWsRoutes(app: FastifyInstance) {
  app.get('/rivals/ws', { websocket: true }, (socket: WebSocket) => {
    const player: Player = { ws: socket, results: [], done: false }

    socket.on('message', (raw: Buffer | string) => {
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
            // Each side gets "you" = self, "opponent" = the other fighter.
            send(challenger.ws, {
              type: 'challenge_battle_start', roomCode: room.code, mode: 'character',
              you: { name: challengerChar.name, results: challengerChar.spins },
              opponent: { name: responderChar.name, results: responderChar.spins },
            })
            send(player.ws, {
              type: 'challenge_battle_start', roomCode: room.code, mode: 'character',
              you: { name: responderChar.name, results: responderChar.spins },
              opponent: { name: challengerChar.name, results: challengerChar.spins },
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
          if (player.room || matchQueue.some(e => e.player === player)) break
          const score = typeof msg.score === 'number' ? msg.score : 0
          matchQueue.push({ player, score, joinedAt: Date.now() })
          send(socket, { type: 'searching', queueSize: matchQueue.length })
          break
        }

        case 'cancel_match': {
          removeFromQueue(player)
          send(socket, { type: 'match_cancelled' })
          break
        }

        case 'spin_result': {
          const other = getOther(player)
          if (other) send(other.ws, { type: 'partner_spin', spinIndex: msg.spinIndex, result: msg.result })
          break
        }

        case 'spins_complete': {
          if (!player.room) break
          player.done = true
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
            room.resolved = true
            const winner = p1.battleReport.won ? p1 : p2
            const loser  = p1.battleReport.won ? p2 : p1
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
        const other = getOther(player)
        if (other) send(other.ws, { type: 'partner_disconnected' })
        if (player.room.p1 === player) player.room.p1 = null
        if (player.room.p2 === player) player.room.p2 = null
        if (!player.room.p1 && !player.room.p2) rooms.delete(player.room.code)
        player.room = undefined
      }
    })
  })
}
