// Granted item helpers — central place for converting class/clan/rank
// "grants" (flat stat bumps, structured power/weapon/armor grants) into
// concrete results + queue mutations + display-label suffixes.
//
// Every race we revamp post-2026-06 funnels through this module so the
// engine logic stays one source of truth. Legacy races that still use the
// older statBonusGrants / grantedPowers: string[] shape work alongside
// because none of these helpers REPLACE existing logic — they augment it.

import type {
  GrantedItem, FlatStatBonuses, StatBonusGrants, ItemGrade, ElementType,
} from '$lib/content/types'
import type { SpinDefinition } from '$lib/game/spinQueue'
import type { SpinResult } from '$lib/session/types'

// ── Element auto-default ───────────────────────────────────────────────
// When a grant doesn't specify an element, sniff the item's label for a
// known family marker and assign the corresponding element. Keeps the
// race data terse (you only need to declare element when overriding the
// default), and gives the wheel + battle visuals something to colour by.
const FAMILY_ELEMENT: Array<[RegExp, ElementType]> = [
  [/\bdagger|stiletto|shiv|slicer|blade|edge\b/i,                            'Shadow'],
  [/\bsword|katana|nodachi|falchion|cleaver|sabre|saw|gladius\b/i,           'Metal'],
  [/\baxe|cleaver|battleaxe|greataxe|tomahawk|hatchet\b/i,                   'Neutral'],
  [/\bmace|warhammer|hammer|morningstar|sledge|cudgel\b/i,                   'Light'],
  [/\bspear|lance|halberd|pike|javelin\b/i,                                  'Metal'],
  [/\bbow|crossbow|ballista|sling|arrow\b/i,                                 'Wind'],
  [/\bstaff|wand|rod|scepter|sceptre|grimoire|tome|catalyst|relic\b/i,       'Arcane'],
  [/\bgun|rifle|pistol|cannon|carbine|railgun|launcher|disruptor\b/i,        'Metal'],
  [/\blute|lyre|flute|harp|drum|horn|gong|guitar|symphony\b/i,               'Sound'],
  [/\bshield|buckler|aegis|pauldrons?|plate|armor|armour|cloak|robes?|carapace|hide|hull|chassis|vest|jerkin\b/i, 'Metal'],
  [/\bhelmet|helm|crest|crown|mask\b/i,                                      'Light'],
  [/\bskillet|cleaver|ladle|spoon|pan|pot|cauldron|knife\b/i,                'Neutral'],
  [/\bdice|cards?|coin|deck\b/i,                                             'Chaos'],
  [/\bcrystal|gem|emerald|amethyst|diamond|sapphire|prism\b/i,               'Arcane'],
]

export function resolveGrantElement(label: string, override?: ElementType): ElementType {
  if (override) return override
  for (const [rx, el] of FAMILY_ELEMENT) {
    if (rx.test(label)) return el
  }
  return 'Neutral'
}

// ── Grade default ──────────────────────────────────────────────────────
export function resolveGrantGrade(grade?: ItemGrade): ItemGrade {
  return grade ?? 'C'
}

// ── Result-pushing for grants ─────────────────────────────────────────
// Pushes a synthetic SpinResult for every granted item AND removes the
// matching base-spin category slot(s) from the upcoming queue so the
// player doesn't double-roll. Returns the count of grants applied per
// category so the caller can compose a display-label suffix.

export interface GrantsApplied {
  powers:   { label: string; grade: ItemGrade; element: ElementType }[]
  weapons:  { label: string; grade: ItemGrade; element: ElementType }[]
  armor:    { label: string; grade: ItemGrade; element: ElementType }[]
}

/** Push granted items as SpinResults and splice the matching upcoming
 *  base-spin slots out of the queue (one weaponType+weapon pair per
 *  granted weapon, one armorType+armor+armorStrength triple per granted
 *  armor, one power slot per granted power). Mutates the arrays in place;
 *  returns the list of grants for label-suffix composition. */
