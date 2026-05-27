<script lang="ts">
  import { tierToCssVar } from '$lib/game/tierColor'
  import type { TierGrade } from '$lib/game/scoreTier'
  import { normalizeLegacyDisplayLabel } from '$lib/game/scoreTier'
  import TierGlossary from './TierGlossary.svelte'

  let {
    grade, score, hero = false, displayLabel = undefined,
    interactive = true,
  }: {
    grade: TierGrade
    score?: number
    hero?: boolean
    displayLabel?: string
    // When true (default), clicking the badge opens the tier glossary.
    // Set false in places where the parent already owns click semantics
    // (e.g. a badge inside a clickable card).
    interactive?: boolean
  } = $props()

  let bgColor = $derived(tierToCssVar(grade))
  let textColor = $derived(grade === 'Godly' ? '#1a1a1a' : 'white')
  let label = $derived(normalizeLegacyDisplayLabel(displayLabel) ?? grade)
  let glossaryOpen = $state(false)

  // Stop the badge click from bubbling to parent click handlers so the
  // glossary popup doesn't also navigate or expand cards underneath.
  function openGlossary(e: MouseEvent | KeyboardEvent) {
    e.stopPropagation()
    glossaryOpen = true
  }
</script>

{#if hero}
  <div
    class="rounded-xl p-6 text-center w-full {interactive ? 'cursor-pointer' : ''}"
    style="background-color: {bgColor}; color: {textColor}"
    onclick={interactive ? openGlossary : undefined}
    role={interactive ? 'button' : undefined}
    tabindex={interactive ? 0 : undefined}
    onkeydown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openGlossary(e) } } : undefined}
    title={interactive ? 'View tier ladder' : undefined}
  >
    <div class="font-bold leading-none" style="font-size: clamp(2rem, 8vw, 4.5rem);">{label}</div>
    {#if score !== undefined}
      <div class="text-sm text-gray-400 mt-1">{score} / 185</div>
    {/if}
  </div>
{:else}
  <span
    class="inline-flex items-center justify-center rounded px-2 py-0.5 text-xs font-bold h-6 {interactive ? 'cursor-pointer transition-transform active:scale-95' : ''}"
    style="background-color: {bgColor}; color: {textColor}; min-width: 3rem;"
    onclick={interactive ? openGlossary : undefined}
    role={interactive ? 'button' : undefined}
    tabindex={interactive ? 0 : undefined}
    onkeydown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openGlossary(e) } } : undefined}
    title={interactive ? 'View tier ladder' : undefined}
  >{label}</span>
{/if}

<!-- Pop-up explainer — bound to local state, shared TierGlossary component -->
<TierGlossary bind:open={glossaryOpen} />
