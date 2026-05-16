<script lang="ts">
  import { onMount } from 'svelte'
  import { gsap } from 'gsap'
  import { slicePath, weightedSegmentAngles } from '$lib/game/geometry'
  import { weightedRandom } from '$lib/game/random'
  import type { WeightedSegment, SpinStatus } from '$lib/session/types'

  const SVG_SIZE = 500
  const CENTER = SVG_SIZE / 2          // 250
  const SVG_CENTER = `${CENTER} ${CENTER}`
  const WHEEL_RADIUS = 230
  const POINTER_SIZE = 24

  const COLORS = ['#E63946','#457B9D','#2A9D8F','#E9C46A','#F4A261','#264653','#6A0572','#0077B6']

  let { segments, onSpinComplete, categoryHue = undefined }: {
    segments: WeightedSegment[]
    onSpinComplete: (resultIndex: number, resultLabel: string) => void
    categoryHue?: number
  } = $props()

  let spinStatus = $state<SpinStatus>('IDLE')
  let currentRotation = $state(0)
  let lastResult = $state<{ index: number; label: string } | null>(null)

  let canSpin = $derived(spinStatus === 'IDLE')
  let isRevealed = $derived(spinStatus === 'REVEALED')
  // For display: dimmed segments get a small minimum weight so they're visible as thin slices.
  // weightedRandom still uses the original segments (dimmed weight=0, never selectable).
  let displaySegments = $derived(segments.map(s => s.dimmed ? { ...s, weight: Math.max(s.weight, 1) } : s))
  let segmentAngles = $derived(weightedSegmentAngles(displaySegments))
  let maxSegmentWeight = $derived(Math.max(...segments.filter(s => !s.dimmed).map(s => s.weight), 1))

  let wheelGroupEl: SVGGElement
  let ctx: gsap.Context

  onMount(() => {
    ctx = gsap.context(() => {}, wheelGroupEl)
    return () => ctx.revert()
  })

  function handleSpin() {
    if (spinStatus !== 'IDLE') return

    const resultIndex = weightedRandom(segments)
    const segMid = segmentAngles[resultIndex].midDeg
    const currentMod = currentRotation % 360
    const delta = ((360 - segMid) - currentMod + 360) % 360
    const extraSpins = 4 + Math.floor(Math.random() * 5) // 4–8 full rotations, varies each spin
    const targetAngle = currentRotation + (extraSpins * 360) + delta

    spinStatus = 'SPINNING'

    gsap.to(wheelGroupEl, {
      rotation: targetAngle,
      duration: 3.5 + Math.random() * 1.5, // 3.5–5s, feels different each time
      ease: 'power4.out',
      svgOrigin: SVG_CENTER,
      force3D: true,
      onComplete: () => {
        currentRotation = targetAngle
        lastResult = { index: resultIndex, label: segments[resultIndex].label }
        spinStatus = 'LANDED'
        onSpinComplete(resultIndex, segments[resultIndex].label)
        setTimeout(() => { spinStatus = 'REVEALED' }, 500)
      }
    })
  }
</script>

