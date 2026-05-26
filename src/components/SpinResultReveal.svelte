<script lang="ts">
  // Shared post-spin result reveal panel. Used by both the main game (+page.svelte)
  // and Story Mode (StorySpinView.svelte) so the post-spin feel is identical
  // across modes. Renders:
  //   • Stat tier badge (when result has tier)
  //   • Element + grade chips (when meta provided)
  //   • Ability-type badge (combat/aoe/passive/etc.)
  //   • Result label + optional category subtitle, description, stat-effect note
  //   • Optional announcement banner (bonus spin earned, etc.)
  //   • Continue CTA — fires onContinue prop
  //
  // The parent owns the lookups (racePool, ability, power/weapon/armor/enchant)
  // so this component stays dumb. Both pages share lookup data, but each emits
  // its own pre-resolved ResolvedMeta — keeps the component context-free.
  import type { SpinResult } from '$lib/session/types'
  import type { ElementType, ItemGrade } from '$lib/content/types'
  import type { TierGrade } from '$lib/game/scoreTier'
  import { normalizeLegacyDisplayLabel } from '$lib/game/scoreTier'
  import { onMount, onDestroy } from 'svelte'
  import { ELEMENT_COLORS, ELEMENT_ICONS, ITEM_GRADE_INFO } from '$lib/content/elements'
  import type { ResolvedMeta } from '$lib/spinResultMeta'
  import { settings } from '$lib/settings.svelte'

  let {
    result,
    meta = {},
    tierColor,
    announcement = null,
    continueLabel = 'Continue',
    onContinue,
    layout = 'overlay',
    categoryDisplayName = null,
  }: {
    result: SpinResult
    meta?: ResolvedMeta
    tierColor?: string | null
    announcement?: string | null
    continueLabel?: string
    onContinue: () => void
    // 'overlay' renders inside its parent's relatively-positioned container
    // (used in the wheel area). 'modal' renders fixed full-screen.
    layout?: 'overlay' | 'modal'
    categoryDisplayName?: string | null
  } = $props()

  // Pull element + grade visuals from the canonical maps
  let elColor    = $derived(meta.element ? ELEMENT_COLORS[meta.element] : '#9a907b')
  let gradeInfo  = $derived(meta.grade ? ITEM_GRADE_INFO[meta.grade] : null)
  let displayTier = $derived(normalizeLegacyDisplayLabel(result.displayLabel) ?? result.tier)
  let hasBadgeRow = $derived(!!meta.element || !!gradeInfo)

  // Auto-continue: when settings.autoContinueMs > 0, fire onContinue after that
  // delay so users who've seen the cards can plow through fast. Cancellable
  // by clicking Continue manually (the timer is cleared in onDestroy). The
  // tutorial relies on the explicit Continue tap for pacing, so we skip
  // auto-continue when the tutorial is showing a card (parents pass false).
  let autoTimer: ReturnType<typeof setTimeout> | null = null
  let countdown = $state(0)
  let countdownInterval: ReturnType<typeof setInterval> | null = null

  // Global keyboard shortcuts: Enter or Space advances the reveal; Escape also
  // works as "dismiss/continue" since there's no destructive alternative on
  // this panel. Cancelling the auto-continue timer feels right — the user is
  // engaging.
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
      // Don't trigger if the user is typing into a focused input/textarea.
      const t = e.target as HTMLElement | null
      const tag = t?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return
      e.preventDefault()
      onContinue()
    }
  }

  onMount(() => {
    if (settings.autoContinueMs > 0) {
      countdown = settings.autoContinueMs
      countdownInterval = setInterval(() => {
        countdown = Math.max(0, countdown - 100)
      }, 100)
      autoTimer = setTimeout(() => onContinue(), settings.autoContinueMs)
    }
    if (typeof window !== 'undefined') window.addEventListener('keydown', onKey)
  })
  onDestroy(() => {
    if (autoTimer) clearTimeout(autoTimer)
    if (countdownInterval) clearInterval(countdownInterval)
    if (typeof window !== 'undefined') window.removeEventListener('keydown', onKey)
  })

  // Ability type → small icon + color
  function abilityIcon(t: string): string {
    if (t === 'attack') return 'sports_martial_arts'
    if (t === 'aoe')    return 'blur_on'
    if (t === 'heal')   return 'healing'
    if (t === 'buff')   return 'trending_up'
    if (t === 'debuff') return 'trending_down'
    if (t === 'summon') return 'pets'
    if (t === 'passive')return 'auto_awesome'
    return 'flash_on'
  }
  function abilityColor(t: string): string {
    if (t === 'attack') return '#f87171'
    if (t === 'aoe')    return '#fb923c'
    if (t === 'heal')   return '#34d399'
    if (t === 'buff')   return '#a78bfa'
    if (t === 'debuff') return '#9a907b'
    if (t === 'summon') return '#48c8e0'
    if (t === 'passive')return '#7dd3fc'
    return '#f0c040'
  }
</script>

