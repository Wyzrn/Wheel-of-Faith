<script lang="ts">
  import { onMount } from 'svelte'
  import SpinWheel from '../SpinWheel.svelte'
  import {
    createStorySession,
    loadStorySession,
    saveStorySession,
    clearStorySession,
    buildRosterEntryFromResults,
    type StorySessionState,
  } from '$lib/story/storySession'
  import { buildInitialQueue, getSegmentsForCategory, type SpinCategory } from '$lib/game/spinQueue'
  import type { SpinDefinition } from '$lib/game/spinQueue'
  import type { SpinResult, WeightedSegment } from '$lib/session/types'
  import type { StoryRosterEntry } from '$lib/story/types'
  import { races } from '$lib/content/races'

  // ── STAT_CATEGORIES matching scoreTier.ts STAT_WEIGHTS keys ─────────────────
  const STAT_CATEGORIES = new Set([
    'strength', 'speed', 'agility', 'durability', 'iq',
    'charisma', 'fightingSkill', 'potential', 'energyLevel',
    'powerMastery', 'weaponMastery',
  ])

  // ── Props ─────────────────────────────────────────────────────────────────────
  const { onSessionComplete, onCancel }: {
    onSessionComplete: (entry: StoryRosterEntry) => void
    onCancel: () => void
  } = $props()

  // ── Internal state ────────────────────────────────────────────────────────────
  let session = $state<StorySessionState>(loadStorySession() ?? createStorySession())
  let results = $state<SpinResult[]>(session.completedSpins ?? [])
  let queue = $state<SpinDefinition[]>(session.spinQueue)
  let currentIndex = $state(session.currentSpinIndex ?? 0)
  let showResumePrompt = $state(false)
  // Controls the "Story Mode" indicator fade — set false after 2s
  let showModeIndicator = $state(true)

  // ── On mount: detect if we have a resumable session ───────────────────────────
  onMount(() => {
    const existing = loadStorySession()
    if (existing && existing.completedSpins.length > 0) {
      showResumePrompt = true
    }
    // Fade the Story Mode indicator after 2s
    setTimeout(() => { showModeIndicator = false }, 2000)
  })

  // ── Derived values ────────────────────────────────────────────────────────────
  let currentDef = $derived(queue[currentIndex] as SpinDefinition | undefined)

  let currentSegments = $derived((): WeightedSegment[] => {
    if (!currentDef) return []

    // For racialAbility: use the race-specific ability pool when available
    if (currentDef.category === 'racialAbility') {
      const raceResult = results.find(r => r.category === 'race')
      if (raceResult) {
        const race = races.find(r => r.label === raceResult.resultLabel)
        if (race?.abilities && race.abilities.length > 0) {
          return race.abilities as WeightedSegment[]
        }
      }
      return getSegmentsForCategory('racialAbility')
    }

    return getSegmentsForCategory(currentDef.category as SpinCategory)
  })

  // ── Resume handler ────────────────────────────────────────────────────────────
  function handleResume() {
    showResumePrompt = false
  }

  // ── Start Over handler ────────────────────────────────────────────────────────
  function handleStartOver() {
    clearStorySession()
    const fresh = createStorySession()
    session = fresh
    results = []
    queue = fresh.spinQueue
    currentIndex = 0
    showResumePrompt = false
  }

  // ── Spin completion handler ───────────────────────────────────────────────────
  function handleSpinComplete(resultIndex: number, resultLabel: string) {
    if (!currentDef) return

    const spinResult: SpinResult = {
      step: results.length + 1,
      category: currentDef.category,
      resultLabel,
      resultIndex,
      timestamp: new Date().toISOString(),
    }

    // For stat categories, look up tier + score from the FlavorLabel embedded data.
    // Must search by resultLabel (not resultIndex) because weight modifiers can shift indices.
    if (STAT_CATEGORIES.has(currentDef.category)) {
      const segs = getSegmentsForCategory(currentDef.category as SpinCategory)
      const matched = (segs as { label: string; weight: number; tier?: string; score?: number }[])
        .find(s => s.label === resultLabel)
      if (matched?.tier !== undefined) {
        spinResult.tier = matched.tier as SpinResult['tier']
      }
      if (matched?.score !== undefined) {
        spinResult.score = matched.score
      }
    }

    results.push(spinResult)
    const nextIndex = currentIndex + 1
    currentIndex = nextIndex

    // Persist after every spin (CLAUDE.md rule 2 — localStorage after every spin)
    saveStorySession({
      ...session,
      completedSpins: $state.snapshot(results),
      spinQueue: $state.snapshot(queue),
      currentSpinIndex: nextIndex,
    } as StorySessionState)

    // Session complete when all queue entries have been processed
    if (nextIndex >= queue.length) {
      const entry = buildRosterEntryFromResults({
        results: $state.snapshot(results),
        sessionStartedAt: session.startedAt,
      })
      clearStorySession()
      onSessionComplete(entry)
    }
  }
