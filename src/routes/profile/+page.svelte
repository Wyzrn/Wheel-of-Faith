<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { auth } from '$lib/stores/auth.svelte'
  import { loadSpinHistory } from '$lib/spinHistory'
  import type { SpinHistoryEntry } from '$lib/spinHistory'

  let characters = $state<any[]>([])
  let loading = $state(true)
  let spinHistory = $state<SpinHistoryEntry[]>([])

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
    loading = false
  })

  // Top 10 characters by score (strongest first)
  let topCharacters = $derived(
    [...characters].sort((a, b) => (b.overall_score ?? 0) - (a.overall_score ?? 0)).slice(0, 10)
  )

  // 10 most recent spin history entries
  let recentHistory = $derived(
    [...spinHistory].sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()).slice(0, 10)
  )

  // Stats derived from local history
  let totalSpins = $derived(spinHistory.reduce((s, e) => s + e.spinCount, 0))
  let bestTier = $derived(spinHistory.length
    ? spinHistory.reduce((best, e) => e.overallScore > best.overallScore ? e : best, spinHistory[0]).overallTier
    : null)
  function calcMostCommonRace(history: SpinHistoryEntry[]): string | null {
    if (!history.length) return null
    const counts: Record<string, number> = {}
    for (const e of history) counts[e.race] = (counts[e.race] ?? 0) + 1
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  }
  let mostCommonRace = $derived(calcMostCommonRace(spinHistory))

  const TIER_COLORS: Record<string, string> = {
    'F-':'#555','F':'#666','F+':'#777','E-':'#6b7280','E':'#9ca3af','E+':'#d1d5db',
    'D-':'#92400e','D':'#b45309','D+':'#d97706','C-':'#1d4ed8','C':'#2563eb','C+':'#3b82f6',
    'B-':'#15803d','B':'#16a34a','B+':'#22c55e','A-':'#7c3aed','A':'#8b5cf6','A+':'#a78bfa',
    'S-':'#b91c1c','S':'#dc2626','S+':'#ef4444','SS-':'#c2410c','SS':'#ea580c','SS+':'#f97316',
    'SSS-':'#a16207','SSS':'#ca8a04','SSS+':'#eab308','Z-':'#0e7490','Z':'#0891b2','Z+':'#06b6d4',
    'ZZ-':'#1d4ed8','ZZ':'#2563eb','ZZ+':'#60a5fa','ZZZ-':'#6d28d9','ZZZ':'#7c3aed','ZZZ+':'#a855f7',
    'Celestial-':'#be185d','Celestial':'#db2777','Celestial+':'#ec4899',
    'Godly-':'#9f1239','Godly':'#be123c','Primordial':'#f0c040',
  }
</script>

<main class="min-h-screen pt-16 pb-24 px-4" style="background: #07070d;">
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
        <button
          onclick={async () => { await auth.logout(); goto('/') }}
          class="ml-auto text-xs px-3 py-1.5 rounded-lg shrink-0"
          style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); color: #9a907b; font-family: 'JetBrains Mono', monospace; cursor: pointer;"
        >Sign out</button>
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
              style="background: linear-gradient(180deg, #161520 0%, #0c0b14 100%); border: 1px solid {tc}22; box-shadow: inset 1px 1px 0 rgba(255,223,150,0.04); text-decoration: none;">
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

          <!-- Lifetime summary chips -->
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
          </div>

          <!-- History list -->
          <div class="flex flex-col gap-2">
            {#each recentHistory as entry}
              {@const tc = TIER_COLORS[entry.overallTier] ?? '#9a907b'}
              <div
                class="flex items-center gap-3 px-4 py-3 rounded-xl"
                style="background: linear-gradient(180deg, #161520 0%, #0c0b14 100%); border: 1px solid rgba(255,223,150,0.06); box-shadow: inset 1px 1px 0 rgba(255,223,150,0.03);"
              >
                <!-- Tier badge -->
                <div class="shrink-0 px-2 py-1 rounded text-[11px] font-black" style="background: {tc}18; border: 1px solid {tc}44; color: {tc}; min-width: 2.5rem; text-align: center; font-family: 'JetBrains Mono', monospace;">
                  {entry.overallTier}
                </div>

                <!-- Name + race/archetype -->
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold truncate" style="color: #e4e1ee; font-family: 'Cinzel', serif;">{entry.name}</p>
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
