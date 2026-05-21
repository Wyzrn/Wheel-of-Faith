<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { auth } from '$lib/stores/auth.svelte'
  import { normalizeLegacyDisplayLabel } from '$lib/game/scoreTier'
  import QuickBattleView from '../../components/QuickBattleView.svelte'
  import type { SpinResult } from '$lib/session/types'
  import { setRivalsWs, getRivalsWs, clearRivalsWs } from '$lib/stores/rivalsWs'

  // ── Phase state machine ────────────────────────────────────────────────────
  type Phase =
    | 'mode'
    | 'create_or_join'
    | 'searching'
    | 'waiting'
    | 'p1_spinning'
    | 'p2_spinning'
    | 'battle_ready'
    | 'battle'
    | 'bot_battle'

  let phase         = $state<Phase>('mode')
  let roomCode      = $state('')
  let joinCode      = $state('')
  let joinError     = $state('')
  let partnerName   = $state('')
  let partnerDone   = $state(false)
  let myResults     = $state<any[]>([])
  let partnerResults = $state<any[]>([])
  let myCharName    = $state<string | null>(null)
  let partnerSpins  = $state<Map<number, any>>(new Map())
  let isP1          = $state(false)
  let mySpinsDone   = $state(false)
  let ws            = $state<WebSocket | null>(null)

  // Searching / matchmaking
  let searchSeconds = $state(0)
  let searchTimer: ReturnType<typeof setInterval> | null = null
  const MATCH_TIMEOUT = 120

  // Bot match
  let botResults    = $state<any[]>([])

  // Pending friend challenges
  type PendingChallenge = { challengerUsername: string; roomCode: string }
  let pendingChallenges = $state<PendingChallenge[]>([])

  const WS_URL = (() => {
    if (typeof window === 'undefined') return ''
    const base = (import.meta.env.VITE_API_URL ?? '').replace(/^http/, 'ws')
    return base ? `${base}/api/rivals/ws`
      : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/rivals/ws`
  })()

  // Flag: WS was stored for main-game relay — don't close it in onDestroy
  let storedWsForSpin = false

  onMount(async () => {
    // Returning from spin: re-attach to the stored WS
    const stored = getRivalsWs()
    if (stored) {
      ws = stored.ws
      ws.onmessage = handleMessage
      ws.onclose = () => { ws = null }
      roomCode = stored.roomCode
      isP1 = stored.isP1
      partnerName = stored.opponentName
      mySpinsDone = true
      clearRivalsWs()
      if (stored.pendingBattle) {
        myResults = stored.pendingBattle.myResults as SpinResult[]
        partnerResults = stored.pendingBattle.opponentResults as SpinResult[]
        if (stored.pendingBattle.myName) myCharName = stored.pendingBattle.myName
        if (stored.pendingBattle.opponentName) partnerName = stored.pendingBattle.opponentName
        phase = 'battle'
      } else {
        // Waiting for partner to finish / battle_start
        phase = 'battle_ready'
      }
      return
    }
    // Auto-join from URL param (e.g. /rivals?join=CODE)
    const joinParam = $page.url.searchParams.get('join')
    if (joinParam) {
      joinCode = joinParam.toUpperCase()
      joinRoom()
    }
  })

  onDestroy(() => {
    if (!storedWsForSpin) ws?.close()
    if (searchTimer) clearInterval(searchTimer)
  })

  // ── WebSocket helpers ──────────────────────────────────────────────────────
  function connectWs(onOpen?: () => void): WebSocket {
    const sock = new WebSocket(WS_URL)
    sock.onopen = () => {
      sock.send(JSON.stringify({
        type: 'identify',
        userId: auth.user?.id,
        username: auth.user?.username ?? 'Anonymous',
      }))
      onOpen?.()
    }
    sock.onmessage = handleMessage
    sock.onclose = () => { ws = null }
    ws = sock
    return sock
  }

  function handleMessage(e: MessageEvent) {
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
      case 'matched':
        roomCode = msg.code
        isP1 = msg.isP1 ?? true
        partnerName = msg.opponentUsername ?? 'Opponent'
        partnerDone = false
        mySpinsDone = false
        stopSearchTimer()
        phase = isP1 ? 'p1_spinning' : 'p2_spinning'
        navigateToSpin()
        break
      case 'partner_joined':
        partnerName = msg.username ?? 'Opponent'
        phase = isP1 ? 'p1_spinning' : 'p2_spinning'
        navigateToSpin()
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
        partnerName = msg.opponent?.username ?? partnerName
        myResults = msg.you?.results ?? []
        myCharName = msg.you?.username ?? null
        phase = 'battle'
        break
      case 'searching':
        // Queue size update — no action needed
        break
      case 'match_cancelled':
        stopSearchTimer()
        phase = 'mode'
        break
      case 'bot_match_start':
        stopSearchTimer()
        partnerName = 'BOT'
        botResults = generateBotResults()
        isP1 = true
        phase = 'p1_spinning'
        navigateToSpin()
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

  // ── Navigate to spin (keeps WS alive across navigation) ───────────────────
  function navigateToSpin() {
    if (!ws) return
    storedWsForSpin = true
    setRivalsWs({ ws, roomCode, isP1, opponentName: partnerName })
    goto('/?rivals=online')
  }

  // ── Matchmaking timer ──────────────────────────────────────────────────────
  function startSearchTimer() {
    searchSeconds = 0
    searchTimer = setInterval(() => {
      searchSeconds++
    }, 1000)
  }

  function stopSearchTimer() {
    if (searchTimer) { clearInterval(searchTimer); searchTimer = null }
  }

  // ── Room actions ───────────────────────────────────────────────────────────
  function createRoom() {
    connectWs(() => {
      setTimeout(() => ws?.send(JSON.stringify({ type: 'create_room' })), 100)
    })
  }

  function joinRoom() {
    joinError = ''
    if (joinCode.length < 4) { joinError = 'Enter the room code.'; return }
    connectWs(() => {
      setTimeout(() => ws?.send(JSON.stringify({ type: 'join_room', code: joinCode.toUpperCase() })), 100)
    })
  }

  function findMatch() {
    connectWs(() => {
      setTimeout(() => ws?.send(JSON.stringify({
        type: 'find_match',
        score: auth.user?.rivalsWins ?? 0,
      })), 100)
    })
    startSearchTimer()
    phase = 'searching'
  }

  function cancelSearch() {
    ws?.send(JSON.stringify({ type: 'cancel_match' }))
    stopSearchTimer()
    ws?.close()
    phase = 'mode'
  }

  // ── Spin relay ─────────────────────────────────────────────────────────────
  function sendComplete(results: any[]) {
    mySpinsDone = true
    myResults = results

    if (partnerName === 'BOT') {
      // Bot match — skip WS, run battle locally
      partnerResults = botResults
      phase = 'battle'
      return
    }

    ws?.send(JSON.stringify({ type: 'spins_complete', results }))
    if (partnerDone) phase = 'battle_ready'
  }

  // ── Bot character generation ───────────────────────────────────────────────
  const BOT_TIERS = [
    { tier: 'F', score: 8 }, { tier: 'D', score: 18 }, { tier: 'C', score: 28 },
    { tier: 'B', score: 38 }, { tier: 'A', score: 48 }, { tier: 'S', score: 58 },
    { tier: 'SS', score: 68 }, { tier: 'SSS', score: 78 },
  ]
  const BOT_RACES = ['Human', 'Demon', 'Angel', 'Dragon', 'Undead', 'Elf', 'Orc', 'Vampire']
  const BOT_ARCHETYPES = ['Warrior', 'Mage', 'Rogue', 'Paladin', 'Berserker', 'Sage', 'Hunter']
  const STAT_CATS = ['strength','speed','agility','durability','iq','charisma','fightingSkill',
    'powerMastery','weaponMastery','armorStrength','potential','energyLevel'] as const

  function rng(n: number) { return Math.floor(Math.random() * n) }

  function generateBotResults(): any[] {
    const results: any[] = []
    const race = BOT_RACES[rng(BOT_RACES.length)]
    const archetype = BOT_ARCHETYPES[rng(BOT_ARCHETYPES.length)]
    results.push({ category: 'race', resultLabel: race, tier: 'C', score: 25 })
    results.push({ category: 'archetype', resultLabel: archetype, tier: 'C', score: 25 })
    for (const cat of STAT_CATS) {
      const t = BOT_TIERS[rng(BOT_TIERS.length)]
      results.push({ category: cat, resultLabel: `Bot ${t.tier}`, tier: t.tier, score: t.score + rng(8) })
    }
    results.push({ category: 'title', resultLabel: 'The Algorithmic', tier: 'C', score: 25 })
    results.push({ category: 'power', resultLabel: 'Calculated Prediction', tier: 'B', score: 38 })
    results.push({ category: 'weapon', resultLabel: 'Iron Sword', tier: 'C', score: 25 })
    results.push({ category: 'armor', resultLabel: 'Chain Mail', tier: 'C', score: 25 })
    return results
  }

  // ── Formatted timer ────────────────────────────────────────────────────────
  let searchDisplay = $derived(
    `${Math.floor(searchSeconds / 60)}:${String(searchSeconds % 60).padStart(2, '0')}`
  )
  let searchPct = $derived(Math.min(searchSeconds / MATCH_TIMEOUT, 1))
</script>

<main class="min-h-screen pt-16 pb-24 px-4" style="background: #07070d;">
  <div class="max-w-md mx-auto">

    <!-- ── Auth wall (online play requires login) ────────────────────────── -->
    {#if !auth.loading && !auth.loggedIn && phase !== 'mode'}
      <!-- Guard rendered but phase management handles it below -->
    {/if}

    <!-- ── Mode selection ─────────────────────────────────────────────────── -->
    {#if phase === 'mode'}
      <div class="text-center mb-8 mt-8">
        <p class="text-xs tracking-[0.3em] uppercase mb-3" style="font-family: 'JetBrains Mono', monospace; color: #4e4635;">Live PvP</p>
        <h1 style="font-family: 'Cinzel', serif; font-size: 1.75rem; font-weight: 900; color: #f9a8d4; letter-spacing: 0.12em;">RIVALS MODE</h1>
        <p class="text-xs mt-2 tracking-widest uppercase" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Challenge another player in a live duel</p>
      </div>

      <div class="flex flex-col gap-4">
        <!-- Offline -->
        <button
          onclick={() => goto('/?rivals=offline')}
          class="obsidian-slab py-4 rounded-2xl text-left px-6 transition-all hover:brightness-110 active:scale-[0.98]"
          style="cursor: pointer;"
        >
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined" style="color: #9a907b; font-size: 24px;">person</span>
            <div>
              <p class="font-semibold" style="color: #e4e1ee; font-family: 'Cinzel', serif;">Offline</p>
              <p class="text-xs" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Play locally on the same device</p>
            </div>
          </div>
        </button>

        <!-- Find Match (requires login) -->
        <button
          onclick={() => auth.loggedIn ? findMatch() : goto('/login')}
          class="py-4 rounded-2xl text-left px-6 transition-all hover:brightness-110 active:scale-[0.98]"
          style="background: linear-gradient(180deg, #0d1f17 0%, #091410 100%); border: 1px solid rgba(52,211,153,0.3); box-shadow: 0 10px 30px rgba(0,0,0,0.6), inset 1px 1px 0 rgba(52,211,153,0.08); cursor: pointer;"
        >
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined" style="color: #34d399; font-size: 24px;">search</span>
            <div class="flex-1">
              <p class="font-semibold flex items-center gap-2" style="color: #34d399; font-family: 'Cinzel', serif;">
                Find Match
                {#if !auth.loggedIn}
                  <span class="text-xs px-1.5 py-0.5 rounded" style="background: rgba(240,192,64,0.12); color: #f0c040; font-family: 'JetBrains Mono', monospace;">Login</span>
                {/if}
              </p>
              <p class="text-xs" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Auto-pair with a rival · 2-min bot fallback</p>
            </div>
          </div>
        </button>

        <!-- Online (room code) -->
        <button
          onclick={() => auth.loggedIn ? (phase = 'create_or_join') : goto('/login')}
          class="py-4 rounded-2xl text-left px-6 transition-all hover:brightness-110 active:scale-[0.98]"
          style="background: linear-gradient(180deg, #1a0d18 0%, #100910 100%); border: 1px solid rgba(249,168,212,0.25); box-shadow: 0 10px 30px rgba(0,0,0,0.6), inset 1px 1px 0 rgba(249,168,212,0.06); cursor: pointer;"
        >
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined" style="color: #f9a8d4; font-size: 24px;">wifi</span>
            <div class="flex-1">
              <p class="font-semibold flex items-center gap-2" style="color: #f9a8d4; font-family: 'Cinzel', serif;">
                Room Code
                {#if !auth.loggedIn}
                  <span class="text-xs px-1.5 py-0.5 rounded" style="background: rgba(240,192,64,0.12); color: #f0c040; font-family: 'JetBrains Mono', monospace;">Login</span>
                {/if}
              </p>
              <p class="text-xs" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Real-time duel with a private room code</p>
            </div>
          </div>
        </button>
      </div>

      <!-- Leaderboard link -->
      <div class="mt-5">
        <a href="/leaderboard"
          class="flex items-center gap-3 w-full px-5 py-3.5 rounded-xl transition-all hover:brightness-110 active:scale-[0.98]"
          style="background: rgba(240,192,64,0.05); border: 1px solid rgba(240,192,64,0.2); text-decoration: none; box-shadow: inset 1px 1px 0 rgba(255,223,150,0.04);"
        >
          <span class="material-symbols-outlined" style="color: #f0c040; font-size: 20px; font-variation-settings: 'FILL' 1;">workspace_premium</span>
          <div class="flex-1">
            <p class="text-sm font-bold" style="font-family: 'Cinzel', serif; color: #ffdf96; letter-spacing: 0.08em;">Leaderboard</p>
            <p class="text-xs" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Top rivals by win count</p>
          </div>
          <span class="material-symbols-outlined" style="color: #4e4635; font-size: 18px;">chevron_right</span>
        </a>
      </div>

      <!-- Pending friend challenges -->
      {#if pendingChallenges.length > 0}
        <div class="mt-6">
          <p class="text-xs tracking-widest uppercase mb-3" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Pending Challenges</p>
          <div class="flex flex-col gap-2">
            {#each pendingChallenges as challenge}
              <div class="flex items-center justify-between px-4 py-3 rounded-xl" style="background: rgba(249,168,212,0.06); border: 1px solid rgba(249,168,212,0.2);">
                <span class="text-sm" style="font-family: 'Cinzel', serif; color: #f9a8d4;">@{challenge.challengerUsername}</span>
                <button
                  onclick={() => { joinCode = challenge.roomCode; joinRoom() }}
                  class="text-xs px-3 py-1.5 rounded-lg font-bold tracking-widest uppercase"
                  style="font-family: 'Cinzel', serif; color: #f9a8d4; background: rgba(249,168,212,0.12); border: 1px solid rgba(249,168,212,0.3); cursor: pointer;"
                >
                  Accept
                </button>
              </div>
            {/each}
          </div>
        </div>
      {/if}

    <!-- ── Searching (matchmaking) ────────────────────────────────────────── -->
    {:else if phase === 'searching'}
      <div class="text-center mt-12 flex flex-col items-center gap-6">
        <div class="relative w-24 h-24">
          <svg class="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
            <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(52,211,153,0.1)" stroke-width="6"/>
            <circle cx="48" cy="48" r="40" fill="none" stroke="#34d399" stroke-width="6"
              stroke-dasharray="{2 * Math.PI * 40}"
              stroke-dashoffset="{2 * Math.PI * 40 * searchPct}"
              stroke-linecap="round"
              style="transition: stroke-dashoffset 1s linear;"
            />
          </svg>
          <div class="absolute inset-0 flex items-center justify-center">
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 1rem; font-weight: 700; color: #34d399;">{searchDisplay}</span>
          </div>
        </div>
        <h2 style="font-family: 'Cinzel', serif; font-size: 1.3rem; font-weight: 700; color: #34d399;">Searching…</h2>
        <p class="text-xs" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">
          Pairing with the closest rival — bot fallback at 2:00
        </p>
        <button
          onclick={cancelSearch}
          class="mt-2 px-6 py-2.5 rounded-xl text-sm tracking-widest uppercase font-bold"
          style="font-family: 'Cinzel', serif; color: #6b7280; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); cursor: pointer;"
        >
          Cancel
        </button>
      </div>

    <!-- ── Create or join ──────────────────────────────────────────────────── -->
    {:else if phase === 'create_or_join'}
      <div class="text-center mb-8 mt-8">
        <button onclick={() => phase = 'mode'} class="text-xs mb-4 block" style="color: #4e4635; font-family: 'JetBrains Mono', monospace;">← Back</button>
        <h2 style="font-family: 'Cinzel', serif; font-size: 1.4rem; font-weight: 700; color: #f9a8d4;">Room Code</h2>
      </div>

      <div class="flex flex-col gap-4">
        <button
          onclick={createRoom}
          class="py-5 rounded-2xl font-bold tracking-widest uppercase"
          style="background: linear-gradient(135deg, #7c1d6f, #4c1d95); border: 1px solid rgba(249,168,212,0.3); color: #f9a8d4; font-family: 'Cinzel', serif; font-size: 1rem; letter-spacing: 0.2em; cursor: pointer;"
        >
          Create Room
        </button>

        <div class="obsidian-slab flex flex-col gap-3 p-5 rounded-2xl">
          <p class="text-xs tracking-widest uppercase" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Join with a code</p>
          <input
            bind:value={joinCode}
            type="text"
            maxlength="6"
            placeholder="FATE42"
            class="w-full rounded-lg px-3 py-2.5 text-center text-xl font-black tracking-widest uppercase outline-none"
            style="background: #05050d; box-shadow: inset 2px 2px 5px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(0,0,0,0.4); color: #ffdf96; font-family: 'JetBrains Mono', monospace; letter-spacing: 0.4em;"
          />
          {#if joinError}
            <p class="text-xs text-red-400 text-center" style="font-family: 'JetBrains Mono', monospace;">{joinError}</p>
          {/if}
          <button
            onclick={joinRoom}
            class="py-3 rounded-xl font-bold tracking-wider uppercase"
            style="background: #1e1e2e; border: 1px solid rgba(240,192,64,0.25); color: #f0c040; font-family: 'Cinzel', serif; cursor: pointer;"
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
          <div class="obsidian-slab px-6 py-4 rounded-2xl" style="border: 1px solid rgba(240,192,64,0.25)!important;">
            <p class="text-xs mb-2 tracking-widest uppercase" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Room code — share this</p>
            <p class="text-4xl font-black tracking-[0.4em]" style="color: #ffdf96; font-family: 'JetBrains Mono', monospace;">{roomCode}</p>
          </div>
          <button
            onclick={async () => { await navigator.clipboard?.writeText(`${location.origin}/rivals?join=${roomCode}`) }}
            class="text-xs px-4 py-2 rounded-lg"
            style="font-family: 'JetBrains Mono', monospace; color: #a78bfa; background: rgba(167,139,250,0.08); border: 1px solid rgba(167,139,250,0.2); cursor: pointer;"
          >
            Copy Invite Link
          </button>
        {/if}
      </div>

    <!-- ── Spinning phases ────────────────────────────────────────────────── -->
    {:else if phase === 'p1_spinning' || phase === 'p2_spinning'}
      <div class="text-center mt-12 flex flex-col items-center gap-4">
        {#if partnerName === 'BOT'}
          <div class="px-4 py-2 rounded-lg mb-2" style="background: rgba(52,211,153,0.08); border: 1px solid rgba(52,211,153,0.2);">
            <p class="text-xs tracking-widest uppercase" style="color: #34d399; font-family: 'JetBrains Mono', monospace;">No match found — playing vs BOT</p>
          </div>
        {/if}
        <h2 style="font-family: 'Cinzel', serif; font-size: 1.3rem; color: #f9a8d4;">
          {(phase === 'p1_spinning' && isP1) || (phase === 'p2_spinning' && !isP1)
            ? 'Your turn — spin your character!'
            : `${partnerName} is spinning…`}
        </h2>
        {#if (phase === 'p1_spinning' && isP1) || (phase === 'p2_spinning' && !isP1)}
          <p class="text-xs" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Taking you to the wheel…</p>
          <div class="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style="border-color: #f0c040; border-top-color: transparent;"></div>
        {:else}
          <p class="text-xs" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Watch their spins appear below as they happen…</p>
          <div class="obsidian-slab w-full mt-4 rounded-xl overflow-hidden">
            {#if partnerSpins.size === 0}
              <p class="text-xs text-center py-8" style="color: #4e4635; font-style: italic;">Waiting for first spin…</p>
            {:else}
              <div class="flex flex-col">
                {#each [...partnerSpins.entries()].sort(([a],[b]) => a-b) as [idx, result]}
                  <div class="flex items-center gap-3 px-4 py-2.5" style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                    <span class="text-xs w-4 shrink-0" style="color: #4e4635; font-family: 'JetBrains Mono', monospace;">{idx+1}</span>
                    <span class="text-xs flex-1 truncate" style="color: #e4e1ee;">{result?.resultLabel ?? '?'}</span>
                    {#if result?.tier}
                      <span class="text-xs font-bold" style="color: #f0c040; font-family: 'JetBrains Mono', monospace;">{normalizeLegacyDisplayLabel(result.displayLabel) ?? result.tier}</span>
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

<!-- ── Battle screen (outside main container for full-screen layout) ──────── -->
{#if phase === 'battle'}
  <div style="background: #07070d; min-height: 100dvh;">
    <QuickBattleView
      team1={[{ results: myResults as SpinResult[], name: myCharName ?? auth.user?.username ?? 'You' }]}
      team2={[{ results: partnerResults as SpinResult[], name: partnerName || 'Opponent' }]}
      team1Label={myCharName ?? auth.user?.username ?? 'You'}
      team2Label={partnerName || 'Opponent'}
      title={partnerName === 'BOT' ? 'vs BOT' : `${myCharName ?? auth.user?.username ?? 'You'} vs ${partnerName}`}
      team2Color="#f9a8d4"
      onRematch={() => { phase = 'mode'; myResults = []; partnerResults = [] }}
      onBack={() => { phase = 'mode'; myResults = []; partnerResults = [] }}
      backLabel="Back to Rivals"
    />
  </div>
{/if}
