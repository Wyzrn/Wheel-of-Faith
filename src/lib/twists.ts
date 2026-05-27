// Race + Archetype twist registry — the dynamic spin queue layer that
// makes every race/archetype FEEL different beyond stats. Each twist
// defines: the sub-wheel segments, an icon/accent, and a resolution
// effect that applies when a result lands.
//
// Inspired by — not copied from — the Wheel of Faith fandom's "results
// trigger sub-wheels" mechanic. Hybrid + Possessed are in handleSpinComplete
// directly (they need bespoke flow); everything else lands here.
//
// To add a twist:
//   1. Add an entry to TWIST_REGISTRY (segments + effects keyed by label)
//   2. Map the trigger race/archetype to the twist key in
//      RACE_TWIST_TRIGGERS / ARCHETYPE_TWIST_TRIGGERS
//   That's it — the handler in +page.svelte splices a twistSpin slot,
//   resolveTwistSegments returns its segments, and applyTwistEffect runs
//   when the result lands.

import type { WeightedSegment } from '$lib/session/types'
import type { ElementType } from '$lib/content/types'

// What a twist result does to the character build. All fields optional —
// pick the ones that apply.
export interface TwistEffect {
  // Stat bonus / penalty grants spliced after this twist lands.
  statBonusGrants?: Record<string, 'statBonus' | 'statPenalty'>
  // Element that biases all subsequent power spins toward it. Stored
  // alongside the result so battle.ts can read it.
  lockElement?: ElementType
  // Free-form flavor note shown on the result. Optional.
  flavor?: string
}

export interface Twist {
  // Title shown in the spin counter ("Next: {title}").
  title: string
  // Hue used for the wheel coloring. Falls back to category default.
  hue?: number
  // Optional accent color override for the celebration.
  accentColor?: string
  // The wheel segments. Labels are unique within a twist.
  segments: WeightedSegment[]
  // Per-label effects applied at landing time.
  effects: Record<string, TwistEffect>
  // Optional sentence shown under the wheel before spinning ("The deity
  // who possesses you. Pray they're awake."). Surfaced as currentDef
  // displayName subtitle via the announcement system.
  prompt?: string
}

