<script lang="ts">
  import { onMount } from 'svelte'
  import { auth } from '$lib/stores/auth.svelte'

  type LeaderEntry = {
    username: string
    rivalsWins: number
    rivalsLosses: number
    gamesPlayed: number
  }

  let entries   = $state<LeaderEntry[]>([])
  let loading   = $state(true)
  let error     = $state<string | null>(null)

  onMount(async () => {
    try {
      const res = await fetch('/api/leaderboard')
      if (!res.ok) throw new Error()
      const data = await res.json()
      entries = data.users ?? []
    } catch {
      error = 'Could not load leaderboard.'
    } finally {
      loading = false
    }
  })

  function rank(wins: number): string {
    if (wins >= 100) return 'Legend'
    if (wins >= 50) return 'Veteran'
    if (wins >= 20) return 'Challenger'
    if (wins >= 5) return 'Fighter'
    return 'Rookie'
  }

  const MEDAL: Record<number, { icon: string; color: string }> = {
    0: { icon: '🥇', color: '#fde047' },
    1: { icon: '🥈', color: '#d1d5db' },
    2: { icon: '🥉', color: '#d97706' },
  }
</script>

<main class="min-h-screen" style="background: #07070d; color: #e4e1ee;">

  <!-- Nav -->
  <nav class="fixed top-0 inset-x-0 z-50 flex items-center px-4 h-14"
    style="background: rgba(7,7,13,0.94); border-bottom: 1px solid rgba(240,192,64,0.2); backdrop-filter: blur(16px);"
  >
    <div class="flex items-center" style="min-width: 80px;">
      <a href="/" class="flex items-center gap-1 transition-all active:scale-95"
        style="color: #9a907b; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.08em; text-decoration: none; padding: 4px 6px; border-radius: 6px;">
        <span class="material-symbols-outlined" style="font-size: 15px;">home</span>
        <span>Menu</span>
      </a>
    </div>
    <div class="flex-1 flex items-center justify-center gap-2">
      <span class="material-symbols-outlined" style="color: #f0c040; font-size: 18px; font-variation-settings: 'FILL' 1;">workspace_premium</span>
      <span style="font-family: 'Cinzel', serif; font-size: 13px; font-weight: 700; color: #fde047; letter-spacing: 0.18em;">LEADERBOARD</span>
    </div>
    <div style="min-width: 80px;"></div>
  </nav>

  <div class="pt-20 pb-24 px-4 max-w-lg mx-auto">

    <!-- Header -->
    <div class="mb-6 text-center">
      <p class="text-xs tracking-[0.25em] uppercase mb-1" style="font-family: 'JetBrains Mono', monospace; color: #7c6fa0;">Rivals Rankings</p>
      <h1 style="font-family: 'Cinzel', serif; font-size: 1.8rem; font-weight: 700; color: #fde047; letter-spacing: 0.1em;">Hall of Champions</h1>
      <p class="mt-1 text-xs" style="font-family: 'JetBrains Mono', monospace; color: #4e4635;">Online rivals wins only</p>
    </div>

    <!-- My rank highlight -->
    {#if auth.loggedIn && auth.user && !loading && entries.length > 0}
      {@const myIdx = entries.findIndex(e => e.username === auth.user!.username)}
      {#if myIdx !== -1}
        <div class="mb-5 px-4 py-3 rounded-xl flex items-center gap-3" style="background: rgba(240,192,64,0.08); border: 1px solid rgba(240,192,64,0.3);">
          <span style="font-family: 'JetBrains Mono', monospace; font-size: 1.1rem; font-weight: 900; color: #f0c040;">#{myIdx + 1}</span>
          <div class="flex-1">
            <p class="text-xs" style="font-family: 'JetBrains Mono', monospace; color: #7c6fa0;">Your rank</p>
          </div>
          <span class="flex items-center gap-1 text-sm font-bold" style="color: #f0c040; font-family: 'JetBrains Mono', monospace;">
            <span class="material-symbols-outlined" style="font-size: 14px; font-variation-settings: 'FILL' 1;">workspace_premium</span>
            {auth.user.rivalsWins}W
          </span>
        </div>
      {:else if auth.user.rivalsWins === 0}
        <div class="mb-5 px-4 py-3 rounded-xl text-center" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06);">
          <p class="text-xs" style="font-family: 'JetBrains Mono', monospace; color: #4e4635;">Win your first rivals match to appear here!</p>
        </div>
      {/if}
    {/if}

    <!-- Loading -->
    {#if loading}
      <div class="flex flex-col gap-3">
        {#each [1,2,3,4,5] as _}
          <div class="animate-pulse rounded-xl h-14" style="background: rgba(255,255,255,0.04);"></div>
        {/each}
      </div>

    {:else if error}
      <p class="text-center text-sm py-10" style="color: #f87171;">{error}</p>

    {:else if entries.length === 0}
      <div class="text-center py-16 flex flex-col items-center gap-4">
        <span class="material-symbols-outlined text-5xl" style="color: #4e4635; font-variation-settings: 'FILL' 1;">leaderboard</span>
        <p style="font-family: 'Cinzel', serif; color: #9a907b;">No entries yet.</p>
        <p class="text-xs" style="color: #4e4635;">Win rivals matches to appear on the leaderboard.</p>
        <a href="/rivals" class="mt-2 px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest"
          style="font-family: 'Cinzel', serif; color: #f9a8d4; background: rgba(249,168,212,0.08); border: 1px solid rgba(249,168,212,0.25); text-decoration: none;">
          Play Rivals
        </a>
      </div>

    {:else}
      <div class="flex flex-col gap-2">
        {#each entries as entry, i}
          {@const medal = MEDAL[i]}
          {@const isMe = auth.user?.username === entry.username}
          {@const winRate = entry.gamesPlayed > 0 ? Math.round((entry.rivalsWins / entry.gamesPlayed) * 100) : 0}
          <div
            class="flex items-center gap-3 rounded-xl px-4 py-3 transition-all"
            style="background: {isMe ? 'rgba(240,192,64,0.06)' : 'linear-gradient(180deg, #161520 0%, #0c0b14 100%)'}; border: 1px solid {isMe ? 'rgba(240,192,64,0.3)' : 'rgba(167,139,250,0.1)'};"
          >
            <!-- Rank badge -->
            <div class="shrink-0 w-8 flex items-center justify-center">
              {#if medal}
                <span style="font-size: 1.2rem;">{medal.icon}</span>
              {:else}
                <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: #4e4635; font-weight: 700;">#{i + 1}</span>
              {/if}
            </div>

            <!-- Avatar -->
            <div class="shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm"
              style="background: rgba(167,139,250,0.12); color: #c4b5fd; font-family: 'Cinzel', serif;">
              {entry.username[0].toUpperCase()}
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <p class="font-semibold truncate" style="font-family: 'Cinzel', serif; color: {isMe ? '#fde047' : '#e4e1ee'}; font-size: 0.9rem;">{entry.username}</p>
                {#if isMe}
                  <span class="text-xs px-1.5 py-0.5 rounded" style="background: rgba(240,192,64,0.12); color: #f0c040; font-family: 'JetBrains Mono', monospace; font-size: 9px;">YOU</span>
                {/if}
              </div>
              <p class="text-xs mt-0.5" style="font-family: 'JetBrains Mono', monospace; color: #6b7280;">
                {rank(entry.rivalsWins)} · {winRate}% WR · {entry.gamesPlayed} games
              </p>
            </div>

            <!-- Wins -->
            <div class="shrink-0 flex items-center gap-1" style="color: #f0c040;">
              <span class="material-symbols-outlined" style="font-size: 14px; font-variation-settings: 'FILL' 1;">workspace_premium</span>
              <span class="font-black" style="font-family: 'JetBrains Mono', monospace; font-size: 1rem;">{entry.rivalsWins}</span>
              <span class="text-xs" style="color: #4e4635; font-family: 'JetBrains Mono', monospace;">W</span>
            </div>
          </div>
        {/each}
      </div>
    {/if}

  </div>
</main>
