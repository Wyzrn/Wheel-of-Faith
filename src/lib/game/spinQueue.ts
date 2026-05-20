// spinQueue.ts — Spin queue data model and segment resolver
// Provides SpinCategory union, SpinDefinition interface, buildInitialQueue, and getSegmentsForCategory.
// No default export. Named exports only. Mirror geometry.ts multi-export structure.

import type { WeightedSegment } from '$lib/session/types'

// Content imports — stat flavor labels (Plan 02-03)
import { strengthLabels }    from '$lib/content/strength-labels'
import { speedLabels }       from '$lib/content/speed-labels'
import { agilityLabels }     from '$lib/content/agility-labels'
import { durabilityLabels }  from '$lib/content/durability-labels'
import { iqLabels }          from '$lib/content/iq-labels'
import { charismaLabels }    from '$lib/content/charisma-labels'
import { fightingSkillLabels } from '$lib/content/fighting-skill-labels'
import { powerMasteryLabels } from '$lib/content/power-mastery-labels'
import { weaponMasteryLabels } from '$lib/content/weapon-mastery-labels'
import { potentialLabels }   from '$lib/content/potential-labels'
import { energyLevelLabels } from '$lib/content/energy-level-labels'
import { heightLabels }      from '$lib/content/height-labels'

// Content imports — races, archetypes, items (Plans 02-02)
import { races as _races } from '$lib/content/races'
const races = [..._races].sort((a, b) => b.weight - a.weight)
import { archetypes }  from '$lib/content/archetypes'
import { powers }      from '$lib/content/powers'
import { weapons }     from '$lib/content/weapons'
import { weaknesses }  from '$lib/content/weaknesses'
import { backstories } from '$lib/content/backstories'
import { titles }      from '$lib/content/titles'
import { enchantments } from '$lib/content/enchantments'
import { armors } from '$lib/content/armors'
import { armorStrengthLabels } from '$lib/content/armor-strength-labels'

// Redemption outcomes — spun when the redemptionSpin lands on 'Redemption'.
// Rare/powerful outcomes have lower weight; fun/mild ones are more common.
const REDEMPTION_OUTCOMES: WeightedSegment[] = [
  { label: 'Reroll Your Worst Stat', weight: 3 },
  { label: 'Gain a Bonus Power', weight: 3 },
  { label: 'Lose One Weakness', weight: 3 },
  { label: 'Plot Armour (Permanent)', weight: 3 },
  { label: 'Free Power Reroll', weight: 3 },
  { label: 'Your Weakness Becomes a Strength (Somehow)', weight: 2 },
  { label: 'Immunity to Your Own Weaknesses', weight: 2 },
  { label: 'Swap Race Abilities (Narrator Chooses)', weight: 2 },
  { label: 'All Stats +1 Tier', weight: 1 },
  { label: 'Stat of Your Choice: S Tier', weight: 1 },
  { label: 'Bonus Archetype Ability', weight: 2 },
  { label: 'Secret Fourth Racial Ability', weight: 1 },
  { label: 'Double Your Best Stat', weight: 1 },
  { label: 'God Tier Potential (One Use)', weight: 1 },
  { label: 'Demigod Status (Unofficial)', weight: 1 },
  { label: 'Free God Tier Strength', weight: 1 },
  { label: 'Retroactive Legendary Race Upgrade', weight: 1 },
  { label: 'The Universe Owes You One', weight: 1 },
  { label: 'The DM Sighs and Gives You One Thing You Want', weight: 1 },
  { label: 'Reroll Everything (Chaos Edition)', weight: 1 },
]

// Corruption reveal pool — spun when corruptionScore hits threshold after Title.
const CORRUPTION_REVEAL_OUTCOMES: WeightedSegment[] = [
  { label: 'Lich Ascension',          weight: 2 },
  { label: 'Half-Demon Emergence',    weight: 3 },
  { label: 'Void-Touched',            weight: 3 },
  { label: 'Cursed Champion',         weight: 4 },
  { label: 'Dark God Candidate',      weight: 2 },
  { label: 'Shadow Soul',             weight: 4 },
  { label: 'Undying Revenant',        weight: 3 },
  { label: 'Infernal Pact Sealed',    weight: 3 },
  { label: 'Corruption: Consumed',    weight: 1 },
]

