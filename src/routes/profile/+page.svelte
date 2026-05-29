<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { auth } from '$lib/stores/auth.svelte'
  import { loadSpinHistory } from '$lib/spinHistory'
  import type { SpinHistoryEntry } from '$lib/spinHistory'
  import { ACHIEVEMENTS, buildContext, evaluateAll, colorForTier, pendingRewardUnlocks, markRewardsCredited, type AchievementState, type AchievementTier } from '$lib/achievements'
  import { loadRecentOpponents, type RecentOpponent } from '$lib/recentOpponents'

  let characters = $state<any[]>([])
  let loading = $state(true)
  let spinHistory = $state<SpinHistoryEntry[]>([])
  // Achievements computed locally on mount + after auth settles
  let achievementStates = $state<AchievementState[]>([])
  let unlockedAchievements = $derived(achievementStates.filter(a => a.condition.met))
  let recentOpponents = $state<RecentOpponent[]>([])

  function formatDate(iso: string) {
    try {
      const d = new Date(iso)
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    } catch { return '—' }
  }

  onMount(async () => {
    // Load local spin history immediately (no auth needed)
    spinHistory = loadSpinHistory()

    if (!auth.loggedIn && !auth.loading) { goto('/login'); return }
    // Wait for auth to settle
    await new Promise<void>(res => {
      if (!auth.loading) { res(); return }
      const iv = setInterval(() => { if (!auth.loading) { clearInterval(iv); res() } }, 50)
    })
    if (!auth.user) { goto('/login'); return }

    const res = await fetch(`/api/users/${auth.user.username}/profile`, { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      characters = data.characters ?? []
    }
    // Evaluate achievements with full context (auth + history + slots).
    achievementStates = evaluateAll(buildContext(auth.user)).states
    recentOpponents = loadRecentOpponents()
    loading = false

    // Credit any unlocked-but-uncredited achievement shard rewards. Mirrors
    // the same flow used on the dedicated achievements page so badges pay
    // out regardless of which page the user visits first.
    await creditPendingAchievementRewards()
  })

  async function creditPendingAchievementRewards() {
    if (!auth.loggedIn || !auth.user) return
    const pending = pendingRewardUnlocks()
    if (pending.length === 0) return
    const delta = pending.reduce((s, p) => s + p.reward, 0)
    if (delta <= 0) return
    auth.updateShopData((auth.user.shards ?? 0) + delta, auth.user.gamepasses ?? [])
    try {
      const res = await fetch('/api/shop/shards/adjust', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta }),
      })
      if (!res.ok) {
        auth.updateShopData((auth.user.shards ?? 0) - delta, auth.user.gamepasses ?? [])
        return
      }
      markRewardsCredited(pending.map(p => p.id))
    } catch {
      auth.updateShopData((auth.user.shards ?? 0) - delta, auth.user.gamepasses ?? [])
    }
  }

  function timeAgoShort(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime()
    const m = Math.floor(ms / 60000)
    if (m < 1) return 'now'
    if (m < 60) return `${m}m`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h`
    return `${Math.floor(h / 24)}d`
  }

  // Top 10 characters by score (strongest first)
  let topCharacters = $derived(
    [...characters].sort((a, b) => (b.overall_score ?? 0) - (a.overall_score ?? 0)).slice(0, 10)
  )

  // Top 5 for Hall of Fame
  let top5 = $derived(
    [...characters].sort((a, b) => (b.overall_score ?? 0) - (a.overall_score ?? 0)).slice(0, 5)
  )

  // 10 most recent spin history entries
  let recentHistory = $derived(
    [...spinHistory].sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()).slice(0, 10)
  )

  // Stats derived from local spin history. Computed via a single helper so the
  // expensive O(n) pass over the full history happens once per change.
  function calcCommonest(history: SpinHistoryEntry[], pick: (e: SpinHistoryEntry) => string): string | null {
    if (!history.length) return null
    const counts: Record<string, number> = {}
    for (const e of history) counts[pick(e)] = (counts[pick(e)] ?? 0) + 1
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  }

  // Lifetime stat aggregates — designed to surface "you've done this many runs"
  // numbers that make the player feel their time is being measured (hospitality:
  // celebrate the journey, not just the destination).
  let totalSessions = $derived(spinHistory.length)
  let totalSpins    = $derived(spinHistory.reduce((s, e) => s + e.spinCount, 0))
  let avgScore = $derived(spinHistory.length
    ? spinHistory.reduce((s, e) => s + (e.overallScore ?? 0), 0) / spinHistory.length
    : 0)
  let bestEntry = $derived(spinHistory.length
    ? spinHistory.reduce((best, e) => e.overallScore > best.overallScore ? e : best, spinHistory[0])
    : null)
  let bestTier = $derived(bestEntry?.overallTier ?? null)
  let mostCommonRace      = $derived(calcCommonest(spinHistory, e => e.race))
  let mostCommonArchetype = $derived(calcCommonest(spinHistory, e => e.archetype))

  // Rivals win-rate (computed live from auth — only meaningful with sessions)
  let totalRivalsGames = $derived((auth.user?.rivalsWins ?? 0) + (auth.user?.rivalsLosses ?? 0))
  let rivalsWinRate    = $derived(totalRivalsGames > 0
    ? Math.round((auth.user!.rivalsWins / totalRivalsGames) * 100)
    : null)

  // Top-tier rolls — chase points. Counts S+ and above as "elite", SSS+ as "mythic".
  const ELITE_TIERS = new Set([
    'S','S+','SS-','SS','SS+','SSS-','SSS','SSS+',
    'Z-','Z','Z+','ZZ-','ZZ','ZZ+','ZZZ-','ZZZ','ZZZ+',
    'Celestial-','Celestial','Celestial+','Godly-','Godly',
    'Primordial','Primordial+','Absolute-','Absolute','Absolute+',
  ])
  const MYTHIC_TIERS = new Set([
    'SSS-','SSS','SSS+','Z-','Z','Z+','ZZ-','ZZ','ZZ+','ZZZ-','ZZZ','ZZZ+',
    'Celestial-','Celestial','Celestial+','Godly-','Godly',
    'Primordial','Primordial+','Absolute-','Absolute','Absolute+',
  ])
  let eliteRolls  = $derived(spinHistory.filter(e => ELITE_TIERS.has(e.overallTier)).length)
  let mythicRolls = $derived(spinHistory.filter(e => MYTHIC_TIERS.has(e.overallTier)).length)

  // Canonical tier palette — mirrors gallery + characters page + app.css
  // (--tier-*). Cosmic+ entries surface the gradient mid-stop here; chips
  // and badges can fall back to var(--tier-*-grad) for the gradient look.
  const TIER_COLORS: Record<string, string> = {
    'F-':'#2c2c2c','F':'#404040','F+':'#525252',
    'E-':'#4b5563','E':'#64748b','E+':'#94a3b8',
    'D-':'#14532d','D':'#166534','D+':'#22c55e',
    'C-':'#047857','C':'#059669','C+':'#10b981',
    'B-':'#115e59','B':'#0d9488','B+':'#14b8a6',
    'A-':'#155e75','A':'#0e7490','A+':'#06b6d4',
    'S-':'#0c4a6e','S':'#0369a1','S+':'#0ea5e9',
    'SS-':'#1e3a8a','SS':'#2563eb','SS+':'#3b82f6',
    'SSS-':'#4338ca','SSS':'#4f46e5','SSS+':'#6366f1',
    'Z-':'#5b21b6','Z':'#7c3aed','Z+':'#8b5cf6',
    'ZZ-':'#86198f','ZZ':'#a21caf','ZZ+':'#c026d3',
    'ZZZ-':'#be185d','ZZZ':'#db2777','ZZZ+':'#ec4899',
    'Cosmic-':'#0e6b8a','Cosmic':'#0891b2','Cosmic+':'#06b6d4',
    'Immortal-':'#d946ef','Immortal':'#ec4899','Immortal+':'#f472b6',
    'Celestial-':'#831843','Celestial':'#9d174d','Celestial+':'#be185d',
    'Godly-':'#f9a8d4','Godly':'#f472b6','Godly+':'#ec4899',
    'Primordial-':'#d4d4d8','Primordial':'#e4e4e7','Primordial+':'#fafafa',
    'Absolute-':'#7dd3fc','Absolute':'#38bdf8','Absolute+':'#0ea5e9',
    'Transcendent-':'#84cc16','Transcendent':'#65a30d','Transcendent+':'#4d7c0f',
    'Infinite-':'#525252','Infinite':'#262626','Infinite+':'#000000',
  }
</script>

<main class="min-h-screen pt-16 pb-24 px-4" style="background: transparent;">
  <div class="max-w-2xl mx-auto">

    {#if loading || auth.loading}
      <div class="flex items-center justify-center py-24">
        <p class="text-sm tracking-widest uppercase" style="color: #4e4635; font-family: 'JetBrains Mono', monospace;">Loading…</p>
      </div>
    {:else if auth.user}
      <!-- Avatar + Name -->
      <div class="obsidian-slab flex items-center gap-4 mb-6 rounded-2xl p-5">
        <div class="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black shrink-0"
          style="background: linear-gradient(135deg, #1f1f28 0%, #13121c 100%); border: 2px solid rgba(240,192,64,0.4); color: #f0c040; font-family: 'Cinzel', serif; box-shadow: 0 0 20px rgba(240,192,64,0.12);">
          {auth.user.username[0].toUpperCase()}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-[10px] tracking-[0.25em] uppercase mb-0.5" style="font-family: 'JetBrains Mono', monospace; color: #4e4635;">Fate Bearer</p>
          <h1 style="font-family: 'Cinzel', serif; font-size: 1.5rem; font-weight: 700; color: #ffdf96;">
            {auth.user.username}
          </h1>
          {#if auth.user.email}
            <p class="text-xs mt-0.5" style="color: #4e4635; font-family: 'JetBrains Mono', monospace;">{auth.user.email}</p>
          {/if}
        </div>
        <div class="ml-auto flex items-center gap-2 shrink-0">
          {#if auth.user.isAdmin}
            <a
              href="/admin"
              class="text-xs px-3 py-1.5 rounded-lg"
              style="background: rgba(245,158,11,0.12); border: 1px solid rgba(245,158,11,0.4); color: #fde68a; font-family: 'JetBrains Mono', monospace; text-decoration: none;"
              title="Developer sandbox"
            >Admin</a>
          {/if}
          <button
            onclick={async () => { await auth.logout(); goto('/') }}
            class="text-xs px-3 py-1.5 rounded-lg"
            style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); color: #9a907b; font-family: 'JetBrains Mono', monospace; cursor: pointer;"
          >Sign out</button>
        </div>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-3 gap-3 mb-8">
        {#each [['Rivals Wins', auth.user.rivalsWins, '#22c55e'], ['Rivals Losses', auth.user.rivalsLosses, '#ef4444'], ['Games Played', auth.user.gamesPlayed, '#f0c040']] as [label, val, color]}
          <div class="obsidian-slab rounded-xl p-4 text-center">
            <div class="text-2xl font-black mb-1" style="color: {color}; font-family: 'Cinzel', serif;">{val}</div>
            <div class="text-[10px] tracking-widest uppercase" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">{label}</div>
          </div>
        {/each}
      </div>

      <!-- Characters -->
      <div class="mb-8">
        <div class="flex items-baseline gap-2 mb-4">
          <h2 class="text-xs tracking-[0.2em] uppercase" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Your Characters</h2>
          {#if characters.length > 0}
            <span class="text-[10px]" style="color: #4e4635; font-family: 'JetBrains Mono', monospace;">Top {Math.min(characters.length, 10)} of {characters.length}</span>
          {/if}
        </div>
        {#if characters.length === 0}
          <p class="text-sm text-center py-8" style="color: #4e4635; font-style: italic;">No saved characters yet — finish a spin session to save one.</p>
        {/if}
        <div class="flex flex-col gap-3">
          {#each topCharacters as c}
            {@const tc = TIER_COLORS[c.overall_tier] ?? '#9a907b'}
            <a href="/character/{c.shareId}"
              class="flex items-center gap-4 px-4 py-3 rounded-xl transition-all hover:brightness-110"
              style="background: linear-gradient(145deg, #241f29 0%, #14111a 100%); border: 1px solid {tc}22; box-shadow: inset 1px 1px 0 rgba(255,223,150,0.04); text-decoration: none;">
              <div class="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center" style="background: {tc}18; border: 1px solid {tc}44;">
                <span class="text-xs font-black" style="color: {tc}; font-family: 'Cinzel', serif;">{c.overall_tier}</span>
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-semibold truncate" style="color: #ffdf96; font-family: 'Cinzel', serif;">{c.name}</p>
                <p class="text-xs truncate" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">{c.race} · {c.archetype}</p>
              </div>
              <span class="material-symbols-outlined shrink-0" style="color: #4e4635; font-size: 18px;">chevron_right</span>
            </a>
          {/each}
        </div>
      </div>

      <!-- Hall of Fame -->
      {#if top5.length > 0}
        <section class="mb-8">
          <div class="flex items-center gap-2 mb-4">
            <span class="material-symbols-outlined" style="font-size: 20px; color: #f0c040; font-variation-settings: 'FILL' 1;">military_tech</span>
            <h2 style="font-family: 'Cinzel', serif; font-size: 1.1rem; font-weight: 700; color: #ffdf96; letter-spacing: 0.1em;">Hall of Fame</h2>
            <span class="font-mono text-xs" style="color: #4e4635;">Top 5 characters</span>
          </div>
          <div class="flex flex-col gap-2">
            {#each top5 as char, i}
              <a href="/character/{char.shareId}" class="flex items-center gap-3 rounded-xl px-4 py-3 transition-all hover:brightness-110" style="background: linear-gradient(135deg, rgba(240,192,64,0.08), rgba(240,192,64,0.03)); border: 1px solid rgba(240,192,64,{i === 0 ? '0.4' : '0.18'}); text-decoration: none;">
                <span style="font-family: 'JetBrains Mono', monospace; font-size: 1rem; min-width: 24px; text-align: center;">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}</span>
                <div class="flex-1 min-w-0">
                  <p class="font-semibold truncate" style="font-family: 'Cinzel', serif; color: #ffdf96; font-size: 0.9rem;">{char.name}</p>
                  <p class="text-xs mt-0.5" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">{char.race} · {char.archetype}</p>
                </div>
                <div class="text-right shrink-0">
                  <p class="font-bold text-sm" style="font-family: 'Cinzel', serif; color: #f0c040;">{char.overall_tier}</p>
                  <p class="font-mono text-xs" style="color: #4e4635;">{char.overall_score?.toFixed(1) ?? '—'}</p>
                </div>
              </a>
            {/each}
          </div>
        </section>
      {/if}

      <!-- ─── Recent Opponents ─────────────────────────────────────────── -->
      {#if recentOpponents.length > 0}
        <section class="mb-8">
          <div class="flex items-center gap-2 mb-4">
            <span class="material-symbols-outlined" style="font-size: 20px; color: #a78bfa; font-variation-settings: 'FILL' 1;">swords</span>
            <h2 style="font-family: 'Cinzel', serif; font-size: 1.1rem; font-weight: 700; color: #ffdf96; letter-spacing: 0.1em;">Recent Opponents</h2>
            <span class="font-mono text-xs" style="color: #4e4635;">last {recentOpponents.length} fought</span>
          </div>
          <div class="flex flex-col gap-2">
            {#each recentOpponents as opp}
              {@const resultColor = opp.myResult === 'won' ? '#34d399' : opp.myResult === 'lost' ? '#f87171' : '#9a907b'}
              <a href={`/users/${encodeURIComponent(opp.username)}`}
                class="flex items-center gap-3 rounded-xl px-4 py-3 transition-all hover:brightness-110"
                style="background: linear-gradient(145deg, #241f29 0%, #14111a 100%); border: 1px solid {resultColor}33; text-decoration: none;">
                <span class="material-symbols-outlined" style="font-size: 16px; color: {resultColor}; font-variation-settings: 'FILL' 1;">
                  {opp.myResult === 'won' ? 'emoji_events' : opp.myResult === 'lost' ? 'sentiment_dissatisfied' : 'handshake'}
                </span>
                <div class="flex-1 min-w-0">
                  <p class="font-semibold truncate text-sm" style="font-family: 'Cinzel', serif; color: #ffdf96;">{opp.username}</p>
                  <p class="font-mono text-[10px]" style="color: #9a907b;">
                    <span style="color: {resultColor};">{opp.myResult === 'won' ? 'Victory' : opp.myResult === 'lost' ? 'Defeat' : 'Draw'}</span>
                    · {opp.mode} · {timeAgoShort(opp.lastBattledAt)} ago
                  </p>
                </div>
                <span class="material-symbols-outlined shrink-0" style="color: #4e4635; font-size: 18px;">chevron_right</span>
              </a>
            {/each}
          </div>
        </section>
      {/if}

      <!-- ─── Achievements ─────────────────────────────────────────────── -->
      {#if achievementStates.length > 0}
        <section class="mb-8">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined" style="font-size: 20px; color: #f0c040; font-variation-settings: 'FILL' 1;">workspace_premium</span>
              <h2 style="font-family: 'Cinzel', serif; font-size: 1.1rem; font-weight: 700; color: #ffdf96; letter-spacing: 0.1em;">Achievements</h2>
              <span class="font-mono text-xs" style="color: #4e4635;">{unlockedAchievements.length}/{ACHIEVEMENTS.length}</span>
            </div>
            <a href="/achievements" class="font-mono text-xs px-3 py-1.5 rounded-lg" style="background: rgba(240,192,64,0.08); border: 1px solid rgba(240,192,64,0.22); color: #f0c040; text-decoration: none;">
              View all →
            </a>
          </div>
          {#if unlockedAchievements.length === 0}
            <p class="text-sm text-center py-6" style="color: #4e4635; font-style: italic;">No achievements yet — keep playing to unlock badges.</p>
          {:else}
            <!-- Grid of unlocked badge tiles (compact, latest 12) -->
            <div class="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {#each unlockedAchievements.slice(0, 12) as a}
                {@const color = colorForTier(a.tier)}
                <div class="rounded-xl px-3 py-3 text-center" style="background: linear-gradient(135deg, {color}10, {color}03); border: 1px solid {color}55; box-shadow: 0 0 12px {color}18;" title={a.description}>
                  <span class="material-symbols-outlined" style="font-size: 26px; color: {color}; font-variation-settings: 'FILL' 1; filter: drop-shadow(0 0 6px {color}aa);">{a.icon}</span>
                  <p class="text-[10px] font-bold mt-1 truncate" style="font-family: 'Cinzel', serif; color: #ffdf96;">{a.name}</p>
                </div>
              {/each}
            </div>
            {#if unlockedAchievements.length > 12}
              <p class="text-xs text-center mt-3" style="color: #4e4635; font-family: 'JetBrains Mono', monospace;">+{unlockedAchievements.length - 12} more on the achievements page</p>
            {/if}
          {/if}
        </section>
      {/if}

      <!-- ─── Spin History ─────────────────────────────────────────────── -->
      {#if spinHistory.length > 0}
        <div>
          <!-- Header + lifetime stats -->
          <div class="flex items-baseline gap-3 mb-4">
            <h2 class="text-xs tracking-[0.2em] uppercase" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Spin History</h2>
            <span class="text-[10px]" style="color: #4e4635; font-family: 'JetBrains Mono', monospace;">
              {#if spinHistory.length > 10}Last 10 of {spinHistory.length} sessions{:else}{spinHistory.length} session{spinHistory.length === 1 ? '' : 's'}{/if} · {totalSpins} total spins
            </span>
          </div>

          <!-- Lifetime stats grid — celebrates the journey, not just the result.
               Built from local spin history + auth rivals counters. -->
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-5">
            <!-- Sessions -->
            <div class="obsidian-slab rounded-xl px-3 py-2.5">
              <p class="text-[9px] tracking-[0.18em] uppercase mb-0.5" style="font-family: 'JetBrains Mono', monospace; color: #4e4635;">Sessions</p>
              <p class="font-black" style="font-family: 'Cinzel', serif; font-size: 1.25rem; color: #ffdf96;">{totalSessions}</p>
            </div>
            <!-- Total spins -->
            <div class="obsidian-slab rounded-xl px-3 py-2.5">
              <p class="text-[9px] tracking-[0.18em] uppercase mb-0.5" style="font-family: 'JetBrains Mono', monospace; color: #4e4635;">Total Spins</p>
              <p class="font-black" style="font-family: 'Cinzel', serif; font-size: 1.25rem; color: #ffdf96;">{totalSpins.toLocaleString()}</p>
            </div>
            <!-- Avg score -->
            <div class="obsidian-slab rounded-xl px-3 py-2.5">
              <p class="text-[9px] tracking-[0.18em] uppercase mb-0.5" style="font-family: 'JetBrains Mono', monospace; color: #4e4635;">Avg Score</p>
              <p class="font-black" style="font-family: 'Cinzel', serif; font-size: 1.25rem; color: #ffdf96;">{avgScore.toFixed(1)}</p>
            </div>
            <!-- Elite rolls -->
            {#if eliteRolls > 0}
              <div class="obsidian-slab rounded-xl px-3 py-2.5" style="border-color: rgba(244,113,113,0.35);">
                <p class="text-[9px] tracking-[0.18em] uppercase mb-0.5" style="font-family: 'JetBrains Mono', monospace; color: #4e4635;">S+ Rolls</p>
                <p class="font-black" style="font-family: 'Cinzel', serif; font-size: 1.25rem; color: #f87171;">{eliteRolls}</p>
              </div>
            {/if}
            <!-- Mythic rolls -->
            {#if mythicRolls > 0}
              <div class="obsidian-slab rounded-xl px-3 py-2.5" style="border-color: rgba(167,139,250,0.35);">
                <p class="text-[9px] tracking-[0.18em] uppercase mb-0.5" style="font-family: 'JetBrains Mono', monospace; color: #4e4635;">SSS+ Rolls</p>
                <p class="font-black" style="font-family: 'Cinzel', serif; font-size: 1.25rem; color: #a78bfa;">{mythicRolls}</p>
              </div>
            {/if}
            <!-- Rivals win rate (if any games played) -->
            {#if rivalsWinRate !== null}
              <div class="obsidian-slab rounded-xl px-3 py-2.5">
                <p class="text-[9px] tracking-[0.18em] uppercase mb-0.5" style="font-family: 'JetBrains Mono', monospace; color: #4e4635;">Rivals Win %</p>
                <p class="font-black" style="font-family: 'Cinzel', serif; font-size: 1.25rem; color: {rivalsWinRate >= 50 ? '#34d399' : '#9a907b'};">{rivalsWinRate}%</p>
              </div>
            {/if}
          </div>

          <!-- Tag chips for "best tier" and "favorite race/archetype" -->
          <div class="flex flex-wrap gap-2 mb-5">
            {#if bestTier}
              {@const tc = TIER_COLORS[bestTier] ?? '#9a907b'}
              <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style="background: {tc}18; border: 1px solid {tc}44;">
                <span class="material-symbols-outlined text-xs" style="color: {tc}; font-variation-settings: 'FILL' 1; font-size: 13px;">emoji_events</span>
                <span class="text-[10px] tracking-[0.12em] uppercase" style="font-family: 'JetBrains Mono', monospace; color: {tc};">Best: {bestTier}</span>
              </div>
            {/if}
            {#if mostCommonRace}
              <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style="background: rgba(240,192,64,0.07); border: 1px solid rgba(240,192,64,0.2);">
                <span class="material-symbols-outlined text-xs" style="color: #f0c040; font-variation-settings: 'FILL' 1; font-size: 13px;">diversity_3</span>
                <span class="text-[10px] tracking-[0.12em] uppercase" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Fav race: <span style="color: #ffdf96;">{mostCommonRace}</span></span>
              </div>
            {/if}
            {#if mostCommonArchetype}
              <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style="background: rgba(167,139,250,0.07); border: 1px solid rgba(167,139,250,0.2);">
                <span class="material-symbols-outlined text-xs" style="color: #a78bfa; font-variation-settings: 'FILL' 1; font-size: 13px;">military_tech</span>
                <span class="text-[10px] tracking-[0.12em] uppercase" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Fav class: <span style="color: #ffdf96;">{mostCommonArchetype}</span></span>
              </div>
            {/if}
          </div>

          <!-- History list -->
          <div class="flex flex-col gap-2">
            {#each recentHistory as entry}
              {@const tc = TIER_COLORS[entry.overallTier] ?? '#9a907b'}
              <div
                class="flex items-center gap-3 px-4 py-3 rounded-xl"
                style="background: linear-gradient(145deg, #241f29 0%, #14111a 100%); border: 1px solid rgba(255,223,150,0.06); box-shadow: inset 1px 1px 0 rgba(255,223,150,0.03);"
              >
                <!-- Tier badge -->
                <div class="shrink-0 px-2 py-1 rounded text-[11px] font-black" style="background: {tc}18; border: 1px solid {tc}44; color: {tc}; min-width: 2.5rem; text-align: center; font-family: 'JetBrains Mono', monospace;">
                  {entry.overallTier}
                </div>

                <!-- Name + race/archetype -->
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold truncate" style="color: #e9dfeb; font-family: 'Cinzel', serif;">{entry.name}</p>
                  <p class="text-[11px] truncate mt-0.5" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">{entry.race} · {entry.archetype}</p>
                </div>

                <!-- Spin count + date -->
                <div class="shrink-0 text-right">
                  <p class="text-[11px]" style="color: #4e4635; font-family: 'JetBrains Mono', monospace;">{entry.spinCount} spins</p>
                  <p class="text-[10px] mt-0.5" style="color: #4e4635; font-family: 'JetBrains Mono', monospace;">{formatDate(entry.completedAt)}</p>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {:else if !loading}
        <div>
          <h2 class="text-xs tracking-[0.2em] uppercase mb-4" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Spin History</h2>
          <p class="text-sm text-center py-6" style="color: #4e4635; font-style: italic;">Complete a spin session to start tracking your history.</p>
        </div>
      {/if}
    {/if}

  </div>
</main>
