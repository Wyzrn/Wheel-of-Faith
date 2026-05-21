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
  import { randomCharacterName } from '$lib/story/naming'
  import {
    classifyAbility, generatePowerDescription, generateWeaponDescription,
    generateArmorDescription, generateAbilityDescription, generateRaceDescription, generateArchetypeDescription,
    getAbilityTypeColor, getAbilityTypeIcon, ABILITY_BATTLE_EFFECT,
    type AbilityType,
  } from '$lib/content/descriptions'
  import { weaponMasteryLabels } from '$lib/content/weapon-mastery-labels'
  import { armorStrengthLabels } from '$lib/content/armor-strength-labels'
  import { titles } from '$lib/content/titles'
  import { backstories } from '$lib/content/backstories'
  import { redemptionProbability } from '$lib/game/redemption'
  import { computeOverallScore } from '$lib/game/scoreTier'

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
    redemptionSpin:      90,
    redemptionOutcome:  160,
    armorEnchantment:    55,
    armorType:           28,
    armor:               32,
    armorStrength:      216,
  }

  // ── Stat tier caps per stage (scores above this are dimmed / unspinnable) ────
  // Stage 1 (lv0) → B+ (54), Stage 2 (lv1) → SS+ (92), Stage 3 (lv2) → SSS+ (99),
  // Stage 4 (lv3) → Z (103), Stage 5 (lv4) → ZZZ (115), Stage 6 (lv5) → uncapped
  const STAGE_MAX_STAT_SCORES = [54, 92, 99, 103, 115, Infinity] as const

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
  const { stage = 1, spinClass, onSessionComplete, onCancel }: {
    stage?: number
    spinClass?: 'hero' | 'legend'
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
  let showNamingScreen = $state(false)
  let namingInput = $state('')

  // Track used abilities for greyed-out deduplication (mirrors main game pattern)
  let usedRacialAbilities = $state<Set<string>>(new Set())
  let usedArchetypeAbilities = $state<Set<string>>(new Set())

  // Pending stat bonus/penalty spins — keyed by stat category, consumed when that stat is spun
  let pendingStatBonuses = $state<Record<string, Array<'statBonus' | 'statPenalty'>>>({})

  // ── Spin meta helpers ─────────────────────────────────────────────────────────
  const STAT_EFFECTS: Record<string, string> = {
    strength:      'Contributes to Physical Damage (25%)',
    speed:         'Increases Initiative and multi-hit chance',
    agility:       'Increases Dodge Chance',
    durability:    'Contributes to Max HP (55%)',
    iq:            'Enables armor pierce, reduces stupidity chance',
    charisma:      'Enables Charm and Intimidate effects',
    fightingSkill: 'Primary contributor to Physical Damage (55%)',
    powerMastery:  'Primary contributor to Power Damage (60%)',
    weaponMastery: 'Contributes to Physical Damage (20%)',
    armorStrength: 'Increases Armor Reduction',
    potential:     'Enables burst damage, contributes to HP (10%)',
    energyLevel:   'Contributes to Power Damage (40%) and HP (15%)',
  }

  function getSpinMeta(category: string, label: string, element?: ElementType, grade?: ItemGrade): { description?: string; abilityType?: AbilityType; statEffect?: string } {
    if (category === 'power' || category === 'racialAbility' || category === 'archetypeAbility') {
      const abilityType = classifyAbility(label, element)
      const description = category === 'power'
        ? generatePowerDescription(label, element, grade)
        : generateAbilityDescription(label, element, grade)
      return { abilityType, description, statEffect: ABILITY_BATTLE_EFFECT[abilityType] }
    }
    if (category === 'weapon')    return { description: generateWeaponDescription(label, element, grade), statEffect: 'Increases Physical Damage in battle' }
    if (category === 'armor')     return { description: generateArmorDescription(label, element, grade), statEffect: 'Reduces incoming damage (Armor Reduction)' }
    if (category === 'race')      return { description: generateRaceDescription(label), statEffect: 'Determines racial abilities, stat tendencies, and weaknesses' }
    if (category === 'archetype') return { description: generateArchetypeDescription(label), statEffect: 'Defines combat role, ability pool, and power orientation' }
    if (category === 'raceSubType' || category === 'raceClass') return { statEffect: 'May grant stat bonus spins based on variant' }
    const statEffect = STAT_EFFECTS[category]
    if (statEffect) return { statEffect }
    return {}
  }

  // Result popup state — shown after each spin before advancing to the next
  let pendingResult = $state<{
    label: string
    categoryDisplayName: string
    tier?: string
    color: string
    element?: ElementType
    grade?: ItemGrade
    description?: string
    abilityType?: AbilityType
    statEffect?: string
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

    // Stat wheels: apply racial minimum tier floor + stage max cap
    if (STAT_CATEGORIES.has(currentDef.category)) {
      const raceResult = results.find(r => r.category === 'race')
      const race = races.find(r => r.label === raceResult?.resultLabel)
      const minTierIdx = race?.minStatTier != null ? TIER_ORDER.indexOf(race.minStatTier as import('$lib/game/scoreTier').TierGrade) : -1

      const segs = getSegmentsForCategory(currentDef.category as SpinCategory) as (WeightedSegment & { score?: number; tier?: string })[]
      return segs
        .filter(seg => {
          if (minTierIdx < 0 || !seg.tier) return true
          const tIdx = TIER_ORDER.indexOf(seg.tier as import('$lib/game/scoreTier').TierGrade)
          return tIdx < 0 || tIdx >= minTierIdx
        })
        .map(seg =>
          (seg.score !== undefined && seg.score > stageMaxStatScore)
            ? { ...seg, weight: 0, dimmed: true }
            : seg
        )
    }

    // Redemption spin: weight by current overall score
    if (currentDef.category === 'redemptionSpin') {
      const statCats = ['strength','speed','agility','durability','iq','charisma','fightingSkill','powerMastery','weaponMastery','potential','energyLevel']
      const statScores = Object.fromEntries(statCats.map(cat => [cat, results.find(r => r.category === cat)?.score ?? 0]))
      const overall = computeOverallScore(statScores)
      const p = redemptionProbability(overall)
      const rWeight = Math.max(1, Math.round(p * 100))
      const nWeight = Math.max(1, 100 - rWeight)
      return [{ label: 'Redemption', weight: rWeight }, { label: 'No Redemption', weight: nWeight }] as WeightedSegment[]
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

      // ── backstory / title: stat bonus grants ─────────────────────────────
      if (currentDef.category === 'backstory' || currentDef.category === 'title') {
        const pool = currentDef.category === 'backstory' ? backstories : titles
        const item = (pool as { label: string; statBonusGrants?: Record<string, string> }[]).find(b => b.label === resultLabel)
        if (item?.statBonusGrants && Object.keys(item.statBonusGrants).length > 0) {
          const immediateSlots: SpinDefinition[] = []
          for (const [stat, bonusType] of Object.entries(item.statBonusGrants)) {
            const alreadySpun = results.some(r => r.category === stat)
            if (alreadySpun) {
              const statName = stat.replace(/([A-Z])/g, ' $1').trim()
              const capStat = statName.charAt(0).toUpperCase() + statName.slice(1)
              immediateSlots.push({
                category: bonusType as 'statBonus' | 'statPenalty',
                displayName: `${capStat} ${bonusType === 'statBonus' ? 'Bonus' : 'Penalty'}`,
                targetStat: stat,
              })
            } else {
              pendingStatBonuses[stat] = [...(pendingStatBonuses[stat] ?? []), bonusType as 'statBonus' | 'statPenalty']
            }
          }
          if (immediateSlots.length > 0) queue.splice(currentIndex + 1, 0, ...immediateSlots)
        }
      }

      // ── weaponMastery: splice enchantment spins ───────────────────────────
      if (currentDef.category === 'weaponMastery') {
        const fl = weaponMasteryLabels.find(s => s.label === resultLabel)
        const tierIdx    = fl != null ? TIER_ORDER.indexOf(fl.tier) : -1
        const bMinusIdx  = TIER_ORDER.indexOf('B-' as import('$lib/game/scoreTier').TierGrade)
        const ssMinusIdx = TIER_ORDER.indexOf('SS-' as import('$lib/game/scoreTier').TierGrade)
        const zzMinusIdx = TIER_ORDER.indexOf('ZZ-' as import('$lib/game/scoreTier').TierGrade)
        let enchantsPerWeapon = 0
        if (tierIdx >= bMinusIdx)  enchantsPerWeapon = 1
        if (tierIdx >= ssMinusIdx) enchantsPerWeapon = 2
        if (tierIdx >= zzMinusIdx) enchantsPerWeapon = 3
        const weaponResults = results.filter(r => r.category === 'weapon' && r.resultLabel !== 'No Weapon (Unarmed)' && r.resultLabel !== 'No Weapon')
        const totalEnchants = weaponResults.length * enchantsPerWeapon
        if (totalEnchants > 0) {
          const enchantSlots: SpinDefinition[] = []
          let n = 1
          for (const wr of weaponResults) {
            const wName = wr.resultLabel.length > 18 ? wr.resultLabel.slice(0, 16) + '…' : wr.resultLabel
            for (let e = 0; e < enchantsPerWeapon; e++) {
              enchantSlots.push({
                category: 'weaponEnchantment' as const,
                displayName: totalEnchants > 1 ? `Enchantment ${n++} — ${wName}` : 'Weapon Enchantment',
              })
            }
          }
          queue.splice(currentIndex + 1, 0, ...enchantSlots)
        }
      }

      // ── armorStrength: splice enchantment spins ───────────────────────────
      if (currentDef.category === 'armorStrength') {
        const fl = armorStrengthLabels.find(s => s.label === resultLabel)
        const tierIdx    = fl != null ? TIER_ORDER.indexOf(fl.tier) : -1
        const bMinusIdx  = TIER_ORDER.indexOf('B-' as import('$lib/game/scoreTier').TierGrade)
        const ssMinusIdx = TIER_ORDER.indexOf('SS-' as import('$lib/game/scoreTier').TierGrade)
        const zzMinusIdx = TIER_ORDER.indexOf('ZZ-' as import('$lib/game/scoreTier').TierGrade)
        let enchantsPerArmor = 0
        if (tierIdx >= bMinusIdx)  enchantsPerArmor = 1
        if (tierIdx >= ssMinusIdx) enchantsPerArmor = 2
        if (tierIdx >= zzMinusIdx) enchantsPerArmor = 3
        const armorResults = results.filter(r => r.category === 'armor' && r.resultLabel !== 'No Armor')
        const totalArmorEnchants = armorResults.length * enchantsPerArmor
        if (totalArmorEnchants > 0) {
          const slots: SpinDefinition[] = []
          let n = 1
          for (const ar of armorResults) {
            const aName = ar.resultLabel.length > 18 ? ar.resultLabel.slice(0, 16) + '…' : ar.resultLabel
            for (let e = 0; e < enchantsPerArmor; e++) {
              slots.push({
                category: 'armorEnchantment' as const,
                displayName: totalArmorEnchants > 1 ? `Armor Enchant ${n++} — ${aName}` : 'Armor Enchantment',
              })
            }
          }
          queue.splice(currentIndex + 1, 0, ...slots)
        }
      }

      // ── redemptionSpin: splice outcome on win ─────────────────────────────
      if (currentDef.category === 'redemptionSpin' && resultLabel === 'Redemption') {
        queue.splice(currentIndex + 1, 0, { category: 'redemptionOutcome' as const, displayName: 'Redemption Outcome' })
      }

      // ── redemptionOutcome: apply effect ───────────────────────────────────
      if (currentDef.category === 'redemptionOutcome') {
        const STAT_CATS = ['strength','speed','agility','durability','iq','charisma','fightingSkill','potential','energyLevel','powerMastery','weaponMastery']

        const shiftStat = (cat: string, tiers: number) => {
          let idx = -1
          for (let i = results.length - 1; i >= 0; i--) { if (results[i].category === cat) { idx = i; break } }
          if (idx === -1 || !results[idx].tier) return
          const { tier: ng, score: ns, displayLabel: ndl } = applyStatShift(results[idx], tiers, cat)
          const segs = getSegmentsForCategory(cat as SpinCategory)
          const newLbl = ndl ? results[idx].resultLabel : (segs as { label?: string; tier?: string }[]).find(s => s.tier === ng)?.label ?? results[idx].resultLabel
          results[idx] = { ...results[idx], tier: ng, score: ns, resultLabel: newLbl, displayLabel: ndl }
        }

        if (resultLabel === 'All Stats +1 Tier') {
          for (const cat of STAT_CATS) shiftStat(cat, 1)
        } else if (resultLabel === 'Demigod Status (Unofficial)') {
          for (const cat of STAT_CATS) shiftStat(cat, 3)
        } else if (resultLabel === 'The DM Sighs and Gives You One Thing You Want') {
          for (const cat of STAT_CATS) shiftStat(cat, 2)
          queue.splice(currentIndex + 1, 0, { category: 'power' as const, displayName: "DM's Reluctant Gift" })
        } else if (resultLabel === 'Reroll Your Worst Stat') {
          const worstStat = STAT_CATS.reduce((worst, cat) => {
            const r = results.find(r => r.category === cat); const wr = results.find(r => r.category === worst)
            if (!r) return worst; if (!wr) return cat
            return (r.score ?? 0) < (wr.score ?? 0) ? cat : worst
          }, STAT_CATS[0])
          const worstIdx = results.findIndex(r => r.category === worstStat)
          if (worstIdx !== -1) results.splice(worstIdx, 1)
          queue.splice(currentIndex + 1, 0, { category: worstStat as SpinCategory, displayName: `Reroll: ${worstStat.replace(/([A-Z])/g, ' $1').trim().replace(/^\w/, c => c.toUpperCase())}`, isReroll: true })
        } else if (resultLabel === 'Double Your Best Stat') {
          const bestStat = STAT_CATS.reduce((best, cat) => {
            const r = results.find(r => r.category === cat); const br = results.find(r => r.category === best)
            if (!r) return best; if (!br) return cat
            return (r.score ?? 0) > (br.score ?? 0) ? cat : best
          }, STAT_CATS[0])
          shiftStat(bestStat, 5)
        } else if (resultLabel === 'God Tier Potential (One Use)') {
          const potIdx = results.findIndex(r => r.category === 'potential')
          if (potIdx !== -1) {
            const segs = getSegmentsForCategory('potential')
            const godLbl = (segs as { label?: string; tier?: string }[]).find(s => s.tier === 'God')?.label ?? 'God Tier Potential'
            results[potIdx] = { ...results[potIdx], tier: 'God', score: 100, resultLabel: godLbl }
          }
        } else if (resultLabel === 'Free God Tier Strength') {
          const strIdx = results.findIndex(r => r.category === 'strength')
          if (strIdx !== -1) {
            const segs = getSegmentsForCategory('strength')
            const godLbl = (segs as { label?: string; tier?: string }[]).find(s => s.tier === 'God')?.label ?? 'Lifts Reality Itself'
            results[strIdx] = { ...results[strIdx], tier: 'God', score: 100, resultLabel: godLbl }
          }
        } else if (resultLabel === 'Gain a Bonus Power' || resultLabel === 'Free Power Reroll') {
          queue.splice(currentIndex + 1, 0, { category: 'power' as const, displayName: 'Redemption Power' })
        } else if (resultLabel === 'Lose One Weakness') {
          const weakIdx = results.map((r, i) => ({ r, i })).reverse().find(({ r }) => r.category === 'weakness')?.i ?? -1
          if (weakIdx !== -1) results.splice(weakIdx, 1)
        } else if (resultLabel === 'Bonus Archetype Ability') {
          queue.splice(currentIndex + 1, 0, { category: 'archetypeAbility' as const, displayName: 'Redemption Archetype Ability' })
        } else if (resultLabel === 'Secret Fourth Racial Ability') {
          queue.splice(currentIndex + 1, 0, { category: 'racialAbility' as const, displayName: 'Secret Racial Ability' })
        } else if (resultLabel === 'Plot Armour (Permanent)') {
          shiftStat('durability', 4)
        } else if (resultLabel === 'Your Weakness Becomes a Strength (Somehow)') {
          const weakIdx = results.map((r, i) => ({ r, i })).reverse().find(({ r }) => r.category === 'weakness')?.i ?? -1
          if (weakIdx !== -1) results.splice(weakIdx, 1)
          queue.splice(currentIndex + 1, 0, { category: 'archetypeAbility' as const, displayName: 'Strength Born from Weakness' })
        } else if (resultLabel === 'Immunity to Your Own Weaknesses') {
          const weakIdxs: number[] = []; results.forEach((r, i) => { if (r.category === 'weakness') weakIdxs.push(i) })
          for (let i = weakIdxs.length - 1; i >= 0; i--) results.splice(weakIdxs[i], 1)
        } else if (resultLabel === 'Swap Race Abilities (Narrator Chooses)') {
          const count = Math.max(1, results.filter(r => r.category === 'racialAbility').length)
          const raIdxs: number[] = []; results.forEach((r, i) => { if (r.category === 'racialAbility') raIdxs.push(i) })
          for (let i = raIdxs.length - 1; i >= 0; i--) results.splice(raIdxs[i], 1)
          usedRacialAbilities = new Set()
          for (let i = 0; i < count; i++) queue.splice(currentIndex + 1 + i, 0, { category: 'racialAbility' as const, displayName: count > 1 ? `New Racial Ability ${i + 1}` : 'New Racial Ability' })
        } else if (resultLabel === 'Stat of Your Choice: S Tier') {
          const worstStat = STAT_CATS.reduce((worst, cat) => {
            const r = results.find(r => r.category === cat); const wr = results.find(r => r.category === worst)
            if (!r) return worst; if (!wr) return cat
            return (r.score ?? 0) < (wr.score ?? 0) ? cat : worst
          }, STAT_CATS[0])
          const targetIdx = results.findIndex(r => r.category === worstStat)
          if (targetIdx !== -1) {
            const segs = getSegmentsForCategory(worstStat as SpinCategory)
            const sLbl = (segs as { label?: string; tier?: string }[]).find(s => s.tier === 'S')?.label ?? 'S Tier'
            results[targetIdx] = { ...results[targetIdx], tier: 'S', score: gradeToScore('S'), resultLabel: sLbl }
          }
        } else if (resultLabel === 'Retroactive Legendary Race Upgrade') {
          queue.splice(currentIndex + 1, 0, { category: 'racialAbility' as const, displayName: 'Legendary Racial Ability' })
          queue.splice(currentIndex + 2, 0, { category: 'power' as const, displayName: 'Legendary Race Power' })
        } else if (resultLabel === 'The Universe Owes You One') {
          const bestStat = STAT_CATS.reduce((best, cat) => {
            const r = results.find(r => r.category === cat); const br = results.find(r => r.category === best)
            if (!r) return best; if (!br) return cat
            return (r.score ?? 0) > (br.score ?? 0) ? cat : best
          }, STAT_CATS[0])
          shiftStat(bestStat, 2)
          queue.splice(currentIndex + 1, 0, { category: 'power' as const, displayName: 'Universal Debt Power' })
        } else if (resultLabel === 'Reroll Everything (Chaos Edition)') {
          for (const cat of STAT_CATS) { const idx = results.findIndex(r => r.category === cat); if (idx !== -1) results.splice(idx, 1) }
          queue.splice(currentIndex + 1, 0, ...STAT_CATS.map(cat => ({
            category: cat as SpinCategory,
            displayName: `Reroll: ${cat.replace(/([A-Z])/g, ' $1').trim().replace(/^\w/, c => c.toUpperCase())}`,
            isReroll: true,
          })))
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
        ...getSpinMeta(currentDef.category, resultLabel, resultElement, resultGrade),
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
      const luckShift = spinClass === 'legend' ? 4 : spinClass === 'hero' ? 2 : 0
      const rawResults = $state.snapshot(results) as SpinResult[]
      const boostedResults = luckShift > 0
        ? rawResults.map(r =>
            STAT_CATEGORIES.has(r.category)
              ? { ...r, ...applyStatShift(r, luckShift, r.category) }
              : r
          )
        : rawResults
      doneEntry = buildRosterEntryFromResults({
        results: boostedResults,
        sessionStartedAt: session.startedAt,
        spinClass,
      })
      clearStorySession()
      isSessionDone = true
    }

  }

  // ── Continue from result popup ────────────────────────────────────────────────
  function handleContinue() {
    pendingResult = null
    if (isSessionDone && doneEntry) {
      namingInput = doneEntry.name
      showNamingScreen = true
      return
    }
    currentIndex = currentIndex + 1
  }

  function handleNamingSubmit() {
    if (!doneEntry) return
    const finalName = namingInput.trim() || doneEntry.name
    onSessionComplete({ ...doneEntry, name: finalName })
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

        <!-- Ability type badge (powers, racial/archetype abilities) -->
        {#if pendingResult.abilityType}
          {@const aColor = getAbilityTypeColor(pendingResult.abilityType)}
          {@const aIcon  = getAbilityTypeIcon(pendingResult.abilityType)}
          <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-xs font-semibold"
            style="background: {aColor}1a; border: 1px solid {aColor}55; color: {aColor};">
            <span class="material-symbols-outlined" style="font-size: 12px; font-variation-settings: 'FILL' 1;">{aIcon}</span>
            {pendingResult.abilityType}
          </div>
        {/if}

        <!-- Description text -->
        {#if pendingResult.description}
          <p class="text-xs leading-relaxed text-center"
            style="color: #9a907b; max-width: 260px; font-family: 'JetBrains Mono', monospace;">
            {pendingResult.description}
          </p>
        {/if}

        <!-- Battle stat effect -->
        {#if pendingResult.statEffect}
          <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-xs"
            style="background: rgba(240,192,64,0.07); border: 1px solid rgba(240,192,64,0.18); color: #9a907b;">
            <span class="material-symbols-outlined" style="font-size: 11px; color: #f0c040; font-variation-settings: 'FILL' 1;">bolt</span>
            {pendingResult.statEffect}
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
    <div class="px-4 pb-1.5 flex flex-col gap-0.5 overflow-y-auto" style="max-height: 160px;">
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

<!-- ── Naming screen ─────────────────────────────────────────────────────────── -->
{#if showNamingScreen && doneEntry}
  <div class="fixed inset-0 z-50 flex items-center justify-center px-4"
    style="background: rgba(7,7,13,0.97); backdrop-filter: blur(16px);">
    <div class="w-full max-w-sm flex flex-col gap-5">
      <div class="text-center">
        <p class="font-mono text-xs tracking-widest uppercase mb-1" style="color: #9a907b; letter-spacing: 0.18em;">Character Created</p>
        <h2 class="font-bold" style="font-family: var(--font-cinzel); font-size: 1.5rem; color: #ffdf96; text-shadow: 0 0 14px rgba(240,192,64,0.3);">Name Your Legend</h2>
        <p class="text-sm mt-1" style="color: #9a907b;">Give your fate-spun hero a name to be remembered by.</p>
      </div>

      <div class="flex gap-2 items-center">
        <input
          type="text"
          bind:value={namingInput}
          placeholder="Enter a name…"
          maxlength="40"
          class="flex-1 carved-groove rounded-lg px-4 py-3 text-center text-base outline-none transition-all"
          style="border: 1px solid rgba(240,192,64,0.25); color: #e4e1ee; font-family: var(--font-cinzel); caret-color: #f0c040;"
          onkeydown={(e) => e.key === 'Enter' && handleNamingSubmit()}
        />
        <button
          onclick={() => { namingInput = randomCharacterName() }}
          class="obsidian-slab rounded-lg px-3 py-3 flex-shrink-0"
          style="border: 1px solid rgba(240,192,64,0.2); color: var(--gold-bright); font-size: 18px; cursor: pointer;"
          title="Randomize name"
        >⟳</button>
      </div>

      <button
        onclick={handleNamingSubmit}
        class="metal-stamp-gold w-full py-3 rounded-xl font-bold font-mono text-sm tracking-widest"
        style="font-family: var(--font-cinzel);"
      >
        {namingInput.trim() ? 'Save & Continue' : 'Use Generated Name'}
      </button>
    </div>
  </div>
{/if}
