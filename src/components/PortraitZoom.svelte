<!--
  PortraitZoom.svelte — fullscreen click-to-zoom overlay for character
  portraits. Used by CharacterCard and the BattleArena fighter sigil.

  Behavior:
    • Click anywhere on the backdrop (or press Escape) → close.
    • Background scroll is locked while open.
    • Fade in/out + scale animation; respects prefers-reduced-motion.
    • Plain <img>, no preloading magic — the caller has already loaded the
      image inline (the card/battle thumbnail uses the same URL), so the
      browser cache makes this near-instant.
-->
<script lang="ts">
  let { src, alt, onClose }: {
    src: string
    alt: string
    onClose: () => void
  } = $props()

  // Lock body scroll while the overlay is mounted. Mirrors the pattern in
  // routes/story/+page.svelte:251 so behavior is consistent with the
  // character-sheet popup.
  $effect(() => {
    if (typeof document === 'undefined') return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  })

  // Escape closes — keyboard parity with the click-backdrop close.
  $effect(() => {
    if (typeof window === 'undefined') return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Backdrop click closes, but clicks on the image itself should NOT close
  // (so a user dragging to inspect doesn't accidentally dismiss). Stop
  // propagation on the inner image wrapper.
  function onBackdropClick() { onClose() }
  function onImageClick(e: MouseEvent) { e.stopPropagation() }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="portrait-zoom-backdrop" onclick={onBackdropClick} role="dialog" aria-modal="true" aria-label="Character portrait">
  <button class="portrait-zoom-close" onclick={onClose} aria-label="Close portrait">
    <span class="material-symbols-outlined" style="font-size: 22px;">close</span>
  </button>
  <img class="portrait-zoom-img" {src} {alt} onclick={onImageClick} draggable="false" />
</div>

<style>
  .portrait-zoom-backdrop {
    position: fixed; inset: 0;
    z-index: 9999;
    background: rgba(8, 6, 14, 0.92);
    display: flex; align-items: center; justify-content: center;
    padding: 24px;
    cursor: zoom-out;
    animation: pz-fade-in 180ms ease-out;
    backdrop-filter: blur(8px);
  }
  .portrait-zoom-img {
    max-width: min(90vw, 90vh);
    max-height: min(90vw, 90vh);
    aspect-ratio: 1;
    object-fit: contain;
    border-radius: 12px;
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.7), 0 0 60px rgba(240, 192, 82, 0.15);
    cursor: default;
    animation: pz-zoom-in 200ms cubic-bezier(0.16, 1, 0.3, 1);
    user-select: none;
  }
  .portrait-zoom-close {
    position: absolute; top: 18px; right: 18px;
    width: 38px; height: 38px;
    border-radius: 999px;
    background: rgba(20, 17, 26, 0.85);
    border: 1px solid rgba(240, 192, 82, 0.35);
    color: #ffdf96;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    transition: background 120ms, transform 120ms;
  }
  .portrait-zoom-close:hover { background: rgba(40, 32, 50, 0.95); transform: scale(1.08); }
  .portrait-zoom-close:active { transform: scale(0.95); }

  @keyframes pz-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes pz-zoom-in {
    from { opacity: 0; transform: scale(0.85); }
    to   { opacity: 1; transform: scale(1); }
  }
  @media (prefers-reduced-motion: reduce) {
    .portrait-zoom-backdrop, .portrait-zoom-img { animation: none; }
  }
</style>