// Possession strength pool — used when the Possessed archetype lands.
// Higher possession = more stat grants applied in +page.svelte POSSESSION_GRANTS lookup.
const POSSESSION_STRENGTH_POOL: WeightedSegment[] = [
  { label: 'Barely a Whisper (5%)',        weight: 4 },
  { label: 'A Flicker of Influence (20%)', weight: 3 },
  { label: 'Shared Consciousness (40%)',   weight: 2 },
  { label: 'Dominant Presence (60%)',      weight: 2 },
  { label: 'Consuming Takeover (80%)',     weight: 1 },
  { label: 'Full Possession (100%)',       weight: 1 },
]

// Shared ability pool for racialAbility and archetypeAbility slots.
// Used until a dedicated racial-abilities content module is authored.
// All entries weight 1 for uniform draw probability.
const GENERAL_ABILITY_POOL: WeightedSegment[] = [
  { label: 'Enhanced Senses',          weight: 1, element: 'Nature', grade: 'C' },
  { label: 'Regeneration',             weight: 1, element: 'Nature', grade: 'C' },
  { label: 'Elemental Affinity',       weight: 1, element: 'Arcane', grade: 'C' },
  { label: 'Telepathic Whisper',       weight: 1, element: 'Psychic', grade: 'B' },
  { label: 'Shadow Step',              weight: 1, element: 'Shadow', grade: 'B' },
  { label: 'Iron Skin',                weight: 1, element: 'Earth', grade: 'C' },
  { label: 'Berserk Surge',            weight: 1, element: 'Chaos', grade: 'C' },
  { label: 'Arcane Pulse',             weight: 1, element: 'Arcane', grade: 'C' },
  { label: 'Venomous Touch',           weight: 1, element: 'Poison', grade: 'B' },
  { label: 'Gravity Shift',            weight: 1, element: 'Gravity', grade: 'B' },
  { label: 'Time Fracture',            weight: 1, element: 'Time', grade: 'A' },
  { label: 'Soul Drain',               weight: 1, element: 'Soul', grade: 'B' },
  { label: 'Divine Ward',              weight: 1, element: 'Light', grade: 'B' },
  { label: 'Dimensional Anchor',       weight: 1, element: 'Void', grade: 'B' },
  { label: 'Molecular Control',        weight: 1, element: 'Arcane', grade: 'A' },
]

export type SpinCategory =
  | 'race'
  | 'raceSubType'
  | 'raceClass'
  | 'raceTransformation'
  | 'racialAbility'
  | 'archetype'
  | 'archetypeAbility'
  | 'backstory'
  | 'height'
  | 'strength'
  | 'speed'
  | 'agility'
  | 'durability'
  | 'iq'
  | 'charisma'
  | 'fightingSkill'
  | 'power'
  | 'powerMastery'
  | 'weaponType'
  | 'weapon'
  | 'weaponMastery'
  | 'weaponEnchantment'
  | 'potential'
  | 'energyLevel'
  | 'weakness'
  | 'statBonus'
  | 'statPenalty'
  | 'redemptionSpin'
  | 'redemptionOutcome'
  | 'title'
  | 'possessionRace'
  | 'possessionStrength'
  | 'devilFruitName'
  | 'armorType'
  | 'armor'
  | 'armorStrength'
  | 'armorEnchantment'
  | 'gender'
  | 'corruptionReveal'

export interface SpinDefinition {
  category: SpinCategory
  displayName: string  // shown in "Next: {displayName}" header (D-02)
  isSentinel?: boolean // true only on the initial weakness spin; spliced weakness spins omit this
  targetStat?: string  // for statBonus/statPenalty spins: which stat category this bonus modifies
  useRacialPowerPool?: boolean  // if true, power spin draws from activePowerPool instead of global pool
  isReroll?: boolean   // if true, this spin replaces an existing result of the same category
}