<div class="flex flex-col items-center gap-5 w-full mx-auto select-none">

  <!-- Wheel + glow wrapper -->
  <div class="w-full max-w-lg" style="filter: drop-shadow(0 0 28px rgba(0,0,0,0.92)) drop-shadow(0 0 14px rgba(240,192,64,0.22));">
    <svg
      width={SVG_SIZE}
      height={SVG_SIZE}
      viewBox="0 0 {SVG_SIZE} {SVG_SIZE}"
      class="w-full"
      style="overflow: visible;"
      aria-label="Spinning wheel"
      role="img"
    >
      <defs>
        <linearGradient id="pointerGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#9a907b" />
          <stop offset="45%" stop-color="#ffdf96" />
          <stop offset="100%" stop-color="#f0c040" />
        </linearGradient>
        <radialGradient id="hubGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#1f1f28" />
          <stop offset="100%" stop-color="#0d0d16" />
        </radialGradient>
        <radialGradient id="vignetteGrad" cx="50%" cy="50%" r="50%">
          <stop offset="65%" stop-color="transparent" />
          <stop offset="100%" stop-color="rgba(0,0,0,0.45)" />
        </radialGradient>
      </defs>

      <!-- Outer decorative gold rings -->
      <circle cx={CENTER} cy={CENTER} r={WHEEL_RADIUS + 12} fill="none" stroke="#f0c040" stroke-width="0.5" opacity="0.2" />
      <circle cx={CENTER} cy={CENTER} r={WHEEL_RADIUS + 6}  fill="none" stroke="#f0c040" stroke-width="1.5" opacity="0.55" />
      <circle cx={CENTER} cy={CENTER} r={WHEEL_RADIUS + 3}  fill="none" stroke="#ffdf96" stroke-width="0.5" opacity="0.3" />

      <!-- Rotating wheel group -->
      <g bind:this={wheelGroupEl}>
        {#each segmentAngles as seg, i}
          {@const isDimmed = segments[i]?.dimmed === true}
          {@const segWeight = isDimmed ? 1 : (segments[i]?.weight ?? 1)}
          {@const lightness = isDimmed ? 12 : (17 + 33 * (segWeight / maxSegmentWeight))}
          {@const saturation = isDimmed ? 0 : (50 + 20 * (segWeight / maxSegmentWeight))}
          {@const hue = categoryHue !== undefined ? categoryHue : (i * 47) % 360}
          {@const color = isDimmed ? `hsl(0, 0%, ${lightness}%)` : (segments[i]?.color ?? `hsl(${hue}, ${saturation}%, ${lightness}%)`)}
          {@const arcSpan = seg.endDeg - seg.startDeg}
          {@const fontSize = arcSpan >= 6 ? Math.max(7, Math.min(13, arcSpan * 0.42)) : 0}
          {@const tx = CENTER + WHEEL_RADIUS * 0.65 * Math.cos((seg.midDeg - 90) * Math.PI / 180)}
          {@const ty = CENTER + WHEEL_RADIUS * 0.65 * Math.sin((seg.midDeg - 90) * Math.PI / 180)}
          {@const textRotation = seg.midDeg <= 180 ? seg.midDeg - 90 : seg.midDeg + 90}
          {@const arcLength = WHEEL_RADIUS * 0.65 * (arcSpan * Math.PI / 180)}
          {@const maxChars = Math.max(3, Math.floor(arcLength / (fontSize * 0.58)))}
          {@const rawLabel = segments[i]?.label ?? ''}
          {@const displayLabel = rawLabel.length > maxChars ? rawLabel.slice(0, maxChars - 1) + '…' : rawLabel}
          <path
            d={slicePath(CENTER, CENTER, WHEEL_RADIUS, seg.startDeg, seg.endDeg)}
            fill={color}
            stroke="rgba(0,0,0,0.38)"
            stroke-width="0.75"
            opacity={isDimmed ? 0.45 : 1}
          />
          {#if isRevealed && lastResult?.index === i}
            <path
              d={slicePath(CENTER, CENTER, WHEEL_RADIUS, seg.startDeg, seg.endDeg)}
              fill="rgba(240,192,64,0.16)"
              stroke="#f0c040"
              stroke-width="2.5"
            />
          {/if}
          {#if fontSize > 0}
            <text
              x={tx}
              y={ty}
              text-anchor="middle"
              dominant-baseline="middle"
              fill={isDimmed ? 'rgba(255,255,255,0.22)' : (isRevealed && lastResult?.index === i ? '#ffdf96' : 'rgba(255,255,255,0.88)')}
              font-size={fontSize}
              font-weight="600"
              font-family="Inter, sans-serif"
              transform={`rotate(${textRotation}, ${tx}, ${ty})`}
            >{displayLabel}</text>
          {/if}
        {/each}
      </g>

      <!-- Vignette overlay (non-rotating) -->
      <circle cx={CENTER} cy={CENTER} r={WHEEL_RADIUS} fill="url(#vignetteGrad)" />

      <!-- Hub decoration (non-rotating) -->
      <circle cx={CENTER} cy={CENTER} r="38" fill="url(#hubGrad)" />
      <circle cx={CENTER} cy={CENTER} r="36" fill="none" stroke="#f0c040" stroke-width="1.5" opacity="0.85" />
      <circle cx={CENTER} cy={CENTER} r="28" fill="none" stroke="#f0c040" stroke-width="0.5" opacity="0.4" />
      <circle cx={CENTER} cy={CENTER} r="18" fill="none" stroke="#9a907b" stroke-width="0.5" opacity="0.45" />
      <circle cx={CENTER} cy={CENTER} r="9"  fill="#f0c040" opacity="0.75" />
      <circle cx={CENTER} cy={CENTER} r="4.5" fill="#ffdf96" />

      <!-- Dagger pointer (fixed, non-rotating) -->
      <!-- Blade tip: (CENTER, CENTER - WHEEL_RADIUS - 3); base: goes upward -->
      <polygon
        points="{CENTER},{CENTER - WHEEL_RADIUS - 3} {CENTER - 13},{CENTER - WHEEL_RADIUS - POINTER_SIZE - 10} {CENTER + 13},{CENTER - WHEEL_RADIUS - POINTER_SIZE - 10}"
        fill="url(#pointerGrad)"
        stroke="#9a907b"
        stroke-width="0.5"
      />
      <!-- Blade spine highlight -->
      <line
        x1="{CENTER}" y1="{CENTER - WHEEL_RADIUS - 3}"
        x2="{CENTER}" y2="{CENTER - WHEEL_RADIUS - POINTER_SIZE - 10}"
        stroke="rgba(255,255,255,0.45)"
        stroke-width="1.5"
        stroke-linecap="round"
      />
      <!-- Crossguard -->
      <rect
        x="{CENTER - 17}" y="{CENTER - WHEEL_RADIUS - POINTER_SIZE - 12}"
        width="34" height="5" rx="2.5"
        fill="#f0c040"
      />
    </svg>
  </div>

  <!-- Spin button -->
  <button
    onclick={handleSpin}
    disabled={!canSpin}
    class="px-10 py-3 rounded-lg text-sm tracking-[0.2em] uppercase transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
    style="
      font-family: 'Cinzel', serif;
      font-weight: 700;
      color: {canSpin ? '#ffdf96' : '#9a907b'};
      background: linear-gradient(135deg, #1c1a2a, #13121c, #1c1a2a);
      border: 1px solid {canSpin ? '#f0c040' : '#4e4635'};
      box-shadow: {canSpin ? '0 0 0 1px rgba(240,192,64,0.07) inset, 0 0 26px rgba(240,192,64,0.14)' : 'none'};
    "
  >
    {spinStatus === 'IDLE' ? 'Spin Fate' : spinStatus === 'SPINNING' ? 'Spinning…' : 'Spun'}
  </button>

</div>
