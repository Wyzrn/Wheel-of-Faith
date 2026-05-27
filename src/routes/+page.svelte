<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { getRivalsWs, clearRivalsWs, patchRivalsWs } from '$lib/stores/rivalsWs'
  import { isOfflineRivalsActive, setOfflineRivalsResult } from '$lib/stores/offlineRivals'
  import SpinWheel from '../components/SpinWheel.svelte'
  import SpinProgressDots from '../components/SpinProgressDots.svelte'
  import FirstTimeTooltip from '../components/FirstTimeTooltip.svelte'
  import TierBadge from '../components/TierBadge.svelte'
  import CharacterCard from '../components/CharacterCard.svelte'
  import SettingsPanel from '../components/SettingsPanel.svelte'
  import QuickBattleView from '../components/QuickBattleView.svelte'
  import { loadSession, saveSession, clearSession, flushSession, createSession } from '$lib/session/store'
  import type { SessionState, SpinResult } from '$lib/session/types'
  import { buildInitialQueue, getSegmentsForCategory } from '$lib/game/spinQueue'
  import type { SpinDefinition, SpinCategory } from '$lib/game/spinQueue'
  import { computeOverallScore, scoreTier, gradeToScore, TIER_THRESHOLDS, NO_NEGATIVE_STATS, normalizeLegacyDisplayLabel } from '$lib/game/scoreTier'
  import type { TierGrade } from '$lib/game/scoreTier'
  import { redemptionProbability } from '$lib/game/redemption'
  import { races, getRace, racePoolLookup as _racePoolLookup, abilityLookup as _abilityLookup } from '$lib/content/races'
  import { archetypes, getArchetype } from '$lib/content/archetypes'
  import { DEVIL_FRUIT_POOLS } from '$lib/content/devil-fruits'
  import { weapons as weaponsPool, weaponsByCategory } from '$lib/content/weapons'
  import { armors as armorsPool, armorsByCategory } from '$lib/content/armors'
  import { enchantments as enchantmentsPool } from '$lib/content/enchantments'
  import { armorStrengthLabels } from '$lib/content/armor-strength-labels'
  import { backstories } from '$lib/content/backstories'
  import { titles } from '$lib/content/titles'
  import { weaponMasteryLabels } from '$lib/content/weapon-mastery-labels'
  import { settings } from '$lib/settings.svelte'
  import { menuSignal } from '$lib/menuState.svelte'
  import { auth } from '$lib/stores/auth.svelte'
  import { powers as powersPool } from '$lib/content/powers'
  import Tutorial from '../components/Tutorial.svelte'
  import { appendSpinHistory } from '$lib/spinHistory'
  import { loadCharHistory, pushCharHistory, migrateLegacyLastChar, markCharSaved, type CharHistoryEntry } from '$lib/charHistory'
  import SpinResultReveal from '../components/SpinResultReveal.svelte'
  import type { ResolvedMeta } from '$lib/spinResultMeta'
  import { randomCharacterName } from '$lib/story/naming'
  import { generateCharacterSummary } from '$lib/characterSummary'
  import { ELEMENT_COLORS, ELEMENT_ICONS, ITEM_GRADE_INFO } from '$lib/content/elements'
  import { resolveLandingForCategory } from '$lib/landingColors'
  import { buildIdentityCard } from '$lib/identityCard'
  import { twistForRace, twistForArchetype, twistByKey, RACE_TWIST_TRIGGERS, ARCHETYPE_TWIST_TRIGGERS } from '$lib/twists'
  import type { ElementType, ItemGrade } from '$lib/content/types'
  const _powerLookup      = new Map(powersPool.map(p => [p.label, p]))
  const _weaponLookup     = new Map(weaponsPool.map(w => [w.label, w]))
  const _armorLookup      = new Map(armorsPool.map(a => [a.label, a]))
  const _enchantLookup    = new Map(enchantmentsPool.map(e => [e.label, e]))

  // _racePoolLookup and _abilityLookup are imported as module-level maps from
  // $lib/content/races (built once when the content chunk loads, populated with
  // archetype abilities by the archetypes module on import).
  // Derives weakness count from race's probability modifier when no explicit count is set
  function archetypeTypeFor(label: string): string {
    return getArchetype(label)?.archetypeType ?? ''
  }

  function deriveWeaknessCount(modifier: number): number {
    if (modifier < 0.65) return 0
    if (modifier < 1.15) return 1
    if (modifier < 1.5)  return 2
    return 3
  }

  // ── State declarations ────────────────────────────────────────────────────
  let showMenu = $state(true)
  const LANDING_KEY = 'wof_visited'
  let showLanding = $state(typeof localStorage !== 'undefined' && !localStorage.getItem(LANDING_KEY))
  let spinTriggerKey = $state(0)
  let currentSession = $state<SessionState>(createSession())
  let showResumePrompt = $state(false)
  let spinQueue = $state<SpinDefinition[]>(buildInitialQueue())
  let currentSpinIndex = $state(0)
  let results = $state<SpinResult[]>([])
  let showAnnouncement = $state<string | null>(null)
  let showCard = $state(false)
  let pendingStatBonuses = $state<Record<string, Array<'statBonus' | 'statPenalty'>>>({})
  // Class/subType/transformation power pool override — used only by racial bonus power spins
  let activePowerPool = $state<{ label: string; weight: number }[]>([])
  // Element locked in by a twist sub-spin (Bender: Fire, Demi-God: Storms,
  // Cursed Sorcerer: domain). Power + ability spins downstream prefer this
  // element when set. Null = no lock.
  let lockedElement = $state<import('$lib/content/types').ElementType | null>(null)
  // Tracks cumulative tier shifts per stat so rerolls can re-apply bonuses
  let statBonusOffsets = $state<Record<string, number>>({})
  // Track which ability labels have been used to enable greyed-out deduplication
  let usedRacialAbilities = $state<Set<string>>(new Set())
  let usedArchetypeAbilities = $state<Set<string>>(new Set())
  // When Beast subType 'Mythical Beast → Mythological Creature' lands, override
  // the effective race for all subsequent racial pool lookups.
  let raceOverride = $state<string | null>(null)
  let showNameScreen = $state(false)
  let characterName = $state('')
  // Wheel viewport-center coords captured at landing time. Passed to the
  // reveal modal so it anchors OVER the wheel (right column on desktop)
  // instead of viewport center.
  let wheelCenterX = $state<number | null>(null)
  let wheelCenterY = $state<number | null>(null)
  // Tracks the index in results[] of the PRIMARY result for the current
  // spin reveal. The reveal panel can't use results.at(-1) because some
  // race/archetype lands push granted powers / weapons as extra result
  // entries after the primary one — at(-1) would surface those instead
  // of the actual race/archetype card. Set when handleSpinComplete pushes
  // the primary result; the reveal uses this index to render the right card.
  let primarySpinResultIndex = $state<number | null>(null)
  // Auto-generated 2-3 sentence "roast" combining race + archetype + best/
  // worst stat + signature power + gimmick. Recomputes when the results
  // list changes; the name is included in the seed so renames re-flavor
  // the synthesis. Same inputs always produce the same text.
  let characterSummary = $derived(
    results.length > 0
      ? generateCharacterSummary(results, characterName || 'this one')
      : null,
  )
  let isRevealed = $state(false)
  let showSettings = $state(false)

  // ── New feature state ─────────────────────────────────────────────────────
  let heightModifiers = $state<Record<string, number>>({})
  // Wildcard state — phase drives the overlay lifecycle
  let wildcardPhase = $state<'idle' | 'flashing' | 'reveal'>('idle')
  let wildcardRevealTimeout: ReturnType<typeof setTimeout> | null = null
  let tutorialWildcardDone = $state(false)
  let wildcardOutcomeType = $state('')
  let wildcardOutcomeLabel = $state('')
  let wildcardOutcomeDesc = $state('')
  let wildcardPendingLabel = $state('')
  let wildcardPendingIndex = $state(0)
  let wildcardPendingCategory = $state('')
  // Non-reactive flag — prevents re-triggering wildcard on the Continue callback
  let skipWildcard = false
  let corruptionScore = $state(0)
  let rivalMode = $state(false)
  let rivalPhase = $state<'p1' | 'p2' | 'battle'>('p1')
  let p1Results = $state<SpinResult[]>([])
  let p1Name = $state('')
  let p1StartedAt = $state('')     // session_started_at for P1 character save
  let p2StartedAt = $state('')     // session_started_at for P2 character save
  let p1ShareId = $state('')       // set if P1 is a pre-saved character (from challenge flow)

  // ── Last completed character — first slot of the rolling 5-character history.
  // Older entries surfaced via the history carousel; this state keeps the
  // existing single-character buttons working without reshuffling templates.
  const LAST_CHAR_KEY = 'wof_last_char'  // legacy — migrated once on load
  let lastCharResults   = $state<SpinResult[] | null>(null)
  let lastCharName      = $state<string | null>(null)
  let lastCharStartedAt = $state<string | null>(null)
  let charHistory       = $state<CharHistoryEntry[]>([])
  let showHistory       = $state(false)
  let viewingHistoryIdx = $state(0)
  let savingHistoryEntry = $state(false)
  let savedToastMessage = $state<string | null>(null)
  // Rivals relay state
  let rivalsOnlineMode    = $state(false)
  let rivalsOnlineWaiting = $state(false)
  let rivalsBotMode       = $state(false)
  // showLastChar removed — the history carousel below replaces it; index 0 of
  // charHistory is the last character. Keeping the legacy variable would orphan
  // dead branches in the menu.

  // ── Tutorial state ────────────────────────────────────────────────────────
  // -1 = inactive (done/skipped), 0 = welcome modal, 1–8 = step cards, 9 = toast
  const TUTORIAL_KEY = 'wof_tutorial_done'
  let tutorialStep = $state(-1)   // initialised to real value in onMount

  // Auto-advance based on the current spin category so the right card shows
  // without the player needing to manually navigate.
  $effect(() => {
    if (tutorialStep <= 0 || tutorialStep >= 15) return
    const cat = currentDef?.category
    if (!cat) return
    const CAT_STEP: Record<string, number> = {
      race: 1,
      raceSubType: 3, raceClass: 3, raceTransformation: 3, racialAbility: 3,
      archetype: 4,
      strength: 5,
      speed: 5, agility: 5, durability: 5,
      iq: 5, charisma: 5, fightingSkill: 5,
      potential: 5, energyLevel: 5, powerMastery: 5, weaponMastery: 5,
      power: 7,
      weapon: 8,
      armor: 9, armorStrength: 9,
      weakness: 10,
      redemptionSpin: 11,
      backstory: 12,
      title: 13,
    }
    const needed = CAT_STEP[cat]
    if (needed !== undefined && tutorialStep < needed) {
      tutorialStep = needed
    }
  })

  // Step 1 → 2: once race result is revealed, bump to show the "Race locked in" card.
  $effect(() => {
    if (tutorialStep === 1 && isRevealed && currentDef?.category === 'race') {
      tutorialStep = 2
    }
  })

  function handleTutorialGotIt(nextStep: number) {
    if (nextStep > 14) {
      tutorialStep = 15   // triggers completion toast
    } else {
      tutorialStep = nextStep
    }
  }

  function handleTutorialSkip() {
    tutorialStep = -1
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(TUTORIAL_KEY, '1')
    }
  }

  // Save a history entry to the server when the user clicks "Save to profile"
  // from the history viewer. POSTs the character payload, then patches the
  // local history entry with the returned shareId so the CTA disappears.
  async function saveHistoryEntry(entry: CharHistoryEntry) {
    if (!auth.loggedIn || savingHistoryEntry || entry.shareId) return
    savingHistoryEntry = true
    try {
      const statScores: Record<string, number> = {}
      for (const r of entry.results) {
        if (r.score !== undefined && r.category) statScores[r.category] = r.score
      }
      const overallScore = computeOverallScore(statScores)
      const overallGrade = scoreTier(overallScore)
      const res = await fetch('/api/characters', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: entry.name?.trim() || 'The Unnamed',
          race: entry.results.find(r => r.category === 'race')?.resultLabel ?? '',
          archetype: entry.results.find(r => r.category === 'archetype')?.resultLabel ?? '',
          overall_score: overallScore,
          overall_tier: overallGrade,
          spins: entry.results,
          session_started_at: entry.startedAt,
          share_in_gallery: false,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        savedToastMessage = res.status === 422
          ? 'Too brief — fate needs at least 90 seconds.'
          : (body as { error?: string }).error ?? 'Save failed.'
      } else {
        const { shareId } = await res.json() as { shareId: string }
        charHistory = markCharSaved(entry.startedAt, shareId)
        try {
          const existing: string[] = JSON.parse(localStorage.getItem('wof_saved_chars') ?? '[]')
          if (!existing.includes(shareId)) {
            localStorage.setItem('wof_saved_chars', JSON.stringify([shareId, ...existing].slice(0, 50)))
          }
        } catch { /* ignore */ }
        savedToastMessage = 'Saved to your profile.'
      }
    } catch {
      savedToastMessage = 'Network error — try again.'
    } finally {
      savingHistoryEntry = false
      setTimeout(() => { savedToastMessage = null }, 3500)
    }
  }

  function handleTutorialStartGame() {
    // Welcome "Let's go!" — start the spin session and advance past the welcome modal
    showMenu = false
    tutorialStep = 1
  }

  function handleTutorialTriggerAction() {
    if (isRevealed) {
      handleNextSpin()
    } else {
      spinTriggerKey++
    }
  }

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
    'powerMastery', 'weaponMastery', 'armorStrength'
  ])

  // ── Wildcard outcome tables ───────────────────────────────────────────────
  const STAT_WILDCARD_OUTCOMES = [
    { type: 'primordial',  weight: 2,  outcomeLabel: 'PRIMORDIAL ASCENSION',  desc: 'This stat transcends all limits. Primordial tier granted.' },
    { type: 'forgotten',   weight: 2,  outcomeLabel: 'FORGOTTEN BY FATE',     desc: 'This stat is erased. F- tier locked in.' },
    { type: 'blessing',    weight: 12, outcomeLabel: "FATE'S BLESSING",       desc: '+3 tiers above your roll. The wheel smiles upon you.' },
    { type: 'curse',       weight: 10, outcomeLabel: "FATE'S CURSE",          desc: '-3 tiers below your roll. The wheel mocks you.' },
    { type: 'reroll',      weight: 14, outcomeLabel: 'CHAOS REROLL',          desc: 'Fate discards this roll and gives you another spin immediately.' },
    { type: 'mirror',      weight: 10, outcomeLabel: 'MIRROR OF GLORY',       desc: 'This stat mirrors your highest result so far.' },
    { type: 'chaos',       weight: 10, outcomeLabel: 'PURE CHAOS',            desc: 'All modifiers ignored. Fate rolls the dice alone.' },
    { type: 'power_gift',  weight: 10, outcomeLabel: 'GIFT OF POWER',         desc: 'Your roll stands — and fate grants you a bonus power spin.' },
    { type: 'c_tier',      weight:  8, outcomeLabel: 'FROZEN MEDIOCRITY',     desc: 'Neither cursed nor blessed. This stat is locked to C tier.' },
    { type: 'double_edge', weight: 10, outcomeLabel: 'DOUBLE-EDGED FATE',     desc: '+4 tiers on this stat — but a new weakness awaits.' },
    { type: 'shared',      weight: 12, outcomeLabel: 'SHARED FATE',           desc: 'This stat bonds to the one before it — matching tier.' },
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
    const curIdx = TIER_ORDER.indexOf(currentSeg.tier as TierGrade)
    if (curIdx < 0) return currentLabel
    const newIdx = Math.max(0, Math.min(TIER_ORDER.length - 1, curIdx + shift))
    return statSegs.find(s => s.tier === TIER_ORDER[newIdx])?.label ?? currentLabel
  }

  // ── Ordered tier grades for tier-shift calculations ──────────────────────
  const TIER_ORDER = TIER_THRESHOLDS.map(t => t.grade)

  // ── Virtual tier index helpers for extended score range ───────────────────
  // Returns the current virtual tier index for a result, accounting for any
  // existing out-of-range displayLabel (e.g. "F- -5" → vti = -5).
  function getVirtualTierIdx(result: SpinResult): number {
    if (result.displayLabel) {
      if (result.displayLabel.startsWith('F- -')) return -parseInt(result.displayLabel.slice(4))
      // Legacy: old characters stored "Primordial+N" display labels before new tiers existed
      if (/^Primordial\+\d/.test(result.displayLabel)) return TIER_ORDER.length - 1 + parseInt(result.displayLabel.slice(11))
      // Extended: "Absolute+N" display labels for N tiers above the max (Absolute+)
      if (/^Absolute\+\d+$/.test(result.displayLabel)) return TIER_ORDER.length - 1 + parseInt(result.displayLabel.slice(9))
    }
    return result.tier ? TIER_ORDER.indexOf(result.tier as TierGrade) : 0
  }

  // Applies a tier shift to a stat result and returns updated fields.
  // Tiers run F- through Absolute+ (score 1–150), plus up to Absolute+20 (score 170) via bonuses.
  // Health/damage stats (NO_NEGATIVE_STATS) are floored at 0 (F-).
  function applyStatShift(result: SpinResult, tierShift: number, statCategory: string): Pick<SpinResult, 'tier' | 'score' | 'displayLabel'> {
    const currentVti = getVirtualTierIdx(result)
    const rawVti = currentVti + tierShift
    const minVti = NO_NEGATIVE_STATS.has(statCategory) ? 0 : -20
    const maxVti = TIER_ORDER.length - 1 + 20  // caps at Absolute+20 (score 170)
    const vti = Math.max(minVti, Math.min(maxVti, rawVti))

    if (vti < 0) {
      return {
        tier: 'F-' as TierGrade,
        score: Math.max(-19, 1 + vti),
        displayLabel: `F- -${Math.abs(vti)}`,
      }
    }
    if (vti >= TIER_ORDER.length) {
      const n = vti - (TIER_ORDER.length - 1)  // 1..20
      return {
        tier: 'Absolute+' as TierGrade,
        score: 150 + n,
        displayLabel: `Absolute+${n}`,
      }
    }
    return {
      tier: TIER_ORDER[vti],
      score: gradeToScore(TIER_ORDER[vti]),
      displayLabel: undefined,
    }
  }

  // ── Stat grants applied when possessionStrength lands ────────────────────
  // Each tier guarantees AT LEAST one stat boost from the possessing race
  // (per Segment 2.5 C.2 spec). Higher % = more bonuses.
  const POSSESSION_GRANTS: Record<string, Record<string, 'statBonus' | 'statPenalty'>> = {
    'Barely a Whisper (5%)':        { charisma: 'statBonus' },
    'A Flicker of Influence (20%)': { charisma: 'statBonus' },
    'Shared Consciousness (40%)':   { charisma: 'statBonus', iq: 'statBonus' },
    'Dominant Presence (60%)':      { strength: 'statBonus', charisma: 'statBonus' },
    'Consuming Takeover (80%)':     { strength: 'statBonus', speed: 'statBonus', charisma: 'statBonus' },
    'Full Possession (100%)':       { strength: 'statBonus', speed: 'statBonus', iq: 'statBonus', durability: 'statBonus' },
  }

  // ── Possession sub-spin map ──────────────────────────────────────────────
  // How many racial abilities + whether to splice a class/transformation
  // spin from the POSSESSING race when this tier lands. The higher the
  // possession %, the more of the possessing race's identity is grafted on.
  const POSSESSION_SPLICE: Record<string, { abilities: number; classSpin: boolean; transformation: boolean }> = {
    'Barely a Whisper (5%)':        { abilities: 0, classSpin: false, transformation: false },
    'A Flicker of Influence (20%)': { abilities: 1, classSpin: false, transformation: false },
    'Shared Consciousness (40%)':   { abilities: 1, classSpin: false, transformation: false },
    'Dominant Presence (60%)':      { abilities: 2, classSpin: true,  transformation: false },
    'Consuming Takeover (80%)':     { abilities: 2, classSpin: true,  transformation: false },
    'Full Possession (100%)':       { abilities: 3, classSpin: true,  transformation: true  },
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
    'Z-':'#0e7490','Z':'#0891b2','Z+':'#06b6d4',
    'ZZ-':'#3730a3','ZZ':'#4f46e5','ZZ+':'#818cf8',
    'ZZZ-':'#9d174d','ZZZ':'#be185d','ZZZ+':'#ec4899',
    'Celestial-':'#075985','Celestial':'#0284c7','Celestial+':'#38bdf8',
    'Godly-':'#c026d3','Godly':'#e879f9',
    'Primordial':'#ffffff',
    'Primordial+':'#ccffff','Absolute-':'#99ffff','Absolute':'#00ffff','Absolute+':'#00ddff',
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
    devilFruitName:     175,
    armorType:           28,
    armor:               32,
    armorStrength:      216,
    armorEnchantment:    55,
    gender:             330,
    corruptionReveal:    40,
    twistSpin:           45,  // fallback only; twistSpin uses twist.hue when set
  }

  // Per-twist hue override (twistSpin uses the registered hue), otherwise
  // fall back to the category default.
  let currentCategoryHue = $derived(
    currentDef?.category === 'twistSpin' && currentDef.twistKind
      ? (twistByKey(currentDef.twistKind)?.hue ?? CATEGORY_HUES.twistSpin ?? 45)
      : CATEGORY_HUES[currentDef?.category ?? ''],
  )
  let reversedResults = $derived([...results].reverse())

  // ── Landing celebration color/intensity resolver ─────────────────────────
  // Shared helper in $lib so Story Mode and the main game resolve celebration
  // colors identically. Maps the landed label + category → element color +
  // grade-based intensity for item spins; stat spins fall through to the
  // wheel's tier-based intensity ladder.
  function resolveLandingColors(_idx: number, label: string) {
    return resolveLandingForCategory(currentDef?.category, label)
  }

  // ── Segment resolver: handles race/archetype ability pools + modifiers ────
  let currentSegments = $derived.by(() => {
    const def = currentDef
    if (!def) return getSegmentsForCategory('race')

    // Hybrid parent race spins — same race wheel, but with Hybrid itself
    // filtered out so we don't recurse (Hybrid → Hybrid → Hybrid → ...).
    if (def.category === 'race' && def.isHybridParent) {
      return getSegmentsForCategory('race').filter(s => s.label !== 'Hybrid')
    }

    // Twist spin — pull segments from the twist registry.
    if (def.category === 'twistSpin' && def.twistKind) {
      const twist = twistByKey(def.twistKind)
      if (twist) return twist.segments
    }

    // Use race-specific ability pool — prefer class or subType abilities when available.
    // If raceOverride is set (Mythological Creature upgrade), use the overridden race's pool.
    if (def.category === 'racialAbility') {
      // Prefer def.forRace (set on slots spliced by a specific race land —
      // critical for Hybrid where two parents each splice their own ability
      // slots and we need each lookup to hit the right parent's pool).
      const raceResult = results.find(r => r.category === 'race')
      const effectiveLabel = def.forRace ?? raceOverride ?? raceResult?.resultLabel
      const race = getRace(effectiveLabel)
      const classResult = results.find(r => r.category === 'raceClass')
      const classItem = race?.classPool?.find(c => c.label === classResult?.resultLabel)
      const subTypeResult = results.find(r => r.category === 'raceSubType')
      const subTypeItem = race?.subTypePool?.find(s => s.label === subTypeResult?.resultLabel)
      const pool = classItem?.abilities ?? subTypeItem?.abilities ?? race?.abilities ?? getSegmentsForCategory('racialAbility')
      return pool.map(seg =>
        usedRacialAbilities.has(seg.label) ? { ...seg, weight: 0, dimmed: true } : seg
      )
    }

    // Use race sub-type pool (always from the original race, not the override)
    if (def.category === 'raceSubType') {
      const raceResult = results.find(r => r.category === 'race')
      const race = getRace(def.forRace ?? raceResult?.resultLabel)
      return race?.subTypePool ?? getSegmentsForCategory('raceSubType')
    }

    // Use race class pool
    if (def.category === 'raceClass') {
      const raceResult = results.find(r => r.category === 'race')
      const race = getRace(def.forRace ?? raceResult?.resultLabel)
      return race?.classPool ?? getSegmentsForCategory('raceClass')
    }

    // Devil Fruit name pool — keyed by the raceClass result label
    if (def.category === 'devilFruitName') {
      const classResult = results.find(r => r.category === 'raceClass')
      const pool = classResult ? DEVIL_FRUIT_POOLS[classResult.resultLabel] : undefined
      return pool ?? getSegmentsForCategory('devilFruitName')
    }

    // Use effective race transformation pool (respects Mythological Creature upgrade)
    if (def.category === 'raceTransformation') {
      const raceResult = results.find(r => r.category === 'race')
      const effectiveLabel = def.forRace ?? raceOverride ?? raceResult?.resultLabel
      const race = getRace(effectiveLabel)
      return race?.transformationPool ?? getSegmentsForCategory('raceTransformation')
    }

    // Category-filtered weapon pool
    if (def.category === 'weapon') {
      const typeResult = results.find(r => r.category === 'weaponType')
      const pool = typeResult ? weaponsByCategory[typeResult.resultLabel] : undefined
      return (pool ?? getSegmentsForCategory('weapon')) as { label: string; weight: number }[]
    }

    // Category-filtered armor pool
    if (def.category === 'armor') {
      const typeResult = results.find(r => r.category === 'armorType')
      const pool = typeResult ? armorsByCategory[typeResult.resultLabel] : undefined
      return (pool ?? getSegmentsForCategory('armor')) as { label: string; weight: number }[]
    }

    // Use archetype-specific ability pool — prefer customAbilityPool, then abilities, then fallback
    if (def.category === 'archetypeAbility') {
      const archetypeResult = results.find(r => r.category === 'archetype')
      const archetype = getArchetype(archetypeResult?.resultLabel)
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
      const race = getRace(raceResult?.resultLabel)
      if (race?.customHeightPool) return race.customHeightPool
    }

    // Use race custom gender pool when available (genderless races, specific-gender races)
    if (def.category === 'gender') {
      const raceResult = results.find(r => r.category === 'race')
      const race = getRace(raceResult?.resultLabel)
      if (race?.customGenderPool) return race.customGenderPool
    }

    // statBonus/statPenalty: use tier-shift segments from spinQueue defaults
    if (def.category === 'statBonus' || def.category === 'statPenalty') {
      return getSegmentsForCategory(def.category)
    }

    // Weapon type: apply race + archetype bias multipliers
    if (def.category === 'weaponType') {
      const raceResult = results.find(r => r.category === 'race')
      const race = getRace(raceResult?.resultLabel)
      const archetypeResult = results.find(r => r.category === 'archetype')
      const archetype = getArchetype(archetypeResult?.resultLabel)
      const baseSegs = getSegmentsForCategory('weaponType')
      if (!race?.weaponTypeBias && !archetype?.weaponTypeBias) return baseSegs
      return baseSegs.map(seg => ({
        ...seg,
        weight: Math.max(0.1, seg.weight
          * (race?.weaponTypeBias?.[seg.label] ?? 1)
          * (archetype?.weaponTypeBias?.[seg.label] ?? 1)),
      }))
    }

    // Armor type: apply race + archetype bias multipliers
    if (def.category === 'armorType') {
      const raceResult = results.find(r => r.category === 'race')
      const race = getRace(raceResult?.resultLabel)
      const archetypeResult = results.find(r => r.category === 'archetype')
      const archetype = getArchetype(archetypeResult?.resultLabel)
      const baseSegs = getSegmentsForCategory('armorType')
      if (!race?.armorTypeBias && !archetype?.armorTypeBias) return baseSegs
      return baseSegs.map(seg => ({
        ...seg,
        weight: Math.max(0.1, seg.weight
          * (race?.armorTypeBias?.[seg.label] ?? 1)
          * (archetype?.armorTypeBias?.[seg.label] ?? 1)),
      }))
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

    // Power category: racial bonus spins use activePowerPool; the global 'power' spin always uses global pool.
    // If a twist locked an element (Bender, Demi-God, Cursed Sorcerer
    // domain, etc.), boost matching-element powers 3x so they win more often.
    if (def.category === 'power') {
      const pool = (def.useRacialPowerPool && activePowerPool.length > 0) ? activePowerPool : baseSegments
      const usedPowerLabels = new Set(results.filter(r => r.category === 'power').map(r => r.resultLabel))
      let segs = pool.filter(s => !usedPowerLabels.has(s.label))
      if (lockedElement) {
        segs = segs.map(s => {
          const el = (s as { element?: string }).element
          return el === lockedElement ? { ...s, weight: s.weight * 3 } : s
        })
      }
      return segs
    }

    // Stat categories: apply tier rarity weights + race stat modifiers + transformation bonus
    if (STAT_CATEGORIES.has(def.category)) {
      const raceResult = results.find(r => r.category === 'race')
      const race = getRace(raceResult?.resultLabel)
      // Global tier modifier: rarer races (low weight) get significantly better stats.
      // weight 3 (Kryptonian) → ~2.1x capped at 2.0, weight 10 → ~1.8x, weight 20 → ~1.4x, weight 38 → ~0.7x (floored)
      const raceWeight = race?.weight ?? 20
      // Steeper curve: rare races (low weight) feel significantly more powerful
      const globalModifier = Math.max(0.3, Math.min(3.2, 3.0 - raceWeight * 0.17))
      // Stat-specific race modifier, falling back to global
      const raceMod = race?.statModifiers?.[def.category] ?? globalModifier
      // Archetype modifier: shapes stat probability on top of race
      const archetypeResult = results.find(r => r.category === 'archetype')
      const archetype = getArchetype(archetypeResult?.resultLabel)
      const archetypeMod = archetype?.statModifiers?.[def.category] ?? 1.0
      // Height modifier — set when height spin resolves, multiplies into stat probability
      const heightMod = heightModifiers[def.category] ?? 1.0
      // Combined modifier capped at 3.5 so even stacked combos stay in range
      const baseModifier = Math.min(3.5, Math.max(0.1, raceMod * archetypeMod * heightMod))
      // Multiply by transformation bonus if the race has one and it has been spun
      let transformationBonus = 1.0
      if (race?.transformationPool) {
        const transResult = results.find(r => r.category === 'raceTransformation')
        if (transResult) {
          const transItem = race.transformationPool.find(t => t.label === transResult.resultLabel)
          transformationBonus = transItem?.statBonus ?? 1.0
        }
      }
      // Cap the total modifier including transformation bonus to prevent Absolute from being trivial
      const modifier = Math.min(3.5, baseModifier * transformationBonus)

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
          const finalWeight = Math.max(0.1, rarityWeight * Math.pow(modifier, score / 40))
          return { ...seg, weight: finalWeight }
        })
    }

    return baseSegments
  })

  // ── onMount: restore session if saved ────────────────────────────────────
  onMount(() => {
    // Migrate the legacy single-character key into the new rolling history
    // array, then surface the most recent entry as "last character".
    migrateLegacyLastChar(LAST_CHAR_KEY)
    charHistory = loadCharHistory()
    if (charHistory.length > 0) {
      const top = charHistory[0]
      lastCharResults = top.results
      lastCharName = top.name
      lastCharStartedAt = top.startedAt
    }

    // Rivals online: relay spins to existing WS from rivals page
    const rivalsParam = new URLSearchParams(window.location.search).get('rivals')
    if (rivalsParam === 'online' && getRivalsWs()) {
      rivalsOnlineMode = true
      showMenu = false
      tutorialStep = -1
      // Replace rivals page's onmessage — we own the WS now; handle battle_start
      const wsData = getRivalsWs()!
      wsData.ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data) as { type: string; [k: string]: unknown }
          if (msg.type === 'battle_start') {
            const you = msg.you as { username?: string; results: unknown[] }
            const opp = msg.opponent as { username?: string; results: unknown[] }
            patchRivalsWs({
              pendingBattle: {
                myResults: you.results,
                opponentResults: opp.results,
                myName: you.username,
                opponentName: opp.username,
              }
            })
            goto('/rivals')
          }
        } catch { /* ignore */ }
      }
      return
    }
    // Rivals offline: start local 2-player mode immediately
    if (rivalsParam === 'offline') {
      handleRematch()
      return
    }
    // Rivals bot: spin normally, then route back to rivals with bot battle
    if (rivalsParam === 'bot' && isOfflineRivalsActive()) {
      rivalsBotMode = true
      showMenu = false
      tutorialStep = -1
      return
    }

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
      // If all spins are done (index == queue length), go straight to the name screen
      if (currentSpinIndex >= spinQueue.length) {
        showNameScreen = true
      }
      // User has a saved session → they've played before, skip tutorial
      tutorialStep = -1
    } else {
      // Fresh game: show tutorial if player hasn't seen it
      tutorialStep = localStorage.getItem(TUTORIAL_KEY) ? -1 : 0
    }
  })

  // ── Race+Archetype synergy combos ─────────────────────────────────────────
  // Each key is "Race|Archetype". pendingBonuses are deferred via pendingStatBonuses;
  // immediateSpins are spliced right after the archetype result.
  const SYNERGY_TABLE: Record<string, {
    announcement: string
    pendingBonuses?: Record<string, 'statBonus' | 'statPenalty'>
    immediateSpins?: SpinDefinition[]
  }> = {
    'Orc|Berserker':       { announcement: 'SYNERGY! Orc Berserker — Blood-Rage: strength + fighting skill bonuses!', pendingBonuses: { strength: 'statBonus', fightingSkill: 'statBonus' } },
    'Orc|Warrior':         { announcement: 'SYNERGY! Orc Warrior — Iron Warchief: durability bonus!', pendingBonuses: { durability: 'statBonus' } },
    'Dwarf|Warrior':       { announcement: 'SYNERGY! Dwarven Stalwart: durability bonus!', pendingBonuses: { durability: 'statBonus' } },
    'Dwarf|Berserker':     { announcement: 'SYNERGY! Dwarf Berserker — Grudge Fueled: strength bonus!', pendingBonuses: { strength: 'statBonus' } },
    'Gnome|Artificer':     { announcement: 'SYNERGY! Gnome Artificer — Experimental Arsenal: bonus weapon enchantment!', immediateSpins: [{ category: 'weaponEnchantment', displayName: 'Synergy: Experimental Enchant' }] },
    'Gnome|Mage':          { announcement: 'SYNERGY! Gnome Mage — Arcane Innovator: IQ bonus + extra power!', pendingBonuses: { iq: 'statBonus' }, immediateSpins: [{ category: 'power', displayName: 'Synergy: Gnome Mage Power' }] },
    'Halfling|Rogue':      { announcement: 'SYNERGY! Halfling Rogue — Small and Slippery: agility + speed bonuses!', pendingBonuses: { agility: 'statBonus', speed: 'statBonus' } },
    'Halfling|Bard':       { announcement: 'SYNERGY! Halfling Bard — Natural Performer: charisma bonus!', pendingBonuses: { charisma: 'statBonus' } },
    'Goblin|Alchemist':    { announcement: 'SYNERGY! Goblin Alchemist — Chaos Chemistry: extra power!', immediateSpins: [{ category: 'power', displayName: 'Synergy: Chaos Power' }] },
    'Goblin|Chaos Gremlin':{ announcement: 'SYNERGY! Goblin Chaos Gremlin — Maximum Chaos: extra power AND an extra weakness!', immediateSpins: [{ category: 'power', displayName: 'Synergy: Chaos Power' }, { category: 'weakness', displayName: 'Synergy: Chaos Weakness' }] },
    'Goblin|Rogue':        { announcement: 'SYNERGY! Goblin Rogue — Sneaky Little Devil: agility bonus!', pendingBonuses: { agility: 'statBonus' } },
    'Half-Orc|Berserker':  { announcement: 'SYNERGY! Half-Orc Berserker — Savage Heritage: strength bonus!', pendingBonuses: { strength: 'statBonus' } },
    'Human|Paladin':       { announcement: 'SYNERGY! Human Paladin — Divine Champion: charisma bonus!', pendingBonuses: { charisma: 'statBonus' } },
    'Half-Elf|Ranger':     { announcement: 'SYNERGY! Half-Elven Ranger — Forest Blood: speed bonus!', pendingBonuses: { speed: 'statBonus' } },
    'Saiyan|Berserker':    { announcement: 'SYNERGY! Saiyan Berserker — Primal Power: strength bonus + extra power!', pendingBonuses: { strength: 'statBonus' }, immediateSpins: [{ category: 'power', displayName: 'Synergy: Saiyan Rage Power' }] },
    'Vampire|Rogue':       { announcement: 'SYNERGY! Vampire Rogue — Shadow Predator: agility bonus + extra racial ability!', pendingBonuses: { agility: 'statBonus' }, immediateSpins: [{ category: 'racialAbility', displayName: 'Synergy: Shadow Predator Ability' }] },
    'Demon|Warlock':       { announcement: 'SYNERGY! Demon Warlock — True Contract: powerMastery bonus + extra power!', pendingBonuses: { powerMastery: 'statBonus' }, immediateSpins: [{ category: 'power', displayName: 'Synergy: True Contract Power' }] },
    'Angel|Paladin':       { announcement: 'SYNERGY! Angel Paladin — Celestial Champion: charisma + potential bonuses!', pendingBonuses: { charisma: 'statBonus', potential: 'statBonus' } },
    'Elf|Ranger':          { announcement: 'SYNERGY! Elven Ranger — Ancient Hunter: speed + agility bonuses!', pendingBonuses: { speed: 'statBonus', agility: 'statBonus' } },
    'Dragon|Berserker':    { announcement: 'SYNERGY! Dragon Berserker — Primal Terror: strength + durability bonuses + extra power!', pendingBonuses: { strength: 'statBonus', durability: 'statBonus' }, immediateSpins: [{ category: 'power', displayName: 'Synergy: Dragon Rage Power' }] },
    'Kryptonian|Superhero':{ announcement: 'SYNERGY! Kryptonian Superhero — Man of Steel: strength + durability bonuses + extra power!', pendingBonuses: { strength: 'statBonus', durability: 'statBonus' }, immediateSpins: [{ category: 'power', displayName: 'Synergy: Man of Steel Power' }] },
    'Tiefling|Warlock':    { announcement: 'SYNERGY! Tiefling Warlock — Infernal Contract: powerMastery bonus + extra power!', pendingBonuses: { powerMastery: 'statBonus' }, immediateSpins: [{ category: 'power', displayName: 'Synergy: Infernal Power' }] },
    'Dragonborn|Warrior':  { announcement: 'SYNERGY! Dragonborn Warrior — Draconic Might: strength bonus!', pendingBonuses: { strength: 'statBonus' } },
    'Werewolf|Berserker':  { announcement: 'SYNERGY! Werewolf Berserker — Full Moon Fury: strength + speed bonuses!', pendingBonuses: { strength: 'statBonus', speed: 'statBonus' } },
    'Undead (Revenant)|Necromancer': { announcement: 'SYNERGY! Revenant Necromancer — Death Made Manifest: extra power + extra weakness (you\'re already dead)!', immediateSpins: [{ category: 'power', displayName: 'Synergy: Death Power' }, { category: 'weakness', displayName: 'Synergy: Death Weakness' }] },
  }

  // ── Dark archetypes/races that raise corruption score ─────────────────────
  const DARK_ARCHETYPES = new Set(['Warlock','Necromancer','Supervillain','Cursed Sorcerer','Possessed','Anti-Hero','Chaos Gremlin'])
  const DARK_RACES = new Set(['Demon','Undead (Revenant)','Vampire','Werewolf','Hollow / Arrancar','Tiefling','Mindflayer','Eldritch Being'])

  // ── handleSpinComplete: strict order — splice, push, save ────────────────
  function handleSpinComplete(resultIndex: number, resultLabel: string) {
    const def = spinQueue[currentSpinIndex]

    // ── Wildcard interrupt ────────────────────────────────────────────────
    if (!skipWildcard) {
      const isStatSpin = STAT_CATEGORIES.has(def.category) && !def.isReroll
      const isItemSpin = def.category === 'weapon' || def.category === 'armor' || def.category === 'power'

      const forceTutorialWildcard = isStatSpin && def.category === 'strength' && tutorialStep > 0 && tutorialStep < 15 && !tutorialWildcardDone
      if (forceTutorialWildcard) tutorialWildcardDone = true
      const hasDoubleLuck = auth.user?.gamepasses.includes('double_luck') ?? false
      if (isStatSpin && (Math.random() < (hasDoubleLuck ? 0.10 : 0.05) || forceTutorialWildcard)) {
        // Stat wildcard: pick outcome from weighted table
        const outcome = forceTutorialWildcard
          ? (STAT_WILDCARD_OUTCOMES.find(o => o.type === 'blessing') ?? pickWeighted(STAT_WILDCARD_OUTCOMES))
          : pickWeighted(STAT_WILDCARD_OUTCOMES)
        const statSegs = getSegmentsForCategory(def.category as SpinCategory) as { label: string; tier?: string; score?: number }[]

        let newLabel = resultLabel
        if (outcome.type === 'primordial') {
          newLabel = statSegs.find(s => s.tier === 'Primordial')?.label ?? resultLabel
        } else if (outcome.type === 'forgotten') {
          newLabel = statSegs.find(s => s.tier === 'F-')?.label ?? resultLabel
        } else if (outcome.type === 'blessing') {
          newLabel = shiftTierLabel(resultLabel, 3, statSegs)
        } else if (outcome.type === 'curse') {
          newLabel = shiftTierLabel(resultLabel, -3, statSegs)
        } else if (outcome.type === 'mirror') {
          const bestStat = [...results].filter(r => STAT_CATEGORIES.has(r.category) && r.score !== undefined)
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]
          if (bestStat?.tier) newLabel = statSegs.find(s => s.tier === bestStat.tier)?.label ?? resultLabel
        } else if (outcome.type === 'chaos') {
          newLabel = statSegs[Math.floor(Math.random() * statSegs.length)]?.label ?? resultLabel
        } else if (outcome.type === 'c_tier') {
          newLabel = statSegs.find(s => s.tier === 'C')?.label ?? resultLabel
        } else if (outcome.type === 'double_edge') {
          newLabel = shiftTierLabel(resultLabel, 4, statSegs)
        } else if (outcome.type === 'shared') {
          const lastStat = [...results].reverse().find(r => STAT_CATEGORIES.has(r.category) && r.tier !== undefined)
          if (lastStat?.tier) newLabel = statSegs.find(s => s.tier === lastStat.tier)?.label ?? resultLabel
        }
        // 'reroll' and 'power_gift' leave newLabel unchanged; effects applied in handleWildcardContinue

        wildcardPendingLabel = newLabel
        wildcardPendingIndex = resultIndex
        wildcardPendingCategory = def.category
        wildcardOutcomeType = outcome.type
        wildcardOutcomeLabel = outcome.outcomeLabel
        wildcardOutcomeDesc = outcome.desc
        wildcardPhase = 'flashing'
        if (wildcardRevealTimeout) clearTimeout(wildcardRevealTimeout)
        wildcardRevealTimeout = setTimeout(() => { wildcardPhase = 'reveal' }, 3000)
        return
      }

      if (isItemSpin && Math.random() < (hasDoubleLuck ? 0.40 : 0.20)) {
        // Item wildcard: bonus extra spin of the same category
        wildcardPendingLabel = resultLabel
        wildcardPendingIndex = resultIndex
        wildcardPendingCategory = def.category
        wildcardOutcomeType = 'itemBonus'
        wildcardOutcomeLabel = 'WILDCARD BONUS'
        wildcardOutcomeDesc = `An extra ${def.displayName.toLowerCase()} spin appears! The wheel rewards your luck.`
        wildcardPhase = 'flashing'
        if (wildcardRevealTimeout) clearTimeout(wildcardRevealTimeout)
        wildcardRevealTimeout = setTimeout(() => { wildcardPhase = 'reveal' }, 3000)
        return
      }
    }
    skipWildcard = false

    // Granted powers collected during category handling; pushed to results after spinResult
    let pendingGrantedPowers: string[] = []
    let pendingGrantedWeapons: string[] = []

    // Step 1: SPLICE queue (must happen before saveSession)
    if (def.category === 'race') {
      // ── Hybrid race twist ────────────────────────────────────────────
      // When the player rolls Hybrid (and this isn't already a hybrid-parent
      // re-spin), skip the standard race extras and splice TWO additional
      // race spins for the two parent bloodlines. Each parent then resolves
      // through this same branch with isHybridParent=true, applying its
      // own extras — so a Hybrid character ends up with the union of both
      // parents' abilities, classes, transformations, weapons, weaknesses.
      if (resultLabel === 'Hybrid' && !def.isHybridParent) {
        spinQueue.splice(currentSpinIndex + 1, 0,
          { category: 'race' as const, displayName: 'Hybrid: First Parent',  isHybridParent: true },
          { category: 'race' as const, displayName: 'Hybrid: Second Parent', isHybridParent: true },
        )
        // skip the rest of the race-extras splice; the parents will provide it.
      } else {
      const race = getRace(resultLabel)
      const count = race?.abilitySpinCount ?? 1
      const extraPowers = race?.extraPowerSpins ?? 0
      const extraWeapons = (race as any)?.extraWeaponSpins ?? 0
      const weaknessCount = race?.weaknessCount ?? deriveWeaknessCount(race?.weaknessProbabilityModifier ?? 1.0)
      const insertSlots: SpinDefinition[] = []
      // forRace is set so downstream sub-spins (subType/class/transformation/
      // racialAbility) know WHICH race spawned them — needed for Hybrid where
      // two parent races each splice their own extras into the same queue.
      const forRace = resultLabel

      // Sub-type spin (e.g., Dragon color, Bender element, Titan type)
      if (race?.subTypePool && race.subTypePool.length > 0) {
        insertSlots.push({ category: 'raceSubType' as const, displayName: `${resultLabel} Type`, forRace })
      }

      // Class/rank spin (e.g., Saiyan class, Mutant power level, Viltrumite rank)
      if (race?.classPool && race.classPool.length > 0) {
        insertSlots.push({ category: 'raceClass' as const, displayName: `${resultLabel} Class`, forRace })
      }

      // Transformation spin (e.g., Saiyan max form, Vampire age, Kryptonian solar level)
      if (race?.transformationPool && race.transformationPool.length > 0) {
        insertSlots.push({ category: 'raceTransformation' as const, displayName: `${resultLabel} Power Level`, forRace })
      }

      // Racial ability slots
      for (let i = 0; i < count; i++) {
        insertSlots.push({ category: 'racialAbility' as const, displayName: `Racial Ability ${count > 1 ? i + 1 : ''}`.trim(), forRace })
      }

      // Bonus power slots — racial, use class-specific power pool if set
      for (let i = 0; i < extraPowers; i++) {
        insertSlots.push({ category: 'power' as const, displayName: `Bonus Power ${extraPowers > 1 ? i + 1 : ''}`.trim(), useRacialPowerPool: true, forRace })
      }

      // Bonus weapon slots — races that have signature weapon types
      for (let i = 0; i < extraWeapons; i++) {
        insertSlots.push({ category: 'weapon' as const, displayName: extraWeapons > 1 ? `Racial Weapon ${i + 1}` : 'Racial Weapon', forRace })
      }

      // Weakness slots immediately after abilities
      for (let i = 0; i < weaknessCount; i++) {
        insertSlots.push({ category: 'weakness' as const, displayName: weaknessCount > 1 ? `Weakness ${i + 1}` : 'Weakness', forRace })
      }

      // Twist sub-wheel splice — for races with a registered twist (God →
      // worshippers, Saiyan → power level, Bender → element, etc.), prepend
      // the twist slot at the front of the extras so it lands BEFORE the
      // racial abilities/weapons that depend on the locked element.
      const raceTwistKey = RACE_TWIST_TRIGGERS[resultLabel]
      if (raceTwistKey) {
        const twist = twistByKey(raceTwistKey)
        if (twist) {
          insertSlots.unshift({
            category: 'twistSpin' as const,
            displayName: `${resultLabel}: ${twist.title}`,
            twistKind: raceTwistKey,
          })
        }
      }

      spinQueue.splice(currentSpinIndex + 1, 0, ...insertSlots)

      // Dark races raise the corruption meter
      if (DARK_RACES.has(resultLabel)) corruptionScore += 3

      const parts: string[] = []
      if (race?.subTypePool?.length) parts.push('type')
      if (race?.classPool?.length) parts.push('class')
      if (race?.transformationPool?.length) parts.push('power level')
      parts.push(`${count} racial ability${count > 1 ? ' slots' : ''}`)
      if (extraPowers > 0) parts.push(`${extraPowers} bonus power${extraPowers > 1 ? 's' : ''}`)
      if (extraWeapons > 0) parts.push(`${extraWeapons} racial weapon${extraWeapons > 1 ? 's' : ''}`)
      if (weaknessCount > 0) parts.push(`${weaknessCount} weakness${weaknessCount > 1 ? 'es' : ''}`)
      showAnnouncement = `${resultLabel}: spin for ${parts.join(', ')}!`
      }   // end Hybrid-vs-normal branch
    } else if (def.category === 'raceSubType') {
      const raceResult = results.find(r => r.category === 'race')
      const race = getRace(def.forRace ?? raceResult?.resultLabel)
      const subTypeItem = race?.subTypePool?.find(s => s.label === resultLabel)
      if (subTypeItem?.statBonusGrants) {
        for (const [stat, bonusType] of Object.entries(subTypeItem.statBonusGrants)) {
          pendingStatBonuses[stat] = [...(pendingStatBonuses[stat] ?? []), bonusType]
        }
      }
      if (subTypeItem?.powerPool?.length) {
        activePowerPool = subTypeItem.powerPool
      }
      if (subTypeItem?.grantedPowers?.length) {
        pendingGrantedPowers = subTypeItem.grantedPowers
        showAnnouncement = `${resultLabel}: grants ${pendingGrantedPowers.length} power${pendingGrantedPowers.length > 1 ? 's' : ''}!`
      }
      // Mythical Beast upgrade: swap effective race to Mythological Creature
      if (resultLabel.startsWith('Mythical Beast →')) {
        raceOverride = 'Mythological Creature'
        const msg = 'Race upgraded to Mythological Creature!'
        showAnnouncement = showAnnouncement ? showAnnouncement + ' ' + msg : msg
      }
    } else if (def.category === 'raceClass') {
      const raceResult = results.find(r => r.category === 'race')
      const race = getRace(def.forRace ?? raceResult?.resultLabel)
      const classItem = race?.classPool?.find(c => c.label === resultLabel)
      if (classItem?.statBonusGrants) {
        for (const [stat, bonusType] of Object.entries(classItem.statBonusGrants)) {
          pendingStatBonuses[stat] = [...(pendingStatBonuses[stat] ?? []), bonusType]
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
      // Splice devil fruit name spin for Devil Fruit User
      if (raceResult?.resultLabel === 'Devil Fruit User' && DEVIL_FRUIT_POOLS[resultLabel]) {
        spinQueue.splice(currentSpinIndex + 1, 0, {
          category: 'devilFruitName' as const,
          displayName: 'Devil Fruit Name',
        })
        const msg = `Spin your specific fruit!`
        showAnnouncement = showAnnouncement ? showAnnouncement + ' ' + msg : msg
      }
    } else if (def.category === 'raceTransformation') {
      const raceResult = results.find(r => r.category === 'race')
      const race = getRace(def.forRace ?? raceResult?.resultLabel)
      const transItem = race?.transformationPool?.find(t => t.label === resultLabel)
      if (transItem?.statBonusGrants) {
        for (const [stat, bonusType] of Object.entries(transItem.statBonusGrants)) {
          pendingStatBonuses[stat] = [...(pendingStatBonuses[stat] ?? []), bonusType]
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
    } else if (def.category === 'height') {
      // Apply stat modifiers to future stat spins based on height range
      const match = resultLabel.match(/^(\d+)'(\d+)"/)
      if (match) {
        const inches = parseInt(match[1]) * 12 + parseInt(match[2])
        if (inches <= 55) {        // ≤ 4'7" — very short
          heightModifiers = { agility: 1.35, speed: 1.25, strength: 0.70, durability: 0.90 }
          showAnnouncement = 'Very short stature — agility and speed boosted, strength and durability reduced.'
        } else if (inches <= 63) { // ≤ 5'3" — short
          heightModifiers = { agility: 1.15, speed: 1.12, strength: 0.90 }
        } else if (inches >= 84) { // ≥ 7'0" — very tall
          heightModifiers = { strength: 1.45, durability: 1.30, speed: 0.70, agility: 0.80 }
          showAnnouncement = 'Towering height — strength and durability surged, speed and agility reduced.'
        } else if (inches >= 76) { // ≥ 6'4" — tall
          heightModifiers = { strength: 1.20, durability: 1.12, speed: 0.90, agility: 0.95 }
        }
        // Normal range (5'4"–6'3") — no modifiers
      }
    } else if (def.category === 'twistSpin' && def.twistKind) {
      // Resolve the twist effect — applies stat bonuses and optionally
      // locks an element for downstream power spins. The twist itself
      // doesn't splice further spins; effects are folded into pending
      // grants and lockedElement that influence later resolution.
      const twist = twistByKey(def.twistKind)
      const eff = twist?.effects[resultLabel]
      if (eff?.statBonusGrants) {
        for (const [stat, bonusType] of Object.entries(eff.statBonusGrants)) {
          pendingStatBonuses[stat] = [...(pendingStatBonuses[stat] ?? []), bonusType]
        }
      }
      if (eff?.lockElement) {
        // Tag the activePowerPool source so race/bonus power spins prefer
        // the locked element. Stored as a tag-only marker — actual filtering
        // happens in the racialAbility / power segment derivations.
        lockedElement = eff.lockElement
      }
      const grantedCount = eff?.statBonusGrants ? Object.keys(eff.statBonusGrants).length : 0
      const parts: string[] = []
      if (grantedCount > 0) parts.push(`${grantedCount} stat modifier${grantedCount > 1 ? 's' : ''}`)
      if (eff?.lockElement) parts.push(`${eff.lockElement} element bias`)
      showAnnouncement = parts.length > 0
        ? `${resultLabel}: ${parts.join(' + ')}.`
        : `${resultLabel}: ${eff?.flavor ?? 'fate has spoken.'}`
    } else if (def.category === 'weakness') {
      corruptionScore += 1
    } else if (def.category === 'racialAbility') {
      usedRacialAbilities = new Set([...usedRacialAbilities, resultLabel])
    } else if (def.category === 'archetypeAbility') {
      usedArchetypeAbilities = new Set([...usedArchetypeAbilities, resultLabel])
    } else if (def.category === 'possessionRace') {
      // Just record who's possessing — no ability/weakness splicing unlike a real race land
      showAnnouncement = `Possessed by ${resultLabel}!`
    } else if (def.category === 'possessionStrength') {
      const grants = POSSESSION_GRANTS[resultLabel] ?? {}
      const grantKeys = Object.keys(grants)
      for (const [stat, bonusType] of Object.entries(grants)) {
        pendingStatBonuses[stat] = [...(pendingStatBonuses[stat] ?? []), bonusType]
      }

      // ── Splice race-derived sub-spins from the POSSESSING race ─────────
      // Higher possession % grafts more of the possessing race's identity
      // onto the character. Each spliced slot carries forRace=possessing
      // race so its segment lookups hit the right pool (the player's own
      // race is unaffected).
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
        if (slots.length > 0) spinQueue.splice(currentSpinIndex + 1, 0, ...slots)
      }

      const parts: string[] = []
      if (grantKeys.length > 0) parts.push(`${grantKeys.length} stat modifier${grantKeys.length > 1 ? 's' : ''}`)
      if (splice.abilities > 0) parts.push(`${splice.abilities} ${possessingRaceLabel} trait${splice.abilities > 1 ? 's' : ''}`)
      if (splice.classSpin) parts.push(`${possessingRaceLabel} aspect`)
      if (splice.transformation) parts.push(`${possessingRaceLabel} awakening`)
      showAnnouncement = parts.length > 0
        ? `${resultLabel} — grants ${parts.join(', ')}!`
        : `${resultLabel} — the possession barely stirs within you.`
    } else if (def.category === 'archetype') {
      const archetype = getArchetype(resultLabel)
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
          pendingStatBonuses[stat] = [...(pendingStatBonuses[stat] ?? []), bonusType as 'statBonus' | 'statPenalty']
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

      // Archetype twist splice (Time Traveler → era, Chaos Gremlin → chaos
      // roll, Cursed Sorcerer → domain, etc.). Prepended so it lands before
      // the archetype's ability spins, allowing the twist to lock element
      // before downstream powers are rolled.
      const arcTwistKey = ARCHETYPE_TWIST_TRIGGERS[resultLabel]
      if (arcTwistKey) {
        const twist = twistByKey(arcTwistKey)
        if (twist) {
          insertSlots.unshift({
            category: 'twistSpin' as const,
            displayName: `${resultLabel}: ${twist.title}`,
            twistKind: arcTwistKey,
          })
        }
      }

      // Granted powers — injected directly without a spin
      if (archetype?.grantedPowers?.length) {
        pendingGrantedPowers = archetype.grantedPowers
      }

      // Granted weapons — injected directly as weapon results (no spin required)
      if (archetype?.grantedWeapons?.length) {
        pendingGrantedWeapons = archetype.grantedWeapons
      }

      spinQueue.splice(currentSpinIndex + 1, 0, ...insertSlots)

      // Build announcement
      const parts: string[] = []
      if (count > 0) parts.push(`${count} ${abilityLabel.toLowerCase()} spin${count > 1 ? 's' : ''}`)
      if (extraPowers > 0) parts.push(`${extraPowers} bonus power${extraPowers > 1 ? 's' : ''}`)
      if (extraWeapons > 0) parts.push(`${extraWeapons} bonus weapon${extraWeapons > 1 ? 's' : ''}`)
      if (archetype?.bonusSpins?.length) parts.push(`${archetype.bonusSpins.length} special spin${archetype.bonusSpins.length > 1 ? 's' : ''}`)
      if (archetype?.grantedPowers?.length) parts.push(`${archetype.grantedPowers.length} granted power${archetype.grantedPowers.length > 1 ? 's' : ''}`)
      if (archetype?.grantedWeapons?.length) parts.push(`${archetype.grantedWeapons.length} signature weapon${archetype.grantedWeapons.length > 1 ? 's' : ''}`)
      if (archetype?.statBonusGrants) {
        const n = Object.keys(archetype.statBonusGrants).length
        parts.push(`${n} stat modifier${n > 1 ? 's' : ''}`)
      }
      showAnnouncement = parts.length > 0 ? `${resultLabel}: ${parts.join(', ')}!` : `${resultLabel} archetype selected!`

      // Dark archetypes raise the corruption meter
      if (DARK_ARCHETYPES.has(resultLabel)) {
        corruptionScore += resultLabel === 'Possessed' ? 4 : 3
      }

      // Synergy combo check — race + archetype pair
      const raceForSynergy = results.find(r => r.category === 'race')?.resultLabel ?? ''
      const synergyKey = `${raceForSynergy}|${resultLabel}`
      const synergy = SYNERGY_TABLE[synergyKey]
      if (synergy) {
        // Deferred stat bonuses — fire right after the relevant stat spin
        if (synergy.pendingBonuses) {
          for (const [stat, bonusType] of Object.entries(synergy.pendingBonuses)) {
            pendingStatBonuses[stat] = [...(pendingStatBonuses[stat] ?? []), bonusType]
          }
        }
        // Immediate spins — splice right after archetype (before ability slots)
        if (synergy.immediateSpins) {
          spinQueue.splice(currentSpinIndex + 1, 0, ...(synergy.immediateSpins as SpinDefinition[]))
        }
        showAnnouncement = synergy.announcement
      }
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
            pendingStatBonuses[stat] = [...(pendingStatBonuses[stat] ?? []), bonusType as 'statBonus' | 'statPenalty']
            deferredCount++
          }
        }
        if (immediateSlots.length > 0) spinQueue.splice(currentSpinIndex + 1, 0, ...immediateSlots)
        const totalCount = immediateSlots.length + deferredCount
        showAnnouncement = `${resultLabel}: ${totalCount} stat modifier spin${totalCount > 1 ? 's' : ''} granted!`
      }
      // Splice corruption reveal spin at end of game if threshold met
      if (def.category === 'title' && corruptionScore >= 8) {
        spinQueue.splice(currentSpinIndex + 1, 0, {
          category: 'corruptionReveal' as const,
          displayName: 'Corruption Awakens',
        })
        const msg = `⚠️ CORRUPTION SCORE ${corruptionScore} — your darkness takes form...`
        showAnnouncement = showAnnouncement ? `${showAnnouncement} | ${msg}` : msg
      }
    } else if (def.category === 'weaponType') {
      if (resultLabel === 'Cursed') corruptionScore += 2
      // When weapon type is None, skip weapon + weaponMastery by removing them from
      // the queue and pushing synthetic results — no point spinning a single-segment wheel.
      if (resultLabel === 'None') {
        const weaponIdx   = spinQueue.findIndex((s, i) => i > currentSpinIndex && s.category === 'weapon')
        const masteryIdx  = spinQueue.findIndex((s, i) => i > currentSpinIndex && s.category === 'weaponMastery')
        if (masteryIdx !== -1) spinQueue.splice(masteryIdx, 1)
        if (weaponIdx  !== -1) spinQueue.splice(weaponIdx, 1)
        results.push({ step: results.length + 1, category: 'weapon',        resultLabel: 'No Weapon', resultIndex: 0, timestamp: new Date().toISOString() })
        results.push({ step: results.length + 1, category: 'weaponMastery', resultLabel: 'Unarmed',   resultIndex: 0, timestamp: new Date().toISOString() })
        showAnnouncement = 'No weapon chosen — fists it is.'
      }
    } else if (def.category === 'armorType') {
      if (resultLabel === 'Cursed') corruptionScore += 2
      // When armor type is None, skip armor + armorStrength spins — mirrors weaponType: None
      if (resultLabel === 'None') {
        const armorIdx    = spinQueue.findIndex((s, i) => i > currentSpinIndex && s.category === 'armor')
        const strengthIdx = spinQueue.findIndex((s, i) => i > currentSpinIndex && s.category === 'armorStrength')
        if (strengthIdx !== -1) spinQueue.splice(strengthIdx, 1)
        if (armorIdx    !== -1) spinQueue.splice(armorIdx, 1)
        results.push({ step: results.length + 1, category: 'armor',        resultLabel: 'No Armor',   resultIndex: 0, timestamp: new Date().toISOString() })
        results.push({ step: results.length + 1, category: 'armorStrength', resultLabel: 'Unarmored', resultIndex: 0, timestamp: new Date().toISOString() })
        showAnnouncement = 'No armor — speed over protection.'
      }
    } else if (def.category === 'weaponMastery') {
      // Use direct typed import — avoids WeightedSegment cast issues with filtered wheels
      const fl = weaponMasteryLabels.find(s => s.label === resultLabel)
      const tierIdx = fl != null ? TIER_ORDER.indexOf(fl.tier) : -1
      const bMinusIdx  = TIER_ORDER.indexOf('B-' as TierGrade)
      const ssMinusIdx = TIER_ORDER.indexOf('SS-' as TierGrade)
      const zzMinusIdx = TIER_ORDER.indexOf('ZZ-' as TierGrade)
      // Determine enchants per weapon based on tier
      let enchantsPerWeapon = 0
      if (tierIdx >= bMinusIdx)  enchantsPerWeapon = 1
      if (tierIdx >= ssMinusIdx) enchantsPerWeapon = 2
      if (tierIdx >= zzMinusIdx) enchantsPerWeapon = 3
      // Count all real weapons (bonus + main); Unarmed doesn't qualify
      const weaponResults = results.filter(r => r.category === 'weapon' && r.resultLabel !== 'No Weapon (Unarmed)' && r.resultLabel !== 'No Weapon')
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
    } else if (def.category === 'armorStrength') {
      const fl = armorStrengthLabels.find(s => s.label === resultLabel)
      const tierIdx    = fl != null ? TIER_ORDER.indexOf(fl.tier) : -1
      const bMinusIdx  = TIER_ORDER.indexOf('B-' as TierGrade)
      const ssMinusIdx = TIER_ORDER.indexOf('SS-' as TierGrade)
      const zzMinusIdx = TIER_ORDER.indexOf('ZZ-' as TierGrade)
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
          const armorName = ar.resultLabel.length > 18 ? ar.resultLabel.slice(0, 16) + '…' : ar.resultLabel
          for (let e = 0; e < enchantsPerArmor; e++) {
            slots.push({
              category: 'armorEnchantment' as const,
              displayName: totalArmorEnchants > 1 ? `Armor Enchant ${n++} — ${armorName}` : 'Armor Enchantment',
            })
          }
        }
        spinQueue.splice(currentSpinIndex + 1, 0, ...slots)
        showAnnouncement = `Armor strength ${fl?.tier} — ${totalArmorEnchants} enchantment${totalArmorEnchants > 1 ? 's' : ''} unlocked!`
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
      // Apply tier shift to the target stat result — supports extended range via applyStatShift
      const tierShift = parseInt(resultLabel) // "+5" → 5, "-3" → -3
      if (def.targetStat) {
        let targetIdx = -1
        for (let i = results.length - 1; i >= 0; i--) {
          if (results[i].category === def.targetStat) { targetIdx = i; break }
        }
        if (targetIdx !== -1 && results[targetIdx].tier) {
          const { tier: newGrade, score: newScore, displayLabel: newDisplayLabel } =
            applyStatShift(results[targetIdx], tierShift, def.targetStat)
          // For in-range shifts, look up the matching flavor label so description stays accurate
          const statSegs = getSegmentsForCategory(def.targetStat as SpinCategory)
          const newLabel = newDisplayLabel
            ? results[targetIdx].resultLabel  // out-of-range: keep existing label
            : (statSegs as { label?: string; tier?: string }[]).find(s => s.tier === newGrade)?.label
              ?? results[targetIdx].resultLabel
          results[targetIdx] = { ...results[targetIdx], tier: newGrade, score: newScore, resultLabel: newLabel, displayLabel: newDisplayLabel }
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
            const { tier: ng, score: ns, displayLabel: ndl } = applyStatShift(results[idx], 1, cat)
            const statSegs = getSegmentsForCategory(cat as SpinCategory)
            const newLbl = ndl ? results[idx].resultLabel : (statSegs as { label?: string; tier?: string }[]).find(s => s.tier === ng)?.label ?? results[idx].resultLabel
            results[idx] = { ...results[idx], tier: ng, score: ns, resultLabel: newLbl, displayLabel: ndl }
            statBonusOffsets[cat] = (statBonusOffsets[cat] ?? 0) + 1
          }
        }
        showAnnouncement = 'Every stat bumped up one tier!'
      } else if (resultLabel === 'Demigod Status (Unofficial)') {
        for (const cat of STAT_CATS) {
          const idx = results.findIndex(r => r.category === cat)
          if (idx !== -1 && results[idx].tier) {
            const { tier: ng, score: ns, displayLabel: ndl } = applyStatShift(results[idx], 3, cat)
            const statSegs = getSegmentsForCategory(cat as SpinCategory)
            const newLbl = ndl ? results[idx].resultLabel : (statSegs as { label?: string; tier?: string }[]).find(s => s.tier === ng)?.label ?? results[idx].resultLabel
            results[idx] = { ...results[idx], tier: ng, score: ns, resultLabel: newLbl, displayLabel: ndl }
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
          const statSegs = getSegmentsForCategory('potential') as unknown as { label: string; tier: TierGrade; score: number }[]
          const topSeg = [...statSegs].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]
          if (topSeg) results[potIdx] = { ...results[potIdx], tier: topSeg.tier, score: topSeg.score, resultLabel: topSeg.label }
        }
        showAnnouncement = 'Potential raised to God Tier!'
      } else if (resultLabel === 'Free God Tier Strength') {
        const strIdx = results.findIndex(r => r.category === 'strength')
        if (strIdx !== -1) {
          const statSegs = getSegmentsForCategory('strength') as unknown as { label: string; tier: TierGrade; score: number }[]
          const topSeg = [...statSegs].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]
          if (topSeg) results[strIdx] = { ...results[strIdx], tier: topSeg.tier, score: topSeg.score, resultLabel: topSeg.label }
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
      } else if (resultLabel === 'Plot Armour (Permanent)') {
        // Durability +4 tiers — narrative invincibility made mechanical
        const durIdx = results.findIndex(r => r.category === 'durability')
        if (durIdx !== -1 && results[durIdx].tier) {
          const curIdx = TIER_ORDER.indexOf(results[durIdx].tier as TierGrade)
          const newIdx = Math.min(TIER_ORDER.length - 1, curIdx + 4)
          const newGrade = TIER_ORDER[newIdx]
          const statSegs = getSegmentsForCategory('durability')
          const newLbl = (statSegs as { label?: string; tier?: string }[]).find(s => s.tier === newGrade)?.label ?? results[durIdx].resultLabel
          results[durIdx] = { ...results[durIdx], tier: newGrade, score: gradeToScore(newGrade), resultLabel: newLbl }
          statBonusOffsets['durability'] = (statBonusOffsets['durability'] ?? 0) + 4
        }
        showAnnouncement = 'Plot Armour activated — durability +4 tiers! You cannot die at a dramatically inconvenient time.'
      } else if (resultLabel === 'Your Weakness Becomes a Strength (Somehow)') {
        // Remove last weakness, spin an archetype ability to replace it
        const weakIdx = results.map((r, i) => ({ r, i })).reverse().find(({ r }) => r.category === 'weakness')?.i ?? -1
        if (weakIdx !== -1) results.splice(weakIdx, 1)
        spinQueue.splice(currentSpinIndex + 1, 0, { category: 'archetypeAbility' as const, displayName: 'Strength Born from Weakness' })
        showAnnouncement = 'Weakness twisted into strength — one weakness removed, gain an archetype ability!'
      } else if (resultLabel === 'Immunity to Your Own Weaknesses') {
        // Remove every weakness result
        const weakIndices: number[] = []
        results.forEach((r, i) => { if (r.category === 'weakness') weakIndices.push(i) })
        for (let i = weakIndices.length - 1; i >= 0; i--) results.splice(weakIndices[i], 1)
        showAnnouncement = `All ${weakIndices.length} weakness${weakIndices.length !== 1 ? 'es' : ''} erased — you are immune to your own flaws!`
      } else if (resultLabel === 'Swap Race Abilities (Narrator Chooses)') {
        // Clear existing racial abilities and reroll the same number of slots
        const racialAbilityResults = results.filter(r => r.category === 'racialAbility')
        const count = Math.max(1, racialAbilityResults.length)
        const raIndices: number[] = []
        results.forEach((r, i) => { if (r.category === 'racialAbility') raIndices.push(i) })
        for (let i = raIndices.length - 1; i >= 0; i--) results.splice(raIndices[i], 1)
        usedRacialAbilities = new Set()
        for (let i = 0; i < count; i++) {
          spinQueue.splice(currentSpinIndex + 1 + i, 0, { category: 'racialAbility' as const, displayName: count > 1 ? `New Racial Ability ${i + 1}` : 'New Racial Ability' })
        }
        showAnnouncement = `Racial abilities replaced — rerolling ${count} ability slot${count > 1 ? 's' : ''}!`
      } else if (resultLabel === 'Stat of Your Choice: S Tier') {
        // Fate picks for you: worst stat gets raised to S tier
        const worstStat = STAT_CATS.reduce((worst, cat) => {
          const r = results.find(r => r.category === cat)
          const worstR = results.find(r => r.category === worst)
          if (!r) return worst
          if (!worstR) return cat
          return (r.score ?? 0) < (worstR.score ?? 0) ? cat : worst
        }, STAT_CATS[0])
        const targetIdx = results.findIndex(r => r.category === worstStat)
        if (targetIdx !== -1) {
          const statSegs = getSegmentsForCategory(worstStat as SpinCategory)
          const sLbl = (statSegs as { label?: string; tier?: string }[]).find(s => s.tier === 'S')?.label ?? 'S Tier'
          results[targetIdx] = { ...results[targetIdx], tier: 'S', score: gradeToScore('S'), resultLabel: sLbl }
          statBonusOffsets[worstStat] = (statBonusOffsets[worstStat] ?? 0) + 10
        }
        const statName = worstStat.replace(/([A-Z])/g, ' $1').trim()
        showAnnouncement = `Fate chose your worst stat — ${statName} raised to S Tier!`
      } else if (resultLabel === 'Retroactive Legendary Race Upgrade') {
        // Unlock an extra racial ability + a power from the racial pool
        spinQueue.splice(currentSpinIndex + 1, 0, { category: 'racialAbility' as const, displayName: 'Legendary Racial Ability' })
        spinQueue.splice(currentSpinIndex + 2, 0, { category: 'power' as const, displayName: 'Legendary Race Power', useRacialPowerPool: true })
        showAnnouncement = 'Legendary Race Upgrade — gain a racial ability and a power from your race pool!'
      } else if (resultLabel === 'The Universe Owes You One') {
        // Best stat +2 tiers + a bonus power
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
          const newIdx = Math.min(TIER_ORDER.length - 1, curIdx + 2)
          const newGrade = TIER_ORDER[newIdx]
          const statSegs = getSegmentsForCategory(bestStat as SpinCategory)
          const newLbl = (statSegs as { label?: string; tier?: string }[]).find(s => s.tier === newGrade)?.label ?? results[bestIdx].resultLabel
          results[bestIdx] = { ...results[bestIdx], tier: newGrade, score: gradeToScore(newGrade), resultLabel: newLbl }
          statBonusOffsets[bestStat] = (statBonusOffsets[bestStat] ?? 0) + 2
        }
        spinQueue.splice(currentSpinIndex + 1, 0, { category: 'power' as const, displayName: 'Universal Debt Power' })
        showAnnouncement = 'The universe pays its debt — best stat +2 tiers and a bonus power spin!'
      } else if (resultLabel === 'The DM Sighs and Gives You One Thing You Want') {
        // All stats +2 tiers + a bonus power — reluctantly generous
        for (const cat of STAT_CATS) {
          const idx = results.findIndex(r => r.category === cat)
          if (idx !== -1 && results[idx].tier) {
            const curIdx = TIER_ORDER.indexOf(results[idx].tier as TierGrade)
            const newIdx = Math.min(TIER_ORDER.length - 1, curIdx + 2)
            const newGrade = TIER_ORDER[newIdx]
            const statSegs = getSegmentsForCategory(cat as SpinCategory)
            const newLbl = (statSegs as { label?: string; tier?: string }[]).find(s => s.tier === newGrade)?.label ?? results[idx].resultLabel
            results[idx] = { ...results[idx], tier: newGrade, score: gradeToScore(newGrade), resultLabel: newLbl }
            statBonusOffsets[cat] = (statBonusOffsets[cat] ?? 0) + 2
          }
        }
        spinQueue.splice(currentSpinIndex + 1, 0, { category: 'power' as const, displayName: "DM's Reluctant Gift" })
        showAnnouncement = '...Fine. All stats +2 tiers and one bonus power. Happy now?'
      } else {
        showAnnouncement = `${resultLabel} — fate is strange.`
      }
    } else if (def.category === 'corruptionReveal') {
      const CORRUPTION_STAT_CATS = ['strength','speed','agility','durability','iq','charisma','fightingSkill','potential','energyLevel','powerMastery','weaponMastery']
      const shiftStat = (cat: string, tiers: number) => {
        const idx = results.findIndex(r => r.category === cat)
        if (idx !== -1 && results[idx].tier) {
          const curIdx = TIER_ORDER.indexOf(results[idx].tier as TierGrade)
          const newIdx = Math.min(TIER_ORDER.length - 1, Math.max(0, curIdx + tiers))
          const newGrade = TIER_ORDER[newIdx]
          const statSegs = getSegmentsForCategory(cat as SpinCategory)
          const newLbl = (statSegs as { label?: string; tier?: string }[]).find(s => s.tier === newGrade)?.label ?? results[idx].resultLabel
          results[idx] = { ...results[idx], tier: newGrade, score: gradeToScore(newGrade), resultLabel: newLbl }
          statBonusOffsets[cat] = (statBonusOffsets[cat] ?? 0) + tiers
        }
      }
      if (resultLabel === 'Lich Ascension') {
        shiftStat('durability', 3); shiftStat('iq', 3)
        const weakIndices: number[] = []; results.forEach((r, i) => { if (r.category === 'weakness') weakIndices.push(i) }); for (let i = weakIndices.length - 1; i >= 0; i--) results.splice(weakIndices[i], 1)
        spinQueue.splice(currentSpinIndex + 1, 0, { category: 'power' as const, displayName: 'Lich Power' })
        showAnnouncement = 'LICH ASCENSION! Durability + IQ +3 tiers, all weaknesses purged, bonus power!'
      } else if (resultLabel === 'Half-Demon Emergence') {
        shiftStat('strength', 2); shiftStat('powerMastery', 2)
        spinQueue.splice(currentSpinIndex + 1, 0, { category: 'power' as const, displayName: 'Demon Power' })
        showAnnouncement = 'HALF-DEMON EMERGENCE! Strength + PowerMastery +2 tiers, bonus demon power!'
      } else if (resultLabel === 'Void-Touched') {
        shiftStat('agility', 3); shiftStat('speed', 3)
        spinQueue.splice(currentSpinIndex + 1, 0, { category: 'weakness' as const, displayName: 'Void Corruption Weakness' })
        showAnnouncement = 'VOID-TOUCHED! Agility + Speed +3 tiers — but the void claims a price (extra weakness).'
      } else if (resultLabel === 'Cursed Champion') {
        for (const cat of CORRUPTION_STAT_CATS) shiftStat(cat, 1)
        spinQueue.splice(currentSpinIndex + 1, 0, { category: 'weakness' as const, displayName: 'Champion Curse 1' }, { category: 'weakness' as const, displayName: 'Champion Curse 2' })
        showAnnouncement = 'CURSED CHAMPION! All stats +1 tier — at the cost of 2 extra weaknesses.'
      } else if (resultLabel === 'Dark God Candidate') {
        for (const cat of CORRUPTION_STAT_CATS) shiftStat(cat, 2)
        spinQueue.splice(currentSpinIndex + 1, 0, { category: 'power' as const, displayName: 'Dark God Power 1' }, { category: 'power' as const, displayName: 'Dark God Power 2' }, { category: 'weakness' as const, displayName: 'Dark God Curse 1' }, { category: 'weakness' as const, displayName: 'Dark God Curse 2' })
        showAnnouncement = 'DARK GOD CANDIDATE! All stats +2 tiers, 2 bonus powers, 2 extra weaknesses — the price of divinity.'
      } else if (resultLabel === 'Shadow Soul') {
        shiftStat('agility', 2); shiftStat('speed', 2); shiftStat('fightingSkill', 2)
        showAnnouncement = 'SHADOW SOUL! Agility, Speed, and Fighting Skill all +2 tiers!'
      } else if (resultLabel === 'Undying Revenant') {
        shiftStat('durability', 3)
        spinQueue.splice(currentSpinIndex + 1, 0, { category: 'racialAbility' as const, displayName: 'Revenant Ability 1' }, { category: 'racialAbility' as const, displayName: 'Revenant Ability 2' })
        showAnnouncement = 'UNDYING REVENANT! Durability +3 tiers, 2 bonus racial abilities!'
      } else if (resultLabel === 'Infernal Pact Sealed') {
        shiftStat('powerMastery', 3)
        spinQueue.splice(currentSpinIndex + 1, 0, { category: 'power' as const, displayName: 'Infernal Power' })
        showAnnouncement = 'INFERNAL PACT SEALED! PowerMastery +3 tiers, bonus infernal power!'
      } else if (resultLabel === 'Corruption: Consumed') {
        // Chaos — all stats reroll (same as Reroll Everything)
        for (const cat of CORRUPTION_STAT_CATS) { const idx = results.findIndex(r => r.category === cat); if (idx !== -1) results.splice(idx, 1) }
        spinQueue.splice(currentSpinIndex + 1, 0, ...CORRUPTION_STAT_CATS.map(cat => ({ category: cat as SpinCategory, displayName: `Consumed: ${cat.replace(/([A-Z])/g, ' $1').trim().replace(/^\w/, c => c.toUpperCase())}`, isReroll: true })))
        showAnnouncement = 'CORRUPTION: CONSUMED! The darkness devours your identity — all stats rerolled in chaos!'
      } else {
        showAnnouncement = `${resultLabel} — the corruption manifests.`
      }
    }

    // Step 2a: For stat categories, splice ALL pending bonus/penalty spins (stacking support)
    if (STAT_CATEGORIES.has(def.category) && pendingStatBonuses[def.category]?.length) {
      const bonusQueue = pendingStatBonuses[def.category]
      const bonusSlots = bonusQueue.map((bonusType, i) => ({
        category: bonusType as 'statBonus' | 'statPenalty',
        displayName: bonusQueue.length > 1
          ? `${def.displayName} ${bonusType === 'statBonus' ? 'Bonus' : 'Penalty'} ${i + 1}`
          : `${def.displayName} ${bonusType === 'statBonus' ? 'Bonus' : 'Penalty'}`,
        targetStat: def.category,
      }))
      spinQueue.splice(currentSpinIndex + 1, 0, ...bonusSlots)
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
    // Capture the primary result index BEFORE any extras (granted powers,
    // granted weapons) get pushed below — the reveal panel reads from this
    // so it shows the right card even when grantedPowers spawn extra rows.
    primarySpinResultIndex = results.length - 1

    // Relay spin to rivals partner when in online rivals mode
    if (rivalsOnlineMode) {
      const wsData = getRivalsWs()
      if (wsData?.ws && wsData.ws.readyState === WebSocket.OPEN) {
        wsData.ws.send(JSON.stringify({ type: 'spin_result', spinIndex: currentSpinIndex, result: $state.snapshot(spinResult) }))
      }
    }

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

    // Inject archetype granted weapons directly (no spin required)
    for (const weaponLabel of pendingGrantedWeapons) {
      results.push({
        step: results.length + 1,
        category: 'weapon',
        resultLabel: weaponLabel,
        resultIndex: -1,
        timestamp: new Date().toISOString(),
      })
    }

    // Step 3: SAVE with $state.snapshot (prevents Proxy serialization issues)
    // Save currentSpinIndex + 1 so that a reload after a spin lands always resumes at
    // the NEXT spin, not the just-completed one (prevents re-spinning for better results).
    try {
      saveSession({
        ...currentSession,
        completedSpins: $state.snapshot(results),
        spinQueue: $state.snapshot(spinQueue),
        currentSpinIndex: currentSpinIndex + 1,
        pendingStatBonuses: $state.snapshot(pendingStatBonuses),
      } as SessionState)
    } catch (e) {
      console.error('Failed to save session to localStorage:', e)
    }

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

  // ── handleWildcardContinue: apply wildcard outcome and resume the spin ─────
  function handleWildcardContinue() {
    const cat = wildcardPendingCategory
    const idx = wildcardPendingIndex
    const lbl = wildcardPendingLabel
    const otype = wildcardOutcomeType
    if (wildcardRevealTimeout) { clearTimeout(wildcardRevealTimeout); wildcardRevealTimeout = null }
    wildcardPhase = 'idle'
    skipWildcard = true

    // Apply outcome-specific bonus splices before calling handleSpinComplete
    if (otype === 'reroll') {
      const def = spinQueue[currentSpinIndex]
      spinQueue.splice(currentSpinIndex + 1, 0, {
        category: def.category as SpinCategory,
        displayName: `${def.displayName} (Reroll)`,
        isReroll: true,
      })
    } else if (otype === 'power_gift') {
      spinQueue.splice(currentSpinIndex + 1, 0, {
        category: 'power' as const,
        displayName: 'Wildcard Bonus Power',
      })
    } else if (otype === 'double_edge') {
      spinQueue.splice(currentSpinIndex + 1, 0, {
        category: 'weakness' as const,
        displayName: 'Wildcard Weakness',
      })
    } else if (otype === 'itemBonus') {
      spinQueue.splice(currentSpinIndex + 1, 0, {
        category: cat as SpinCategory,
        displayName: `Bonus ${spinQueue[currentSpinIndex]?.displayName ?? cat}`,
      })
    }

    // After tutorial wildcard on strength resolves, advance to wildcard explanation card
    if (tutorialWildcardDone && cat === 'strength' && tutorialStep >= 1 && tutorialStep < 15) {
      tutorialStep = Math.max(tutorialStep, 6)
    }

    handleSpinComplete(idx, lbl)
  }

  // ── handleResume: dismiss prompt, restore pendingStatBonuses ─────────────
  function handleResume() {
    showResumePrompt = false
    isRevealed = false
    if (currentSession.pendingStatBonuses) {
      // Migrate old scalar format (string) to new array format
      const raw = currentSession.pendingStatBonuses as Record<string, unknown>
      pendingStatBonuses = Object.fromEntries(
        Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v : [v]])
      ) as Record<string, Array<'statBonus' | 'statPenalty'>>
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
    // Clear saved last character — a new spin is beginning
    try { localStorage.removeItem(LAST_CHAR_KEY) } catch { /* ignore */ }
    lastCharResults = null
    lastCharName = null
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
    heightModifiers = {}
    if (wildcardRevealTimeout) { clearTimeout(wildcardRevealTimeout); wildcardRevealTimeout = null }
    wildcardPhase = 'idle'
    corruptionScore = 0
    raceOverride = null
    rivalMode = false
    rivalPhase = 'p1'
    p1Results = []
    p1Name = ''
    p1StartedAt = ''
    p2StartedAt = ''
    p1ShareId = ''
  }

  // ── handleBackToMenu: return to main menu without starting a new session ─
  function handleBackToMenu() {
    showMenu = true
    showCard = false
    showNameScreen = false
    rivalMode = false
    rivalPhase = 'p1'
    p1Results = []
    p1Name = ''
    p1StartedAt = ''
    p2StartedAt = ''
    p1ShareId = ''
  }

  // React to bottom-nav Home button when already on this route
  let _lastMenuSignal = menuSignal.count
  $effect(() => {
    if (menuSignal.count > _lastMenuSignal) {
      _lastMenuSignal = menuSignal.count
      handleBackToMenu()
    }
  })

  // ── handleRematch: restart rivals mode from scratch ───────────────────────
  function handleRematch() {
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
    heightModifiers = {}
    if (wildcardRevealTimeout) { clearTimeout(wildcardRevealTimeout); wildcardRevealTimeout = null }
    wildcardPhase = 'idle'
    corruptionScore = 0
    raceOverride = null
    rivalMode = true
    rivalPhase = 'p1'
    showMenu = false
    tutorialStep = -1
    p1Results = []
    p1Name = ''
    p1StartedAt = new Date().toISOString()
    p2StartedAt = ''
    p1ShareId = ''
  }

  // ── handleChallengeWinner: winner stays as P1, spin fresh P2 ─────────────
  function handleChallengeWinner(winnerResults: SpinResult[], winnerName: string, winnerShareId: string) {
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
    pendingStatBonuses = {}
    usedRacialAbilities = new Set()
    usedArchetypeAbilities = new Set()
    activePowerPool = []
    statBonusOffsets = {}
    heightModifiers = {}
    if (wildcardRevealTimeout) { clearTimeout(wildcardRevealTimeout); wildcardRevealTimeout = null }
    wildcardPhase = 'idle'
    corruptionScore = 0
    raceOverride = null
    // Pre-load winner as P1; P2 spins fresh
    rivalMode = true
    rivalPhase = 'p2'
    p1Results = winnerResults
    p1Name = winnerName
    p1StartedAt = ''           // winner already saved — don't re-POST
    p1ShareId = winnerShareId  // only PATCH their wins if they win again
    p2StartedAt = new Date().toISOString()
  }

  // ── handleNewCharacter: return to menu with fully reset state ────────────
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
    heightModifiers = {}
    if (wildcardRevealTimeout) { clearTimeout(wildcardRevealTimeout); wildcardRevealTimeout = null }
    wildcardPhase = 'idle'
    corruptionScore = 0
    raceOverride = null
    rivalMode = false
    rivalPhase = 'p1'
    p1Results = []
    p1Name = ''
    p1StartedAt = ''
    p2StartedAt = ''
    p1ShareId = ''
    // Return to menu so user sees a clean start, not a potentially stale wheel
    showMenu = true
  }

  function handleNameSubmit() {
    if (rivalMode && rivalPhase === 'p1') {
      // Save P1's character, reset all spin state for P2
      p1Results = $state.snapshot(results) as SpinResult[]
      p1Name = characterName
      spinQueue = buildInitialQueue()
      currentSpinIndex = 0
      results = []
      showAnnouncement = null
      showNameScreen = false
      characterName = ''
      isRevealed = false
      pendingStatBonuses = {}
      usedRacialAbilities = new Set()
      usedArchetypeAbilities = new Set()
      activePowerPool = []
      statBonusOffsets = {}
      heightModifiers = {}
      if (wildcardRevealTimeout) { clearTimeout(wildcardRevealTimeout); wildcardRevealTimeout = null }
    wildcardPhase = 'idle'
      corruptionScore = 0
      raceOverride = null
      p2StartedAt = new Date().toISOString()
      rivalPhase = 'p2'
    } else if (rivalMode && rivalPhase === 'p2') {
      clearSession()
      rivalPhase = 'battle'
      showNameScreen = false
    } else if (rivalsBotMode) {
      // Bot rivals: store results then navigate back to rivals for the battle
      const snapshot = $state.snapshot(results) as SpinResult[]
      setOfflineRivalsResult(snapshot, characterName)
      clearSession()
      showNameScreen = false
      rivalsBotMode = false
      goto('/rivals?bot_done=1')
    } else if (rivalsOnlineMode) {
      // Online rivals: send results + character name, wait for battle_start
      const wsData = getRivalsWs()
      if (wsData?.ws && wsData.ws.readyState === WebSocket.OPEN) {
        wsData.ws.send(JSON.stringify({
          type: 'spins_complete',
          results: $state.snapshot(results),
          name: characterName,
        }))
      }
      clearSession()
      showNameScreen = false
      rivalsOnlineWaiting = true
    } else {
      // Save to local spin history before clearing
      appendSpinHistory($state.snapshot(results) as SpinResult[], characterName, currentSession.sessionId)
      // Advance tutorial to the post-reveal "what to do next" card
      if (tutorialStep >= 0) {
        tutorialStep = 14
      }
      // Persist into rolling 5-character history; surface the new entry as
      // "last character" for the existing menu button.
      const snapshot = $state.snapshot(results) as SpinResult[]
      try {
        charHistory = pushCharHistory({ results: snapshot, name: characterName, startedAt: currentSession.startedAt })
        lastCharResults = snapshot
        lastCharName = characterName
        lastCharStartedAt = currentSession.startedAt
      } catch { /* ignore */ }
      clearSession()
      showNameScreen = false
      showCard = true
    }
  }
