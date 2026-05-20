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
  import { archetypes } from '$lib/content/archetypes'
  import { getRacesForStage, racesToSegments } from '$lib/story/raceTiers'

  // ── STAT_CATEGORIES matching scoreTier.ts STAT_WEIGHTS keys ─────────────────
  const STAT_CATEGORIES = new Set([
    'strength', 'speed', 'agility', 'durability', 'iq',
    'charisma', 'fightingSkill', 'potential', 'energyLevel',
    'powerMastery', 'weaponMastery',
  ])

  function deriveWeaknessCount(modifier: number): number {
    if (modifier < 0.65) return 0
    if (modifier < 1.15) return 1
    if (modifier < 1.5)  return 2
    return 3
  }

  // ── Props ─────────────────────────────────────────────────────────────────────
  const { stage = 1, onSessionComplete, onCancel }: {
    stage?: number
    onSessionComplete: (entry: StoryRosterEntry) => void
    onCancel: () => void
  } = $props()

  // ── Internal state ────────────────────────────────────────────────────────────
  let session = $state<StorySessionState>(loadStorySession() ?? createStorySession())
  let results = $state<SpinResult[]>(session.completedSpins ?? [])
  let queue = $state<SpinDefinition[]>(session.spinQueue)
  let currentIndex = $state(session.currentSpinIndex ?? 0)
  let showResumePrompt = $state(false)
  let showModeIndicator = $state(true)

  // Track used abilities for greyed-out deduplication (mirrors main game pattern)
  let usedRacialAbilities = $state<Set<string>>(new Set())
  let usedArchetypeAbilities = $state<Set<string>>(new Set())

  // ── On mount ──────────────────────────────────────────────────────────────────
  onMount(() => {
    const existing = loadStorySession()
    if (existing && existing.completedSpins.length > 0) {
      showResumePrompt = true
    }
    setTimeout(() => { showModeIndicator = false }, 2000)
  })

  // ── Derived values ────────────────────────────────────────────────────────────
  let currentDef = $derived(queue[currentIndex] as SpinDefinition | undefined)

  // Stage-aware race segments (the core fix: filter by stage min weight)
  let stageRaceSegments = $derived(racesToSegments(getRacesForStage(stage)) as WeightedSegment[])

  let currentSegments = $derived.by((): WeightedSegment[] => {
    if (!currentDef) return []

    // Race wheel: only show races available at current stage
    if (currentDef.category === 'race') {
      return stageRaceSegments
    }

    // Racial ability: use race-specific pool with dimming for used abilities
    if (currentDef.category === 'racialAbility') {
      const raceResult = results.find(r => r.category === 'race')
      if (raceResult) {
        const race = races.find(r => r.label === raceResult.resultLabel)
        // Check for class or subType ability overrides
        const classResult = results.find(r => r.category === 'raceClass')
        const classItem = race?.classPool?.find(c => c.label === classResult?.resultLabel)
        const subTypeResult = results.find(r => r.category === 'raceSubType')
        const subTypeItem = race?.subTypePool?.find(s => s.label === subTypeResult?.resultLabel)
        const pool = classItem?.abilities ?? subTypeItem?.abilities ?? race?.abilities
        if (pool && pool.length > 0) {
          return (pool as WeightedSegment[]).map(seg =>
            usedRacialAbilities.has(seg.label) ? { ...seg, weight: 0, dimmed: true } : seg
          )
        }
      }
      return getSegmentsForCategory('racialAbility')
    }

    // Archetype ability: use archetype-specific pool with dimming
    if (currentDef.category === 'archetypeAbility') {
      const archetypeResult = results.find(r => r.category === 'archetype')
      if (archetypeResult) {
        const archetype = archetypes.find(a => a.label === archetypeResult.resultLabel)
        const pool = archetype?.customAbilityPool ?? archetype?.abilities
        if (pool && pool.length > 0) {
          return (pool as WeightedSegment[]).map(seg =>
            usedArchetypeAbilities.has(seg.label) ? { ...seg, weight: 0, dimmed: true } : seg
          )
        }
      }
      return getSegmentsForCategory('archetypeAbility')
    }

    // Race sub-type: use race's subTypePool
    if (currentDef.category === 'raceSubType') {
      const raceResult = results.find(r => r.category === 'race')
      const race = races.find(r => r.label === raceResult?.resultLabel)
      return (race?.subTypePool as WeightedSegment[] | undefined) ?? getSegmentsForCategory('raceSubType')
    }

    // Race class: use race's classPool
    if (currentDef.category === 'raceClass') {
      const raceResult = results.find(r => r.category === 'race')
      const race = races.find(r => r.label === raceResult?.resultLabel)
      return (race?.classPool as WeightedSegment[] | undefined) ?? getSegmentsForCategory('raceClass')
    }

    return getSegmentsForCategory(currentDef.category as SpinCategory)
  })

  // ── Resume handler ────────────────────────────────────────────────────────────
  function handleResume() {
    showResumePrompt = false
  }

  function handleStartOver() {
    clearStorySession()
    const fresh = createStorySession()
    session = fresh
    results = []
    queue = fresh.spinQueue
    currentIndex = 0
    usedRacialAbilities = new Set()
    usedArchetypeAbilities = new Set()
    showResumePrompt = false
  }

  // ── Spin completion — mirrors main game pattern (queue splicing + tracking) ───
  function handleSpinComplete(resultIndex: number, resultLabel: string) {
    if (!currentDef) return

    const spinResult: SpinResult = {
      step: results.length + 1,
      category: currentDef.category,
      resultLabel,
      resultIndex,
      timestamp: new Date().toISOString(),
    }

    // Enrich stat spins with tier + score from segment data
    if (STAT_CATEGORIES.has(currentDef.category)) {
      const segs = getSegmentsForCategory(currentDef.category as SpinCategory)
      const matched = (segs as { label: string; weight: number; tier?: string; score?: number }[])
        .find(s => s.label === resultLabel)
      if (matched?.tier !== undefined) spinResult.tier = matched.tier as SpinResult['tier']
      if (matched?.score !== undefined) spinResult.score = matched.score
    }

    // ── Post-spin queue splicing (mirrors main game logic) ─────────────────────
    const insertSlots: SpinDefinition[] = []

    if (currentDef.category === 'race') {
      const race = races.find(r => r.label === resultLabel)
      if (race) {
        // Splice sub-type spin if race has a subTypePool
        if (race.subTypePool && race.subTypePool.length > 0) {
          insertSlots.push({ category: 'raceSubType' as const, displayName: `${resultLabel} Sub-Type` })
        }
        // Splice racial ability spins (abilitySpinCount per race)
        const count = race.abilitySpinCount ?? 1
        for (let i = 0; i < count; i++) {
          insertSlots.push({
            category: 'racialAbility' as const,
            displayName: count > 1 ? `Racial Ability ${i + 1}` : 'Racial Ability',
          })
        }
        // Splice weakness spins
        const weaknessCount = deriveWeaknessCount(race.weaknessProbabilityModifier ?? 1.0)
        for (let i = 0; i < weaknessCount; i++) {
          insertSlots.push({
            category: 'weakness' as const,
            displayName: weaknessCount > 1 ? `Weakness ${i + 1}` : 'Weakness',
          })
        }
      }
      if (insertSlots.length > 0) {
        queue.splice(currentIndex + 1, 0, ...insertSlots)
      }
    }

    if (currentDef.category === 'archetype') {
      const archetype = archetypes.find(a => a.label === resultLabel)
      if (archetype) {
        const count = archetype.abilitySpinCount ?? 2
        for (let i = 0; i < count; i++) {
          insertSlots.push({
            category: 'archetypeAbility' as const,
            displayName: count > 1 ? `Archetype Ability ${i + 1}` : 'Archetype Ability',
          })
        }
        if (insertSlots.length > 0) {
          queue.splice(currentIndex + 1, 0, ...insertSlots)
        }
      }
    }

    // Track used abilities for dimming on future spins
    if (currentDef.category === 'racialAbility') {
      usedRacialAbilities.add(resultLabel)
    }
    if (currentDef.category === 'archetypeAbility') {
      usedArchetypeAbilities.add(resultLabel)
    }

    results.push(spinResult)
    const nextIndex = currentIndex + 1
    currentIndex = nextIndex

    // Persist after every spin
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

<!-- ── Story Mode spin UI ─────────────────────────────────────────────────────── -->
<div class="min-h-screen flex flex-col items-center justify-center px-4 relative">

  <!-- Top bar: mode indicator + exit link -->
  <div class="fixed top-4 left-0 right-0 flex items-center justify-between px-4 z-20 pointer-events-none">
    <span
      class="pointer-events-none"
      style="font-family: var(--font-cinzel, 'Cinzel', serif); font-size: 14px; color: var(--color-outline); opacity: {showModeIndicator ? '1' : '0'}; transition: opacity 0.6s ease;"
    >
      Story Mode — Stage {stage}
    </span>

    <button
      class="pointer-events-auto"
      style="font-family: var(--font-mono, monospace); font-size: 12px; color: var(--color-outline); background: none; border: none; cursor: pointer; text-decoration: underline; text-underline-offset: 3px;"
      onclick={onCancel}
    >
      Exit to Menu
    </button>
  </div>

  <!-- Spin wheel (remounts on each new spin via {#key} — same pattern as main game) -->
  {#if currentDef && !showResumePrompt}
    <div class="flex flex-col items-center gap-4">
      {#key currentIndex}
        <SpinWheel
          segments={currentSegments}
          onSpinComplete={handleSpinComplete}
        />
      {/key}

      <!-- Spin label + progress -->
      <div class="flex flex-col items-center gap-1">
        <p style="font-family: var(--font-cinzel, 'Cinzel', serif); font-size: 15px; color: var(--color-on-surface); font-weight: 600;">
          {currentDef.displayName}
        </p>
        <p style="font-family: monospace; font-size: 13px; color: var(--color-outline); letter-spacing: 0.05em;">
          {currentIndex + 1} / {queue.length}
        </p>
      </div>
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
        <span class="material-symbols-outlined block text-4xl mb-3" style="color: #f0c040; font-variation-settings: 'FILL' 1;">history</span>
        <p style="font-family: var(--font-cinzel, 'Cinzel', serif); font-size: 1.05rem; font-weight: 700; color: #ffdf96; margin-bottom: 6px; text-shadow: 0 0 12px rgba(240,192,64,0.3);">
          Resume Story Session?
        </p>
        <p class="text-sm mb-6" style="color: #9a907b;">
          {results.length} spin{results.length === 1 ? '' : 's'} done
        </p>
        <div class="flex gap-3">
          <button onclick={handleResume} class="metal-stamp-gold flex-1 py-2.5 rounded-lg text-sm font-bold"
            style="font-family: var(--font-cinzel, 'Cinzel', serif); letter-spacing: 0.1em;">
            Resume
          </button>
          <button onclick={handleStartOver} class="obsidian-slab flex-1 py-2.5 rounded-lg text-sm font-bold transition-all active:scale-95"
            style="font-family: var(--font-cinzel, 'Cinzel', serif); color: #9a907b; border: 1px solid #4e4635; letter-spacing: 0.1em;">
            Start Over
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
