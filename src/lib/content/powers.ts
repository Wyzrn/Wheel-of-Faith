// powers.ts — Powers content pool for Wheel of Fate.
// 1,000+ SimpleItem entries split across two sub-files and merged here.
// Export: const powers (merged array, total 1,000+)

import type { SimpleItem } from './types'
import { epicPowers } from './powers-epic'
import { absurdPowers } from './powers-absurd'
import { _registerPowersForLookup } from './races'

export const powers: SimpleItem[] = [...epicPowers, ...absurdPowers]

// Seed races.ts's global-powers lookup so racePowerLookup can inherit
// element/grade by label for any race-pooled power that didn't supply
// its own. Safe to run after both modules finish initializing — the
// races powerLookup map updates in place on first read.
_registerPowersForLookup(powers)
