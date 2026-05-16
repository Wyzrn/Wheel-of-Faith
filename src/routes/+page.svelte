<script lang="ts">
  import { onMount } from 'svelte'
  import SpinWheel from '../components/SpinWheel.svelte'
  import TierBadge from '../components/TierBadge.svelte'
  import CharacterCard from '../components/CharacterCard.svelte'
  import { loadSession, saveSession, clearSession, createSession } from '$lib/session/store'
  import type { SessionState, SpinResult } from '$lib/session/types'
  import { buildInitialQueue, getSegmentsForCategory } from '$lib/game/spinQueue'
  import type { SpinDefinition } from '$lib/game/spinQueue'
  import { races } from '$lib/content/races'
  import { archetypes } from '$lib/content/archetypes'
  import { weightedRandom } from '$lib/game/random'

  // ── State declarations ────────────────────────────────────────────────────
  let currentSession = $state<SessionState>(createSession())
  let showResumePrompt = $state(false)
  let spinQueue = $state<SpinDefinition[]>(buildInitialQueue())
  let currentSpinIndex = $state(0)
  let results = $state<SpinResult[]>([])
  let showAnnouncement = $state<string | null>(null)
  let showCard = $state(false)
  let isRevealed = $state(false)

  // ── Derived values ────────────────────────────────────────────────────────
  let currentDef = $derived(spinQueue[currentSpinIndex])
  let currentSegments = $derived(getSegmentsForCategory(currentDef?.category ?? 'race'))
  let spinCounterText = $derived(`Spin ${currentSpinIndex + 1} of ${spinQueue.length}`)
  let categoryHeaderText = $derived(
    isRevealed
      ? `${currentDef?.displayName ?? ''} — Result:`
      : `Next: ${currentDef?.displayName ?? ''}`
  )

  // ── Stat categories that get tier + score embedded ────────────────────────
  const STAT_CATEGORIES = new Set([
    'strength', 'speed', 'agility', 'durability', 'iq',
    'charisma', 'fightingSkill', 'potential', 'energyLevel',
    'powerMastery', 'weaponMastery'
  ])

  // ── onMount: restore session if saved ────────────────────────────────────
  onMount(() => {
    const saved = loadSession()
    if (saved && saved.completedSpins.length > 0) {
      currentSession = saved
      showResumePrompt = true
      // Restore queue and position if available (D-11 resume logic)
      if (saved.spinQueue && saved.spinQueue.length > 0) {
        spinQueue = saved.spinQueue
      }
      if (saved.currentSpinIndex !== undefined) {
        currentSpinIndex = saved.currentSpinIndex
      }
      results = saved.completedSpins
    }
  })

  // ── handleSpinComplete: strict order — splice, push, save ────────────────
  function handleSpinComplete(resultIndex: number, resultLabel: string) {
    const def = spinQueue[currentSpinIndex]

    // Step 1: SPLICE queue (must happen before saveSession)
    if (def.category === 'race') {
      const race = races.find(r => r.label === resultLabel)
      const count = race?.abilitySpinCount ?? 1
      const slots: SpinDefinition[] = Array.from({ length: count }, (_, i) => ({
        category: 'racialAbility' as const,
        displayName: `Racial Ability ${i + 1}`,
      }))
      spinQueue.splice(currentSpinIndex + 1, 0, ...slots)
      showAnnouncement = `Your race grants ${count} ability spin${count > 1 ? 's' : ''}!`
    } else if (def.category === 'archetype') {
      const archetype = archetypes.find(a => a.label === resultLabel)
      const count = archetype?.abilitySpinCount ?? 1
      const slots: SpinDefinition[] = Array.from({ length: count }, (_, i) => ({
        category: 'archetypeAbility' as const,
        displayName: `Archetype Ability ${i + 1}`,
      }))
      spinQueue.splice(currentSpinIndex + 1, 0, ...slots)
      showAnnouncement = `Your archetype grants ${count} ability spin${count > 1 ? 's' : ''}!`
    } else if (def.category === 'weakness') {
      // SENTINEL: rolls weakness count using race's modifier — does NOT add a result entry
      const raceResult = results.find(r => r.category === 'race')
      const race = races.find(r => r.label === raceResult?.resultLabel)
      const modifier = race?.weaknessProbabilityModifier ?? 1.0

      // Baseline probabilities [0: 10%, 1: 45%, 2: 35%, 3: 10%]
      // Scale non-zero probabilities by modifier, then renormalize
      const baseWeights = [10, 45, 35, 10]
      const adjusted = baseWeights.map((w, i) => i === 0 ? w : w * modifier)
      const countItems = adjusted.map((w, i) => ({ label: String(i), weight: w }))
      const countIndex = weightedRandom(countItems)
      const weaknessCount = countIndex // 0, 1, 2, or 3

      if (weaknessCount > 0) {
        const slots: SpinDefinition[] = Array.from({ length: weaknessCount }, () => ({
          category: 'weakness' as const,
          displayName: 'Weakness',
        }))
        spinQueue.splice(currentSpinIndex + 1, 0, ...slots)
        showAnnouncement = `You have ${weaknessCount} weakness${weaknessCount > 1 ? 'es' : ''}!`
      }

      // Sentinel: save state then set revealed — no result pushed
      saveSession({
        ...currentSession,
        completedSpins: $state.snapshot(results),
        spinQueue: $state.snapshot(spinQueue),
        currentSpinIndex,
      } as SessionState)
      isRevealed = true
      return // early return — sentinel does not produce a result entry
    }

    // Step 2: PUSH result
    const spinResult: SpinResult = {
      step: results.length + 1,
      category: def.category,
      resultLabel,
      resultIndex,
      timestamp: new Date().toISOString(),
    }

    // For stat categories, look up tier + score from the FlavorLabel embedded data
    if (STAT_CATEGORIES.has(def.category)) {
      const segments = getSegmentsForCategory(def.category)
      const label = segments[resultIndex] as { label: string; weight: number; color?: string; tier?: import('$lib/game/scoreTier').TierGrade; score?: number }
      if (label?.tier !== undefined) {
        spinResult.tier = label.tier
      }
      if (label?.score !== undefined) {
        spinResult.score = label.score
      }
    }

    results.push(spinResult)

    // Step 3: SAVE with $state.snapshot (prevents Proxy serialization issues)
    saveSession({
      ...currentSession,
      completedSpins: $state.snapshot(results),
      spinQueue: $state.snapshot(spinQueue),
      currentSpinIndex,
    } as SessionState)

    isRevealed = true
  }

  // ── handleNextSpin: advance index, clear announcement ────────────────────
  function handleNextSpin() {
    showAnnouncement = null
    isRevealed = false
    currentSpinIndex++
    if (currentSpinIndex >= spinQueue.length) {
      showCard = true
    }
  }

  // ── handleResume: dismiss prompt, keep restored state ────────────────────
  function handleResume() {
    showResumePrompt = false
    isRevealed = false
  }

  // ── handleStartOver: clear session, rebuild from scratch ─────────────────
  function handleStartOver() {
    clearSession()
    currentSession = createSession()
    spinQueue = buildInitialQueue()
    currentSpinIndex = 0
    results = []
    showAnnouncement = null
    showCard = false
    isRevealed = false
    showResumePrompt = false
  }

  // ── handleNewCharacter: same as start over ────────────────────────────────
  function handleNewCharacter() {
    clearSession()
    currentSession = createSession()
    spinQueue = buildInitialQueue()
    currentSpinIndex = 0
    results = []
    showAnnouncement = null
    showCard = false
    isRevealed = false
    showResumePrompt = false
  }
