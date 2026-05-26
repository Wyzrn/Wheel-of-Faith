<script lang="ts">
  // Battle Replay viewer. Lists locally-stored replays (last 5) and lets the
  // player open one to read the full battle log. MVP scope is text-only:
  // visual frame-by-frame replay is a separate, much heavier project.
  import { onMount } from 'svelte'
  import { loadReplays, deleteReplay, type ReplayEntry } from '$lib/battleReplay'
  import { toast } from '$lib/toast.svelte'

  let entries = $state<ReplayEntry[]>([])
  let selectedId = $state<string | null>(null)

  onMount(() => { entries = loadReplays() })

  let selected = $derived(entries.find(e => e.id === selectedId) ?? null)

  function relTime(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime()
    const m = Math.floor(ms / 60000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    const d = Math.floor(h / 24)
    return `${d}d ago`
  }

  function remove(id: string) {
    deleteReplay(id)
    entries = loadReplays()
    if (selectedId === id) selectedId = null
    toast.success('Replay deleted')
  }
</script>

<main class="min-h-screen pt-16 pb-24 px-4" style="background: #07070d;">
  <div class="max-w-2xl mx-auto">

    <div class="flex items-end gap-3 mb-2">
      <span class="material-symbols-outlined" style="font-size: 28px; color: #f0c040; font-variation-settings: 'FILL' 1;">history</span>
      <h1 class="font-bold" style="font-family: 'Cinzel', serif; font-size: 1.6rem; color: #ffdf96; letter-spacing: 0.1em;">Battle Replays</h1>
    </div>
    <p class="text-xs mb-5" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">
      Last {entries.length} of 5 battles · text replay for now (visual replay is on the roadmap)
    </p>

    {#if entries.length === 0}
      <div class="rounded-xl px-5 py-8 text-center" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);">
        <span class="material-symbols-outlined" style="font-size: 36px; color: #4e4635;">history_toggle_off</span>
        <p class="mt-3 text-sm" style="color: #9a907b; font-family: 'Cinzel', serif;">No battles fought yet.</p>
        <p class="text-xs mt-1" style="color: #4e4635; font-family: 'JetBrains Mono', monospace;">Win a Story Mode battle to start a replay history.</p>
      </div>
    {:else}
      <!-- Entry list -->
      <div class="flex flex-col gap-2 mb-6">
        {#each entries as e}
          {@const isOpen = selectedId === e.id}
          {@const accent = e.playerWon ? '#34d399' : '#f87171'}
          <div class="rounded-xl px-4 py-3" style="background: linear-gradient(180deg, #13121c, #0c0b14); border: 1px solid {isOpen ? `${accent}55` : 'rgba(78,70,53,0.3)'}; cursor: pointer; transition: border-color 0.15s;">
            <button
              type="button"
              onclick={() => selectedId = isOpen ? null : e.id}
              class="w-full text-left flex items-center gap-3"
              style="background: none; border: none; padding: 0; cursor: pointer;"
              data-fx="big"
            >
              <span class="material-symbols-outlined" style="font-size: 22px; color: {accent}; font-variation-settings: 'FILL' 1;">{e.playerWon ? 'emoji_events' : 'sentiment_dissatisfied'}</span>
              <div class="flex-1 min-w-0">
                <p class="font-bold text-sm" style="font-family: 'Cinzel', serif; color: #ffdf96;">
                  {e.team1Label} <span style="color: #9a907b;">vs</span> {e.team2Label}
                </p>
                <p class="text-xs mt-0.5" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">
                  {e.playerWon ? 'Victory' : 'Defeat'} · {relTime(e.savedAt)} · {e.logLines.length} lines
                </p>
              </div>
              <span class="material-symbols-outlined" style="font-size: 18px; color: #4e4635;">{isOpen ? 'expand_less' : 'expand_more'}</span>
            </button>

            {#if isOpen && selected}
              <!-- Combatants chip row -->
              <div class="mt-3 pt-3" style="border-top: 1px solid rgba(255,255,255,0.04);">
                <div class="flex items-center gap-2 flex-wrap mb-3">
                  <p class="font-mono text-[10px] tracking-[0.18em] uppercase" style="color: #7dd3fc;">{e.team1Label}:</p>
                  {#each e.team1Chars as c}
                    <span class="font-mono text-[10px] px-2 py-0.5 rounded-full" style="background: rgba(125,211,252,0.08); border: 1px solid rgba(125,211,252,0.22); color: #e4e1ee;">
                      {c.name}{c.race ? ` · ${c.race}` : ''}
                    </span>
                  {/each}
                </div>
                <div class="flex items-center gap-2 flex-wrap mb-3">
                  <p class="font-mono text-[10px] tracking-[0.18em] uppercase" style="color: #f9a8d4;">{e.team2Label}:</p>
                  {#each e.team2Chars as c}
                    <span class="font-mono text-[10px] px-2 py-0.5 rounded-full" style="background: rgba(249,168,212,0.08); border: 1px solid rgba(249,168,212,0.22); color: #e4e1ee;">
                      {c.name}
                    </span>
                  {/each}
                </div>

                <!-- Log -->
                <div class="rounded-lg px-3 py-3 max-h-[50vh] overflow-y-auto" style="background: #07060c; border: 1px solid rgba(255,255,255,0.04); font-family: 'JetBrains Mono', monospace; font-size: 11px; line-height: 1.7; color: #d4cdb8;">
                  {#each e.logLines as line}
                    <p class="mb-0.5" style="white-space: pre-wrap;">{line}</p>
                  {/each}
                </div>

                <div class="flex justify-end mt-3">
                  <button onclick={() => remove(e.id)} class="font-mono text-[10px] px-3 py-1.5 rounded-lg"
                    style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); color: #f87171; cursor: pointer;">
                    Delete replay
                  </button>
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</main>
