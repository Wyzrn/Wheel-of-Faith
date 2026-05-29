<script lang="ts">
  // Pre-battle intro for Rivals — both characters side-by-side with key stats
  // before the fight starts. ~3s of "building anticipation" pacing; players
  // can click "Begin" to skip. Hospitality: shows them what they're about to
  // see so the result feels earned, not random.
  import type { SpinResult } from '$lib/session/types'
  import { computeOverallScore, scoreTier, normalizeLegacyDisplayLabel } from '$lib/game/scoreTier'
  import TierBadge from './TierBadge.svelte'
  import { onMount, onDestroy } from 'svelte'

  let { team1, team2, team1Label, team2Label, team1Color = '#7dd3fc', team2Color = '#f9a8d4', onContinue }: {
    team1: { results: SpinResult[]; name?: string }[]
    team2: { results: SpinResult[]; name?: string }[]
    team1Label: string
    team2Label: string
    team1Color?: string
    team2Color?: string
    onContinue: () => void
  } = $props()

  // Quick per-team summary: avg overall tier across members + a few headline stats.
  interface TeamSummary {
    tier: string
    score: number
    members: { name: string; race: string; archetype: string; tier: string }[]
  }
  function summarize(team: { results: SpinResult[]; name?: string }[]): TeamSummary {
    let totalScore = 0
    const members = team.map(m => {
      const stats: Record<string, number> = {}
      for (const r of m.results) if (r.score !== undefined) stats[r.category] = r.score
      const score = computeOverallScore(stats)
      totalScore += score
      return {
        name: m.name ?? m.results.find(r => r.category === 'name')?.resultLabel ?? 'Unknown',
        race: m.results.find(r => r.category === 'race')?.resultLabel ?? '—',
        archetype: m.results.find(r => r.category === 'archetype')?.resultLabel ?? '—',
        tier: scoreTier(score),
      }
    })
    const avgScore = team.length > 0 ? totalScore / team.length : 0
    return { tier: scoreTier(avgScore), score: avgScore, members }
  }
  let t1 = $derived(summarize(team1))
  let t2 = $derived(summarize(team2))

  // 4-second countdown that the player can interrupt by tapping Begin or pressing Enter/Space.
  let secondsLeft = $state(4)
  let interval: ReturnType<typeof setInterval> | null = null
  let timeout: ReturnType<typeof setTimeout> | null = null
  function begin() {
    if (interval) clearInterval(interval)
    if (timeout) clearTimeout(timeout)
    onContinue()
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); begin() }
  }
  onMount(() => {
    interval = setInterval(() => { secondsLeft = Math.max(0, secondsLeft - 1) }, 1000)
    timeout = setTimeout(begin, 4000)
    if (typeof window !== 'undefined') window.addEventListener('keydown', onKey)
  })
  onDestroy(() => {
    if (interval) clearInterval(interval)
    if (timeout) clearTimeout(timeout)
    if (typeof window !== 'undefined') window.removeEventListener('keydown', onKey)
  })
</script>

<div class="fixed inset-0 z-50 flex flex-col items-center justify-center px-4 py-8"
  style="background: radial-gradient(ellipse at center, #0f0c1c 0%, #050308 100%); animation: rpFadeIn 0.3s ease-out;">

  <p class="font-mono text-[10px] tracking-[0.36em] uppercase mb-1" style="color: #9a907b;">⚔ Rivals Battle</p>
  <h1 class="font-bold mb-6" style="font-family: 'Cinzel', serif; font-size: clamp(1.4rem, 5vw, 2rem); color: #ffdf96; letter-spacing: 0.1em; text-shadow: 0 0 22px rgba(240,192,64,0.4);">
    Combatants
  </h1>

  <div class="flex items-stretch gap-3 w-full max-w-2xl">
    <!-- Team 1 column -->
    <div class="flex-1 rounded-2xl px-4 py-4 relative overflow-hidden"
      style="background: linear-gradient(160deg, {team1Color}10, #1e1a22 70%); border: 1px solid {team1Color}55; box-shadow: 0 0 30px {team1Color}22; animation: rpSlideRight 0.45s cubic-bezier(0.22, 0.8, 0.3, 1) both;">
      <p class="font-mono text-[10px] tracking-[0.22em] uppercase mb-2" style="color: {team1Color};">{team1Label}</p>
      {#each t1.members as m, i}
        <div class="mb-3 last:mb-0" style="animation: rpFadeIn 0.4s {0.2 + i * 0.1}s both;">
          <p class="font-bold text-sm" style="font-family: 'Cinzel', serif; color: #ffdf96;">{m.name}</p>
          <p class="text-[11px]" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">{m.race} · {m.archetype}</p>
          <div class="mt-1.5"><TierBadge grade={m.tier as any} interactive={false} /></div>
        </div>
      {/each}
    </div>

    <!-- VS divider -->
    <div class="flex flex-col items-center justify-center px-2">
      <div class="font-bold" style="font-family: 'Cinzel', serif; font-size: 1.4rem; color: #ffdf96; text-shadow: 0 0 24px rgba(240,192,64,0.9); animation: rpPulse 1.4s ease-in-out infinite;">VS</div>
    </div>

    <!-- Team 2 column -->
    <div class="flex-1 rounded-2xl px-4 py-4 text-right relative overflow-hidden"
      style="background: linear-gradient(200deg, {team2Color}10, #1e1a22 70%); border: 1px solid {team2Color}55; box-shadow: 0 0 30px {team2Color}22; animation: rpSlideLeft 0.45s cubic-bezier(0.22, 0.8, 0.3, 1) both;">
      <p class="font-mono text-[10px] tracking-[0.22em] uppercase mb-2" style="color: {team2Color};">{team2Label}</p>
      {#each t2.members as m, i}
        <div class="mb-3 last:mb-0" style="animation: rpFadeIn 0.4s {0.2 + i * 0.1}s both;">
          <p class="font-bold text-sm" style="font-family: 'Cinzel', serif; color: #ffdf96;">{m.name}</p>
          <p class="text-[11px]" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">{m.race} · {m.archetype}</p>
          <div class="mt-1.5 flex justify-end"><TierBadge grade={m.tier as any} interactive={false} /></div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Begin CTA -->
  <button
    onclick={begin}
    data-fx="big"
    class="metal-stamp-gold mt-8 px-10 py-3 rounded-lg text-sm font-bold tracking-widest"
    style="font-family: 'Cinzel', serif; letter-spacing: 0.2em; text-transform: uppercase;"
  >
    Begin{secondsLeft > 0 ? ` · ${secondsLeft}s` : ''}
  </button>
  <p class="text-[10px] mt-2" style="color: #4e4635; font-family: 'JetBrains Mono', monospace; letter-spacing: 0.12em;">
    Auto-begins in {secondsLeft}s · Enter to skip
  </p>
</div>

<style>
  @keyframes rpFadeIn  { from { opacity: 0;                 } to { opacity: 1;             } }
  @keyframes rpSlideRight { from { transform: translateX(-32px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
  @keyframes rpSlideLeft  { from { transform: translateX( 32px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
  @keyframes rpPulse  { 0%,100% { transform: scale(1); opacity: 0.85; } 50% { transform: scale(1.1); opacity: 1; } }
</style>
