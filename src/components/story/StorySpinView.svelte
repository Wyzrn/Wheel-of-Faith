<script lang="ts">
  import { onMount } from 'svelte'
  import SpinWheel from '../SpinWheel.svelte'
  import TierBadge from '../TierBadge.svelte'
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
  import { weaponsByCategory } from '$lib/content/weapons'
  import { armorsByCategory } from '$lib/content/armors'
  import { getRacesForStage, racesToSegments, getArchetypesForStage, archetypesToSegments } from '$lib/story/raceTiers'
  import { ELEMENT_COLORS, ELEMENT_ICONS, ITEM_GRADE_INFO } from '$lib/content/elements'
  import { gradeToScore, TIER_THRESHOLDS, NO_NEGATIVE_STATS } from '$lib/game/scoreTier'
  import type { ElementType, ItemGrade } from '$lib/content/types'
  import { settings } from '$lib/settings.svelte'

  // ── Category hue map — mirrors main game so wheel colors match ───────────────
  const CATEGORY_HUES: Record<string, number> = {
    race:              340,
    raceSubType:       350,
    raceClass:         160,
    raceTransformation: 30,
    racialAbility:     320,
    archetype:         270,
    archetypeAbility:  250,
    backstory:         180,
    height:            120,
    strength:           30,
    speed:             190,
    agility:           140,
    durability:         40,
    iq:                220,
    charisma:          300,
    fightingSkill:      15,
    power:               0,
    powerMastery:      280,
    weaponType:        205,
    weapon:            200,
    weaponMastery:     210,
    weaponEnchantment:  50,
    potential:          55,
    energyLevel:        60,
    weakness:           25,
    statBonus:          105,
    statPenalty:          0,
    title:               45,
  }

  // ── Stat tier caps per stage (scores above this are dimmed / unspinnable) ────
  // Stage 1 → max B+ (score 54), Stage 2 → A+ (69), Stage 3 → S+ (82),
  // Stage 4 → SS+ (92), Stage 5 → SSS+ (99), Stage 6 → no limit
  const STAGE_MAX_STAT_SCORES = [54, 69, 82, 92, 99, Infinity] as const

  // ── STAT_CATEGORIES matching scoreTier.ts STAT_WEIGHTS keys ─────────────────
  const STAT_CATEGORIES = new Set([
    'strength', 'speed', 'agility', 'durability', 'iq',
    'charisma', 'fightingSkill', 'potential', 'energyLevel',
    'powerMastery', 'weaponMastery', 'armorStrength',
  ])

  const TIER_ORDER = TIER_THRESHOLDS.map(t => t.grade)

  function getVirtualTierIdx(result: SpinResult): number {
    if (result.displayLabel) {
      if (result.displayLabel.startsWith('F- -')) return -parseInt(result.displayLabel.slice(4))
      if (/^Absolute\+\d+$/.test(result.displayLabel)) return TIER_ORDER.length - 1 + parseInt(result.displayLabel.slice(9))
    }
    return result.tier ? TIER_ORDER.indexOf(result.tier as import('$lib/game/scoreTier').TierGrade) : 0
  }

  function applyStatShift(result: SpinResult, tierShift: number, statCategory: string): Pick<SpinResult, 'tier' | 'score' | 'displayLabel'> {
    const currentVti = getVirtualTierIdx(result)
    const rawVti = currentVti + tierShift
    const minVti = NO_NEGATIVE_STATS.has(statCategory) ? 0 : -20
    const maxVti = TIER_ORDER.length - 1 + 20
    const vti = Math.max(minVti, Math.min(maxVti, rawVti))
    if (vti < 0) return { tier: 'F-' as import('$lib/game/scoreTier').TierGrade, score: Math.max(-19, 1 + vti), displayLabel: `F- -${Math.abs(vti)}` }
    if (vti >= TIER_ORDER.length) return { tier: 'Absolute+' as import('$lib/game/scoreTier').TierGrade, score: 150 + (vti - (TIER_ORDER.length - 1)), displayLabel: `Absolute+${vti - (TIER_ORDER.length - 1)}` }
    return { tier: TIER_ORDER[vti], score: gradeToScore(TIER_ORDER[vti]), displayLabel: undefined }
  }

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

  // Pending stat bonus/penalty spins — keyed by stat category, consumed when that stat is spun
  let pendingStatBonuses = $state<Record<string, Array<'statBonus' | 'statPenalty'>>>({})

  // Result popup state — shown after each spin before advancing to the next
  let pendingResult = $state<{
    label: string
    categoryDisplayName: string
    tier?: string
    color: string
    element?: ElementType
    grade?: ItemGrade
  } | null>(null)
  let isSessionDone = $state(false)
  let doneEntry = $state<StoryRosterEntry | null>(null)

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

  let currentCategoryHue = $derived(
    currentDef ? (CATEGORY_HUES[currentDef.category] ?? 45) : 45
  )

  // Stage-aware race segments
  let stageRaceSegments = $derived(racesToSegments(getRacesForStage(stage)) as WeightedSegment[])

  // Stage-aware archetype segments
  let stageArchetypeSegments = $derived(archetypesToSegments(getArchetypesForStage(stage)) as WeightedSegment[])

  // Max allowed stat score for this stage (0-indexed)
  let stageMaxStatScore = $derived(STAGE_MAX_STAT_SCORES[Math.max(0, Math.min(5, stage - 1))])

  let currentSegments = $derived.by((): WeightedSegment[] => {
    if (!currentDef) return []

    // Race wheel: only show races available at current stage
    if (currentDef.category === 'race') {
      return stageRaceSegments
    }

    // Archetype wheel: only show archetypes available at current stage
    if (currentDef.category === 'archetype') {
      return stageArchetypeSegments
    }

    // Racial ability: use race-specific pool with dimming for used abilities
    if (currentDef.category === 'racialAbility') {
      const raceResult = results.find(r => r.category === 'race')
      if (raceResult) {
        const race = races.find(r => r.label === raceResult.resultLabel)
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

    // Weapon wheel: filter pool by previously-spun weapon type
    if (currentDef.category === 'weapon') {
      const typeResult = results.find(r => r.category === 'weaponType')
      const pool = typeResult ? weaponsByCategory[typeResult.resultLabel] : undefined
      return (pool ?? getSegmentsForCategory('weapon')) as WeightedSegment[]
    }

    // Armor wheel: filter pool by previously-spun armor type
    if (currentDef.category === 'armor') {
      const typeResult = results.find(r => r.category === 'armorType')
      const pool = typeResult ? armorsByCategory[typeResult.resultLabel] : undefined
      return (pool ?? getSegmentsForCategory('armor')) as WeightedSegment[]
    }

    // Stat wheels: cap tiers by stage — dim and zero-weight segments above the stage max
    if (STAT_CATEGORIES.has(currentDef.category)) {
      const segs = getSegmentsForCategory(currentDef.category as SpinCategory) as (WeightedSegment & { score?: number })[]
      return segs.map(seg =>
        (seg.score !== undefined && seg.score > stageMaxStatScore)
          ? { ...seg, weight: 0, dimmed: true }
          : seg
      )
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
    pendingStatBonuses = {}
    pendingResult = null
    isSessionDone = false
    doneEntry = null
    showResumePrompt = false
  }

  function formatCategory(cat: string): string {
    return cat.replace(/([A-Z])/g, ' $1').replace(/^[a-z]/, s => s.toUpperCase()).trim()
  }

  // ── Spin completion — shows result popup before advancing ─────────────────────
  function handleSpinComplete(resultIndex: number, resultLabel: string) {
    if (!currentDef) return

    // Grab element + grade from the landed segment before any queue mutation
    const landedSegment = currentSegments.find(s => s.label === resultLabel)
    const resultElement = landedSegment?.element
    const resultGrade = landedSegment?.grade

    const spinResult: SpinResult = {
      step: results.length + 1,
      category: currentDef.category,
      resultLabel,
      resultIndex,
      timestamp: new Date().toISOString(),
    }

    // ── statBonus / statPenalty: apply tier shift to target stat ──────────────
    if (currentDef.category === 'statBonus' || currentDef.category === 'statPenalty') {
      const tierShift = parseInt(resultLabel)
      const targetStat = currentDef.targetStat
      if (targetStat) {
        let targetIdx = -1
        for (let i = results.length - 1; i >= 0; i--) {
          if (results[i].category === targetStat) { targetIdx = i; break }
        }
        if (targetIdx !== -1 && results[targetIdx].tier) {
          const { tier: newGrade, score: newScore, displayLabel: newDisplayLabel } =
            applyStatShift(results[targetIdx], tierShift, targetStat)
          const statSegs = getSegmentsForCategory(targetStat as SpinCategory)
          const newLabel = newDisplayLabel
            ? results[targetIdx].resultLabel
            : (statSegs as { label?: string; tier?: string }[]).find(s => s.tier === newGrade)?.label
              ?? results[targetIdx].resultLabel
          results[targetIdx] = { ...results[targetIdx], tier: newGrade, score: newScore, resultLabel: newLabel, displayLabel: newDisplayLabel }
        }
      }
      results.push(spinResult)
      const isBonus = currentDef.category === 'statBonus'
      pendingResult = {
        label: `${resultLabel} to ${formatCategory(targetStat ?? 'Stat')}`,
        categoryDisplayName: currentDef.displayName,
        color: isBonus ? '#34d399' : '#ef4444',
      }
    } else {
      // Enrich stat spins with tier + score from segment data
      let resultColor = `hsl(${currentCategoryHue}, 70%, 65%)`
      if (STAT_CATEGORIES.has(currentDef.category)) {
        // Splice any pending bonus/penalty spins for this stat before advancing
        if (pendingStatBonuses[currentDef.category]?.length) {
          const bonusQueue = pendingStatBonuses[currentDef.category]
          const bonusSlots = bonusQueue.map((bonusType, i) => ({
            category: bonusType as 'statBonus' | 'statPenalty',
            displayName: bonusQueue.length > 1
              ? `${currentDef!.displayName} ${bonusType === 'statBonus' ? 'Bonus' : 'Penalty'} ${i + 1}`
              : `${currentDef!.displayName} ${bonusType === 'statBonus' ? 'Bonus' : 'Penalty'}`,
            targetStat: currentDef!.category,
          }))
          queue.splice(currentIndex + 1, 0, ...bonusSlots)
          delete pendingStatBonuses[currentDef.category]
        }

        const segs = getSegmentsForCategory(currentDef.category as SpinCategory)
        const matched = (segs as { label: string; weight: number; tier?: string; score?: number; color?: string }[])
          .find(s => s.label === resultLabel)
        if (matched?.tier !== undefined) spinResult.tier = matched.tier as SpinResult['tier']
        if (matched?.score !== undefined) spinResult.score = matched.score
        if (matched?.color) resultColor = matched.color
      }

      // ── Post-spin queue splicing ───────────────────────────────────────────
      const insertSlots: SpinDefinition[] = []

      if (currentDef.category === 'race') {
        const race = races.find(r => r.label === resultLabel)
        if (race) {
          if (race.subTypePool?.length) {
            insertSlots.push({ category: 'raceSubType' as const, displayName: `${resultLabel} Sub-Type` })
          }
          if (race.classPool?.length) {
            insertSlots.push({ category: 'raceClass' as const, displayName: `${resultLabel} Class` })
          }
          const count = race.abilitySpinCount ?? 1
          for (let i = 0; i < count; i++) {
            insertSlots.push({
              category: 'racialAbility' as const,
              displayName: count > 1 ? `Racial Ability ${i + 1}` : 'Racial Ability',
            })
          }
          const extraPowers = race.extraPowerSpins ?? 0
          for (let i = 0; i < extraPowers; i++) {
            insertSlots.push({ category: 'power' as const, displayName: extraPowers > 1 ? `Racial Power ${i + 1}` : 'Racial Power' })
          }
          const weaknessCount = race.weaknessCount ?? deriveWeaknessCount(race.weaknessProbabilityModifier ?? 1.0)
          for (let i = 0; i < weaknessCount; i++) {
            insertSlots.push({ category: 'weakness' as const, displayName: weaknessCount > 1 ? `Weakness ${i + 1}` : 'Weakness' })
          }
        }
        if (insertSlots.length > 0) queue.splice(currentIndex + 1, 0, ...insertSlots)
      }

      if (currentDef.category === 'raceSubType') {
        const raceResult = results.find(r => r.category === 'race')
        const race = races.find(r => r.label === raceResult?.resultLabel)
        const subTypeItem = race?.subTypePool?.find(s => s.label === resultLabel)
        if (subTypeItem?.statBonusGrants) {
          for (const [stat, bonusType] of Object.entries(subTypeItem.statBonusGrants)) {
            pendingStatBonuses[stat] = [...(pendingStatBonuses[stat] ?? []), bonusType]
          }
        }
      }

      if (currentDef.category === 'raceClass') {
        const raceResult = results.find(r => r.category === 'race')
        const race = races.find(r => r.label === raceResult?.resultLabel)
        const classItem = race?.classPool?.find(c => c.label === resultLabel)
        if (classItem?.statBonusGrants) {
          for (const [stat, bonusType] of Object.entries(classItem.statBonusGrants)) {
            pendingStatBonuses[stat] = [...(pendingStatBonuses[stat] ?? []), bonusType]
          }
        }
        // Class-specific power pool or granted powers
        if (classItem?.powerPool?.length) {
          const powerSlots = classItem.powerPool.slice(0, 1).map(() => ({
            category: 'power' as const,
            displayName: 'Class Power',
          }))
          if (powerSlots.length > 0) queue.splice(currentIndex + 1, 0, ...powerSlots)
        }
      }

      if (currentDef.category === 'archetype') {
        const archetype = archetypes.find(a => a.label === resultLabel)
        if (archetype) {
          const abilityLabel = archetype.abilitySpinDisplayName ?? 'Archetype Ability'
          const count = archetype.abilitySpinCount ?? 2
          const abilitySlots: SpinDefinition[] = []
          for (let i = 0; i < count; i++) {
            abilitySlots.push({
              category: 'archetypeAbility' as const,
              displayName: count > 1 ? `${abilityLabel} ${i + 1}` : abilityLabel,
            })
          }
          const extraPowers = archetype.extraPowerSpins ?? 0
          for (let i = 0; i < extraPowers; i++) {
            abilitySlots.push({ category: 'power' as const, displayName: extraPowers > 1 ? `Bonus Power ${i + 1}` : 'Bonus Power' })
          }
          if (abilitySlots.length > 0) queue.splice(currentIndex + 1, 0, ...abilitySlots)

          // statBonusGrants — deferred to fire right after each relevant stat spin
          if (archetype.statBonusGrants) {
            for (const [stat, bonusType] of Object.entries(archetype.statBonusGrants)) {
              pendingStatBonuses[stat] = [...(pendingStatBonuses[stat] ?? []), bonusType as 'statBonus' | 'statPenalty']
            }
          }
        }
      }

      if (currentDef.category === 'racialAbility') usedRacialAbilities.add(resultLabel)
      if (currentDef.category === 'archetypeAbility') usedArchetypeAbilities.add(resultLabel)

      results.push(spinResult)

      // ── weaponType: None → skip weapon + weaponMastery spins ────────────
      if (currentDef.category === 'weaponType' && resultLabel === 'None') {
        const weaponIdx  = queue.findIndex((s, i) => i > currentIndex && s.category === 'weapon')
        const masteryIdx = queue.findIndex((s, i) => i > currentIndex && s.category === 'weaponMastery')
        if (masteryIdx !== -1) queue.splice(masteryIdx, 1)
        if (weaponIdx  !== -1) queue.splice(weaponIdx, 1)
        results.push({ step: results.length + 1, category: 'weapon',        resultLabel: 'No Weapon', resultIndex: 0, timestamp: new Date().toISOString() })
        results.push({ step: results.length + 1, category: 'weaponMastery', resultLabel: 'Unarmed',   resultIndex: 0, timestamp: new Date().toISOString() })
      }

      // ── armorType: None → skip armor + armorStrength spins ──────────────
      if (currentDef.category === 'armorType' && resultLabel === 'None') {
        const armorIdx    = queue.findIndex((s, i) => i > currentIndex && s.category === 'armor')
        const strengthIdx = queue.findIndex((s, i) => i > currentIndex && s.category === 'armorStrength')
        if (strengthIdx !== -1) queue.splice(strengthIdx, 1)
        if (armorIdx    !== -1) queue.splice(armorIdx, 1)
        results.push({ step: results.length + 1, category: 'armor',         resultLabel: 'No Armor',   resultIndex: 0, timestamp: new Date().toISOString() })
        results.push({ step: results.length + 1, category: 'armorStrength', resultLabel: 'Unarmored',  resultIndex: 0, timestamp: new Date().toISOString() })
      }

      // Show result popup — user must tap Continue before advancing
      pendingResult = {
        label: resultLabel,
        categoryDisplayName: currentDef.displayName,
        tier: spinResult.tier,
        color: resultColor,
        element: resultElement,
        grade: resultGrade,
      }
    }

    const nextIndex = currentIndex + 1

    saveStorySession({
      ...session,
      completedSpins: $state.snapshot(results),
      spinQueue: $state.snapshot(queue),
      currentSpinIndex: nextIndex,
    } as StorySessionState)

    // Prepare completion entry if this was the last spin
    if (nextIndex >= queue.length) {
      doneEntry = buildRosterEntryFromResults({
        results: $state.snapshot(results),
        sessionStartedAt: session.startedAt,
      })
      clearStorySession()
      isSessionDone = true
    }

  }

  // ── Continue from result popup ────────────────────────────────────────────────
  function handleContinue() {
    pendingResult = null
    if (isSessionDone && doneEntry) {
      onSessionComplete(doneEntry)
      return
    }
    currentIndex = currentIndex + 1
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

  <!-- Spin wheel (remounts on each new spin via {#key}) -->
  {#if currentDef && !showResumePrompt}
    <div class="flex flex-col items-center gap-4">
      {#key currentIndex}
        <SpinWheel
          segments={currentSegments}
          categoryHue={currentCategoryHue}
          onSpinComplete={handleSpinComplete}
          soundEnabled={settings.soundEnabled}
          effectsEnabled={settings.effectsEnabled}
          spinSpeedMultiplier={settings.spinSpeed}
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

<!-- ── Result popup — shown after every spin before advancing ────────────────── -->
{#if pendingResult}
  <div
    class="fixed inset-0 z-40 flex items-center justify-center px-4"
    style="background: rgba(7,7,13,0.88); backdrop-filter: blur(12px);"
  >
    <div
      class="obsidian-slab w-full max-w-sm rounded-xl p-7 text-center relative overflow-hidden"
      style="border: 1px solid {pendingResult.color}44; box-shadow: 0 0 60px rgba(0,0,0,0.9), 0 0 40px {pendingResult.color}18;"
    >
      <div class="noise-overlay"></div>
      <div class="absolute top-3 left-3 w-7 h-7" style="border-top: 2px solid {pendingResult.color}55; border-left: 2px solid {pendingResult.color}55;"></div>
      <div class="absolute top-3 right-3 w-7 h-7" style="border-top: 2px solid {pendingResult.color}55; border-right: 2px solid {pendingResult.color}55;"></div>
      <div class="absolute bottom-3 left-3 w-7 h-7" style="border-bottom: 2px solid {pendingResult.color}55; border-left: 2px solid {pendingResult.color}55;"></div>
      <div class="absolute bottom-3 right-3 w-7 h-7" style="border-bottom: 2px solid {pendingResult.color}55; border-right: 2px solid {pendingResult.color}55;"></div>

      <div class="relative z-10 flex flex-col items-center gap-3">
        <!-- Category label -->
        <p class="font-mono text-xs tracking-widest uppercase" style="color: var(--color-outline);">
          {pendingResult.categoryDisplayName}
        </p>

        <!-- Result label -->
        <p
          class="font-bold leading-snug"
          style="font-family: var(--font-cinzel, 'Cinzel', serif); font-size: clamp(1.1rem, 5vw, 1.5rem); color: {pendingResult.color}; filter: drop-shadow(0 0 10px {pendingResult.color}66); max-width: 280px;"
        >
          {pendingResult.label}
        </p>

        <!-- Tier badge for stat spins -->
        {#if pendingResult.tier}
          <div class="mt-1">
            <TierBadge grade={pendingResult.tier as import('$lib/game/scoreTier').TierGrade} />
          </div>
        {/if}

        <!-- Element + grade badges for powers, weapons, abilities, etc. -->
        {#if pendingResult.element || pendingResult.grade}
          {@const elColor = pendingResult.element ? ELEMENT_COLORS[pendingResult.element] : '#9a907b'}
          {@const gradeInfo = pendingResult.grade ? ITEM_GRADE_INFO[pendingResult.grade] : null}
          <div class="flex items-center gap-2 flex-wrap justify-center mt-1">
            {#if pendingResult.element}
              <span class="flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-xs font-semibold"
                style="background: {elColor}1a; border: 1px solid {elColor}55; color: {elColor};">
                <img src={ELEMENT_ICONS[pendingResult.element]} class="w-3.5 h-3.5 object-contain" alt={pendingResult.element}
                  style="filter: drop-shadow(0 0 3px {elColor});" />
                {pendingResult.element}
              </span>
            {/if}
            {#if gradeInfo}
              <span class="px-2.5 py-1 rounded-full font-mono text-xs font-bold"
                style="background: {gradeInfo.color}22; border: 1px solid {gradeInfo.color}55; color: {gradeInfo.color}; box-shadow: 0 0 8px {gradeInfo.glow};">
                {pendingResult.grade} · {gradeInfo.label}
              </span>
            {/if}
          </div>
        {/if}

        <!-- Divider -->
        <div class="w-full mt-1" style="height: 1px; background: linear-gradient(90deg, transparent, {pendingResult.color}44, transparent);"></div>

        <!-- Continue button -->
        <button
          onclick={handleContinue}
          class="metal-stamp-gold w-full py-3 rounded-lg font-bold text-sm tracking-widest"
          style="font-family: var(--font-cinzel, 'Cinzel', serif); margin-top: 4px;"
        >
          {isSessionDone ? 'Complete!' : 'Continue →'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ── Running spin log ───────────────────────────────────────────────────────── -->
{#if results.length > 0 && !showResumePrompt && !pendingResult}
  <div class="fixed bottom-0 left-0 right-0 z-10"
    style="background: rgba(7,7,13,0.93); border-top: 1px solid rgba(240,192,64,0.12); backdrop-filter: blur(12px); padding-bottom: max(8px, env(safe-area-inset-bottom, 8px));">
    <p class="px-4 pt-2 font-mono tracking-widest uppercase" style="color: #9a907b; font-size: 9px; letter-spacing: 0.18em;">Obtained this spin</p>
    <div class="px-4 pb-1.5 flex flex-col gap-0.5 overflow-y-auto" style="max-height: 88px;">
      {#each [...results].filter(r => r.category !== 'statBonus' && r.category !== 'statPenalty').reverse() as r}
        <div class="flex items-center gap-2 min-w-0">
          <span class="font-mono flex-shrink-0" style="color: hsl({CATEGORY_HUES[r.category] ?? 45}, 60%, 62%); font-size: 9px; min-width: 80px; max-width: 100px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">{formatCategory(r.category)}</span>
          <span class="font-mono truncate" style="color: var(--color-on-surface); font-size: 10px;">{r.displayLabel ?? r.resultLabel}</span>
          {#if r.tier}
            <span class="font-mono font-bold flex-shrink-0" style="color: hsl({CATEGORY_HUES[r.category] ?? 45}, 65%, 65%); font-size: 9px;">{r.tier}</span>
          {/if}
        </div>
      {/each}
    </div>
  </div>
{/if}

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
