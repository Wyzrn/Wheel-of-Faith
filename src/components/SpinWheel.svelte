<script lang="ts">
  import { onMount } from 'svelte'
  import { gsap } from 'gsap'
  import { slicePath, equalSegmentAngles, calculateTargetAngle } from '$lib/game/geometry'
  import { weightedRandom } from '$lib/game/random'
  import type { WeightedSegment, SpinStatus } from '$lib/session/types'

  const SVG_SIZE = 400
  const SVG_CENTER = '200 200'
  const WHEEL_RADIUS = 180
  const POINTER_SIZE = 20

  const COLORS = ['#E63946','#457B9D','#2A9D8F','#E9C46A','#F4A261','#264653','#6A0572','#0077B6']

  let { segments, onSpinComplete }: {
    segments: WeightedSegment[]
    onSpinComplete: (resultIndex: number, resultLabel: string) => void
  } = $props()

  let spinStatus = $state<SpinStatus>('IDLE')
  let currentRotation = $state(0)
  let lastResult = $state<{ index: number; label: string } | null>(null)

  let canSpin = $derived(spinStatus === 'IDLE')
  let isRevealed = $derived(spinStatus === 'REVEALED')
  let segmentAngles = $derived(equalSegmentAngles(segments.length))

  let wheelGroupEl: SVGGElement
  let ctx: gsap.Context

  onMount(() => {
    ctx = gsap.context(() => {}, wheelGroupEl)
    return () => ctx.revert()
  })

  function handleSpin() {
    if (spinStatus !== 'IDLE') return

    const resultIndex = weightedRandom(segments)
    const targetAngle = calculateTargetAngle(currentRotation, resultIndex, segments.length, 5)

    spinStatus = 'SPINNING'

    gsap.to(wheelGroupEl, {
      rotation: targetAngle,
      duration: 4,
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

<div class="flex flex-col items-center gap-6 w-full max-w-sm mx-auto">
  <svg
    width={SVG_SIZE}
    height={SVG_SIZE}
    viewBox="0 0 {SVG_SIZE} {SVG_SIZE}"
    class="w-full"
    aria-label="Spinning wheel"
    role="img"
  >
    <g bind:this={wheelGroupEl}>
      {#each segmentAngles as seg, i}
        {@const color = segments[i]?.color ?? COLORS[i % COLORS.length]}
        <path
          d={slicePath(200, 200, WHEEL_RADIUS, seg.startDeg, seg.endDeg)}
          fill={color}
          stroke={isRevealed && lastResult?.index === i ? 'gold' : 'white'}
          stroke-width={isRevealed && lastResult?.index === i ? '4' : '2'}
        />
        <text
          x={200 + WHEEL_RADIUS * 0.65 * Math.cos((seg.midDeg - 90) * Math.PI / 180)}
          y={200 + WHEEL_RADIUS * 0.65 * Math.sin((seg.midDeg - 90) * Math.PI / 180)}
          text-anchor="middle"
          dominant-baseline="middle"
          fill="white"
          font-size="13"
          font-weight="600"
        >{segments[i]?.label ?? ''}</text>
      {/each}
    </g>
    <polygon
      points="{200},{200 - WHEEL_RADIUS - 5} {200 - POINTER_SIZE/2},{200 - WHEEL_RADIUS - POINTER_SIZE - 5} {200 + POINTER_SIZE/2},{200 - WHEEL_RADIUS - POINTER_SIZE - 5}"
      fill="#FF6B35"
    />
  </svg>

  <button
    onclick={handleSpin}
    disabled={!canSpin}
    class="bg-indigo-600 text-white px-8 py-3 rounded-lg text-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
  >
    {spinStatus === 'IDLE' ? 'Spin' : spinStatus}
  </button>

  {#if isRevealed && lastResult}
    <p class="text-2xl font-bold text-center">Result: {lastResult.label}</p>
  {/if}
</div>
