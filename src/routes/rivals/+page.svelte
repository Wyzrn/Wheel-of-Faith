<script lang="ts">
  import { apiUrl, wsUrl as buildWsUrl } from '$lib/api'
  import { onDestroy, onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { auth } from '$lib/stores/auth.svelte'
  import { normalizeLegacyDisplayLabel, computeOverallScore, scoreTier } from '$lib/game/scoreTier'
  import { detectWeaknessElement } from '$lib/game/battle'
  import QuickBattleView from '../../components/QuickBattleView.svelte'
  import RivalsPreviewIntro from '../../components/RivalsPreviewIntro.svelte'
  import { recordOpponent } from '$lib/recentOpponents'
  import { getRecentlySpun, removeRecentlySpun, type RecentlySpunEntry } from '$lib/recentlySpun'
  import type { SpinResult } from '$lib/session/types'
  import { setRivalsWs, getRivalsWs, clearRivalsWs } from '$lib/stores/rivalsWs'
  import { startOfflineRivals, getOfflineRivalsResult, clearOfflineRivals } from '$lib/stores/offlineRivals'
  import { tilt } from '$lib/actions/tilt'

  // ── Phase state machine ────────────────────────────────────────────────────
  // 'preview' is a 4-second pre-battle screen showing both characters before
  // the fight begins. Auto-advances to 'battle' but can be skipped.
  // 'forfeit_result' shows after a mid-match DC or 60s timeout — server has
  // already credited the win/loss so we just acknowledge the outcome.
  type Phase = 'menu' | 'searching' | 'create_or_join' | 'waiting' | 'battle_ready' | 'preview' | 'battle' | 'forfeit_result'

  let phase = $state<Phase>('menu')
  let forfeitOutcome = $state<'win' | 'loss' | null>(null)
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

  // Recently Spun — characters preserved from DCs / timeouts. Refreshed
  // whenever the menu re-mounts so a brand-new forfeit shows up immediately.
  let recentlySpun = $state<RecentlySpunEntry[]>([])
  function refreshRecentlySpun() { recentlySpun = getRecentlySpun() }

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

  // Save the player's freshly-spun rivals character to their roster. The
  // win medal (PATCH /rivals-win) is credited only when this player won
  // the fight; on a loss or draw the character still lands in the roster
  // but without a medal increment.
  let lastBattleWon = $state<boolean | null>(null)
  async function saveRivalsWin() {
    if (!auth.loggedIn || myResults.length === 0) throw new Error('not logged in')
    const race      = myResults.find(r => r.category === 'race')?.resultLabel      ?? ''
    const archetype = myResults.find(r => r.category === 'archetype')?.resultLabel ?? ''
    const STAT_CATS = ['strength','speed','agility','durability','iq','charisma','fightingSkill','powerMastery','weaponMastery','potential','energyLevel']
    const statScores = Object.fromEntries(STAT_CATS.map(c => [c, myResults.find(r => r.category === c)?.score ?? 0]))
    const overall = computeOverallScore(statScores)
    const res = await fetch(apiUrl('/api/characters'), {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: myCharName || race, race, archetype,
        overall_score: overall, overall_tier: scoreTier(overall),
        spins: myResults,
        elementWeaknesses: myResults
          .filter(r => r.category === 'weakness')
          .map(r => detectWeaknessElement(r.resultLabel))
          .filter((e): e is NonNullable<typeof e> => !!e),
      }),
    })
    if (!res.ok) throw new Error('save failed')
    const { shareId } = await res.json() as { shareId: string }
    try {
      const ex: string[] = JSON.parse(localStorage.getItem('wof_saved_chars') ?? '[]')
      if (!ex.includes(shareId)) localStorage.setItem('wof_saved_chars', JSON.stringify([shareId, ...ex].slice(0, 50)))
    } catch { /* ignore */ }
    if (lastBattleWon === true) {
      await fetch(apiUrl(`/api/characters/${shareId}/rivals-win`), { method: 'PATCH', credentials: 'include' })
    }
  }

  // Routed through the shared wsUrl helper so VITE_API_URL flips both
  // fetches and the rivals websocket between same-origin (Heroku) and
  // cross-origin (itch.io → Heroku) builds. SSR-safe (returns '' on the
  // server) so the same code-path is valid for both adapters.
  const WS_URL = typeof window === 'undefined' ? '' : buildWsUrl('/api/rivals/ws')

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  onMount(() => {
    refreshRecentlySpun()
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

    // DC/timeout return: the main page navigates here with ?dc_win=1 (opponent
    // forfeited) or ?timed_out=1 (this player ran the 60s clock out). The
    // server has already credited the result; just acknowledge it.
    if ($page.url.searchParams.get('dc_win') === '1') {
      forfeitOutcome = 'win'
      if (auth.loggedIn) auth.recordBattleResult(true)
      phase = 'forfeit_result'
      return
    }
    if ($page.url.searchParams.get('timed_out') === '1') {
      forfeitOutcome = 'loss'
      if (auth.loggedIn) auth.recordBattleResult(false)
      phase = 'forfeit_result'
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
          fetch(apiUrl(`/api/clans/${challenge.clanId}/messages`), {
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

<!-- Menu chrome is hidden during the battle / preview phases so it doesn't
     reserve a full viewport above the BattleArena (which has its own
     fixed top header) and force the player to scroll down to see the fight. -->
{#if phase !== 'battle' && phase !== 'preview'}
<main class="min-h-screen pt-16 pb-24 px-4" style="background: transparent;">
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
          class="obsidian-slab py-4 rounded-2xl text-left px-6 transition-all hover:brightness-110 active:scale-[0.98]" use:tilt={{ max: 5 }}
          style="cursor: pointer;"
        >
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style="background: rgba(154,144,123,0.12); border: 1px solid rgba(154,144,123,0.25);">
              <span class="material-symbols-outlined" style="color: #9a907b; font-size: 20px;">group</span>
            </div>
            <div>
              <p class="font-semibold text-sm" style="color: #e9dfeb; font-family: 'Cinzel', serif;">Pass &amp; Play</p>
              <p class="text-xs mt-0.5" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Two players, one device — take turns spinning</p>
            </div>
          </div>
        </button>

        <!-- vs Bot -->
        <button
          onclick={startBotRivals}
          class="obsidian-slab py-4 rounded-2xl text-left px-6 transition-all hover:brightness-110 active:scale-[0.98]" use:tilt={{ max: 5 }}
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
          class="py-4 rounded-2xl text-left px-6 transition-all hover:brightness-110 active:scale-[0.98]" use:tilt={{ max: 5 }}
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
          class="py-4 rounded-2xl text-left px-6 transition-all hover:brightness-110 active:scale-[0.98]" use:tilt={{ max: 5 }}
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

      <!-- Recently Spun — capped at 10, populated from DC/timeout forfeits
           so a long spin session isn't lost if the opponent flakes out. -->
      {#if recentlySpun.length > 0}
        <div class="mt-6">
          <div class="flex items-center justify-between mb-3">
            <p class="text-xs tracking-widest uppercase" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Recently Spun</p>
            <span class="text-[10px]" style="color: #4e4635; font-family: 'JetBrains Mono', monospace;">{recentlySpun.length} / 10</span>
          </div>
          <div class="flex flex-col gap-2">
            {#each recentlySpun as entry (entry.id)}
              <div class="flex items-center justify-between gap-2 px-4 py-3 rounded-xl" style="background: rgba(240,192,64,0.05); border: 1px solid rgba(240,192,64,0.18);">
                <div class="flex-1 min-w-0">
                  <p class="text-sm truncate" style="font-family: 'Cinzel', serif; color: #ffdf96;">{entry.name}</p>
                  <p class="text-[10px] truncate" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">
                    {entry.race ?? '—'}{entry.archetype ? ` · ${entry.archetype}` : ''}{entry.reason ? ` · ${entry.reason}` : ''}
                  </p>
                </div>
                <button
                  onclick={() => { removeRecentlySpun(entry.id); refreshRecentlySpun() }}
                  class="text-xs px-2 py-1 rounded-md shrink-0"
                  style="font-family: 'JetBrains Mono', monospace; color: #6b7280; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); cursor: pointer;"
                  title="Discard"
                >✕</button>
              </div>
            {/each}
          </div>
        </div>
      {/if}

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

    <!-- ── Forfeit result: shown after server-credited DC/timeout outcomes ──── -->
    {:else if phase === 'forfeit_result'}
      <div class="text-center mt-16 flex flex-col items-center gap-5">
        {#if forfeitOutcome === 'win'}
          <div class="text-5xl">🏆</div>
          <h2 style="font-family: 'Cinzel', serif; font-size: 1.5rem; color: #34d399;">Victory by Forfeit</h2>
          <p class="text-sm max-w-xs" style="color: #c9bfb0; font-family: 'JetBrains Mono', monospace; line-height: 1.6;">
            Your opponent disconnected or timed out. The win has been credited and your in-progress character is saved to <span style="color: #f0c040;">Recently Spun</span> so you can finish it later.
          </p>
        {:else}
          <div class="text-5xl">⌛</div>
          <h2 style="font-family: 'Cinzel', serif; font-size: 1.5rem; color: #ef4444;">Timed Out</h2>
          <p class="text-sm max-w-xs" style="color: #c9bfb0; font-family: 'JetBrains Mono', monospace; line-height: 1.6;">
            You didn't advance to the next spin within 60 seconds. The match was forfeited to your opponent.
          </p>
        {/if}
        <button
          onclick={() => { phase = 'menu'; forfeitOutcome = null; history.replaceState(null, '', '/rivals') }}
          class="mt-2 px-6 py-2.5 rounded-xl text-sm tracking-widest uppercase font-bold"
          style="font-family: 'Cinzel', serif; color: #ffdf96; background: rgba(240,192,64,0.12); border: 1px solid rgba(240,192,64,0.3); cursor: pointer;"
        >Back to Menu</button>
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
{/if}

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
  <div style="background: transparent; min-height: 100dvh;">
    <QuickBattleView
      team1={[{ results: myResults, name: myCharName ?? auth.user?.username ?? 'You' }]}
      team2={[{ results: partnerResults, name: partnerName || 'Opponent' }]}
      team1Label={myCharName ?? auth.user?.username ?? 'You'}
      team2Label={partnerName || 'Opponent'}
      title={isBotBattle ? `${myCharName ?? 'You'} vs BOT` : `${myCharName ?? auth.user?.username ?? 'You'} vs ${partnerName}`}
      team2Color={isBotBattle ? '#34d399' : '#f9a8d4'}
      forceManual={true}
      onSaveCharacter={() => saveRivalsWin()}
      onComplete={(winner) => {
        const iWon = winner === 'team1'
        lastBattleWon = winner === 'draw' ? null : iWon
        // Tell the server which side this client thinks won; server credits the win
        // only when both clients report agreeing results. See rivals-ws.ts 'battle_result'.
        const wsData = getRivalsWs()
        if (wsData && !isBotBattle) {
          try { wsData.ws.send(JSON.stringify({ type: 'battle_result', won: iWon })) } catch { /* socket closed */ }
        }
        if (auth.loggedIn) auth.recordBattleResult(iWon)
        // Character is no longer auto-saved on a win — the player now picks
        // explicitly via the "Save Character" button in the result modal.
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
