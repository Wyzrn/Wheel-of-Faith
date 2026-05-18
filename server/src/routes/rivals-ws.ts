import type { FastifyInstance } from 'fastify'
import type { WebSocket } from '@fastify/websocket'

interface Player {
  ws: WebSocket
  userId?: string
  username?: string
  results: object[]
  done: boolean
}

interface Room {
  code: string
  p1: Player | null
  p2: Player | null
  createdAt: number
}

// In-memory room store — rooms expire after 30 minutes of inactivity
const rooms = new Map<string, Room>()

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function send(ws: WebSocket, msg: object) {
  try { ws.send(JSON.stringify(msg)) } catch { /* connection closed */ }
}

function getOther(room: Room, self: Player): Player | null {
  return room.p1 === self ? room.p2 : room.p1
}

// Clean up rooms older than 30 minutes every 10 minutes
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000
  for (const [code, room] of rooms) {
    if (room.createdAt < cutoff) rooms.delete(code)
  }
}, 10 * 60 * 1000)

export async function rivalsWsRoutes(app: FastifyInstance) {
  app.get('/rivals/ws', { websocket: true }, (socket: WebSocket, req) => {
    let myRoom: Room | null = null
    let me: Player | null = null

    const player: Player = { ws: socket, results: [], done: false }

    socket.on('message', (raw) => {
      let msg: { type: string; [k: string]: unknown }
      try { msg = JSON.parse(raw.toString()) } catch { return }

      switch (msg.type) {
        case 'identify': {
          player.userId = msg.userId as string | undefined
          player.username = msg.username as string | undefined
          break
        }

        case 'create_room': {
          let code = generateCode()
          while (rooms.has(code)) code = generateCode()
          const room: Room = { code, p1: player, p2: null, createdAt: Date.now() }
          rooms.set(code, room)
          myRoom = room
          me = player
          send(socket, { type: 'room_created', code })
          break
        }

        case 'join_room': {
          const code = (msg.code as string)?.toUpperCase()
          const room = rooms.get(code)
          if (!room) { send(socket, { type: 'error', message: 'Room not found. Check the code and try again.' }); break }
          if (room.p2) { send(socket, { type: 'error', message: 'Room is full.' }); break }
          room.p2 = player
          myRoom = room
          me = player
          send(socket, { type: 'room_joined', code })
          // Notify P1 that their opponent arrived
          if (room.p1) send(room.p1.ws, { type: 'partner_joined', username: player.username })
          send(socket, { type: 'partner_joined', username: room.p1?.username })
          break
        }

        case 'spin_result': {
          // Forward one spin result to the other player in real time
          if (!myRoom || !me) break
          const other = getOther(myRoom, me)
          if (other) send(other.ws, { type: 'partner_spin', spinIndex: msg.spinIndex, result: msg.result })
          break
        }

        case 'spins_complete': {
          // This player finished all 23 spins
          if (!myRoom || !me) break
          me.done = true
          me.results = (msg.results as object[]) ?? []
          const other = getOther(myRoom, me)
          if (other) send(other.ws, { type: 'partner_complete' })
          // If both done, signal battle start
          if (myRoom.p1?.done && myRoom.p2?.done) {
            const p1Data = { username: myRoom.p1.username, results: myRoom.p1.results }
            const p2Data = { username: myRoom.p2.username, results: myRoom.p2.results }
            if (myRoom.p1) send(myRoom.p1.ws, { type: 'battle_start', you: p1Data, opponent: p2Data })
            if (myRoom.p2) send(myRoom.p2.ws, { type: 'battle_start', you: p2Data, opponent: p1Data })
          }
          break
        }

        case 'battle_result': {
          // Record win/loss (handled server-side via /api/auth/rivals-result, this is just relay)
          if (!myRoom || !me) break
          const other = getOther(myRoom, me)
          if (other) send(other.ws, { type: 'battle_result', won: !(msg.won as boolean) })
          break
        }

        case 'ping':
          send(socket, { type: 'pong' })
          break
      }
    })

    socket.on('close', () => {
      if (myRoom) {
        const other = getOther(myRoom, player)
        if (other) send(other.ws, { type: 'partner_disconnected' })
        // Remove the player from the room
        if (myRoom.p1 === player) myRoom.p1 = null
        if (myRoom.p2 === player) myRoom.p2 = null
        // Clean up empty rooms
        if (!myRoom.p1 && !myRoom.p2) rooms.delete(myRoom.code)
      }
    })
  })
}
