<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { auth } from '$lib/stores/auth.svelte'

  let characters = $state<any[]>([])
  let loading = $state(true)

  onMount(async () => {
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

<main class="min-h-screen pt-16 pb-24 px-4" style="background: #09090f;">
  <div class="max-w-2xl mx-auto">

    {#if loading || auth.loading}
      <div class="flex items-center justify-center py-24">
        <p class="text-sm tracking-widest uppercase" style="color: #4e4635; font-family: 'JetBrains Mono', monospace;">Loading…</p>
      </div>
    {:else if auth.user}
      <!-- Avatar + Name -->
      <div class="flex items-center gap-4 mb-8">
        <div class="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black"
          style="background: #1e1e2e; border: 2px solid rgba(240,192,64,0.3); color: #f0c040; font-family: 'Cinzel', serif;">
          {auth.user.username[0].toUpperCase()}
        </div>
        <div>
          <h1 style="font-family: 'Cinzel', serif; font-size: 1.5rem; font-weight: 700; color: #ffdf96;">
            {auth.user.username}
          </h1>
          {#if auth.user.email}
            <p class="text-xs mt-0.5" style="color: #4e4635; font-family: 'JetBrains Mono', monospace;">{auth.user.email}</p>
          {/if}
        </div>
        <button
          onclick={async () => { await auth.logout(); goto('/') }}
          class="ml-auto text-xs px-3 py-1.5 rounded-lg"
          style="background: #1a1a28; border: 1px solid rgba(255,255,255,0.08); color: #9a907b; font-family: 'JetBrains Mono', monospace;"
        >Sign out</button>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-3 gap-3 mb-8">
        {#each [['Rivals Wins', auth.user.rivalsWins, '#22c55e'], ['Rivals Losses', auth.user.rivalsLosses, '#ef4444'], ['Games Played', auth.user.gamesPlayed, '#f0c040']] as [label, val, color]}
          <div class="rounded-xl p-4 text-center" style="background: #0f0e1a; border: 1px solid rgba(240,192,64,0.1);">
            <div class="text-2xl font-black mb-1" style="color: {color}; font-family: 'Cinzel', serif;">{val}</div>
            <div class="text-[10px] tracking-widest uppercase" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">{label}</div>
          </div>
        {/each}
      </div>

      <!-- Characters -->
      <div>
        <h2 class="text-xs tracking-[0.2em] uppercase mb-4" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Your Characters</h2>
        {#if characters.length === 0}
          <p class="text-sm text-center py-8" style="color: #4e4635; font-style: italic;">No saved characters yet — finish a spin session to save one.</p>
        {/if}
        <div class="flex flex-col gap-3">
          {#each characters as c}
            {@const tc = TIER_COLORS[c.overall_tier] ?? '#9a907b'}
            <a href="/character/{c.shareId}"
              class="flex items-center gap-4 px-4 py-3 rounded-xl transition-colors hover:opacity-90"
              style="background: #0f0e1a; border: 1px solid {tc}22; text-decoration: none;">
              <div class="shrink-0 px-2 py-1 rounded text-xs font-black" style="background: {tc}22; border: 1px solid {tc}55; color: {tc}; min-width: 2.5rem; text-align: center; font-family: 'JetBrains Mono', monospace;">
                {c.overall_tier}
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
    {/if}

  </div>
</main>
