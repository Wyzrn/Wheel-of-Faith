<script lang="ts">
  import { tierToCssVar } from '$lib/game/tierColor'
  import type { TierGrade } from '$lib/game/scoreTier'

  let { grade, score, hero = false }: { grade: TierGrade; score?: number; hero?: boolean } = $props()

  let bgColor = $derived(tierToCssVar(grade))
  let textColor = $derived(grade === 'God' ? '#1a1a1a' : 'white')
</script>

{#if hero}
  <div class="rounded-xl p-6 text-center w-full" style="background-color: {bgColor}; color: {textColor}">
    <div class="text-7xl font-bold leading-none">{grade}</div>
    {#if score !== undefined}
      <div class="text-sm text-gray-400 mt-1">{score} / 100</div>
    {/if}
  </div>
{:else}
  <span
    class="inline-flex items-center justify-center rounded px-2 py-0.5 text-xs font-bold w-12 h-6"
    style="background-color: {bgColor}; color: {textColor}"
  >{grade}</span>
{/if}
