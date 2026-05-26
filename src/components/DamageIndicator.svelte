<script lang="ts">
  // Floating damage indicator. Pops above a character with a value, a kind
  // (damage / heal / crit / miss), and floats upward while fading. Rendered
  // by battle views above the active character cards. The parent owns the
  // lifecycle — adds entries to a $state array on each damage event and lets
  // CSS animations clean up visually; the parent prunes the array after the
  // animation duration via setTimeout.
  import { formatHp } from '$lib/game/battle'
  import type { DamageEvent } from '$lib/game/damageEvent'

  let { events }: { events: DamageEvent[] } = $props()

  function colorFor(kind: DamageEvent['kind']): string {
    if (kind === 'heal')   return '#34d399'
    if (kind === 'crit')   return '#fde047'
    if (kind === 'miss')   return '#9a907b'
    if (kind === 'shield') return '#93c5fd'
    return '#ef4444'
  }
  function labelFor(e: DamageEvent): string {
    if (e.kind === 'miss')   return 'MISS'
    if (e.kind === 'shield') return 'BLOCK'
    if (e.kind === 'heal')   return `+${formatHp(e.value)}`
    return `-${formatHp(e.value)}`
  }
  function sizeFor(kind: DamageEvent['kind']): number {
    if (kind === 'crit') return 28
    if (kind === 'miss' || kind === 'shield') return 16
    return 22
  }
</script>

<div class="dmg-layer" aria-hidden="true">
  {#each events as e (e.id)}
    <span
      class="dmg-pop"
      class:dmg-crit={e.kind === 'crit'}
      style="
        left: {e.x}px;
        top:  {e.y}px;
        color: {colorFor(e.kind)};
        font-size: {sizeFor(e.kind)}px;
        text-shadow:
          0 0 6px {colorFor(e.kind)}88,
          0 1px 2px rgba(0,0,0,0.95),
          0 0 18px {colorFor(e.kind)}55;
      "
    >{labelFor(e)}</span>
  {/each}
</div>

<style>
  .dmg-layer {
    position: fixed;
    inset: 0;
    z-index: 9998;          /* below AttackFX (9999) but above battle UI */
    pointer-events: none;
    overflow: visible;
  }
  .dmg-pop {
    position: fixed;
    transform: translate(-50%, -50%);
    font-family: 'Cinzel', serif;
    font-weight: 900;
    letter-spacing: 0.04em;
    white-space: nowrap;
    animation: dmgFloat 1.1s cubic-bezier(0.22, 0.8, 0.3, 1) forwards;
    will-change: transform, opacity;
  }
  .dmg-pop.dmg-crit {
    animation: dmgFloatCrit 1.2s cubic-bezier(0.22, 0.8, 0.3, 1) forwards;
  }
  @keyframes dmgFloat {
    0%   { transform: translate(-50%, -50%) scale(0.55) translateY(0px);   opacity: 0; }
    18%  { transform: translate(-50%, -50%) scale(1.15) translateY(-12px); opacity: 1; }
    35%  { transform: translate(-50%, -50%) scale(1.00) translateY(-18px); opacity: 1; }
    100% { transform: translate(-50%, -50%) scale(0.80) translateY(-48px); opacity: 0; }
  }
  @keyframes dmgFloatCrit {
    0%   { transform: translate(-50%, -50%) scale(0.4)  translateY(0px);   opacity: 0; filter: brightness(2.5); }
    12%  { transform: translate(-50%, -50%) scale(1.55) translateY(-14px); opacity: 1; filter: brightness(1.8); }
    30%  { transform: translate(-50%, -50%) scale(1.20) translateY(-22px); opacity: 1; }
    100% { transform: translate(-50%, -50%) scale(0.95) translateY(-64px); opacity: 0; }
  }
</style>
