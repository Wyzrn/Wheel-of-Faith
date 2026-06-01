<!--
  WheelThemePreview.svelte — small SVG disc that renders a wheel theme's
  rim + inner glow so shop visitors can see what they're paying for.
  Renders the theme's actual rimStroke/rimAccent/innerStops without
  needing the full SpinWheel pipeline (no segments, no spin, no GSAP).
-->
<script lang="ts">
  import type { WheelTheme } from '$lib/wheelThemes'

  let { theme, size = 180 }: {
    theme: WheelTheme
    /** Pixel diameter of the preview disc. */
    size?: number
  } = $props()

  // Sample tier slices for visual interest. The theme is what we're
  // selling; the slices are just there so the preview reads as "a wheel".
  const slices = [
    { color: '#0369a1' }, { color: '#7c3aed' }, { color: '#ec4899' },
    { color: '#f59e0b' }, { color: '#22c55e' }, { color: '#06b6d4' },
    { color: '#a78bfa' }, { color: '#ef4444' },
  ]
</script>

<div class="wtp-wrap" style="width: {size}px; height: {size}px;">
  <svg viewBox="0 0 200 200" width={size} height={size}>
    <defs>
      <radialGradient id="wtp-inner-{theme.id}" cx="50%" cy="50%" r="50%">
        <stop offset="0%"   stop-color={theme.innerStops[0]} />
        <stop offset="40%"  stop-color={theme.innerStops[1]} />
        <stop offset="75%"  stop-color={theme.innerStops[2]} />
        <stop offset="100%" stop-color={theme.innerStops[3]} />
      </radialGradient>
      {#if theme.spikeStops}
        <radialGradient id="wtp-spike-{theme.id}" cx="50%" cy="50%" r="55%">
          <stop offset="0%"   stop-color={theme.spikeStops[0]} />
          <stop offset="70%"  stop-color={theme.spikeStops[1]} />
          <stop offset="100%" stop-color={theme.spikeStops[2]} />
        </radialGradient>
      {/if}
    </defs>

    {#if theme.spikeStops}
      <!-- 8 short triangular spikes around the rim -->
      {#each Array(8) as _, i}
        {@const angle = (i / 8) * 360}
        <polygon points="100,2 96,18 104,18"
          transform="rotate({angle} 100 100)"
          fill="url(#wtp-spike-{theme.id})" opacity="0.85" />
      {/each}
    {/if}

    <!-- Sample slices -->
    {#each slices as s, i}
      {@const a1 = (i / slices.length) * 360 - 90}
      {@const a2 = ((i + 1) / slices.length) * 360 - 90}
      {@const x1 = 100 + 78 * Math.cos((a1 * Math.PI) / 180)}
      {@const y1 = 100 + 78 * Math.sin((a1 * Math.PI) / 180)}
      {@const x2 = 100 + 78 * Math.cos((a2 * Math.PI) / 180)}
      {@const y2 = 100 + 78 * Math.sin((a2 * Math.PI) / 180)}
      <path d="M 100 100 L {x1} {y1} A 78 78 0 0 1 {x2} {y2} Z"
            fill={s.color} opacity="0.6" />
    {/each}

    <!-- Inner glow overlay (the theme's character) -->
    <circle cx="100" cy="100" r="78" fill="url(#wtp-inner-{theme.id})" />

    <!-- Outer rim + inner accent ring (the theme's rim color) -->
    <circle cx="100" cy="100" r="86" fill="none" stroke={theme.rimStroke} stroke-width="3" />
    <circle cx="100" cy="100" r="78" fill="none" stroke={theme.rimAccent} stroke-width="1.5" opacity="0.6" />

    <!-- Hub -->
    <circle cx="100" cy="100" r="10" fill="#0d0c16" stroke={theme.rimStroke} stroke-width="1.5" />
  </svg>
</div>

<style>
  .wtp-wrap {
    display: inline-block;
    border-radius: 50%;
    filter: drop-shadow(0 0 18px var(--wtp-glow, rgba(240, 192, 82, 0.45)))
            drop-shadow(0 4px 12px rgba(0, 0, 0, 0.6));
  }
</style>
