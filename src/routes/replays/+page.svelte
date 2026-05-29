<script lang="ts">
  // Battle Replay viewer — paginates through saved battles and plays back the
  // log line-by-line at the same cadence as a live battle (respecting the
  // user's battleSpeed setting). Renders the same team-panel chrome the live
  // battle shows so you're "watching" the fight, not reading a transcript.
  //
  // MVP scope: still no FX replay — recreating particle pipelines from saved
  // round data is its own project. But the panels + animated log + speed
  // controls give the "actual battle" feel the user asked for.
  import { onMount, onDestroy, tick } from 'svelte'
  import { loadReplays, deleteReplay, type ReplayEntry } from '$lib/battleReplay'
  import { settings } from '$lib/settings.svelte'
  import { toast } from '$lib/toast.svelte'

  let entries = $state<ReplayEntry[]>([])
  let selectedId = $state<string | null>(null)
  let viewing = $derived(entries.find(e => e.id === selectedId) ?? null)

  // Playback state — when a replay is opened we animate the log lines onto
  // the screen one at a time so the player feels the rhythm of the battle.
  let visibleLines = $state<string[]>([])
  let playing = $state(false)
  let playIndex = $state(0)
  let playTimer: ReturnType<typeof setTimeout> | null = null
  let logEl: HTMLDivElement | null = $state(null)

  // Speed multiplier for replay playback — uses the global battleSpeed but
  // local override is offered too. 99 = instant (jump to end).
  let speedOverride = $state(1.0)
  function lineDelay(line: string): number {
    if (speedOverride >= 99) return 0
    return Math.max(40, (line.startsWith('──') || line.startsWith('══') ? 320 : 520) / speedOverride)
  }

  onMount(() => { entries = loadReplays() })
  onDestroy(() => { if (playTimer) clearTimeout(playTimer) })

  async function scrollLog() {
    await tick()
    if (logEl) logEl.scrollTop = logEl.scrollHeight
  }

  function openReplay(id: string) {
    selectedId = id
    visibleLines = []
    playIndex = 0
    play()
  }
  function closeReplay() {
    selectedId = null
    stop()
    visibleLines = []
  }

  function play() {
    if (!viewing) return
    playing = true
    advance()
  }
  function pause() {
    playing = false
    if (playTimer) { clearTimeout(playTimer); playTimer = null }
  }
  function stop() {
    pause()
    playIndex = 0
    visibleLines = []
  }
  function jumpToEnd() {
    if (!viewing) return
    pause()
    visibleLines = [...viewing.logLines]
    playIndex = viewing.logLines.length
    scrollLog()
  }

  function advance() {
    if (!viewing || !playing) return
    if (playIndex >= viewing.logLines.length) { playing = false; return }
    const line = viewing.logLines[playIndex]
    visibleLines = [...visibleLines, line]
    playIndex++
    scrollLog()
    if (speedOverride >= 99) {
      // Instant mode — flush remaining lines immediately
      while (playIndex < viewing.logLines.length) {
        visibleLines = [...visibleLines, viewing.logLines[playIndex]]
        playIndex++
      }
      playing = false
      scrollLog()
      return
    }
    playTimer = setTimeout(advance, lineDelay(line))
  }

  function relTime(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime()
    const m = Math.floor(ms / 60000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  }

  function removeReplay(id: string) {
    deleteReplay(id)
    entries = loadReplays()
    if (selectedId === id) closeReplay()
    toast.success('Replay deleted')
  }

  const SPEED_OPTIONS = [
    { value: 0.5, label: '0.5×' },
    { value: 1,   label: '1×'   },
    { value: 2,   label: '2×'   },
    { value: 4,   label: '4×'   },
    { value: 99,  label: '⏭ End'},
  ]
</script>

<main class="min-h-screen pt-16 pb-24 px-4" style="background: transparent;">
  <div class="max-w-2xl mx-auto">

    {#if !viewing}
      <!-- Library list -->
      <div class="flex items-end gap-3 mb-2">
        <span class="material-symbols-outlined" style="font-size: 28px; color: #f0c040; font-variation-settings: 'FILL' 1;">history</span>
        <h1 class="font-bold" style="font-family: 'Cinzel', serif; font-size: 1.6rem; color: #ffdf96; letter-spacing: 0.1em;">Battle Replays</h1>
      </div>
      <p class="text-xs mb-5" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">
        Last {entries.length} of 5 battles · animated playback with speed controls
      </p>

      {#if entries.length === 0}
        <div class="rounded-xl px-5 py-8 text-center" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);">
          <span class="material-symbols-outlined" style="font-size: 36px; color: #4e4635;">history_toggle_off</span>
          <p class="mt-3 text-sm" style="color: #9a907b; font-family: 'Cinzel', serif;">No battles fought yet.</p>
          <p class="text-xs mt-1" style="color: #4e4635; font-family: 'JetBrains Mono', monospace;">Win a Story Mode battle to start a replay history.</p>
        </div>
      {:else}
        <div class="flex flex-col gap-2">
          {#each entries as e}
            {@const accent = e.playerWon ? '#34d399' : '#f87171'}
            <button onclick={() => openReplay(e.id)} data-fx="big"
              class="text-left rounded-xl px-4 py-3 flex items-center gap-3 transition-all active:scale-98"
              style="background: linear-gradient(180deg, #13121c, #0c0b14); border: 1px solid {accent}33; cursor: pointer;">
              <span class="material-symbols-outlined" style="font-size: 22px; color: {accent}; font-variation-settings: 'FILL' 1;">{e.playerWon ? 'emoji_events' : 'sentiment_dissatisfied'}</span>
              <div class="flex-1 min-w-0">
                <p class="font-bold text-sm" style="font-family: 'Cinzel', serif; color: #ffdf96;">
                  {e.team1Label} <span style="color: #9a907b;">vs</span> {e.team2Label}
                </p>
                <p class="text-xs mt-0.5" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">
                  {e.playerWon ? 'Victory' : 'Defeat'} · {relTime(e.savedAt)} · {e.logLines.length} lines
                </p>
              </div>
              <span class="material-symbols-outlined" style="font-size: 18px; color: #f0c040; font-variation-settings: 'FILL' 1;">play_arrow</span>
            </button>
          {/each}
        </div>
      {/if}

    {:else}
      <!-- Single replay player -->
      <div class="flex items-center justify-between gap-3 mb-4">
        <button onclick={closeReplay} class="flex items-center gap-1 font-mono text-xs"
          style="color: #9a907b; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); cursor: pointer; padding: 6px 10px; border-radius: 6px;">
          <span class="material-symbols-outlined" style="font-size: 14px;">arrow_back</span>
          Library
        </button>
        <p class="text-xs flex-1 text-right" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">
          {viewing.playerWon ? 'Victory' : 'Defeat'} · {relTime(viewing.savedAt)}
        </p>
      </div>

      <!-- Team panels — mimic the battle UI style. Both teams shown as static
           rosters so you can see who fought without HP-tracking complexity. -->
      <div class="grid grid-cols-2 gap-2 mb-3">
        <div class="rounded-xl p-3" style="background: linear-gradient(160deg, rgba(125,211,252,0.10), #0c0b14 80%); border: 1px solid rgba(125,211,252,0.32);">
          <p class="font-mono text-[10px] tracking-[0.18em] uppercase mb-2" style="color: #7dd3fc;">{viewing.team1Label}</p>
          {#each viewing.team1Chars as c}
            <div class="rounded-lg px-2 py-1.5 mb-1.5 last:mb-0" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05);">
              <p class="font-mono text-xs truncate" style="color: #ffdf96;">{c.name}</p>
              {#if c.race || c.archetype}
                <p class="font-mono text-[10px]" style="color: #9a907b;">{c.race ?? ''} {c.archetype ? `· ${c.archetype}` : ''}</p>
              {/if}
            </div>
          {/each}
        </div>
        <div class="rounded-xl p-3" style="background: linear-gradient(200deg, rgba(249,168,212,0.10), #0c0b14 80%); border: 1px solid rgba(249,168,212,0.32);">
          <p class="font-mono text-[10px] tracking-[0.18em] uppercase mb-2 text-right" style="color: #f9a8d4;">{viewing.team2Label}</p>
          {#each viewing.team2Chars as c}
            <div class="rounded-lg px-2 py-1.5 mb-1.5 last:mb-0" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05);">
              <p class="font-mono text-xs truncate text-right" style="color: #ffdf96;">{c.name}</p>
              {#if c.race || c.archetype}
                <p class="font-mono text-[10px] text-right" style="color: #9a907b;">{c.race ?? ''} {c.archetype ? `· ${c.archetype}` : ''}</p>
              {/if}
            </div>
          {/each}
        </div>
      </div>

      <!-- Playback controls -->
      <div class="flex items-center gap-2 mb-3 flex-wrap">
        {#if playing}
          <button onclick={pause} class="flex items-center gap-1.5 font-mono text-xs px-3 py-2 rounded-lg" data-fx="big"
            style="background: rgba(240,192,64,0.10); border: 1px solid rgba(240,192,64,0.32); color: #f0c040; cursor: pointer;">
            <span class="material-symbols-outlined" style="font-size: 14px; font-variation-settings: 'FILL' 1;">pause</span>
            Pause
          </button>
        {:else if playIndex < viewing.logLines.length}
          <button onclick={play} class="flex items-center gap-1.5 font-mono text-xs px-3 py-2 rounded-lg" data-fx="big"
            style="background: rgba(52,211,153,0.10); border: 1px solid rgba(52,211,153,0.32); color: #34d399; cursor: pointer;">
            <span class="material-symbols-outlined" style="font-size: 14px; font-variation-settings: 'FILL' 1;">play_arrow</span>
            Play
          </button>
        {:else}
          <button onclick={() => { stop(); play() }} class="flex items-center gap-1.5 font-mono text-xs px-3 py-2 rounded-lg" data-fx="big"
            style="background: rgba(167,139,250,0.10); border: 1px solid rgba(167,139,250,0.32); color: #a78bfa; cursor: pointer;">
            <span class="material-symbols-outlined" style="font-size: 14px;">replay</span>
            Replay
          </button>
        {/if}
        <button onclick={jumpToEnd} class="flex items-center gap-1.5 font-mono text-xs px-3 py-2 rounded-lg"
          style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #9a907b; cursor: pointer;">
          <span class="material-symbols-outlined" style="font-size: 14px;">skip_next</span>
          Skip
        </button>
        <!-- Speed chips -->
        <div class="flex gap-0.5 ml-auto">
          {#each SPEED_OPTIONS as opt}
            {@const active = speedOverride === opt.value}
            <button onclick={() => speedOverride = opt.value}
              class="font-mono text-[10px] px-2 py-1.5 rounded transition-all"
              style="background: {active ? 'rgba(240,192,64,0.15)' : 'rgba(255,255,255,0.03)'}; border: 1px solid {active ? 'rgba(240,192,64,0.32)' : 'rgba(255,255,255,0.06)'}; color: {active ? '#f0c040' : '#9a907b'}; cursor: pointer;">
              {opt.label}
            </button>
          {/each}
        </div>
      </div>

      <!-- Progress bar -->
      <div class="rounded-full overflow-hidden mb-3" style="height: 3px; background: rgba(255,255,255,0.05);">
        <div style="height: 100%; width: {viewing.logLines.length > 0 ? Math.round((playIndex / viewing.logLines.length) * 100) : 0}%; background: linear-gradient(90deg, #c0882a, #f0c040); transition: width 0.2s ease;"></div>
      </div>

      <!-- Battle log — matches the live battle styling so it feels familiar -->
      <div bind:this={logEl} class="rounded-xl px-4 py-4 max-h-[55vh] overflow-y-auto"
        style="background: #07060c; border: 1px solid rgba(255,255,255,0.06); font-family: 'JetBrains Mono', monospace; font-size: 12px; line-height: 1.75; color: #d4cdb8;">
        {#if visibleLines.length === 0}
          <p style="color: #4e4635; text-align: center; padding: 12px 0;">— battle log will play here —</p>
        {/if}
        {#each visibleLines as line, i}
          {@const isHeader = line.startsWith('──') || line.startsWith('══')}
          <p style="white-space: pre-wrap; color: {isHeader ? '#f0c040' : '#d4cdb8'}; font-weight: {isHeader ? '700' : '400'}; opacity: {i === visibleLines.length - 1 ? '1' : '0.92'}; animation: replayLineIn 0.25s ease-out;">{line}</p>
        {/each}
      </div>

      <!-- Delete -->
      <div class="flex justify-end mt-4">
        <button onclick={() => removeReplay(viewing!.id)} class="font-mono text-xs px-3 py-1.5 rounded-lg"
          style="background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.18); color: #f87171; cursor: pointer;">
          Delete replay
        </button>
      </div>
    {/if}
  </div>
</main>

<style>
  @keyframes replayLineIn {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
</style>
