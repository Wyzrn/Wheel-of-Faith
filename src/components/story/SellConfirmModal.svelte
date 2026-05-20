<script lang="ts">
  import type { StoryRosterEntry } from '$lib/story/types'
  import { getGemValue } from '$lib/story/shards'
  import TierBadge from '../TierBadge.svelte'

  let { entry, onConfirm, onCancel }: {
    entry: StoryRosterEntry
    onConfirm: () => void
    onCancel: () => void
  } = $props()

  let value = $derived(getGemValue(entry.overallTier))

  // Focus trap between the two buttons
  let keepBtn = $state<HTMLButtonElement | null>(null)
  let confirmBtn = $state<HTMLButtonElement | null>(null)

  function handleBackdropClick() {
    onCancel()
  }

  function handleDialogClick(e: MouseEvent) {
    e.stopPropagation()
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onCancel()
      return
    }
    // Tab trap
    if (e.key === 'Tab') {
      if (!keepBtn || !confirmBtn) return
      if (e.shiftKey) {
        if (document.activeElement === keepBtn) {
          e.preventDefault()
          confirmBtn.focus()
        }
      } else {
        if (document.activeElement === confirmBtn) {
          e.preventDefault()
          keepBtn.focus()
        }
      }
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Backdrop -->
<div
  class="fixed inset-0 z-50 flex items-center justify-center px-4"
  style="background: rgba(7,7,13,0.72); backdrop-filter: blur(8px);"
  onclick={handleBackdropClick}
  role="dialog"
  aria-modal="true"
  aria-label="Sell character confirmation"
>
  <!-- Dialog panel -->
  <div
    class="obsidian-slab w-80 rounded-xl p-6 flex flex-col gap-4"
    style="
      border: 1px solid rgba(255,180,171,0.25);
      animation: popIn 180ms ease-out;
    "
    onclick={handleDialogClick}
  >
    <!-- Warning icon -->
    <div class="flex justify-center">
      <span class="material-symbols-outlined" style="font-size: 24px; color: var(--color-error); font-variation-settings: 'FILL' 1;">warning</span>
    </div>

    <!-- Heading -->
    <h2
      class="text-xl font-bold text-center"
      style="font-family: var(--font-cinzel); color: var(--color-on-surface);"
    >
      Sell {entry.name}?
    </h2>

    <!-- Tier note -->
    <div class="flex items-center justify-center gap-2" style="color: var(--color-on-surface-variant); font-size: 1rem;">
      <TierBadge grade={entry.overallTier} />
      <span>{entry.overallTier}</span>
    </div>

    <!-- Gem value -->
    <p class="text-base text-center" style="color: var(--color-on-surface-variant);">
      You will receive <span style="color: #34d399; font-weight: 700;">{value.toLocaleString()}</span> gems
    </p>

    <!-- Warning line -->
    <p
      class="text-sm text-center font-mono"
      style="color: var(--color-error);"
    >
      This action cannot be undone.
    </p>

    <!-- Buttons -->
    <div class="flex gap-3">
      <button
        bind:this={keepBtn}
        class="flex-1 rounded-lg py-2.5 text-sm font-bold font-mono"
        style="
          background: transparent;
          border: 1px solid rgba(255,223,150,0.2);
          color: var(--color-on-surface-variant);
          cursor: pointer;
          transition: border-color 120ms;
        "
        onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,223,150,0.4)'; }}
        onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,223,150,0.2)'; }}
        onclick={onCancel}
      >
        Keep Character
      </button>
      <button
        bind:this={confirmBtn}
        class="flex-1 metal-stamp-crimson rounded-lg py-2.5 text-sm font-bold font-mono"
        style="color: #ffb4ab;"
        onclick={onConfirm}
      >
        Confirm Sell
      </button>
    </div>
  </div>
</div>
