<script lang="ts">
  // Compact progress-dot row showing run position. Used by both Main Game
  // and Story Mode under the wheel so new users always know where they
  // are in the 23-spin run + how much is left. Rendered as a series of
  // small dots (filled for done, ring for current, dim for upcoming) with
  // categorical hues sampled from the queue when available.
  //
  // Scales gracefully — collapses to a single bar of dots that wraps,
  // never overflows. Tier-color tinted on completed spins so a streak of
  // high-tier rolls visually pops.

  import type { SpinDefinition } from '$lib/game/spinQueue'
  import type { SpinResult } from '$lib/session/types'

  let { currentIndex, total, results = [], tierColors = {} }: {
    currentIndex: number
    total: number
    results?: SpinResult[]
    // Optional tier → color map so completed dots tint by their tier.
    tierColors?: Record<string, string>
  } = $props()

  // Resolve color per completed result. Stat spins have a tier; non-stat
  // spins (race/archetype/etc.) get a neutral gold dot.
  function dotColor(i: number): string {
    if (i >= results.length) return ''  // upcoming
    const r = results[i]
    if (r?.tier && tierColors[r.tier]) return tierColors[r.tier]
    return '#f0c040'  // gold for non-stat completed
  }
</script>

<!-- Compact dot strip — wraps on narrow viewports, gold gradient bar fill -->
<div class="spd-row" aria-label="Spin progress" role="progressbar"
  aria-valuenow={currentIndex} aria-valuemax={total}>
  {#each Array.from({ length: total }, (_, i) => i) as i (i)}
    {@const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'upcoming'}
    <span
      class="spd-dot spd-dot-{state}"
      style={state === 'done' ? `--dot-color: ${dotColor(i)};` : ''}
      title="Spin {i + 1} of {total}"
    ></span>
  {/each}
  <span class="spd-counter" aria-hidden="true">{Math.min(currentIndex + 1, total)} / {total}</span>
</div>

<style>
  .spd-row {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    align-items: center;
    justify-content: center;
    max-width: 100%;
    padding: 6px 10px;
    border-radius: 999px;
    background: rgba(7, 7, 13, 0.55);
    border: 1px solid rgba(240, 192, 64, 0.14);
    box-shadow: inset 0 0 18px rgba(0, 0, 0, 0.4);
  }
  .spd-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: transparent;
    border: 1px solid transparent;
    transition: transform 0.18s ease, opacity 0.18s ease;
    display: inline-block;
    flex: 0 0 auto;
  }
  .spd-dot-done {
    background: var(--dot-color, #f0c040);
    box-shadow: 0 0 6px var(--dot-color, #f0c04055);
  }
  .spd-dot-current {
    background: transparent;
    border: 2px solid #f0c040;
    box-shadow: 0 0 10px rgba(240, 192, 64, 0.65), inset 0 0 4px rgba(240, 192, 64, 0.5);
    animation: spdPulse 1.4s ease-in-out infinite;
    transform: scale(1.18);
  }
  .spd-dot-upcoming {
    background: transparent;
    border: 1px solid rgba(240, 192, 64, 0.22);
    opacity: 0.55;
  }
  .spd-counter {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.16em;
    color: #c9a050;
    margin-left: 6px;
    padding-left: 8px;
    border-left: 1px solid rgba(240, 192, 64, 0.18);
  }
  @keyframes spdPulse {
    0%, 100% { box-shadow: 0 0 10px rgba(240, 192, 64, 0.65), inset 0 0 4px rgba(240, 192, 64, 0.5); }
    50%      { box-shadow: 0 0 18px rgba(240, 192, 64, 0.95), inset 0 0 6px rgba(240, 192, 64, 0.7); }
  }
  @media (prefers-reduced-motion: reduce),
         (pointer: coarse) {
    /* Touch / mobile: dot pulses run all the time which on a 23-spin
       run means continuous GPU work. Show the current dot at full
       brightness instead of animating. */
    .spd-dot-current { animation: none; }
  }
</style>
