/**
 * Module-level store for rivals WebSocket state.
 * Persists across SvelteKit SPA navigation because it's module-level (not per-component).
 * The rivals page writes here before navigating to spin; the main game reads and relays spins;
 * the returning rivals page re-attaches its message handler to the same open socket.
 */

export interface RivalsWsData {
  ws: WebSocket
  roomCode: string
  isP1: boolean
  opponentName: string
  pendingBattle?: { myResults: unknown[]; opponentResults: unknown[]; myName?: string; opponentName?: string }
  // Seed both clients share so simulateBattle / BattleController1v1 produce
  // identical rounds on both sides — the fight reads as live rather than
  // two independent local sims. Issued by the server in `matched` /
  // `room_joined` / `challenge_matched`.
  battleSeed?: number
}

let _data: RivalsWsData | null = null

export function setRivalsWs(data: RivalsWsData): void { _data = data }
export function getRivalsWs(): RivalsWsData | null { return _data }
export function clearRivalsWs(): void { _data = null }
export function patchRivalsWs(patch: Partial<RivalsWsData>): void {
  if (_data) _data = { ..._data, ...patch }
}