// ── Registry ─────────────────────────────────────────────────────────────
// Each key is referenced from RACE_TWIST_TRIGGERS / ARCHETYPE_TWIST_TRIGGERS.
export const TWIST_REGISTRY: Record<string, Twist> = {
  // ── God — worshipper count (the more believers, the stronger they are) ─
  worshipperCount: {
    title: 'Worshipper Count',
    hue: 50,
    accentColor: '#f0c040',
    prompt: 'How many believers fuel this god?',
    segments: [
      { label: 'Forgotten (a handful)',   weight: 6 },
      { label: 'Local Cult (hundreds)',   weight: 5 },
      { label: 'Regional Faith (thousands)', weight: 4 },
      { label: 'National Religion (millions)',  weight: 3 },
      { label: 'Worldwide Worship (billions)',  weight: 2 },
      { label: 'Universal Belief (incomprehensible)', weight: 1 },
    ],
    effects: {
      'Forgotten (a handful)':            { statBonusGrants: { charisma: 'statPenalty' } },
      'Local Cult (hundreds)':            { statBonusGrants: { charisma: 'statBonus' } },
      'Regional Faith (thousands)':       { statBonusGrants: { charisma: 'statBonus', powerMastery: 'statBonus' } },
      'National Religion (millions)':     { statBonusGrants: { charisma: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' } },
      'Worldwide Worship (billions)':     { statBonusGrants: { charisma: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus', energyLevel: 'statBonus' } },
      'Universal Belief (incomprehensible)': { statBonusGrants: { charisma: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus', energyLevel: 'statBonus', strength: 'statBonus' } },
    },
  },

  // ── Saiyan — power level (the meme stat itself) ───────────────────────
  powerLevel: {
    title: 'Power Level',
    hue: 15,
    accentColor: '#f97316',
    prompt: 'What\'s your power level?',
    segments: [
      { label: 'Base Form (~9,000)',                weight: 5 },
      { label: 'Super Saiyan (~150,000)',           weight: 4 },
      { label: 'Super Saiyan 2 (~2 million)',       weight: 3 },
      { label: 'Super Saiyan 3 (~50 million)',      weight: 2 },
      { label: 'Super Saiyan God (billions)',       weight: 2 },
      { label: 'Ultra Instinct (incalculable)',     weight: 1 },
      { label: 'IT\'S OVER 9000 (~9001)',           weight: 1 },
    ],
    effects: {
      'Base Form (~9,000)':                { statBonusGrants: { strength: 'statBonus' } },
      'Super Saiyan (~150,000)':           { statBonusGrants: { strength: 'statBonus', energyLevel: 'statBonus' } },
      'Super Saiyan 2 (~2 million)':       { statBonusGrants: { strength: 'statBonus', energyLevel: 'statBonus', durability: 'statBonus' } },
      'Super Saiyan 3 (~50 million)':      { statBonusGrants: { strength: 'statBonus', energyLevel: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus' } },
      'Super Saiyan God (billions)':       { statBonusGrants: { strength: 'statBonus', energyLevel: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' } },
      'Ultra Instinct (incalculable)':     { statBonusGrants: { strength: 'statBonus', energyLevel: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus', agility: 'statBonus' } },
      'IT\'S OVER 9000 (~9001)':           { statBonusGrants: { strength: 'statBonus' }, flavor: 'Vegeta is screaming somewhere.' },
    },
  },

  // ── Bender — element wheel (locks element pref for downstream powers) ──
  benderElement: {
    title: 'Bending Element',
    hue: 200,
    prompt: 'Which element have you bent to your will?',
    segments: [
      { label: 'Fire',  weight: 3 },
      { label: 'Water', weight: 3 },
      { label: 'Earth', weight: 3 },
      { label: 'Air',   weight: 2 },
      { label: 'Energy (Avatar State)', weight: 1 },
    ],
    effects: {
      'Fire':  { lockElement: 'Fire',     statBonusGrants: { strength: 'statBonus', charisma: 'statBonus' } },
      'Water': { lockElement: 'Water',    statBonusGrants: { agility: 'statBonus', iq: 'statBonus' } },
      'Earth': { lockElement: 'Earth',    statBonusGrants: { durability: 'statBonus', strength: 'statBonus' } },
      'Air':   { lockElement: 'Wind',     statBonusGrants: { speed: 'statBonus', agility: 'statBonus' } },
      'Energy (Avatar State)': { lockElement: 'Cosmic', statBonusGrants: { strength: 'statBonus', agility: 'statBonus', durability: 'statBonus', iq: 'statBonus', powerMastery: 'statBonus' } },
    },
  },

  // ── Eldritch Being — insanity tier (more sanity → bigger powerMastery,
  // worse charisma; sane horrors don't read social cues) ────────────────
  insanityTier: {
    title: 'Insanity Tier',
    hue: 280,
    accentColor: '#a78bfa',
    prompt: 'How much of you is still you?',
    segments: [
      { label: 'Whispering in the Corners',    weight: 4 },
      { label: 'Mind-Cracking Presence',       weight: 3 },
      { label: 'Reality-Warping Aura',         weight: 2 },
      { label: 'Cosmic Horror Incarnate',      weight: 1 },
    ],
    effects: {
      'Whispering in the Corners':    { statBonusGrants: { powerMastery: 'statBonus', charisma: 'statPenalty' } },
      'Mind-Cracking Presence':       { statBonusGrants: { powerMastery: 'statBonus', iq: 'statBonus', charisma: 'statPenalty' } },
      'Reality-Warping Aura':         { statBonusGrants: { powerMastery: 'statBonus', iq: 'statBonus', potential: 'statBonus', charisma: 'statPenalty' } },
      'Cosmic Horror Incarnate':      { statBonusGrants: { powerMastery: 'statBonus', iq: 'statBonus', potential: 'statBonus', strength: 'statBonus', charisma: 'statPenalty', fightingSkill: 'statPenalty' } },
    },
  },

  // ── Time Traveler — era pick ──────────────────────────────────────────
  temporalEra: {
    title: 'Origin Era',
    hue: 220,
    accentColor: '#48c8e0',
    prompt: 'When did you come from?',
    segments: [
      { label: 'Ancient Past',     weight: 3 },
      { label: 'Modern Era',       weight: 3 },
      { label: 'Far Future',       weight: 3 },
      { label: 'Outside Time',     weight: 1 },
    ],
    effects: {
      'Ancient Past':  { statBonusGrants: { fightingSkill: 'statBonus', iq: 'statPenalty' } },
      'Modern Era':    { statBonusGrants: { charisma: 'statBonus' } },
      'Far Future':    { statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus' } },
      'Outside Time':  { statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' }, flavor: 'Time has no claim on you.' },
    },
  },

  // ── Chaos Gremlin — randomized chaotic outcome ─────────────────────────
  chaosRoll: {
    title: 'Chaos Roll',
    hue: 330,
    accentColor: '#ec4899',
    prompt: 'What does the chaos decide?',
    segments: [
      { label: 'Lucky Streak (random stat ↑)',      weight: 3 },
      { label: 'Identity Crisis (random stat ↓)',   weight: 3 },
      { label: 'Pocket Universe (energy ↑↑)',       weight: 2 },
      { label: 'Pure Pandemonium (everything ±1)',  weight: 1 },
      { label: 'Fourth Wall Breaker',               weight: 1 },
    ],
    effects: {
      'Lucky Streak (random stat ↑)':    { statBonusGrants: { potential: 'statBonus' } },
      'Identity Crisis (random stat ↓)': { statBonusGrants: { iq: 'statPenalty' } },
      'Pocket Universe (energy ↑↑)':     { statBonusGrants: { energyLevel: 'statBonus', powerMastery: 'statBonus' } },
      'Pure Pandemonium (everything ±1)': { statBonusGrants: { strength: 'statBonus', agility: 'statBonus', charisma: 'statPenalty', iq: 'statPenalty' } },
      'Fourth Wall Breaker':             { statBonusGrants: { charisma: 'statBonus', iq: 'statBonus' }, flavor: 'You know this is a game. The game knows you know.' },
    },
  },

  // ── Demi-God — divine parent (inherits element bias) ───────────────────
  divineParent: {
    title: 'Divine Parent',
    hue: 45,
    accentColor: '#fde047',
    prompt: 'Which deity sired you?',
    segments: [
      { label: 'God of Storms',   weight: 3 },
      { label: 'God of the Sea',  weight: 3 },
      { label: 'God of Death',    weight: 2 },
      { label: 'God of War',      weight: 2 },
      { label: 'God of the Sun',  weight: 2 },
      { label: 'God of the Wild', weight: 2 },
      { label: 'Forgotten Deity', weight: 1 },
    ],
    effects: {
      'God of Storms':   { lockElement: 'Lightning', statBonusGrants: { energyLevel: 'statBonus', powerMastery: 'statBonus' } },
      'God of the Sea':  { lockElement: 'Water',     statBonusGrants: { durability: 'statBonus', iq: 'statBonus' } },
      'God of Death':    { lockElement: 'Shadow',    statBonusGrants: { powerMastery: 'statBonus', durability: 'statBonus' } },
      'God of War':      { lockElement: 'Fire',      statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus' } },
      'God of the Sun':  { lockElement: 'Light',     statBonusGrants: { charisma: 'statBonus', powerMastery: 'statBonus' } },
      'God of the Wild': { lockElement: 'Nature',    statBonusGrants: { agility: 'statBonus', durability: 'statBonus' } },
      'Forgotten Deity': { statBonusGrants: { potential: 'statBonus' }, flavor: 'Even gods get forgotten.' },
    },
  },

  // ── Cosmic Scope (Kryptonian / Asgardian / Alien) ──────────────────────
  cosmicScope: {
    title: 'Cosmic Scope',
    hue: 240,
    accentColor: '#b47aec',
    prompt: 'How far does your influence reach?',
    segments: [
      { label: 'Planetary (one world)',    weight: 3 },
      { label: 'Stellar (a system)',       weight: 3 },
      { label: 'Galactic (a galaxy)',      weight: 2 },
      { label: 'Universal (everything)',   weight: 1 },
    ],
    effects: {
      'Planetary (one world)':    { statBonusGrants: { strength: 'statBonus' } },
      'Stellar (a system)':       { statBonusGrants: { strength: 'statBonus', durability: 'statBonus' } },
      'Galactic (a galaxy)':      { statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus' } },
      'Universal (everything)':   { statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' }, flavor: 'You have conquered everything that can be conquered.' },
    },
  },

  // ── Mutant — power origin (subtle stat tilts) ──────────────────────────
  mutantOrigin: {
    title: 'Mutation Origin',
    hue: 170,
    segments: [
      { label: 'Genetic Birthright',   weight: 3 },
      { label: 'Radiation Accident',   weight: 3 },
      { label: 'Cosmic Exposure',      weight: 2 },
      { label: 'Lab Experiment',       weight: 2 },
      { label: 'Self-Inflicted',       weight: 1 },
    ],
    effects: {
      'Genetic Birthright':   { statBonusGrants: { potential: 'statBonus' } },
      'Radiation Accident':   { statBonusGrants: { durability: 'statBonus', charisma: 'statPenalty' } },
      'Cosmic Exposure':      { lockElement: 'Cosmic', statBonusGrants: { powerMastery: 'statBonus' } },
      'Lab Experiment':       { statBonusGrants: { iq: 'statBonus', durability: 'statPenalty' } },
      'Self-Inflicted':       { statBonusGrants: { strength: 'statBonus', iq: 'statPenalty' }, flavor: 'You did this to yourself. On purpose.' },
    },
  },

  // ── Cursed Sorcerer — curse domain (Jujutsu-flavored) ──────────────────
  curseDomain: {
    title: 'Cursed Domain',
    hue: 290,
    accentColor: '#a78bfa',
    segments: [
      { label: 'Domain: Hollow Purple', weight: 1 },
      { label: 'Domain: Malevolent Shrine', weight: 1 },
      { label: 'Domain: Idle Death',    weight: 2 },
      { label: 'Domain: Self-Embodiment of Perfection', weight: 1 },
      { label: 'Domain: Time Distortion', weight: 2 },
      { label: 'No Domain (untapped)',  weight: 3 },
    ],
    effects: {
      'Domain: Hollow Purple':          { lockElement: 'Void',   statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus' } },
      'Domain: Malevolent Shrine':      { lockElement: 'Shadow', statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus' } },
      'Domain: Idle Death':             { lockElement: 'Soul',   statBonusGrants: { powerMastery: 'statBonus' } },
      'Domain: Self-Embodiment of Perfection': { lockElement: 'Arcane', statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus' } },
      'Domain: Time Distortion':        { lockElement: 'Time',   statBonusGrants: { iq: 'statBonus', agility: 'statBonus' } },
      'No Domain (untapped)':           { statBonusGrants: { potential: 'statBonus' }, flavor: 'Your cursed energy is raw potential.' },
    },
  },
}

// ── Trigger maps ────────────────────────────────────────────────────────
// Which race/archetype labels splice which twist when they land.
export const RACE_TWIST_TRIGGERS: Record<string, string> = {
  'God':              'worshipperCount',
  'Demi-god':         'divineParent',
  'Saiyan':           'powerLevel',
  'Bender':           'benderElement',
  'Eldritch Being':   'insanityTier',
  'Kryptonian':       'cosmicScope',
  'Asgardian':        'cosmicScope',
  'Alien':            'cosmicScope',
  'Mutant':           'mutantOrigin',
}

export const ARCHETYPE_TWIST_TRIGGERS: Record<string, string> = {
  'Time Traveler':    'temporalEra',
  'Chaos Gremlin':    'chaosRoll',
  'Cursed Sorcerer':  'curseDomain',
}

// Public lookups —
export function twistForRace(race: string): Twist | null {
  const key = RACE_TWIST_TRIGGERS[race]
  return key ? TWIST_REGISTRY[key] ?? null : null
}
export function twistForArchetype(arc: string): Twist | null {
  const key = ARCHETYPE_TWIST_TRIGGERS[arc]
  return key ? TWIST_REGISTRY[key] ?? null : null
}
export function twistByKey(key: string): Twist | null {
  return TWIST_REGISTRY[key] ?? null
}
