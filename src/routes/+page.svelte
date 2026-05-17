<script lang="ts">
  import { onMount } from 'svelte'
  import SpinWheel from '../components/SpinWheel.svelte'
  import TierBadge from '../components/TierBadge.svelte'
  import CharacterCard from '../components/CharacterCard.svelte'
  import SettingsPanel from '../components/SettingsPanel.svelte'
  import { loadSession, saveSession, clearSession, createSession } from '$lib/session/store'
  import type { SessionState, SpinResult } from '$lib/session/types'
  import { buildInitialQueue, getSegmentsForCategory } from '$lib/game/spinQueue'
  import type { SpinDefinition, SpinCategory } from '$lib/game/spinQueue'
  import { computeOverallScore, scoreTier, gradeToScore, TIER_THRESHOLDS } from '$lib/game/scoreTier'
  import type { TierGrade } from '$lib/game/scoreTier'
  import { redemptionProbability } from '$lib/game/redemption'
  import { races } from '$lib/content/races'
  import { archetypes } from '$lib/content/archetypes'
  import { backstories } from '$lib/content/backstories'
  import { titles } from '$lib/content/titles'
  import { weaponMasteryLabels } from '$lib/content/weapon-mastery-labels'
  import { settings } from '$lib/settings.svelte'
  // Derives weakness count from race's probability modifier when no explicit count is set
  function archetypeTypeFor(label: string): string {
    return archetypes.find(a => a.label === label)?.archetypeType ?? ''
  }

  function deriveWeaknessCount(modifier: number): number {
    if (modifier < 0.65) return 0
    if (modifier < 1.15) return 1
    if (modifier < 1.5)  return 2
    return 3
  }

  // ── State declarations ────────────────────────────────────────────────────
  let showMenu = $state(true)
  let currentSession = $state<SessionState>(createSession())
  let showResumePrompt = $state(false)
  let spinQueue = $state<SpinDefinition[]>(buildInitialQueue())
  let currentSpinIndex = $state(0)
  let results = $state<SpinResult[]>([])
  let showAnnouncement = $state<string | null>(null)
  let showCard = $state(false)
  let pendingStatBonuses = $state<Record<string, 'statBonus' | 'statPenalty'>>({})
  // Class/subType/transformation power pool override — used only by racial bonus power spins
  let activePowerPool = $state<{ label: string; weight: number }[]>([])
  // Tracks cumulative tier shifts per stat so rerolls can re-apply bonuses
  let statBonusOffsets = $state<Record<string, number>>({})
  // Track which ability labels have been used to enable greyed-out deduplication
  let usedRacialAbilities = $state<Set<string>>(new Set())
  let usedArchetypeAbilities = $state<Set<string>>(new Set())
  let showNameScreen = $state(false)
  let characterName = $state('')
  let isRevealed = $state(false)
  let showSettings = $state(false)

  // ── Derived values ────────────────────────────────────────────────────────
  let currentDef = $derived(spinQueue[currentSpinIndex])
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

  // ── Ordered tier grades for tier-shift calculations ──────────────────────
  const TIER_ORDER = TIER_THRESHOLDS.map(t => t.grade)

  // ── Stat grants applied when possessionStrength lands ────────────────────
  const POSSESSION_GRANTS: Record<string, Record<string, 'statBonus' | 'statPenalty'>> = {
    'Barely a Whisper (5%)':        {},
    'A Flicker of Influence (20%)': { charisma: 'statBonus' },
    'Shared Consciousness (40%)':   { charisma: 'statBonus', iq: 'statBonus' },
    'Dominant Presence (60%)':      { strength: 'statBonus', charisma: 'statBonus' },
    'Consuming Takeover (80%)':     { strength: 'statBonus', speed: 'statBonus', charisma: 'statBonus' },
    'Full Possession (100%)':       { strength: 'statBonus', speed: 'statBonus', iq: 'statBonus', durability: 'statBonus' },
  }

  // ── Tier → color map (used by result overlay and sidebar badges) ──────────
  const TIER_COLORS: Record<string, string> = {
    'F-':'#555','F':'#666','F+':'#777',
    'E-':'#6b7280','E':'#9ca3af','E+':'#d1d5db',
    'D-':'#92400e','D':'#b45309','D+':'#d97706',
    'C-':'#1d4ed8','C':'#2563eb','C+':'#3b82f6',
    'B-':'#065f46','B':'#059669','B+':'#34d399',
    'A-':'#7c3aed','A':'#8b5cf6','A+':'#a78bfa',
    'S-':'#b91c1c','S':'#dc2626','S+':'#ef4444',
    'SS-':'#ea580c','SS':'#f97316','SS+':'#fb923c',
    'SSS-':'#ca8a04','SSS':'#eab308','SSS+':'#fde047',
    'God':'#e879f9',
  }

  // ── Category hue map — drives HSL gradient coloring in SpinWheel ─────────
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
    redemptionSpin:      90,
    redemptionOutcome:  160,
    title:               45,
    possessionRace:     290,
    possessionStrength: 315,
  }

  let currentCategoryHue = $derived(CATEGORY_HUES[currentDef?.category ?? ''])

  // ── Segment resolver: handles race/archetype ability pools + modifiers ────
  let currentSegments = $derived.by(() => {
    const def = currentDef
    if (!def) return getSegmentsForCategory('race')

    // Use race-specific ability pool — prefer class or subType abilities when available
    if (def.category === 'racialAbility') {
      const raceResult = results.find(r => r.category === 'race')
      const race = races.find(r => r.label === raceResult?.resultLabel)
      const classResult = results.find(r => r.category === 'raceClass')
      const classItem = race?.classPool?.find(c => c.label === classResult?.resultLabel)
      const subTypeResult = results.find(r => r.category === 'raceSubType')
      const subTypeItem = race?.subTypePool?.find(s => s.label === subTypeResult?.resultLabel)
      const pool = classItem?.abilities ?? subTypeItem?.abilities ?? race?.abilities ?? getSegmentsForCategory('racialAbility')
      return pool.map(seg =>
        usedRacialAbilities.has(seg.label) ? { ...seg, weight: 0, dimmed: true } : seg
      )
    }

    // Use race sub-type pool
    if (def.category === 'raceSubType') {
      const raceResult = results.find(r => r.category === 'race')
      const race = races.find(r => r.label === raceResult?.resultLabel)
      return race?.subTypePool ?? getSegmentsForCategory('raceSubType')
    }

    // Use race class pool
    if (def.category === 'raceClass') {
      const raceResult = results.find(r => r.category === 'race')
      const race = races.find(r => r.label === raceResult?.resultLabel)
      return race?.classPool ?? getSegmentsForCategory('raceClass')
    }

    // Use race transformation pool
    if (def.category === 'raceTransformation') {
      const raceResult = results.find(r => r.category === 'race')
      const race = races.find(r => r.label === raceResult?.resultLabel)
      return race?.transformationPool ?? getSegmentsForCategory('raceTransformation')
    }

    // Use archetype-specific ability pool — prefer customAbilityPool, then abilities, then fallback
    if (def.category === 'archetypeAbility') {
      const archetypeResult = results.find(r => r.category === 'archetype')
      const archetype = archetypes.find(a => a.label === archetypeResult?.resultLabel)
      const pool = archetype?.customAbilityPool ?? archetype?.abilities ?? getSegmentsForCategory('archetypeAbility')
      return pool.map(seg =>
        usedArchetypeAbilities.has(seg.label) ? { ...seg, weight: 0, dimmed: true } : seg
      )
    }

    // Possession target draws from races; possessionStrength uses spinQueue pool
    if (def.category === 'possessionRace' || def.category === 'possessionStrength') {
      return getSegmentsForCategory(def.category)
    }

    // Use race custom height pool when available
    if (def.category === 'height') {
      const raceResult = results.find(r => r.category === 'race')
      const race = races.find(r => r.label === raceResult?.resultLabel)
      if (race?.customHeightPool) return race.customHeightPool
    }

    // statBonus/statPenalty: use tier-shift segments from spinQueue defaults
    if (def.category === 'statBonus' || def.category === 'statPenalty') {
      return getSegmentsForCategory(def.category)
    }

    // Redemption spin: probability based on overall stat score
    if (def.category === 'redemptionSpin') {
      const statScores = Object.fromEntries(
        ['strength','speed','agility','durability','iq','charisma','fightingSkill',
         'powerMastery','weaponMastery','potential','energyLevel']
          .map(cat => [cat, results.find(r => r.category === cat)?.score ?? 0])
      )
      const overall = computeOverallScore(statScores)
      const p = redemptionProbability(overall)
      const rWeight = Math.max(1, Math.round(p * 100))
      const nWeight = Math.max(1, 100 - rWeight)
      return [
        { label: 'Redemption',    weight: rWeight },
        { label: 'No Redemption', weight: nWeight },
      ]
    }

    const baseSegments = getSegmentsForCategory(def.category)

    // Power category: racial bonus spins use activePowerPool; the global 'power' spin always uses global pool
    if (def.category === 'power') {
      const pool = (def.useRacialPowerPool && activePowerPool.length > 0) ? activePowerPool : baseSegments
      const usedPowerLabels = new Set(results.filter(r => r.category === 'power').map(r => r.resultLabel))
      return pool.filter(s => !usedPowerLabels.has(s.label))
    }

    // Stat categories: apply tier rarity weights + race stat modifiers + transformation bonus
    if (STAT_CATEGORIES.has(def.category)) {
      const raceResult = results.find(r => r.category === 'race')
      const race = races.find(r => r.label === raceResult?.resultLabel)
      // Global tier modifier: rarer races (low weight) get significantly better stats.
      // weight 3 (Kryptonian) → ~2.1x capped at 2.0, weight 10 → ~1.8x, weight 20 → ~1.4x, weight 38 → ~0.7x (floored)
      const raceWeight = race?.weight ?? 20
      const globalModifier = Math.max(0.7, Math.min(2.0, 2.2 - raceWeight * 0.04))
      // Use stat-specific modifier if set; otherwise fall back to global tier bonus
      const baseModifier = race?.statModifiers?.[def.category] ?? globalModifier
      // Multiply by transformation bonus if the race has one and it has been spun
      let transformationBonus = 1.0
      if (race?.transformationPool) {
        const transResult = results.find(r => r.category === 'raceTransformation')
        if (transResult) {
          const transItem = race.transformationPool.find(t => t.label === transResult.resultLabel)
          transformationBonus = transItem?.statBonus ?? 1.0
        }
      }
      const modifier = baseModifier * transformationBonus

      // Filter out stat tiers locked by racial tier (minStatTier)
      const minTierIdx = race?.minStatTier != null ? TIER_ORDER.indexOf(race.minStatTier) : -1

      return baseSegments
        .filter(seg => {
          if (minTierIdx < 0) return true
          const fl = seg as { tier?: string }
          if (!fl.tier) return true
          const tIdx = TIER_ORDER.indexOf(fl.tier as TierGrade)
          return tIdx < 0 || tIdx >= minTierIdx
        })
        .map(seg => {
          const fl = seg as { label: string; weight: number; score?: number }
          const score = fl.score
          if (score === undefined) return seg
          // Higher score = rarer tier = lower weight; lower score = more common = higher weight
          const rarityWeight = Math.max(0.3, 11 - score * 0.105)
          // Race modifier: >1 shifts toward high scores, <1 shifts toward low scores
          const finalWeight = Math.max(0.1, rarityWeight * Math.pow(modifier, score / 50))
          return { ...seg, weight: finalWeight }
        })
    }

    return baseSegments
  })

  // ── onMount: restore session if saved ────────────────────────────────────
  onMount(() => {
    const saved = loadSession()
    if (saved && saved.completedSpins.length > 0) {
      currentSession = saved
      showResumePrompt = true
      showMenu = false
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

    // Granted powers collected during category handling; pushed to results after spinResult
    let pendingGrantedPowers: string[] = []

    // Step 1: SPLICE queue (must happen before saveSession)
    if (def.category === 'race') {
      const race = races.find(r => r.label === resultLabel)
      const count = race?.abilitySpinCount ?? 1
      const extraPowers = race?.extraPowerSpins ?? 0
      const weaknessCount = race?.weaknessCount ?? deriveWeaknessCount(race?.weaknessProbabilityModifier ?? 1.0)
      const insertSlots: SpinDefinition[] = []

      // Sub-type spin (e.g., Dragon color, Bender element, Titan type)
      if (race?.subTypePool && race.subTypePool.length > 0) {
        insertSlots.push({ category: 'raceSubType' as const, displayName: `${resultLabel} Type` })
      }

      // Class/rank spin (e.g., Saiyan class, Mutant power level, Viltrumite rank)
      if (race?.classPool && race.classPool.length > 0) {
        insertSlots.push({ category: 'raceClass' as const, displayName: `${resultLabel} Class` })
      }

      // Transformation spin (e.g., Saiyan max form, Vampire age, Kryptonian solar level)
      if (race?.transformationPool && race.transformationPool.length > 0) {
        insertSlots.push({ category: 'raceTransformation' as const, displayName: `${resultLabel} Power Level` })
      }

      // Racial ability slots
      for (let i = 0; i < count; i++) {
        insertSlots.push({ category: 'racialAbility' as const, displayName: `Racial Ability ${count > 1 ? i + 1 : ''}`.trim() })
      }

      // Bonus power slots — racial, use class-specific power pool if set
      for (let i = 0; i < extraPowers; i++) {
        insertSlots.push({ category: 'power' as const, displayName: `Bonus Power ${extraPowers > 1 ? i + 1 : ''}`.trim(), useRacialPowerPool: true })
      }

      // Weakness slots immediately after abilities
      for (let i = 0; i < weaknessCount; i++) {
        insertSlots.push({ category: 'weakness' as const, displayName: weaknessCount > 1 ? `Weakness ${i + 1}` : 'Weakness' })
      }

      spinQueue.splice(currentSpinIndex + 1, 0, ...insertSlots)

      const parts: string[] = []
      if (race?.subTypePool?.length) parts.push('type')
      if (race?.classPool?.length) parts.push('class')
      if (race?.transformationPool?.length) parts.push('power level')
      parts.push(`${count} racial ability${count > 1 ? ' slots' : ''}`)
      if (extraPowers > 0) parts.push(`${extraPowers} bonus power${extraPowers > 1 ? 's' : ''}`)
      if (weaknessCount > 0) parts.push(`${weaknessCount} weakness${weaknessCount > 1 ? 'es' : ''}`)
      showAnnouncement = `${resultLabel}: spin for ${parts.join(', ')}!`
    } else if (def.category === 'raceSubType') {
      const raceResult = results.find(r => r.category === 'race')
      const race = races.find(r => r.label === raceResult?.resultLabel)
      const subTypeItem = race?.subTypePool?.find(s => s.label === resultLabel)
      if (subTypeItem?.statBonusGrants) {
        for (const [stat, bonusType] of Object.entries(subTypeItem.statBonusGrants)) {
          pendingStatBonuses[stat] = bonusType
        }
      }
      if (subTypeItem?.powerPool?.length) {
        activePowerPool = subTypeItem.powerPool
      }
      if (subTypeItem?.grantedPowers?.length) {
        pendingGrantedPowers = subTypeItem.grantedPowers
        showAnnouncement = `${resultLabel}: grants ${pendingGrantedPowers.length} power${pendingGrantedPowers.length > 1 ? 's' : ''}!`
      }
    } else if (def.category === 'raceClass') {
      const raceResult = results.find(r => r.category === 'race')
      const race = races.find(r => r.label === raceResult?.resultLabel)
      const classItem = race?.classPool?.find(c => c.label === resultLabel)
      if (classItem?.statBonusGrants) {
        for (const [stat, bonusType] of Object.entries(classItem.statBonusGrants)) {
          pendingStatBonuses[stat] = bonusType
        }
        const bonusCount = Object.keys(classItem.statBonusGrants).length
        showAnnouncement = `${resultLabel}: unlocks ${bonusCount} stat bonus spin${bonusCount > 1 ? 's' : ''}!`
      }
      if (classItem?.powerPool?.length) {
        activePowerPool = classItem.powerPool
        const msg = `${resultLabel}: power pool activated!`
        showAnnouncement = showAnnouncement ? showAnnouncement + ' ' + msg : msg
      }
      if (classItem?.grantedPowers?.length) {
        pendingGrantedPowers = classItem.grantedPowers
        const msg = `${resultLabel}: grants ${pendingGrantedPowers.length} power${pendingGrantedPowers.length > 1 ? 's' : ''}!`
        showAnnouncement = showAnnouncement ? showAnnouncement + ' ' + msg : msg
      }
    } else if (def.category === 'raceTransformation') {
      const raceResult = results.find(r => r.category === 'race')
      const race = races.find(r => r.label === raceResult?.resultLabel)
      const transItem = race?.transformationPool?.find(t => t.label === resultLabel)
      if (transItem?.statBonusGrants) {
        for (const [stat, bonusType] of Object.entries(transItem.statBonusGrants)) {
          pendingStatBonuses[stat] = bonusType
        }
        const bonusCount = Object.keys(transItem.statBonusGrants).length
        showAnnouncement = `${resultLabel}: unlocks ${bonusCount} stat bonus spin${bonusCount > 1 ? 's' : ''}!`
      }
      if (transItem?.powerPool?.length) {
        activePowerPool = transItem.powerPool
        const msg = `${resultLabel}: power pool activated!`
        showAnnouncement = showAnnouncement ? showAnnouncement + ' ' + msg : msg
      }
      if (transItem?.grantedPowers?.length) {
        pendingGrantedPowers = transItem.grantedPowers
        const msg = `${resultLabel}: grants ${pendingGrantedPowers.length} power${pendingGrantedPowers.length > 1 ? 's' : ''}!`
        showAnnouncement = showAnnouncement ? showAnnouncement + ' ' + msg : msg
      }
    } else if (def.category === 'racialAbility') {
      usedRacialAbilities.add(resultLabel)
    } else if (def.category === 'archetypeAbility') {
      usedArchetypeAbilities.add(resultLabel)
    } else if (def.category === 'possessionRace') {
      // Just record who's possessing — no ability/weakness splicing unlike a real race land
      showAnnouncement = `Possessed by ${resultLabel}!`
    } else if (def.category === 'possessionStrength') {
      const grants = POSSESSION_GRANTS[resultLabel] ?? {}
      const grantKeys = Object.keys(grants)
      for (const [stat, bonusType] of Object.entries(grants)) {
        pendingStatBonuses[stat] = bonusType
      }
      if (grantKeys.length > 0) {
        showAnnouncement = `${resultLabel} — the possession grants ${grantKeys.length} stat modifier${grantKeys.length > 1 ? 's' : ''}!`
      } else {
        showAnnouncement = `${resultLabel} — the possession barely stirs within you.`
      }
    } else if (def.category === 'archetype') {
      const archetype = archetypes.find(a => a.label === resultLabel)
      const count = archetype?.abilitySpinCount ?? 1
      const abilityLabel = archetype?.abilitySpinDisplayName ?? 'Archetype Ability'
      const insertSlots: SpinDefinition[] = []

      // Ability slots (custom display name for Stand, Breathing Style, Titan Form, etc.)
      for (let i = 0; i < count; i++) {
        insertSlots.push({
          category: 'archetypeAbility' as const,
          displayName: count > 1 ? `${abilityLabel} ${i + 1}` : abilityLabel,
        })
      }

      // Stat bonus grants — deferred to when that stat is spun
      if (archetype?.statBonusGrants) {
        for (const [stat, bonusType] of Object.entries(archetype.statBonusGrants)) {
          pendingStatBonuses[stat] = bonusType as 'statBonus' | 'statPenalty'
        }
      }

      // Extra power spins
      const extraPowers = archetype?.extraPowerSpins ?? 0
      for (let i = 0; i < extraPowers; i++) {
        insertSlots.push({
          category: 'power' as const,
          displayName: extraPowers > 1 ? `Bonus Power ${i + 1}` : 'Bonus Power',
        })
      }

      // Bonus weapon spins (dual wielders, artificers, bounty hunters)
      const extraWeapons = archetype?.bonusWeaponSpins ?? 0
      for (let i = 0; i < extraWeapons; i++) {
        insertSlots.push({
          category: 'weapon' as const,
          displayName: extraWeapons > 1 ? `Second Weapon ${i + 1}` : 'Second Weapon',
        })
      }

      // Arbitrary bonus spins (possession race + strength, etc.)
      for (const bonusSpin of (archetype?.bonusSpins ?? [])) {
        insertSlots.push({
          category: bonusSpin.category as SpinCategory,
          displayName: bonusSpin.displayName,
        })
      }

      // Granted powers — injected directly without a spin
      if (archetype?.grantedPowers?.length) {
        pendingGrantedPowers = archetype.grantedPowers
      }

      spinQueue.splice(currentSpinIndex + 1, 0, ...insertSlots)

      // Build announcement
      const parts: string[] = []
      if (count > 0) parts.push(`${count} ${abilityLabel.toLowerCase()} spin${count > 1 ? 's' : ''}`)
      if (extraPowers > 0) parts.push(`${extraPowers} bonus power${extraPowers > 1 ? 's' : ''}`)
      if (extraWeapons > 0) parts.push(`${extraWeapons} bonus weapon${extraWeapons > 1 ? 's' : ''}`)
      if (archetype?.bonusSpins?.length) parts.push(`${archetype.bonusSpins.length} special spin${archetype.bonusSpins.length > 1 ? 's' : ''}`)
      if (archetype?.grantedPowers?.length) parts.push(`${archetype.grantedPowers.length} granted power${archetype.grantedPowers.length > 1 ? 's' : ''}`)
      if (archetype?.statBonusGrants) {
        const n = Object.keys(archetype.statBonusGrants).length
        parts.push(`${n} stat modifier${n > 1 ? 's' : ''}`)
      }
      showAnnouncement = parts.length > 0 ? `${resultLabel}: ${parts.join(', ')}!` : `${resultLabel} archetype selected!`
    } else if (def.category === 'backstory' || def.category === 'title') {
      const pool = def.category === 'backstory' ? backstories : titles
      const item = pool.find(b => b.label === resultLabel)
      if (item?.statBonusGrants && Object.keys(item.statBonusGrants).length > 0) {
        // If the stat was already spun: splice bonus spin immediately (retroactive).
        // If not yet spun: defer into pendingStatBonuses so it fires right after that stat.
        const immediateSlots: SpinDefinition[] = []
        let deferredCount = 0
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
            pendingStatBonuses[stat] = bonusType as 'statBonus' | 'statPenalty'
            deferredCount++
          }
        }
        if (immediateSlots.length > 0) spinQueue.splice(currentSpinIndex + 1, 0, ...immediateSlots)
        const totalCount = immediateSlots.length + deferredCount
        showAnnouncement = `${resultLabel}: ${totalCount} stat modifier spin${totalCount > 1 ? 's' : ''} granted!`
      }
    } else if (def.category === 'weaponMastery') {
      // Use direct typed import — avoids WeightedSegment cast issues with filtered wheels
      const fl = weaponMasteryLabels.find(s => s.label === resultLabel)
      const tierIdx = fl != null ? TIER_ORDER.indexOf(fl.tier) : -1
      const cMinusIdx = TIER_ORDER.indexOf('C-' as TierGrade)
      const sMinusIdx = TIER_ORDER.indexOf('S-' as TierGrade)
      const godIdx    = TIER_ORDER.indexOf('God' as TierGrade)
      // Determine enchants per weapon based on tier
      let enchantsPerWeapon = 0
      if (tierIdx >= cMinusIdx) enchantsPerWeapon = 1
      if (tierIdx >= sMinusIdx) enchantsPerWeapon = 2
      if (tierIdx >= godIdx)    enchantsPerWeapon = 3
      // Count all real weapons (bonus + main); Unarmed doesn't qualify
      const weaponResults = results.filter(r => r.category === 'weapon' && r.resultLabel !== 'No Weapon (Unarmed)')
      const totalEnchants = weaponResults.length * enchantsPerWeapon
      if (totalEnchants > 0) {
        const enchantSlots: SpinDefinition[] = []
        let n = 1
        for (const wr of weaponResults) {
          const weaponName = wr.resultLabel.length > 18 ? wr.resultLabel.slice(0, 16) + '…' : wr.resultLabel
          for (let e = 0; e < enchantsPerWeapon; e++) {
            enchantSlots.push({
              category: 'weaponEnchantment' as const,
              displayName: totalEnchants > 1 ? `Enchantment ${n++} — ${weaponName}` : 'Weapon Enchantment',
            })
          }
        }
        spinQueue.splice(currentSpinIndex + 1, 0, ...enchantSlots)
        showAnnouncement = `Weapon mastery ${fl?.tier} — ${totalEnchants} enchantment${totalEnchants > 1 ? 's' : ''} unlocked!`
      }
    } else if (def.category === 'redemptionSpin') {
      if (resultLabel === 'Redemption') {
        spinQueue.splice(currentSpinIndex + 1, 0, {
          category: 'redemptionOutcome' as const,
          displayName: 'Redemption Outcome',
        })
        showAnnouncement = 'The fates grant you a second chance!'
      }
    } else if (def.category === 'statBonus' || def.category === 'statPenalty') {
      // Apply tier shift to the target stat result
      const tierShift = parseInt(resultLabel) // "+5" → 5, "-3" → -3 (parseInt handles the sign)
      if (def.targetStat) {
        let targetIdx = -1
        for (let i = results.length - 1; i >= 0; i--) {
          if (results[i].category === def.targetStat) { targetIdx = i; break }
        }
        if (targetIdx !== -1 && results[targetIdx].tier) {
          const currentIdx = TIER_ORDER.indexOf(results[targetIdx].tier as TierGrade)
          const newIdx = Math.max(0, Math.min(TIER_ORDER.length - 1, currentIdx + tierShift))
          const newGrade = TIER_ORDER[newIdx]
          const newScore = gradeToScore(newGrade)
          // Look up the matching flavor label for the new tier so description stays accurate
          const statSegs = getSegmentsForCategory(def.targetStat as SpinCategory)
          const newLabel = (statSegs as { label?: string; tier?: string }[]).find(s => s.tier === newGrade)?.label
            ?? results[targetIdx].resultLabel
          // Index-based replacement triggers Svelte 5 reactivity correctly
          results[targetIdx] = { ...results[targetIdx], tier: newGrade, score: newScore, resultLabel: newLabel }
          // Track cumulative shift so rerolls can re-apply bonuses
          statBonusOffsets[def.targetStat] = (statBonusOffsets[def.targetStat] ?? 0) + tierShift
        }
      }
      const statLabel = def.targetStat ?? 'stat'
      showAnnouncement = `${statLabel.replace(/([A-Z])/g, ' $1').trim()} shifted by ${resultLabel} tier${Math.abs(tierShift) > 1 ? 's' : ''}!`
    } else if (def.category === 'redemptionOutcome') {
      const STAT_CATS = ['strength','speed','agility','durability','iq','charisma','fightingSkill','potential','energyLevel','powerMastery','weaponMastery']
      if (resultLabel === 'Reroll Everything (Chaos Edition)') {
        // Remove all existing stat results; splice fresh stat spins marked as rerolls
        for (const cat of STAT_CATS) {
          const idx = results.findIndex(r => r.category === cat)
          if (idx !== -1) results.splice(idx, 1)
        }
        const rerollSlots: SpinDefinition[] = STAT_CATS.map(cat => ({
          category: cat as SpinCategory,
          displayName: `Reroll: ${cat.replace(/([A-Z])/g, ' $1').trim().replace(/^\w/, c => c.toUpperCase())}`,
          isReroll: true,
        }))
        spinQueue.splice(currentSpinIndex + 1, 0, ...rerollSlots)
        showAnnouncement = 'Chaos reigns — all stats rerolling! (Your bonuses are saved.)'
      } else if (resultLabel === 'All Stats +1 Tier') {
        for (const cat of STAT_CATS) {
          const idx = results.findIndex(r => r.category === cat)
          if (idx !== -1 && results[idx].tier) {
            const curIdx = TIER_ORDER.indexOf(results[idx].tier as TierGrade)
            const newIdx = Math.min(TIER_ORDER.length - 1, curIdx + 1)
            const newGrade = TIER_ORDER[newIdx]
            const statSegs = getSegmentsForCategory(cat as SpinCategory)
            const newLbl = (statSegs as { label?: string; tier?: string }[]).find(s => s.tier === newGrade)?.label ?? results[idx].resultLabel
            results[idx] = { ...results[idx], tier: newGrade, score: gradeToScore(newGrade), resultLabel: newLbl }
            statBonusOffsets[cat] = (statBonusOffsets[cat] ?? 0) + 1
          }
        }
        showAnnouncement = 'Every stat bumped up one tier!'
      } else if (resultLabel === 'Demigod Status (Unofficial)') {
        for (const cat of STAT_CATS) {
          const idx = results.findIndex(r => r.category === cat)
          if (idx !== -1 && results[idx].tier) {
            const curIdx = TIER_ORDER.indexOf(results[idx].tier as TierGrade)
            const newIdx = Math.min(TIER_ORDER.length - 1, curIdx + 3)
            const newGrade = TIER_ORDER[newIdx]
            const statSegs = getSegmentsForCategory(cat as SpinCategory)
            const newLbl = (statSegs as { label?: string; tier?: string }[]).find(s => s.tier === newGrade)?.label ?? results[idx].resultLabel
            results[idx] = { ...results[idx], tier: newGrade, score: gradeToScore(newGrade), resultLabel: newLbl }
            statBonusOffsets[cat] = (statBonusOffsets[cat] ?? 0) + 3
          }
        }
        showAnnouncement = 'Demigod Status: all stats +3 tiers!'
      } else if (resultLabel === 'Reroll Your Worst Stat') {
        const worstStat = STAT_CATS.reduce((worst, cat) => {
          const r = results.find(r => r.category === cat)
          const worstR = results.find(r => r.category === worst)
          if (!r) return worst
          if (!worstR) return cat
          return (r.score ?? 0) < (worstR.score ?? 0) ? cat : worst
        }, STAT_CATS[0])
        const worstIdx = results.findIndex(r => r.category === worstStat)
        if (worstIdx !== -1) results.splice(worstIdx, 1)
        spinQueue.splice(currentSpinIndex + 1, 0, {
          category: worstStat as SpinCategory,
          displayName: `Reroll: ${worstStat.replace(/([A-Z])/g, ' $1').trim().replace(/^\w/, c => c.toUpperCase())}`,
          isReroll: true,
        })
        showAnnouncement = `Rerolling your worst stat!`
      } else if (resultLabel === 'Double Your Best Stat') {
        const bestStat = STAT_CATS.reduce((best, cat) => {
          const r = results.find(r => r.category === cat)
          const bestR = results.find(r => r.category === best)
          if (!r) return best
          if (!bestR) return cat
          return (r.score ?? 0) > (bestR.score ?? 0) ? cat : best
        }, STAT_CATS[0])
        const bestIdx = results.findIndex(r => r.category === bestStat)
        if (bestIdx !== -1 && results[bestIdx].tier) {
          const curIdx = TIER_ORDER.indexOf(results[bestIdx].tier as TierGrade)
          const newIdx = Math.min(TIER_ORDER.length - 1, curIdx + 5)
          const newGrade = TIER_ORDER[newIdx]
          const statSegs = getSegmentsForCategory(bestStat as SpinCategory)
          const newLbl = (statSegs as { label?: string; tier?: string }[]).find(s => s.tier === newGrade)?.label ?? results[bestIdx].resultLabel
          results[bestIdx] = { ...results[bestIdx], tier: newGrade, score: gradeToScore(newGrade), resultLabel: newLbl }
          statBonusOffsets[bestStat] = (statBonusOffsets[bestStat] ?? 0) + 5
        }
        showAnnouncement = 'Best stat doubled (+5 tiers)!'
      } else if (resultLabel === 'God Tier Potential (One Use)') {
        const potIdx = results.findIndex(r => r.category === 'potential')
        if (potIdx !== -1) {
          const statSegs = getSegmentsForCategory('potential')
          const godLbl = (statSegs as { label?: string; tier?: string }[]).find(s => s.tier === 'God')?.label ?? 'God Tier Potential'
          results[potIdx] = { ...results[potIdx], tier: 'God', score: 100, resultLabel: godLbl }
        }
        showAnnouncement = 'Potential raised to God Tier!'
      } else if (resultLabel === 'Free God Tier Strength') {
        const strIdx = results.findIndex(r => r.category === 'strength')
        if (strIdx !== -1) {
          const statSegs = getSegmentsForCategory('strength')
          const godLbl = (statSegs as { label?: string; tier?: string }[]).find(s => s.tier === 'God')?.label ?? 'Lifts Reality Itself'
          results[strIdx] = { ...results[strIdx], tier: 'God', score: 100, resultLabel: godLbl }
        }
        showAnnouncement = 'Strength raised to God Tier!'
      } else if (resultLabel === 'Gain a Bonus Power' || resultLabel === 'Free Power Reroll') {
        spinQueue.splice(currentSpinIndex + 1, 0, { category: 'power' as const, displayName: 'Redemption Power' })
        showAnnouncement = resultLabel === 'Free Power Reroll' ? 'Spin for a free power!' : 'Bonus power granted!'
      } else if (resultLabel === 'Lose One Weakness') {
        const weakIdx = results.map((r, i) => ({ r, i })).reverse().find(({ r }) => r.category === 'weakness')?.i ?? -1
        if (weakIdx !== -1) results.splice(weakIdx, 1)
        showAnnouncement = 'One weakness removed!'
      } else if (resultLabel === 'Bonus Archetype Ability') {
        spinQueue.splice(currentSpinIndex + 1, 0, { category: 'archetypeAbility' as const, displayName: 'Redemption Archetype Ability' })
        showAnnouncement = 'Bonus archetype ability spin granted!'
      } else if (resultLabel === 'Secret Fourth Racial Ability') {
        spinQueue.splice(currentSpinIndex + 1, 0, { category: 'racialAbility' as const, displayName: 'Secret Racial Ability' })
        showAnnouncement = 'A hidden racial ability has been unlocked!'
      } else {
        showAnnouncement = `${resultLabel} — fate is strange.`
      }
    }

    // Step 2a: For stat categories, check pendingStatBonuses and splice modifier spin
    if (STAT_CATEGORIES.has(def.category) && pendingStatBonuses[def.category]) {
      const bonusType = pendingStatBonuses[def.category]
      spinQueue.splice(currentSpinIndex + 1, 0, {
        category: bonusType as 'statBonus' | 'statPenalty',
        displayName: `${def.displayName} ${bonusType === 'statBonus' ? 'Bonus' : 'Penalty'}`,
        targetStat: def.category,
      })
      delete pendingStatBonuses[def.category]
    }

    // Step 2: PUSH result
    const spinResult: SpinResult = {
      step: results.length + 1,
      category: def.category,
      resultLabel,
      resultIndex,
      timestamp: new Date().toISOString(),
    }

    // For stat categories, look up tier + score from the FlavorLabel embedded data.
    // Must search by resultLabel (not resultIndex) because minStatTier filtering shifts indices.
    if (STAT_CATEGORIES.has(def.category)) {
      const segments = getSegmentsForCategory(def.category)
      const label = (segments as { label: string; weight: number; color?: string; tier?: TierGrade; score?: number }[])
        .find(s => s.label === resultLabel)
      if (label?.tier !== undefined) {
        spinResult.tier = label.tier
      }
      if (label?.score !== undefined) {
        spinResult.score = label.score
      }
    }

    // If this is a reroll spin, remove the old result for this category before pushing
    if (def.isReroll) {
      const oldIdx = results.findIndex(r => r.category === def.category)
      if (oldIdx !== -1) results.splice(oldIdx, 1)
    }

    results.push(spinResult)

    // Re-apply saved bonus offsets so rerolled stats keep their previously earned shifts
    if (def.isReroll && STAT_CATEGORIES.has(def.category) && statBonusOffsets[def.category]) {
      const offset = statBonusOffsets[def.category]
      const newIdx = results.findIndex(r => r.category === def.category)
      if (newIdx !== -1 && results[newIdx].tier) {
        const curTierIdx = TIER_ORDER.indexOf(results[newIdx].tier as TierGrade)
        const shiftedIdx = Math.max(0, Math.min(TIER_ORDER.length - 1, curTierIdx + offset))
        const shiftedGrade = TIER_ORDER[shiftedIdx]
        const statSegs = getSegmentsForCategory(def.category as SpinCategory)
        const shiftedLabel = (statSegs as { label?: string; tier?: string }[]).find(s => s.tier === shiftedGrade)?.label ?? results[newIdx].resultLabel
        results[newIdx] = { ...results[newIdx], tier: shiftedGrade, score: gradeToScore(shiftedGrade), resultLabel: shiftedLabel }
      }
    }

    // Inject class/subType/transformation granted powers directly (no spin required)
    for (const powerLabel of pendingGrantedPowers) {
      results.push({
        step: results.length + 1,
        category: 'power',
        resultLabel: powerLabel,
        resultIndex: -1,
        timestamp: new Date().toISOString(),
      })
    }

    // Step 3: SAVE with $state.snapshot (prevents Proxy serialization issues)
    saveSession({
      ...currentSession,
      completedSpins: $state.snapshot(results),
      spinQueue: $state.snapshot(spinQueue),
      currentSpinIndex,
      pendingStatBonuses: $state.snapshot(pendingStatBonuses),
    } as SessionState)

    isRevealed = true
  }

  // ── handleNextSpin: advance index, clear announcement ────────────────────
  function handleNextSpin() {
    showAnnouncement = null
    isRevealed = false
    currentSpinIndex++
    if (currentSpinIndex >= spinQueue.length) {
      showNameScreen = true
    }
  }

  // ── handleResume: dismiss prompt, restore pendingStatBonuses ─────────────
  function handleResume() {
    showResumePrompt = false
    isRevealed = false
    if (currentSession.pendingStatBonuses) {
      pendingStatBonuses = { ...currentSession.pendingStatBonuses }
    }
    // Reconstruct used ability sets from saved results
    usedRacialAbilities = new Set(
      currentSession.completedSpins.filter(r => r.category === 'racialAbility').map(r => r.resultLabel)
    )
    usedArchetypeAbilities = new Set(
      currentSession.completedSpins.filter(r => r.category === 'archetypeAbility').map(r => r.resultLabel)
    )
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
    showNameScreen = false
    characterName = ''
    isRevealed = false
    showResumePrompt = false
    pendingStatBonuses = {}
    usedRacialAbilities = new Set()
    usedArchetypeAbilities = new Set()
    activePowerPool = []
    statBonusOffsets = {}
  }

  // ── handleBackToMenu: return to main menu without starting a new session ─
  function handleBackToMenu() {
    showMenu = true
    showCard = false
    showNameScreen = false
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
    showNameScreen = false
    characterName = ''
    isRevealed = false
    showResumePrompt = false
    pendingStatBonuses = {}
    usedRacialAbilities = new Set()
    usedArchetypeAbilities = new Set()
    activePowerPool = []
    statBonusOffsets = {}
  }

  function handleNameSubmit() {
    showNameScreen = false
    showCard = true
  }
