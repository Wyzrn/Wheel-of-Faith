// Global presence + friend-challenge socket.
//
// Unlike the per-page rivals socket, this connection stays open for the whole
// session (opened from the root layout once logged in) so a player can receive
// a challenge popup anywhere in the app. It also answers online-presence
// queries for the friends list.
//
// Two challenge modes:
//   • 'rivals'    — both players spin fresh characters, then fight. Handed off
//                   to the existing spin → battle pipeline via the rivals store.
//   • 'character' — each player's chosen roster character fights. Resolved
//                   entirely here via a global battle overlay (see layout).

import { auth } from './auth.svelte'
import { setRivalsWs } from './rivalsWs'
import { goto } from '$app/navigation'
import type { SpinResult } from '$lib/session/types'

export interface IncomingChallenge {
  challengeId: string
  fromUserId: string
  fromUsername: string
  mode: 'rivals' | 'character'
  challengerCharacterName?: string
}

export interface ChallengeBattle {
  roomCode: string
  you: { name: string; results: SpinResult[]; shareId?: string }
  opponent: { name: string; results: SpinResult[]; shareId?: string }
}

function wsUrl(): string {
  if (typeof window === 'undefined') return ''
  const base = (import.meta.env.VITE_API_URL ?? '').replace(/^http/, 'ws')
  return base
    ? `${base}/api/rivals/ws`
    : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/rivals/ws`
}

let _ws: WebSocket | null = null
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null
let _intentionalClose = false

// Reactive state
let _onlineIds   = $state<Set<string>>(new Set())
let _incoming    = $state<IncomingChallenge | null>(null)
let _battle      = $state<ChallengeBattle | null>(null)
// Transient status of a challenge this client just sent — drives a toast/banner.
let _outgoing    = $state<{ targetUserId: string; status: 'sent' | 'declined' | 'unavailable' | 'expired' } | null>(null)

function identify() {
  if (!_ws || _ws.readyState !== WebSocket.OPEN) return
  _ws.send(JSON.stringify({
    type: 'identify',
    userId: auth.user?.id,
    username: (auth.user?.gamepasses?.includes('legend_tag') ? '[LEGEND] ' : '') + (auth.user?.username ?? 'Anonymous'),
  }))
}

function handle(e: MessageEvent) {
  let msg: Record<string, unknown>
  try { msg = JSON.parse(e.data) } catch { return }

  switch (msg.type) {
    case 'presence_status': {
      const online = Array.isArray(msg.online) ? (msg.online as string[]) : []
      _onlineIds = new Set(online)
      break
    }
    case 'challenge_incoming': {
      _incoming = {
        challengeId: msg.challengeId as string,
        fromUserId: msg.fromUserId as string,
        fromUsername: msg.fromUsername as string,
        mode: (msg.mode === 'character' ? 'character' : 'rivals'),
        challengerCharacterName: msg.challengerCharacterName as string | undefined,
      }
      break
    }
    case 'challenge_sent':
      _outgoing = { targetUserId: msg.targetUserId as string, status: 'sent' }
      break
    case 'challenge_declined':
      _outgoing = { targetUserId: '', status: 'declined' }
      break
    case 'challenge_unavailable':
      _outgoing = { targetUserId: msg.targetUserId as string, status: 'unavailable' }
      break
    case 'challenge_expired':
      _outgoing = { targetUserId: '', status: 'expired' }
      break
    case 'challenge_cancelled':
      // The challenger bailed before we answered — drop the popup if it's theirs.
      if (_incoming?.challengeId === msg.challengeId) _incoming = null
      break
    case 'challenge_battle_start': {
      // Character-vs-character: resolve via the global overlay.
      _incoming = null
      _battle = {
        roomCode: msg.roomCode as string,
        you: msg.you as ChallengeBattle['you'],
        opponent: msg.opponent as ChallengeBattle['opponent'],
      }
      break
    }
    case 'challenge_matched': {
      // rivals (fresh-spin) mode — hand this socket off to the spin pipeline,
      // exactly like the rivals page's navigateToSpin(). Release our reference
      // so we don't fight the spin flow for the socket, and open a fresh one
      // so presence keeps working.
      _incoming = null
      if (_ws) {
        setRivalsWs({
          ws: _ws,
          roomCode: msg.code as string,
          isP1: !!msg.isP1,
          opponentName: (msg.opponentUsername as string) ?? 'Opponent',
        })
        _intentionalClose = true   // don't auto-reconnect the handed-off socket on close
        _ws = null
        // Re-establish our own presence socket shortly after handoff.
        setTimeout(() => { _intentionalClose = false; presence.connect() }, 500)
        goto('/?rivals=online')
      }
      break
    }
  }
}

export const presence = {
  get onlineIds() { return _onlineIds },
  get incoming()  { return _incoming },
  get battle()    { return _battle },
  get outgoing()  { return _outgoing },

  isOnline(userId: string): boolean { return _onlineIds.has(userId) },

  connect() {
    if (typeof window === 'undefined') return
    if (!auth.loggedIn) return
    if (_ws && _ws.readyState !== WebSocket.CLOSED) return
    const sock = new WebSocket(wsUrl())
    sock.onopen = () => { identify() }
    sock.onmessage = handle
    sock.onclose = () => {
      _ws = null
      if (_intentionalClose) return
      // Reconnect with backoff while still logged in.
      if (auth.loggedIn && !_reconnectTimer) {
        _reconnectTimer = setTimeout(() => { _reconnectTimer = null; presence.connect() }, 3000)
      }
    }
    _ws = sock
  },

  disconnect() {
    _intentionalClose = true
    if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null }
    _ws?.close()
    _ws = null
    _onlineIds = new Set()
    _intentionalClose = false
  },

  // Ask the server which of these userIds are currently connected.
  queryPresence(userIds: string[]) {
    if (!_ws || _ws.readyState !== WebSocket.OPEN) return
    _ws.send(JSON.stringify({ type: 'presence_query', userIds }))
  },

  // Challenge a friend. For 'character' mode, pass the chosen fighter.
  sendChallenge(targetUserId: string, mode: 'rivals' | 'character', character?: { name: string; spins: SpinResult[]; shareId?: string }) {
    if (!_ws || _ws.readyState !== WebSocket.OPEN) return
    _ws.send(JSON.stringify({ type: 'challenge_send', targetUserId, mode, character }))
  },

  // Accept or decline an incoming challenge. For 'character' mode, the accepter
  // supplies their own fighter alongside accept=true.
  respond(challengeId: string, accept: boolean, character?: { name: string; spins: SpinResult[]; shareId?: string }) {
    if (_ws && _ws.readyState === WebSocket.OPEN) {
      _ws.send(JSON.stringify({ type: 'challenge_respond', challengeId, accept, character }))
    }
    if (!accept) _incoming = null
  },

  // Report the result of a character-mode battle (mirrors rivals battle_result;
  // the server credits the win only when both sides agree).
  reportBattleResult(won: boolean) {
    if (_ws && _ws.readyState === WebSocket.OPEN) {
      _ws.send(JSON.stringify({ type: 'battle_result', won }))
    }
  },

  clearIncoming() { _incoming = null },
  clearBattle()   { _battle = null },
  clearOutgoing() { _outgoing = null },
}
