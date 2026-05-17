<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import TeamBattleScreen from '../../components/TeamBattleScreen.svelte'
  import type { SpinResult } from '$lib/session/types'

  type CharData = { name: string; spins: SpinResult[]; shareId: string; session_started_at: string }

  let loading   = $state(true)
  let loadError = $state<string | null>(null)
  let team1     = $state<CharData[]>([])
  let team2     = $state<CharData[]>([])

  async function fetchChar(id: string): Promise<CharData | null> {
    try {
      const r = await fetch(`/api/characters/${id}`)
      if (!r.ok) return null
      const d = await r.json()
      return { name: d.name ?? '—', spins: d.spins ?? [], shareId: id, session_started_at: d.session_started_at }
    } catch {
      return null
    }
  }

  onMount(async () => {
    const params = new URLSearchParams(window.location.search)

    // New team format: ?t1=id1,id2&t2=id3
    // Backward compat:  ?p1=id1&p2=id2
    let ids1: string[] = []
    let ids2: string[] = []

    const t1 = params.get('t1')
    const t2 = params.get('t2')
    if (t1 && t2) {
      ids1 = t1.split(',').filter(Boolean)
      ids2 = t2.split(',').filter(Boolean)
    } else {
      const p1 = params.get('p1')
      const p2 = params.get('p2')
      if (p1) ids1 = [p1]
      if (p2) ids2 = [p2]
    }

    if (ids1.length === 0 || ids2.length === 0) {
      loadError = 'At least one character per team is required.'
      loading = false
      return
    }

    const allResults = await Promise.all([...ids1, ...ids2].map(fetchChar))
    const r1s = allResults.slice(0, ids1.length)
    const r2s = allResults.slice(ids1.length)

    if (r1s.some(r => r === null) || r2s.some(r => r === null)) {
      loadError = 'One or more characters could not be found.'
      loading = false
      return
    }

    team1 = r1s as CharData[]
    team2 = r2s as CharData[]
    loading = false
  })
</script>

<main class="min-h-screen" style="background: #07070d; color: #e4e1ee;">

  <!-- Nav -->
  <nav class="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-4 h-14"
    style="background: rgba(7,7,13,0.94); border-bottom: 1px solid rgba(157,23,77,0.2); backdrop-filter: blur(16px);"
  >
    <div class="flex items-center gap-2">
      <span class="material-symbols-outlined" style="color: #f0c040; font-size: 18px; font-variation-settings: 'FILL' 1;">casino</span>
      <span style="font-family: 'Cinzel', serif; font-size: 13px; font-weight: 700; color: #ffdf96; letter-spacing: 0.18em;">WHEEL OF FATE</span>
    </div>
    <button
      onclick={() => goto('/characters')}
      class="text-xs tracking-[0.12em] uppercase flex items-center gap-1.5 transition-colors"
      style="font-family: 'JetBrains Mono', monospace; color: #9a907b; background: none; border: none; cursor: pointer;"
    >
      <span class="material-symbols-outlined" style="font-size: 14px;">arrow_back</span>
      Characters
    </button>
  </nav>

  <div class="pt-14">
    {#if loading}
      <div class="flex flex-col items-center justify-center min-h-screen gap-4">
        <span class="material-symbols-outlined text-5xl" style="color: #f9a8d4; font-variation-settings: 'FILL' 1;">swords</span>
        <p style="font-family: 'JetBrains Mono', monospace; color: #9a907b; font-size: 0.85rem; letter-spacing: 0.15em;">Loading combatants…</p>
      </div>

    {:else if loadError}
      <div class="flex flex-col items-center justify-center min-h-screen gap-4 px-4 text-center">
        <span class="material-symbols-outlined text-5xl" style="color: #f87171; font-variation-settings: 'FILL' 1;">error</span>
        <p style="font-family: 'Cinzel', serif; color: #f87171;">{loadError}</p>
        <button
          onclick={() => goto('/characters')}
          class="mt-4 px-8 py-3 rounded-lg text-sm tracking-[0.18em] uppercase font-bold"
          style="font-family: 'Cinzel', serif; color: #9a907b; background: #0d0d16; border: 1px solid #4e4635;"
        >Back to Characters</button>
      </div>

    {:else if team1.length > 0 && team2.length > 0}
      <TeamBattleScreen
        team1={team1.map(c => ({ results: c.spins, name: c.name, shareId: c.shareId, startedAt: c.session_started_at }))}
        team2={team2.map(c => ({ results: c.spins, name: c.name, shareId: c.shareId, startedAt: c.session_started_at }))}
        onRematch={() => window.location.reload()}
        onBackToMenu={() => goto('/characters')}
      />
    {/if}
  </div>

</main>
