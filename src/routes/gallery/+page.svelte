<script lang="ts">
  import { onMount } from 'svelte'

  type GalleryChar = {
    shareId: string
    name: string
    race: string
    archetype: string
    overall_tier: string
    overall_score: number
    rivals_wins: number
    created_at: string
    spins: Array<{ category: string; resultLabel: string }>
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

  type SortField = 'score' | 'rivals' | 'date' | 'name' | 'race' | 'archetype'

  const SORT_OPTIONS: { value: SortField; label: string; descLabel: string; ascLabel: string }[] = [
    { value: 'score',     label: 'Score',      descLabel: 'Highest first', ascLabel: 'Lowest first'  },
    { value: 'rivals',    label: 'Rivals Wins', descLabel: 'Most first',   ascLabel: 'Fewest first'  },
    { value: 'date',      label: 'Date Added',  descLabel: 'Newest first', ascLabel: 'Oldest first'  },
    { value: 'name',      label: 'Name',        descLabel: 'Z → A',        ascLabel: 'A → Z'         },
    { value: 'race',      label: 'Race',        descLabel: 'Z → A',        ascLabel: 'A → Z'         },
    { value: 'archetype', label: 'Archetype',   descLabel: 'Z → A',        ascLabel: 'A → Z'         },
  ]

  let chars       = $state<GalleryChar[]>([])
  let loading     = $state(true)
  let loadingMore = $state(false)
  let sortBy      = $state<SortField>('score')
  let sortDir     = $state<'desc' | 'asc'>('desc')
  let searchInput = $state('')
  let searchQuery = $state('')   // debounced value sent to API
  let page        = $state(0)
  let hasMore     = $state(false)
  let total       = $state(0)
  let error       = $state<string | null>(null)

  const LIMIT = 20

  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  function onSearchInput(e: Event) {
    searchInput = (e.currentTarget as HTMLInputElement).value
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      searchQuery = searchInput
      fetchChars(sortBy, sortDir, searchInput.trim(), 0, false)
    }, 380)
  }

  function clearSearch() {
    searchInput = ''
    searchQuery = ''
    if (debounceTimer) clearTimeout(debounceTimer)
    fetchChars(sortBy, sortDir, '', 0, false)
  }

  async function fetchChars(
    field: SortField,
    dir: 'desc' | 'asc',
    q: string,
    newPage: number,
    append: boolean,
  ) {
    if (!append) loading = true
    else loadingMore = true
    error = null

    try {
      const params = new URLSearchParams({
        sortBy: field,
        sort: dir,
        page: String(newPage),
        limit: String(LIMIT),
        ...(q ? { search: q } : {}),
      })
      const res = await fetch(`/api/characters?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json() as {
        characters: GalleryChar[]
        total: number
        hasMore: boolean
      }
      chars   = append ? [...chars, ...data.characters] : data.characters
      total   = data.total
      hasMore = data.hasMore
      page    = newPage
    } catch {
      error = 'Could not load the gallery. Make sure the server is running.'
    } finally {
      loading = false
      loadingMore = false
    }
  }

  function changeSort(field: SortField) {
    if (field === sortBy) {
      // Toggle direction
      sortDir = sortDir === 'desc' ? 'asc' : 'desc'
    } else {
      sortBy = field
      sortDir = 'desc'
    }
    fetchChars(sortBy, sortDir, searchQuery, 0, false)
  }

  function loadMore() {
    fetchChars(sortBy, sortDir, searchQuery, page + 1, true)
  }

  onMount(() => fetchChars('score', 'desc', '', 0, false))

  function getTitle(c: GalleryChar) {
    return c.spins?.find(s => s.category === 'title')?.resultLabel ?? ''
  }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1)   return 'just now'
    if (m < 60)  return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24)  return `${h}h ago`
    const d = Math.floor(h / 24)
    return `${d}d ago`
  }

  let activeSortOption = $derived(SORT_OPTIONS.find(o => o.value === sortBy)!)

  // ── Challenge flow ────────────────────────────────────────────────────────
  type MyChar = { shareId: string; name: string; race: string; overall_tier: string; overall_score: number }

  let challengeTarget  = $state<GalleryChar | null>(null)
  let myChars          = $state<MyChar[]>([])
  let myCharsLoading   = $state(false)

  async function openChallenge(char: GalleryChar) {
    challengeTarget = char
    myCharsLoading  = true
    myChars         = []

    const ids: string[] = JSON.parse(localStorage.getItem('wof_saved_chars') ?? '[]')
    if (ids.length === 0) { myCharsLoading = false; return }

    const results = await Promise.all(
      ids.map(id =>
        fetch(`/api/characters/${id}`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      )
    )
    myChars = results.filter(Boolean) as MyChar[]
    myCharsLoading = false
  }

  function closeChallenge() {
    challengeTarget = null
    myChars = []
  }

  function startBattle(myId: string) {
    if (!challengeTarget) return
    window.location.href = `/battle?t1=${myId}&t2=${challengeTarget.shareId}`
  }
</script>

<main class="min-h-screen" style="background: #07070d; color: #e4e1ee;">

  <!-- Nav -->
  <nav class="fixed top-0 inset-x-0 z-50 flex items-center px-4 h-14"
    style="background: rgba(7,7,13,0.94); border-bottom: 1px solid rgba(167,139,250,0.18); backdrop-filter: blur(16px);"
  >
    <div class="flex items-center" style="min-width: 80px;">
      <a href="/" class="flex items-center gap-1 transition-all active:scale-95"
        style="color: #9a907b; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.08em; text-decoration: none; padding: 4px 6px; border-radius: 6px;">
        <span class="material-symbols-outlined" style="font-size: 15px;">home</span>
        <span>Menu</span>
      </a>
    </div>
    <div class="flex-1 flex items-center justify-center gap-2">
      <span class="material-symbols-outlined" style="color: #a78bfa; font-size: 18px; font-variation-settings: 'FILL' 1;">auto_awesome</span>
      <span style="font-family: 'Cinzel', serif; font-size: 13px; font-weight: 700; color: #c4b5fd; letter-spacing: 0.18em;">PUBLIC GALLERY</span>
    </div>
    <div style="min-width: 80px;"></div>
  </nav>

  <div class="pt-20 pb-24 px-4 max-w-lg mx-auto">

    <!-- Header -->
    <div class="mb-5 text-center">
      <p class="text-xs tracking-[0.25em] uppercase mb-2" style="font-family: 'JetBrains Mono', monospace; color: #7c6fa0;">Shared Fates</p>
      <h1 style="font-family: 'Cinzel', serif; font-size: 1.8rem; font-weight: 700; color: #c4b5fd; letter-spacing: 0.1em;">Hall of Fates</h1>
      {#if !loading && !error}
        <p class="mt-1 text-xs" style="font-family: 'JetBrains Mono', monospace; color: #4e4635;">
          {total} fate{total === 1 ? '' : 's'} in the hall
        </p>
      {/if}
    </div>

    <!-- Search bar -->
    <div class="relative mb-4">
      <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
        style="font-size: 16px; color: #4e4635;">search</span>
      <input
        type="text"
        placeholder="Search by name, race, or archetype…"
        value={searchInput}
        oninput={onSearchInput}
        class="w-full rounded-lg pl-9 pr-9 py-2.5 text-sm outline-none transition-all"
        style="background: rgba(255,255,255,0.04); border: 1px solid rgba(167,139,250,0.18); color: #e4e1ee; font-family: 'JetBrains Mono', monospace; font-size: 12px; letter-spacing: 0.02em;"
        style:border-color={searchInput ? 'rgba(167,139,250,0.45)' : 'rgba(167,139,250,0.18)'}
      />
      {#if searchInput}
        <button
          onclick={clearSearch}
          class="absolute right-3 top-1/2 -translate-y-1/2 transition-all hover:opacity-80"
          aria-label="Clear search"
        >
          <span class="material-symbols-outlined" style="font-size: 16px; color: #6b7280;">close</span>
        </button>
      {/if}
    </div>

    <!-- Sort pills -->
    <div class="mb-5">
      <div class="flex flex-wrap gap-2 mb-2">
        {#each SORT_OPTIONS as opt}
          {@const active = sortBy === opt.value}
          <button
            onclick={() => changeSort(opt.value)}
            class="px-3 py-1.5 rounded-full text-xs font-bold tracking-[0.08em] uppercase transition-all active:scale-95 flex items-center gap-1"
            style="font-family: 'Cinzel', serif; background: {active ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.03)'}; border: 1px solid {active ? 'rgba(167,139,250,0.55)' : 'rgba(255,255,255,0.08)'}; color: {active ? '#c4b5fd' : '#6b7280'};"
          >
            {opt.label}
            {#if active}
              <span class="material-symbols-outlined" style="font-size: 13px;">
                {sortDir === 'desc' ? 'arrow_downward' : 'arrow_upward'}
              </span>
            {/if}
          </button>
        {/each}
      </div>
      {#if !loading}
        <p class="text-xs" style="font-family: 'JetBrains Mono', monospace; color: #4e4635;">
          {activeSortOption.label}: {sortDir === 'desc' ? activeSortOption.descLabel : activeSortOption.ascLabel}
          {#if searchQuery} · matching "{searchQuery}"{/if}
        </p>
      {/if}
    </div>

    <!-- Loading skeleton -->
    {#if loading}
      <div class="flex flex-col gap-3">
        {#each [1, 2, 3, 4, 5] as _}
          <div class="rounded-lg animate-pulse" style="background: linear-gradient(180deg, #161520 0%, #0c0b14 100%); border: 1px solid rgba(167,139,250,0.06); height: 80px;"></div>
        {/each}
      </div>

    <!-- Error -->
    {:else if error}
      <div class="text-center py-16">
        <p class="text-sm" style="color: #f87171;">{error}</p>
      </div>

    <!-- Empty -->
    {:else if chars.length === 0}
      <div class="text-center py-16 flex flex-col items-center gap-4">
        <span class="material-symbols-outlined text-5xl" style="color: #4e4635; font-variation-settings: 'FILL' 1;">auto_awesome</span>
        {#if searchQuery}
          <p class="text-sm" style="color: #9a907b;">No fates matching "{searchQuery}".</p>
          <button onclick={clearSearch} class="text-xs" style="color: #a78bfa; background: none; border: none; cursor: pointer; text-decoration: underline;">Clear search</button>
        {:else}
          <p class="text-sm" style="color: #9a907b;">No fates shared yet.</p>
          <p class="text-xs" style="color: #4e4635;">Save a character and toggle "Share in public gallery" to appear here.</p>
          <a href="/" class="metal-stamp-gold mt-4 px-8 py-3 rounded-lg relative"
            style="font-family: 'Cinzel', serif; font-size: 0.85rem; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; text-decoration: none; display: inline-flex; align-items: center; justify-content: center;">
            <div class="l-bracket" style="color: rgba(255,255,255,0.25);"></div>
            Spin Your Fate
          </a>
        {/if}
      </div>

    <!-- List -->
    {:else}
      <div class="flex flex-col gap-3">
        {#each chars as char}
          {@const titleLabel = getTitle(char)}
          {@const tierColor = TIER_COLORS[char.overall_tier] ?? '#6b7280'}
          <div
            class="flex rounded-lg overflow-hidden transition-all hover:brightness-110"
            style="background: linear-gradient(180deg, #161520 0%, #0c0b14 100%); border: 1px solid rgba(167,139,250,0.18); box-shadow: inset 1px 1px 0 rgba(167,139,250,0.05);"
          >
            <!-- Main link area -->
            <a
              href="/character/{char.shareId}"
              class="flex flex-1 items-center gap-0 min-w-0 active:scale-[0.99] transition-all"
              style="text-decoration: none;"
            >
              <!-- Tier badge -->
              <div class="shrink-0 w-16 self-stretch flex items-center justify-center"
                style="background: {tierColor}18; border-right: 1px solid {tierColor}28;">
                {#if char.overall_tier}
                  <span class="text-sm font-black" style="color: {tierColor}; font-family: 'Cinzel', serif; letter-spacing: -0.02em;">{char.overall_tier}</span>
                {:else}
                  <span class="material-symbols-outlined" style="color: #4e4635; font-size: 20px; font-variation-settings: 'FILL' 1;">person_play</span>
                {/if}
              </div>

              <!-- Info -->
              <div class="flex-1 min-w-0 px-4 py-3.5">
                {#if titleLabel}
                  <p class="text-xs truncate mb-0.5" style="font-family: 'JetBrains Mono', monospace; color: #a78bfa; letter-spacing: 0.08em;">{titleLabel}</p>
                {/if}
                <div class="flex items-center gap-2 min-w-0">
                  <p class="text-sm font-semibold truncate" style="font-family: 'Cinzel', serif; color: #ffdf96;">{char.name}</p>
                  {#if char.rivals_wins > 0}
                    <span class="shrink-0 flex items-center gap-0.5 text-xs" style="color: #f0c040;">
                      <span class="material-symbols-outlined" style="font-size: 13px; font-variation-settings: 'FILL' 1;">workspace_premium</span>
                      {char.rivals_wins}
                    </span>
                  {/if}
                </div>
                <div class="flex items-center gap-2 mt-0.5">
                  <p class="text-xs truncate" style="color: #9a907b;">{char.race} · {char.archetype}</p>
                  <p class="shrink-0 text-xs" style="font-family: 'JetBrains Mono', monospace; color: #4e4635;">{timeAgo(char.created_at)}</p>
                </div>
              </div>

              <!-- Score -->
              <div class="shrink-0 px-3 flex flex-col items-center justify-center self-stretch" style="border-left: 1px solid rgba(255,255,255,0.05);">
                <span class="text-sm font-black" style="font-family: 'JetBrains Mono', monospace; color: {tierColor};">{char.overall_score}</span>
                <span style="color: #4e4635; font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 0.05em;">pts</span>
              </div>
            </a>

            <!-- Challenge button -->
            <button
              onclick={() => openChallenge(char)}
              aria-label="Challenge {char.name}"
              class="shrink-0 flex flex-col items-center justify-center gap-0.5 px-3 transition-all active:scale-95"
              style="border-left: 1px solid rgba(167,139,250,0.12); background: none; cursor: pointer; color: #4e4635;"
              onmouseenter={(e) => (e.currentTarget as HTMLElement).style.color = '#f43f5e'}
              onmouseleave={(e) => (e.currentTarget as HTMLElement).style.color = '#4e4635'}
            >
              <span class="material-symbols-outlined" style="font-size: 18px; font-variation-settings: 'FILL' 1;">swords</span>
              <span style="font-family: 'JetBrains Mono', monospace; font-size: 8px; letter-spacing: 0.06em;">FIGHT</span>
            </button>
          </div>
        {/each}
      </div>

      <!-- Load more -->
      {#if hasMore}
        <div class="mt-6 text-center">
          <button
            onclick={loadMore}
            disabled={loadingMore}
            class="obsidian-slab px-8 py-3 rounded-lg text-sm tracking-[0.15em] uppercase font-bold transition-all active:scale-95 disabled:opacity-50"
            style="font-family: 'Cinzel', serif; color: #a78bfa; border: 1px solid rgba(167,139,250,0.3);"
          >
            {loadingMore ? 'Loading…' : 'Load More'}
          </button>
        </div>
      {:else}
        <p class="mt-6 text-center text-xs" style="font-family: 'JetBrains Mono', monospace; color: #4e4635;">
          {chars.length} of {total} fate{total === 1 ? '' : 's'}
        </p>
      {/if}
    {/if}

  </div>

  <!-- Challenge picker modal -->
  {#if challengeTarget}
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-40"
      style="background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);"
      onclick={closeChallenge}
      role="presentation"
    ></div>

    <!-- Sheet -->
    <div class="fixed bottom-0 inset-x-0 z-50 rounded-t-2xl pb-8 max-h-[80vh] flex flex-col"
      style="background: #0f0e1a; border-top: 1px solid rgba(244,63,94,0.3); box-shadow: 0 -8px 40px rgba(244,63,94,0.1); animation: slideInBottom 0.28s cubic-bezier(0.25,0.46,0.45,0.94) both;"
    >
      <!-- Handle -->
      <div class="flex justify-center pt-3 pb-1 shrink-0">
        <div class="w-10 h-1 rounded-full" style="background: rgba(255,255,255,0.1);"></div>
      </div>

      <!-- Header -->
      <div class="px-5 py-3 shrink-0" style="border-bottom: 1px solid rgba(255,255,255,0.06);">
        <p class="text-xs tracking-[0.2em] uppercase mb-0.5" style="font-family: 'JetBrains Mono', monospace; color: #f43f5e;">Challenge</p>
        <p style="font-family: 'Cinzel', serif; font-size: 0.95rem; color: #ffdf96;">
          vs <span style="color: #f43f5e;">{challengeTarget.name}</span>
        </p>
        <p class="text-xs mt-0.5" style="color: #6b7280;">Pick your fighter</p>
      </div>

      <!-- Character list -->
      <div class="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
        {#if myCharsLoading}
          <div class="flex items-center justify-center py-10 gap-3">
            <span class="material-symbols-outlined animate-spin" style="color: #a78bfa; font-size: 20px;">progress_activity</span>
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #6b7280;">Loading your characters…</span>
          </div>

        {:else if myChars.length === 0}
          <div class="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <span class="material-symbols-outlined text-4xl" style="color: #4e4635; font-variation-settings: 'FILL' 1;">person_off</span>
            <p style="font-family: 'Cinzel', serif; color: #9a907b; font-size: 0.9rem;">No saved characters</p>
            <p class="text-xs" style="color: #4e4635;">Spin a character and save it first.</p>
            <a href="/" onclick={closeChallenge}
              class="mt-2 px-6 py-2.5 rounded-lg text-xs tracking-[0.15em] uppercase font-bold"
              style="font-family: 'Cinzel', serif; color: #a78bfa; background: rgba(167,139,250,0.08); border: 1px solid rgba(167,139,250,0.25); text-decoration: none;">
              Spin Now
            </a>
          </div>

        {:else}
          {#each myChars as mine}
            {@const myTierColor = TIER_COLORS[mine.overall_tier] ?? '#6b7280'}
            <button
              onclick={() => startBattle(mine.shareId)}
              class="flex items-center gap-3 w-full rounded-lg px-4 py-3 text-left transition-all active:scale-[0.98]"
              style="background: rgba(255,255,255,0.03); border: 1px solid rgba(167,139,250,0.12); cursor: pointer;"
              onmouseenter={(e) => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(244,63,94,0.4)'}
              onmouseleave={(e) => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(167,139,250,0.12)'}
            >
              <div class="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                style="background: {myTierColor}18; border: 1px solid {myTierColor}30;">
                <span class="text-xs font-black" style="font-family: 'Cinzel', serif; color: {myTierColor};">{mine.overall_tier}</span>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold truncate" style="font-family: 'Cinzel', serif; color: #ffdf96;">{mine.name}</p>
                <p class="text-xs truncate" style="color: #6b7280;">{mine.race}</p>
              </div>
              <div class="shrink-0 flex items-center gap-1" style="color: #f43f5e;">
                <span class="text-xs font-bold" style="font-family: 'JetBrains Mono', monospace;">{mine.overall_score}</span>
                <span class="material-symbols-outlined" style="font-size: 16px;">chevron_right</span>
              </div>
            </button>
          {/each}
        {/if}
      </div>

      <!-- Cancel -->
      <div class="px-4 pt-2 shrink-0">
        <button
          onclick={closeChallenge}
          class="w-full py-3 rounded-lg text-sm tracking-[0.12em] uppercase font-bold transition-all active:scale-[0.98]"
          style="font-family: 'Cinzel', serif; color: #6b7280; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); cursor: pointer;"
        >Cancel</button>
      </div>
    </div>
  {/if}

</main>