</script>

<main class="min-h-screen bg-gray-950 text-white flex flex-col items-center py-8 px-4">

  <!-- Header row -->
  <div class="w-full max-w-4xl flex items-center justify-between mb-6">
    <h1 class="text-3xl font-bold tracking-wide">Wheel of Fate</h1>
    <span class="text-sm text-gray-400">{spinCounterText}</span>
  </div>

  <!-- Resume prompt -->
  {#if showResumePrompt}
    <div class="w-full max-w-sm bg-gray-800 border border-gray-600 rounded-xl p-6 mb-6 text-center">
      <p class="text-lg font-semibold mb-2">You have a saved session</p>
      <p class="text-sm text-gray-400 mb-4">
        Last spin: <span class="text-white font-medium">
          {currentSession.completedSpins.at(-1)?.resultLabel ?? ''}
        </span>
        ({currentSession.completedSpins.length} spin{currentSession.completedSpins.length === 1 ? '' : 's'} completed)
      </p>
      <div class="flex gap-3 justify-center">
        <button
          onclick={handleResume}
          class="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg transition-colors"
        >Resume Session</button>
        <button
          onclick={handleStartOver}
          class="bg-gray-600 hover:bg-gray-500 text-white px-5 py-2 rounded-lg transition-colors"
        >Start Over</button>
      </div>
    </div>
  {/if}

  <!-- Main game area -->
  {#if !showCard && !showResumePrompt}
    <div class="w-full max-w-4xl flex flex-col md:flex-row gap-8 items-start">

      <!-- Left column: wheel + controls -->
      <div class="flex flex-col items-center gap-4 w-full max-w-sm">

        <!-- Category header -->
        <p class="text-base font-bold {isRevealed ? 'text-white' : 'text-gray-300'}">{categoryHeaderText}</p>

        <!-- SpinWheel -->
        <SpinWheel segments={currentSegments} onSpinComplete={handleSpinComplete} />

        <!-- Announcement banner -->
        {#if showAnnouncement}
          <div class="w-full bg-indigo-900 border border-indigo-500 rounded-lg py-2 px-4 text-center animate-[fadeIn_0.3s_ease-out_forwards]">
            <p class="text-indigo-300 text-sm font-bold">{showAnnouncement}</p>
          </div>
        {/if}

        <!-- Next Spin button (shown when REVEALED) -->
        {#if isRevealed}
          <button
            onclick={handleNextSpin}
            class="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg text-lg transition-colors"
          >Next Spin</button>
        {/if}

      </div>

      <!-- Right column: results panel -->
      <div class="flex-1 min-w-0 max-w-xs">
        <h2 class="text-base font-bold mb-3">Your Results</h2>
        <div class="bg-gray-900 rounded-xl p-4 max-h-[400px] overflow-y-auto">
          {#if results.length === 0}
            <p class="text-sm text-gray-400 text-center">Your fate is being written...</p>
          {/if}
          {#each [...results].reverse() as result}
            <div class="flex items-center gap-3 py-2 border-b border-gray-800 last:border-0">
              <span class="text-xs text-gray-400 w-20 shrink-0">{result.category}</span>
              {#if result.tier}
                <TierBadge grade={result.tier} score={result.score} />
              {:else}
                <span class="w-12 h-6"></span>
              {/if}
              {#if result.score !== undefined}
                <span class="text-xs text-gray-400 w-8 text-right">{result.score}</span>
              {:else}
                <span class="w-8"></span>
              {/if}
              <span class="text-sm text-white flex-1 truncate">{result.resultLabel}</span>
            </div>
          {/each}
        </div>
      </div>

    </div>
  {/if}

  <!-- Character card (shown when all spins complete) -->
  {#if showCard}
    <CharacterCard {results} onNewCharacter={handleNewCharacter} />
  {/if}

</main>
