<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'

  type CharInfo = {
    id: string
    name: string
    race: string
    title: string
    tier: string
    score: number
    rivalsWins: number
    inGallery: boolean
    error: boolean
  }

  let chars    = $state<CharInfo[]>([])
  let loading  = $state(true)
  let sortDir  = $state<'desc' | 'asc'>('desc')
  // Battle selection — click once for Team 1, twice for Team 2, thrice to deselect
  let teamMap = $state<Map<string, 1 | 2>>(new Map())

  function toggleSelect(id: string) {
    const next = new Map(teamMap)
    const cur  = next.get(id)
    if (cur === undefined)   next.set(id, 1)
    else if (cur === 1)      next.set(id, 2)
    else                     next.delete(id)
    teamMap = next
  }

  let team1Ids   = $derived([...teamMap.entries()].filter(([, t]) => t === 1).map(([id]) => id))
  let team2Ids   = $derived([...teamMap.entries()].filter(([, t]) => t === 2).map(([id]) => id))
  let canBattle  = $derived(team1Ids.length >= 1 && team2Ids.length >= 1)
  let sortedChars = $derived([...chars].sort((a, b) =>
    sortDir === 'desc' ? b.score - a.score : a.score - b.score
  ))

  function startBattle() {
    if (!canBattle) return
    goto(`/battle?t1=${team1Ids.join(',')}&t2=${team2Ids.join(',')}`)
  }

  onMount(async () => {
    let ids: string[]
    try {
      ids = JSON.parse(localStorage.getItem('wof_saved_chars') ?? '[]')
    } catch {
      ids = []
    }

    if (ids.length === 0) {
      loading = false
      return
    }

    const settled = await Promise.allSettled(
      ids.map(id => fetch(`/api/characters/${id}`).then(r => r.ok ? r.json() : Promise.reject()))
    )

    chars = ids.map((id, i) => {
      const r = settled[i]
      if (r.status === 'fulfilled') {
        const d = r.value
        const titleSpin = (d.spins ?? []).find((s: { category: string }) => s.category === 'title')
        return {
          id,
          name: d.name ?? '—',
          race: d.race ?? '—',
          title: titleSpin?.resultLabel ?? '',
          tier: d.overall_tier ?? '',
          score: d.overall_score ?? 0,
          rivalsWins: d.rivals_wins ?? 0,
          inGallery: d.share_in_gallery ?? false,
          error: false,
        }
      }
      return { id, name: '—', race: '—', title: '', tier: '', score: 0, rivalsWins: 0, inGallery: false, error: true }
    })

    loading = false
  })

  async function toggleGallery(id: string) {
    const char = chars.find(c => c.id === id)
    if (!char || char.error) return
    const next = !char.inGallery
    // Optimistic update
    chars = chars.map(c => c.id === id ? { ...c, inGallery: next } : c)
    try {
      const res = await fetch(`/api/characters/${id}/gallery`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ share_in_gallery: next }),
      })
      if (!res.ok) throw new Error()
    } catch {
      // Revert on failure
      chars = chars.map(c => c.id === id ? { ...c, inGallery: !next } : c)
    }
  }

  function deleteChar(id: string) {
    chars = chars.filter(c => c.id !== id)
    teamMap.delete(id)
    teamMap = new Map(teamMap)
    try {
      const existing: string[] = JSON.parse(localStorage.getItem('wof_saved_chars') ?? '[]')
      localStorage.setItem('wof_saved_chars', JSON.stringify(existing.filter(i => i !== id)))
    } catch {}
  }

  const TIER_COLORS: Record<string, string> = {
    'F-':'#555','F':'#666','F+':'#777',
    'E-':'#6b7280','E':'#9ca3af','E+':'#d1d5db',
    'D-':'#92400e','D':'#b45309','D+':'#d97706',
    'C-':'#1d4ed8','C':'#2563eb','C+':'#3b82f6',
    'B-':'#065f46','B':'#059669','B+':'#34d399',
    'A-':'#7c3aed','A':'#8b5cf6','A+':'#a78bfa',
    'S-':'#b91c1c','S':'#dc2626','S+':'#ef4444',
    'SS-':'#ea580c','SS':'#f97316','SS+':'#fb923c',
    'SSS-':'#ca8a04','SSS':'#eab308','SSS+':'#fde047',
    'Z-':'#0e7490','Z':'#0891b2','Z+':'#06b6d4',
    'ZZ-':'#3730a3','ZZ':'#4f46e5','ZZ+':'#818cf8',
    'ZZZ-':'#9d174d','ZZZ':'#be185d','ZZZ+':'#ec4899',
    'Celestial-':'#075985','Celestial':'#0284c7','Celestial+':'#38bdf8',
    'Godly-':'#c026d3','Godly':'#e879f9',
    'Primordial':'#ffffff',
  }
