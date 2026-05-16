// powers.ts — Powers content pool for Wheel of Fate.
// 1,000+ SimpleItem entries split across two sub-files and merged here.
// Export: const powers (merged array, total 1,000+)

import type { SimpleItem } from './types'
import { epicPowers } from './powers-epic'
import { absurdPowers } from './powers-absurd'

export const powers: SimpleItem[] = [...epicPowers, ...absurdPowers]