</script>

<!-- Tutorial overlay — shown on first ever play, skipped for rivals mode and resume sessions -->
{#if tutorialStep >= 0 && !rivalMode}
  <Tutorial
    step={tutorialStep}
    currentCategory={currentDef?.category}
    isRevealed={isRevealed}
    onGotIt={handleTutorialGotIt}
    onSkip={handleTutorialSkip}
    onStartGame={handleTutorialStartGame}
    onTriggerAction={handleTutorialTriggerAction}
  />
{/if}

<!-- Landing page — shown on first visit before the main menu -->
{#if showLanding}
  <div class="fixed inset-0 z-[60] flex flex-col items-center justify-center px-6 overflow-y-auto"
    style="background: #07070d;">
    <!-- Top glow -->
    <div class="absolute top-0 inset-x-0 h-64 pointer-events-none"
      style="background: radial-gradient(ellipse 70% 50% at 50% 0%, rgba(240,192,64,0.09), transparent);"></div>
    <!-- Bottom glow -->
    <div class="absolute bottom-0 inset-x-0 h-48 pointer-events-none"
      style="background: radial-gradient(ellipse 60% 40% at 50% 100%, rgba(157,23,77,0.07), transparent);"></div>

    <div class="relative z-10 w-full max-w-sm flex flex-col items-center gap-6 py-12">
      <!-- Logo -->
      <div class="flex flex-col items-center gap-3">
        <div class="relative flex items-center justify-center" style="width: 96px; height: 96px;">
          <div class="absolute inset-0 rounded-full" style="border: 1px solid rgba(240,192,64,0.12); transform: scale(1.3);"></div>
          <div class="absolute inset-0 rounded-full" style="border: 1px solid rgba(240,192,64,0.22); transform: scale(1.15);"></div>
          <div class="obsidian-slab rounded-full w-full h-full flex items-center justify-center relative overflow-hidden"
            style="border: 1px solid rgba(240,192,64,0.32); box-shadow: 0 0 40px rgba(240,192,64,0.15);">
            <div class="noise-overlay"></div>
            <span class="material-symbols-outlined relative z-10"
              style="font-size: 46px; color: #f0c040; font-variation-settings: 'FILL' 1; filter: drop-shadow(0 0 16px rgba(240,192,64,0.7));">casino</span>
          </div>
        </div>
        <div class="text-center">
          <h1 style="font-family: 'Cinzel', serif; font-size: clamp(1.8rem, 8vw, 2.6rem); font-weight: 900; color: #f0c040; letter-spacing: 0.18em; line-height: 1.1; text-shadow: 0 0 24px rgba(240,192,64,0.4);">WHEEL OF FATE</h1>
          <p class="mt-1.5 text-xs tracking-[0.22em] uppercase" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Spin your destiny. Accept the consequences.</p>
        </div>
      </div>

      <!-- Divider -->
      <div class="flex items-center gap-3 w-full">
        <div class="flex-1 h-px" style="background: linear-gradient(90deg, transparent, rgba(240,192,64,0.3));"></div>
        <span style="color: #f0c040; font-size: 10px; opacity: 0.6;">✦</span>
        <div class="flex-1 h-px" style="background: linear-gradient(90deg, rgba(240,192,64,0.3), transparent);"></div>
      </div>

      <!-- Description -->
      <div class="w-full obsidian-slab rounded-xl p-5 relative overflow-hidden"
        style="border: 1px solid rgba(240,192,64,0.12);">
        <div class="noise-overlay"></div>
        <div class="relative z-10 flex flex-col gap-3">
          <p class="text-sm leading-relaxed" style="font-family: 'JetBrains Mono', monospace; color: #9a907b; line-height: 1.75;">
            A character creation engine driven entirely by chance.
          </p>
          <div class="flex flex-col gap-2">
            {#each [
              { icon: 'casino', text: 'Spin 23+ sequential wheels — race, powers, stats, weapons, weaknesses' },
              { icon: 'bolt', text: '5% Wildcard chance on every stat spin — blessing, curse, or chaos' },
              { icon: 'swords', text: 'Battle your characters in Rivals Mode or build a full roster in Story Mode' },
              { icon: 'link', text: 'Share your character card with anyone — no account needed' },
            ] as feature}
              <div class="flex items-start gap-2.5">
                <span class="material-symbols-outlined shrink-0 mt-0.5"
                  style="font-size: 14px; color: #f0c040; font-variation-settings: 'FILL' 1;">{feature.icon}</span>
                <p class="text-xs leading-relaxed" style="font-family: 'JetBrains Mono', monospace; color: #6b6070; line-height: 1.65;">{feature.text}</p>
              </div>
            {/each}
          </div>
        </div>
      </div>

      <!-- CTAs -->
      <div class="flex flex-col gap-3 w-full">
        <button
          onclick={() => {
            showLanding = false
            try { localStorage.setItem(LANDING_KEY, '1') } catch { /* ignore */ }
          }}
          class="metal-stamp-gold w-full py-3.5 rounded-xl relative"
          style="font-family: 'Cinzel', serif; font-size: 0.88rem; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase;"
        >
          <div class="l-bracket" style="color: rgba(255,255,255,0.28);"></div>
          Play Now
        </button>
        <a
          href="/login"
          onclick={() => { try { localStorage.setItem(LANDING_KEY, '1') } catch { /* ignore */ } }}
          class="w-full py-3 rounded-xl text-center text-sm font-bold transition-all"
          style="font-family: 'Cinzel', serif; letter-spacing: 0.14em; text-transform: uppercase; background: rgba(255,255,255,0.03); border: 1px solid rgba(240,192,64,0.18); color: #9a907b; text-decoration: none;"
        >
          Login / Create Account
        </a>
      </div>

      <!-- Footer note -->
      <p class="text-center text-xs" style="font-family: 'JetBrains Mono', monospace; color: #2e2a40; letter-spacing: 0.08em;">
        No account required to spin. Login to save progress across devices.
      </p>
    </div>
  </div>
{/if}

<main class="min-h-screen" style="background: #07070d; color: #e4e1ee;">

  <!-- Fixed top nav -->
  <nav class="fixed top-0 inset-x-0 z-50 flex items-center px-4 h-14"
    style="background: rgba(7,7,13,0.94); border-bottom: 1px solid rgba(240,192,64,0.13); backdrop-filter: blur(16px);"
  >
    <!-- Left slot: home button -->
    <div class="flex items-center" style="min-width: 80px;">
      {#if !showMenu && !showCard && !showNameScreen}
        <button
          onclick={handleBackToMenu}
          class="flex items-center gap-1 transition-all active:scale-95"
          style="background: none; border: none; cursor: pointer; color: #9a907b; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.08em; padding: 4px 6px; border-radius: 6px;"
          aria-label="Main menu"
        >
          <span class="material-symbols-outlined" style="font-size: 15px;">home</span>
        </button>
      {/if}
    </div>

    <!-- Center: logo -->
    <div class="flex-1 flex items-center justify-center gap-2">
      <span class="material-symbols-outlined" style="color: #f0c040; font-size: 18px; font-variation-settings: 'FILL' 1;">casino</span>
      <span style="font-family: 'Cinzel', serif; font-size: 13px; font-weight: 700; color: #ffdf96; letter-spacing: 0.18em;">WHEEL OF FATE</span>
    </div>

    <!-- Right slot: spin counter -->
    <div class="flex items-center justify-end gap-3" style="min-width: 80px;">
      {#if !showMenu}
        <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #9a907b; letter-spacing: 0.05em;">{spinCounterText}</span>
      {/if}
    </div>
  </nav>

  <!-- Spin progress bar — pinned below nav, matches the Story Mode bar so both
       game modes feel parallel. Hidden on menu since there's no active session. -->
  {#if !showMenu && spinQueue.length > 0}
    <div class="fixed inset-x-0 z-40 pointer-events-none" style="top: 56px;">
      <div class="h-[3px] mx-auto max-w-[640px] rounded-full overflow-hidden" style="background: rgba(255,255,255,0.04);">
        <div style="height: 100%; width: {Math.round((currentSpinIndex / spinQueue.length) * 100)}%; background: linear-gradient(90deg, #c0882a, #f0c040); box-shadow: 0 0 6px rgba(240,192,64,0.5); transition: width 0.4s cubic-bezier(0.22, 0.8, 0.3, 1);"></div>
      </div>
    </div>
  {/if}

  {#if showSettings}
    <SettingsPanel onClose={() => showSettings = false} />
  {/if}

  <!-- Main Menu — fixed overlay so game content beneath can't be scrolled to -->
  {#if showMenu}
    <div class="fixed inset-0 z-30 flex flex-col items-center justify-center px-5 overflow-y-auto" style="background: #07070d;">
      <!-- Decorative top glow -->
      <div class="absolute top-0 inset-x-0 h-48 pointer-events-none" style="background: radial-gradient(ellipse 60% 40% at 50% 0%, rgba(240,192,64,0.07), transparent);"></div>

      <!-- Logo mark -->
      <div class="mb-4 flex flex-col items-center gap-3">
        <div class="relative flex items-center justify-center" style="width: 84px; height: 84px;">
          <div class="absolute inset-0 rounded-full" style="border: 1px solid rgba(240,192,64,0.15); transform: scale(1.28);"></div>
          <div class="absolute inset-0 rounded-full" style="border: 1px solid rgba(240,192,64,0.25); transform: scale(1.14);"></div>
          <div class="obsidian-slab rounded-full w-full h-full flex items-center justify-center relative overflow-hidden" style="border: 1px solid rgba(240,192,64,0.3);">
            <div class="noise-overlay"></div>
            <span class="material-symbols-outlined relative z-10" style="font-size: 40px; color: #f0c040; font-variation-settings: 'FILL' 1; filter: drop-shadow(0 0 12px rgba(240,192,64,0.6));">casino</span>
          </div>
        </div>
        <div class="text-center">
          <h1 style="font-family: 'Cinzel', serif; font-size: clamp(1.5rem, 6vw, 2.2rem); font-weight: 900; color: #f0c040; letter-spacing: 0.18em; line-height: 1.1; text-shadow: 2px 2px 0 rgba(0,0,0,0.8), 0 0 16px rgba(240,192,64,0.4);">WHEEL OF FATE</h1>
          <p class="mt-1.5 text-xs tracking-[0.22em] uppercase" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Spin your destiny. Accept the consequences.</p>
        </div>
      </div>

      <!-- Divider -->
      <div class="flex items-center gap-3 mb-5" style="width: min(260px, 80vw);">
        <div class="flex-1 h-px" style="background: linear-gradient(90deg, transparent, rgba(240,192,64,0.35));"></div>
        <span style="color: #f0c040; font-size: 11px; opacity: 0.7;">✦</span>
        <div class="flex-1 h-px" style="background: linear-gradient(90deg, rgba(240,192,64,0.35), transparent);"></div>
      </div>

      <!-- Buttons -->
      <div class="flex flex-col gap-2.5 w-full max-w-[260px]">
        <!-- Spin Your Fate + recent characters (one button, paginates through last 5) -->
        <div class="flex items-center gap-2">
          <button
            onclick={() => { showMenu = false; if (tutorialStep === 0) tutorialStep = 1 }}
            data-fx="big"
            class="metal-stamp-gold flex-1 py-3 rounded-lg relative"
            style="font-family: 'Cinzel', serif; font-size: 0.78rem; letter-spacing: 0.2em; text-transform: uppercase; font-weight: 700;"
          >
            <div class="l-bracket" style="color: rgba(255,255,255,0.3);"></div>
            Spin Your Fate
          </button>
          <button
            onclick={() => { if (charHistory.length > 0) { viewingHistoryIdx = 0; showHistory = true; showMenu = false } }}
            class="flex items-center justify-center rounded-lg shrink-0 transition-all relative"
            style="width: 44px; height: 44px; background: rgba(167,139,250,{charHistory.length > 0 ? '0.10' : '0.02'}); border: 1px solid rgba(167,139,250,{charHistory.length > 0 ? '0.32' : '0.08'}); color: {charHistory.length > 0 ? '#a78bfa' : '#2a3a4a'}; cursor: {charHistory.length > 0 ? 'pointer' : 'default'}; opacity: {charHistory.length > 0 ? '1' : '0.35'};"
            title={charHistory.length > 0 ? `Recent characters (${charHistory.length})` : 'Spin a character to start your history'}
            aria-label="Recent characters"
          >
            <span class="material-symbols-outlined" style="font-size: 20px; font-variation-settings: 'FILL' 1;">groups</span>
            {#if charHistory.length > 0}
              <span style="position: absolute; top: -4px; right: -4px; background: #a78bfa; color: #1e0a3c; font-family: 'JetBrains Mono', monospace; font-size: 9px; font-weight: 700; min-width: 14px; height: 14px; border-radius: 7px; display: flex; align-items: center; justify-content: center; padding: 0 3px;">{charHistory.length}</span>
            {/if}
          </button>
        </div>

        <!-- Rivals Mode -->
        <button
          onclick={() => { showMenu = false; goto('/rivals') }}
          class="metal-stamp-crimson w-full py-3 rounded-lg relative"
          style="font-family: 'Cinzel', serif; font-size: 0.78rem; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 700; color: #ffdad6;"
        >
          <div class="l-bracket" style="color: rgba(255,180,171,0.35);"></div>
          ⚔ Rivals Mode
        </button>

        <!-- Story Mode -->
        <a href="/story" style="text-decoration: none;">
          <div class="metal-stamp-green w-full py-3 rounded-lg relative text-center cursor-pointer"
            style="font-family: 'Cinzel', serif; font-size: 0.78rem; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 700; color: #052e16;">
            <div class="l-bracket" style="color: rgba(110,231,183,0.35);"></div>
            📖 Story Mode
          </div>
        </a>

        <!-- Two-col row: Gallery + Characters -->
        <div class="flex gap-2">
          <a href="/characters" style="text-decoration: none; flex: 1;">
            <div class="metal-stamp-slate w-full py-3 rounded-lg relative text-center cursor-pointer"
              style="font-family: 'Cinzel', serif; font-size: 0.72rem; letter-spacing: 0.15em; text-transform: uppercase; font-weight: 700; color: #e4e1ee;">
              <div class="l-bracket" style="color: rgba(200,192,220,0.25);"></div>
              Characters
            </div>
          </a>
          <a href="/gallery" style="text-decoration: none; flex: 1;">
            <div class="metal-stamp-purple w-full py-3 rounded-lg relative text-center cursor-pointer"
              style="font-family: 'Cinzel', serif; font-size: 0.72rem; letter-spacing: 0.15em; text-transform: uppercase; font-weight: 700; color: #1e0a3c;">
              <div class="l-bracket" style="color: rgba(167,139,250,0.35);"></div>
              Gallery
            </div>
          </a>
        </div>

        <!-- Two-col row: Arcane Shop + Challenges -->
        <div class="flex gap-2">
          <a href="/shop" style="text-decoration: none; flex: 1;">
            <div class="metal-stamp-gold w-full py-3 rounded-lg relative text-center cursor-pointer"
              style="font-family: 'Cinzel', serif; font-size: 0.72rem; letter-spacing: 0.13em; text-transform: uppercase; font-weight: 700; color: #1a0e00;">
              <div class="l-bracket" style="color: rgba(255,255,255,0.25);"></div>
              ◆ Shop
            </div>
          </a>
          <a href="/challenges" style="text-decoration: none; flex: 1;">
            <div class="metal-stamp-teal w-full py-3 rounded-lg relative text-center cursor-pointer"
              style="font-family: 'Cinzel', serif; font-size: 0.72rem; letter-spacing: 0.13em; text-transform: uppercase; font-weight: 700; color: #042f2e;">
              <div class="l-bracket" style="color: rgba(72,200,224,0.3);"></div>
              Challenges
            </div>
          </a>
        </div>

        <!-- Clan + Achievements + Replays row -->
        <div class="flex gap-2">
          <a href="/clan" style="text-decoration: none; flex: 1;">
            <div class="metal-stamp-amber w-full py-3 rounded-lg relative text-center cursor-pointer"
              style="font-family: 'Cinzel', serif; font-size: 0.68rem; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 700; color: #1c0a00;">
              ⚑ Clan
            </div>
          </a>
          <a href="/achievements" style="text-decoration: none; flex: 1;">
            <div class="metal-stamp-gold w-full py-3 rounded-lg relative text-center cursor-pointer"
              style="font-family: 'Cinzel', serif; font-size: 0.68rem; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 700; color: #1a0e00;">
              ★ Badges
            </div>
          </a>
          <a href="/replays" style="text-decoration: none; flex: 1;">
            <div class="metal-stamp-purple w-full py-3 rounded-lg relative text-center cursor-pointer"
              style="font-family: 'Cinzel', serif; font-size: 0.68rem; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 700; color: #1e0a3c;">
              ↻ Replays
            </div>
          </a>
        </div>
      </div>

      <!-- Bottom flavour -->
      <p class="mt-6 text-xs tracking-[0.15em] uppercase" style="font-family: 'JetBrains Mono', monospace; color: #4e4635;">23 spins. One fate. No take-backs.</p>
    </div>
  {/if}

  <!-- Character history carousel — paginates through last 5 locally-completed runs.
       Replaces the previous separate "Last character" overlay since the carousel
       at index 0 IS the last character. The card itself surfaces a "Save to
       profile" CTA when the entry has no shareId yet. -->
  {#if showHistory && charHistory.length > 0}
    {@const cur = charHistory[Math.min(viewingHistoryIdx, charHistory.length - 1)]}
    <div class="flex justify-center pt-20 pb-24 px-4">
      <div class="w-full max-w-xl flex flex-col gap-4">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <p class="text-xs tracking-[0.2em] uppercase" style="font-family: 'JetBrains Mono', monospace; color: #a78bfa;">
            Character History {viewingHistoryIdx + 1}/{charHistory.length}
            {#if cur.shareId}
              <span style="color: #34d399;">· Saved</span>
            {:else}
              <span style="color: #9a907b;">· Unsaved</span>
            {/if}
          </p>
          <div class="flex gap-1.5 items-center">
            <button
              onclick={() => { viewingHistoryIdx = Math.max(0, viewingHistoryIdx - 1) }}
              disabled={viewingHistoryIdx === 0}
              class="text-xs px-2.5 py-1.5 rounded transition-all active:scale-95 disabled:opacity-30"
              style="color: #a78bfa; border: 1px solid rgba(167,139,250,0.3); background: none; font-family: 'JetBrains Mono', monospace; cursor: pointer;"
              aria-label="Previous"
            >‹</button>
            <button
              onclick={() => { viewingHistoryIdx = Math.min(charHistory.length - 1, viewingHistoryIdx + 1) }}
              disabled={viewingHistoryIdx >= charHistory.length - 1}
              class="text-xs px-2.5 py-1.5 rounded transition-all active:scale-95 disabled:opacity-30"
              style="color: #a78bfa; border: 1px solid rgba(167,139,250,0.3); background: none; font-family: 'JetBrains Mono', monospace; cursor: pointer;"
              aria-label="Next"
            >›</button>
            <button
              onclick={() => { showHistory = false; showMenu = true }}
              class="text-xs px-3 py-1.5 rounded transition-all active:scale-95 ml-2"
              style="color: #9a907b; border: 1px solid #4e4635; background: none; font-family: 'JetBrains Mono', monospace; cursor: pointer;"
            >← Back</button>
          </div>
        </div>

        <!-- Save CTA — only for entries the server hasn't seen yet and only on
             the most recent entry (older ones are >24h old and rejected by the
             session-too-short guard server-side). -->
        {#if !cur.shareId && viewingHistoryIdx === 0 && auth.loggedIn}
          <div class="rounded-xl px-4 py-3 flex items-center gap-3" style="background: linear-gradient(135deg, rgba(240,192,64,0.10), rgba(240,192,64,0.03)); border: 1px solid rgba(240,192,64,0.32);">
            <span class="material-symbols-outlined" style="font-size: 22px; color: #f0c040; font-variation-settings: 'FILL' 1;">cloud_upload</span>
            <div class="flex-1 min-w-0">
              <p class="text-xs" style="font-family: 'Cinzel', serif; color: #ffdf96; font-weight: 700;">This character hasn't been saved yet</p>
              <p class="text-xs mt-0.5" style="color: #9a907b;">Save it to your profile so it survives a local-storage wipe.</p>
            </div>
            <button
              onclick={() => saveHistoryEntry(cur)}
              disabled={savingHistoryEntry}
              data-fx="big"
              class="metal-stamp-gold px-3 py-2 rounded-lg text-xs font-bold relative disabled:opacity-50"
              style="font-family: 'Cinzel', serif; letter-spacing: 0.1em; text-transform: uppercase;"
            >
              {savingHistoryEntry ? 'Saving...' : 'Save'}
            </button>
          </div>
        {:else if !cur.shareId && viewingHistoryIdx === 0 && !auth.loggedIn}
          <div class="rounded-xl px-4 py-3 flex items-center gap-3" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);">
            <span class="material-symbols-outlined" style="font-size: 20px; color: #9a907b;">info</span>
            <p class="text-xs flex-1" style="color: #9a907b;"><a href="/login" style="color: #f0c040; text-decoration: underline;">Log in</a> to save this character to your profile.</p>
          </div>
        {/if}
        {#if savedToastMessage}
          <div class="rounded-xl px-4 py-2.5 text-center" style="background: rgba(52,211,153,0.08); border: 1px solid rgba(52,211,153,0.3);">
            <p class="text-xs" style="color: #34d399;">{savedToastMessage}</p>
          </div>
        {/if}

        <CharacterCard
          results={cur.results}
          name={cur.name}
          startedAt={cur.startedAt}
          readonly={true}
          onNewCharacter={() => { showHistory = false; showMenu = true }}
          onBackToMenu={() => { showHistory = false; showMenu = true }}
        />
      </div>
    </div>
  {/if}

  <!-- Resume prompt (modal overlay) -->
  {#if showResumePrompt}
    <div class="fixed inset-0 z-40 flex items-center justify-center px-4"
      style="background: rgba(7,7,13,0.9); backdrop-filter: blur(12px);"
    >
      <div class="obsidian-slab w-full max-w-sm rounded-xl p-7 text-center relative overflow-hidden"
        style="border: 1px solid rgba(240,192,64,0.3); box-shadow: 0 0 60px rgba(0,0,0,0.9), 0 0 40px rgba(240,192,64,0.06);"
      >
        <div class="noise-overlay"></div>
        <div class="absolute top-3 left-3 w-7 h-7" style="border-top: 2px solid rgba(240,192,64,0.4); border-left: 2px solid rgba(240,192,64,0.4);"></div>
        <div class="absolute top-3 right-3 w-7 h-7" style="border-top: 2px solid rgba(240,192,64,0.4); border-right: 2px solid rgba(240,192,64,0.4);"></div>
        <div class="absolute bottom-3 left-3 w-7 h-7" style="border-bottom: 2px solid rgba(240,192,64,0.4); border-left: 2px solid rgba(240,192,64,0.4);"></div>
        <div class="absolute bottom-3 right-3 w-7 h-7" style="border-bottom: 2px solid rgba(240,192,64,0.4); border-right: 2px solid rgba(240,192,64,0.4);"></div>
        <div class="relative z-10">
          <span class="material-symbols-outlined block text-4xl mb-3" style="color: #f0c040; font-variation-settings: 'FILL' 1;">history</span>
          <p style="font-family: 'Cinzel', serif; font-size: 1.05rem; font-weight: 700; color: #ffdf96; margin-bottom: 6px; text-shadow: 0 0 12px rgba(240,192,64,0.3);">Saved Session Found</p>
          <p class="text-sm mb-6" style="color: #9a907b;">
            Last: <span style="color: #e4e1ee;">{currentSession.completedSpins.at(-1)?.resultLabel ?? ''}</span>
            &nbsp;·&nbsp;
            {currentSession.completedSpins.length} spin{currentSession.completedSpins.length === 1 ? '' : 's'} done
          </p>
          <div class="flex gap-3">
            <button onclick={handleResume}
              class="metal-stamp-gold flex-1 py-2.5 rounded-lg text-sm font-bold"
              style="font-family: 'Cinzel', serif; letter-spacing: 0.1em;"
            >Resume</button>
            <button onclick={handleStartOver}
              class="obsidian-slab flex-1 py-2.5 rounded-lg text-sm font-bold transition-all active:scale-95"
              style="font-family: 'Cinzel', serif; color: #9a907b; border: 1px solid #4e4635; letter-spacing: 0.1em;"
            >Start Over</button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Online rivals waiting screen -->
  {#if rivalsOnlineWaiting}
    <div class="fixed inset-0 z-40 flex items-center justify-center px-4" style="background: #07070d;">
      <div class="text-center">
        <div class="animate-spin mb-6 mx-auto" style="width: 48px; height: 48px; border: 3px solid rgba(240,192,64,0.2); border-top-color: #f0c040; border-radius: 50%;"></div>
        <p style="font-family: 'Cinzel', serif; font-size: 1.15rem; font-weight: 700; color: #ffdf96; letter-spacing: 0.08em;">Waiting for opponent…</p>
        <p class="mt-2 text-xs" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Battle begins when they finish spinning</p>
      </div>
    </div>
  {/if}

  <!-- Name your character screen -->
  {#if showNameScreen}
    <div class="flex flex-col items-center justify-center min-h-screen px-4"
      style="animation: slideUp 0.4s ease-out forwards;">
      <div class="obsidian-slab w-full max-w-sm rounded-xl p-8 flex flex-col items-center gap-6 text-center relative overflow-hidden"
        style="border: 1px solid rgba(240,192,64,0.2); box-shadow: 0 20px 60px rgba(0,0,0,0.9);">
        <div class="noise-overlay"></div>
        <div class="absolute top-3 left-3 w-7 h-7" style="border-top: 2px solid rgba(240,192,64,0.3); border-left: 2px solid rgba(240,192,64,0.3);"></div>
        <div class="absolute bottom-3 right-3 w-7 h-7" style="border-bottom: 2px solid rgba(240,192,64,0.3); border-right: 2px solid rgba(240,192,64,0.3);"></div>
        <div class="relative z-10 w-full flex flex-col items-center gap-6">
          <span class="material-symbols-outlined text-5xl" style="color: #f0c040; font-variation-settings: 'FILL' 1; filter: drop-shadow(0 0 12px rgba(240,192,64,0.5));">auto_fix_high</span>
          <div>
            <p class="text-xs tracking-[0.25em] uppercase mb-2"
              style="font-family: 'JetBrains Mono', monospace; color: {rivalMode ? '#f9a8d4' : '#9a907b'};">
              {rivalMode ? (rivalPhase === 'p1' ? '⚔ Rivals Mode — Player 1' : '⚔ Rivals Mode — Player 2') : 'Character Created'}
            </p>
            <h2 style="font-family: 'Cinzel', serif; font-size: 1.7rem; font-weight: 700; color: #ffdf96; letter-spacing: 0.08em; text-shadow: 0 0 14px rgba(240,192,64,0.3);">
              {rivalMode ? (rivalPhase === 'p1' ? 'Name Player 1' : 'Name Player 2') : 'Name Your Legend'}
            </h2>
            <p class="text-sm mt-2" style="color: #9a907b;">
              {rivalMode ? (rivalPhase === 'p1' ? 'Player 1 is ready. Name your warrior.' : 'Player 2 is ready. Name your challenger.') : 'Give your fate-spun hero a name to be remembered by.'}
            </p>
          </div>
          {#if characterSummary && !rivalMode}
            <!-- Auto-generated character summary "roast" — narrative payoff
                 for the full 23-spin run. Italic pull-quote style so it
                 reads as commentary, not stats. -->
            <div class="relative w-full px-3 py-3 rounded-lg"
              style="background: linear-gradient(180deg, rgba(240,192,64,0.08) 0%, rgba(240,192,64,0.02) 100%); border-left: 2px solid rgba(240,192,64,0.45); border-right: 2px solid rgba(240,192,64,0.45); animation: slideUp 0.55s cubic-bezier(0.22, 0.85, 0.3, 1) 0.18s both;">
              <p class="text-[10px] tracking-[0.22em] uppercase mb-2"
                style="font-family: 'JetBrains Mono', monospace; color: #c9a050;">The Read</p>
              <p style="font-family: 'Cinzel', serif; font-style: italic; font-size: 0.95rem; line-height: 1.5; color: #e8dcb8;">
                {characterSummary.text}
              </p>
            </div>
          {/if}
          <div class="flex gap-2 items-center">
            <input
              type="text"
              bind:value={characterName}
              placeholder="Enter a name…"
              maxlength="40"
              class="flex-1 carved-groove rounded-lg px-4 py-3 text-center text-lg outline-none transition-all"
              style="border: 1px solid rgba(240,192,64,0.25); color: #e4e1ee; font-family: 'Cinzel', serif; caret-color: #f0c040;"
              onkeydown={(e) => e.key === 'Enter' && handleNameSubmit()}
            />
            {#if !rivalMode}
              <button
                onclick={() => { characterName = randomCharacterName() }}
                class="obsidian-slab rounded-lg px-3 py-3 flex-shrink-0"
                style="border: 1px solid rgba(240,192,64,0.2); color: var(--gold-bright); font-size: 20px; cursor: pointer; line-height: 1;"
                title="Randomize name"
              >⟳</button>
            {/if}
          </div>
          <button
            onclick={handleNameSubmit}
            class="{rivalMode ? 'metal-stamp-crimson' : 'metal-stamp-gold'} w-full px-10 py-3 rounded-lg relative"
            style="font-family: 'Cinzel', serif; font-size: 0.85rem; letter-spacing: 0.2em; text-transform: uppercase; font-weight: 700; {rivalMode ? 'color: #ffdad6;' : ''}"
          >
            <div class="l-bracket" style="color: {rivalMode ? 'rgba(255,180,171,0.35)' : 'rgba(255,255,255,0.25)'};"></div>
            {rivalMode && rivalPhase === 'p1' ? 'Hand Off to Player 2' : rivalMode && rivalPhase === 'p2' ? 'Begin the Battle!' : characterName.trim() ? 'Reveal Character' : 'Skip'}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Character card screen -->
  {#if showCard}
    <div class="flex justify-center pt-20 pb-24 px-4">
      <CharacterCard
        {results}
        name={characterName}
        startedAt={currentSession.startedAt}
        onNewCharacter={handleNewCharacter}
        onBackToMenu={handleBackToMenu}
        onSaved={(shareId, startedAt) => { charHistory = markCharSaved(startedAt, shareId) }}
      />
    </div>
  {/if}

  <!-- Rivals battle screen -->
  {#if rivalMode && rivalPhase === 'battle'}
    <div style="background: #07070d; min-height: 100dvh;">
      <QuickBattleView
        team1={[{ results, name: characterName }]}
        team2={[{ results: p1Results, name: p1Name }]}
        team1Label={characterName}
        team2Label={p1Name}
        title={`${characterName} vs ${p1Name}`}
        team2Color="#f9a8d4"
        onComplete={(winner) => {
          if (winner === 'team1') handleChallengeWinner(results, characterName, '')
          else if (winner === 'team2') handleChallengeWinner(p1Results, p1Name, p1ShareId)
        }}
        onRematch={handleRematch}
        onBack={handleBackToMenu}
        backLabel="Back to Menu"
      />
    </div>
  {/if}

  <!-- Wildcard flash overlay — phase 1: rapid "WILDCARD" flash for 3 seconds -->
  {#if wildcardPhase === 'flashing'}
    <div class="fixed inset-0 z-50 flex items-center justify-center" style="background: rgba(0,0,0,0.85); animation: wildcardFlashBg 0.25s ease-in-out infinite alternate;">
      <p style="font-family: 'Cinzel', serif; font-size: clamp(3rem, 12vw, 6rem); font-weight: 900; color: #f0c040; letter-spacing: 0.15em; text-shadow: 0 0 40px rgba(240,192,64,0.9), 0 0 80px rgba(240,192,64,0.5); animation: wildcardFlashText 0.2s ease-in-out infinite alternate;">⚡ WILDCARD ⚡</p>
    </div>
  {/if}

  <!-- Wildcard reveal overlay — phase 2: show outcome, press Continue -->
  {#if wildcardPhase === 'reveal'}
    <div class="fixed inset-0 z-50 flex items-center justify-center px-4" style="background: rgba(0,0,0,0.92); backdrop-filter: blur(12px);">
      <div class="text-center px-8 py-8 rounded-2xl w-full max-w-sm"
        style="background: #12111e; border: 2px solid rgba(240,192,64,0.5); box-shadow: 0 0 80px rgba(240,192,64,0.2); animation: resultReveal 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards;">
        <p style="font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; letter-spacing: 0.3em; color: #f0c040; text-transform: uppercase; margin-bottom: 12px;">⚡ Wildcard Activated</p>
        <p style="font-family: 'Cinzel', serif; font-size: 1.5rem; font-weight: 900; color: #ffdf96; letter-spacing: 0.12em; line-height: 1.2;">{wildcardOutcomeLabel}</p>
        <p class="mt-3 text-sm leading-relaxed" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">{wildcardOutcomeDesc}</p>
        <button
          onclick={handleWildcardContinue}
          class="metal-stamp-gold mt-6 w-full py-3 rounded-lg relative"
          style="font-family: 'Cinzel', serif; font-size: 0.85rem; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase;"
        >
          <div class="l-bracket" style="color: rgba(255,255,255,0.25);"></div>
          Continue
        </button>
      </div>
    </div>
  {/if}

  <!-- Main game: two-column layout -->
  {#if !showCard && !showResumePrompt && !showNameScreen && !(rivalMode && rivalPhase === 'battle')}
    <div class="flex pt-14 min-h-screen">

      <!-- LEFT SIDEBAR: Destiny Log -->
      <aside class="hidden md:flex flex-col shrink-0 sticky top-14 overflow-hidden"
        style="width: 260px; height: calc(100vh - 3.5rem); background: linear-gradient(180deg, #0f0e1a 0%, #09090f 100%); border-right: 1px solid rgba(240,192,64,0.1); box-shadow: inset -1px 0 0 rgba(255,223,150,0.04);"
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
          {#each reversedResults as result}
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
                  {normalizeLegacyDisplayLabel(result.displayLabel) ?? result.tier}
                </span>
              {/if}
            </div>
          {/each}
        </div>
      </aside>

      <!-- RIGHT: Category heading + wheel + overlay -->
      <div class="flex-1 flex flex-col items-center px-4 py-8 overflow-y-auto">

        <!-- Rivals mode banner -->
        {#if rivalMode}
          <div class="w-full max-w-lg mb-4 py-2 px-4 rounded-lg text-center text-xs tracking-[0.2em] uppercase"
            style="background: rgba(157,23,77,0.18); border: 1px solid rgba(157,23,77,0.45); font-family: 'JetBrains Mono', monospace; color: #f9a8d4;">
            ⚔ RIVALS MODE — {rivalPhase === 'p1' ? 'Player 1 spinning' : p1ShareId ? `Challenger spinning vs ${p1Name}` : 'Player 2 spinning'}
          </div>
        {/if}

        <!-- Mobile-only compact results strip (above wheel, hidden on md+) -->
        {#if results.length > 0}
          <div class="md:hidden w-full mb-3" style="max-width: 340px;">
            <div class="flex gap-2 overflow-x-auto pb-1" style="scrollbar-width: none;">
              {#each reversedResults.slice(0, 8) as result}
                {@const tc = TIER_COLORS[result.tier ?? ''] ?? null}
                <div class="shrink-0 flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg"
                  style="background: rgba(255,255,255,0.04); border: 1px solid {tc ? tc + '44' : 'rgba(255,255,255,0.08)'}; min-width: 60px; max-width: 80px;">
                  {#if result.tier && tc}
                    <span class="text-[9px] font-black" style="color: {tc}; font-family: 'JetBrains Mono', monospace;">{normalizeLegacyDisplayLabel(result.displayLabel) ?? result.tier}</span>
                  {/if}
                  <span class="text-[9px] leading-tight text-center" style="color: #9a907b; font-family: 'JetBrains Mono', monospace; word-break: break-word;">{result.category}</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Category heading (outside overlay so it stays visible) -->
        <div class="text-center mb-3 md:mb-5" style="animation: fadeIn 0.25s ease-out forwards;">
          <p class="text-xs tracking-[0.22em] uppercase mb-1.5"
            style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">
            {isRevealed ? 'result revealed' : 'spinning for'}
          </p>
          <h2 style="font-family: 'Cinzel', serif; font-size: clamp(1rem, 4vw, 1.55rem); font-weight: 700; color: #ffdf96; letter-spacing: 0.1em;">
            {(currentDef?.displayName ?? '').toUpperCase()}
          </h2>
        </div>

        <!-- Wheel container (relative so overlay can sit on top) -->
        <div class="relative w-full max-w-[340px] md:max-w-lg">

          <!-- First-time hint that fires on the very first race spin. Only
               shows once per device (localStorage flag). Anchored above the
               wheel so it points at what's about to happen. -->
          {#if currentSpinIndex === 0 && currentDef?.category === 'race' && !isRevealed}
            <FirstTimeTooltip
              storageKey="wof_seen_race_hint"
              title="Spin for Race"
              body="Race shapes everything: stat tendencies, abilities, weaknesses, and which sub-wheels appear next. Each one plays differently."
              placement="top"
            />
          {/if}

          <!-- Wheel (remounts each spin to reset IDLE state) -->
          {#key currentSpinIndex}
            <SpinWheel
              segments={currentSegments}
              onSpinComplete={handleSpinComplete}
              categoryHue={currentCategoryHue}
              soundEnabled={settings.soundEnabled}
              effectsEnabled={settings.effectsEnabled}
              spinSpeedMultiplier={settings.spinSpeed}
              cursedTheme={auth.user?.gamepasses?.includes('cursed_wheel') ?? false}
              spinTrigger={spinTriggerKey}
              resolveLandingColors={resolveLandingColors}
              onLanded={({ centerX, centerY }) => {
                wheelCenterX = centerX
                wheelCenterY = centerY
              }}
            />
          {/key}

          <!-- Progress dots — small row under the wheel showing where in the
               run you are. Filled dots = done, ringed = current, dim = upcoming.
               Tier-tinted on completed spins so a streak of high rolls visually
               pops. Matches Story Mode placement. -->
          <div class="flex justify-center mt-2">
            <SpinProgressDots
              currentIndex={currentSpinIndex}
              total={spinQueue.length}
              results={results}
              tierColors={TIER_COLORS}
            />
          </div>

          <!-- Result reveal overlay — shared SpinResultReveal component so the
               main game and Story Mode render the post-spin panel identically. -->
          {#if isRevealed}
            {@const last = (primarySpinResultIndex != null && results[primarySpinResultIndex]) || results.at(-1)}
            {#if last}
              {@const tc = TIER_COLORS[last.tier ?? ''] ?? null}
              {@const itemMeta = last.category === 'power' ? _powerLookup.get(last.resultLabel ?? '')
                : last.category === 'weapon' ? _weaponLookup.get(last.resultLabel ?? '')
                : last.category === 'armor' ? _armorLookup.get(last.resultLabel ?? '')
                : (last.category === 'weaponEnchantment' || last.category === 'armorEnchantment') ? _enchantLookup.get(last.resultLabel ?? '')
                : (last.category === 'raceSubType' || last.category === 'raceClass' || last.category === 'raceTransformation') ? _racePoolLookup.get(last.resultLabel ?? '')
                : (last.category === 'racialAbility' || last.category === 'archetypeAbility') ? _abilityLookup.get(last.resultLabel ?? '')
                : undefined}
              {@const identityCard = (
                last.category === 'race' ||
                last.category === 'archetype' ||
                last.category === 'raceSubType' ||
                last.category === 'raceClass' ||
                last.category === 'raceTransformation' ||
                last.category === 'backstory' ||
                last.category === 'title'
              ) ? buildIdentityCard(last.category, last.resultLabel ?? '') : null}
              {@const resolvedMeta = {
                ...(itemMeta ? { element: itemMeta.element, grade: itemMeta.grade } : {}),
                ...(identityCard ? { identityCard } : {}),
              } as ResolvedMeta}
              <SpinResultReveal
                result={last}
                meta={resolvedMeta}
                tierColor={tc}
                announcement={null}
                onContinue={handleNextSpin}
                layout="modal"
                anchorX={wheelCenterX}
                anchorY={wheelCenterY}
              />
            {/if}
          {/if}

        </div><!-- end wheel container -->


      </div><!-- end right column -->

    </div><!-- end two-column layout -->
  {/if}

</main>
