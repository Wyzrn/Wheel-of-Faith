// archetypeMutations.ts — Race × Archetype overlay rules that mutate
// injected wheels and inject hidden outcomes. Lets a Saiyan + Berserker
// feel different from a Saiyan + Martial Artist beyond just the
// statModifiers stack.
//
// A mutation can:
//   1. Replace a race-injected wheel's segments entirely (e.g. Saiyan's
//      Transformation Wheel becomes rage-focused when paired with Berserker).
//   2. Add bonus segments to an existing wheel (e.g. Vampire + Noble adds
//      Royal Bloodline outcomes).
//   3. Bias the secret-event roll for this character (Demon + Cursed
//      Sorcerer fires Corruption events more often).
//   4. Add a hidden archetype-only segment to the standard power pool.
//
// Mutations are keyed off "${raceLabel}::${archetypeLabel}" and resolved at
// run time during race-extras splice + power-pool build. Each mutation is
// pure data so it can be authored alongside content.

import type { WeightedSegment } from '$lib/session/types'
import type { StatBonusGrants } from '$lib/content/types'

// Mutations carry "wide" segments — same shape RaceWheel.segments uses
// (label, weight, optional description, optional statBonusGrants, etc.).
// Downstream they flow through WeightedSegment-typed channels at runtime
// via a structural cast; the wheel renderer ignores fields it doesn't
// recognise.
export type MutationSegment = WeightedSegment & {
  description?: string
  statBonusGrants?: StatBonusGrants
}

export interface ArchetypeMutation {
  /** Per-wheel segment overrides. Key = RaceWheel.id (e.g. "transformation"). */
  wheelOverrides?: Record<string, MutationSegment[]>
  /** Additional segments appended to the named wheel. */
  wheelAdditions?: Record<string, MutationSegment[]>
  /** Multiplier on the secret-event base chance for this character. */
  secretEventBias?: number
  /** Free-text flavor string surfaced on the character card under "Synergy". */
  synergyFlavor?: string
}

const _mutations = new Map<string, ArchetypeMutation>()
function key(race: string, archetype: string): string { return `${race}::${archetype}` }

export function registerMutation(race: string, archetype: string, mut: ArchetypeMutation): void {
  _mutations.set(key(race, archetype), mut)
}

export function getMutation(race: string, archetype: string): ArchetypeMutation | undefined {
  return _mutations.get(key(race, archetype))
}

/** Resolves a race-wheel's final segment list, applying any archetype
 *  mutation that targets the same wheel id. Returns null if no base wheel
 *  exists for the (race, wheelId) pair. */
export function resolveMutatedSegments(
  baseSegments: WeightedSegment[] | null,
  race: string,
  archetype: string | undefined,
  wheelId: string,
): WeightedSegment[] | null {
  if (!baseSegments) return null
  if (!archetype) return baseSegments
  const mut = getMutation(race, archetype)
  if (!mut) return baseSegments
  if (mut.wheelOverrides?.[wheelId]) return mut.wheelOverrides[wheelId] as WeightedSegment[]
  if (mut.wheelAdditions?.[wheelId]) return [...baseSegments, ...mut.wheelAdditions[wheelId] as WeightedSegment[]]
  return baseSegments
}

// ──────────────────────────────────────────────────────────────────────────
// Authored mutation rules. Each entry is a (race, archetype) pairing that
// changes one or more of the race's injected wheels and optionally biases
// secret events. Keep the list focused — only pairs that produce a
// genuinely different feel get an entry; the rest fall through to the
// base race wheels.
// ──────────────────────────────────────────────────────────────────────────