// Returns the initial queue of 22 fixed spin definitions.
// No racial ability or archetype ability slots — those are spliced in at runtime
// after Race and Archetype land respectively (D-10, CORE-03).
//
// Queue order from RESEARCH.md Pattern 1:
// Race → Archetype → Backstory → Height → Strength → Speed → Agility → Durability
// → IQ → Charisma → FightingSkill → Power → PowerMastery → Weapon → WeaponMastery
// → WeaponEnchantment → Potential → EnergyLevel → Weakness → RedemptionSpin → Title
// = 21 fixed categories + 1 for a total of 22 (ability slots expand dynamically)
export function buildInitialQueue(): SpinDefinition[] {
  return [
    { category: 'race',          displayName: 'Race'          },
    // raceSubType spliced here if race has subTypePool
    // racialAbility slots spliced here (count = race.abilitySpinCount)
    // weakness slots spliced here (count = race.weaknessCount or derived)
    { category: 'archetype',     displayName: 'Archetype'     },
    // archetypeAbility slots spliced here (count = archetype.abilitySpinCount)
    { category: 'backstory',     displayName: 'Backstory'     },
    // bonus stat spin spliced here if backstory has bonusSpin
    { category: 'height',        displayName: 'Height'        },
    { category: 'gender',        displayName: 'Gender'        },
    { category: 'strength',      displayName: 'Strength'      },
    { category: 'speed',         displayName: 'Speed'         },
    { category: 'agility',       displayName: 'Agility'       },
    { category: 'durability',    displayName: 'Durability'    },
    { category: 'iq',            displayName: 'IQ'            },
    { category: 'charisma',      displayName: 'Charisma'      },
    { category: 'fightingSkill', displayName: 'Fighting Skill'},
    { category: 'power',         displayName: 'Power'         },
    { category: 'powerMastery',  displayName: 'Power Mastery' },
    { category: 'weaponType',    displayName: 'Weapon Type'   },
    { category: 'weapon',        displayName: 'Weapon'        },
    { category: 'weaponMastery', displayName: 'Weapon Mastery'},
    // weaponEnchantment spliced here if weaponMastery tier >= C-
    { category: 'armorType',     displayName: 'Armor Type'    },
    { category: 'armor',         displayName: 'Armor'         },
    { category: 'armorStrength', displayName: 'Armor Strength'},
    // armorEnchantment spliced here if armorStrength tier >= C-
    { category: 'potential',     displayName: 'Potential'     },
    { category: 'energyLevel',   displayName: 'Energy Level'  },
    { category: 'redemptionSpin',displayName: 'Redemption Spin'},
    { category: 'title',         displayName: 'Title'         },
    // bonus stat spin spliced here if title has bonusSpin
  ]
}

