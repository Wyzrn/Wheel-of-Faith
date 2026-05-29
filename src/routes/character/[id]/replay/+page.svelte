<script lang="ts">
  import { page } from '$app/stores'
  import { onMount } from 'svelte'

  let character = $state<any>(null)
  let loading = $state(true)
  let error = $state<string | null>(null)
  let currentStep = $state(0)
  let autoPlay = $state(false)
  let autoInterval: ReturnType<typeof setInterval> | null = null

  onMount(async () => {
    const id = $page.params.id
    const res = await fetch(`/api/characters/${id}`)
    if (!res.ok) { error = 'Character not found.'; loading = false; return }
    character = await res.json()
    loading = false
  })

  let spins = $derived(character?.spins ?? [])
  let currentSpin = $derived(spins[currentStep] ?? null)
  let isLast = $derived(currentStep >= spins.length - 1)

  function next() {
    if (!isLast) currentStep++
  }
  function prev() {
    if (currentStep > 0) currentStep--
  }
  function reset() {
    currentStep = 0
    stopAuto()
  }

  function toggleAuto() {
    if (autoPlay) { stopAuto(); return }
    autoPlay = true
    autoInterval = setInterval(() => {
      if (currentStep >= spins.length - 1) { stopAuto(); return }
      currentStep++
    }, 1200)
  }
  function stopAuto() {
    autoPlay = false
    if (autoInterval) { clearInterval(autoInterval); autoInterval = null }
  }

  function tierColor(tier: string): string {
    if (!tier) return '#9a907b'
    if (tier.startsWith('God')) return '#ff6b35'
    if (tier.startsWith('SSS')) return '#e040fb'
    if (tier.startsWith('SS')) return '#7c4dff'
    if (tier.startsWith('S')) return '#2979ff'
    if (tier.startsWith('A')) return '#00e676'
    if (tier.startsWith('B')) return '#ffea00'
    if (tier.startsWith('C')) return '#ff9100'
    return '#9a907b'
  }
</script>