</script>

<main class="min-h-screen" style="background: #07070d; color: #e4e1ee;">

  <!-- Fixed top nav -->
  <nav class="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-4 h-14"
    style="background: rgba(7,7,13,0.94); border-bottom: 1px solid rgba(240,192,64,0.13); backdrop-filter: blur(16px);"
  >
    <div class="flex items-center gap-2">
      <span class="material-symbols-outlined" style="color: #f0c040; font-size: 18px; font-variation-settings: 'FILL' 1;">casino</span>
      <span style="font-family: 'Cinzel', serif; font-size: 13px; font-weight: 700; color: #ffdf96; letter-spacing: 0.18em;">WHEEL OF FATE</span>
    </div>
    <div class="flex items-center gap-3">
      {#if !showMenu}
        <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #9a907b; letter-spacing: 0.05em;">{spinCounterText}</span>
      {/if}
      <button
        onclick={() => showSettings = !showSettings}
        style="background: none; border: none; cursor: pointer; color: {showSettings ? '#f0c040' : '#9a907b'}; display: flex; align-items: center; transition: color 0.15s;"
        aria-label="Settings"
      >
        <span class="material-symbols-outlined" style="font-size: 20px; font-variation-settings: 'FILL' {showSettings ? '1' : '0'};">settings</span>
      </button>
    </div>
  </nav>

  {#if showSettings}
    <SettingsPanel onClose={() => showSettings = false} />
  {/if}

  <!-- Main Menu -->
  {#if showMenu}
    <div class="min-h-screen flex flex-col items-center justify-center px-6 pt-14" style="background: #07070d;">
      <!-- Decorative top glow -->
      <div class="absolute top-0 inset-x-0 h-64 pointer-events-none" style="background: radial-gradient(ellipse 60% 40% at 50% 0%, rgba(240,192,64,0.07), transparent);"></div>

      <!-- Logo mark -->
      <div class="mb-8 flex flex-col items-center gap-4">
        <span class="material-symbols-outlined" style="font-size: 56px; color: #f0c040; font-variation-settings: 'FILL' 1;">casino</span>
        <div class="text-center">
          <h1 style="font-family: 'Cinzel', serif; font-size: clamp(2rem, 8vw, 3.2rem); font-weight: 900; color: #ffdf96; letter-spacing: 0.18em; line-height: 1.1;">WHEEL OF FATE</h1>
          <p class="mt-3 text-sm tracking-[0.25em] uppercase" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Spin your destiny. Accept the consequences.</p>
        </div>
      </div>

      <!-- Divider -->
      <div class="w-24 h-px mb-10" style="background: linear-gradient(90deg, transparent, #f0c04040, transparent);"></div>

      <!-- Buttons -->
      <div class="flex flex-col gap-4 w-full max-w-xs">
        <button
          onclick={() => { showMenu = false }}
          class="w-full py-4 rounded-lg text-sm tracking-[0.2em] uppercase font-bold transition-all active:scale-95 hover:scale-[1.02]"
          style="font-family: 'Cinzel', serif; color: #ffdf96; background: linear-gradient(135deg, #1c1a2a, #13121c); border: 1px solid #f0c040; box-shadow: 0 0 32px rgba(240,192,64,0.18);"
        >
          Spin Your Fate
        </button>
        <a
          href="/characters"
          class="w-full py-4 rounded-lg text-sm tracking-[0.2em] uppercase font-bold transition-all active:scale-95 hover:scale-[1.02] text-center block"
          style="font-family: 'Cinzel', serif; color: #9a907b; background: #0d0d16; border: 1px solid #4e4635; text-decoration: none;"
        >
          View Characters
        </a>
      </div>

      <!-- Bottom flavour -->
      <p class="mt-14 text-xs tracking-[0.15em] uppercase" style="font-family: 'JetBrains Mono', monospace; color: #4e4635;">23 spins. One fate. No take-backs.</p>
    </div>
  {/if}

  <!-- Resume prompt (modal overlay) -->
  {#if showResumePrompt}
    <div class="fixed inset-0 z-40 flex items-center justify-center px-4"
      style="background: rgba(7,7,13,0.88); backdrop-filter: blur(10px);"
    >
      <div class="w-full max-w-sm rounded-xl p-7 text-center"
        style="background: #1f1f28; border: 1px solid rgba(240,192,64,0.22); box-shadow: 0 0 50px rgba(0,0,0,0.7);"
      >
        <span class="material-symbols-outlined block text-4xl mb-3" style="color: #f0c040; font-variation-settings: 'FILL' 1;">history</span>
        <p style="font-family: 'Cinzel', serif; font-size: 1.05rem; font-weight: 700; color: #ffdf96; margin-bottom: 6px;">Saved Session Found</p>
        <p class="text-sm mb-6" style="color: #9a907b;">
          Last: <span style="color: #e4e1ee;">{currentSession.completedSpins.at(-1)?.resultLabel ?? ''}</span>
          &nbsp;·&nbsp;
          {currentSession.completedSpins.length} spin{currentSession.completedSpins.length === 1 ? '' : 's'} done
        </p>
        <div class="flex gap-3">
          <button onclick={handleResume}
            class="flex-1 py-2.5 rounded-lg text-sm font-bold transition-all active:scale-95"
            style="font-family: 'Cinzel', serif; color: #ffdf96; background: linear-gradient(135deg, #1c1a2a, #13121c); border: 1px solid #f0c040; letter-spacing: 0.1em; box-shadow: 0 0 20px rgba(240,192,64,0.12);"
          >Resume</button>
          <button onclick={handleStartOver}
            class="flex-1 py-2.5 rounded-lg text-sm font-bold transition-all active:scale-95"
            style="font-family: 'Cinzel', serif; color: #9a907b; background: #1b1b24; border: 1px solid #4e4635; letter-spacing: 0.1em;"
          >Start Over</button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Name your character screen -->
  {#if showNameScreen}
    <div class="flex flex-col items-center justify-center min-h-screen px-4"
      style="animation: slideUp 0.4s ease-out forwards;">
      <div class="w-full max-w-sm flex flex-col items-center gap-6 text-center">
        <span class="material-symbols-outlined text-5xl" style="color: #f0c040; font-variation-settings: 'FILL' 1;">auto_fix_high</span>
        <div>
          <p class="text-xs tracking-[0.25em] uppercase mb-2"
            style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Character Created</p>
          <h2 style="font-family: 'Cinzel', serif; font-size: 1.7rem; font-weight: 700; color: #ffdf96; letter-spacing: 0.08em;">Name Your Legend</h2>
          <p class="text-sm mt-2" style="color: #9a907b;">Give your fate-spun hero a name to be remembered by.</p>
        </div>
        <input
          type="text"
          bind:value={characterName}
          placeholder="Enter a name…"
          maxlength="40"
          class="w-full rounded-lg px-4 py-3 text-center text-lg outline-none transition-all"
          style="background: #1f1f28; border: 1px solid rgba(240,192,64,0.28); color: #e4e1ee; font-family: 'Cinzel', serif; caret-color: #f0c040;"
          onkeydown={(e) => e.key === 'Enter' && handleNameSubmit()}
        />
        <button
          onclick={handleNameSubmit}
          class="px-10 py-3 rounded-lg text-sm tracking-[0.2em] uppercase font-bold transition-all active:scale-95"
          style="font-family: 'Cinzel', serif; color: #ffdf96; background: linear-gradient(135deg, #1c1a2a, #13121c); border: 1px solid #f0c040; box-shadow: 0 0 26px rgba(240,192,64,0.16);"
        >
          {characterName.trim() ? 'Reveal Character' : 'Skip'}
        </button>
      </div>
    </div>
  {/if}

  <!-- Character card screen -->
  {#if showCard}
    <div class="flex justify-center pt-20 pb-8 px-4">
      <CharacterCard {results} name={characterName} startedAt={currentSession.startedAt} onNewCharacter={handleNewCharacter} onBackToMenu={handleBackToMenu} />
    </div>
  {/if}

  <!-- Main game: two-column layout -->
  {#if !showCard && !showResumePrompt && !showNameScreen}
    <div class="flex pt-14 min-h-screen">

      <!-- LEFT SIDEBAR: Destiny Log -->
      <aside class="hidden md:flex flex-col shrink-0 sticky top-14 overflow-hidden"
        style="width: 260px; height: calc(100vh - 3.5rem); background: rgba(13,13,22,0.7); border-right: 1px solid rgba(240,192,64,0.08);"
      >
        <!-- Sidebar header -->
        <div class="flex items-center gap-2 px-4 py-3 shrink-0"
          style="border-bottom: 1px solid rgba(240,192,64,0.08);">
          <span class="material-symbols-outlined" style="font-size: 15px; color: #9a907b; font-variation-settings: 'FILL' 1;">list_alt</span>
          <p class="text-xs tracking-[0.15em] uppercase"
            style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Destiny Log</p>
          <span class="ml-auto text-xs px-1.5 py-0.5 rounded"
            style="font-family: 'JetBrains Mono', monospace; color: #9a907b; background: #1b1b24; border: 1px solid #4e4635;">
            {results.length}
          </span>
        </div>

        <!-- Scrollable result rows -->
        <div class="flex-1 overflow-y-auto">
          {#if results.length === 0}
            <p class="text-xs text-center py-8 px-4" style="color: #4e4635; font-style: italic;">
              Your fate is being written…
            </p>
          {/if}
          {#each [...results].reverse() as result}
            {@const tc = TIER_COLORS[result.tier ?? ''] ?? null}
            <div class="flex items-start gap-2.5 px-3 py-2.5"
              style="border-bottom: 1px solid rgba(255,255,255,0.04); {tc ? `border-left: 2px solid ${tc}44;` : 'border-left: 2px solid transparent;'}">
              <span class="material-symbols-outlined shrink-0 mt-0.5"
                style="font-size: 13px; color: {tc ?? '#4e4635'}; font-variation-settings: 'FILL' 1;">check_circle</span>
              <div class="flex-1 min-w-0">
                <p class="text-xs truncate mb-0.5"
                  style="font-family: 'JetBrains Mono', monospace; color: #9a907b; font-size: 10px;">{result.category}</p>
                <p class="text-xs truncate" style="color: #e4e1ee; line-height: 1.3;">{result.resultLabel}{result.category === 'archetype' && archetypeTypeFor(result.resultLabel) ? ` · ${archetypeTypeFor(result.resultLabel)}` : ''}</p>
              </div>
              {#if result.tier}
                <span class="text-xs font-bold shrink-0 self-center px-1.5 py-0.5 rounded"
                  style="font-size: 10px; color: {tc ?? '#9a907b'}; background: {tc ?? '#374151'}18; border: 1px solid {tc ?? '#4e4635'}55;">
                  {result.tier}
                </span>
              {/if}
            </div>
          {/each}
        </div>
      </aside>

      <!-- RIGHT: Category heading + wheel + overlay -->
      <div class="flex-1 flex flex-col items-center px-4 py-8 overflow-y-auto">

        <!-- Category heading (outside overlay so it stays visible) -->
        <div class="text-center mb-5" style="animation: fadeIn 0.25s ease-out forwards;">
          <p class="text-xs tracking-[0.22em] uppercase mb-1.5"
            style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">
            {isRevealed ? 'result revealed' : 'spinning for'}
          </p>
          <h2 style="font-family: 'Cinzel', serif; font-size: clamp(1.15rem, 5vw, 1.55rem); font-weight: 700; color: #ffdf96; letter-spacing: 0.1em;">
            {(currentDef?.displayName ?? '').toUpperCase()}
          </h2>
        </div>

        <!-- Wheel container (relative so overlay can sit on top) -->
        <div class="relative w-full max-w-lg">

          <!-- Wheel (remounts each spin to reset IDLE state) -->
          {#key currentSpinIndex}
            <SpinWheel
              segments={currentSegments}
              onSpinComplete={handleSpinComplete}
              categoryHue={currentCategoryHue}
              soundEnabled={settings.soundEnabled}
              effectsEnabled={settings.effectsEnabled}
              spinSpeedMultiplier={settings.spinSpeed}
            />
          {/key}

          <!-- Result reveal overlay (appears once wheel lands) -->
          {#if isRevealed}
            {@const last = results.at(-1)}
            {@const tc = TIER_COLORS[last?.tier ?? ''] ?? null}
            <div
              class="absolute inset-0 flex flex-col items-center justify-center rounded-2xl z-10"
              style="background: rgba(0,0,0,0.78); backdrop-filter: blur(4px); animation: fadeIn 0.18s ease-out forwards;"
            >
              <div class="flex flex-col items-center gap-4 px-8 text-center"
                style="animation: resultReveal 0.52s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;"
              >

                <!-- Tier badge (stats only) -->
                {#if last?.tier && tc}
                  <div class="px-4 py-1.5 rounded-lg"
                    style="background: {tc}18; border: 1px solid {tc}55; box-shadow: 0 0 20px {tc}35;">
                    <span class="font-black" style="font-family: 'Cinzel', serif; font-size: 2rem; color: {tc}; filter: drop-shadow(0 0 8px {tc}66);">
                      {last.tier}
                    </span>
                  </div>
                {/if}

                <!-- Result label -->
                <p style="font-family: 'Cinzel', serif; font-size: clamp(0.95rem, 3.5vw, 1.3rem); font-weight: 700; color: #ffdf96; line-height: 1.35; max-width: 26ch;">
                  {last?.resultLabel ?? ''}
                </p>

                <!-- Announcement (bonus spins, enchantment unlock, etc.) -->
                {#if showAnnouncement}
                  <p class="text-sm" style="color: #a78bfa; max-width: 28ch; line-height: 1.4;">{showAnnouncement}</p>
                {/if}

                <!-- Continue button -->
                <button
                  onclick={handleNextSpin}
                  class="mt-1 flex items-center gap-2 px-8 py-3 rounded-lg text-sm tracking-[0.16em] uppercase font-bold transition-all active:scale-95"
                  style="font-family: 'Cinzel', serif; color: #ffdf96; background: linear-gradient(135deg, #1c1a2a, #13121c); border: 1px solid #f0c040; box-shadow: 0 0 28px rgba(240,192,64,0.2);"
                >
                  <span>Continue</span>
                  <span class="material-symbols-outlined leading-none" style="font-size: 16px; color: #f0c040; font-variation-settings: 'FILL' 1;">arrow_circle_right</span>
                </button>

              </div>
            </div>
          {/if}

        </div><!-- end wheel container -->

        <!-- Mobile-only results strip (below wheel on small screens) -->
        {#if results.length > 0}
          <div class="md:hidden w-full max-w-lg mt-6">
            <div class="rounded-xl overflow-hidden" style="border: 1px solid rgba(240,192,64,0.1); background: #0d0d16;">
              <div class="flex items-center gap-2 px-4 py-2.5"
                style="border-bottom: 1px solid rgba(240,192,64,0.08);">
                <span class="material-symbols-outlined" style="font-size: 14px; color: #9a907b; font-variation-settings: 'FILL' 1;">list_alt</span>
                <p class="text-xs tracking-[0.15em] uppercase"
                  style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Destiny Log</p>
              </div>
              <div class="max-h-48 overflow-y-auto">
                {#each [...results].reverse() as result}
                  {@const tc = TIER_COLORS[result.tier ?? ''] ?? null}
                  <div class="flex items-center gap-3 px-4 py-2.5"
                    style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                    <span class="material-symbols-outlined shrink-0"
                      style="font-size: 14px; color: {tc ?? '#4e4635'}; font-variation-settings: 'FILL' 1;">check_circle</span>
                    <span class="text-xs shrink-0 truncate"
                      style="font-family: 'JetBrains Mono', monospace; color: #9a907b; width: 5.5rem;">{result.category}</span>
                    {#if result.tier && tc}
                      <span class="text-xs font-bold shrink-0 px-1.5 py-0.5 rounded"
                        style="font-size: 10px; color: {tc}; background: {tc}18; border: 1px solid {tc}55;">{result.tier}</span>
                    {:else}
                      <span class="w-10 shrink-0"></span>
                    {/if}
                    <span class="text-xs flex-1 truncate" style="color: #e4e1ee;">{result.resultLabel}</span>
                  </div>
                {/each}
              </div>
            </div>
          </div>
        {/if}

      </div><!-- end right column -->

    </div><!-- end two-column layout -->
  {/if}

</main>
