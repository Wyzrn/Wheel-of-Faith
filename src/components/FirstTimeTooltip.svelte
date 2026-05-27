<script lang="ts">
  // One-shot "first time hint" tooltip. Keyed by a unique localStorage
  // flag — once dismissed (or after first appearance), never shows again
  // for this device. Used for the race spin hint, but generic enough for
  // any future onboarding cue. Position is absolute relative to a parent
  // with position:relative.

  import { onMount } from 'svelte'

  let { storageKey, title, body, accentColor = '#f0c040', placement = 'top', visibleAfterMs = 250 }: {
    storageKey: string
    title: string
    body: string
    accentColor?: string
    // 'top' positions above the parent, 'bottom' below.
    placement?: 'top' | 'bottom'
    visibleAfterMs?: number
  } = $props()

  let visible = $state(false)
  let mounted = $state(false)

  function alreadySeen(): boolean {
    if (typeof localStorage === 'undefined') return true
    try { return localStorage.getItem(storageKey) === '1' } catch { return true }
  }
  function markSeen() {
    if (typeof localStorage === 'undefined') return
    try { localStorage.setItem(storageKey, '1') } catch { /* private mode */ }
  }
  function dismiss() {
    visible = false
    markSeen()
  }

  onMount(() => {
    mounted = true
    if (alreadySeen()) return
    const t = setTimeout(() => { visible = true }, visibleAfterMs)
    return () => clearTimeout(t)
  })
</script>

{#if mounted && visible}
  <button
    type="button"
    class="ftt-card ftt-{placement}"
    style="--accent: {accentColor};"
    onclick={dismiss}
    aria-label="Dismiss tooltip"
  >
    <span class="ftt-pulse" aria-hidden="true"></span>
    <div class="ftt-content">
      <p class="ftt-title">{title}</p>
      <p class="ftt-body">{body}</p>
      <p class="ftt-tap">Tap to dismiss</p>
    </div>
    <span class="ftt-arrow ftt-arrow-{placement}" aria-hidden="true"></span>
  </button>
{/if}

<style>
  .ftt-card {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    width: max(220px, min(86vw, 320px));
    padding: 10px 14px;
    background: linear-gradient(180deg, rgba(20, 17, 36, 0.97) 0%, rgba(10, 9, 22, 0.97) 100%);
    border: 1px solid color-mix(in srgb, var(--accent) 70%, transparent);
    border-radius: 10px;
    box-shadow:
      0 0 20px color-mix(in srgb, var(--accent) 35%, transparent),
      0 8px 24px rgba(0,0,0,0.6);
    color: #ffdf96;
    text-align: left;
    cursor: pointer;
    z-index: 40;
    animation: fttFadeIn 0.4s cubic-bezier(0.22, 0.85, 0.3, 1) both;
  }
  .ftt-top    { bottom: calc(100% + 14px); }
  .ftt-bottom { top:    calc(100% + 14px); }

  .ftt-content { position: relative; }
  .ftt-title {
    font-family: 'Cinzel', serif;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.06em;
    margin: 0 0 4px 0;
    color: var(--accent);
  }
  .ftt-body {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    line-height: 1.4;
    margin: 0;
    color: #d2c5ae;
  }
  .ftt-tap {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #9a907b;
    margin: 6px 0 0 0;
  }

  .ftt-pulse {
    position: absolute;
    inset: -1px;
    border-radius: 10px;
    border: 1px solid var(--accent);
    opacity: 0;
    animation: fttPulse 2.6s ease-in-out infinite;
    pointer-events: none;
  }

  .ftt-arrow {
    position: absolute;
    left: 50%;
    width: 12px;
    height: 12px;
    background: linear-gradient(135deg, rgba(20, 17, 36, 0.97), rgba(10, 9, 22, 0.97));
    border-right: 1px solid color-mix(in srgb, var(--accent) 70%, transparent);
    border-bottom: 1px solid color-mix(in srgb, var(--accent) 70%, transparent);
  }
  .ftt-arrow-top    { bottom: -7px; transform: translateX(-50%) rotate(45deg); }
  .ftt-arrow-bottom { top: -7px;    transform: translateX(-50%) rotate(-135deg); }

  @keyframes fttFadeIn {
    0%   { opacity: 0; transform: translateX(-50%) translateY(4px) scale(0.96); }
    100% { opacity: 1; transform: translateX(-50%) translateY(0)   scale(1); }
  }
  @keyframes fttPulse {
    0%, 100% { opacity: 0; transform: scale(1); }
    50%      { opacity: 0.7; transform: scale(1.05); }
  }
  @media (prefers-reduced-motion: reduce) {
    .ftt-card  { animation: none; }
    .ftt-pulse { animation: none; }
  }
</style>
