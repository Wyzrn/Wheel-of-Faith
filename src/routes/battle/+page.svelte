<script lang="ts">
  import { apiUrl } from '$lib/api'
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import QuickBattleView from '../../components/QuickBattleView.svelte'
  import type { SpinResult } from '$lib/session/types'

  type CharData = { name: string; spins: SpinResult[]; shareId: string }

  let loading   = $state(true)
  let loadError = $state<string | null>(null)
  let team1     = $state<CharData[]>([])
  let team2     = $state<CharData[]>([])

  async function fetchChar(id: string): Promise<CharData | null> {
    try {
      const r = await fetch(apiUrl(`/api/characters/${id}`))
      if (!r.ok) return null
      const d = await r.json()
      return { name: d.name ?? '—', spins: d.spins ?? [], shareId: id }
    } catch {
      return null
    }
  }

  onMount(async () => {
    const params = new URLSearchParams(window.location.search)

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

  function handleRematch() {
    window.location.reload()
  }
</script>

<div style="background: transparent; min-height: 100dvh; color: #e9dfeb;">

  {#if loading}
    <div class="flex flex-col items-center justify-center min-h-screen gap-4">
      <span class="material-symbols-outlined text-5xl" style="color: #f0c040; font-variation-settings: 'FILL' 1;">swords</span>
      <p style="font-family: 'JetBrains Mono', monospace; color: #9a907b; font-size: 0.85rem; letter-spacing: 0.15em;">Loading combatants…</p>
    </div>

  {:else if loadError}
    <div class="flex flex-col items-center justify-center min-h-screen gap-4 px-4 text-center">
      <span class="material-symbols-outlined text-5xl" style="color: #f87171; font-variation-settings: 'FILL' 1;">error</span>
      <p style="font-family: 'Cinzel', serif; color: #f87171;">{loadError}</p>
      <button
        onclick={() => goto('/characters')}
        class="mt-4 px-8 py-3 rounded-lg text-sm tracking-[0.18em] uppercase font-bold"
        style="font-family: 'Cinzel', serif; color: #9a907b; background: #0d0d16; border: 1px solid #4e4635; cursor: pointer;">
        Back to Characters
      </button>
    </div>

  {:else if team1.length > 0 && team2.length > 0}
    <QuickBattleView
      team1={team1.map(c => ({ results: c.spins, name: c.name, shareId: c.shareId }))}
      team2={team2.map(c => ({ results: c.spins, name: c.name, shareId: c.shareId }))}
      team1Label={team1.length === 1 ? team1[0].name : 'Team 1'}
      team2Label={team2.length === 1 ? team2[0].name : 'Team 2'}
      title={team1.length === 1 && team2.length === 1
        ? `${team1[0].name} vs ${team2[0].name}`
        : 'Team Battle'}
      team2Color="#e879f9"
      onRematch={handleRematch}
      onBack={() => goto('/characters')}
      backLabel="Characters"
    />
  {/if}

</div>
