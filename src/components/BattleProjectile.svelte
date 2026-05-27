<!--
  BattleProjectile.svelte — A single VFX projectile that travels from an
  attacker's anchor coords to a target's anchor coords, then fires an
  onImpact callback so the parent can spawn the impact burst + damage
  number at the target.

  Visual: a comet-shaped element (elongated rectangle with a radial-gradient
  head + tapered trail) that rotates to face the direction of travel and
  translates from start to end. CSS-keyframe driven for GPU acceleration.

  Higher grades scale the head + glow up so a God-tier projectile reads
  visibly different from an F-tier one.
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte'

  interface Props {
    startX: number
    startY: number
    endX: number
    endY: number
    color?: string
    gradeIdx?: number         // 0..9 (F..God) — see AttackFX
    durationMs?: number       // travel time
    headSize?: number         // px diameter of the head at base scale
    onImpact?: () => void
  }
  let {
    startX, startY, endX, endY,
    color = '#fde047', gradeIdx = 3, durationMs = 450,
    headSize = 22, onImpact,
  }: Props = $props()

  // Distance + angle from start → end. We render a horizontal comet
  // (head on the right, trail on the left) and rotate the whole element
  // so the head points at the target.
  const dx = endX - startX
  const dy = endY - startY
  const distance = Math.max(8, Math.sqrt(dx * dx + dy * dy))
  const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI

  // Grade-scaled visual intensity. F: 0.8x, God: 2.1x.
  const intensity = 1 + Math.max(0, gradeIdx - 3) * 0.18
  const head = headSize * intensity
  const trail = Math.min(180, 60 + gradeIdx * 14)

  let timer: ReturnType<typeof setTimeout> | null = null
  onMount(() => { timer = setTimeout(() => onImpact?.(), durationMs) })
  onDestroy(() => { if (timer) clearTimeout(timer) })
</script>

<!-- Anchored inside the BattleArena's `.ba-wrapper` (position: relative)
     so the coords are wrapper-local pixels, not viewport pixels. This is
     the new positioning model — see the comment in BattleArena.svelte.

     The anchor translates by the SIGNED delta (dx, dy) rather than the
     positive distance, so team-2 attacks (which fly right-to-left) move
     in the correct direction. The inner .proj-comet handles facing via
     a separate rotation. -->
<div class="proj-anchor"
  style="position: absolute; left: {startX}px; top: {startY}px;
         --dx: {dx}px; --dy: {dy}px; --dur: {durationMs}ms;
         z-index: 28; pointer-events: none;">
  <div class="proj-comet"
    style="--color: {color}; --head: {head}px; --trail: {trail}px;
           transform: rotate({angleDeg}deg);">
    <!-- Trail (extends backward from head) -->
    <div class="proj-trail"
      style="width: var(--trail); height: calc(var(--head) * 0.55);
             background: linear-gradient(to right, transparent 0%,
                                         {color}00 5%, {color}55 60%, {color}cc 95%, {color} 100%);"></div>
    <!-- Head (radial glow) -->
    <div class="proj-head"
      style="width: var(--head); height: var(--head);
             background: radial-gradient(circle, {color} 0%, {color} 35%, {color}aa 60%, transparent 85%);
             box-shadow: 0 0 calc(var(--head) * 0.9) {color},
                         0 0 calc(var(--head) * 2.2) {color}88,
                         0 0 calc(var(--head) * 3.6) {color}44;"></div>
  </div>
</div>

<style>
  /* Anchor translates from (0,0) to (dx, dy) in WORLD coords — so the
     trajectory always lands on the target, regardless of attacker side.
     The inner .proj-comet is rotated to face the target so the head
     points the right way along the path. */
  @keyframes proj-fly {
    0%   { transform: translate(0, 0)                          scale(0.6); opacity: 0.0; }
    8%   { opacity: 1.0; }
    100% { transform: translate(var(--dx), var(--dy))          scale(1.05); opacity: 1.0; }
  }
  .proj-anchor {
    width: 0; height: 0;
    animation: proj-fly var(--dur) cubic-bezier(0.42, 0, 0.58, 1) forwards;
    transform-origin: 0 0;
    will-change: transform, opacity;
  }
  .proj-comet {
    position: relative;
    display: flex;
    align-items: center;
    transform-origin: 0 50%;
  }
  .proj-trail {
    position: absolute;
    right: calc(var(--head) * 0.35);  /* tuck trail behind head */
    top: 50%;
    transform: translateY(-50%);
    border-radius: 999px;
    filter: blur(1.5px);
  }
  .proj-head {
    position: relative;
    border-radius: 50%;
    transform: translateX(calc(var(--head) * -0.5));
    filter: brightness(1.4);
  }
</style>
