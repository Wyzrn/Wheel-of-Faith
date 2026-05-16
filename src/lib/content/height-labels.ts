// height-labels.ts — Height content pool for Wheel of Fate.
// SimpleItem[] — no tier system; height is cosmetic/narrative, not scored.
// Weights vary slightly; flavor entries are comedic extremes.
// No default export. No functions. Static const array only.

import type { SimpleItem } from './types'

export const heightLabels: SimpleItem[] = [
  { label: "4'11\"",  weight: 3,  description: 'Petite — but mighty, apparently' },
  { label: "5'0\"",   weight: 4,  description: 'Just cleared the rollercoaster minimum' },
  { label: "5'1\"",   weight: 5,  description: 'Average in some very specific countries' },
  { label: "5'2\"",   weight: 6,  description: 'Comfortably under the radar' },
  { label: "5'3\"",   weight: 6,  description: 'Solid foundation, compact design' },
  { label: "5'4\"",   weight: 7,  description: 'Statistically average (globally)' },
  { label: "5'5\"",   weight: 8,  description: 'Right in the sweet spot' },
  { label: "5'6\"",   weight: 8,  description: 'Ideal for most doorways' },
  { label: "5'7\"",   weight: 8,  description: 'Proportionally gifted' },
  { label: "5'8\"",   weight: 7,  description: 'Universally unremarkable height' },
  { label: "5'9\"",   weight: 7,  description: 'The classic action hero measurement' },
  { label: "5'10\"",  weight: 7,  description: 'Slightly above average — noting it' },
  { label: "5'11\"",  weight: 6,  description: 'Almost six feet (they always say 6\')' },
  { label: "6'0\"",   weight: 6,  description: 'Six feet even. They will mention this.' },
  { label: "6'1\"",   weight: 5,  description: 'Enters rooms with presence' },
  { label: "6'2\"",   weight: 4,  description: 'People assume they play basketball' },
  { label: "6'3\"",   weight: 3,  description: 'Ducking under doorframes is a lifestyle' },
  { label: "6'4\"",   weight: 2,  description: 'A conversation piece at every gathering' },
  { label: "6'5\"",   weight: 2,  description: 'Structurally alarming to short people' },
  { label: "6'6\"",   weight: 1,  description: 'The tallest person in every room, always' },
  { label: "6'7\"",   weight: 1,  description: 'Architecture was not designed for this' },
  { label: "7'0\"",   weight: 1,  description: 'Needs a special tailor and a low bed' },
  { label: "7'6\"",   weight: 1,  description: 'Mythically tall — crowds part automatically' },
  { label: "Unknowable", weight: 1, description: 'Fluctuates. Observers disagree. Records sealed.' },
  { label: "Immeasurable", weight: 1, description: 'Instruments shrug. The tape measure retired.' },
]