// ── HUMAN × archetype ─────────────────────────────────────────────────────
registerMutation('Human', 'Superhero', {
  // Hero-archetype Humans skew Destiny toward Chosen One / Heroic Soul.
  wheelOverrides: {
    destiny: [
      { label: 'Chosen One',   weight: 5, description: 'A prophecy applies.' },
      { label: 'Heroic Soul',  weight: 4, description: 'Bound for legend.' },
      { label: 'Underdog',     weight: 2, description: 'Stronger when behind.' },
      { label: 'Survivor',     weight: 1, description: 'Cannot be killed easily.' },
    ],
  },
  synergyFlavor: 'Heroic Human — destiny pulls toward Chosen One.',
})
registerMutation('Human', 'Artificer', {
  wheelOverrides: {
    talent: [
      { label: "Inventor's Mind", weight: 5 },
      { label: 'Prototype Genius', weight: 3 },
      { label: 'Combat Engineer',  weight: 2 },
    ],
  },
  wheelAdditions: {
    destiny: [
      { label: 'Visionary', weight: 2, description: 'Their inventions reshape the era.' },
    ],
  },
  synergyFlavor: 'Inventor Human — fate-tech outcomes unlocked.',
})

// ── SAIYAN × archetype ────────────────────────────────────────────────────
registerMutation('Saiyan', 'Berserker', {
  // Berserker Saiyans push the rage threshold pool to volatile entries.
  wheelOverrides: {
    rageThreshold: [
      { label: 'Volatile',        weight: 3 },
      { label: 'Berserker Heart', weight: 5 },
      { label: 'Battle-Lust',     weight: 3 },
      { label: 'Tempered',        weight: 1 },
    ],
  },
  synergyFlavor: 'Berserker Saiyan — rage threshold shifts to Battle-Lust by default.',
})
registerMutation('Saiyan', 'Monk', {
  // Monk Saiyans stay disciplined — Stoic-heavy rage table.
  wheelOverrides: {
    rageThreshold: [
      { label: 'Stoic',           weight: 6 },
      { label: 'Tempered',        weight: 4 },
      { label: 'Volatile',        weight: 1 },
      { label: 'Battle-Lust',     weight: 1 },
    ],
  },
  synergyFlavor: 'Martial-Artist Saiyan — disciplined ki, technique-focused growth.',
})
registerMutation('Saiyan', 'Mage', {
  // God Ki path — Mage Saiyans get a Strategist-coded synergy where Battle-
  // Lust converts to a pure power growth ramp.
  wheelAdditions: {
    rageThreshold: [
      { label: 'God Ki Channel', weight: 2, statBonusGrants: { powerMastery: 'statBonus', energyLevel: 'statBonus' }, description: 'Channels divine ki instead of rage.' },
    ],
  },
  synergyFlavor: 'God-Ki Saiyan — channels divinity instead of rage.',
})

// ── CREATOR × archetype ──────────────────────────────────────────────────
registerMutation('Creator', 'Bard', {
  // The Artist Creator paints reality with concept-paint. Doubled weight on
  // Concept domain + adds a Reality Paint power option.
  wheelOverrides: {
    creationDomain: [
      { label: 'Concept',  weight: 4, description: 'They paint the idea itself.' },
      { label: 'Chaos',    weight: 3 },
      { label: 'Life',     weight: 3 },
      { label: 'Cosmos',   weight: 2 },
      { label: 'Order',    weight: 1 },
      { label: 'Time',     weight: 1 },
    ],
  },
  synergyFlavor: 'Artist Creator — reality-paint outcomes unlocked.',
})
// ── HALFLING × archetype ──────────────────────────────────────────────────
registerMutation('Halfling', 'Rogue', {
  wheelOverrides: {
    fortune: [
      { label: 'Lucky Day',    weight: 6, statBonusGrants: { potential: 'statBonus' } },
      { label: 'Streak',       weight: 4, statBonusGrants: { speed: 'statBonus', fightingSkill: 'statBonus' } },
      { label: 'Coin Flip',    weight: 2 },
      { label: 'Lottery Soul', weight: 3, statBonusGrants: { potential: 'statBonus', charisma: 'statBonus' } },
      { label: 'Cursed Coin',  weight: 1, statBonusGrants: { charisma: 'statPenalty' } },
    ],
  },
  synergyFlavor: 'Rogue Halfling — fortune favours the swift.',
})
registerMutation('Halfling', 'Bard', {
  wheelOverrides: {
    fortune: [
      { label: 'Coin Flip',    weight: 6, description: 'Audience tension.' },
      { label: 'Lucky Day',    weight: 4, statBonusGrants: { potential: 'statBonus', charisma: 'statBonus' } },
      { label: 'Lottery Soul', weight: 3, statBonusGrants: { charisma: 'statBonus', potential: 'statBonus' } },
      { label: 'Streak',       weight: 2, statBonusGrants: { speed: 'statBonus' } },
    ],
  },
})