</script>

<main class="min-h-screen" style="background: #07070d; color: #e4e1ee;">

  <!-- Nav -->
  <nav class="fixed top-0 inset-x-0 z-50 flex items-center px-4 h-14"
    style="background: rgba(7,7,13,0.94); border-bottom: 1px solid rgba(240,192,64,0.13); backdrop-filter: blur(16px);"
  >
    <div class="flex items-center" style="min-width: 80px;">
      <a href="/" class="flex items-center gap-1 transition-all active:scale-95"
        style="color: #9a907b; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.08em; text-decoration: none; padding: 4px 6px; border-radius: 6px;">
        <span class="material-symbols-outlined" style="font-size: 15px;">home</span>
        <span>Menu</span>
      </a>
    </div>
    <div class="flex-1 flex items-center justify-center gap-2">
      <span class="material-symbols-outlined" style="color: #f0c040; font-size: 18px; font-variation-settings: 'FILL' 1;">casino</span>
      <span style="font-family: 'Cinzel', serif; font-size: 13px; font-weight: 700; color: #ffdf96; letter-spacing: 0.18em;">WHEEL OF FATE</span>
    </div>
    <div style="min-width: 80px;"></div>
  </nav>

  <div class="pt-20 pb-24 px-4 max-w-lg mx-auto">

    <!-- Header -->
    <div class="mb-6 text-center">
      <p class="text-xs tracking-[0.25em] uppercase mb-2" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Your Fates</p>
      <h1 style="font-family: 'Cinzel', serif; font-size: 1.8rem; font-weight: 700; color: #ffdf96; letter-spacing: 0.1em;">Saved Characters</h1>
      {#if !loading && chars.length >= 2}
        <p class="mt-2 text-xs" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">
          Tap ⚔ to assign teams — once for Team 1, twice for Team 2.
        </p>
      {/if}
    </div>

    <!-- Sort controls -->
    {#if !loading && chars.length >= 2}
      <div class="flex items-center justify-end mb-4 gap-2">
        <span class="text-xs" style="font-family: 'JetBrains Mono', monospace; color: #4e4635;">Sort:</span>
        <button
          onclick={() => sortDir = 'desc'}
          class="px-3 py-1.5 rounded text-xs font-bold tracking-[0.1em] uppercase transition-all active:scale-95"
          style="font-family: 'Cinzel', serif; background: {sortDir === 'desc' ? 'rgba(240,192,64,0.12)' : 'rgba(255,255,255,0.03)'}; border: 1px solid {sortDir === 'desc' ? 'rgba(240,192,64,0.4)' : 'rgba(255,255,255,0.08)'}; color: {sortDir === 'desc' ? '#f0c040' : '#6b7280'};"
        >Strongest</button>
        <button
          onclick={() => sortDir = 'asc'}
          class="px-3 py-1.5 rounded text-xs font-bold tracking-[0.1em] uppercase transition-all active:scale-95"
          style="font-family: 'Cinzel', serif; background: {sortDir === 'asc' ? 'rgba(240,192,64,0.12)' : 'rgba(255,255,255,0.03)'}; border: 1px solid {sortDir === 'asc' ? 'rgba(240,192,64,0.4)' : 'rgba(255,255,255,0.08)'}; color: {sortDir === 'asc' ? '#f0c040' : '#6b7280'};"
        >Weakest</button>
      </div>
    {/if}

    {#if loading}
      <div class="flex flex-col gap-3">
        {#each [1, 2, 3] as _}
          <div class="obsidian-slab rounded-lg px-4 py-4 animate-pulse" style="border: 1px solid rgba(240,192,64,0.08); height: 72px;"></div>
        {/each}
      </div>

    {:else if chars.length === 0}
      <div class="text-center py-16 flex flex-col items-center gap-4">
        <span class="material-symbols-outlined text-5xl" style="color: #4e4635; font-variation-settings: 'FILL' 1;">casino</span>
        <p class="text-sm" style="color: #9a907b;">No characters saved yet.</p>
        <p class="text-xs" style="color: #4e4635;">Complete a spin session and hit Save & Share to preserve your fate.</p>
        <a
          href="/"
          class="metal-stamp-gold mt-4 px-8 py-3 rounded-lg relative"
          style="font-family: 'Cinzel', serif; font-size: 0.85rem; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; text-decoration: none; display: inline-flex; align-items: center; justify-content: center;"
        >
          <div class="l-bracket" style="color: rgba(255,255,255,0.25);"></div>
          Spin Your Fate
        </a>
      </div>

    {:else}
      <div class="flex flex-col gap-3">
        {#each sortedChars as char, i}
          {@const charTeam = teamMap.get(char.id)}
          {@const isT1 = charTeam === 1}
          {@const isT2 = charTeam === 2}
          {@const isSelected = charTeam !== undefined}
          {@const borderColor = isT1 ? 'rgba(240,192,64,0.65)' : isT2 ? 'rgba(232,121,249,0.65)' : char.error ? 'rgba(240,192,64,0.06)' : 'rgba(240,192,64,0.18)'}
          {@const glowColor   = isT1 ? 'rgba(240,192,64,0.14)' : isT2 ? 'rgba(232,121,249,0.14)' : 'none'}
          <div class="flex items-center gap-0 rounded-lg overflow-hidden"
            style="background: linear-gradient(180deg, #161520 0%, #0c0b14 100%); border: 1px solid {borderColor}; box-shadow: {isSelected ? `0 0 20px ${glowColor}, inset 1px 1px 0 rgba(255,223,150,0.07)` : 'inset 1px 1px 0 rgba(255,223,150,0.05)'}; transition: border-color 0.2s, box-shadow 0.2s;"
          >
            <!-- Battle select button: cycles unselected → T1 → T2 → unselected -->
            <button
              onclick={() => toggleSelect(char.id)}
              disabled={char.error}
              class="shrink-0 px-3 flex items-center justify-center self-stretch transition-all"
              style="background: {isT1 ? 'rgba(240,192,64,0.10)' : isT2 ? 'rgba(232,121,249,0.10)' : 'rgba(255,255,255,0.03)'}; border: none; border-right: 1px solid {isT1 ? 'rgba(240,192,64,0.28)' : isT2 ? 'rgba(232,121,249,0.28)' : 'rgba(255,255,255,0.06)'}; cursor: {char.error ? 'not-allowed' : 'pointer'}; opacity: {char.error ? 0.3 : 1}; min-width: 40px;"
              aria-label="Assign team"
            >
              {#if isT1}
                <span class="text-xs font-black" style="font-family: 'Cinzel', serif; color: #f0c040; letter-spacing: 0.05em;">T1</span>
              {:else if isT2}
                <span class="text-xs font-black" style="font-family: 'Cinzel', serif; color: #e879f9; letter-spacing: 0.05em;">T2</span>
              {:else}
                <span class="material-symbols-outlined" style="font-size: 16px; color: #4e4635;">swords</span>
              {/if}
            </button>

            <!-- Clickable character info area -->
            <a
              href="/character/{char.id}"
              class="flex items-center gap-3 flex-1 min-w-0 px-4 py-4 transition-all hover:opacity-90 active:scale-[0.99]"
              style="text-decoration: none;"
            >
              <!-- Tier badge -->
              <div class="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                style="background: {char.tier ? TIER_COLORS[char.tier] + '18' : '#1b1b24'}; border: 1px solid {char.tier ? TIER_COLORS[char.tier] + '44' : '#4e4635'};">
                {#if char.tier}
                  <span class="text-xs font-black" style="color: {TIER_COLORS[char.tier] ?? '#9a907b'}; font-family: 'Cinzel', serif;">{char.tier}</span>
                {:else}
                  <span class="material-symbols-outlined" style="color: #4e4635; font-size: 18px; font-variation-settings: 'FILL' 1;">person_play</span>
                {/if}
              </div>

              <!-- Character info -->
              <div class="flex-1 min-w-0">
                {#if char.error}
                  <p class="text-xs" style="font-family: 'JetBrains Mono', monospace; color: #6b7280;">Character {chars.length - i}</p>
                  <p class="text-xs truncate mt-0.5" style="font-family: 'JetBrains Mono', monospace; color: #4e4635;">{char.id}</p>
                {:else}
                  {#if char.title}
                    <p class="text-xs truncate mb-0.5" style="font-family: 'JetBrains Mono', monospace; color: #a78bfa; letter-spacing: 0.08em;">{char.title}</p>
                  {/if}
                  <div class="flex items-center gap-2 min-w-0">
                    <p class="text-sm font-semibold truncate" style="font-family: 'Cinzel', serif; color: #ffdf96;">{char.name}</p>
                    {#if char.rivalsWins > 0}
                      <span class="shrink-0 flex items-center gap-0.5 text-xs" style="color: #f0c040;">
                        <span class="material-symbols-outlined" style="font-size: 13px; font-variation-settings: 'FILL' 1;">workspace_premium</span>
                        {char.rivalsWins}
                      </span>
                    {/if}
                  </div>
                  <p class="text-xs truncate mt-0.5" style="color: #9a907b;">{char.race}</p>
                {/if}
              </div>

              <span class="material-symbols-outlined shrink-0" style="color: #4e4635; font-size: 16px;">arrow_forward</span>
            </a>

            <!-- Gallery toggle button -->
            <button
              onclick={() => toggleGallery(char.id)}
              disabled={char.error}
              class="shrink-0 px-3 py-4 h-full transition-all hover:opacity-80 active:scale-95"
              style="background: {char.inGallery ? 'rgba(167,139,250,0.08)' : 'none'}; border: none; border-left: 1px solid {char.inGallery ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.06)'}; cursor: {char.error ? 'not-allowed' : 'pointer'}; opacity: {char.error ? 0.3 : 1};"
              title={char.inGallery ? 'Remove from public gallery' : 'Share in public gallery'}
              aria-label={char.inGallery ? 'Remove from gallery' : 'Add to gallery'}
            >
              <span class="material-symbols-outlined" style="font-size: 16px; color: {char.inGallery ? '#a78bfa' : '#4e4635'}; font-variation-settings: 'FILL' {char.inGallery ? '1' : '0'}; transition: color 0.15s;">
                {char.inGallery ? 'public' : 'public_off'}
              </span>
            </button>

            <!-- Delete button -->
            <button
              onclick={() => deleteChar(char.id)}
              class="shrink-0 px-3 py-4 h-full rounded-r-lg transition-all hover:opacity-80 active:scale-95"
              style="background: none; border: none; border-left: 1px solid rgba(248,113,113,0.1); cursor: pointer;"
              aria-label="Remove character"
            >
              <span class="material-symbols-outlined" style="font-size: 16px; color: #4e4635; transition: color 0.15s;"
                onmouseenter={(e) => (e.currentTarget as HTMLElement).style.color = '#f87171'}
                onmouseleave={(e) => (e.currentTarget as HTMLElement).style.color = '#4e4635'}
              >delete</span>
            </button>
          </div>
        {/each}
      </div>

      <p class="mt-6 text-center text-xs" style="font-family: 'JetBrains Mono', monospace; color: #4e4635;">
        {chars.length} fate{chars.length === 1 ? '' : 's'} recorded on this device
      </p>
    {/if}

  </div>

  <!-- Sticky battle bar (shown when at least 1 char per team) -->
  {#if canBattle}
    {@const t1Names = team1Ids.map(id => chars.find(c => c.id === id)?.name ?? '?')}
    {@const t2Names = team2Ids.map(id => chars.find(c => c.id === id)?.name ?? '?')}
    {@const matchupLabel = `${team1Ids.length}v${team2Ids.length}`}
    <div class="fixed inset-x-0 z-40 flex items-center justify-between gap-4 px-4 py-4"
      style="bottom: 64px; background: rgba(7,7,13,0.96); border-top: 1px solid rgba(157,23,77,0.4); backdrop-filter: blur(16px); animation: slideUp 0.25s ease-out forwards;">
      <div class="flex-1 min-w-0">
        <p class="text-xs tracking-[0.15em] uppercase" style="font-family: 'JetBrains Mono', monospace; color: #f9a8d4;">⚔ {matchupLabel} Battle</p>
        <p class="text-xs truncate mt-0.5" style="color: #9a907b;">
          <span style="color: #f0c040;">{t1Names.join(', ')}</span>
          <span style="color: #4e4635;"> vs </span>
          <span style="color: #e879f9;">{t2Names.join(', ')}</span>
        </p>
      </div>
      <div class="flex gap-2 shrink-0">
        <button
          onclick={() => { teamMap = new Map() }}
          class="obsidian-slab px-4 py-2.5 rounded-lg text-xs tracking-[0.12em] uppercase font-bold transition-all active:scale-95"
          style="font-family: 'Cinzel', serif; color: #9a907b; border: 1px solid #4e4635;"
        >Clear</button>
        <button
          onclick={startBattle}
          class="metal-stamp-crimson px-6 py-2.5 rounded-lg relative"
          style="font-family: 'Cinzel', serif; font-size: 0.85rem; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 700; color: #ffdad6;"
        >
          <div class="l-bracket" style="color: rgba(255,180,171,0.35);"></div>
          ⚔ Battle!
        </button>
      </div>
    </div>
  {/if}

</main>
