<script lang="ts">
  import { onMount } from 'svelte'
  import SpinWheel from '../SpinWheel.svelte'
  import TierBadge from '../TierBadge.svelte'
  import SpinResultReveal from '../SpinResultReveal.svelte'
  import SpinProgressDots from '../SpinProgressDots.svelte'
  import FirstTimeTooltip from '../FirstTimeTooltip.svelte'
  import StreakBanner from '../StreakBanner.svelte'
  import { detectStreak, type Streak } from '$lib/streaks'
  import { saveToHallOfFame } from '$lib/hallOfFame'
  import type { ResolvedMeta } from '$lib/spinResultMeta'
  import {
    createStorySession,
    loadStorySession,
    saveStorySession,
    clearStorySession,
    buildRosterEntryFromResults,
    type StorySessionState,
  } from '$lib/story/storySession'
  import { buildInitialQueue, getSegmentsForCategory, limitBreakSegmentsFor, LIMIT_BREAK_SHIFT, type SpinCategory } from '$lib/game/spinQueue'
  import { getRaceWheelSegments, getRaceWheelSegmentDescription } from '$lib/game/raceWheelRegistry'
  import { generateStatDescription, STAT_DESCRIPTION_CATEGORIES } from '$lib/content/statDescriptions'
  import { generateExtraDescription, EXTRA_DESCRIPTION_CATEGORIES } from '$lib/content/extraDescriptions'
  import { resolveMutatedSegments, getMutation } from '$lib/game/archetypeMutations'
  import { rollSecretEvent, applyEventToResults, type SecretEventId } from '$lib/game/secretEvents'
  import SecretEventOverlay from '../SecretEventOverlay.svelte'
  import type { SpinDefinition } from '$lib/game/spinQueue'
  import type { SpinResult, WeightedSegment } from '$lib/session/types'
  import type { StoryRosterEntry } from '$lib/story/types'
  import { races, getRace } from '$lib/content/races'
  import { archetypes, getArchetype } from '$lib/content/archetypes'
  import { weaponsByCategory } from '$lib/content/weapons'
  import { armorsByCategory } from '$lib/content/armors'
  import { getRacesForStage, racesToSegments, getArchetypesForStage, archetypesToSegments } from '$lib/story/raceTiers'
  import { ELEMENT_COLORS, ELEMENT_ICONS, ITEM_GRADE_INFO } from '$lib/content/elements'
  import { resolveLandingForCategory } from '$lib/landingColors'
  import { buildIdentityCard } from '$lib/identityCard'
  import { twistByKey, RACE_TWIST_TRIGGERS, ARCHETYPE_TWIST_TRIGGERS } from '$lib/twists'
  import { gradeToScore, TIER_THRESHOLDS, NO_NEGATIVE_STATS } from '$lib/game/scoreTier'
  import type { ElementType, ItemGrade } from '$lib/content/types'
  import { settings } from '$lib/settings.svelte'
  import { gamepasses } from '$lib/stores/shop.svelte'
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
    twistSpin:           45,  // fallback; twistSpin uses twist.hue when set
  }

  // ── Stat tier caps per stage (scores above this are dimmed / unspinnable) ────
  // Mirror of saveSlots STAT_LEVEL_MAX_SCORES; stage = playerLevel + 1.
  // Stage 1 (L0) → F+ 54   · Stage 2 (L1) → SS- 92  · Stage 3 (L2) → SSS+ 99
  // Stage 4 (L3) → ZZ- 107 · Stage 5 (L4) → Cosmic- 119
  // Stage 6 (L5) → Celestial- 131 · Stage 7 (L6) → Primordial- 143
  // Stage 8 (L7) → Transcendent- 155 · Stage 9 (L8) → no cap
  const STAGE_MAX_STAT_SCORES = [54, 92, 99, 107, 119, 131, 143, 155, Infinity] as const

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
    if (vti >= TIER_ORDER.length) return { tier: 'Infinite+' as import('$lib/game/scoreTier').TierGrade, score: 165 + (vti - (TIER_ORDER.length - 1)), displayLabel: `Infinite+${vti - (TIER_ORDER.length - 1)}` }
    return { tier: TIER_ORDER[vti], score: gradeToScore(TIER_ORDER[vti]), displayLabel: undefined }
  }

  function deriveWeaknessCount(modifier: number): number {
    if (modifier < 0.65) return 0
    if (modifier < 1.15) return 1
    if (modifier < 1.5)  return 2
    return 3
  }

  // ── Props ─────────────────────────────────────────────────────────────────────
  const { stage = 1, spinClass, onSessionComplete, onCancel, onDiscard }: {
    stage?: number
    spinClass?: 'hero' | 'legend' | 'paragon'
    onSessionComplete: (entry: StoryRosterEntry) => void
    onCancel: () => void
    // Discard the in-progress session. The spin consumed when the session
    // started stays spent (the parent does NOT refund), so the player can't
    // abuse "start over" to re-roll a bad race for free.
    onDiscard: () => void
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
  // Element locked in by a twist sub-spin (Bender, Demi-God, Cursed
  // Sorcerer, Breath of Sun, etc.). Power + ability spins downstream
  // prefer this element when set. Null = no lock. Mirrors main game.
  let lockedElement = $state<ElementType | null>(null)
  // Wheel viewport-center coords captured at landing time so the reveal
  // modal anchors over the wheel, not the viewport center.
  let wheelCenterX = $state<number | null>(null)
  let wheelCenterY = $state<number | null>(null)
  // Streak banner derived from results (S- and above stats). Re-animates
  // when the streak grows, ignored when it stays the same length.
  let currentStreak = $derived<Streak | null>(detectStreak(results))
  // Replay trigger — incremented by the reveal's Replay button.
  let replayTriggerKey = $state(0)

  // ── Possessed archetype handler tables (mirror main game) ──────────────
  // Stat bonuses applied per possession-strength tier. 5% guarantees at
  // least 1 stat boost (per spec).
  const POSSESSION_GRANTS: Record<string, Record<string, 'statBonus' | 'statPenalty'>> = {
    'Barely a Whisper (5%)':        { charisma: 'statBonus' },
    'A Flicker of Influence (20%)': { charisma: 'statBonus' },
    'Shared Consciousness (40%)':   { charisma: 'statBonus', iq: 'statBonus' },
    'Dominant Presence (60%)':      { strength: 'statBonus', charisma: 'statBonus' },
    'Consuming Takeover (80%)':     { strength: 'statBonus', speed: 'statBonus', charisma: 'statBonus' },
    'Full Possession (100%)':       { strength: 'statBonus', speed: 'statBonus', iq: 'statBonus', durability: 'statBonus' },
  }
  // Higher % grafts more of the possessing race's identity onto the
  // character — race-specific traits, an aspect (class), and at full
  // possession, an awakening (transformation).
  const POSSESSION_SPLICE: Record<string, { abilities: number; classSpin: boolean; transformation: boolean }> = {
    'Barely a Whisper (5%)':        { abilities: 0, classSpin: false, transformation: false },
    'A Flicker of Influence (20%)': { abilities: 1, classSpin: false, transformation: false },
    'Shared Consciousness (40%)':   { abilities: 1, classSpin: false, transformation: false },
    'Dominant Presence (60%)':      { abilities: 2, classSpin: true,  transformation: false },
    'Consuming Takeover (80%)':     { abilities: 2, classSpin: true,  transformation: false },
    'Full Possession (100%)':       { abilities: 3, classSpin: true,  transformation: true  },
  }
  // Tracks the index in results[] of the PRIMARY result for the current
  // spin reveal — mirrors main game so identityCard lookups don't pick
  // up a trailing grantedPower entry instead of the actual race/archetype.
  let primarySpinResultIndex = $state<number | null>(null)

  // ── Wildcard state ────────────────────────────────────────────────────────
  let wildcardPhase = $state<'idle' | 'flashing' | 'reveal'>('idle')
  let wildcardOutcomeType = $state('')
  let wildcardOutcomeLabel = $state('')
  let wildcardOutcomeDesc = $state('')
  let wildcardPendingLabel = $state('')
  let wildcardPendingIndex = $state(0)
  let skipWildcard = false

  const STAT_WILDCARD_OUTCOMES = [
    { type: 'blessing',    weight: 12, outcomeLabel: "FATE'S BLESSING",       desc: '+3 tiers above your roll. The wheel smiles upon you.' },
    { type: 'curse',       weight: 10, outcomeLabel: "FATE'S CURSE",          desc: '-3 tiers below your roll. The wheel mocks you.' },
    { type: 'reroll',      weight: 14, outcomeLabel: 'CHAOS REROLL',          desc: 'Fate discards this roll and gives you another spin immediately.' },
    { type: 'mirror',      weight: 10, outcomeLabel: 'MIRROR OF GLORY',       desc: 'This stat mirrors your highest result so far.' },
    { type: 'chaos',       weight: 10, outcomeLabel: 'PURE CHAOS',            desc: 'All modifiers ignored. Fate rolls the dice alone.' },
    { type: 'power_gift',  weight: 10, outcomeLabel: 'GIFT OF POWER',         desc: 'Your roll stands — and fate grants you a bonus power spin.' },
    { type: 'c_tier',      weight:  8, outcomeLabel: 'FROZEN MEDIOCRITY',     desc: 'Neither cursed nor blessed. This stat is locked to C tier.' },
    { type: 'double_edge', weight: 10, outcomeLabel: 'DOUBLE-EDGED FATE',     desc: '+4 tiers on this stat — but a new weakness awaits.' },
    { type: 'shared',      weight: 12, outcomeLabel: 'SHARED FATE',           desc: 'This stat bonds to the one before it — matching tier.' },
    { type: 'primordial',  weight:  2, outcomeLabel: 'PRIMORDIAL ASCENSION',  desc: 'This stat transcends all limits. Primordial tier granted.' },
    { type: 'forgotten',   weight:  2, outcomeLabel: 'FORGOTTEN BY FATE',     desc: 'This stat is erased. F- tier locked in.' },
  ]

  function pickWeighted<T extends { weight: number }>(table: T[]): T {
    const total = table.reduce((s, o) => s + o.weight, 0)
    let r = Math.random() * total
    for (const o of table) { r -= o.weight; if (r <= 0) return o }
    return table[table.length - 1]
  }

  function shiftTierLabel(currentLabel: string, shift: number, statSegs: { label: string; tier?: string }[]): string {
    const currentSeg = statSegs.find(s => s.label === currentLabel)
    if (!currentSeg?.tier) return currentLabel
    const curIdx = TIER_ORDER.indexOf(currentSeg.tier as import('$lib/game/scoreTier').TierGrade)
    if (curIdx < 0) return currentLabel
    const newIdx = Math.max(0, Math.min(TIER_ORDER.length - 1, curIdx + shift))
    return statSegs.find(s => s.tier === TIER_ORDER[newIdx])?.label ?? currentLabel
  }

  function handleWildcardContinue() {
    const label = wildcardPendingLabel
    const index = wildcardPendingIndex
    const type = wildcardOutcomeType

    if (currentDef) {
      if (type === 'reroll') {
        queue.splice(currentIndex + 1, 0, { category: currentDef.category as SpinCategory, displayName: `${currentDef.displayName} (Reroll)`, isReroll: true })
      } else if (type === 'power_gift') {
        queue.splice(currentIndex + 1, 0, { category: 'power' as const, displayName: 'Wildcard Bonus Power' })
      } else if (type === 'double_edge') {
        queue.splice(currentIndex + 1, 0, { category: 'weakness' as const, displayName: 'Wildcard Weakness' })
      } else if (type === 'itemBonus') {
        queue.splice(currentIndex + 1, 0, { category: currentDef.category as SpinCategory, displayName: `Bonus ${currentDef.displayName}` })
      }
    }

    wildcardPhase = 'idle'
    wildcardOutcomeType = ''
    wildcardOutcomeLabel = ''
    wildcardOutcomeDesc = ''
    wildcardPendingLabel = ''

    skipWildcard = true
    handleSpinComplete(index, label)
  }

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

  function getSpinMeta(category: string, label: string, element?: ElementType, grade?: ItemGrade, tier?: string): { description?: string; abilityType?: AbilityType; statEffect?: string } {
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
    if (category === 'raceSubType' || category === 'raceClass' || category === 'raceTransformation') {
      const desc = generateExtraDescription(category, label, element, grade)
      return { description: desc, statEffect: 'May grant stat bonus spins based on variant' }
    }
    if (category === 'raceWheel') {
      // Pull the segment's authored description from the registry. Falls
      // back to a generic line so the reveal panel still has copy when an
      // older save replays a wheel that's since lost its description.
      const def = queue[currentIndex]
      const raceResult = results.find(r => r.category === 'race')
      const raceLabel = def?.forRace ?? raceResult?.resultLabel ?? ''
      const desc = def?.raceWheelId
        ? getRaceWheelSegmentDescription(raceLabel, def.raceWheelId, label)
        : undefined
      return { description: desc, statEffect: 'Shapes how this race feels mid-spin — biases later wheels, archetype synergy, and event chances.' }
    }
    const statEffect = STAT_EFFECTS[category]
    if (statEffect) {
      const statDesc = STAT_DESCRIPTION_CATEGORIES.has(category)
        ? generateStatDescription(category, tier, label)
        : ''
      return statDesc ? { description: statDesc, statEffect } : { statEffect }
    }
    if (EXTRA_DESCRIPTION_CATEGORIES.has(category)) {
      const desc = generateExtraDescription(category, label, element, grade)
      return desc ? { description: desc } : {}
    }
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

  // Per-twist hue override (twistSpin uses the registered hue), otherwise
  // fall back to the category default. Mirrors main game.
  let currentCategoryHue = $derived(
    currentDef?.category === 'twistSpin' && currentDef.twistKind
      ? (twistByKey(currentDef.twistKind)?.hue ?? CATEGORY_HUES.twistSpin ?? 45)
      : currentDef ? (CATEGORY_HUES[currentDef.category] ?? 45) : 45
  )

  // Stage-aware race segments
  let stageRaceSegments = $derived(racesToSegments(getRacesForStage(stage)) as WeightedSegment[])

  // Stage-aware archetype segments
  let stageArchetypeSegments = $derived(archetypesToSegments(getArchetypesForStage(stage)) as WeightedSegment[])

  // Max allowed stat score for this stage (0-indexed)
  let stageMaxStatScore = $derived(STAGE_MAX_STAT_SCORES[Math.max(0, Math.min(STAGE_MAX_STAT_SCORES.length - 1, stage - 1))])

  let currentSegments = $derived.by((): WeightedSegment[] => {
    if (!currentDef) return []

    // Hybrid parent race spin — filter Hybrid out so the parent wheel
    // doesn't recurse Hybrid → Hybrid forever. Mirrors main game.
    if (currentDef.category === 'race' && currentDef.isHybridParent) {
      return stageRaceSegments.filter(s => s.label !== 'Hybrid')
    }

    // Twist sub-wheel — pull segments from the twist registry by key.
    // Triggered by God/Saiyan/Bender/Stand User/Demon Slayer/etc.
    if (currentDef.category === 'twistSpin' && currentDef.twistKind) {
      const twist = twistByKey(currentDef.twistKind)
      if (twist) return twist.segments
    }

    // Race wheel: only show races available at current stage
    if (currentDef.category === 'race') {
      return stageRaceSegments
    }

    // Archetype wheel: only show archetypes available at current stage
    if (currentDef.category === 'archetype') {
      return stageArchetypeSegments
    }

    // Racial ability: use race-specific pool (prefer forRace for Hybrid
    // parent-derived slots and Possessed-grafted slots).
    if (currentDef.category === 'racialAbility') {
      const raceResult = results.find(r => r.category === 'race')
      const effectiveLabel = currentDef.forRace ?? raceResult?.resultLabel
      if (effectiveLabel) {
        const race = getRace(effectiveLabel)
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
        const archetype = getArchetype(archetypeResult.resultLabel)
        const pool = archetype?.customAbilityPool ?? archetype?.abilities
        if (pool && pool.length > 0) {
          return (pool as WeightedSegment[]).map(seg =>
            usedArchetypeAbilities.has(seg.label) ? { ...seg, weight: 0, dimmed: true } : seg
          )
        }
      }
      return getSegmentsForCategory('archetypeAbility')
    }

    // Race sub-type: use race's subTypePool (prefer forRace for Hybrid +
    // Possessed grafted slots)
    if (currentDef.category === 'raceSubType') {
      const raceResult = results.find(r => r.category === 'race')
      const race = getRace(currentDef.forRace ?? raceResult?.resultLabel)
      return (race?.subTypePool as WeightedSegment[] | undefined) ?? getSegmentsForCategory('raceSubType')
    }

    // Race class: use race's classPool
    if (currentDef.category === 'raceClass') {
      const raceResult = results.find(r => r.category === 'race')
      const race = getRace(currentDef.forRace ?? raceResult?.resultLabel)
      return (race?.classPool as WeightedSegment[] | undefined) ?? getSegmentsForCategory('raceClass')
    }

    // Limit Break wheel — per-race odds (race.limitBreakOdds) determine 1/N
    // chance of "Limit Break" landing. Story mode reuses the main-game pool
    // generator so weights stay in sync.
    if (currentDef.category === 'limitBreak') {
      const raceResult = results.find(r => r.category === 'race')
      const race = getRace(currentDef.forRace ?? raceResult?.resultLabel)
      return (limitBreakSegmentsFor(race?.limitBreakOdds) ?? getSegmentsForCategory('limitBreak')) as WeightedSegment[]
    }

    // Race-injected wheel — same lookup the main-game route uses. Segments
    // come from the registry; archetype mutations may override the pool.
    if (currentDef.category === 'raceWheel' && currentDef.raceWheelId) {
      const raceResult = results.find(r => r.category === 'race')
      const raceLabel = currentDef.forRace ?? raceResult?.resultLabel ?? ''
      const baseSegments = getRaceWheelSegments(raceLabel, currentDef.raceWheelId) as WeightedSegment[] | null
      const archResult = results.find(r => r.category === 'archetype')
      const mutated = resolveMutatedSegments(baseSegments, raceLabel, archResult?.resultLabel, currentDef.raceWheelId)
      return (mutated ?? [{ label: '—', weight: 1 }]) as WeightedSegment[]
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

    // Stat wheels: apply racial minimum tier floor + Limit Break shift + Absolute+
    // cap when not broken + stage max cap.
    if (STAT_CATEGORIES.has(currentDef.category)) {
      const raceResult = results.find(r => r.category === 'race')
      const race = getRace(raceResult?.resultLabel)
      const lbResult = results.find(r => r.category === 'limitBreakLevel')
      const lbShift = lbResult ? (LIMIT_BREAK_SHIFT[lbResult.resultLabel] ?? 0) : 0
      const isLimitBroken = lbShift > 0
      const baseMin = race?.minStatTier != null ? TIER_ORDER.indexOf(race.minStatTier as import('$lib/game/scoreTier').TierGrade) : -1
      const minTierIdx = baseMin < 0
        ? (isLimitBroken ? Math.max(0, lbShift) : -1)
        : Math.min(TIER_ORDER.length - 1, baseMin + lbShift)
      // Without Limit Break, story-mode stat wheels also cap at Absolute+.
      const absoluteCapIdx = TIER_ORDER.indexOf('Absolute+' as import('$lib/game/scoreTier').TierGrade)
      const maxTierIdx = isLimitBroken
        ? TIER_ORDER.length - 1
        : (absoluteCapIdx >= 0 ? absoluteCapIdx : TIER_ORDER.length - 1)

      const segs = getSegmentsForCategory(currentDef.category as SpinCategory) as (WeightedSegment & { score?: number; tier?: string })[]
      return segs
        .filter(seg => {
          if (!seg.tier) return true
          const tIdx = TIER_ORDER.indexOf(seg.tier as import('$lib/game/scoreTier').TierGrade)
          if (tIdx < 0) return true
          if (minTierIdx >= 0 && tIdx < minTierIdx) return false
          if (tIdx > maxTierIdx) return false
          return true
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

    // Power category: when a twist has locked an element, boost matching-
    // element powers 3x so the locked element wins more often. Mirrors
    // main game's element-bias logic.
    if (currentDef.category === 'power' && lockedElement) {
      const baseSegs = getSegmentsForCategory('power')
      return baseSegs.map(s => {
        const el = (s as { element?: string }).element
        return el === lockedElement ? { ...s, weight: s.weight * 3 } : s
      })
    }

    return getSegmentsForCategory(currentDef.category as SpinCategory)
  })

  // ── Resume handler ────────────────────────────────────────────────────────────
  function handleResume() {
    showResumePrompt = false
  }

  // Discard the unfinished run. The session is wiped (it counts as "spent" —
  // as if a character had been made) so it can't be resumed, and the parent
  // sends the player back to the hub WITHOUT refunding the spin. This kills
  // the old "Start Over" re-roll exploit.
  function handleDiscard() {
    clearStorySession()
    results = []
    pendingResult = null
    isSessionDone = false
    doneEntry = null
    showResumePrompt = false
    onDiscard()
  }

  function formatCategory(cat: string): string {
    return cat.replace(/([A-Z])/g, ' $1').replace(/^[a-z]/, s => s.toUpperCase()).trim()
  }

  // ── Spin completion — shows result popup before advancing ─────────────────────
  function handleSpinComplete(resultIndex: number, resultLabel: string) {
    if (!currentDef) return

    // ── Wildcard interrupt ────────────────────────────────────────────────────
    if (!skipWildcard) {
      const isStatSpin = STAT_CATEGORIES.has(currentDef.category) && !currentDef.isReroll
      const isItemSpin = currentDef.category === 'power' || currentDef.category === 'weapon' || currentDef.category === 'armor'

      const wildcardChance = gamepasses.has('double_luck') ? 0.10 : 0.05
      if (isStatSpin && Math.random() < wildcardChance) {
        const outcome = pickWeighted(STAT_WILDCARD_OUTCOMES)
        const statSegs = getSegmentsForCategory(currentDef.category as SpinCategory) as { label: string; tier?: string; weight: number }[]

        let modifiedLabel = resultLabel

        if (outcome.type === 'primordial') {
          modifiedLabel = statSegs.find(s => s.tier === 'Primordial')?.label ?? resultLabel
        } else if (outcome.type === 'forgotten') {
          modifiedLabel = statSegs.find(s => s.tier === 'F-')?.label ?? resultLabel
        } else if (outcome.type === 'blessing') {
          modifiedLabel = shiftTierLabel(resultLabel, 3, statSegs)
        } else if (outcome.type === 'curse') {
          modifiedLabel = shiftTierLabel(resultLabel, -3, statSegs)
        } else if (outcome.type === 'mirror') {
          const bestStat = [...results].filter(r => STAT_CATEGORIES.has(r.category) && r.score !== undefined)
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]
          if (bestStat?.tier) modifiedLabel = statSegs.find(s => s.tier === bestStat.tier)?.label ?? resultLabel
        } else if (outcome.type === 'chaos') {
          modifiedLabel = statSegs[Math.floor(Math.random() * statSegs.length)]?.label ?? resultLabel
        } else if (outcome.type === 'c_tier') {
          modifiedLabel = statSegs.find(s => s.tier === 'C')?.label ?? resultLabel
        } else if (outcome.type === 'double_edge') {
          modifiedLabel = shiftTierLabel(resultLabel, 4, statSegs)
        } else if (outcome.type === 'shared') {
          const lastStat = [...results].reverse().find(r => STAT_CATEGORIES.has(r.category) && r.tier !== undefined)
          if (lastStat?.tier) modifiedLabel = statSegs.find(s => s.tier === lastStat.tier)?.label ?? resultLabel
        }
        // 'reroll' and 'power_gift' leave the label unchanged; effects applied in handleWildcardContinue

        wildcardPendingLabel = modifiedLabel
        wildcardPendingIndex = resultIndex
        wildcardOutcomeType = outcome.type
        wildcardOutcomeLabel = outcome.outcomeLabel
        wildcardOutcomeDesc = outcome.desc
        wildcardPhase = 'flashing'
        setTimeout(() => { wildcardPhase = 'reveal' }, 3000)
        return
      }

      if (isItemSpin && Math.random() < (gamepasses.has('double_luck') ? 0.35 : 0.20)) {
        // Award a bonus extra item spin of the same type (spliced in handleWildcardContinue)
        wildcardOutcomeType = 'itemBonus'
        wildcardOutcomeLabel = 'WILDCARD BONUS'
        wildcardOutcomeDesc = `An extra ${currentDef.displayName.toLowerCase()} spin appears! The wheel rewards your luck.`
        wildcardPendingLabel = resultLabel
        wildcardPendingIndex = resultIndex
        wildcardPhase = 'flashing'
        setTimeout(() => { wildcardPhase = 'reveal' }, 3000)
        return
      }
    }
    skipWildcard = false
    // ─────────────────────────────────────────────────────────────────────────

    // Grab element + grade from the landed segment before any queue mutation
    const landedSegment = currentSegments.find(s => s.label === resultLabel)
    const resultElement = landedSegment?.element
    const resultGrade = landedSegment?.grade

    // Granted powers/weapons collected during category handling; pushed as
    // extra results after the primary one resolves. Mirrors main game.
    let pendingGrantedPowers: string[] = []
    let pendingGrantedWeapons: string[] = []

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
      let resultingLabel: string | undefined
      let resultingTier: string | undefined
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
          resultingLabel = newLabel
          resultingTier = newGrade
        }
      }
      results.push(spinResult)
      // Point the reveal modal at THIS statBonus result. Without this,
      // primarySpinResultIndex would still point at whatever earlier
      // spin set it (often the title or backstory result that triggered
      // the splice), so the reveal would render that earlier card's
      // label instead of the bonus shift the player just rolled.
      primarySpinResultIndex = results.length - 1
      const isBonus = currentDef.category === 'statBonus'
      const shiftSign = isBonus ? '+' : ''
      const resultingInfo = resultingLabel && resultingTier ? ` → ${resultingTier} · ${resultingLabel}` : ''
      pendingResult = {
        label: `${shiftSign}${tierShift} tier${resultingInfo}`,
        categoryDisplayName: currentDef.displayName ?? formatCategory(targetStat ?? 'Stat'),
        color: isBonus ? '#34d399' : '#ef4444',
        tier: resultingTier as import('$lib/game/scoreTier').TierGrade | undefined,
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
        // ── Hybrid twist: spin race wheel TWO more times for the parent
        // bloodlines. The Hybrid result itself adds no extras; each parent
        // race resolves through this branch with isHybridParent=true and
        // contributes its full extras to the character. Mirrors main game.
        if (resultLabel === 'Hybrid' && !currentDef.isHybridParent) {
          queue.splice(currentIndex + 1, 0,
            { category: 'race' as const, displayName: 'Hybrid: First Parent',  isHybridParent: true },
            { category: 'race' as const, displayName: 'Hybrid: Second Parent', isHybridParent: true },
          )
        } else {
          const race = getRace(resultLabel)
          // forRace tags each spliced sub-spin with the race that spawned
          // it so Hybrid parents' extras each draw from the correct pool.
          const forRace = resultLabel
          if (race) {
            // Twist sub-wheel splice for God/Saiyan/Bender/Vampire/etc.
            const raceTwistKey = RACE_TWIST_TRIGGERS[resultLabel]
            if (raceTwistKey) {
              const twist = twistByKey(raceTwistKey)
              if (twist) {
                insertSlots.push({
                  category: 'twistSpin' as const,
                  displayName: `${resultLabel}: ${twist.title}`,
                  twistKind: raceTwistKey,
                })
              }
            }
            if (race.subTypePool?.length) {
              insertSlots.push({ category: 'raceSubType' as const, displayName: `${resultLabel} Sub-Type`, forRace })
            }
            // Race-injected wheels (Phase 1B: Human Destiny + Talent, Saiyan
            // Rage Threshold, Creator Reality Law + Creation Domain). Each
            // injectedWheel entry on the race becomes its own raceWheel slot
            // — segments come from raceWheelRegistry, optionally mutated by
            // archetype overlay.
            if (race.injectedWheels?.length) {
              const ordered = [...race.injectedWheels].sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
              for (const w of ordered) {
                insertSlots.push({
                  category: 'raceWheel' as const,
                  displayName: `${resultLabel} ${w.displayName}`,
                  forRace,
                  raceWheelId: w.id,
                })
              }
            }
            // Limit Break check — same pre-class slot as main game.
            if (race.limitBreakOdds && race.limitBreakOdds >= 2) {
              insertSlots.push({ category: 'limitBreak' as const, displayName: `${resultLabel} Limit Break`, forRace })
            }
            if (race.classPool?.length) {
              insertSlots.push({ category: 'raceClass' as const, displayName: `${resultLabel} Class`, forRace })
            }
            const count = race.abilitySpinCount ?? 1
            for (let i = 0; i < count; i++) {
              insertSlots.push({
                category: 'racialAbility' as const,
                displayName: count > 1 ? `Racial Ability ${i + 1}` : 'Racial Ability',
                forRace,
              })
            }
            const extraPowers = race.extraPowerSpins ?? 0
            for (let i = 0; i < extraPowers; i++) {
              insertSlots.push({ category: 'power' as const, displayName: extraPowers > 1 ? `Racial Power ${i + 1}` : 'Racial Power', forRace })
            }
            const weaknessCount = race.weaknessCount ?? deriveWeaknessCount(race.weaknessProbabilityModifier ?? 1.0)
            for (let i = 0; i < weaknessCount; i++) {
              insertSlots.push({ category: 'weakness' as const, displayName: weaknessCount > 1 ? `Weakness ${i + 1}` : 'Weakness', forRace })
            }
          }
          if (insertSlots.length > 0) queue.splice(currentIndex + 1, 0, ...insertSlots)
        }
      }

      if (currentDef.category === 'limitBreak') {
        // Story-mode mirror of the main-game splice: "Limit Break" outcome
        // splices a How-Broken wheel right after; "No Limit Break" is a no-op.
        if (resultLabel === 'Limit Break') {
          queue.splice(currentIndex + 1, 0, {
            category: 'limitBreakLevel' as const,
            displayName: 'How Broken?',
            forRace: currentDef.forRace,
          })
        }
      }

      if (currentDef.category === 'raceSubType') {
        const raceResult = results.find(r => r.category === 'race')
        const race = getRace(currentDef.forRace ?? raceResult?.resultLabel)
        const subTypeItem = race?.subTypePool?.find(s => s.label === resultLabel)
        if (subTypeItem?.statBonusGrants) {
          for (const [stat, bonusType] of Object.entries(subTypeItem.statBonusGrants)) {
            pendingStatBonuses[stat] = [...(pendingStatBonuses[stat] ?? []), bonusType]
          }
        }
        // Granted powers from the subtype entry (Mythical Beast → Dragon
        // Breath, etc.) — pushed as power results below.
        if (subTypeItem?.grantedPowers?.length) {
          pendingGrantedPowers.push(...subTypeItem.grantedPowers)
        }
      }

      if (currentDef.category === 'raceClass') {
        const raceResult = results.find(r => r.category === 'race')
        const race = getRace(currentDef.forRace ?? raceResult?.resultLabel)
        const classItem = race?.classPool?.find(c => c.label === resultLabel)
        if (classItem?.statBonusGrants) {
          for (const [stat, bonusType] of Object.entries(classItem.statBonusGrants)) {
            pendingStatBonuses[stat] = [...(pendingStatBonuses[stat] ?? []), bonusType]
          }
        }
        // Granted powers from the class entry — pushed as power results below.
        if (classItem?.grantedPowers?.length) {
          pendingGrantedPowers.push(...classItem.grantedPowers)
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
        const archetype = getArchetype(resultLabel)
        if (archetype) {
          const abilityLabel = archetype.abilitySpinDisplayName ?? 'Archetype Ability'
          const count = archetype.abilitySpinCount ?? 2
          const abilitySlots: SpinDefinition[] = []
          // Archetype twist sub-wheel (Time Traveler, Chaos Gremlin, Stand
          // User, Bounty Hunter, Demon Slayer, Sorcerer, Esper, Necromancer,
          // Cursed Sorcerer). Prepended so it lands BEFORE ability spins
          // so a locked element can bias them. Mirrors main game.
          const arcTwistKey = ARCHETYPE_TWIST_TRIGGERS[resultLabel]
          if (arcTwistKey) {
            const twist = twistByKey(arcTwistKey)
            if (twist) {
              abilitySlots.push({
                category: 'twistSpin' as const,
                displayName: `${resultLabel}: ${twist.title}`,
                twistKind: arcTwistKey,
              })
            }
          }
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
          // Bonus weapon spins (Dual Wielder gets +1, Artificer gets +1, etc.)
          const extraWeapons = (archetype as { bonusWeaponSpins?: number }).bonusWeaponSpins ?? 0
          for (let i = 0; i < extraWeapons; i++) {
            abilitySlots.push({ category: 'weapon' as const, displayName: extraWeapons > 1 ? `Second Weapon ${i + 1}` : 'Second Weapon' })
          }
          // Arbitrary bonus spins (Possessed's possessionRace + possessionStrength,
          // and any future archetype that adds custom sub-spins).
          for (const bonusSpin of (archetype.bonusSpins ?? [])) {
            abilitySlots.push({
              category: bonusSpin.category as SpinCategory,
              displayName: bonusSpin.displayName,
            })
          }
          if (abilitySlots.length > 0) queue.splice(currentIndex + 1, 0, ...abilitySlots)

          // statBonusGrants — deferred to fire right after each relevant stat spin
          if (archetype.statBonusGrants) {
            for (const [stat, bonusType] of Object.entries(archetype.statBonusGrants)) {
              pendingStatBonuses[stat] = [...(pendingStatBonuses[stat] ?? []), bonusType as 'statBonus' | 'statPenalty']
            }
          }

          // Granted powers / weapons (Mage's Arcane Theory, Paladin's
          // Holy Warhammer, Warrior's Combat Training, etc.) pushed as
          // separate result entries after the primary archetype result.
          // Mirrors main game so Story characters get the same freebies.
          if (archetype.grantedPowers?.length) {
            pendingGrantedPowers.push(...archetype.grantedPowers)
          }
          if (archetype.grantedWeapons?.length) {
            pendingGrantedWeapons.push(...archetype.grantedWeapons)
          }
        }
      }

      // ── Possessed archetype handlers (mirrors main game) ──────────────
      // possessionRace just records who's possessing — no extras spliced.
      // possessionStrength applies the % stat-bonus tier + grafts
      // racialAbility / class / transformation slots from the possessing
      // race based on POSSESSION_SPLICE. forRace is set on grafted slots
      // so the wheel draws from the possessing race's pool.
      if (currentDef.category === 'possessionStrength') {
        const grants = POSSESSION_GRANTS[resultLabel] ?? {}
        for (const [stat, bonusType] of Object.entries(grants)) {
          pendingStatBonuses[stat] = [...(pendingStatBonuses[stat] ?? []), bonusType]
        }
        const possessingRaceLabel = results.find(r => r.category === 'possessionRace')?.resultLabel
        const splice = POSSESSION_SPLICE[resultLabel] ?? { abilities: 0, classSpin: false, transformation: false }
        const slots: SpinDefinition[] = []
        if (possessingRaceLabel) {
          const possessingRace = getRace(possessingRaceLabel)
          for (let i = 0; i < splice.abilities; i++) {
            slots.push({
              category: 'racialAbility' as const,
              displayName: splice.abilities > 1 ? `${possessingRaceLabel} Trait ${i + 1}` : `${possessingRaceLabel} Trait`,
              forRace: possessingRaceLabel,
            })
          }
          if (splice.classSpin && possessingRace?.classPool?.length) {
            slots.push({
              category: 'raceClass' as const,
              displayName: `${possessingRaceLabel} Aspect`,
              forRace: possessingRaceLabel,
            })
          }
          if (splice.transformation && possessingRace?.transformationPool?.length) {
            slots.push({
              category: 'raceTransformation' as const,
              displayName: `${possessingRaceLabel} Awakening`,
              forRace: possessingRaceLabel,
            })
          }
          if (slots.length > 0) queue.splice(currentIndex + 1, 0, ...slots)
        }
      }

      // ── Twist sub-spin result — apply registered effects (stat grants +
      // optional element lock). Mirrors main game's twistSpin handler.
      if (currentDef.category === 'twistSpin' && currentDef.twistKind) {
        const twist = twistByKey(currentDef.twistKind)
        const eff = twist?.effects[resultLabel]
        if (eff?.statBonusGrants) {
          for (const [stat, bonusType] of Object.entries(eff.statBonusGrants)) {
            pendingStatBonuses[stat] = [...(pendingStatBonuses[stat] ?? []), bonusType]
          }
        }
        if (eff?.lockElement) {
          lockedElement = eff.lockElement
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

      // ── Chaos Factor splice — 25% chance at the end of the run. Same
      // logic + same one-shot guard as main game so both modes feel parallel.
      if (currentDef.category === 'redemptionSpin' || currentDef.category === 'redemptionOutcome') {
        const nextDef = queue[currentIndex + 1]
        const alreadyHasChaos = queue.some(s => s.category === 'twistSpin' && s.twistKind === 'chaosFactor')
        if (nextDef?.category === 'title' && !alreadyHasChaos && Math.random() < 0.25) {
          queue.splice(currentIndex + 1, 0, {
            category: 'twistSpin' as const,
            displayName: 'Chaos Factor',
            twistKind: 'chaosFactor',
          })
        }
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
            results[potIdx] = { ...results[potIdx], tier: 'God' as import('$lib/game/scoreTier').TierGrade, score: 100, resultLabel: godLbl }
          }
        } else if (resultLabel === 'Free God Tier Strength') {
          const strIdx = results.findIndex(r => r.category === 'strength')
          if (strIdx !== -1) {
            const segs = getSegmentsForCategory('strength')
            const godLbl = (segs as { label?: string; tier?: string }[]).find(s => s.tier === 'God')?.label ?? 'Lifts Reality Itself'
            results[strIdx] = { ...results[strIdx], tier: 'God' as import('$lib/game/scoreTier').TierGrade, score: 100, resultLabel: godLbl }
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
      // Capture index BEFORE the extras (granted powers / weapons) get
      // pushed so the reveal's identityCard lookup hits the primary
      // result, not a trailing grantedPower. Mirrors main game.
      primarySpinResultIndex = results.length - 1

      // Inject race/class/subType/archetype granted powers as separate
      // power results — no spin required, they're freebies tied to the
      // identity choice. Story used to silently drop these.
      for (const powerLabel of pendingGrantedPowers) {
        results.push({
          step: results.length + 1,
          category: 'power',
          resultLabel: powerLabel,
          resultIndex: -1,
          timestamp: new Date().toISOString(),
        })
      }
      // Same for granted weapons (Paladin → Holy Warhammer, etc.).
      for (const weaponLabel of pendingGrantedWeapons) {
        results.push({
          step: results.length + 1,
          category: 'weapon',
          resultLabel: weaponLabel,
          resultIndex: -1,
          timestamp: new Date().toISOString(),
        })
      }

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
        ...getSpinMeta(currentDef.category, resultLabel, resultElement, resultGrade, spinResult.tier),
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
    maybeRollSecretEvent()
  }

  // Per-session secret-event state. Each event fires at most once per run.
  let activeSecretEvent = $state<SecretEventId | null>(null)
  let firedSecretEvents = $state<Set<SecretEventId>>(new Set())
  function maybeRollSecretEvent() {
    if (activeSecretEvent) return
    const raceResult = results.find(r => r.category === 'race')
    const race = getRace(raceResult?.resultLabel)
    if (!race) return
    const archResult = results.find(r => r.category === 'archetype')
    const mut = archResult ? getMutation(race.label, archResult.resultLabel) : undefined
    const bias = (race.secretEventBias ?? 1) * (mut?.secretEventBias ?? 1)
    const identities = race.spinIdentity ?? []
    const id = rollSecretEvent(bias, identities)
    if (id && !firedSecretEvents.has(id)) {
      firedSecretEvents.add(id)
      activeSecretEvent = id
      results = applyEventToResults(id, results)
    }
  }
  function dismissSecretEvent() { activeSecretEvent = null }

  function handleNamingSubmit() {
    if (!doneEntry) return
    const finalName = namingInput.trim() || doneEntry.name
    // Save to Hall of Fame so future lineage-aware rolls can reference
    // this character (Demi-god divine parent, future Reincarnation, etc.).
    try {
      const sigPower = (doneEntry.spins ?? []).find(r => r.category === 'power')?.resultLabel
      saveToHallOfFame({
        name: finalName,
        race: doneEntry.race ?? 'Unknown',
        archetype: doneEntry.archetype ?? 'Unknown',
        overallGrade: doneEntry.overallTier,
        savedAt: new Date().toISOString(),
        signaturePower: sigPower,
      })
    } catch { /* private mode / hostile env */ }
    onSessionComplete({ ...doneEntry, name: finalName })
  }
</script>

<!-- ── Story Mode spin UI ─────────────────────────────────────────────────────── -->
<div class="min-h-screen flex flex-col items-center justify-center px-4 relative">

  <!-- Top bar: mode indicator + progress bar + exit link. The progress bar is
       new — gives the player a constant sense of "how far am I" instead of just
       a "12/23" counter at the bottom. -->
  <div class="fixed top-4 left-0 right-0 flex items-center justify-between gap-3 px-4 z-20 pointer-events-none">
    <span
      class="pointer-events-none"
      style="font-family: var(--font-cinzel, 'Cinzel', serif); font-size: 13px; color: var(--color-outline); opacity: {showModeIndicator ? '1' : '0'}; transition: opacity 0.6s ease;"
    >
      Story · Stage {stage}
    </span>

    <!-- Animated progress bar -->
    <div class="flex-1 h-1.5 max-w-[260px] mx-2 rounded-full overflow-hidden pointer-events-none"
      style="background: rgba(255,255,255,0.05); border: 1px solid rgba(240,192,64,0.12);">
      <div style="height: 100%; width: {Math.round(((currentIndex) / Math.max(1, queue.length)) * 100)}%; background: linear-gradient(90deg, #c0882a, #f0c040); box-shadow: 0 0 6px rgba(240,192,64,0.6); transition: width 0.4s cubic-bezier(0.22, 0.8, 0.3, 1);"></div>
    </div>

    <button
      class="pointer-events-auto flex items-center gap-1"
      style="font-family: var(--font-mono, monospace); font-size: 11px; color: var(--color-outline); background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); cursor: pointer; padding: 4px 10px; border-radius: 6px;"
      onclick={onCancel}
      title="Exit to Menu"
    >
      <span class="material-symbols-outlined" style="font-size: 14px;">close</span>
      Exit
    </button>
  </div>

  <!-- Spin wheel (remounts on each new spin via {#key}) -->
  <!-- z-30 lifts the wheel + spin button above the top bar (z-20) so the
       wheel and its controls are never covered, matching the main game. -->
  {#if currentDef && !showResumePrompt}
    <div class="relative z-30 flex flex-col items-center gap-4">
      {#if currentIndex === 0 && currentDef?.category === 'race' && !pendingResult}
        <FirstTimeTooltip
          storageKey="wof_seen_race_hint"
          title="Spin for Race"
          body="Race shapes everything: stat tendencies, abilities, weaknesses, and which sub-wheels appear next. Each one plays differently."
          placement="top"
        />
      {/if}
      {#key currentIndex}
        <SpinWheel
          segments={currentSegments}
          categoryHue={currentCategoryHue}
          onSpinComplete={handleSpinComplete}
          soundEnabled={settings.soundEnabled}
          effectsEnabled={settings.effectsEnabled}
          spinSpeedMultiplier={settings.spinSpeed}
          replayTrigger={replayTriggerKey}
          wheelSignature={results.find(r => r.category === 'race')?.resultLabel ?? null}
          resolveLandingColors={(_i, label) => resolveLandingForCategory(currentDef?.category, label)}
          onLanded={({ centerX, centerY }) => {
            wheelCenterX = centerX
            wheelCenterY = centerY
          }}
        />
      {/key}

      <!-- Spin label + progress counter under the wheel -->
      <div class="flex flex-col items-center gap-1.5 mt-1">
        <p style="font-family: var(--font-cinzel, 'Cinzel', serif); font-size: 15px; color: var(--color-on-surface); font-weight: 600;">
          {currentDef.displayName}
        </p>
        <StreakBanner streak={currentStreak} />
        <SpinProgressDots
          currentIndex={currentIndex}
          total={queue.length}
          results={results}
        />
      </div>
    </div>
  {/if}

  <!-- Secret-event cinematic interrupt — mounted between spins. Same overlay
       as the main game so the feel carries across both modes. -->
  {#if activeSecretEvent}
    <SecretEventOverlay eventId={activeSecretEvent} onDismiss={dismissSecretEvent} />
  {/if}
</div>

<!-- ── Wildcard flash overlay — cinematic layered animation ─────────────────── -->
{#if wildcardPhase === 'flashing'}
  <div class="fixed inset-0 z-50 flex items-center justify-center overflow-hidden wc-overlay" aria-hidden="true">
    <svg class="absolute inset-0 m-auto wc-vortex-cw" style="width: min(95vw, 720px); height: min(95vw, 720px); opacity: 0.45;" viewBox="0 0 200 200" fill="none">
      <circle cx="100" cy="100" r="92" stroke="#f0c040" stroke-width="1.2" stroke-dasharray="6 8" opacity="0.7"/>
      <circle cx="100" cy="100" r="80" stroke="#f0c040" stroke-width="0.8" stroke-dasharray="2 6" opacity="0.5"/>
      <polygon points="100,16 142,72 178,98 142,128 100,184 58,128 22,98 58,72" stroke="#f0c040" stroke-width="1.3" opacity="0.55"/>
    </svg>
    <svg class="absolute inset-0 m-auto wc-vortex-ccw" style="width: min(70vw, 540px); height: min(70vw, 540px); opacity: 0.55;" viewBox="0 0 200 200" fill="none">
      <circle cx="100" cy="100" r="84" stroke="#a78bfa" stroke-width="1.5" stroke-dasharray="3 5"/>
      <polygon points="100,30 60,80 80,140 120,140 140,80" stroke="#a78bfa" stroke-width="1.5" opacity="0.7"/>
    </svg>
    {#each [0, 45, 90, 135, 180, 225, 270, 315] as deg, i}
      <div class="absolute wc-bolt"
           style="--rot:{deg}deg; left: 50%; top: 50%; width: 3px; height: min(40vw, 320px);
                  margin-left: -1.5px; background: linear-gradient(to bottom, #fff 0%, #f0c040 40%, transparent 100%);
                  box-shadow: 0 0 18px #f0c040; animation-delay: {i * 0.05}s;"></div>
    {/each}
    <div class="absolute wc-ring" style="left: 50%; top: 50%; width: min(60vw, 460px); height: min(60vw, 460px); border-radius: 50%; border: 4px solid #fde047; box-shadow: 0 0 40px #fde047;"></div>
    <div class="absolute wc-ring" style="left: 50%; top: 50%; width: min(60vw, 460px); height: min(60vw, 460px); border-radius: 50%; border: 4px solid #a78bfa; animation-delay: 0.25s !important; box-shadow: 0 0 40px #a78bfa;"></div>
    <div class="absolute wc-ring" style="left: 50%; top: 50%; width: min(60vw, 460px); height: min(60vw, 460px); border-radius: 50%; border: 4px solid #ec4899; animation-delay: 0.5s !important; box-shadow: 0 0 40px #ec4899;"></div>
    <div class="absolute wc-pulse" style="width: min(20vw, 160px); height: min(20vw, 160px); border-radius: 50%; background: radial-gradient(circle, #fff 0%, #fde047 40%, transparent 70%); filter: blur(8px);"></div>
    <p class="relative wc-text"
       style="font-family: 'Cinzel', serif; font-size: clamp(3rem, 12vw, 6.5rem); font-weight: 900; color: #fffaf0; text-shadow: 0 0 30px rgba(240,192,64,0.9);">
      WILDCARD
    </p>
  </div>
{/if}

<!-- ── Wildcard reveal overlay — dramatic outcome reveal ───────────────────── -->
{#if wildcardPhase === 'reveal'}
  <div class="fixed inset-0 z-50 flex items-center justify-center px-4 overflow-hidden"
       style="background: radial-gradient(circle at 50% 50%, rgba(40,12,80,0.85) 0%, rgba(7,7,13,0.95) 70%); backdrop-filter: blur(14px);">
    <svg class="absolute inset-0 m-auto wc-vortex-cw" style="width: min(80vw, 600px); height: min(80vw, 600px); opacity: 0.18; pointer-events: none;" viewBox="0 0 200 200" fill="none" aria-hidden="true">
      <circle cx="100" cy="100" r="92" stroke="#f0c040" stroke-width="1" stroke-dasharray="4 6"/>
      <polygon points="100,16 142,72 178,98 142,128 100,184 58,128 22,98 58,72" stroke="#f0c040" stroke-width="1"/>
    </svg>
    <div
      class="relative flex flex-col items-center gap-5 rounded-2xl px-8 py-8 max-w-sm w-full text-center wc-reveal-in"
      style="background: linear-gradient(135deg, #1f1830 0%, #12111e 70%);
             border: 2px solid rgba(240,192,64,0.55);
             box-shadow: 0 0 100px rgba(240,192,64,0.3), inset 0 1px 0 rgba(255,255,255,0.06);"
    >
      <div class="text-5xl">{wildcardOutcomeType === 'itemBonus' ? '🎁' : '✦'}</div>
      <div>
        <p class="text-xs tracking-[0.3em] uppercase mb-2" style="font-family: 'JetBrains Mono', monospace; color: #f0c040;">Wildcard Activated</p>
        <p class="font-bold text-xl tracking-widest uppercase" style="font-family: var(--font-cinzel,'Cinzel',serif); color: #ffdf96; letter-spacing: 0.12em; text-shadow: 0 0 20px rgba(240,192,64,0.5);">{wildcardOutcomeLabel}</p>
      </div>
      <p class="text-sm leading-relaxed" style="font-family: 'JetBrains Mono', monospace; color: #9a907b; max-width: 240px;">{wildcardOutcomeDesc}</p>
      <button
        onclick={handleWildcardContinue}
        class="metal-stamp-gold mt-2 px-8 py-2.5 rounded-lg font-bold text-sm tracking-widest relative"
        style="font-family: var(--font-cinzel,'Cinzel',serif);"
      >
        <div class="l-bracket" style="color: rgba(255,255,255,0.25);"></div>
        Continue
      </button>
    </div>
  </div>
{/if}

<!-- ── Result reveal — same SpinResultReveal panel the main game uses, in modal
     mode so it overlays the Story Mode UI without conflicting with the
     fixed left sidebar (running spin log). ────────────────────────────────── -->
{#if pendingResult}
  {@const lastResult = (primarySpinResultIndex != null && results[primarySpinResultIndex])
    || results.at(-1)
    || ({
    step: results.length + 1,
    category: 'race' as const,
    resultLabel: pendingResult.label,
    resultIndex: 0,
    timestamp: new Date().toISOString(),
    tier: pendingResult.tier as any,
  } as SpinResult)}
  {@const _identityCard = (
    lastResult.category === 'race' ||
    lastResult.category === 'archetype' ||
    lastResult.category === 'raceSubType' ||
    lastResult.category === 'raceClass' ||
    lastResult.category === 'raceTransformation' ||
    lastResult.category === 'backstory' ||
    lastResult.category === 'title'
  ) ? buildIdentityCard(lastResult.category, lastResult.resultLabel ?? '') : null}
  {@const resolvedMeta = {
    element: pendingResult.element,
    grade:   pendingResult.grade,
    abilityType:  pendingResult.abilityType,
    description:  pendingResult.description,
    statEffect:   pendingResult.statEffect,
    ...(_identityCard ? { identityCard: _identityCard } : {}),
  } as ResolvedMeta}
  <SpinResultReveal
    result={lastResult}
    meta={resolvedMeta}
    tierColor={pendingResult.color}
    categoryDisplayName={pendingResult.categoryDisplayName}
    continueLabel={isSessionDone ? 'Complete!' : 'Continue'}
    onContinue={handleContinue}
    onReplay={() => { replayTriggerKey++ }}
    layout="modal"
    anchorX={wheelCenterX}
    anchorY={wheelCenterY}
  />
{/if}

<!-- ── Running spin log ───────────────────────────────────────────────────────── -->
{#if results.length > 0 && !showResumePrompt && !pendingResult}
  <div class="fixed left-0 top-0 bottom-0 z-[1] flex flex-col"
    style="width: 160px; background: linear-gradient(180deg, rgba(10,8,22,0.97) 0%, rgba(7,6,14,0.96) 100%); border-right: 1px solid rgba(240,192,64,0.16); backdrop-filter: blur(16px); box-shadow: 4px 0 32px rgba(0,0,0,0.85), inset -1px 0 0 rgba(255,223,150,0.04);">
    <p class="px-3 pt-3 pb-2 font-mono tracking-widest uppercase" style="color: #9a907b; font-size: 9px; letter-spacing: 0.18em;">Obtained this spin</p>
    <div class="px-3 pb-3 flex flex-col gap-2 overflow-y-auto flex-1">
      {#each [...results].filter(r => r.category !== 'statBonus' && r.category !== 'statPenalty').reverse() as r}
        <div class="flex flex-col min-w-0">
          <span class="font-mono" style="color: hsl({CATEGORY_HUES[r.category] ?? 45}, 60%, 62%); font-size: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">{formatCategory(r.category)}</span>
          <div class="flex items-center gap-1 min-w-0">
            <span class="font-mono truncate flex-1" style="color: var(--color-on-surface); font-size: 10px;">{r.displayLabel ?? r.resultLabel}</span>
            {#if r.tier}
              <span class="font-mono font-bold flex-shrink-0" style="color: hsl({CATEGORY_HUES[r.category] ?? 45}, 65%, 65%); font-size: 9px;">{r.tier}</span>
            {/if}
          </div>
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
      style="border: 1px solid rgba(240,192,64,0.38); box-shadow: 0 0 80px rgba(0,0,0,0.98), 0 0 50px rgba(240,192,64,0.12), inset 0 1px 0 rgba(255,255,255,0.04);"
    >
      <div class="noise-overlay"></div>
      <div class="absolute top-3 left-3 w-8 h-8" style="border-top: 2px solid rgba(240,192,64,0.5); border-left: 2px solid rgba(240,192,64,0.5); box-shadow: -1px -1px 8px rgba(240,192,64,0.15);"></div>
      <div class="absolute top-3 right-3 w-8 h-8" style="border-top: 2px solid rgba(240,192,64,0.5); border-right: 2px solid rgba(240,192,64,0.5); box-shadow: 1px -1px 8px rgba(240,192,64,0.15);"></div>
      <div class="absolute bottom-3 left-3 w-8 h-8" style="border-bottom: 2px solid rgba(240,192,64,0.5); border-left: 2px solid rgba(240,192,64,0.5); box-shadow: -1px 1px 8px rgba(240,192,64,0.15);"></div>
      <div class="absolute bottom-3 right-3 w-8 h-8" style="border-bottom: 2px solid rgba(240,192,64,0.5); border-right: 2px solid rgba(240,192,64,0.5); box-shadow: 1px 1px 8px rgba(240,192,64,0.15);"></div>

      <div class="relative z-10">
        <span class="material-symbols-outlined block text-4xl mb-3" style="color: #f0c040; font-variation-settings: 'FILL' 1;">history</span>
        <p style="font-family: var(--font-cinzel, 'Cinzel', serif); font-size: 1.05rem; font-weight: 700; color: #ffdf96; margin-bottom: 6px; text-shadow: 0 0 12px rgba(240,192,64,0.3);">
          Resume Story Session?
        </p>
        <p class="text-sm mb-2" style="color: #9a907b;">
          {results.length} spin{results.length === 1 ? '' : 's'} done
        </p>
        <p class="text-xs mb-6" style="color: #6e6555; line-height: 1.5;">
          Discarding forfeits this run — the spin is spent and you return to the hub.
        </p>
        <div class="flex gap-3">
          <button onclick={handleResume} class="metal-stamp-gold flex-1 py-2.5 rounded-lg text-sm font-bold"
            style="font-family: var(--font-cinzel, 'Cinzel', serif); letter-spacing: 0.1em;">
            Resume
          </button>
          <button onclick={handleDiscard} class="obsidian-slab flex-1 py-2.5 rounded-lg text-sm font-bold transition-all active:scale-95"
            style="font-family: var(--font-cinzel, 'Cinzel', serif); color: #9a907b; border: 1px solid #4e4635; letter-spacing: 0.1em;">
            Discard
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
          style="border: 1px solid rgba(240,192,64,0.30); color: #e9dfeb; font-family: var(--font-cinzel); caret-color: #f0c040; background: linear-gradient(180deg, rgba(22,17,38,0.92), rgba(10,8,18,0.96)); box-shadow: inset 0 2px 10px rgba(0,0,0,0.6), 0 0 0 0 transparent;"
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
