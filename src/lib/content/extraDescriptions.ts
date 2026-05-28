// extraDescriptions.ts — Generators that fill the "second-line flavour"
// for spin-result categories that the existing description generators
// don't cover (backstory, title, weapon/armor types, weapon/armor
// enchantments, race subType/class/transformation pools, weakness, and
// the limit-break wheels). Mirrors the shape of statDescriptions.ts so
// the spin-reveal modal can render rich text for every category, not
// just races + archetypes + powers + weapons + armor + stats.
//
// Pattern: each function takes a label (and optional element/grade when
// useful) and returns a short flavour sentence. Falls back to '' when
// no description applies — callers can null-check + skip.
//
// No imports of game state; pure label→string functions only.

import type { ElementType, ItemGrade } from './types'
import { backstories } from './backstories'
import { titles }      from './titles'
import { enchantments } from './enchantments'
import { racePoolLookup } from './races'

// ── Stat-bonus utility — renders a backstory/title's stat grants ─────────
// Used by backstory + title generators to surface the mechanical effect
// alongside the flavour name. "Grants +Strength, -Charisma" reads better
// than the raw object literal from the content file.
function _formatBonusGrants(grants: Record<string, string> | undefined): string {
  if (!grants) return ''
  const labels: Record<string, string> = {
    strength: 'Strength', speed: 'Speed', agility: 'Agility',
    durability: 'Durability', iq: 'IQ', charisma: 'Charisma',
    fightingSkill: 'Fighting Skill', powerMastery: 'Power Mastery',
    weaponMastery: 'Weapon Mastery', armorStrength: 'Armor Strength',
    potential: 'Potential', energyLevel: 'Energy Level',
  }
  const parts: string[] = []
  for (const [stat, sign] of Object.entries(grants)) {
    const nice = labels[stat] ?? stat
    if (sign === 'statBonus') parts.push(`+${nice}`)
    else if (sign === 'statPenalty') parts.push(`−${nice}`)
  }
  return parts.length ? parts.join(', ') : ''
}

// ── Backstory ────────────────────────────────────────────────────────────
const _backstoryByLabel = new Map(backstories.map(b => [b.label, b]))
export function generateBackstoryDescription(label: string): string {
  const item = _backstoryByLabel.get(label)
  if (!item) return 'Past trauma, present chaos. Shapes who you became — and what you can do.'
  const grants = _formatBonusGrants(item.statBonusGrants as Record<string, string> | undefined)
  if (grants) return `Past trauma, present chaos. Stat shift: ${grants}.`
  return 'Past trauma, present chaos. Shapes who you became — and what you can do.'
}

// ── Title ────────────────────────────────────────────────────────────────
const _titleByLabel = new Map(titles.map(t => [t.label, t]))
export function generateTitleDescription(label: string): string {
  const item = _titleByLabel.get(label)
  if (!item) return 'What the world calls you — earned, feared, or both. Reshapes your stat bias.'
  const grants = _formatBonusGrants(item.statBonusGrants as Record<string, string> | undefined)
  if (grants) return `Reputation that bends reality. Stat shift: ${grants}.`
  return 'What the world calls you — earned, feared, or both. Reshapes your stat bias.'
}

// ── Weapon Type ──────────────────────────────────────────────────────────
const _WEAPON_TYPE_DESCS: Record<string, string> = {
  'None':    "Empty-handed. No weapon, no flair — and a -10% physical damage tax for it.",
  'Melee':   "Up-close arsenal: blades, hammers, polearms, fists. Pure physical damage.",
  'Ranged':  "Bows, guns, throwing weapons — bypass 30% of enemy armor on every hit.",
  'Magical': "Channeled through a focus or staff — pierces 15% armor and hits 10% harder.",
  'Exotic':  "Reality-bending oddities. Damage variance is wild (±50%) — feast or famine.",
  'Cursed':  "Forbidden steel. Hits 25% harder, but the weapon usually wants something back.",
  'Ancient': "Pre-civilisational artifacts. Hits 35% harder. Was probably forged before there was a sun.",
}
export function generateWeaponTypeDescription(label: string): string {
  return _WEAPON_TYPE_DESCS[label] ?? ''
}