<main class="min-h-screen" style="background: transparent; color: #e9dfeb;">
  <nav class="fixed top-0 inset-x-0 z-50 flex items-center px-4 h-14" style="background: rgba(22,18,26,0.92); border-bottom: 1px solid rgba(240,192,64,0.13); backdrop-filter: blur(16px);">
    <a href="/character/{$page.params.id}" class="flex items-center gap-1 transition-all active:scale-95" style="color: #9a907b; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.08em; text-decoration: none; padding: 4px 6px; border-radius: 6px;">
      <span class="material-symbols-outlined" style="font-size: 15px;">arrow_back</span>
      <span>Back</span>
    </a>
    <div class="flex-1 flex items-center justify-center gap-2">
      <span class="material-symbols-outlined" style="color: #f0c040; font-size: 18px; font-variation-settings: 'FILL' 1;">play_circle</span>
      <span style="font-family: 'Cinzel', serif; font-size: 13px; font-weight: 700; color: #ffdf96; letter-spacing: 0.18em;">SPIN REPLAY</span>
    </div>
    <div style="min-width: 80px;"></div>
  </nav>

  <div class="pt-20 pb-24 px-4 max-w-lg mx-auto">
    {#if loading}
      <div class="flex items-center justify-center py-20">
        <span class="material-symbols-outlined animate-spin" style="font-size: 36px; color: #f0c040;">refresh</span>
      </div>
    {:else if error}
      <p class="text-center py-20" style="color: #f87171;">{error}</p>
    {:else if character}
      <!-- Character header -->
      <div class="text-center mb-8">
        <h1 style="font-family: 'Cinzel', serif; font-size: 1.6rem; font-weight: 900; color: #ffdf96;">{character.name}</h1>
        <p class="text-xs mt-1 tracking-widest uppercase" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">{character.race} · {character.archetype} · {character.overall_tier}</p>
      </div>

      <!-- Progress bar -->
      <div class="mb-6">
        <div class="flex justify-between mb-1">
          <span class="font-mono text-xs" style="color: #4e4635;">Spin {currentStep + 1} of {spins.length}</span>
          <span class="font-mono text-xs" style="color: #4e4635;">{Math.round(((currentStep + 1) / spins.length) * 100)}%</span>
        </div>
        <div class="w-full h-1.5 rounded-full" style="background: rgba(255,255,255,0.06);">
          <div class="h-full rounded-full transition-all duration-300" style="width: {((currentStep + 1) / spins.length) * 100}%; background: linear-gradient(90deg, #c0882a, #f0c040);"></div>
        </div>
      </div>

      <!-- Current spin card -->
      {#if currentSpin}
        <div class="rounded-2xl px-6 py-6 mb-6 text-center" style="background: linear-gradient(180deg, #13121c, #1e1a22); border: 1px solid rgba(240,192,64,0.25); box-shadow: 0 0 40px rgba(0,0,0,0.8);">
          <p class="font-mono text-xs tracking-widest uppercase mb-3" style="color: #9a907b;">{currentSpin.category ?? currentSpin.spinType ?? 'Spin'}</p>
          <p class="font-bold mb-2" style="font-family: 'Cinzel', serif; font-size: 1.3rem; color: #ffdf96; line-height: 1.3;">{currentSpin.resultLabel ?? currentSpin.label ?? currentSpin.result ?? '—'}</p>
          {#if currentSpin.tier}
            <span class="inline-block font-mono text-sm font-bold px-3 py-1 rounded-lg" style="background: rgba(240,192,64,0.1); border: 1px solid rgba(240,192,64,0.25); color: {tierColor(currentSpin.tier)};">{currentSpin.tier}</span>
          {/if}
          {#if currentSpin.score !== undefined}
            <p class="font-mono text-xs mt-2" style="color: #4e4635;">score: {currentSpin.score?.toFixed?.(2) ?? currentSpin.score}</p>
          {/if}
        </div>
      {/if}

      <!-- Controls -->
      <div class="flex items-center justify-center gap-3 mb-4">
        <button onclick={reset} class="px-3 py-2 rounded-lg font-mono text-xs" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #9a907b;">Reset</button>
        <button onclick={prev} disabled={currentStep === 0} class="px-4 py-2.5 rounded-lg font-bold text-sm disabled:opacity-30" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #e9dfeb;">‹ Prev</button>
        <button onclick={toggleAuto} class="px-4 py-2.5 rounded-lg font-bold text-sm" style="background: {autoPlay ? 'rgba(239,68,68,0.15)' : 'rgba(240,192,64,0.15)'}; border: 1px solid {autoPlay ? 'rgba(239,68,68,0.3)' : 'rgba(240,192,64,0.3)'}; color: {autoPlay ? '#f87171' : '#f0c040'};">
          {autoPlay ? '⏸ Pause' : '▶ Auto'}
        </button>
        <button onclick={next} disabled={isLast} class="px-4 py-2.5 rounded-lg font-bold text-sm disabled:opacity-30" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #e9dfeb;">Next ›</button>
      </div>

      {#if isLast}
        <div class="text-center mt-4 py-4 rounded-xl" style="background: rgba(240,192,64,0.06); border: 1px solid rgba(240,192,64,0.2);">
          <p style="font-family: 'Cinzel', serif; color: #f0c040; font-weight: 700;">Replay Complete</p>
          <p class="font-mono text-xs mt-1" style="color: #9a907b;">Final tier: {character.overall_tier} · Score: {character.overall_score?.toFixed(1) ?? '—'}</p>
          <a href="/character/{$page.params.id}" class="inline-block mt-3 px-4 py-2 rounded-lg font-mono text-xs" style="background: rgba(240,192,64,0.12); border: 1px solid rgba(240,192,64,0.3); color: #f0c040; text-decoration: none;">View Character Card</a>
        </div>
      {/if}
    {/if}
  </div>
</main>
