<script lang="ts">
  import { onMount } from 'svelte'

  let shareIds = $state<string[]>([])
  let loaded = $state(false)

  onMount(() => {
    try {
      shareIds = JSON.parse(localStorage.getItem('wof_saved_chars') ?? '[]')
    } catch {
      shareIds = []
    }
    loaded = true
  })
</script>

<main class="min-h-screen" style="background: #07070d; color: #e4e1ee;">

  <!-- Nav -->
  <nav class="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-4 h-14"
    style="background: rgba(7,7,13,0.94); border-bottom: 1px solid rgba(240,192,64,0.13); backdrop-filter: blur(16px);"
  >
    <div class="flex items-center gap-2">
      <span class="material-symbols-outlined" style="color: #f0c040; font-size: 18px; font-variation-settings: 'FILL' 1;">casino</span>
      <span style="font-family: 'Cinzel', serif; font-size: 13px; font-weight: 700; color: #ffdf96; letter-spacing: 0.18em;">WHEEL OF FATE</span>
    </div>
    <a
      href="/"
      class="text-xs tracking-[0.12em] uppercase flex items-center gap-1.5 transition-colors"
      style="font-family: 'JetBrains Mono', monospace; color: #9a907b; text-decoration: none;"
    >
      <span class="material-symbols-outlined" style="font-size: 14px;">arrow_back</span>
      Menu
    </a>
  </nav>

  <div class="pt-20 pb-12 px-4 max-w-lg mx-auto">

    <!-- Header -->
    <div class="mb-8 text-center">
      <p class="text-xs tracking-[0.25em] uppercase mb-2" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Your Fates</p>
      <h1 style="font-family: 'Cinzel', serif; font-size: 1.8rem; font-weight: 700; color: #ffdf96; letter-spacing: 0.1em;">Saved Characters</h1>
    </div>

    {#if !loaded}
      <p class="text-center text-sm" style="color: #4e4635; font-style: italic;">Loading…</p>

    {:else if shareIds.length === 0}
      <div class="text-center py-16 flex flex-col items-center gap-4">
        <span class="material-symbols-outlined text-5xl" style="color: #4e4635; font-variation-settings: 'FILL' 1;">casino</span>
        <p class="text-sm" style="color: #9a907b;">No characters saved yet.</p>
        <p class="text-xs" style="color: #4e4635;">Complete a spin session and hit Save & Share to preserve your fate.</p>
        <a
          href="/"
          class="mt-4 px-8 py-3 rounded-lg text-sm tracking-[0.18em] uppercase font-bold transition-all active:scale-95"
          style="font-family: 'Cinzel', serif; color: #ffdf96; background: linear-gradient(135deg, #1c1a2a, #13121c); border: 1px solid #f0c040; text-decoration: none;"
        >
          Spin Your Fate
        </a>
      </div>

    {:else}
      <div class="flex flex-col gap-3">
        {#each shareIds as id, i}
          <a
            href="/character/{id}"
            class="flex items-center gap-4 px-4 py-4 rounded-lg transition-all hover:scale-[1.01] active:scale-[0.99]"
            style="background: linear-gradient(135deg, #1c1a2a, #13121c); border: 1px solid rgba(240,192,64,0.18); text-decoration: none;"
          >
            <span class="material-symbols-outlined shrink-0" style="color: #f0c040; font-size: 22px; font-variation-settings: 'FILL' 1;">person_play</span>
            <div class="flex-1 min-w-0">
              <p class="text-xs tracking-[0.15em] uppercase mb-0.5" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Character {shareIds.length - i}</p>
              <p class="text-sm truncate" style="font-family: 'JetBrains Mono', monospace; color: #7dd3fc;">{id}</p>
            </div>
            <span class="material-symbols-outlined shrink-0" style="color: #4e4635; font-size: 18px;">arrow_forward</span>
          </a>
        {/each}
      </div>

      <p class="mt-6 text-center text-xs" style="font-family: 'JetBrains Mono', monospace; color: #4e4635;">
        {shareIds.length} fate{shareIds.length === 1 ? '' : 's'} recorded on this device
      </p>
    {/if}

  </div>

</main>
