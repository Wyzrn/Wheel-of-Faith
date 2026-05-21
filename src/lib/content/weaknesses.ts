// weaknesses.ts — Elemental weakness pool for Wheel of Fate.
// Each weakness corresponds to one of the 22 ElementTypes.
// In battle: attacker's move element matching a defender's weakness → +25% damage.
// Races with weaknessCount: 0 are immune to all weaknesses (no spins).
// No default export. No functions. Static const array only.

import type { Weakness } from './types'

export const weaknesses: Weakness[] = [
  { label: 'Weakness to Fire',      weight: 10, severe: true, element: 'Fire'      },
  { label: 'Weakness to Ice',       weight: 10, severe: true, element: 'Ice'       },
  { label: 'Weakness to Lightning', weight: 10, severe: true, element: 'Lightning' },
  { label: 'Weakness to Earth',     weight:  8, severe: true, element: 'Earth'     },
  { label: 'Weakness to Wind',      weight:  8, severe: true, element: 'Wind'      },
  { label: 'Weakness to Shadow',    weight:  9, severe: true, element: 'Shadow'    },
  { label: 'Weakness to Light',     weight:  9, severe: true, element: 'Light'     },
  { label: 'Weakness to Arcane',    weight:  8, severe: true, element: 'Arcane'    },
  { label: 'Weakness to Nature',    weight:  7, severe: true, element: 'Nature'    },
  { label: 'Weakness to Void',      weight:  7, severe: true, element: 'Void'      },
  { label: 'Weakness to Cosmic',    weight:  5, severe: true, element: 'Cosmic'    },
  { label: 'Weakness to Blood',     weight:  8, severe: true, element: 'Blood'     },
  { label: 'Weakness to Metal',     weight:  7, severe: true, element: 'Metal'     },
  { label: 'Weakness to Soul',      weight:  6, severe: true, element: 'Soul'      },
  { label: 'Weakness to Poison',    weight:  9, severe: true, element: 'Poison'    },
  { label: 'Weakness to Time',      weight:  5, severe: true, element: 'Time'      },
  { label: 'Weakness to Water',     weight:  9, severe: true, element: 'Water'     },
  { label: 'Weakness to Sound',     weight:  7, severe: true, element: 'Sound'     },
  { label: 'Weakness to Gravity',   weight:  6, severe: true, element: 'Gravity'   },
  { label: 'Weakness to Psychic',   weight:  7, severe: true, element: 'Psychic'   },
  { label: 'Weakness to Chaos',     weight:  5, severe: true, element: 'Chaos'     },
  { label: 'Weakness to Neutral',   weight:  3, severe: true, element: 'Neutral'   },
]