// ── Armor Type ───────────────────────────────────────────────────────────
const _ARMOR_TYPE_DESCS: Record<string, string> = {
  'None':        "Unprotected. No armor reduction, zero mitigation — every hit lands raw.",
  'Helmet Only': "A single piece of plate. 40% of normal armor reduction — better than nothing.",
  'Half-Suit':   "Chest + greaves coverage. 70% of normal armor reduction.",
  'Full-Suit':   "Total coverage, full damage reduction. Heaviest defensive profile available.",
  'Exotic':      "Strange-materials gear. 85% reduction with bonus elemental quirks.",
  'Cursed':      "Forbidden plate. 75% reduction. Sometimes whispers. Don't listen.",
  'Ancient':     "Pre-civilisational armor — 115% reduction. Forged before damage existed.",
}
export function generateArmorTypeDescription(label: string): string {
  return _ARMOR_TYPE_DESCS[label] ?? ''
}

// ── Weapon / Armor Enchantment ──────────────────────────────────────────
const _enchantByLabel = new Map(enchantments.map(e => [e.label, e]))
const _ELEMENT_ENCHANT_FLAVOR: Record<string, string> = {
  Fire:      "Burns the strike — leaves residual heat damage across rounds.",
  Ice:       "Freezes on contact — slows the target and shaves crit chance.",
  Lightning: "Overcharges every hit — chains to nearby enemies on connect.",
  Earth:     "Slams with weight — shockwaves stagger the target's next move.",
  Wind:      "Sharpens cuts past the metal — slices through armor weaves.",
  Shadow:    "Strikes from a place that wasn't there. Sometimes the target doesn't see.",
  Light:     "Hits like sunlight on something hiding. Burns purification into the wound.",
  Arcane:    "Inscribed runes redirect intent. Damage warps around defenses.",
  Nature:    "Grows into the strike — vines, thorns, things that shouldn't bloom in a fight.",
  Void:      "What it deletes does not come back. Including, sometimes, the wound itself.",
  Cosmic:    "Stellar resonance — every hit carries the weight of distant suns.",
  Blood:     "Feeds on the wound — restores life to the wielder on impact.",
  Metal:     "Magnetised edge — every strike snaps back into position. Fatigue-proof.",
  Soul:      "Strikes the spirit, not just the body. Ignores most physical defenses.",
  Poison:    "Coats with toxin. Wounds keep working long after the strike lands.",
  Time:      "Hits twice — once now, once a heartbeat later. Reality apologises.",
  Water:     "Flows around guards — pressurised water finds gaps in any defense.",
  Sound:     "Resonance shockwave — staggers and disorients on impact.",
  Gravity:   "Each hit pulls. Targets fall toward you on every connect.",
  Psychic:   "Pierces the mind before the body. Pain arrives before the blow.",
  Chaos:     "Outcome unstable. Damage roll varies wildly. Sometimes nothing. Sometimes everything.",
  Neutral:   "Raw force, no thematic baggage. Pure kinetic transfer.",
}
const _GRADE_ENCHANT_TIER: Record<string, string> = {
  'F': 'curio-grade', 'E': 'curio-grade', 'D': 'novice', 'C': 'practitioner',
  'B': 'master', 'A': 'arch-magus', 'S': 'mythic', 'SS': 'legendary',
  'SSS': 'world-shaping', 'God': 'apotheotic',
}
export function generateEnchantmentDescription(
  label: string,
  element?: ElementType,
  grade?: ItemGrade,
): string {
  const item = _enchantByLabel.get(label)
  const el = element ?? item?.element
  const gr = grade ?? item?.grade
  const flavor = el ? _ELEMENT_ENCHANT_FLAVOR[el] : ''
  const tier = gr ? _GRADE_ENCHANT_TIER[String(gr).replace(/[-+]/g, '').replace(/\s/g, '')] : ''
  if (flavor && tier) return `${flavor} (${tier} inscription)`
  if (flavor) return flavor
  if (tier) return `${tier} inscription — bonded to the wielder.`
  return 'Inscribed power — subtle to obvious, depending on who looks.'
}

