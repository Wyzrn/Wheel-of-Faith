<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { auth } from '$lib/stores/auth.svelte'
  import { normalizeLegacyDisplayLabel } from '$lib/game/scoreTier'
  import QuickBattleView from '../../components/QuickBattleView.svelte'
  import RivalsPreviewIntro from '../../components/RivalsPreviewIntro.svelte'
  import { recordOpponent } from '$lib/recentOpponents'
  import type { SpinResult } from '$lib/session/types'
  import { setRivalsWs, getRivalsWs, clearRivalsWs } from '$lib/stores/rivalsWs'
  import { startOfflineRivals, getOfflineRivalsResult, clearOfflineRivals } from '$lib/stores/offlineRivals'

  // ── Phase state machine ────────────────────────────────────────────────────
  // 'preview' is a 4-second pre-battle screen showing both characters before
  // the fight begins. Auto-advances to 'battle' but can be skipped.
  type Phase = 'menu' | 'searching' | 'create_or_join' | 'waiting' | 'battle_ready' | 'preview' | 'battle'

  let phase = $state<Phase>('menu')
  let ws    = $state<WebSocket | null>(null)

  // Room / match state
  let roomCode    = $state('')
  let joinCode    = $state('')
  let joinError   = $state('')
  let partnerName = $state('')
  let isP1        = $state(false)
  let partnerDone = $state(false)
  let mySpinsDone = $state(false)
  let partnerSpins = $state<Map<number, SpinResult>>(new Map())

  // Battle state
  let myResults      = $state<SpinResult[]>([])
  let partnerResults = $state<SpinResult[]>([])
  let myCharName     = $state<string | null>(null)
  let isBotBattle    = $state(false)

  // Pending friend challenges
  type PendingChallenge = { challengerUsername: string; roomCode: string }
  let pendingChallenges = $state<PendingChallenge[]>([])

  // Clan challenge — set when /clan navigates here with ?challenge=create
  type PendingClanChallenge = { clanId: string; targetUsername: string }
  let pendingClanChallenge = $state<PendingClanChallenge | null>(null)

  // Matchmaking timer
  let searchSeconds = $state(0)
  let searchTimer: ReturnType<typeof setInterval> | null = null
  const MATCH_TIMEOUT = 120

  let searchDisplay = $derived(
    `${Math.floor(searchSeconds / 60)}:${String(searchSeconds % 60).padStart(2, '0')}`
  )
  let searchPct = $derived(Math.min(searchSeconds / MATCH_TIMEOUT, 1))

  // Flag: WS was stored for main-game relay — prevent onDestroy from closing it
  let storedWsForSpin = false

  const WS_URL = (() => {
    if (typeof window === 'undefined') return ''
    const base = (import.meta.env.VITE_API_URL ?? '').replace(/^http/, 'ws')
    return base ? `${base}/api/rivals/ws`
      : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/rivals/ws`
  })()

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  onMount(() => {
    // Bot battle: returning from spin with bot_done flag
    const botDone = $page.url.searchParams.get('bot_done')
    if (botDone) {
      const result = getOfflineRivalsResult()
      clearOfflineRivals()
      if (result) {
        myResults = result.results
        myCharName = result.name
        partnerName = 'BOT'
        partnerResults = generateBotResults()
        isBotBattle = true
        phase = 'preview'
        return
      }
    }

    // Returning from online spin: re-attach to the stored WS
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
        phase = 'preview'
      } else {
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

    // Auto-create-room flow for clan challenges. /clan stores a context
    // payload in sessionStorage and navigates here with ?challenge=create.
    // Once the room is created (handleMessage type='room_created') we post
    // the join code back into the originating clan's chat as a system msg.
    if ($page.url.searchParams.get('challenge') === 'create') {
      try {
        const raw = sessionStorage.getItem('wof_clan_challenge')
        if (raw) {
          pendingClanChallenge = JSON.parse(raw)
          sessionStorage.removeItem('wof_clan_challenge')
        }
      } catch { /* ignore */ }
      createRoom()
    }
  })

  onDestroy(() => {
    if (!storedWsForSpin) ws?.close()
    if (searchTimer) clearInterval(searchTimer)
  })

  // ── WebSocket ──────────────────────────────────────────────────────────────
  function connectWs(onOpen?: () => void): WebSocket {
    if (ws && ws.readyState !== WebSocket.CLOSED) ws.close()
    const sock = new WebSocket(WS_URL)
    sock.onopen = () => {
      sock.send(JSON.stringify({
        type: 'identify',
        userId: auth.user?.id,
        username: (auth.user?.gamepasses?.includes('legend_tag') ? '[LEGEND] ' : '') + (auth.user?.username ?? 'Anonymous'),
      }))
      onOpen?.()
    }
    sock.onmessage = handleMessage
    sock.onclose = () => { ws = null }
    ws = sock
    return sock
  }

  function handleMessage(e: MessageEvent) {
    const msg = JSON.parse(e.data) as Record<string, unknown>
    switch (msg.type) {
      case 'room_created':
        roomCode = msg.code as string
        isP1 = true
        phase = 'waiting'
        // If this room was created via a clan challenge, auto-post the join
        // code to clan chat so the target can drop in without a copy-paste.
        if (pendingClanChallenge) {
          const challenge = pendingClanChallenge
          pendingClanChallenge = null
          fetch(`/api/clans/${challenge.clanId}/messages`, {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              kind: 'system',
              text: `⚔ ${auth.user?.username ?? 'Someone'} challenges ${challenge.targetUsername} — join code ${roomCode}`,
            }),
          }).catch(() => { /* don't block the room flow on a failed chat post */ })
        }
        break
      case 'room_joined':
        roomCode = msg.code as string
        isP1 = false
        phase = 'waiting'
        break
      case 'matched':
        roomCode = msg.code as string
        isP1 = (msg.isP1 as boolean) ?? true
        partnerName = (msg.opponentUsername as string) ?? 'Opponent'
        partnerDone = false
        mySpinsDone = false
        stopSearchTimer()
        navigateToSpin()
        break
      case 'partner_joined':
        partnerName = (msg.username as string) ?? 'Opponent'
        navigateToSpin()
        break
      case 'partner_spin':
        partnerSpins = new Map(partnerSpins).set(msg.spinIndex as number, msg.result as SpinResult)
        break
      case 'partner_complete':
        partnerDone = true
        if (mySpinsDone) phase = 'battle_ready'
        break
      case 'battle_start': {
        const you = msg.you as { username?: string; results: SpinResult[] }
        const opp = msg.opponent as { username?: string; results: SpinResult[] }
        myResults = you?.results ?? []
        myCharName = you?.username ?? null
        partnerResults = opp?.results ?? []
        partnerName = opp?.username ?? partnerName
        phase = 'preview'
        break
      }
      case 'searching':
        break
      case 'match_cancelled':
        stopSearchTimer()
        phase = 'menu'
        break
      case 'bot_match_start':
        stopSearchTimer()
        partnerName = 'BOT'
        isBotBattle = true
        isP1 = true
        navigateToSpin()
        break
      case 'partner_disconnected':
        alert('Your opponent disconnected.')
        phase = 'menu'
        break
      case 'error':
        joinError = msg.message as string
        break
    }
  }

  // ── Navigate to spin (keeps WS alive via module store) ─────────────────────
  function navigateToSpin() {
    if (!ws) return
    storedWsForSpin = true
    setRivalsWs({ ws, roomCode, isP1, opponentName: partnerName })
    goto('/?rivals=online')
  }

  // ── Matchmaking timer ──────────────────────────────────────────────────────
  function startSearchTimer() {
    searchSeconds = 0
    searchTimer = setInterval(() => { searchSeconds++ }, 1000)
  }

  function stopSearchTimer() {
    if (searchTimer) { clearInterval(searchTimer); searchTimer = null }
  }

  // ── Room actions ───────────────────────────────────────────────────────────
  function createRoom() {
    connectWs(() => setTimeout(() => ws?.send(JSON.stringify({ type: 'create_room' })), 100))
  }

  function joinRoom() {
    joinError = ''
    if (joinCode.length < 4) { joinError = 'Enter the room code.'; return }
    connectWs(() => setTimeout(() => ws?.send(JSON.stringify({ type: 'join_room', code: joinCode.toUpperCase() })), 100))
  }

  function findMatch() {
    connectWs(() => setTimeout(() => ws?.send(JSON.stringify({
      type: 'find_match',
      score: auth.user?.rivalsWins ?? 0,
    })), 100))
    startSearchTimer()
    phase = 'searching'
  }

  function cancelSearch() {
    ws?.send(JSON.stringify({ type: 'cancel_match' }))
    stopSearchTimer()
    ws?.close()
    phase = 'menu'
  }

  // ── vs Bot (offline) ───────────────────────────────────────────────────────
  function startBotRivals() {
    startOfflineRivals()
    goto('/?rivals=bot')
  }

  // ── Bot character generation ───────────────────────────────────────────────
  const BOT_TIERS = [
    { tier: 'F', score: 8 }, { tier: 'D', score: 18 }, { tier: 'C', score: 28 },
    { tier: 'B', score: 38 }, { tier: 'A', score: 48 }, { tier: 'S', score: 58 },
    { tier: 'SS', score: 68 }, { tier: 'SSS', score: 78 },
  ]
  const BOT_RACES = ['Human', 'Demon', 'Angel', 'Dragon', 'Undead', 'Elf', 'Orc', 'Vampire']
  const BOT_ARCHETYPES = ['Warrior', 'Mage', 'Rogue', 'Paladin', 'Berserker', 'Sage', 'Hunter']
  const STAT_CATS = [
    'strength','speed','agility','durability','iq','charisma','fightingSkill',
    'powerMastery','weaponMastery','armorStrength','potential','energyLevel',
  ] as const

  function rng(n: number) { return Math.floor(Math.random() * n) }

  function generateBotResults(): SpinResult[] {
    const r: SpinResult[] = []
    const ts = new Date().toISOString()
    let step = 0
    const push = (obj: Omit<SpinResult, 'step' | 'resultIndex' | 'timestamp'>) =>
      r.push({ ...obj, step: step++, resultIndex: 0, timestamp: ts })
    const race = BOT_RACES[rng(BOT_RACES.length)]
    const arch = BOT_ARCHETYPES[rng(BOT_ARCHETYPES.length)]
    push({ category: 'race', resultLabel: race, tier: 'C', score: 28 })
    push({ category: 'archetype', resultLabel: arch, tier: 'C', score: 28 })
    for (const cat of STAT_CATS) {
      const t = BOT_TIERS[rng(BOT_TIERS.length)]
      push({ category: cat, resultLabel: `Bot ${t.tier}`, tier: t.tier as SpinResult['tier'], score: t.score + rng(8) })
    }
    push({ category: 'title', resultLabel: 'The Algorithmic', tier: 'C', score: 28 })
    push({ category: 'power', resultLabel: 'Calculated Prediction', tier: 'B', score: 45 })
    push({ category: 'weapon', resultLabel: 'Iron Sword', tier: 'C', score: 28 })
    push({ category: 'armor', resultLabel: 'Chain Mail', tier: 'C', score: 28 })
    return r
  }
</script>

<main class="min-h-screen pt-16 pb-24 px-4" style="background: #07070d;">
  <div class="max-w-md mx-auto">

    <!-- ── Menu ─────────────────────────────────────────────────────────────── -->
    {#if phase === 'menu'}
      <div class="text-center mb-8 mt-8">
        <p class="text-xs tracking-[0.3em] uppercase mb-3" style="font-family: 'JetBrains Mono', monospace; color: #4e4635;">PvP Duels</p>
        <h1 style="font-family: 'Cinzel', serif; font-size: 1.75rem; font-weight: 900; color: #f9a8d4; letter-spacing: 0.12em;">RIVALS MODE</h1>
        <p class="text-xs mt-2 tracking-widest uppercase" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Spin a character. Fight to the top.</p>
      </div>

      <div class="flex flex-col gap-3">
        <!-- Pass & Play (local 2-player) -->
        <button
          onclick={() => goto('/?rivals=offline')}
          class="obsidian-slab py-4 rounded-2xl text-left px-6 transition-all hover:brightness-110 active:scale-[0.98]"
          style="cursor: pointer;"
        >
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style="background: rgba(154,144,123,0.12); border: 1px solid rgba(154,144,123,0.25);">
              <span class="material-symbols-outlined" style="color: #9a907b; font-size: 20px;">group</span>
            </div>
            <div>
              <p class="font-semibold text-sm" style="color: #e4e1ee; font-family: 'Cinzel', serif;">Pass &amp; Play</p>
              <p class="text-xs mt-0.5" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Two players, one device — take turns spinning</p>
            </div>
          </div>
        </button>

        <!-- vs Bot -->
        <button
          onclick={startBotRivals}
          class="obsidian-slab py-4 rounded-2xl text-left px-6 transition-all hover:brightness-110 active:scale-[0.98]"
          style="cursor: pointer; border: 1px solid rgba(52,211,153,0.2)!important;"
        >
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style="background: rgba(52,211,153,0.1); border: 1px solid rgba(52,211,153,0.3);">
              <span class="material-symbols-outlined" style="color: #34d399; font-size: 20px; font-variation-settings: 'FILL' 1;">smart_toy</span>
            </div>
            <div>
              <p class="font-semibold text-sm" style="color: #34d399; font-family: 'Cinzel', serif;">vs Bot</p>
              <p class="text-xs mt-0.5" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Spin your character, then fight an AI opponent</p>
            </div>
          </div>
        </button>

        <!-- Find Match -->
        <button
          onclick={() => auth.loggedIn ? findMatch() : goto('/login')}
          class="py-4 rounded-2xl text-left px-6 transition-all hover:brightness-110 active:scale-[0.98]"
          style="background: linear-gradient(180deg, #0d1f17 0%, #091410 100%); border: 1px solid rgba(52,211,153,0.3); box-shadow: 0 10px 30px rgba(0,0,0,0.6), inset 1px 1px 0 rgba(52,211,153,0.08); cursor: pointer;"
        >
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style="background: rgba(52,211,153,0.1); border: 1px solid rgba(52,211,153,0.3);">
              <span class="material-symbols-outlined" style="color: #34d399; font-size: 20px;">search</span>
            </div>
            <div class="flex-1">
              <p class="font-semibold text-sm flex items-center gap-2" style="color: #34d399; font-family: 'Cinzel', serif;">
                Find Match
                {#if !auth.loggedIn}
                  <span class="text-xs px-1.5 py-0.5 rounded" style="background: rgba(240,192,64,0.12); color: #f0c040; font-family: 'JetBrains Mono', monospace;">Login</span>
                {/if}
              </p>
              <p class="text-xs mt-0.5" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Auto-pair with a rival · bot fallback after 2 min</p>
            </div>
          </div>
        </button>

        <!-- Room Code -->
        <button
          onclick={() => auth.loggedIn ? (phase = 'create_or_join') : goto('/login')}
          class="py-4 rounded-2xl text-left px-6 transition-all hover:brightness-110 active:scale-[0.98]"
          style="background: linear-gradient(180deg, #1a0d18 0%, #100910 100%); border: 1px solid rgba(249,168,212,0.25); box-shadow: 0 10px 30px rgba(0,0,0,0.6), inset 1px 1px 0 rgba(249,168,212,0.06); cursor: pointer;"
        >
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style="background: rgba(249,168,212,0.08); border: 1px solid rgba(249,168,212,0.25);">
              <span class="material-symbols-outlined" style="color: #f9a8d4; font-size: 20px;">wifi</span>
            </div>
            <div class="flex-1">
              <p class="font-semibold text-sm flex items-center gap-2" style="color: #f9a8d4; font-family: 'Cinzel', serif;">
                Room Code
                {#if !auth.loggedIn}
                  <span class="text-xs px-1.5 py-0.5 rounded" style="background: rgba(240,192,64,0.12); color: #f0c040; font-family: 'JetBrains Mono', monospace;">Login</span>
                {/if}
              </p>
              <p class="text-xs mt-0.5" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Private room — challenge a specific player</p>
            </div>
          </div>
        </button>
      </div>

      <!-- Leaderboard -->
      <div class="mt-4">
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

      <!-- Pending challenges -->
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

    <!-- ── Searching ──────────────────────────────────────────────────────────── -->
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
        <h2 style="font-family: 'Cinzel', serif; font-size: 1.3rem; font-weight: 700; color: #34d399;">Searching for a rival…</h2>
        <p class="text-xs" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">
          Matching with the closest rival · bot fallback at 2:00
        </p>
        <button
          onclick={cancelSearch}
          class="mt-2 px-6 py-2.5 rounded-xl text-sm tracking-widest uppercase font-bold"
          style="font-family: 'Cinzel', serif; color: #6b7280; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); cursor: pointer;"
        >
          Cancel
        </button>
      </div>

    <!-- ── Create or Join ─────────────────────────────────────────────────────── -->
    {:else if phase === 'create_or_join'}
      <div class="text-center mb-8 mt-8">
        <button onclick={() => phase = 'menu'} class="text-xs mb-5 block" style="color: #4e4635; font-family: 'JetBrains Mono', monospace;">← Back</button>
        <h2 style="font-family: 'Cinzel', serif; font-size: 1.4rem; font-weight: 700; color: #f9a8d4;">Room Code</h2>
        <p class="text-xs mt-2" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Create a room and share the code, or join a friend's</p>
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

    <!-- ── Waiting for partner ────────────────────────────────────────────────── -->
    {:else if phase === 'waiting'}
      <div class="text-center mt-16 flex flex-col items-center gap-6">
        <div class="text-6xl animate-pulse">⏳</div>
        <h2 style="font-family: 'Cinzel', serif; font-size: 1.3rem; font-weight: 700; color: #f9a8d4;">
          {isP1 ? 'Waiting for opponent…' : 'Joining room…'}
        </h2>
        {#if roomCode && isP1}
          <div class="obsidian-slab px-6 py-4 rounded-2xl" style="border: 1px solid rgba(240,192,64,0.25)!important;">
            <p class="text-xs mb-2 tracking-widest uppercase" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Share this code</p>
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
        <button onclick={() => { ws?.close(); phase = 'menu' }} class="text-xs" style="color: #4e4635; font-family: 'JetBrains Mono', monospace; cursor: pointer;">← Back to menu</button>
      </div>

    <!-- ── Battle ready (both done, waiting for server to send battle_start) ─── -->
    {:else if phase === 'battle_ready'}
      <div class="text-center mt-16 flex flex-col items-center gap-6">
        <div class="text-5xl">⚔️</div>
        <h2 style="font-family: 'Cinzel', serif; font-size: 1.5rem; color: #f9a8d4;">Both players done!</h2>
        <div class="flex items-center gap-3">
          <div class="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style="border-color: #f0c040; border-top-color: transparent;"></div>
          <p class="text-xs" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Starting battle…</p>
        </div>
      </div>
    {/if}

  </div>
</main>

<!-- ── Pre-battle preview ─────────────────────────────────────────────────────
     Auto-advances to 'battle' after 4 seconds; Enter / click "Begin" skips. -->
{#if phase === 'preview'}
  <RivalsPreviewIntro
    team1={[{ results: myResults, name: myCharName ?? auth.user?.username ?? 'You' }]}
    team2={[{ results: partnerResults, name: partnerName || 'Opponent' }]}
    team1Label={myCharName ?? auth.user?.username ?? 'You'}
    team2Label={partnerName || 'Opponent'}
    team1Color="#7dd3fc"
    team2Color={isBotBattle ? '#34d399' : '#f9a8d4'}
    onContinue={() => { phase = 'battle' }}
  />
{/if}

<!-- ── Battle screen ──────────────────────────────────────────────────────────── -->
{#if phase === 'battle'}
  <div style="background: #07070d; min-height: 100dvh;">
    <QuickBattleView
      team1={[{ results: myResults, name: myCharName ?? auth.user?.username ?? 'You' }]}
      team2={[{ results: partnerResults, name: partnerName || 'Opponent' }]}
      team1Label={myCharName ?? auth.user?.username ?? 'You'}
      team2Label={partnerName || 'Opponent'}
      title={isBotBattle ? `${myCharName ?? 'You'} vs BOT` : `${myCharName ?? auth.user?.username ?? 'You'} vs ${partnerName}`}
      team2Color={isBotBattle ? '#34d399' : '#f9a8d4'}
      onComplete={(winner) => {
        const iWon = winner === 'team1'
        // Tell the server which side this client thinks won; server credits the win
        // only when both clients report agreeing results. See rivals-ws.ts 'battle_result'.
        const wsData = getRivalsWs()
        if (wsData && !isBotBattle) {
          try { wsData.ws.send(JSON.stringify({ type: 'battle_result', won: iWon })) } catch { /* socket closed */ }
        }
        if (auth.loggedIn) auth.recordBattleResult(iWon)
        // Record opponent locally so the profile page can show "play again /
        // view profile" links for recent battles. Strips bot/anon usernames.
        recordOpponent({
          username: partnerName || 'Opponent',
          myResult: winner === 'draw' ? 'draw' : (iWon ? 'won' : 'lost'),
          mode: isBotBattle ? 'bot' : 'rivals',
        })
      }}
      onRematch={() => {
        phase = 'menu'
        myResults = []
        partnerResults = []
        myCharName = null
        isBotBattle = false
      }}
      onBack={() => {
        phase = 'menu'
        myResults = []
        partnerResults = []
        myCharName = null
        isBotBattle = false
      }}
      backLabel="Back to Rivals"
    />
  </div>
{/if}
