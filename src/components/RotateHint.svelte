<script lang="ts">
  // Mobile landscape gate. On touch devices held in portrait, shows a
  // full-screen blocking "rotate your device" overlay with a Fullscreen
  // button — you can't play in portrait. Auto-clears the moment the device is
  // rotated to landscape. Desktop never sees it.
  import { onMount } from 'svelte'

  let show = $state(false)
  let isFullscreen = $state(false)
  let canFullscreen = $state(false)
  let isStandalone = $state(false)   // already installed as a PWA

  const mob = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches
  const portrait = () => typeof matchMedia !== 'undefined' && matchMedia('(orientation: portrait)').matches

  function update() { show = mob() && portrait() }
  function onFsChange() { isFullscreen = !!document.fullscreenElement }

  function goFullscreen() {
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>
    }
    try {
      const req = el.requestFullscreen ?? el.webkitRequestFullscreen
      req?.call(el)?.catch?.(() => {})
    } catch { /* unsupported (e.g. iOS Safari) */ }
  }

  onMount(() => {
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: unknown }
    canFullscreen = typeof (el.requestFullscreen ?? el.webkitRequestFullscreen) === 'function'
    isStandalone = matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true
    update()
    const mq = matchMedia('(orientation: portrait)')
    mq.addEventListener('change', update)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => {
      mq.removeEventListener('change', update)
      document.removeEventListener('fullscreenchange', onFsChange)
    }
  })
</script>

{#if show}
  <div class="rotate-hint">
    <div class="rotate-card">
      <span class="material-symbols-outlined rotate-icon">screen_rotation</span>
      <h2 class="rotate-title">Turn your device</h2>
      <p class="rotate-sub">Wheel of Destiny is played in landscape. Rotate your phone sideways to continue.</p>
      {#if canFullscreen && !isFullscreen}
        <div class="rotate-actions">
          <button class="rotate-btn rotate-btn-primary" onclick={goFullscreen}>
            <span class="material-symbols-outlined" style="font-size: 18px;">fullscreen</span>
            Fullscreen
          </button>
        </div>
      {:else if !canFullscreen && !isStandalone}
        <!-- iOS Safari can't do programmatic fullscreen — guide them to A2HS. -->
        <div class="rotate-a2hs">
          <p class="rotate-a2hs-title">For fullscreen on iPhone:</p>
          <p class="rotate-a2hs-step">
            <span class="material-symbols-outlined" style="font-size: 14px;">ios_share</span>
            Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>
          </p>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .rotate-hint {
    position: fixed; inset: 0; z-index: 100;
    display: flex; align-items: center; justify-content: center;
    padding: 24px calc(24px + env(safe-area-inset-right)) 24px calc(24px + env(safe-area-inset-left));
    background: radial-gradient(circle at 50% 42%, #221d2b 0%, #16121a 70%, #0c0a10 100%);
  }
  .rotate-card {
    width: 100%; max-width: 360px; text-align: center;
    display: flex; flex-direction: column; align-items: center; gap: 10px;
    padding: 28px 24px; border-radius: 20px;
    background: linear-gradient(145deg, #241f29 0%, #14111a 100%);
    border: 1px solid rgba(240,192,82,0.3);
    box-shadow: 0 18px 44px rgba(0,0,0,0.7), 0 0 28px rgba(240,192,82,0.08);
  }
  .rotate-icon {
    font-size: 56px; color: #5ad6ef;
    filter: drop-shadow(0 0 14px rgba(90,214,239,0.5));
    animation: rotate-rock 2.4s ease-in-out infinite;
  }
  @keyframes rotate-rock {
    0%, 100% { transform: rotate(0deg); }
    50%      { transform: rotate(-88deg); }
  }
  .rotate-title {
    font-family: 'Cinzel', serif; font-size: 1.3rem; font-weight: 700; color: #f0c052;
    letter-spacing: 0.08em; text-shadow: 0 0 14px rgba(240,192,82,0.35);
  }
  .rotate-sub {
    font-family: 'Inter', sans-serif; font-size: 0.85rem; line-height: 1.5; color: #bcc9cc; max-width: 30ch;
  }
  .rotate-actions { margin-top: 8px; display: flex; flex-direction: column; gap: 10px; width: 100%; }
  .rotate-btn {
    width: 100%; padding: 11px; border-radius: 12px; cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    font-family: 'Cinzel', serif; font-weight: 700; font-size: 0.82rem;
    letter-spacing: 0.1em; text-transform: uppercase; transition: filter 0.15s, transform 0.1s;
  }
  .rotate-btn:active { transform: scale(0.97); }
  .rotate-btn-primary {
    background: linear-gradient(162deg, #ecc868, #c89030 60%, #a87018);
    color: #1a0e00; border: 1px solid #d4a832;
    box-shadow: 0 6px 16px rgba(0,0,0,0.5), 0 0 16px rgba(240,192,82,0.3);
  }
  .rotate-btn-ghost {
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: #9a907b;
  }
  .rotate-a2hs {
    margin-top: 10px; padding: 10px 14px; border-radius: 12px; width: 100%;
    background: rgba(90,214,239,0.07); border: 1px solid rgba(90,214,239,0.25);
  }
  .rotate-a2hs-title {
    font-family: 'JetBrains Mono', monospace; font-size: 0.66rem; letter-spacing: 0.12em;
    text-transform: uppercase; color: rgba(90,214,239,0.8); margin-bottom: 4px;
  }
  .rotate-a2hs-step {
    font-family: 'Inter', sans-serif; font-size: 0.8rem; color: #e9dfeb;
    display: inline-flex; align-items: center; gap: 5px; flex-wrap: wrap; justify-content: center;
  }
  .rotate-a2hs-step strong { color: #5ad6ef; font-weight: 700; }
  @media (prefers-reduced-motion: reduce) { .rotate-icon { animation: none; } }
</style>
