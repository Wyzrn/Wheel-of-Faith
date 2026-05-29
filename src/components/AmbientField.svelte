<script lang="ts">
  // Global ambient backdrop: a gold haze up top, an arcane-teal swell at the
  // bottom, and a field of slowly drifting gold embers. Fixed behind all
  // content (pointer-events:none). Ember count scales with perf tier and the
  // whole field is suppressed under prefers-reduced-motion / low perf.
  import { onMount } from 'svelte'
  import { getPerfTier } from '$lib/perf'

  let embers = $state<{ left: number; delay: number; duration: number; opacity: number }[]>([])

  onMount(() => {
    const reduce = typeof matchMedia !== 'undefined'
      && matchMedia('(prefers-reduced-motion: reduce)').matches
    const tier = getPerfTier()
    if (reduce || tier === 'low') return
    const count = tier === 'high' ? 36 : 20
    embers = Array.from({ length: count }, () => ({
      left: Math.random() * 100,
      delay: Math.random() * 10,
      duration: 8 + Math.random() * 10,
      opacity: 0.3 + Math.random() * 0.5,
    }))
  })
</script>

<div class="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
  <div class="absolute top-0 w-full h-64" style="background: linear-gradient(to bottom, rgba(240,192,82,0.10), transparent);"></div>
  <div class="absolute bottom-0 w-full h-96" style="background: linear-gradient(to top, rgba(90,214,239,0.10), transparent);"></div>
  {#each embers as e}
    <span class="ember" style="left: {e.left}vw; animation-delay: {e.delay}s; animation-duration: {e.duration}s; opacity: {e.opacity};"></span>
  {/each}
</div>
