<script lang="ts">
  // Global popup shown when a friend challenges you (presence.incoming set).
  // - rivals mode: Accept → both spin fresh characters then fight.
  // - character mode: pick one of your roster fighters, then battle.
  import { presence } from '$lib/stores/presence.svelte'
  import { loadAllSlots } from '$lib/story/saveSlots'
  import type { StoryRosterEntry } from '$lib/story/types'

  let incoming = $derived(presence.incoming)

  // Lazy-loaded roster (character mode only).
  let roster = $state<StoryRosterEntry[]>([])
  let selectedId = $state<string | null>(null)
  let loadedRoster = $state(false)

  $effect(() => {
    if (incoming?.mode === 'character' && !loadedRoster) {
      loadedRoster = true
      try {
        const slots = loadAllSlots()
        roster = slots.flatMap(s => s?.roster ?? [])
        selectedId = roster[0]?.id ?? null
      } catch { roster = [] }
    }
    if (!incoming) { loadedRoster = false; roster = []; selectedId = null }
  })

  function accept() {
    if (!incoming) return
    if (incoming.mode === 'character') {
      const chosen = roster.find(r => r.id === selectedId)
      if (!chosen) return
      presence.respond(incoming.challengeId, true, { name: chosen.name, spins: chosen.spins })
    } else {
      presence.respond(incoming.challengeId, true)
    }
  }

  function decline() {
    if (incoming) presence.respond(incoming.challengeId, false)
  }
</script>

{#if incoming}
  <div class="fixed inset-0 z-[70] flex items-center justify-center px-4"
    style="background: rgba(7,7,13,0.92); backdrop-filter: blur(12px);">
    <div class="obsidian-slab w-full max-w-sm rounded-2xl p-6 text-center relative overflow-hidden"
      style="border: 1px solid rgba(249,168,212,0.4); box-shadow: 0 0 80px rgba(0,0,0,0.95), 0 0 50px rgba(249,168,212,0.15);">
      <div class="flex flex-col items-center gap-2 mb-4">
        <span class="material-symbols-outlined" style="font-size: 40px; color: #f9a8d4; font-variation-settings: 'FILL' 1; filter: drop-shadow(0 0 12px rgba(249,168,212,0.5));">swords</span>
        <p style="font-family: 'Cinzel', serif; font-size: 1.1rem; font-weight: 800; color: #ffdf96;">
          {incoming.fromUsername}
        </p>
        <p class="text-sm" style="color: #c4b5fd; font-family: 'JetBrains Mono', monospace;">
          {#if incoming.mode === 'character'}
            challenges you to a character duel{incoming.challengerCharacterName ? ` with ${incoming.challengerCharacterName}` : ''}!
          {:else}
            challenges you to a Rivals battle!
          {/if}
        </p>
      </div>

      {#if incoming.mode === 'character'}
        {#if roster.length === 0}
          <p class="text-xs mb-4" style="color: #f87171; font-family: 'JetBrains Mono', monospace;">
            You have no Story Mode characters to fight with. Build one first, then accept duels.
          </p>
        {:else}
          <p class="text-xs tracking-widest uppercase mb-2" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Pick your fighter</p>
          <div class="flex flex-col gap-2 mb-4 max-h-52 overflow-y-auto">
            {#each roster as char}
              <button
                onclick={() => selectedId = char.id}
                class="flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all"
                style="background: {selectedId === char.id ? 'rgba(249,168,212,0.12)' : 'rgba(255,255,255,0.03)'}; border: 1px solid {selectedId === char.id ? 'rgba(249,168,212,0.45)' : 'rgba(255,255,255,0.06)'}; cursor: pointer;"
              >
                <div class="shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs"
                  style="background: rgba(249,168,212,0.15); color: #f9a8d4; font-family: 'Cinzel', serif;">{char.overallTier}</div>
                <div class="flex-1 min-w-0">
                  <p class="font-semibold truncate text-sm" style="font-family: 'Cinzel', serif; color: #e4e1ee;">{char.name}</p>
                  <p class="text-xs truncate" style="font-family: 'JetBrains Mono', monospace; color: #6b7280;">{char.race} · {char.archetype}</p>
                </div>
              </button>
            {/each}
          </div>
        {/if}
      {/if}

      <div class="flex gap-3">
        <button onclick={decline}
          class="flex-1 py-2.5 rounded-lg text-sm font-bold tracking-widest uppercase transition-all active:scale-95"
          style="font-family: 'Cinzel', serif; color: #9a907b; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); cursor: pointer;">
          Decline
        </button>
        <button onclick={accept}
          disabled={incoming.mode === 'character' && roster.length === 0}
          class="flex-1 py-2.5 rounded-lg text-sm font-bold tracking-widest uppercase transition-all active:scale-95 disabled:opacity-40"
          style="font-family: 'Cinzel', serif; color: #f9a8d4; background: rgba(249,168,212,0.12); border: 1px solid rgba(249,168,212,0.4); cursor: pointer;">
          Accept
        </button>
      </div>
    </div>
  </div>
{/if}
