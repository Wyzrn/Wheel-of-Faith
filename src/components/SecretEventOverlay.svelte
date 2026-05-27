<script lang="ts">
  // Cinematic interrupt for secret events. Mounted by the spin controller
  // when rollSecretEvent() returns an event id. Holds a screen-takeover
  // banner + flavour line + bespoke colour for ~2.5s before signalling
  // completion via onDismiss so the spin queue can resume.
  //
  // Same portal pattern as LandingCelebration so the overlay escapes any
  // parent stacking context.
  import { onMount } from 'svelte'
  import type { SecretEventId } from '$lib/game/secretEvents'
  import { getEventDef } from '$lib/game/secretEvents'

  let { eventId, onDismiss }: {
    eventId: SecretEventId
    onDismiss: () => void
  } = $props()

  const def = $derived(getEventDef(eventId))

  function portal(node: HTMLElement) {
    if (typeof document === 'undefined') return
    document.body.appendChild(node)
    return { destroy() { try { node.remove() } catch { /* already removed */ } } }
  }

  // Auto-dismiss after the cinematic window. Player can also tap to skip.
  let visible = $state(true)
  onMount(() => {
    const t = setTimeout(() => {
      visible = false
      setTimeout(onDismiss, 280)  // brief fade-out before resume
    }, 2600)
    return () => clearTimeout(t)
  })

  function skip() {
    visible = false
    setTimeout(onDismiss, 80)
  }
</script>

{#if def && visible}
  <button
    use:portal
    class="se-root"
    style="--accent: {def.accent}"
    onclick={skip}
    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') skip() }}
    aria-label="Dismiss event"
  >
    <div class="se-vignette"></div>
    <div class="se-glow"></div>
    <div class="se-content">
      <p class="se-flavor">Secret Event</p>
      <h1 class="se-banner">{def.banner}</h1>
      <p class="se-sub">{def.flavor}</p>
    </div>
  </button>
{/if}

<style>
  .se-root {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(7, 7, 13, 0.92);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    cursor: pointer;
    border: none;
    color: var(--accent);
    animation: seFadeIn 0.32s ease-out forwards;
  }
  .se-vignette {
    position: absolute;
    inset: 0;
    box-shadow: inset 0 0 220px var(--accent);
    opacity: 0.42;
    pointer-events: none;
  }
  .se-glow {
    position: absolute;
    width: 540px; height: 540px;
    border-radius: 50%;
    background: radial-gradient(circle, var(--accent) 0%, transparent 65%);
    filter: blur(48px);
    opacity: 0.65;
    animation: sePulse 2.4s ease-in-out infinite;
    pointer-events: none;
  }
  .se-content {
    position: relative;
    text-align: center;
    padding: 0 32px;
    animation: seSlide 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }
  .se-flavor {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    letter-spacing: 0.4em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.55);
    margin-bottom: 10px;
  }
  .se-banner {
    font-family: 'Cinzel', serif;
    font-size: clamp(2.4rem, 9vw, 5rem);
    font-weight: 900;
    letter-spacing: 0.12em;
    color: var(--accent);
    text-shadow:
      0 0 32px var(--accent),
      0 0 84px var(--accent),
      0 4px 0 rgba(0,0,0,0.5);
    margin-bottom: 14px;
    animation: seBannerBreak 0.55s ease-out;
  }
  .se-sub {
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    letter-spacing: 0.18em;
    color: rgba(255, 255, 255, 0.78);
    text-transform: uppercase;
  }
  @keyframes seFadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes seSlide {
    from { transform: translateY(-8px) scale(0.94); opacity: 0; filter: blur(8px); }
    to   { transform: translateY(0) scale(1);       opacity: 1; filter: blur(0);  }
  }
  @keyframes seBannerBreak {
    0%   { transform: scale(0.5); opacity: 0; filter: blur(14px); }
    55%  { transform: scale(1.08); filter: blur(0); }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes sePulse {
    0%, 100% { transform: scale(1);   opacity: 0.65; }
    50%       { transform: scale(1.18); opacity: 0.95; }
  }
  @media (prefers-reduced-motion: reduce) {
    .se-content, .se-banner, .se-glow { animation-duration: 0.01ms !important; }
  }
</style>