// Resolves the segments array for a given category.
// All stat labels and item pools are wired to real content modules.
// racialAbility and archetypeAbility use GENERAL_ABILITY_POOL until
// a dedicated racial-abilities module is authored.
// redemptionSpin uses a placeholder until Plan 02-04.
export function getSegmentsForCategory(category: SpinCategory): WeightedSegment[] {
  switch (category) {
    case 'race':
      return races as WeightedSegment[]

    case 'raceSubType':
      // Fallback; actual pool resolved in +page.svelte from race.subTypePool
      return [{ label: 'Standard Variant', weight: 1 }]

    case 'raceClass':
      // Fallback; actual pool resolved in +page.svelte from race.classPool
      return [{ label: 'Standard Class', weight: 1 }]

    case 'raceTransformation':
      // Fallback; actual pool resolved in +page.svelte from race.transformationPool
      return [{ label: 'Base Form', weight: 1 }]

    case 'racialAbility':
      return GENERAL_ABILITY_POOL

    case 'archetype':
      return archetypes as WeightedSegment[]

    case 'archetypeAbility':
      return GENERAL_ABILITY_POOL

    case 'backstory':
      return backstories as WeightedSegment[]

    case 'height':
      return heightLabels as WeightedSegment[]

    case 'strength':
      return strengthLabels as WeightedSegment[]

    case 'speed':
      return speedLabels as WeightedSegment[]

    case 'agility':
      return agilityLabels as WeightedSegment[]

    case 'durability':
      return durabilityLabels as WeightedSegment[]

    case 'iq':
      return iqLabels as WeightedSegment[]

    case 'charisma':
      return charismaLabels as WeightedSegment[]

    case 'fightingSkill':
      return fightingSkillLabels as WeightedSegment[]

    case 'power':
      return powers as WeightedSegment[]

    case 'powerMastery':
      return powerMasteryLabels as WeightedSegment[]

    case 'weaponType':
      return [
        { label: 'None',    weight: 5 },
        { label: 'Melee',   weight: 8 },
        { label: 'Ranged',  weight: 6 },
        { label: 'Magical', weight: 4 },
        { label: 'Exotic',  weight: 3 },
        { label: 'Cursed',  weight: 2 },
        { label: 'Ancient', weight: 2 },
      ]

    case 'armorType':
      return [
        { label: 'None',        weight: 4 },
        { label: 'Helmet Only', weight: 8 },
        { label: 'Half-Suit',   weight: 6 },
        { label: 'Full-Suit',   weight: 5 },
        { label: 'Exotic',      weight: 4 },
        { label: 'Cursed',      weight: 2 },
        { label: 'Ancient',     weight: 2 },
      ]

    case 'weapon':
      return weapons as WeightedSegment[]

    case 'weaponMastery':
      return weaponMasteryLabels as WeightedSegment[]

    case 'weaponEnchantment':
      return enchantments as WeightedSegment[]

    case 'armor':
      // Fallback; actual pool filtered by armorType in +page.svelte
      return armors as WeightedSegment[]

    case 'armorStrength':
      return armorStrengthLabels as WeightedSegment[]

    case 'armorEnchantment':
      return enchantments as WeightedSegment[]

    case 'gender':
      return [
        { label: 'Male',   weight: 1 },
        { label: 'Female', weight: 1 },
      ]

    case 'potential':
      return potentialLabels as WeightedSegment[]

    case 'energyLevel':
      return energyLevelLabels as WeightedSegment[]

    case 'weakness':
      return weaknesses as WeightedSegment[]

    case 'statBonus':
      // Actual segments imported from stat-bonus content; resolved in +page.svelte
      return [
        { label: '+1', weight: 15 }, { label: '+2', weight: 12 }, { label: '+3', weight: 9 },
        { label: '+4', weight: 7 },  { label: '+5', weight: 5 },  { label: '+6', weight: 4 },
        { label: '+7', weight: 3 },  { label: '+8', weight: 2 },  { label: '+10', weight: 2 },
        { label: '+12', weight: 1 }, { label: '+15', weight: 1 }, { label: '+20', weight: 1 },
      ]

    case 'statPenalty':
      return [
        { label: '-1', weight: 15 }, { label: '-2', weight: 12 }, { label: '-3', weight: 9 },
        { label: '-4', weight: 7 },  { label: '-5', weight: 5 },  { label: '-7', weight: 4 },
        { label: '-10', weight: 3 }, { label: '-12', weight: 2 }, { label: '-15', weight: 1 },
        { label: '-20', weight: 1 },
      ]

    case 'redemptionSpin':
      // Redemption is rare (~25%); most spins yield no redemption
      return [
        { label: 'Redemption',    weight: 1 },
        { label: 'No Redemption', weight: 3 },
      ]

    case 'redemptionOutcome':
      return REDEMPTION_OUTCOMES

    case 'title':
      return titles as WeightedSegment[]

    case 'possessionRace':
      // Which entity/race is possessing the character — draws from the full race pool
      return races as WeightedSegment[]

    case 'possessionStrength':
      return POSSESSION_STRENGTH_POOL

    case 'devilFruitName':
      // Fallback; actual pool resolved in +page.svelte from DEVIL_FRUIT_POOLS[raceClass]
      return [{ label: 'Unknown Devil Fruit', weight: 1 }]

    case 'corruptionReveal':
      return CORRUPTION_REVEAL_OUTCOMES

    default:
      // Unknown category — return empty array, no throw
      return []
  }
}
