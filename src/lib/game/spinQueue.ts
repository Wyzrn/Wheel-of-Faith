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
  | 'weapon'
  | 'weaponMastery'
  | 'weaponEnchantment'
  | 'potential'
  | 'energyLevel'
  | 'weakness'
  | 'redemptionSpin'
  | 'title'

export interface SpinDefinition {
  category: SpinCategory
  displayName: string // shown in "Next: {displayName}" header (D-02)
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
    { category: 'race',              displayName: 'Race'               },
    // racialAbility slots spliced here after Race lands (count = race.abilitySpinCount)
    { category: 'archetype',         displayName: 'Archetype'          },
    // archetypeAbility slots spliced here after Archetype lands (count = archetype.abilitySpinCount)
    { category: 'backstory',         displayName: 'Backstory'          },
    { category: 'height',            displayName: 'Height'             },
    { category: 'strength',          displayName: 'Strength'           },
    { category: 'speed',             displayName: 'Speed'              },
    { category: 'agility',           displayName: 'Agility'            },
    { category: 'durability',        displayName: 'Durability'         },
    { category: 'iq',                displayName: 'IQ'                 },
    { category: 'charisma',          displayName: 'Charisma'           },
    { category: 'fightingSkill',     displayName: 'Fighting Skill'     },
    { category: 'power',             displayName: 'Power'              },
    { category: 'powerMastery',      displayName: 'Power Mastery'      },
    { category: 'weapon',            displayName: 'Weapon'             },
    { category: 'weaponMastery',     displayName: 'Weapon Mastery'     },
    { category: 'weaponEnchantment', displayName: 'Weapon Enchantment' },
    { category: 'potential',         displayName: 'Potential'          },
    { category: 'energyLevel',       displayName: 'Energy Level'       },
    { category: 'weakness',          displayName: 'Weakness'           },
    { category: 'redemptionSpin',    displayName: 'Redemption Spin'    },
    { category: 'title',             displayName: 'Title'              },
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

    case 'redemptionSpin':
      // Placeholder until Plan 02-04 wires the redemption probability wheel.
      return [
        { label: 'Redemption',    weight: 1 },
        { label: 'No Redemption', weight: 1 },
      ]

    case 'title':
      return titles as WeightedSegment[]

    default:
      // Unknown category — return empty array, no throw
      return []
  }
}
