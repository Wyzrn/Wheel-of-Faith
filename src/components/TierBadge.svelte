<script lang="ts">
  import { tierToCssVar, tierHasGradient } from '$lib/game/tierColor'
  import type { TierGrade } from '$lib/game/scoreTier'
  import { scoreTier, normalizeLegacyDisplayLabel } from '$lib/game/scoreTier'
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

  // Always prefer score-derived tier so legacy badges show the new ladder.
  // Falls back to the explicit `grade` prop when score is missing (e.g. for
  // non-stat hero badges that pass only a grade).
  let effectiveGrade = $derived(score !== undefined ? scoreTier(score) : grade)
  let useGradient = $derived(tierHasGradient(effectiveGrade))
  let gradVar = $derived(useGradient
    ? `var(--tier-${effectiveGrade.replace(/[-+]$/, '').toLowerCase()}-grad)`
    : null)
  let bgColor = $derived(tierToCssVar(effectiveGrade as TierGrade))
  // Light-coloured gradients (Godly / Primordial) need dark text; everything
  // else gets white. The plain solid 'Godly' tier kept the original override.
  let textColor = $derived(
    useGradient && /Godly|Primordial/.test(effectiveGrade) ? '#0a0612' :
    useGradient ? '#ffffff' :
    effectiveGrade === 'Godly' ? '#1a1a1a' :
    'white'
  )
  let label = $derived(normalizeLegacyDisplayLabel(displayLabel) ?? effectiveGrade)
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
    style="background: {gradVar ?? bgColor}; color: {textColor}"
    onclick={interactive ? openGlossary : undefined}
    role={interactive ? 'button' : undefined}
    tabindex={interactive ? 0 : undefined}
    onkeydown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openGlossary(e) } } : undefined}
    title={interactive ? 'View tier ladder' : undefined}
  >
    <div class="font-bold leading-none" style="font-size: clamp(2rem, 8vw, 4.5rem);">{label}</div>
    {#if score !== undefined}
      <div class="text-sm mt-1" style="color: {useGradient ? 'rgba(255,255,255,0.7)' : '#9ca3af'};">{score} / 185</div>
    {/if}
  </div>
{:else}
  <span
    class="inline-flex items-center justify-center rounded px-2 py-0.5 text-xs font-bold h-6 {interactive ? 'cursor-pointer transition-transform active:scale-95' : ''}"
    style="background: {gradVar ?? bgColor}; color: {textColor}; min-width: 3rem;"
    onclick={interactive ? openGlossary : undefined}
    role={interactive ? 'button' : undefined}
    tabindex={interactive ? 0 : undefined}
    onkeydown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openGlossary(e) } } : undefined}
    title={interactive ? 'View tier ladder' : undefined}
  >{label}</span>
{/if}

<!-- Pop-up explainer — bound to local state, shared TierGlossary component -->
<TierGlossary bind:open={glossaryOpen} />
