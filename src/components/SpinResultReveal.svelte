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
  // Identity card payload — race + archetype lands swap the generic
  // description body for a themed perk list. When present, the panel uses
  // the card's accent color for its border/glow and hides the tier badge
  // (which is meaningless for race/archetype).
  let idCard = $derived(meta.identityCard ?? null)
  // Panel accent: identity card color when present, else tier color, else gold.
  let panelAccent = $derived(idCard?.accentColor ?? tierColor ?? '#f0c040')

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
      class:srr-id-card={!!idCard}
      style="border: 1px solid {panelAccent}55; box-shadow: 0 0 80px rgba(0,0,0,0.98), 0 0 50px {panelAccent}33, inset 0 1px 0 rgba(255,255,255,0.04);"
    >
      <div class="noise-overlay"></div>
      <div class="absolute top-3 left-3 w-7 h-7" style="border-top: 2px solid {panelAccent}66; border-left: 2px solid {panelAccent}66;"></div>
      <div class="absolute top-3 right-3 w-7 h-7" style="border-top: 2px solid {panelAccent}66; border-right: 2px solid {panelAccent}66;"></div>
      <div class="absolute bottom-3 left-3 w-7 h-7" style="border-bottom: 2px solid {panelAccent}66; border-left: 2px solid {panelAccent}66;"></div>
      <div class="absolute bottom-3 right-3 w-7 h-7" style="border-bottom: 2px solid {panelAccent}66; border-right: 2px solid {panelAccent}66;"></div>

      <div class="relative z-10 flex flex-col items-center gap-3"
        style="animation: srrPop 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards;">
        {#if categoryDisplayName}
          <p class="font-mono text-[10px] tracking-[0.22em] uppercase" style="color: #9a907b;">{categoryDisplayName}</p>
        {/if}
        {#if displayTier && tierColor && !idCard}
          <div class="px-4 py-1.5 rounded-lg" style="background: {tierColor}18; border: 1px solid {tierColor}55; box-shadow: 0 0 20px {tierColor}35;">
            <span class="font-black" style="font-family: 'Cinzel', serif; font-size: 2rem; color: {tierColor}; filter: drop-shadow(0 0 8px {tierColor}66);">{displayTier}</span>
          </div>
        {/if}
        {#if hasBadgeRow && !idCard}
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
        {#if meta.abilityType && !idCard}
          {@const ac = abilityColor(meta.abilityType)}
          <span class="flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-xs font-semibold"
            style="background: {ac}1a; border: 1px solid {ac}55; color: {ac};">
            <span class="material-symbols-outlined" style="font-size: 12px; font-variation-settings: 'FILL' 1;">{abilityIcon(meta.abilityType)}</span>
            {meta.abilityType}
          </span>
        {/if}

        <!-- Identity card chips: rarity + archetypeType + element -->
        {#if idCard}
          <div class="flex items-center gap-2 flex-wrap justify-center">
            <span class="srr-id-chip"
              style="background: {idCard.accentColor}22; border: 1px solid {idCard.accentColor}66; color: {idCard.accentColor};">
              {idCard.kind === 'race' ? 'RACE' : 'ARCHETYPE'}
            </span>
            <span class="srr-id-chip srr-id-chip-rarity"
              style="background: {idCard.accentColor}18; border: 1px solid {idCard.accentColor}44; color: #ffdf96;">
              {idCard.rarity}
            </span>
            {#if idCard.archetypeType}
              <span class="srr-id-chip"
                style="background: rgba(240,192,64,0.10); border: 1px solid rgba(240,192,64,0.30); color: #ffdf96;">
                {idCard.archetypeType}
              </span>
            {/if}
            {#if idCard.element}
              <span class="srr-id-chip flex items-center gap-1"
                style="background: {idCard.accentColor}22; border: 1px solid {idCard.accentColor}55; color: {idCard.accentColor};">
                <img src={ELEMENT_ICONS[idCard.element]} class="w-3.5 h-3.5 object-contain" alt={idCard.element} style="filter: drop-shadow(0 0 3px {idCard.accentColor});" />
                {idCard.element}
              </span>
            {/if}
          </div>
        {/if}

        <p class="srr-label font-bold leading-snug"
          style="font-family: 'Cinzel', serif; font-size: clamp(1rem, 4.5vw, 1.35rem); color: {idCard ? idCard.accentColor : '#ffdf96'}; max-width: 26ch; {idCard ? `text-shadow: 0 0 18px ${idCard.accentColor}66, 0 0 4px ${idCard.accentColor};` : ''}">
          {result.resultLabel}
        </p>

        {#if idCard}
          <p class="srr-id-desc" style="--accent: {idCard.accentColor};">
            "{idCard.description}"
          </p>

          {#if idCard.perks.length > 0}
            <ul class="srr-id-perks" style="--accent: {idCard.accentColor};">
              {#each idCard.perks as p, i}
                <li class="srr-id-perk" style="animation-delay: {520 + i * 90}ms;">
                  <span class="material-symbols-outlined srr-id-perk-icon" style="color: {idCard.accentColor};">{p.icon}</span>
                  <div class="srr-id-perk-text">
                    <span class="srr-id-perk-label">{p.label}</span>
                    {#if p.detail}<span class="srr-id-perk-detail">{p.detail}</span>{/if}
                  </div>
                </li>
              {/each}
            </ul>
          {/if}
        {:else}
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
    class:srr-id-card={!!idCard}
    style="background: rgba(0,0,0,0.78); backdrop-filter: blur(4px); animation: srrFadeIn 0.18s ease-out forwards; {idCard ? `box-shadow: inset 0 0 60px ${idCard.accentColor}33, inset 0 0 0 1px ${idCard.accentColor}66;` : ''}"
  >
    <div class="flex flex-col items-center gap-3 px-6 text-center max-h-full overflow-y-auto py-6"
      style="animation: srrPop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards;">
      {#if categoryDisplayName}
        <p class="font-mono text-[10px] tracking-[0.22em] uppercase" style="color: #9a907b;">{categoryDisplayName}</p>
      {/if}
      {#if displayTier && tierColor && !idCard}
        <div class="px-4 py-1.5 rounded-lg" style="background: {tierColor}18; border: 1px solid {tierColor}55; box-shadow: 0 0 20px {tierColor}35;">
          <span class="font-black" style="font-family: 'Cinzel', serif; font-size: 2rem; color: {tierColor}; filter: drop-shadow(0 0 8px {tierColor}66);">{displayTier}</span>
        </div>
      {/if}
      {#if hasBadgeRow && !idCard}
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
      {#if meta.abilityType && !idCard}
        {@const ac = abilityColor(meta.abilityType)}
        <span class="flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-xs font-semibold"
          style="background: {ac}1a; border: 1px solid {ac}55; color: {ac};">
          <span class="material-symbols-outlined" style="font-size: 12px; font-variation-settings: 'FILL' 1;">{abilityIcon(meta.abilityType)}</span>
          {meta.abilityType}
        </span>
      {/if}

      {#if idCard}
        <div class="flex items-center gap-2 flex-wrap justify-center">
          <span class="srr-id-chip"
            style="background: {idCard.accentColor}22; border: 1px solid {idCard.accentColor}66; color: {idCard.accentColor};">
            {idCard.kind === 'race' ? 'RACE' : 'ARCHETYPE'}
          </span>
          <span class="srr-id-chip srr-id-chip-rarity"
            style="background: {idCard.accentColor}18; border: 1px solid {idCard.accentColor}44; color: #ffdf96;">
            {idCard.rarity}
          </span>
          {#if idCard.archetypeType}
            <span class="srr-id-chip"
              style="background: rgba(240,192,64,0.10); border: 1px solid rgba(240,192,64,0.30); color: #ffdf96;">
              {idCard.archetypeType}
            </span>
          {/if}
          {#if idCard.element}
            <span class="srr-id-chip flex items-center gap-1"
              style="background: {idCard.accentColor}22; border: 1px solid {idCard.accentColor}55; color: {idCard.accentColor};">
              <img src={ELEMENT_ICONS[idCard.element]} class="w-3.5 h-3.5 object-contain" alt={idCard.element} style="filter: drop-shadow(0 0 3px {idCard.accentColor});" />
              {idCard.element}
            </span>
          {/if}
        </div>
      {/if}

      <p class="srr-label" style="font-family: 'Cinzel', serif; font-size: clamp(0.95rem, 3.5vw, 1.3rem); font-weight: 700; color: {idCard ? idCard.accentColor : '#ffdf96'}; line-height: 1.35; max-width: 26ch; {idCard ? `text-shadow: 0 0 18px ${idCard.accentColor}66, 0 0 4px ${idCard.accentColor};` : ''}">
        {result.resultLabel}
      </p>

      {#if idCard}
        <p class="srr-id-desc" style="--accent: {idCard.accentColor};">
          "{idCard.description}"
        </p>
        {#if idCard.perks.length > 0}
          <ul class="srr-id-perks" style="--accent: {idCard.accentColor};">
            {#each idCard.perks as p, i}
              <li class="srr-id-perk" style="animation-delay: {520 + i * 90}ms;">
                <span class="material-symbols-outlined srr-id-perk-icon" style="color: {idCard.accentColor};">{p.icon}</span>
                <div class="srr-id-perk-text">
                  <span class="srr-id-perk-label">{p.label}</span>
                  {#if p.detail}<span class="srr-id-perk-detail">{p.detail}</span>{/if}
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      {:else if meta.description}
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
  /* Result label cascades in slightly after the rest of the panel — gives
     the eye time to see the tier badge + element + grade chips first, then
     the headline name lands as the reveal's "drop the mic" moment. */
  .srr-label {
    opacity: 0;
    transform: translateY(14px) scale(0.92);
    filter: blur(6px);
    animation: srrLabelDrop 0.7s cubic-bezier(0.22, 0.85, 0.3, 1.05) 0.42s forwards;
    will-change: transform, opacity, filter;
  }
  @keyframes srrLabelDrop {
    0%   { opacity: 0; transform: translateY(14px) scale(0.92); filter: blur(6px); }
    60%  { opacity: 1; transform: translateY(-2px) scale(1.04); filter: blur(0); }
    100% { opacity: 1; transform: translateY(0)   scale(1);    filter: blur(0); }
  }
  /* ── Identity card (race + archetype themed reveals) ───────────────────
     Replaces the standard description + statEffect lines with a perk list
     surfacing what makes this race/archetype unique. Border/glow use the
     race or archetype's element color so each one looks visually different.
  */
  .srr-id-chip {
    padding: 0.18rem 0.55rem;
    border-radius: 4px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.66rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .srr-id-chip-rarity {
    letter-spacing: 0.20em;
  }
  .srr-id-desc {
    font-family: 'Cinzel', serif;
    font-style: italic;
    font-size: 0.92rem;
    line-height: 1.45;
    color: #d6cba6;
    max-width: 30ch;
    padding: 0.45rem 0.9rem;
    border-left: 2px solid color-mix(in srgb, var(--accent) 70%, transparent);
    border-right: 2px solid color-mix(in srgb, var(--accent) 70%, transparent);
    opacity: 0;
    animation: srrIdDesc 0.55s cubic-bezier(0.22, 0.85, 0.3, 1) 0.45s forwards;
  }
  @keyframes srrIdDesc {
    0%   { opacity: 0; transform: translateY(8px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  .srr-id-perks {
    list-style: none;
    margin: 0;
    padding: 0;
    width: 100%;
    max-width: 30ch;
    display: flex;
    flex-direction: column;
    gap: 0.32rem;
  }
  .srr-id-perk {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    text-align: left;
    padding: 0.4rem 0.6rem;
    border-radius: 6px;
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--accent) 12%, transparent) 0%,
      rgba(0, 0, 0, 0.18) 100%
    );
    border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
    opacity: 0;
    transform: translateX(-10px);
    animation: srrIdPerk 0.5s cubic-bezier(0.22, 0.85, 0.3, 1) forwards;
    /* Per-item delay is inlined via animation-delay on the element. */
  }
  @keyframes srrIdPerk {
    0%   { opacity: 0; transform: translateX(-10px); }
    100% { opacity: 1; transform: translateX(0); }
  }
  .srr-id-perk-icon {
    font-size: 18px;
    flex-shrink: 0;
    font-variation-settings: 'FILL' 1;
    filter: drop-shadow(0 0 5px var(--accent));
  }
  .srr-id-perk-text {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
    min-width: 0;
    flex: 1;
  }
  .srr-id-perk-label {
    font-family: 'Cinzel', serif;
    font-weight: 700;
    font-size: 0.82rem;
    color: #ffdf96;
  }
  .srr-id-perk-detail {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.62rem;
    color: #9a907b;
    letter-spacing: 0.03em;
    margin-top: 0.08rem;
  }

  @media (prefers-reduced-motion: reduce) {
    .srr-label, .srr-id-desc, .srr-id-perk {
      animation-duration: 0.01ms !important;
      animation-delay: 0ms !important;
    }
  }
</style>
