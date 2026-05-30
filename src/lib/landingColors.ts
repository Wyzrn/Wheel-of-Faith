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
import { racePoolLookup, abilityLookup, racePowerLookup, racesByLabel } from '$lib/content/races'
import { archetypesByLabel } from '$lib/content/archetypes'
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
// Tuned so S+ items hit "great", SS items hit mythic, and God always pops.
const _GRADE_INTENSITY: Record<ItemGrade, number> = {
  F: 0.05, E: 0.15, D: 0.28, C: 0.40, B: 0.55,
  A: 0.65, S: 0.75, SS: 0.85, SSS: 0.93, God: 1.0,
}

// Race rarity buckets (6-tier scheme). ONE function drives the celebration
// intensity AND the subtitle label so the animation matches the announced
// rarity. Weight bands: Divine 1 · Mythological 2 · Legendary 3-4 · Rare 5-7 ·
// Uncommon 8-11 · Common 12+. (LandingCelebration thresholds: divine ≥1.0,
// mythic ≥0.70, great ≥0.50, good ≥0.30, basic ≥0.10.)
function raceRarity(weight: number): { label: string; intensity: number } {
  if (weight <= 1) return { label: 'Divine',       intensity: 1.05 }  // divine (new top tier)
  if (weight <= 2) return { label: 'Mythological', intensity: 0.88 }  // mythic
  if (weight <= 4) return { label: 'Legendary',    intensity: 0.72 }  // mythic
  if (weight <= 7) return { label: 'Rare',         intensity: 0.55 }  // great
  if (weight <= 11) return { label: 'Uncommon',    intensity: 0.38 }  // good
  return { label: 'Common', intensity: 0.20 }                          // basic
}

// Public rarity bucket lookup so other systems (e.g. stat-bonus caps) can
// align with the same rarity tiers shown on the landing celebration.
export function raceRarityLabel(weight: number | undefined): string {
  return raceRarity(weight ?? 99).label
}

// Maximum +/- a race may shift any single stat. Higher rarity races unlock
// the bigger bonus/penalty rolls; Common races are capped at ±5 so a lucky
// stat-bonus reroll can't push a baseline race into legend territory.
// Mythological and Divine share the +20 ceiling per the design spec.
export function raceStatBonusCap(weight: number | undefined): number {
  const label = raceRarityLabel(weight)
  switch (label) {
    case 'Divine':
    case 'Mythological': return 20
    case 'Legendary':    return 15
    case 'Rare':         return 12
    case 'Uncommon':     return 8
    default:             return 5
  }
}
function archetypeRarity(weight: number): { label: string; intensity: number } {
  if (weight <= 1) return { label: 'Mythological', intensity: 0.85 }  // mythic
  if (weight <= 2) return { label: 'Legendary',    intensity: 0.60 }  // great
  if (weight <= 4) return { label: 'Rare',         intensity: 0.40 }  // good
  return { label: 'Common', intensity: 0.20 }                          // basic
}

export interface LandingResolution {
  tier?: string | null
  tierColor?: string | null
  elementColor?: string | null
  intensityOverride?: number
  // Shown under the mythic banner. For items: the grade label
  // (e.g. "Legendary"). For races/archetypes: the rarity bucket
  // ("Mythological", "Legendary", etc.). For stats: undefined (the wheel
  // falls back to the segment tier label).
  subtitle?: string | null
}

export function resolveLandingForCategory(
  category: string | undefined,
  label: string,
): LandingResolution {
  let element: ElementType | undefined
  let grade: ItemGrade | undefined
  // Weight-derived intensity for race/archetype top-level spins. Returned
  // verbatim when set; takes precedence over grade-based intensity since
  // there's no grade on the race itself.
  let weightIntensity: number | undefined

  switch (category) {
    case 'power': {
      const m = _powerLookup.get(label)
      element = m?.element; grade = m?.grade
      // Race-pooled powers (e.g. "Goblin Engine", "Spirit Guide") aren't in
      // the global powers content. Fall back to the race-aware lookup which
      // inherits element/grade from the parent class/subtype/transformation
      // when the powerPool entry itself doesn't supply them.
      if (!element && !grade) {
        const rm = racePowerLookup.get(label)
        if (rm) { element = rm.element; grade = rm.grade }
      }
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
    case 'race': {
      // Top-level race spin. No grade on the race itself, so intensity is
      // weight-driven (rarer race = bigger celebration). Use the rarest
      // element from the race's class pool as the celebration tint when
      // we can find one — gives Saiyan a Fire bias, Kryptonian a Cosmic
      // bias, etc. — falls back to a neutral gold accent.
      const race = racesByLabel.get(label)
      if (race) {
        weightIntensity = raceRarity(race.weight).intensity
        // Pull a representative element from the race's class pool if any
        // class entry carries one. We prefer the highest-grade class's
        // element so the tint reads as "the legendary class of this race."
        const classes = race.classPool ?? []
        let bestEl: ElementType | undefined
        let bestGrade: ItemGrade | undefined
        for (const c of classes) {
          if (!c.element) continue
          if (!bestGrade || _GRADE_INTENSITY[c.grade ?? 'F'] > _GRADE_INTENSITY[bestGrade]) {
            bestEl = c.element
            bestGrade = c.grade
          }
        }
        element = bestEl
      }
      break
    }
    case 'archetype': {
      const arc = archetypesByLabel.get(label)
      if (arc) weightIntensity = archetypeRarity(arc.weight).intensity
      // Archetype tint comes from its first elemental ability when present,
      // falling back to gold.
      const arcAbil = arc?.abilities?.find(a => a.element)
      if (arcAbil?.element) element = arcAbil.element
      break
    }
  }

  const elementColor = element ? ELEMENT_COLORS[element] : null
  // Intensity precedence: weight (race/archetype) > grade (items) > undefined
  // (stat spins fall through to the wheel's tier-based ladder).
  const intensityOverride =
    weightIntensity !== undefined ? weightIntensity :
    grade ? _GRADE_INTENSITY[grade] : undefined
  const gradeColor = grade ? ITEM_GRADE_INFO[grade]?.color : null

  // Subtitle: grade label for items, race/archetype rarity bucket otherwise.
  // Stat spins return undefined and SpinWheel falls back to the tier label.
  let subtitle: string | null = null
  if (category === 'race') {
    const race = racesByLabel.get(label)
    if (race) subtitle = raceRarity(race.weight).label + ' Race'
  } else if (category === 'archetype') {
    const arc = archetypesByLabel.get(label)
    if (arc) subtitle = archetypeRarity(arc.weight).label + ' Archetype'
  } else if (grade) {
    subtitle = ITEM_GRADE_INFO[grade]?.label ?? grade
  }

  // Divine-tier races (weight ≤ 1) carry a 'Divine' marker so the celebration
  // fires its dedicated top-tier effect (above transcendent).
  const divineTier = category === 'race' && (racesByLabel.get(label)?.weight ?? 99) <= 1
    ? 'Divine'
    : null

  return {
    tier: divineTier,
    tierColor: gradeColor ?? null,
    elementColor,
    intensityOverride,
    subtitle,
  }
}
