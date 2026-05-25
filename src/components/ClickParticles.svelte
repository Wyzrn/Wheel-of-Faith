<script lang="ts">
  // Global click/tap particle effect. Mounted once in +layout.svelte; listens for
  // pointerdown on document and spawns 3–6 short-lived sparkle particles at the
  // event coordinates. Particles use existing /static/fx/k PNGs and animate via
  // CSS for cheap GPU-accelerated paint. Skipped on low-perf devices.
  //
  // Special-case bigger bursts for elements tagged with [data-fx="big"] or with
  // the .spin-fx class (e.g. the wheel's spin button).

  import { onMount, onDestroy } from 'svelte'
  import { getPerfTier } from '$lib/perf'
  import { settings } from '$lib/settings.svelte'

  // Particle sprite pool — picked from /static/fx/k.
  // sparks = sharp directional bits, circles = soft glow puffs.
  const SPARKS  = ['/fx/k/spark_01.png', '/fx/k/spark_03.png', '/fx/k/spark_05.png', '/fx/k/spark_06.png', '/fx/k/star_03.png', '/fx/k/star_05.png']
  const CIRCLES = ['/fx/k/circle_01.png', '/fx/k/circle_02.png', '/fx/k/flare_01.png']

  type Particle = {
    id: number
    src: string
    x: number; y: number
    dx: number; dy: number
    size: number
    rot: number
    life: number  // animation duration in ms
  }

  let particles = $state<Particle[]>([])
  let nextId = 0

  // Track perf tier once — don't react to settings churn during a click burst.
  const perfTier = getPerfTier()

  // Element-tagged bursts get a stronger spawn. Match by checking the path
  // ancestors of the event target.
  function isBigTarget(el: Element | null): boolean {
    while (el) {
      if (el instanceof HTMLElement || el instanceof SVGElement) {
        if (el.dataset && el.dataset.fx === 'big') return true
        if (el.classList && (el.classList.contains('spin-fx') || el.classList.contains('metal-stamp-gold'))) return true
      }
      el = el.parentElement
    }
    return false
  }

  // Don't fire on form text inputs / selects — those clicks should feel quiet,
  // and we don't want sparks dancing on top of a keyboard popover.
  function isQuietTarget(el: Element | null): boolean {
    while (el) {
      const tag = el.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'option') return true
      el = el.parentElement
    }
    return false
  }

  function burst(x: number, y: number, big: boolean) {
    if (perfTier === 'low' || !settings.effectsEnabled) return
    // Mid burst: 3 particles; big burst (spin button etc.): 7. High-tier bumps it up.
    let count = big ? 7 : 3
    if (perfTier === 'high') count += 1
    for (let i = 0; i < count; i++) {
      const isSpark = Math.random() > 0.35
      const angle = Math.random() * Math.PI * 2
      const dist  = (big ? 28 : 14) + Math.random() * (big ? 36 : 18)
      particles.push({
        id: nextId++,
        src: isSpark ? SPARKS[Math.floor(Math.random() * SPARKS.length)] : CIRCLES[Math.floor(Math.random() * CIRCLES.length)],
        x, y,
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist - (big ? 10 : 4),  // slight upward bias so it feels lifted
        size: (isSpark ? 12 : 18) + Math.random() * (big ? 14 : 8),
        rot: Math.random() * 360 - 180,
        life: 500 + Math.random() * 200,
      })
    }
    // Cap total live particles so a rage-click can't balloon the DOM.
    if (particles.length > 60) particles = particles.slice(-60)
  }

  function onPointerDown(e: PointerEvent) {
    if (isQuietTarget(e.target as Element)) return
    burst(e.clientX, e.clientY, isBigTarget(e.target as Element))
  }

  // Cleanup expired particles every ~250ms. Cheaper than per-particle setTimeout
  // when bursts overlap heavily — Svelte still re-renders only the changed list.
  let cleanupTimer: ReturnType<typeof setInterval> | null = null

  onMount(() => {
    if (typeof window === 'undefined') return
    window.addEventListener('pointerdown', onPointerDown, { passive: true })
    cleanupTimer = setInterval(() => {
      if (particles.length > 0) {
        // Remove oldest 1/3 of particles per tick — animation duration is 500–700ms
        // and tick is 250ms, so any particle survives ≥ one tick before pruning.
        const cutoff = Math.max(0, particles.length - Math.ceil(particles.length * 0.7))
        particles = particles.slice(cutoff)
      }
    }, 250)
  })

  onDestroy(() => {
    if (typeof window === 'undefined') return
    window.removeEventListener('pointerdown', onPointerDown)
    if (cleanupTimer) clearInterval(cleanupTimer)
  })
</script>

<!-- pointer-events:none on the container so particles never block interaction -->
<div class="click-fx-root" aria-hidden="true">
  {#each particles as p (p.id)}
    <img
      src={p.src}
      class="click-fx-particle"
      alt=""
      style="
        left: {p.x}px;
        top:  {p.y}px;
        width:  {p.size}px;
        height: {p.size}px;
        --dx: {p.dx}px;
        --dy: {p.dy}px;
        --rot: {p.rot}deg;
        animation-duration: {p.life}ms;
      "
    />
  {/each}
</div>

<style>
  .click-fx-root {
    position: fixed;
    inset: 0;
    z-index: 9999;
    pointer-events: none;
    overflow: hidden;
    /* Containment isolates particle paint from the rest of the page */
    contain: layout style paint;
  }
  .click-fx-particle {
    position: fixed;
    transform: translate(-50%, -50%);
    pointer-events: none;
    will-change: transform, opacity;
    animation-name: clickFxBurst;
    animation-timing-function: cubic-bezier(0.22, 0.8, 0.3, 1);
    animation-fill-mode: forwards;
    filter: drop-shadow(0 0 6px rgba(240,192,64,0.6));
    user-select: none;
  }
  @keyframes clickFxBurst {
    0%   { transform: translate(-50%, -50%) scale(0.4) rotate(0deg); opacity: 0; }
    20%  { opacity: 1; }
    100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(0.2) rotate(var(--rot)); opacity: 0; }
  }
</style>
