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

  // ── Vampire — age (older vampires are absurdly stronger) ───────────────
  vampireAge: {
    title: 'Vampiric Age',
    hue: 0,
    accentColor: '#dc2626',
    prompt: 'How long have you walked the night?',
    segments: [
      { label: 'Fledgling (under 100 yrs)',      weight: 4 },
      { label: 'Mature (centuries old)',         weight: 3 },
      { label: 'Ancient (a millennium)',         weight: 2 },
      { label: 'Elder (millennia)',              weight: 1 },
      { label: 'Progenitor (forever)',           weight: 1 },
    ],
    effects: {
      'Fledgling (under 100 yrs)':  { statBonusGrants: { agility: 'statBonus' } },
      'Mature (centuries old)':     { statBonusGrants: { agility: 'statBonus', charisma: 'statBonus' } },
      'Ancient (a millennium)':     { statBonusGrants: { strength: 'statBonus', charisma: 'statBonus', powerMastery: 'statBonus' } },
      'Elder (millennia)':          { statBonusGrants: { strength: 'statBonus', durability: 'statBonus', charisma: 'statBonus', powerMastery: 'statBonus' } },
      'Progenitor (forever)':       { statBonusGrants: { strength: 'statBonus', durability: 'statBonus', charisma: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' }, flavor: 'You were here when language was invented.' },
    },
  },

  // ── Werewolf — moon phase (gates how often Berserker Rage trigger fires) ─
  moonPhase: {
    title: 'Moon Phase at Turning',
    hue: 240,
    accentColor: '#e8b84b',
    prompt: 'What moon was overhead when you turned?',
    segments: [
      { label: 'New Moon (suppressed)',     weight: 2 },
      { label: 'Crescent (steady)',         weight: 3 },
      { label: 'Half Moon (split nature)',  weight: 3 },
      { label: 'Gibbous (rising power)',    weight: 2 },
      { label: 'Full Moon (unleashed)',     weight: 2 },
      { label: 'Blood Moon (cursed)',       weight: 1 },
    ],
    effects: {
      'New Moon (suppressed)':     { statBonusGrants: { iq: 'statBonus', strength: 'statPenalty' } },
      'Crescent (steady)':         { statBonusGrants: { agility: 'statBonus' } },
      'Half Moon (split nature)':  { statBonusGrants: { strength: 'statBonus', iq: 'statBonus' } },
      'Gibbous (rising power)':    { statBonusGrants: { strength: 'statBonus', durability: 'statBonus' } },
      'Full Moon (unleashed)':     { statBonusGrants: { strength: 'statBonus', durability: 'statBonus', fightingSkill: 'statBonus' } },
      'Blood Moon (cursed)':       { lockElement: 'Blood', statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus' }, flavor: 'The moon was red. You remember nothing else.' },
    },
  },

  // ── Dragon — hoard (the more they have, the harder they fight) ─────────
  dragonHoard: {
    title: 'Hoard Size',
    hue: 30,
    accentColor: '#fde047',
    prompt: 'How vast is your treasure pile?',
    segments: [
      { label: 'Pile of Coins (humble)',          weight: 4 },
      { label: 'Cavern of Trinkets',              weight: 3 },
      { label: 'Royal Treasury',                  weight: 2 },
      { label: 'Mountain of Riches',              weight: 1 },
      { label: 'A Stolen Civilization',           weight: 1 },
    ],
    effects: {
      'Pile of Coins (humble)':          { statBonusGrants: { charisma: 'statBonus' } },
      'Cavern of Trinkets':              { statBonusGrants: { durability: 'statBonus', charisma: 'statBonus' } },
      'Royal Treasury':                  { statBonusGrants: { durability: 'statBonus', strength: 'statBonus', charisma: 'statBonus' } },
      'Mountain of Riches':              { statBonusGrants: { durability: 'statBonus', strength: 'statBonus', charisma: 'statBonus', powerMastery: 'statBonus' } },
      'A Stolen Civilization':           { statBonusGrants: { durability: 'statBonus', strength: 'statBonus', charisma: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' }, flavor: 'They will write songs about what you stole.' },
    },
  },

  // ── Dwarf — clan (each clan has a craft + temperament) ─────────────────
  dwarfClan: {
    title: 'Clan',
    hue: 25,
    accentColor: '#92400e',
    prompt: 'Which clan raised you?',
    segments: [
      { label: 'Mountain (smiths)',          weight: 3 },
      { label: 'Deep-Stone (miners)',        weight: 3 },
      { label: 'Iron-Beard (warriors)',      weight: 3 },
      { label: 'Rune-Carvers (mages)',       weight: 2 },
      { label: 'Sky-Forged (legendary)',     weight: 1 },
    ],
    effects: {
      'Mountain (smiths)':          { statBonusGrants: { weaponMastery: 'statBonus', durability: 'statBonus' } },
      'Deep-Stone (miners)':        { statBonusGrants: { durability: 'statBonus', strength: 'statBonus' } },
      'Iron-Beard (warriors)':      { statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus' } },
      'Rune-Carvers (mages)':       { lockElement: 'Arcane', statBonusGrants: { powerMastery: 'statBonus', iq: 'statBonus' } },
      'Sky-Forged (legendary)':     { lockElement: 'Metal', statBonusGrants: { weaponMastery: 'statBonus', armorStrength: 'statBonus', durability: 'statBonus' }, flavor: 'Your ancestors forged the stars.' },
    },
  },

  // ── Stand User — Stand stat (the classic JJBA-style abcd grid) ─────────
  standStats: {
    title: 'Stand Stats',
    hue: 290,
    accentColor: '#fde047',
    prompt: 'What kind of Stand is this?',
    segments: [
      { label: 'Close-Range Powerhouse (A/A/C/D)',  weight: 3 },
      { label: 'Long-Range Specialist (D/B/A/B)',   weight: 3 },
      { label: 'Automatic Stand (E/E/E/A)',         weight: 1 },
      { label: 'Bound Object Stand (B/C/D/A)',      weight: 2 },
      { label: 'Reality-Bending Stand (S/S/S/S)',   weight: 1 },
      { label: 'Joke Stand (F/F/F/F but funny)',    weight: 2 },
    ],
    effects: {
      'Close-Range Powerhouse (A/A/C/D)':  { statBonusGrants: { strength: 'statBonus', speed: 'statBonus', fightingSkill: 'statBonus' } },
      'Long-Range Specialist (D/B/A/B)':   { statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus' } },
      'Automatic Stand (E/E/E/A)':         { statBonusGrants: { potential: 'statBonus' }, flavor: 'It acts on its own. You\'re just along for the ride.' },
      'Bound Object Stand (B/C/D/A)':      { statBonusGrants: { iq: 'statBonus', durability: 'statBonus' } },
      'Reality-Bending Stand (S/S/S/S)':   { lockElement: 'Cosmic', statBonusGrants: { strength: 'statBonus', speed: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' }, flavor: 'Reality has notes for you.' },
      'Joke Stand (F/F/F/F but funny)':    { statBonusGrants: { charisma: 'statBonus' }, flavor: 'Everyone laughs. Then everyone dies.' },
    },
  },

  // ── Bounty Hunter — current contract (sets the prey for predator gimmick) ─
  bountyContract: {
    title: 'Current Contract',
    hue: 30,
    accentColor: '#f97316',
    prompt: 'Who\'s the mark?',
    segments: [
      { label: 'Demon Bounty',           weight: 3 },
      { label: 'Vampire Bounty',         weight: 3 },
      { label: 'Robot/Cyborg Bounty',    weight: 2 },
      { label: 'Alien Bounty',           weight: 2 },
      { label: 'God-Tier Bounty',        weight: 1 },
      { label: 'Self-Bounty (paradox)',  weight: 1 },
    ],
    effects: {
      'Demon Bounty':           { statBonusGrants: { fightingSkill: 'statBonus', durability: 'statBonus' } },
      'Vampire Bounty':         { statBonusGrants: { agility: 'statBonus', fightingSkill: 'statBonus' } },
      'Robot/Cyborg Bounty':    { statBonusGrants: { iq: 'statBonus', weaponMastery: 'statBonus' } },
      'Alien Bounty':           { statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus' } },
      'God-Tier Bounty':        { statBonusGrants: { fightingSkill: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' }, flavor: 'You bid on something you cannot fight.' },
      'Self-Bounty (paradox)':  { statBonusGrants: { iq: 'statBonus', charisma: 'statPenalty' }, flavor: 'You are hunting yourself. Both of you are losing.' },
    },
  },

  // ── Demon Slayer — breathing style (canon Demon Slayer style) ──────────
  breathingStyle: {
    title: 'Breathing Style',
    hue: 350,
    accentColor: '#ef4444',
    prompt: 'Which Breath have you mastered?',
    segments: [
      { label: 'Breath of Water',     weight: 3 },
      { label: 'Breath of Flame',     weight: 3 },
      { label: 'Breath of Thunder',   weight: 3 },
      { label: 'Breath of Stone',     weight: 2 },
      { label: 'Breath of Wind',      weight: 3 },
      { label: 'Breath of the Sun',   weight: 1 },
      { label: 'Breath of the Moon (corrupted)', weight: 1 },
    ],
    effects: {
      'Breath of Water':     { lockElement: 'Water',     statBonusGrants: { agility: 'statBonus', fightingSkill: 'statBonus' } },
      'Breath of Flame':     { lockElement: 'Fire',      statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus' } },
      'Breath of Thunder':   { lockElement: 'Lightning', statBonusGrants: { speed: 'statBonus', fightingSkill: 'statBonus' } },
      'Breath of Stone':     { lockElement: 'Earth',     statBonusGrants: { durability: 'statBonus', strength: 'statBonus' } },
      'Breath of Wind':      { lockElement: 'Wind',      statBonusGrants: { speed: 'statBonus', agility: 'statBonus' } },
      'Breath of the Sun':   { lockElement: 'Light',     statBonusGrants: { strength: 'statBonus', speed: 'statBonus', fightingSkill: 'statBonus', powerMastery: 'statBonus' }, flavor: 'The first Breath. The only one demons truly fear.' },
      'Breath of the Moon (corrupted)': { lockElement: 'Shadow', statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus', charisma: 'statPenalty' }, flavor: 'You learned from the wrong teacher.' },
    },
  },

  // ── Sorcerer — wild magic surge ─────────────────────────────────────────
  wildMagic: {
    title: 'Wild Magic Surge',
    hue: 330,
    accentColor: '#ec4899',
    prompt: 'What\'s leaking out of you today?',
    segments: [
      { label: 'Random Element Affinity',   weight: 3 },
      { label: 'Spell Misfire (CHA boost)', weight: 3 },
      { label: 'Eldritch Whisper (IQ↑)',    weight: 2 },
      { label: 'Mana Overflow (PM↑↑)',      weight: 2 },
      { label: 'Reality Hiccup (everything random)', weight: 1 },
    ],
    effects: {
      'Random Element Affinity':   { statBonusGrants: { powerMastery: 'statBonus' } },
      'Spell Misfire (CHA boost)': { statBonusGrants: { charisma: 'statBonus' }, flavor: 'It missed. They\'re laughing. You\'re in.' },
      'Eldritch Whisper (IQ↑)':    { statBonusGrants: { iq: 'statBonus', powerMastery: 'statBonus' } },
      'Mana Overflow (PM↑↑)':      { statBonusGrants: { powerMastery: 'statBonus', energyLevel: 'statBonus' } },
      'Reality Hiccup (everything random)': { statBonusGrants: { potential: 'statBonus', iq: 'statPenalty' }, flavor: 'Reality stuttered. You felt every version of yourself.' },
    },
  },

  // ── Esper — psionic class (Mob Psycho / X-Men hybrid) ──────────────────
  psionicClass: {
    title: 'Psionic Class',
    hue: 260,
    accentColor: '#b47aec',
    prompt: 'Which psionic art is yours?',
    segments: [
      { label: 'Telekinetic',          weight: 3 },
      { label: 'Telepathic',           weight: 3 },
      { label: 'Pyrokinetic',          weight: 2 },
      { label: 'Precognitive',         weight: 2 },
      { label: 'Reality-Manipulator',  weight: 1 },
      { label: 'Class ??? (unknown)',  weight: 1 },
    ],
    effects: {
      'Telekinetic':          { lockElement: 'Gravity', statBonusGrants: { powerMastery: 'statBonus', iq: 'statBonus' } },
      'Telepathic':           { lockElement: 'Psychic', statBonusGrants: { iq: 'statBonus', charisma: 'statBonus' } },
      'Pyrokinetic':          { lockElement: 'Fire',    statBonusGrants: { powerMastery: 'statBonus', strength: 'statBonus' } },
      'Precognitive':         { lockElement: 'Time',    statBonusGrants: { iq: 'statBonus', agility: 'statBonus' } },
      'Reality-Manipulator':  { lockElement: 'Cosmic',  statBonusGrants: { powerMastery: 'statBonus', iq: 'statBonus', potential: 'statBonus' }, flavor: 'You think. It happens.' },
      'Class ??? (unknown)':  { statBonusGrants: { potential: 'statBonus' }, flavor: 'No one knows what you do yet. Not even you.' },
    },
  },

  // ── Necromancer — undead command (army-scale stat tilt) ────────────────
  undeadCommand: {
    title: 'Undead Command',
    hue: 280,
    accentColor: '#7c3aed',
    prompt: 'What walks at your call?',
    segments: [
      { label: 'A Few Skeletons',          weight: 3 },
      { label: 'A Pack of Wights',         weight: 3 },
      { label: 'A Horde of Revenants',     weight: 2 },
      { label: 'An Undead Battalion',      weight: 1 },
      { label: 'A Necropolis',             weight: 1 },
    ],
    effects: {
      'A Few Skeletons':          { lockElement: 'Soul',   statBonusGrants: { powerMastery: 'statBonus' } },
      'A Pack of Wights':         { lockElement: 'Soul',   statBonusGrants: { powerMastery: 'statBonus', iq: 'statBonus' } },
      'A Horde of Revenants':     { lockElement: 'Shadow', statBonusGrants: { powerMastery: 'statBonus', iq: 'statBonus', charisma: 'statBonus' } },
      'An Undead Battalion':      { lockElement: 'Shadow', statBonusGrants: { powerMastery: 'statBonus', iq: 'statBonus', charisma: 'statBonus', potential: 'statBonus' } },
      'A Necropolis':             { lockElement: 'Shadow', statBonusGrants: { powerMastery: 'statBonus', iq: 'statBonus', charisma: 'statBonus', potential: 'statBonus', durability: 'statBonus' }, flavor: 'You rule a city of the dead.' },
    },
  },
}

// ── Trigger maps ────────────────────────────────────────────────────────
// Which race/archetype labels splice which twist when they land.
export const RACE_TWIST_TRIGGERS: Record<string, string> = {
  // Cosmic / divine
  'God':              'worshipperCount',
  'Demi-god':         'divineParent',
  'Primordial':       'divineParent',
  'Creator':          'cosmicScope',
  // Power-tier escalation
  'Saiyan':           'powerLevel',
  'Viltrumite':       'powerLevel',
  // Element-locks
  'Bender':           'benderElement',
  // Insanity / cosmic horror
  'Eldritch Being':   'insanityTier',
  'Mindflayer':       'insanityTier',
  // Cosmic scope
  'Kryptonian':       'cosmicScope',
  'Asgardian':        'cosmicScope',
  'Alien':            'cosmicScope',
  'Cybertronian':     'cosmicScope',
  // Origin twists
  'Mutant':           'mutantOrigin',
  // Drainer twists
  'Vampire':          'vampireAge',
  'Werewolf':         'moonPhase',
  'Dragon':           'dragonHoard',
  'Half-Dragon':      'dragonHoard',
  // Smith twists
  'Dwarf':            'dwarfClan',
}

export const ARCHETYPE_TWIST_TRIGGERS: Record<string, string> = {
  'Time Traveler':    'temporalEra',
  'Chaos Gremlin':    'chaosRoll',
  'Cursed Sorcerer':  'curseDomain',
  'Stand User':       'standStats',
  'Bounty Hunter':    'bountyContract',
  'Demon Slayer':     'breathingStyle',
  'Sorcerer':         'wildMagic',
  'Esper':            'psionicClass',
  'Necromancer':      'undeadCommand',
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
