// Shared landing-celebration color + intensity resolver. Used by both the
// main game page and Story Mode so the wheel's celebration overlay reads the
// same regardless of host. Looks up the landed label in the right content
// pool based on spin category, then maps element → ELEMENT_COLORS and grade
// → intensity ladder. Returns null fields when no resolution is possible so
// the wheel can fall back to its default tier-based intensity.

import { powers as powersPool } from '$lib/content/powers'
import { weapons as weaponsPool } from '$lib/content/weapons'
import { armors as armorsPool } from '$lib/content/armors'
import { enchantments as enchantmentsPool } from '$lib/content/enchantments'
import { racePoolLookup, abilityLookup } from '$lib/content/races'
import { ELEMENT_COLORS, ITEM_GRADE_INFO } from '$lib/content/elements'
import type { ElementType, ItemGrade } from '$lib/content/types'

// Built once per process. These cover power/weapon/armor/enchantment label
// → element/grade lookups. Race subtype/class and ability lookups live in
// races.ts where they're auto-merged with archetype data.
const _powerLookup    = new Map(powersPool.map(p => [p.label, p]))
const _weaponLookup   = new Map(weaponsPool.map(w => [w.label, w]))
const _armorLookup    = new Map(armorsPool.map(a => [a.label, a]))
const _enchantLookup  = new Map(enchantmentsPool.map(e => [e.label, e]))

// ItemGrade → celebration intensity (0..1). F-tier sits at the noise floor;
// God maxes out the mythic tier so the banner + sustained shockwave fire.
// Tuned so SS, SSS, God all pass the 0.85 mythic threshold — those should
// always feel huge regardless of whether the item also carries a TierGrade.
const _GRADE_INTENSITY: Record<ItemGrade, number> = {
  F: 0.05, E: 0.20, D: 0.35, C: 0.45, B: 0.55,
  A: 0.65, S: 0.75, SS: 0.85, SSS: 0.92, God: 1.0,
}

export interface LandingResolution {
  tier?: string | null
  tierColor?: string | null
  elementColor?: string | null
  intensityOverride?: number
}

export function resolveLandingForCategory(
  category: string | undefined,
  label: string,
): LandingResolution {
  let element: ElementType | undefined
  let grade: ItemGrade | undefined

  switch (category) {
    case 'power': {
      const m = _powerLookup.get(label)
      element = m?.element; grade = m?.grade
      break
    }
    case 'weapon': {
      const m = _weaponLookup.get(label)
      element = m?.element; grade = m?.grade
      break
    }
    case 'armor': {
      const m = _armorLookup.get(label)
      element = m?.element; grade = m?.grade
      break
    }
    case 'weaponEnchantment':
    case 'armorEnchantment': {
      const m = _enchantLookup.get(label)
      element = m?.element; grade = m?.grade
      break
    }
    case 'raceSubType':
    case 'raceClass':
    case 'raceTransformation': {
      const m = racePoolLookup.get(label)
      element = m?.element; grade = m?.grade
      break
    }
    case 'racialAbility':
    case 'archetypeAbility': {
      const m = abilityLookup.get(label)
      element = m?.element; grade = m?.grade
      break
    }
  }

  const elementColor = element ? ELEMENT_COLORS[element] : null
  // For item-style spins the grade is the rarity. Stat spins land tier on the
  // segment itself and SpinWheel reads it directly — we leave tierColor null
  // there so the wheel's default tier color path runs.
  const intensityOverride = grade ? _GRADE_INTENSITY[grade] : undefined
  const gradeColor = grade ? ITEM_GRADE_INFO[grade]?.color : null
  return {
    tierColor: gradeColor ?? null,
    elementColor,
    intensityOverride,
  }
}