// ── Race subType / class / transformation ───────────────────────────────
// These all draw from the same lookup map (element + grade). The flavour
// reuses the enchantment element table because the affinity reading is
// the same idea ("this entry is a Fire/A-tier variant of the race") but
// the wrapper sentence differs per category.
function _racePoolElementGrade(label: string): { element?: string; grade?: string } {
  const entry = racePoolLookup.get(label)
  return { element: entry?.element, grade: entry?.grade as string | undefined }
}
function _racePoolWrap(category: 'raceSubType' | 'raceClass' | 'raceTransformation', label: string): string {
  const { element, grade } = _racePoolElementGrade(label)
  const tier = grade ? _GRADE_ENCHANT_TIER[String(grade).replace(/[-+]/g, '').replace(/\s/g, '')] ?? '' : ''
  const elFlavor = element ? ` Affinity: ${element}.` : ''
  const tierFlavor = tier ? ` (${tier} variant)` : ''
  const noun = category === 'raceSubType' ? 'subtype'
    : category === 'raceClass' ? 'specialisation'
    : 'transformation form'
  if (category === 'raceTransformation') {
    return `A ${noun} this race can shift into mid-battle.${elFlavor}${tierFlavor}`
  }
  return `A ${noun} of this race — narrows stat bias, ability pool, and how this character plays.${elFlavor}${tierFlavor}`
}
export function generateRaceSubTypeDescription(label: string): string {
  return _racePoolWrap('raceSubType', label)
}
export function generateRaceClassDescription(label: string): string {
  return _racePoolWrap('raceClass', label)
}
export function generateRaceTransformationDescription(label: string): string {
  return _racePoolWrap('raceTransformation', label)
}

// ── Weakness ─────────────────────────────────────────────────────────────
// Weaknesses are now elemental — the label is the trigger, and the
// description spells out the +25% damage taken so players grok the
// mechanical cost at a glance.
const _ELEMENT_WEAKNESS_FLAVOR: Record<string, string> = {
  Fire:      "Heat unmakes you. Take +25% damage from Fire attacks.",
  Ice:       "Cold finds your seams. Take +25% damage from Ice attacks.",
  Lightning: "Conducts straight through. Take +25% damage from Lightning attacks.",
  Earth:     "Pressure cracks you. Take +25% damage from Earth attacks.",
  Wind:      "Sliced by what you can't see. Take +25% damage from Wind attacks.",
  Shadow:    "Darkness reaches into the wound. Take +25% damage from Shadow attacks.",
  Light:     "Purification burns you. Take +25% damage from Light attacks.",
  Arcane:    "Wards collapse on contact. Take +25% damage from Arcane attacks.",
  Nature:    "Living things tear through you. Take +25% damage from Nature attacks.",
  Void:      "Erasure latches on. Take +25% damage from Void attacks.",
  Cosmic:    "Star-stuff isn't built for you. Take +25% damage from Cosmic attacks.",
  Blood:     "Your own life-force betrays you. Take +25% damage from Blood attacks.",
  Metal:     "Iron finds the gap. Take +25% damage from Metal attacks.",
  Soul:      "Spirit injuries don't heal. Take +25% damage from Soul attacks.",
  Poison:    "Toxins overwhelm faster. Take +25% damage from Poison attacks.",
  Time:      "Temporal injuries propagate. Take +25% damage from Time attacks.",
  Water:     "Pressure finds your weak side. Take +25% damage from Water attacks.",
  Sound:     "Vibrations rupture you. Take +25% damage from Sound attacks.",
  Gravity:   "Pull becomes crush. Take +25% damage from Gravity attacks.",
  Psychic:   "Mind-wounds you can't shake. Take +25% damage from Psychic attacks.",
  Chaos:     "Random doesn't favour you. Take +25% damage from Chaos attacks.",
  Neutral:   "Even raw force lands harder. Take +25% damage from Neutral attacks.",
}
export function generateWeaknessDescription(label: string, element?: ElementType): string {
  if (element && _ELEMENT_WEAKNESS_FLAVOR[element]) return _ELEMENT_WEAKNESS_FLAVOR[element]
  return 'A vulnerability your enemies can exploit — take extra damage from the matching element.'
}