</script>

<!-- ── Story Mode indicator ───────────────────────────────────────────────────── -->
<div class="min-h-screen flex flex-col items-center justify-center px-4 relative">

  <!-- Top bar: mode indicator + exit link -->
  <div class="fixed top-4 left-0 right-0 flex items-center justify-between px-4 z-20 pointer-events-none">
    <!-- Story Mode passive indicator (fades after 2s) -->
    <span
      class="pointer-events-none"
      style="
        font-family: var(--font-cinzel, 'Cinzel', serif);
        font-size: 14px;
        color: var(--color-outline);
        opacity: {showModeIndicator ? '1' : '0'};
        transition: opacity 0.6s ease;
      "
    >
      Story Mode
    </span>

    <!-- Exit to Menu link -->
    <button
      class="pointer-events-auto"
      style="
        font-family: var(--font-mono, monospace);
        font-size: 12px;
        color: var(--color-outline);
        background: none;
        border: none;
        cursor: pointer;
        text-decoration: underline;
        text-underline-offset: 3px;
      "
      onclick={onCancel}
    >
      Exit to Menu
    </button>
  </div>

  <!-- Spin wheel (centered) -->
  {#if currentDef && !showResumePrompt}
    <div class="flex flex-col items-center gap-4">
      <SpinWheel
        segments={currentSegments()}
        onSpinComplete={handleSpinComplete}
      />

      <!-- Progress indicator -->
      <p
        style="
          font-family: monospace;
          font-size: 14px;
          color: var(--color-outline);
          letter-spacing: 0.05em;
        "
      >
        {currentIndex + 1} / {queue.length}
      </p>
    </div>
  {/if}
</div>

<!-- ── Resume prompt modal ───────────────────────────────────────────────────── -->
{#if showResumePrompt}
  <div
    class="fixed inset-0 z-40 flex items-center justify-center px-4"
    style="background: rgba(7,7,13,0.9); backdrop-filter: blur(12px);"
  >
    <div
      class="obsidian-slab w-full max-w-sm rounded-xl p-7 text-center relative overflow-hidden"
      style="border: 1px solid rgba(240,192,64,0.3); box-shadow: 0 0 60px rgba(0,0,0,0.9), 0 0 40px rgba(240,192,64,0.06);"
    >
      <div class="noise-overlay"></div>
      <div class="absolute top-3 left-3 w-7 h-7" style="border-top: 2px solid rgba(240,192,64,0.4); border-left: 2px solid rgba(240,192,64,0.4);"></div>
      <div class="absolute top-3 right-3 w-7 h-7" style="border-top: 2px solid rgba(240,192,64,0.4); border-right: 2px solid rgba(240,192,64,0.4);"></div>
      <div class="absolute bottom-3 left-3 w-7 h-7" style="border-bottom: 2px solid rgba(240,192,64,0.4); border-left: 2px solid rgba(240,192,64,0.4);"></div>
      <div class="absolute bottom-3 right-3 w-7 h-7" style="border-bottom: 2px solid rgba(240,192,64,0.4); border-right: 2px solid rgba(240,192,64,0.4);"></div>

      <div class="relative z-10">
        <span
          class="material-symbols-outlined block text-4xl mb-3"
          style="color: #f0c040; font-variation-settings: 'FILL' 1;"
        >
          history
        </span>
        <p
          style="
            font-family: var(--font-cinzel, 'Cinzel', serif);
            font-size: 1.05rem;
            font-weight: 700;
            color: #ffdf96;
            margin-bottom: 6px;
            text-shadow: 0 0 12px rgba(240,192,64,0.3);
          "
        >
          Resume Story Session?
        </p>
        <p class="text-sm mb-6" style="color: #9a907b;">
          {results.length} spin{results.length === 1 ? '' : 's'} done
        </p>
        <div class="flex gap-3">
          <button
            onclick={handleResume}
            class="metal-stamp-gold flex-1 py-2.5 rounded-lg text-sm font-bold"
            style="font-family: var(--font-cinzel, 'Cinzel', serif); letter-spacing: 0.1em;"
          >
            Resume
          </button>
          <button
            onclick={handleStartOver}
            class="obsidian-slab flex-1 py-2.5 rounded-lg text-sm font-bold transition-all active:scale-95"
            style="font-family: var(--font-cinzel, 'Cinzel', serif); color: #9a907b; border: 1px solid #4e4635; letter-spacing: 0.1em;"
          >
            Start Over
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
