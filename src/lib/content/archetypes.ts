// archetypes.ts — Archetype content data for Wheel of Fate.
// 15+ Archetype entries with weight and abilitySpinCount.
// No default export. No functions. Static const array only.

import type { Archetype } from './types'

export const archetypes: Archetype[] = [
  {
    label: 'Warrior',
    weight: 1,
    abilitySpinCount: 2,
    description: 'Solves most problems with direct application of force.',
  },
  {
    label: 'Mage',
    weight: 1,
    abilitySpinCount: 3,
    description: 'Bends reality via intensive study and questionable decisions.',
  },
  {
    label: 'Rogue',
    weight: 1,
    abilitySpinCount: 2,
    description: 'Prefers to work in the shadows, usually for unclear reasons.',
  },
  {
    label: 'Paladin',
    weight: 1,
    abilitySpinCount: 2,
    description: 'Divine warrior who will remind you of their oaths unbidden.',
  },
  {
    label: 'Ranger',
    weight: 1,
    abilitySpinCount: 2,
    description: 'At home in the wilderness. Suspicious of architecture.',
  },
  {
    label: 'Berserker',
    weight: 1,
    abilitySpinCount: 1,
    description: 'Combat strategy: rage. Follow-up strategy: also rage.',
  },
  {
    label: 'Necromancer',
    weight: 1,
    abilitySpinCount: 3,
    description: 'Death is just a resource management problem.',
  },
  {
    label: 'Bard',
    weight: 1,
    abilitySpinCount: 2,
    description: 'Weaponises music, poetry, and audacity.',
  },
  {
    label: 'Monk',
    weight: 1,
    abilitySpinCount: 2,
    description: 'Inner peace achieved through punching things.',
  },
  {
    label: 'Druid',
    weight: 1,
    abilitySpinCount: 3,
    description: 'Nature\'s spokesperson. Takes the role very seriously.',
  },
  {
    label: 'Artificer',
    weight: 1,
    abilitySpinCount: 2,
    description: 'Builds magical gadgets. Safety is a suggestion.',
  },
  {
    label: 'Warlock',
    weight: 1,
    abilitySpinCount: 3,
    description: 'Made a deal with something ancient. Didn\'t read the fine print.',
  },
  {
    label: 'Sorcerer',
    weight: 1,
    abilitySpinCount: 4,
    description: 'Magic runs in the blood. Mostly uncontrolled. Usually fine.',
  },
  {
    label: 'Cleric',
    weight: 1,
    abilitySpinCount: 2,
    description: 'Divine conduit. God\'s chosen errand-runner.',
  },
  {
    label: 'Middle Manager',
    weight: 1,
    abilitySpinCount: 1,
    description: 'Wields passive-aggression and passive-aggressive meeting invites.',
  },
  {
    label: 'Professional Sneezer',
    weight: 1,
    abilitySpinCount: 1,
    description: 'Specialised beyond all reason. Somehow rated highly on Yelp.',
  },
  {
    label: 'Chaos Gremlin',
    weight: 1,
    abilitySpinCount: 2,
    description: 'No plan. No fear. Somehow winning.',
  },
]