// ── GOBLIN × archetype ────────────────────────────────────────────────────
registerMutation('Goblin', 'Artificer', {
  // "Goblin Engineering" — Scrap pile reshuffles to favour combined items.
  wheelOverrides: {
    scrap: [
      { label: 'Goblin Engine',  weight: 6, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus', iq: 'statBonus' } },
      { label: 'Live Grenade',   weight: 4, statBonusGrants: { strength: 'statBonus' } },
      { label: 'Sparking Wire',  weight: 3, statBonusGrants: { powerMastery: 'statBonus' } },
      { label: 'Sharpened Junk', weight: 2, statBonusGrants: { fightingSkill: 'statBonus' } },
    ],
  },
  synergyFlavor: 'Goblin Engineering — two weak items combine into one insane item.',
})
registerMutation('Goblin', 'Berserker', {
  // Raider goblin — Loot wheel skews stolen-weapon.
  wheelOverrides: {
    loot: [
      { label: 'Half a Weapon',  weight: 5, statBonusGrants: { fightingSkill: 'statBonus', weaponMastery: 'statBonus' } },
      { label: 'Stolen Trinket', weight: 4, statBonusGrants: { charisma: 'statBonus' } },
      { label: 'Cursed Idol',    weight: 3, statBonusGrants: { powerMastery: 'statBonus', charisma: 'statPenalty' } },
      { label: 'Bag of Coins',   weight: 1 },
    ],
  },
})

// ── DWARF × archetype ────────────────────────────────────────────────────
registerMutation('Dwarf', 'Warrior', {
  // Forge biased toward higher-grade pieces; rune toward Sharpness/Power.
  wheelOverrides: {
    forge: [
      { label: 'Guild Quality',   weight: 6, statBonusGrants: { weaponMastery: 'statBonus', armorStrength: 'statBonus' } },
      { label: 'Heirloom Weapon', weight: 5, statBonusGrants: { weaponMastery: 'statBonus', fightingSkill: 'statBonus' } },
      { label: 'Mastercraft',     weight: 3, statBonusGrants: { weaponMastery: 'statBonus', armorStrength: 'statBonus', fightingSkill: 'statBonus' } },
      { label: 'Legendary Forge', weight: 1, statBonusGrants: { armorStrength: 'statBonus', weaponMastery: 'statBonus', strength: 'statBonus' } },
    ],
    rune: [
      { label: 'Rune of Sharpness', weight: 5, statBonusGrants: { fightingSkill: 'statBonus' } },
      { label: 'Rune of Power',     weight: 4, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus' } },
      { label: 'Rune of Doom',      weight: 2, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus' } },
      { label: 'No Rune',           weight: 1 },
    ],
  },
  synergyFlavor: 'Warrior Dwarf — fights what they forged.',
})

// ── ROBOT × archetype ────────────────────────────────────────────────────
registerMutation('Robot', 'Rogue', {
  wheelOverrides: {
    core: [
      { label: 'Stealth Core', weight: 6, statBonusGrants: { agility: 'statBonus', speed: 'statBonus' } },
      { label: 'Logic Core',   weight: 3, statBonusGrants: { iq: 'statBonus' } },
      { label: 'Combat Core',  weight: 2, statBonusGrants: { fightingSkill: 'statBonus' } },
    ],
  },
})

// ── ELF × archetype ──────────────────────────────────────────────────────
registerMutation('Elf', 'Mage', {
  wheelAdditions: {
    blessing: [
      { label: 'Arcane Inheritance', weight: 3, statBonusGrants: { powerMastery: 'statBonus', iq: 'statBonus' }, description: 'Family of mages. Magic in the blood.' },
    ],
  },
})

// ── TIEFLING × archetype ─────────────────────────────────────────────────
registerMutation('Tiefling', 'Warlock', {
  // Contract biased toward higher pacts; sin biased toward Wrath/Pride.
  wheelOverrides: {
    contract: [
      { label: 'Blood Pact',    weight: 5, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', potential: 'statPenalty' } },
      { label: 'Eternal Flame', weight: 3, statBonusGrants: { energyLevel: 'statBonus', powerMastery: 'statBonus', charisma: 'statBonus', iq: 'statPenalty' } },
      { label: 'Soul Power',    weight: 4, statBonusGrants: { powerMastery: 'statBonus', energyLevel: 'statBonus', durability: 'statPenalty' } },
      { label: 'Minor Pact',    weight: 1 },
    ],
  },
  secretEventBias: 1.3,
})

// ── DRAGONBORN × archetype ───────────────────────────────────────────────
registerMutation('Dragonborn', 'Mage', {
  // Mage dragonborn favour rare elements (Solar / Void) + dual breath.
  wheelOverrides: {
    dragonAspect: [
      { label: 'Solar',    weight: 4, statBonusGrants: { powerMastery: 'statBonus', energyLevel: 'statBonus', charisma: 'statBonus' } },
      { label: 'Void',     weight: 4, statBonusGrants: { powerMastery: 'statBonus', iq: 'statBonus' } },
      { label: 'Storm',    weight: 3, statBonusGrants: { speed: 'statBonus', energyLevel: 'statBonus' } },
      { label: 'Frost',    weight: 3, statBonusGrants: { durability: 'statBonus', powerMastery: 'statBonus' } },
      { label: 'Infernal', weight: 2, statBonusGrants: { strength: 'statBonus', energyLevel: 'statBonus' } },
    ],
    breathEvolution: [
      { label: 'Dual Breath',    weight: 5, statBonusGrants: { powerMastery: 'statBonus', energyLevel: 'statBonus' } },
      { label: 'Catastrophe',    weight: 2, statBonusGrants: { powerMastery: 'statBonus', strength: 'statBonus', energyLevel: 'statBonus' } },
      { label: 'Refined Breath', weight: 3, statBonusGrants: { powerMastery: 'statBonus', fightingSkill: 'statBonus' } },
      { label: 'Single Breath',  weight: 1 },
    ],
  },
})

// ── AASIMAR × archetype ──────────────────────────────────────────────────
registerMutation('Aasimar', 'Cleric', {
  // Halo brighter, blessings stronger.
  wheelOverrides: {
    halo: [
      { label: 'Radiant',      weight: 6, statBonusGrants: { charisma: 'statBonus', potential: 'statBonus' } },
      { label: 'Burning Halo', weight: 4, statBonusGrants: { powerMastery: 'statBonus', fightingSkill: 'statBonus', charisma: 'statBonus' } },
      { label: 'Divine Mercy', weight: 3, statBonusGrants: { potential: 'statBonus', charisma: 'statBonus', powerMastery: 'statBonus' } },
      { label: 'Subtle Glow',  weight: 1 },
    ],
  },
  synergyFlavor: 'Cleric Aasimar — light pierces.',
})

// ── TABAXI × archetype ───────────────────────────────────────────────────
registerMutation('Tabaxi', 'Rogue', {
  wheelOverrides: {
    hunt: [
      { label: 'Stalker',     weight: 6, statBonusGrants: { agility: 'statBonus', speed: 'statBonus' } },
      { label: 'Apex Hunter', weight: 3, statBonusGrants: { speed: 'statBonus', agility: 'statBonus', fightingSkill: 'statBonus' } },
      { label: 'Night Cat',   weight: 3, statBonusGrants: { agility: 'statBonus', speed: 'statBonus', iq: 'statBonus' } },
      { label: 'Pouncer',     weight: 2 },
    ],
  },
})

// ── GENASI (Fire) × archetype ────────────────────────────────────────────
registerMutation('Genasi (Fire)', 'Berserker', {
  wheelOverrides: {
    inferno: [
      { label: 'Living Flame', weight: 5, statBonusGrants: { powerMastery: 'statBonus', energyLevel: 'statBonus', fightingSkill: 'statBonus' } },
      { label: 'Pyroclasm',    weight: 4, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus' } },
      { label: 'Solar Heart',  weight: 3, statBonusGrants: { energyLevel: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus' } },
      { label: 'Burning Aura', weight: 2, statBonusGrants: { powerMastery: 'statBonus' } },
      { label: 'Ember',        weight: 1 },
    ],
  },
})

// ── BENDER × archetype ───────────────────────────────────────────────────
registerMutation('Bender', 'Monk', {
  wheelOverrides: {
    masteryLevel: [
      { label: 'Grandmaster',  weight: 5, statBonusGrants: { powerMastery: 'statBonus', fightingSkill: 'statBonus', potential: 'statBonus' } },
      { label: 'Master',       weight: 4, statBonusGrants: { powerMastery: 'statBonus', fightingSkill: 'statBonus' } },
      { label: 'Avatar Spark', weight: 2, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus', energyLevel: 'statBonus' } },
      { label: 'Adept',        weight: 1 },
    ],
  },
  synergyFlavor: 'Monk Bender — the form is the bender.',
})

// ── GHOUL × archetype ────────────────────────────────────────────────────
registerMutation('Ghoul', 'Anti-Hero', {
  // Hunger wheel pushes the character toward Devouring/Endless Maw — visible
  // moral conflict the archetype is built around.
  wheelOverrides: {
    hunger: [
      { label: 'Aching',     weight: 5, statBonusGrants: { speed: 'statBonus', charisma: 'statPenalty' } },
      { label: 'Devouring',  weight: 4, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus' } },
      { label: 'Endless Maw',weight: 2, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', fightingSkill: 'statBonus', charisma: 'statPenalty' } },
      { label: 'Starving',   weight: 2 },
    ],
  },
  secretEventBias: 1.2,
})

// ── VAMPIRE × archetype ──────────────────────────────────────────────────
registerMutation('Vampire', 'Bard', {
  // Noble vampires — high-society manipulation, charisma-coded.
  wheelOverrides: {
    bloodline: [
      { label: 'Noble',     weight: 6, statBonusGrants: { charisma: 'statBonus', iq: 'statBonus' } },
      { label: 'Ancient',   weight: 2, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus', iq: 'statBonus' } },
      { label: 'Crimson',   weight: 2, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus' } },
      { label: 'Shadow',    weight: 1, statBonusGrants: { agility: 'statBonus', speed: 'statBonus', powerMastery: 'statBonus' } },
    ],
  },
  synergyFlavor: 'Noble Vampire — society itself is the hunt.',
})
registerMutation('Vampire', 'Berserker', {
  // Feral vampires — Bloodline biased Feral; Corruption pushed towards Beast-Near.
  wheelOverrides: {
    bloodline: [
      { label: 'Feral',    weight: 6, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', charisma: 'statPenalty' } },
      { label: 'Crimson',  weight: 3, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus' } },
      { label: 'Ancient',  weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus', iq: 'statBonus' } },
    ],
    corruption: [
      { label: 'Beast-Near', weight: 6, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', iq: 'statPenalty' } },
      { label: 'Awakening',  weight: 3, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus', charisma: 'statPenalty' } },
      { label: 'Slipping',   weight: 2, statBonusGrants: { strength: 'statBonus', charisma: 'statPenalty' } },
    ],
  },
  secretEventBias: 1.3,
  synergyFlavor: 'Feral Vampire — the leash is decorative.',
})

// ── WEREWOLF × archetype ─────────────────────────────────────────────────
registerMutation('Werewolf', 'Berserker', {
  wheelOverrides: {
    moon: [
      { label: 'Full Moon', weight: 6, statBonusGrants: { strength: 'statBonus', speed: 'statBonus', fightingSkill: 'statBonus', iq: 'statPenalty' } },
      { label: 'Gibbous',   weight: 4, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus' } },
      { label: 'Crescent',  weight: 2, statBonusGrants: { speed: 'statBonus', agility: 'statBonus' } },
    ],
    alpha: [
      { label: 'Alpha',   weight: 4, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', charisma: 'statBonus', potential: 'statBonus' } },
      { label: 'Hunter',  weight: 3, statBonusGrants: { fightingSkill: 'statBonus', agility: 'statBonus' } },
      { label: 'Lone',    weight: 2, statBonusGrants: { agility: 'statBonus', charisma: 'statPenalty' } },
    ],
  },
})

// ── DEMON × archetype ────────────────────────────────────────────────────
registerMutation('Demon', 'Cursed Sorcerer', {
  // Demons paired with cursed sorcery — Sin pushes toward Wrath/Greed,
  // Pact biased toward Sovereign, Hellfire biased toward Crowned.
  wheelOverrides: {
    sin: [
      { label: 'Wrath',  weight: 5, statBonusGrants: { strength: 'statBonus', charisma: 'statPenalty' } },
      { label: 'Greed',  weight: 4, statBonusGrants: { iq: 'statBonus', potential: 'statBonus' } },
      { label: 'Pride',  weight: 3, statBonusGrants: { charisma: 'statBonus', fightingSkill: 'statBonus' } },
      { label: 'Envy',   weight: 2, statBonusGrants: { agility: 'statBonus', speed: 'statBonus', charisma: 'statPenalty' } },
    ],
    pact: [
      { label: 'Sovereign Pact',weight: 4, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus', fightingSkill: 'statBonus', potential: 'statBonus', charisma: 'statPenalty' } },
      { label: 'Domain Pact',   weight: 4, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus', charisma: 'statBonus' } },
      { label: 'Soul Trade',    weight: 2, statBonusGrants: { powerMastery: 'statBonus', iq: 'statBonus', potential: 'statPenalty' } },
    ],
  },
  secretEventBias: 1.5,
  synergyFlavor: 'Cursed Demon — the curse and the demon converge.',
})

// ── SHINOBI × archetype ──────────────────────────────────────────────────
registerMutation('Shinobi', 'Shinobi', {
  wheelOverrides: {
    clan: [
      { label: 'Heir',          weight: 5, statBonusGrants: { fightingSkill: 'statBonus', powerMastery: 'statBonus', charisma: 'statBonus' } },
      { label: 'Main House',    weight: 4, statBonusGrants: { fightingSkill: 'statBonus', powerMastery: 'statBonus' } },
      { label: 'Forbidden Clan',weight: 2, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus', fightingSkill: 'statBonus', iq: 'statBonus', charisma: 'statPenalty' } },
      { label: 'Outer Clan',    weight: 1, statBonusGrants: { agility: 'statBonus', speed: 'statBonus' } },
    ],
  },
  synergyFlavor: 'True Shinobi — bloodline and discipline align.',
})

// ── NEN USER × archetype ─────────────────────────────────────────────────
registerMutation('Nen User', 'Nen Hunter', {
  // Restriction-heavy build — Nen restrictions amplify power.
  wheelOverrides: {
    restriction: [
      { label: 'Condition Lock',  weight: 5, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus', durability: 'statPenalty' } },
      { label: 'Target Restriction',weight: 4, statBonusGrants: { fightingSkill: 'statBonus', powerMastery: 'statBonus' } },
      { label: 'Death Vow',       weight: 2, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus', energyLevel: 'statBonus', potential: 'statBonus' } },
      { label: 'Time Restriction',weight: 2, statBonusGrants: { powerMastery: 'statBonus', energyLevel: 'statBonus' } },
    ],
    vow: [
      { label: 'Blood Vow',  weight: 5, statBonusGrants: { powerMastery: 'statBonus', fightingSkill: 'statBonus', durability: 'statPenalty' } },
      { label: 'Soul Vow',   weight: 3, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus', energyLevel: 'statBonus' } },
      { label: 'Public Vow', weight: 2, statBonusGrants: { powerMastery: 'statBonus', charisma: 'statBonus' } },
    ],
  },
  synergyFlavor: 'Nen Specialist — drawbacks become advantages.',
})

// ── DRAGON × archetype ───────────────────────────────────────────────────
registerMutation('Dragon', 'Necromancer', {
  // Catastrophe-coded Dragon Sorcerer
  wheelOverrides: {
    lineage: [
      { label: 'Catastrophe Line',weight: 5, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus', energyLevel: 'statBonus' } },
      { label: 'Elder Wyrm',      weight: 3, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus', iq: 'statBonus' } },
      { label: 'Primal Drake',    weight: 2, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus', potential: 'statBonus', energyLevel: 'statBonus' } },
    ],
    catastrophe: [
      { label: 'Sky-Cracker', weight: 5, statBonusGrants: { strength: 'statBonus', powerMastery: 'statBonus', energyLevel: 'statBonus' } },
      { label: 'World-Ender', weight: 2, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', powerMastery: 'statBonus', energyLevel: 'statBonus', fightingSkill: 'statBonus' } },
      { label: 'Stirring',    weight: 2, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus' } },
    ],
  },
  secretEventBias: 1.4,
})

// ── ELDRITCH × archetype ─────────────────────────────────────────────────
registerMutation('Eldritch Being', 'Warlock', {
  // Eldritch + Warlock = Reality Fracture biased + secret events nearly
  // guaranteed.
  wheelOverrides: {
    realityFracture: [
      { label: 'Cracked',             weight: 4, statBonusGrants: { powerMastery: 'statBonus', iq: 'statBonus' } },
      { label: 'Bleeding',            weight: 4, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus', charisma: 'statPenalty' } },
      { label: 'Glitched',            weight: 3, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus', iq: 'statBonus' } },
      { label: 'Architecture Broken', weight: 2, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus', energyLevel: 'statBonus', iq: 'statBonus' } },
      { label: 'Stable',              weight: 1 },
    ],
  },
  secretEventBias: 2.0,
  synergyFlavor: 'Warlock of the Unspeakable — reality fractures around them.',
})

// ── ANGEL × archetype ────────────────────────────────────────────────────
registerMutation('Angel', 'Paladin', {
  wheelOverrides: {
    choir: [
      { label: 'Seraphim',  weight: 4, statBonusGrants: { powerMastery: 'statBonus', charisma: 'statBonus', fightingSkill: 'statBonus' } },
      { label: 'Principal', weight: 2, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus', fightingSkill: 'statBonus', charisma: 'statBonus', iq: 'statBonus' } },
      { label: 'Cherubim',  weight: 3, statBonusGrants: { durability: 'statBonus', fightingSkill: 'statBonus' } },
      { label: 'Thrones',   weight: 2, statBonusGrants: { powerMastery: 'statBonus', potential: 'statBonus', iq: 'statBonus' } },
    ],
    divineDuty: [
      { label: 'Executor', weight: 5, statBonusGrants: { strength: 'statBonus', fightingSkill: 'statBonus', powerMastery: 'statBonus' } },
      { label: 'Warrior',  weight: 4, statBonusGrants: { fightingSkill: 'statBonus', strength: 'statBonus' } },
      { label: 'Judge',    weight: 2, statBonusGrants: { iq: 'statBonus', fightingSkill: 'statBonus', charisma: 'statBonus' } },
    ],
  },
})

// ── HOLLOW/ARRANCAR × archetype ──────────────────────────────────────────
registerMutation('Hollow / Arrancar', 'Demon Slayer', {
  wheelOverrides: {
    mask: [
      { label: 'Fragment Only', weight: 4, statBonusGrants: { powerMastery: 'statBonus', fightingSkill: 'statBonus', speed: 'statBonus', iq: 'statBonus' } },
      { label: 'Half Mask',     weight: 4, statBonusGrants: { powerMastery: 'statBonus', fightingSkill: 'statBonus', iq: 'statBonus' } },
      { label: 'Vasto Lorde',   weight: 1, statBonusGrants: { strength: 'statBonus', durability: 'statBonus', fightingSkill: 'statBonus', powerMastery: 'statBonus', iq: 'statBonus' } },
    ],
  },
})

registerMutation('Creator', 'Mage', {
  // Strategist Creator goes Order-heavy + biases towards Override Caps.
  wheelOverrides: {
    realityLaw: [
      { label: 'Override Caps',    weight: 4, description: 'Stat caps disabled.' },
      { label: 'No Weaknesses',    weight: 3 },
      { label: 'Original Pattern', weight: 2 },
      { label: 'Doubled Powers',   weight: 2 },
      { label: 'Merged Stats',     weight: 1 },
    ],
    creationDomain: [
      { label: 'Order',  weight: 6 },
      { label: 'Time',   weight: 3 },
      { label: 'Cosmos', weight: 2 },
      { label: 'Life',   weight: 1 },
      { label: 'Chaos',  weight: 1 },
    ],
  },
  secretEventBias: 1.4,
  synergyFlavor: 'Architect Creator — bends the laws of being.',
})

