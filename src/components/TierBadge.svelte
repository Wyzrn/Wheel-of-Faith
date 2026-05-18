<script lang="ts">
  import { tierToCssVar } from '$lib/game/tierColor'
  import type { TierGrade } from '$lib/game/scoreTier'

  let { grade, score, hero = false, displayLabel = undefined }: {
    grade: TierGrade
    score?: number
    hero?: boolean
    displayLabel?: string
  } = $props()

  let bgColor = $derived(tierToCssVar(grade))
  let textColor = $derived(grade === 'God' ? '#1a1a1a' : 'white')
  let label = $derived(displayLabel ?? grade)
</script>

{#if hero}
  <div class="rounded-xl p-6 text-center w-full" style="background-color: {bgColor}; color: {textColor}">
    <div class="font-bold leading-none" style="font-size: clamp(2rem, 8vw, 4.5rem);">{label}</div>
    {#if score !== undefined}
      <div class="text-sm text-gray-400 mt-1">{score} / 150</div>
    {/if}
  </div>
{:else}
  <span
    class="inline-flex items-center justify-center rounded px-2 py-0.5 text-xs font-bold h-6"
    style="background-color: {bgColor}; color: {textColor}; min-width: 3rem;"
  >{label}</span>
{/if}
