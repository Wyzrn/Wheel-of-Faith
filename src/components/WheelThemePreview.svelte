<!--
  WheelThemePreview.svelte — exact-VFX preview of a wheel cosmetic theme.

  The wt-* CSS rules in src/lib/wheelThemes.css attach to .sw-wheel-box
  via the theme's cssClass (.wt-void, .wt-hellfire, etc.). By recreating
  the same DOM shape SpinWheel uses — a .sw-wheel-box with a SVG slice
  layout and a .cursed-inner-glow circle inside — we get the same rim,
  glow, particles, and animated pseudo-elements without mounting the
  full SpinWheel component (and its GSAP idle, sound loaders, etc.).

  The drop-shadow on the wheel-box mirrors what SpinWheel applies inline
  so themed glow extends fully outside the rim.
-->
<script lang="ts">
  import type { WheelTheme } from '$lib/wheelThemes'

  let { theme, size = 240 }: {
    theme: WheelTheme
    /** Pixel diameter of the wheel box. The theme's pseudo-elements
     *  extend up to ~64px outside this — caller should leave at least
     *  ~80px padding around the preview for VFX bleed. */
    size?: number
  } = $props()

  // 8 sample slices coloured for visual interest. The theme is what we're
  // selling; the slices are just there so the wheel reads as a wheel.
  const slices = [
    { color: '#E63946' }, { color: '#457B9D' },
    { color: '#2A9D8F' }, { color: '#E9C46A' },
    { color: '#F4A261' }, { color: '#264653' },
    { color: '#6A0572' }, { color: '#0077B6' },
  ]
  const SVG_SIZE = 500
  const CENTER = SVG_SIZE / 2
  const RADIUS = 230

  function arcPath(startDeg: number, endDeg: number): string {
    const toRad = (d: number) => ((d - 90) * Math.PI) / 180
    const x1 = CENTER + RADIUS * Math.cos(toRad(startDeg))
    const y1 = CENTER + RADIUS * Math.sin(toRad(startDeg))
    const x2 = CENTER + RADIUS * Math.cos(toRad(endDeg))
    const y2 = CENTER + RADIUS * Math.sin(toRad(endDeg))
    const large = endDeg - startDeg > 180 ? 1 : 0
    return `M ${CENTER} ${CENTER} L ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 ${large} 1 ${x2} ${y2} Z`
  }
</script>

<!-- The wheel-box recreates SpinWheel's structure so the wt-* CSS attaches
     properly. Theme cssClass is applied conditionally; default theme just
     leaves it blank. -->
<div class="wtp-stage" style="--wtp-size: {size}px;">
  <div class="sw-wheel-box {theme.cssClass}" style="--wtp-glow: {theme.glow};">
    <svg viewBox="0 0 {SVG_SIZE} {SVG_SIZE}" style="grid-area: 1/1; width: 100%; height: 100%; overflow: visible;" aria-label="Wheel preview">
      <defs>
        <radialGradient id="wtp-inner-{theme.id}" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stop-color={theme.innerStops[0]} />
          <stop offset="40%"  stop-color={theme.innerStops[1]} />
          <stop offset="75%"  stop-color={theme.innerStops[2]} />
          <stop offset="100%" stop-color={theme.innerStops[3]} />
        </radialGradient>
      </defs>

      <!-- Sample slices -->
      {#each slices as s, i}
        {@const a1 = (i / slices.length) * 360}
        {@const a2 = ((i + 1) / slices.length) * 360}
        <path d={arcPath(a1, a2)} fill={s.color} opacity="0.78" />
      {/each}

      <!-- Inner glow — same .cursed-inner-glow class SpinWheel uses, so
           themes that target it (e.g. void's voidSuck override) animate
           correctly here too. -->
      <circle cx={CENTER} cy={CENTER} r={RADIUS - 2}
        fill="url(#wtp-inner-{theme.id})"
        class="cursed-inner-glow"
        style="mix-blend-mode: screen; animation-duration: {theme.innerPulseS ?? 2.4}s;"
        pointer-events="none" />

      <!-- Rim -->
      <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none"
        stroke={theme.rimStroke} stroke-width="6" />
      <circle cx={CENTER} cy={CENTER} r={RADIUS - 6} fill="none"
        stroke={theme.rimAccent} stroke-width="2" opacity="0.55" />

      <!-- Hub -->
      <circle cx={CENTER} cy={CENTER} r="22" fill="#0d0c16"
        stroke={theme.rimStroke} stroke-width="2" />
    </svg>
  </div>
</div>

<style>
  /* Padded stage so theme pseudo-elements (insets of -64px on hellfire/void
     ::after) have room to render outside the wheel rim. */
  .wtp-stage {
    width: calc(var(--wtp-size) + 160px);
    height: calc(var(--wtp-size) + 160px);
    display: flex; align-items: center; justify-content: center;
    position: relative;
  }
  /* sw-wheel-box is the exact selector the wt-* CSS in wheelThemes.css
     targets via .wt-X { ... }. We replicate the inline-style filter
     drop-shadow chain SpinWheel uses so themed glow projects correctly. */
  :global(.sw-wheel-box) {
    position: relative;
    display: grid;
  }
  .wtp-stage > .sw-wheel-box {
    width: var(--wtp-size);
    aspect-ratio: 1 / 1;
    filter:
      drop-shadow(0 0 28px rgba(0, 0, 0, 0.85))
      drop-shadow(0 0 18px var(--wtp-glow, rgba(240, 192, 82, 0.34)))
      drop-shadow(0 0 10px var(--wtp-glow, rgba(240, 192, 82, 0.34)));
  }
</style>
