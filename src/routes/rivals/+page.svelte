<script lang="ts">
  import { onDestroy } from 'svelte'
  import { goto } from '$app/navigation'
  import { auth } from '$lib/stores/auth.svelte'

  type Phase = 'mode' | 'create_or_join' | 'waiting' | 'p1_spinning' | 'p2_spinning' | 'battle_ready' | 'battle'

  let phase = $state<Phase>('mode')
  let roomCode = $state('')
  let joinCode = $state('')
  let joinError = $state('')
  let partnerName = $state('')
  let partnerConnected = $state(false)
  let partnerDone = $state(false)
  let myResults = $state<any[]>([])
  let partnerResults = $state<any[]>([])
  let partnerSpins = $state<Map<number, any>>(new Map())
  let isP1 = $state(false)
  let mySpinsDone = $state(false)
  let ws = $state<WebSocket | null>(null)

  const WS_URL = (import.meta.env.VITE_API_URL ?? '').replace(/^http/, 'ws') + '/api/rivals/ws'
    || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/rivals/ws`

  function connectWs() {
    const sock = new WebSocket(WS_URL)
    sock.onopen = () => {
      // Identify ourselves
      sock.send(JSON.stringify({ type: 'identify', userId: auth.user?.id, username: auth.user?.username ?? 'Anonymous' }))
    }
    sock.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      switch (msg.type) {
        case 'room_created':
          roomCode = msg.code
          isP1 = true
          phase = 'waiting'
          break
        case 'room_joined':
          roomCode = msg.code
          isP1 = false
          phase = 'waiting'
          break
        case 'partner_joined':
          partnerName = msg.username ?? 'Opponent'
          partnerConnected = true
          // P1 spins first
          phase = isP1 ? 'p1_spinning' : 'p2_spinning'
          break
        case 'partner_spin':
          partnerSpins = new Map(partnerSpins).set(msg.spinIndex, msg.result)
          break
        case 'partner_complete':
          partnerDone = true
          if (mySpinsDone) phase = 'battle_ready'
          break
        case 'battle_start':
          partnerResults = msg.opponent?.results ?? []
          myResults = msg.you?.results ?? []
          phase = 'battle'
          break
        case 'partner_disconnected':
          alert('Your opponent disconnected.')
          phase = 'mode'
          break
        case 'error':
          joinError = msg.message
          break
      }
    }
    sock.onclose = () => { ws = null }
    ws = sock
    return sock
  }

  function createRoom() {
    const sock = connectWs()
    sock.onopen = () => {
      sock.send(JSON.stringify({ type: 'identify', userId: auth.user?.id, username: auth.user?.username ?? 'Anonymous' }))
      setTimeout(() => sock.send(JSON.stringify({ type: 'create_room' })), 100)
    }
  }

  function joinRoom() {
    joinError = ''
    if (joinCode.length < 4) { joinError = 'Enter the room code.'; return }
    const sock = connectWs()
    sock.onopen = () => {
      sock.send(JSON.stringify({ type: 'identify', userId: auth.user?.id, username: auth.user?.username ?? 'Anonymous' }))
      setTimeout(() => sock.send(JSON.stringify({ type: 'join_room', code: joinCode.toUpperCase() })), 100)
    }
  }

  function sendSpinResult(spinIndex: number, result: any) {
    ws?.send(JSON.stringify({ type: 'spin_result', spinIndex, result }))
  }

  function sendComplete(results: any[]) {
    mySpinsDone = true
    myResults = results
    ws?.send(JSON.stringify({ type: 'spins_complete', results }))
    if (partnerDone) phase = 'battle_ready'
  }

  onDestroy(() => { ws?.close() })
</script>

<main class="min-h-screen pt-16 pb-24 px-4" style="background: #09090f;">
  <div class="max-w-md mx-auto">

    <!-- ── Mode selection ─────────────────────────────────────────────────── -->
    {#if phase === 'mode'}
      <div class="text-center mb-8 mt-8">
        <h1 style="font-family: 'Cinzel', serif; font-size: 1.75rem; font-weight: 900; color: #f9a8d4; letter-spacing: 0.12em;">⚔ RIVALS MODE</h1>
        <p class="text-xs mt-2 tracking-widest uppercase" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Challenge another player in a live duel</p>
      </div>

      <div class="flex flex-col gap-4">
        <!-- Offline rivals (local) -->
        <button
          onclick={() => goto('/?rivals=offline')}
          class="py-4 rounded-2xl text-left px-6 transition-opacity hover:opacity-80"
          style="background: #1a1a28; border: 1px solid rgba(255,255,255,0.08);"
        >
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined" style="color: #9a907b; font-size: 24px;">person</span>
            <div>
              <p class="font-semibold" style="color: #e4e1ee; font-family: 'Cinzel', serif;">Offline</p>
              <p class="text-xs" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Play locally on the same device</p>
            </div>
          </div>
        </button>

        <!-- Online rivals -->
        <button
          onclick={() => phase = 'create_or_join'}
          class="py-4 rounded-2xl text-left px-6 transition-opacity hover:opacity-80"
          style="background: linear-gradient(135deg, #1f0a1a 0%, #1a0a2e 100%); border: 1px solid rgba(249,168,212,0.25);"
        >
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined" style="color: #f9a8d4; font-size: 24px;">wifi</span>
            <div>
              <p class="font-semibold" style="color: #f9a8d4; font-family: 'Cinzel', serif;">Online</p>
              <p class="text-xs" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Real-time duel with a room code</p>
            </div>
          </div>
        </button>
      </div>

    <!-- ── Create or join ──────────────────────────────────────────────────── -->
    {:else if phase === 'create_or_join'}
      <div class="text-center mb-8 mt-8">
        <button onclick={() => phase = 'mode'} class="text-xs mb-4 block" style="color: #4e4635; font-family: 'JetBrains Mono', monospace;">← Back</button>
        <h2 style="font-family: 'Cinzel', serif; font-size: 1.4rem; font-weight: 700; color: #f9a8d4;">Online Rivals</h2>
      </div>

      <div class="flex flex-col gap-4">
        <button
          onclick={createRoom}
          class="py-5 rounded-2xl font-bold tracking-widest uppercase"
          style="background: linear-gradient(135deg, #7c1d6f, #4c1d95); border: 1px solid rgba(249,168,212,0.3); color: #f9a8d4; font-family: 'Cinzel', serif; font-size: 1rem; letter-spacing: 0.2em;"
        >
          Create Room
        </button>

        <div class="flex flex-col gap-3 p-5 rounded-2xl" style="background: #0f0e1a; border: 1px solid rgba(240,192,64,0.12);">
          <p class="text-xs tracking-widest uppercase" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Join with a code</p>
          <input
            bind:value={joinCode}
            type="text"
            maxlength="6"
            placeholder="FATE42"
            class="w-full rounded-lg px-3 py-2.5 text-center text-xl font-black tracking-widest uppercase outline-none"
            style="background: #1a1a28; border: 1px solid rgba(255,255,255,0.1); color: #ffdf96; font-family: 'JetBrains Mono', monospace; letter-spacing: 0.4em;"
          />
          {#if joinError}
            <p class="text-xs text-red-400 text-center" style="font-family: 'JetBrains Mono', monospace;">{joinError}</p>
          {/if}
          <button
            onclick={joinRoom}
            class="py-3 rounded-xl font-bold tracking-wider uppercase"
            style="background: #1e1e2e; border: 1px solid rgba(240,192,64,0.25); color: #f0c040; font-family: 'Cinzel', serif;"
          >
            Join Room
          </button>
        </div>
      </div>

    <!-- ── Waiting for partner ────────────────────────────────────────────── -->
    {:else if phase === 'waiting'}
      <div class="text-center mt-16 flex flex-col items-center gap-6">
        <div class="text-6xl">⏳</div>
        <h2 style="font-family: 'Cinzel', serif; font-size: 1.3rem; font-weight: 700; color: #f9a8d4;">
          {isP1 ? 'Waiting for opponent…' : 'Joining room…'}
        </h2>
        {#if roomCode}
          <div class="px-6 py-4 rounded-2xl" style="background: #0f0e1a; border: 1px solid rgba(240,192,64,0.2);">
            <p class="text-xs mb-2 tracking-widest uppercase" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Room code — share this</p>
            <p class="text-4xl font-black tracking-[0.4em]" style="color: #ffdf96; font-family: 'JetBrains Mono', monospace;">{roomCode}</p>
          </div>
        {/if}
        <p class="text-xs" style="color: #4e4635; font-family: 'JetBrains Mono', monospace;">Share the code with your opponent</p>
      </div>

    <!-- ── Spinning phases: redirect to game with WS context ─────────────── -->
    {:else if phase === 'p1_spinning' || phase === 'p2_spinning'}
      <div class="text-center mt-12 flex flex-col items-center gap-4">
        <h2 style="font-family: 'Cinzel', serif; font-size: 1.3rem; color: #f9a8d4;">
          {(phase === 'p1_spinning' && isP1) || (phase === 'p2_spinning' && !isP1)
            ? 'Your turn — spin your character!'
            : `${partnerName} is spinning…`}
        </h2>
        {#if (phase === 'p1_spinning' && isP1) || (phase === 'p2_spinning' && !isP1)}
          <p class="text-xs" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Complete all 23 spins. Your opponent watches in real time.</p>
          <a href="/?rivals=online" class="metal-stamp-gold px-8 py-3 rounded-xl font-bold uppercase tracking-widest"
            style="font-family: 'Cinzel', serif; text-decoration: none; font-size: 0.85rem;">
            Start Spinning
          </a>
        {:else}
          <p class="text-xs" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Watch their spins appear below as they happen…</p>
          <div class="w-full mt-4 rounded-xl overflow-hidden" style="border: 1px solid rgba(240,192,64,0.1); background: #0f0e1a;">
            {#if partnerSpins.size === 0}
              <p class="text-xs text-center py-8" style="color: #4e4635; font-style: italic;">Waiting for first spin…</p>
            {:else}
              <div class="flex flex-col">
                {#each [...partnerSpins.entries()].sort(([a],[b]) => a-b) as [idx, result]}
                  <div class="flex items-center gap-3 px-4 py-2.5" style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                    <span class="text-xs w-4 shrink-0" style="color: #4e4635; font-family: 'JetBrains Mono', monospace;">{idx+1}</span>
                    <span class="text-xs flex-1 truncate" style="color: #e4e1ee;">{result?.resultLabel ?? '?'}</span>
                    {#if result?.tier}
                      <span class="text-xs font-bold" style="color: #f0c040; font-family: 'JetBrains Mono', monospace;">{result.displayLabel ?? result.tier}</span>
                    {/if}
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </div>

    <!-- ── Battle ready ───────────────────────────────────────────────────── -->
    {:else if phase === 'battle_ready'}
      <div class="text-center mt-16 flex flex-col items-center gap-6">
        <div class="text-5xl">⚔️</div>
        <h2 style="font-family: 'Cinzel', serif; font-size: 1.5rem; color: #f9a8d4;">Both players ready!</h2>
        <p class="text-xs" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">The battle will start automatically…</p>
      </div>
    {/if}

  </div>
</main>
