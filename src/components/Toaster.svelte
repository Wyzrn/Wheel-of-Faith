<script lang="ts">
  // Renders the global toast queue. Mounted once at root layout. Toasts stack
  // top-center under the nav so they don't fight with the bottom nav bar on
  // mobile, and they're click-to-dismiss for impatient users.
  import { toast } from '$lib/toast.svelte'

  const ICON: Record<string, string> = {
    success: 'check_circle',
    error:   'error',
    info:    'info',
    reward:  'diamond',
  }
  const COLOR: Record<string, string> = {
    success: '#34d399',
    error:   '#f87171',
    info:    '#5ad6ef',
    reward:  '#f0c040',
  }
</script>

<div class="toaster" aria-live="polite" aria-atomic="false">
  {#each toast.queue as t (t.id)}
    <button
      type="button"
      class="toast"
      onclick={() => toast.dismiss(t.id)}
      style="--c: {COLOR[t.kind]};"
      aria-label="Dismiss notification"
    >
      <span class="material-symbols-outlined toast-icon" style="font-variation-settings: 'FILL' 1;">{ICON[t.kind]}</span>
      <div class="toast-body">
        <p class="toast-message">{t.message}</p>
        {#if t.detail}
          <p class="toast-detail">{t.detail}</p>
        {/if}
      </div>
    </button>
  {/each}
</div>

<style>
  .toaster {
    position: fixed;
    top: 72px;
    left: 0;
    right: 0;
    z-index: 60;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 0 16px;
    pointer-events: none;
  }
  .toast {
    pointer-events: all;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: 380px;
    width: 100%;
    background: rgba(9, 9, 15, 0.96);
    backdrop-filter: blur(16px);
    border: 1px solid var(--c, #5ad6ef);
    border-radius: 10px;
    padding: 10px 14px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5), 0 0 12px var(--c, transparent);
    text-align: left;
    animation: toastSlideIn 0.24s cubic-bezier(0.34, 1.3, 0.64, 1) forwards;
  }
  .toast:active { transform: scale(0.97); }
  .toast-icon {
    font-size: 20px;
    color: var(--c);
    filter: drop-shadow(0 0 4px var(--c));
    flex-shrink: 0;
  }
  .toast-body { flex: 1; min-width: 0; }
  .toast-message {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.74rem;
    color: #e9dfeb;
    letter-spacing: 0.04em;
    line-height: 1.4;
  }
  .toast-detail {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.65rem;
    color: var(--c);
    margin-top: 2px;
    letter-spacing: 0.04em;
  }
  @keyframes toastSlideIn {
    from { transform: translateY(-12px); opacity: 0; }
    to   { transform: translateY(0);     opacity: 1; }
  }
</style>