// ── Limit Break ──────────────────────────────────────────────────────────
const _LIMIT_BREAK_DESCS: Record<string, string> = {
  'No Limit Break':
    "Stat ceiling untouched. The race plays at its natural cap.",
  'Limit Break':
    "The race's ceiling has been shattered. Higher tiers unlocked — the How-Broken wheel determines by how much.",
  'Weak':
    "A crack in the ceiling. Minimum stat tier shifts +1 — meaningful but contained.",
  'Mild':
    "The ceiling buckled. Minimum stat tier shifts +2. The character outpaces their ancestors.",
  'Strong':
    "The ceiling collapsed. Minimum stat tier shifts +3. Nothing about this character is normal.",
  'Limitless':
    "There is no ceiling. Minimum stat tier shifts +4. Reality is the only remaining limit, and reality is negotiable.",
}
export function generateLimitBreakDescription(label: string): string {
  return _LIMIT_BREAK_DESCS[label] ?? ''
}

// ── Stat Bonus / Stat Penalty (bonus spin results) ──────────────────────
// These usually carry a small label like "+Strength" or "-Charisma" — the
// description spells out what's happening mechanically.
export function generateStatBonusDescription(label: string, category: 'statBonus' | 'statPenalty'): string {
  const direction = category === 'statBonus' ? 'boosted' : 'penalised'
  const sign      = category === 'statBonus' ? '+' : '−'
  // Strip leading +/- if present in label
  const clean = label.replace(/^[+−-]\s*/, '')
  return `A single stat ${direction} by spliced bonus spin. Effect: ${sign}${clean}.`
}

// ── Wrapper used by spin-reveal entry points ────────────────────────────
// Centralised so both +page.svelte and StorySpinView.svelte can call
// the same function instead of branching on every category twice.
export function generateExtraDescription(
  category: string,
  label: string,
  element?: ElementType,
  grade?: ItemGrade,
): string {
  switch (category) {
    case 'backstory':            return generateBackstoryDescription(label)
    case 'title':                return generateTitleDescription(label)
    case 'weaponType':           return generateWeaponTypeDescription(label)
    case 'armorType':            return generateArmorTypeDescription(label)
    case 'weaponEnchantment':
    case 'armorEnchantment':     return generateEnchantmentDescription(label, element, grade)
    case 'raceSubType':          return generateRaceSubTypeDescription(label)
    case 'raceClass':            return generateRaceClassDescription(label)
    case 'raceTransformation':   return generateRaceTransformationDescription(label)
    case 'weakness':             return generateWeaknessDescription(label, element)
    case 'limitBreak':
    case 'limitBreakLevel':      return generateLimitBreakDescription(label)
    case 'statBonus':            return generateStatBonusDescription(label, 'statBonus')
    case 'statPenalty':          return generateStatBonusDescription(label, 'statPenalty')
    default:                     return ''
  }
}

export const EXTRA_DESCRIPTION_CATEGORIES = new Set([
  'backstory', 'title', 'weaponType', 'armorType',
  'weaponEnchantment', 'armorEnchantment',
  'raceSubType', 'raceClass', 'raceTransformation',
  'weakness', 'limitBreak', 'limitBreakLevel',
  'statBonus', 'statPenalty',
])
