<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { auth } from '$lib/stores/auth.svelte'

  // Canonical tier palette — mirrors gallery / characters / profile / app.css.
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

  type ProfileData = {
    user: {
      username: string
      rivalsWins: number
      rivalsLosses: number
      gamesPlayed: number
      createdAt: string
    }
    characters: Array<{
      shareId: string
      name: string
      race: string
      archetype: string
      overall_score: number
      overall_tier: string
      created_at: string
    }>
  }

  let data    = $state<ProfileData | null>(null)
  let loading = $state(true)
  let error   = $state<string | null>(null)
  let username = $derived($page.params.username ?? '')

  onMount(async () => {
    try {
      const res = await fetch(`/api/users/${username}/profile`)
      if (!res.ok) { error = 'User not found'; return }
      data = await res.json()
    } catch {
      error = 'Could not load profile.'
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

  function timeAgo(iso: string) {
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
    if (d === 0) return 'today'
    if (d === 1) return 'yesterday'
    return `${d}d ago`
  }
</script>

<main class="min-h-screen" style="background: transparent; color: #e9dfeb;">

  <nav class="fixed top-0 inset-x-0 z-50 flex items-center px-4 h-14"
    style="background: rgba(22,18,26,0.92); border-bottom: 1px solid rgba(167,139,250,0.18); backdrop-filter: blur(16px);"
  >
    <div class="flex items-center" style="min-width: 80px;">
      <a href="/friends" class="flex items-center gap-1 transition-all active:scale-95"
        style="color: #9a907b; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.08em; text-decoration: none; padding: 4px 6px; border-radius: 6px;">
        <span class="material-symbols-outlined" style="font-size: 15px;">arrow_back</span>
        <span>Back</span>
      </a>
    </div>
    <div class="flex-1 flex items-center justify-center gap-2">
      <span class="material-symbols-outlined" style="color: #a78bfa; font-size: 18px; font-variation-settings: 'FILL' 1;">account_circle</span>
      <span style="font-family: 'Cinzel', serif; font-size: 13px; font-weight: 700; color: #c4b5fd; letter-spacing: 0.18em;">{username.toUpperCase()}</span>
    </div>
    <div style="min-width: 80px;"></div>
  </nav>

  <div class="pt-20 pb-24 px-4 max-w-lg mx-auto">

    {#if loading}
      <div class="flex justify-center py-20">
        <span class="material-symbols-outlined animate-spin" style="color: #a78bfa; font-size: 32px;">progress_activity</span>
      </div>
    {:else if error || !data}
      <div class="text-center py-16">
        <p class="text-sm" style="color: #f87171;">{error ?? 'User not found.'}</p>
      </div>
    {:else}
      <!-- Profile header -->
      <div class="flex flex-col items-center gap-3 mb-8">
        <div class="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black"
          style="background: linear-gradient(135deg, rgba(167,139,250,0.2), rgba(167,139,250,0.08)); border: 2px solid rgba(167,139,250,0.3); font-family: 'Cinzel', serif; color: #c4b5fd;">
          {data.user.username[0].toUpperCase()}
        </div>
        <div class="text-center">
          <h1 style="font-family: 'Cinzel', serif; font-size: 1.4rem; font-weight: 700; color: #e9dfeb;">{data.user.username}</h1>
          <p class="text-xs mt-0.5" style="font-family: 'JetBrains Mono', monospace; color: #7c6fa0;">{rank(data.user.rivalsWins)}</p>
        </div>
      </div>

      <!-- Stats row -->
      <div class="grid grid-cols-3 gap-3 mb-8">
        {#each [
          { label: 'Wins', value: data.user.rivalsWins, color: '#f0c040' },
          { label: 'Losses', value: data.user.rivalsLosses, color: '#f87171' },
          { label: 'Games', value: data.user.gamesPlayed, color: '#a78bfa' },
        ] as stat}
          <div class="obsidian-slab rounded-xl p-3 text-center">
            <p class="text-xl font-black" style="font-family: 'JetBrains Mono', monospace; color: {stat.color};">{stat.value}</p>
            <p class="text-xs mt-0.5" style="font-family: 'JetBrains Mono', monospace; color: #4e4635; letter-spacing: 0.08em;">{stat.label}</p>
          </div>
        {/each}
      </div>

      <!-- Characters -->
      <div>
        <p class="text-xs tracking-widest uppercase mb-3" style="font-family: 'JetBrains Mono', monospace; color: #7c6fa0;">Characters</p>
        {#if data.characters.length === 0}
          <p class="text-sm text-center py-8" style="color: #4e4635;">No characters yet.</p>
        {:else}
          <div class="flex flex-col gap-2">
            {#each data.characters as char}
              {@const tierColor = TIER_COLORS[char.overall_tier] ?? '#6b7280'}
              <a href="/character/{char.shareId}" class="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all hover:brightness-110"
                style="background: linear-gradient(180deg, #2d2831 0%, #1e1a22 100%); border: 1px solid rgba(167,139,250,0.1); text-decoration: none;">
                <div class="shrink-0 w-12 h-10 rounded-lg flex items-center justify-center"
                  style="background: {tierColor}18; border: 1px solid {tierColor}28;">
                  <span class="text-xs font-black" style="font-family: 'Cinzel', serif; color: {tierColor};">{char.overall_tier}</span>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold truncate" style="font-family: 'Cinzel', serif; color: #ffdf96;">{char.name}</p>
                  <p class="text-xs truncate" style="color: #6b7280;">{char.race} · {char.archetype}</p>
                </div>
                <div class="shrink-0 text-right">
                  <p class="text-sm font-black" style="font-family: 'JetBrains Mono', monospace; color: {tierColor};">{char.overall_score}</p>
                  <p class="text-xs" style="color: #4e4635; font-family: 'JetBrains Mono', monospace;">{timeAgo(char.created_at)}</p>
                </div>
              </a>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</main>
