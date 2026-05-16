// spinQueue.ts — Spin queue data model and segment resolver
// Provides SpinCategory union, SpinDefinition interface, buildInitialQueue, and getSegmentsForCategory.
// No default export. Named exports only. Mirror geometry.ts multi-export structure.

import type { WeightedSegment } from '$lib/session/types'

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
// In Wave 1 all content modules are stubs returning [].
// Plan 02-02 (races, archetypes, powers, weapons, etc.) and
// Plan 02-03 (stat flavor labels) will replace these stubs with real imports.
export function getSegmentsForCategory(category: SpinCategory): WeightedSegment[] {
  switch (category) {
    case 'race':
      // TODO: replace with import from '$lib/content/races' (Plan 02-02)
      return []

    case 'racialAbility':
      // TODO: replace with import from '$lib/content/racial-abilities' (Plan 02-02)
      return []

    case 'archetype':
      // TODO: replace with import from '$lib/content/archetypes' (Plan 02-02)
      return []

    case 'archetypeAbility':
      // TODO: replace with import from '$lib/content/racial-abilities' (shared pool, Plan 02-02)
      return []

    case 'backstory':
      // TODO: replace with import from '$lib/content/backstories' (Plan 02-02)
      return []

    case 'height':
      // TODO: replace with import from '$lib/content/heights' (Plan 02-03)
      return []

    case 'strength':
      // TODO: replace with import from '$lib/content/strength-labels' (Plan 02-03)
      return []

    case 'speed':
      // TODO: replace with import from '$lib/content/speed-labels' (Plan 02-03)
      return []

    case 'agility':
      // TODO: replace with import from '$lib/content/agility-labels' (Plan 02-03)
      return []

    case 'durability':
      // TODO: replace with import from '$lib/content/durability-labels' (Plan 02-03)
      return []

    case 'iq':
      // TODO: replace with import from '$lib/content/iq-labels' (Plan 02-03)
      return []

    case 'charisma':
      // TODO: replace with import from '$lib/content/charisma-labels' (Plan 02-03)
      return []

    case 'fightingSkill':
      // TODO: replace with import from '$lib/content/fighting-skill-labels' (Plan 02-03)
      return []

    case 'power':
      // TODO: replace with import from '$lib/content/powers' (Plan 02-02)
      return []

    case 'powerMastery':
      // TODO: replace with import from '$lib/content/power-mastery-labels' (Plan 02-03)
      return []

    case 'weapon':
      // TODO: replace with import from '$lib/content/weapons' (Plan 02-02)
      return []

    case 'weaponMastery':
      // TODO: replace with import from '$lib/content/weapon-mastery-labels' (Plan 02-03)
      return []

    case 'weaponEnchantment':
      // TODO: replace with import from '$lib/content/enchantments' (Plan 02-02)
      return []

    case 'potential':
      // TODO: replace with import from '$lib/content/potential-labels' (Plan 02-03)
      return []

    case 'energyLevel':
      // TODO: replace with import from '$lib/content/energy-level-labels' (Plan 02-03)
      return []

    case 'weakness':
      // TODO: replace with import from '$lib/content/weaknesses' (Plan 02-02)
      return []

    case 'redemptionSpin':
      // TODO: replace with redemption probability wheel segments (Plan 02-04)
      return []

    case 'title':
      // TODO: replace with import from '$lib/content/titles' (Plan 02-02)
      return []

    default:
      // Unknown category — return empty array, no throw
      return []
  }
}
