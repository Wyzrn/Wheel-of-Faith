<script lang="ts">
  // Small inline streak banner. Slides in from the top of the wheel
  // column when a high-tier streak forms, auto-dismisses after a few
  // seconds. Pure reactive component — parent passes the Streak from
  // newlyFormedStreak(); when it changes (and is non-null) the banner
  // re-animates.
  import { onMount, onDestroy } from 'svelte'
  import type { Streak } from '$lib/streaks'

  let { streak = null }: { streak: Streak | null } = $props()

  // Keyed visibility — incremented when a new streak fires so the
  // animation re-runs even if the streak object identity stays stable.
  let key = $state(0)
  let visible = $state(false)
  let dismissTimer: ReturnType<typeof setTimeout> | null = null

  // Watch streak; when set, bump the key and start a dismiss timer.
  let lastStreakLen = $state<number>(0)
  $effect(() => {
    if (streak && streak.length !== lastStreakLen) {
      lastStreakLen = streak.length
      key++
      visible = true
      if (dismissTimer) clearTimeout(dismissTimer)
      // Hold longer for bigger streaks — more impressive, more screen time.
      const hold = 2200 + streak.length * 350
      dismissTimer = setTimeout(() => { visible = false }, hold)
    }
  })

  onDestroy(() => { if (dismissTimer) clearTimeout(dismissTimer) })
</script>

{#if visible && streak}
  {#key key}
    <div class="sb-banner"
      style="--accent: {streak.accentColor};"
      aria-live="polite"
      role="status"
    >
      <span class="sb-pulse" aria-hidden="true"></span>
      <span class="sb-text">{streak.message}</span>
    </div>
  {/key}
{/if}

<style>
  .sb-banner {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.85rem;
    background: linear-gradient(180deg, rgba(20,17,36,0.95) 0%, rgba(10,9,22,0.95) 100%);
    border: 1px solid color-mix(in srgb, var(--accent) 70%, transparent);
    border-radius: 999px;
    box-shadow:
      0 0 18px color-mix(in srgb, var(--accent) 40%, transparent),
      0 4px 12px rgba(0,0,0,0.55);
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--accent);
    text-shadow: 0 0 8px color-mix(in srgb, var(--accent) 50%, transparent);
    animation: sbSlideIn 0.55s cubic-bezier(0.34, 1.4, 0.5, 1) both,
               sbFadeOut 0.45s ease-out 1.8s both;
    will-change: transform, opacity;
    pointer-events: none;
  }
  .sb-pulse {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 10px var(--accent);
    animation: sbPulseDot 0.9s ease-in-out infinite;
    flex-shrink: 0;
  }
  .sb-text { white-space: nowrap; }

  @keyframes sbSlideIn {
    0%   { opacity: 0; transform: translateY(-10px) scale(0.88); }
    100% { opacity: 1; transform: translateY(0)     scale(1); }
  }
  @keyframes sbFadeOut {
    0%   { opacity: 1; }
    100% { opacity: 1; }
    /* Real fade controlled by `visible` toggling — this just reserves
       the animation slot so the slide-in finishes before opacity returns
       to its natural 1.0. Actual disappearance comes from {#if visible}. */
  }
  @keyframes sbPulseDot {
    0%, 100% { transform: scale(1);   opacity: 1; }
    50%      { transform: scale(1.4); opacity: 0.6; }
  }
  @media (prefers-reduced-motion: reduce) {
    .sb-banner, .sb-pulse { animation: none; }
  }
</style>
