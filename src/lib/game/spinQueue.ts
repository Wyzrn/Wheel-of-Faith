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
import { races }       from '$lib/content/races'
import { archetypes }  from '$lib/content/archetypes'
import { powers }      from '$lib/content/powers'
import { weapons }     from '$lib/content/weapons'
import { weaknesses }  from '$lib/content/weaknesses'
import { backstories } from '$lib/content/backstories'
import { titles }      from '$lib/content/titles'
import { enchantments } from '$lib/content/enchantments'

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

// Shared ability pool for racialAbility and archetypeAbility slots.
// Used until a dedicated racial-abilities content module is authored.
// All entries weight 1 for uniform draw probability.
const GENERAL_ABILITY_POOL: WeightedSegment[] = [
  { label: 'Enhanced Senses',          weight: 1 },
  { label: 'Regeneration',             weight: 1 },
  { label: 'Elemental Affinity',       weight: 1 },
  { label: 'Telepathic Whisper',       weight: 1 },
  { label: 'Shadow Step',              weight: 1 },
  { label: 'Iron Skin',                weight: 1 },
  { label: 'Berserk Surge',            weight: 1 },
  { label: 'Arcane Pulse',             weight: 1 },
  { label: 'Venomous Touch',           weight: 1 },
  { label: 'Gravity Shift',            weight: 1 },
  { label: 'Time Fracture',            weight: 1 },
  { label: 'Soul Drain',               weight: 1 },
  { label: 'Divine Ward',              weight: 1 },
  { label: 'Dimensional Anchor',       weight: 1 },
  { label: 'Molecular Control',        weight: 1 },
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

export interface SpinDefinition {
  category: SpinCategory
  displayName: string  // shown in "Next: {displayName}" header (D-02)
  isSentinel?: boolean // true only on the initial weakness spin; spliced weakness spins omit this
  targetStat?: string  // for statBonus/statPenalty spins: which stat category this bonus modifies
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
        { label: 'Melee',  weight: 4 },
        { label: 'Ranged', weight: 3 },
        { label: 'Magic',  weight: 2 },
        { label: 'Exotic', weight: 1 },
      ]

    case 'weapon':
      return weapons as WeightedSegment[]

    case 'weaponMastery':
      return weaponMasteryLabels as WeightedSegment[]

    case 'weaponEnchantment':
      return enchantments as WeightedSegment[]

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

    default:
      // Unknown category — return empty array, no throw
      return []
  }
}