export function applyGrantedItems(args: {
  grantedPowers?: string[]
  grantedPowerItems?: GrantedItem[]
  grantedWeapons?: GrantedItem[]
  grantedArmor?: GrantedItem[]
  spinQueue: SpinDefinition[]
  results: SpinResult[]
  currentSpinIndex: number
  parentDisplayName: string  // displayName of the spawning spin (for "step" labels)
}): GrantsApplied {
  const out: GrantsApplied = { powers: [], weapons: [], armor: [] }

  const pushResult = (category: string, label: string, grade: ItemGrade, element: ElementType) => {
    args.results.push({
      step: args.results.length + 1,
      category,
      resultLabel: label,
      resultIndex: -1,
      timestamp: new Date().toISOString(),
      displayLabel: `${label} (${grade})`,
    } as SpinResult & { element?: string; grade?: string })
    // Carry element/grade on the result so the card / battle engine can read them.
    const last = args.results[args.results.length - 1] as any
    last.element = element
    last.grade = grade
  }

  // Remove the FIRST occurrence of any of the given categories from the
  // queue AFTER currentSpinIndex. Returns true if a slot was removed.
  const removeNextOfCategory = (categories: string[]): boolean => {
    for (let i = args.currentSpinIndex + 1; i < args.spinQueue.length; i++) {
      if (categories.includes(args.spinQueue[i].category)) {
        args.spinQueue.splice(i, 1)
        return true
      }
    }
    return false
  }

  // Powers — both legacy string[] and structured GrantedItem[] supported.
  const allPowerGrants: GrantedItem[] = [
    ...(args.grantedPowers ?? []).map(label => ({ label, grade: 'C' as ItemGrade })),
    ...(args.grantedPowerItems ?? []),
  ]
  for (const grant of allPowerGrants) {
    const grade = resolveGrantGrade(grant.grade)
    const element = resolveGrantElement(grant.label, grant.element)
    pushResult('power', grant.label, grade, element)
    removeNextOfCategory(['power'])
    out.powers.push({ label: grant.label, grade, element })
  }

  // Weapons — push as a 'weapon' result, remove the weaponType + weapon
  // (and weaponEnchantment if present) base slots.
  for (const grant of args.grantedWeapons ?? []) {
    const grade = resolveGrantGrade(grant.grade)
    const element = resolveGrantElement(grant.label, grant.element)
    pushResult('weapon', grant.label, grade, element)
    removeNextOfCategory(['weaponType'])
    removeNextOfCategory(['weapon'])
    removeNextOfCategory(['weaponEnchantment'])
    out.weapons.push({ label: grant.label, grade, element })
  }

  // Armor — push as 'armor', remove armorType + armor + armorStrength + armorEnchantment.
  for (const grant of args.grantedArmor ?? []) {
    const grade = resolveGrantGrade(grant.grade)
    const element = resolveGrantElement(grant.label, grant.element)
    pushResult('armor', grant.label, grade, element)
    removeNextOfCategory(['armorType'])
    removeNextOfCategory(['armor'])
    removeNextOfCategory(['armorStrength'])
    removeNextOfCategory(['armorEnchantment'])
    out.armor.push({ label: grant.label, grade, element })
  }

  return out
}

// ── Display-label suffix composer ─────────────────────────────────────
// Given the resolved flat/bonus/grant set for a single spin, builds the
// "(+2 Strength, +1 Durability, + Iron Greatsword (C))" tail that gets
// appended to the displayLabel so the player sees everything they got.

const STAT_PRETTY: Record<string, string> = {
  strength: 'Strength', speed: 'Speed', agility: 'Agility',
  durability: 'Durability', iq: 'IQ', charisma: 'Charisma',
  fightingSkill: 'Fighting Skill', potential: 'Potential',
  energyLevel: 'Energy Level', powerMastery: 'Power Mastery',
  weaponMastery: 'Weapon Mastery', armorStrength: 'Armor Strength',
}
function prettyStat(key: string): string {
  return STAT_PRETTY[key] ?? key
}

export function formatGrantsSuffix(args: {
  flatStatBonuses?: FlatStatBonuses
  statBonusGrants?: StatBonusGrants
  grants?: GrantsApplied
}): string {
  const parts: string[] = []

  if (args.flatStatBonuses) {
    for (const [stat, n] of Object.entries(args.flatStatBonuses)) {
      const sign = n > 0 ? '+' : ''
      parts.push(`${sign}${n} ${prettyStat(stat)}`)
    }
  }
  if (args.statBonusGrants) {
    for (const [stat, kind] of Object.entries(args.statBonusGrants)) {
      const word = kind === 'statPenalty' ? 'Penalty' : 'Bonus'
      parts.push(`+ ${prettyStat(stat)} ${word} Spin`)
    }
  }
  if (args.grants) {
    for (const g of args.grants.powers)
      parts.push(`+ ${g.label} (${g.grade} Power)`)
    for (const g of args.grants.weapons)
      parts.push(`+ ${g.label} (${g.grade})`)
    for (const g of args.grants.armor)
      parts.push(`+ ${g.label} (${g.grade} Armor)`)
  }

  return parts.length === 0 ? '' : ` (${parts.join(', ')})`
}

// ── Gender-gated label resolver ───────────────────────────────────────
export function resolveGenderedLabel(args: {
  base: string
  genderLabels?: { male?: string; female?: string; other?: string }
  rolledGender: string | undefined
}): string {
  if (!args.genderLabels) return args.base
  const g = (args.rolledGender ?? '').toLowerCase()
  if (g === 'female' && args.genderLabels.female) return args.genderLabels.female
  if (g === 'male' && args.genderLabels.male)     return args.genderLabels.male
  if (args.genderLabels.other)                    return args.genderLabels.other
  return args.genderLabels.male ?? args.base
}