{#if layout === 'modal'}
  <div
    class="fixed inset-0 z-40 flex items-center justify-center px-4"
    style="background: rgba(7,7,13,0.88); backdrop-filter: blur(12px); animation: srrFadeIn 0.18s ease-out forwards;"
  >
    <div
      class="srr-modal-card obsidian-slab w-full max-w-sm rounded-xl p-6 text-center relative overflow-hidden"
      style="border: 1px solid {tierColor ?? '#f0c040'}55; box-shadow: 0 0 80px rgba(0,0,0,0.98), 0 0 50px {tierColor ?? '#f0c040'}22, inset 0 1px 0 rgba(255,255,255,0.04);"
    >
      <div class="noise-overlay"></div>
      <div class="absolute top-3 left-3 w-7 h-7" style="border-top: 2px solid {tierColor ?? '#f0c040'}66; border-left: 2px solid {tierColor ?? '#f0c040'}66;"></div>
      <div class="absolute top-3 right-3 w-7 h-7" style="border-top: 2px solid {tierColor ?? '#f0c040'}66; border-right: 2px solid {tierColor ?? '#f0c040'}66;"></div>
      <div class="absolute bottom-3 left-3 w-7 h-7" style="border-bottom: 2px solid {tierColor ?? '#f0c040'}66; border-left: 2px solid {tierColor ?? '#f0c040'}66;"></div>
      <div class="absolute bottom-3 right-3 w-7 h-7" style="border-bottom: 2px solid {tierColor ?? '#f0c040'}66; border-right: 2px solid {tierColor ?? '#f0c040'}66;"></div>

      <div class="relative z-10 flex flex-col items-center gap-3"
        style="animation: srrPop 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards;">
        {#if categoryDisplayName}
          <p class="font-mono text-[10px] tracking-[0.22em] uppercase" style="color: #9a907b;">{categoryDisplayName}</p>
        {/if}
        {#if displayTier && tierColor}
          <div class="px-4 py-1.5 rounded-lg" style="background: {tierColor}18; border: 1px solid {tierColor}55; box-shadow: 0 0 20px {tierColor}35;">
            <span class="font-black" style="font-family: 'Cinzel', serif; font-size: 2rem; color: {tierColor}; filter: drop-shadow(0 0 8px {tierColor}66);">{displayTier}</span>
          </div>
        {/if}
        {#if hasBadgeRow}
          <div class="flex items-center gap-2 flex-wrap justify-center">
            {#if meta.element}
              <span class="px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1"
                style="background: {elColor}22; border: 1px solid {elColor}55; color: {elColor}; font-family: 'JetBrains Mono', monospace; letter-spacing: 0.05em;">
                <img src={ELEMENT_ICONS[meta.element]} class="w-4 h-4 object-contain" alt={meta.element} style="filter: drop-shadow(0 0 3px {elColor});" />
                {meta.element}
              </span>
            {/if}
            {#if gradeInfo}
              <span class="px-2 py-0.5 rounded text-xs font-bold"
                style="background: {gradeInfo.color}22; border: 1px solid {gradeInfo.color}55; color: {gradeInfo.color}; font-family: 'JetBrains Mono', monospace; box-shadow: 0 0 8px {gradeInfo.glow}; letter-spacing: 0.05em;">
                {meta.grade} · {gradeInfo.label}
              </span>
            {/if}
          </div>
        {/if}
        {#if meta.abilityType}
          {@const ac = abilityColor(meta.abilityType)}
          <span class="flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-xs font-semibold"
            style="background: {ac}1a; border: 1px solid {ac}55; color: {ac};">
            <span class="material-symbols-outlined" style="font-size: 12px; font-variation-settings: 'FILL' 1;">{abilityIcon(meta.abilityType)}</span>
            {meta.abilityType}
          </span>
        {/if}
        <p class="font-bold leading-snug"
          style="font-family: 'Cinzel', serif; font-size: clamp(1rem, 4.5vw, 1.35rem); color: #ffdf96; max-width: 26ch;">
          {result.resultLabel}
        </p>
        {#if meta.description}
          <p class="text-xs leading-relaxed" style="color: #9a907b; max-width: 30ch; font-family: 'JetBrains Mono', monospace;">{meta.description}</p>
        {/if}
        {#if meta.statEffect}
          <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-xs"
            style="background: rgba(240,192,64,0.07); border: 1px solid rgba(240,192,64,0.18); color: #9a907b;">
            <span class="material-symbols-outlined" style="font-size: 11px; color: #f0c040; font-variation-settings: 'FILL' 1;">bolt</span>
            {meta.statEffect}
          </div>
        {/if}
        {#if announcement}
          <p class="text-sm" style="color: #a78bfa; max-width: 28ch; line-height: 1.4;">{announcement}</p>
        {/if}
        <button
          onclick={onContinue}
          data-fx="big"
          class="metal-stamp-gold mt-2 flex items-center gap-2 px-7 py-2.5 rounded-lg relative"
          style="font-family: 'Cinzel', serif; font-size: 0.85rem; letter-spacing: 0.16em; text-transform: uppercase; font-weight: 700;"
        >
          <div class="l-bracket" style="color: rgba(255,255,255,0.25);"></div>
          <span>{continueLabel}{settings.autoContinueMs > 0 && countdown > 0 ? ` · ${Math.ceil(countdown / 1000)}s` : ""}</span>
          <span class="material-symbols-outlined leading-none" style="font-size: 16px; color: #1a0e00; font-variation-settings: 'FILL' 1;">arrow_circle_right</span>
        </button>
      </div>
    </div>
  </div>
{:else}
  <!-- Overlay layout: fills parent's relatively-positioned wheel container -->
  <div
    class="absolute inset-0 flex flex-col items-center justify-center rounded-2xl z-10"
    style="background: rgba(0,0,0,0.78); backdrop-filter: blur(4px); animation: srrFadeIn 0.18s ease-out forwards;"
  >
    <div class="flex flex-col items-center gap-3 px-6 text-center"
      style="animation: srrPop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards;">
      {#if categoryDisplayName}
        <p class="font-mono text-[10px] tracking-[0.22em] uppercase" style="color: #9a907b;">{categoryDisplayName}</p>
      {/if}
      {#if displayTier && tierColor}
        <div class="px-4 py-1.5 rounded-lg" style="background: {tierColor}18; border: 1px solid {tierColor}55; box-shadow: 0 0 20px {tierColor}35;">
          <span class="font-black" style="font-family: 'Cinzel', serif; font-size: 2rem; color: {tierColor}; filter: drop-shadow(0 0 8px {tierColor}66);">{displayTier}</span>
        </div>
      {/if}
      {#if hasBadgeRow}
        <div class="flex items-center gap-2 flex-wrap justify-center">
          {#if meta.element}
            <span class="px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1"
              style="background: {elColor}22; border: 1px solid {elColor}55; color: {elColor}; font-family: 'JetBrains Mono', monospace; letter-spacing: 0.05em;">
              <img src={ELEMENT_ICONS[meta.element]} class="w-4 h-4 object-contain" alt={meta.element} style="filter: drop-shadow(0 0 3px {elColor});" />
              {meta.element}
            </span>
          {/if}
          {#if gradeInfo}
            <span class="px-2 py-0.5 rounded text-xs font-bold"
              style="background: {gradeInfo.color}22; border: 1px solid {gradeInfo.color}55; color: {gradeInfo.color}; font-family: 'JetBrains Mono', monospace; box-shadow: 0 0 8px {gradeInfo.glow}; letter-spacing: 0.05em;">
              {meta.grade} · {gradeInfo.label}
            </span>
          {/if}
        </div>
      {/if}
      {#if meta.abilityType}
        {@const ac = abilityColor(meta.abilityType)}
        <span class="flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-xs font-semibold"
          style="background: {ac}1a; border: 1px solid {ac}55; color: {ac};">
          <span class="material-symbols-outlined" style="font-size: 12px; font-variation-settings: 'FILL' 1;">{abilityIcon(meta.abilityType)}</span>
          {meta.abilityType}
        </span>
      {/if}
      <p style="font-family: 'Cinzel', serif; font-size: clamp(0.95rem, 3.5vw, 1.3rem); font-weight: 700; color: #ffdf96; line-height: 1.35; max-width: 26ch;">
        {result.resultLabel}
      </p>
      {#if meta.description}
        <p class="text-xs leading-relaxed" style="color: #9a907b; max-width: 30ch; font-family: 'JetBrains Mono', monospace;">{meta.description}</p>
      {/if}
      {#if announcement}
        <p class="text-sm" style="color: #a78bfa; max-width: 28ch; line-height: 1.4;">{announcement}</p>
      {/if}
      <button
        onclick={onContinue}
        data-fx="big"
        class="metal-stamp-gold mt-1 flex items-center gap-2 px-7 py-2.5 rounded-lg relative"
        style="font-family: 'Cinzel', serif; font-size: 0.85rem; letter-spacing: 0.16em; text-transform: uppercase; font-weight: 700;"
      >
        <div class="l-bracket" style="color: rgba(255,255,255,0.25);"></div>
        <span>{continueLabel}{settings.autoContinueMs > 0 && countdown > 0 ? ` · ${Math.ceil(countdown / 1000)}s` : ""}</span>
        <span class="material-symbols-outlined leading-none" style="font-size: 16px; color: #1a0e00; font-variation-settings: 'FILL' 1;">arrow_circle_right</span>
      </button>
    </div>
  </div>
{/if}

<style>
  @keyframes srrFadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes srrPop {
    0%   { transform: scale(0.6) translateY(20px); opacity: 0; filter: blur(8px); }
    60%  { transform: scale(1.05) translateY(-2px); opacity: 1; filter: blur(0); }
    100% { transform: scale(1) translateY(0); opacity: 1; filter: blur(0); }
  }
</style>
