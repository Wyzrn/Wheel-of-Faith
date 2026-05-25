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

// In-memory stores
const rooms = new Map<string, Room>()
const matchQueue: QueueEntry[] = []

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
          player.userId   = msg.userId as string | undefined
          player.username = msg.username as string | undefined
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
