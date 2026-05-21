// descriptions.ts — Dynamic description + ability-type generator for all content items.
// Derives flavor text and battle type from name keywords, element, and grade.

export type AbilityType = 'Attack' | 'Heal' | 'Defense' | 'Dodge' | 'Nullification' | 'Passive' | 'Buff' | 'Debuff' | 'Summon'

const ABILITY_TYPE_COLOR: Record<AbilityType, string> = {
  Attack:       '#ef4444',
  Heal:         '#34d399',
  Defense:      '#60a5fa',
  Dodge:        '#a78bfa',
  Nullification:'#f59e0b',
  Passive:      '#9ca3af',
  Buff:         '#fbbf24',
  Debuff:       '#f97316',
  Summon:       '#e879f9',
}

const ABILITY_TYPE_ICON: Record<AbilityType, string> = {
  Attack:       'bolt',
  Heal:         'favorite',
  Defense:      'shield',
  Dodge:        'air',
  Nullification:'block',
  Passive:      'auto_awesome',
  Buff:         'trending_up',
  Debuff:       'trending_down',
  Summon:       'add_circle',
}

export function getAbilityTypeColor(t: AbilityType): string { return ABILITY_TYPE_COLOR[t] }
export function getAbilityTypeIcon(t: AbilityType): string  { return ABILITY_TYPE_ICON[t] }

export function classifyAbility(label: string, element?: string): AbilityType {
  if (/\b(heal|mend|restore|recover|regenerat|revive|cure|vital force|life leech|life drain)\b/i.test(label)) return 'Heal'
  if (/\b(barrier|shield|wall|ward|protect|fortress|bunker|bastion|bulwark|fortif|iron fort|aegis|carapace|shell)\b/i.test(label)) return 'Defense'
  if (/\b(dodge|evad|evasion|phase shift|blink|sidestep|vanish|invisible|intangible|afterimage|mirror image|blur|ghost step|phase through)\b/i.test(label)) return 'Dodge'
  if (/\b(null|negate|counter|reflect|absorb|seal|suppress|cancel|anti-|immunity|rebuff|dispel|sever|break)\b/i.test(label)) return 'Nullification'
  if (/\b(summon|conjure|call forth|raise|manifest|legion|minion|army|swarm|familiar)\b/i.test(label)) return 'Summon'
  if (/\b(aura|buff|boost|empower|enhance|strengthen|amplify|inspire|embolden|rally|harden|bless|boon|exalt|ascend)\b/i.test(label)) return 'Buff'
  if (/\b(curse|weaken|slow|stun|paralyze|petrif|drain|corrupt|decay|wither|leech|sap|enervat|blind|debuff)\b/i.test(label)) return 'Debuff'
  if (/\b(passive|innate|natural|ambient|mastery|training|experience|sense|awareness|resilience|endurance|toughness|adaptation)\b/i.test(label)) return 'Passive'
  if (/\b(manipulation|control|dominion|sovereignty|mastery over)\b/i.test(label)) {
    // Element-specific overrides — some manipulation types are passive/buff
    if (element === 'Time') return 'Passive'
    if (element === 'Soul') return 'Debuff'
    return 'Attack'
  }
  if (/\b(strike|blast|attack|surge|slash|smash|crush|shatter|destroy|obliterate|detonate|explosion|bolt|beam|ray|shot|throw|hurl|punch|kick|lunge|stab|cut|pierce|rend|sever|devastat|annihilate|incinerat|carnage|barrage|volley|fusillade|charge|ram|impact|slam|cleave)\b/i.test(label)) return 'Attack'
  // Element-based fallback
  if (element === 'Light' && /bless|grace|sacred|divine|holy/i.test(label)) return 'Heal'
  return 'Attack'
}

// ── Description text generators ───────────────────────────────────────────────

const ELEMENT_VERBS: Record<string, string> = {
  Fire:      'blazing fire', Ice: 'freezing ice', Lightning: 'crackling lightning',
  Earth:     'seismic earth', Wind: 'howling wind', Shadow: 'writhing shadow',
  Light:     'divine light', Arcane: 'raw arcane energy', Nature: 'living nature',
  Void:      'consuming void', Cosmic: 'cosmic force', Blood: 'blood energy',
  Metal:     'hardened metal', Soul: 'soul energy', Poison: 'deadly venom',
  Time:      'warped time', Water: 'surging water', Sound: 'resonant sound',
  Gravity:   'gravitational force', Psychic: 'psychic power', Chaos: 'chaotic energy',
  Neutral:   'raw power',
}

function elem(e?: string): string {
  return (e && ELEMENT_VERBS[e]) ?? 'arcane energy'
}

export function generatePowerDescription(label: string, element?: string, grade?: string): string {
  const e = elem(element)
  const l = label

  if (/manipulation|control|dominion/i.test(l)) return `Grants the user mastery over ${e}, bending it entirely to their will.`
  if (/time stop|stop time|freeze time/i.test(l)) return 'Halts the flow of time itself, freezing all opponents in place.'
  if (/omnipoten/i.test(l))    return 'Absolute authority over all things. Nothing resists this power.'
  if (/omniscien/i.test(l))    return 'Complete knowledge of all events past, present, and future.'
  if (/immortal/i.test(l))     return 'Renders the user deathless — wounds close instantly, vitality never fades.'
  if (/void walk|void travel/i.test(l)) return 'Allows the user to step between dimensions through the void.'
  if (/reality rewrite|reality warp/i.test(l)) return 'Rewrites the rules of reality itself at a whim.'
  if (/bolt|beam|ray/i.test(l))   return `Launches a concentrated bolt of ${e} at the target, dealing significant damage.`
  if (/blast|explosion|detonate|detonation/i.test(l)) return `Detonates a powerful ${e} explosion, dealing area damage.`
  if (/strike|slash|smash|crush|cleave/i.test(l)) return `A devastating ${e}-infused strike that deals heavy physical damage.`
  if (/storm|tempest|cyclone|vortex/i.test(l)) return `Summons a raging ${e} storm that continuously damages all in its path.`
  if (/barrier|shield|wall|ward|fortress/i.test(l)) return `Creates an impenetrable ${e} barrier that absorbs incoming damage.`
  if (/heal|mend|restore|recover/i.test(l)) return `Channels ${e} to rapidly heal wounds and restore vitality.`
  if (/summon|conjure/i.test(l)) return `Summons ${e}-imbued entities to fight alongside the user.`
  if (/aura/i.test(l)) return `Radiates an ${e} aura that continuously empowers the user or weakens foes.`
  if (/field|zone|domain|realm/i.test(l)) return `Creates an ${e} field that alters the laws of combat in the area.`
  if (/form|transformation|mode/i.test(l)) return `Transforms the user with ${e}, greatly enhancing all combat capabilities.`
  if (/step|travel|teleport|phase/i.test(l)) return `Uses ${e} to instantly reposition, bypassing all obstacles.`
  if (/drain|leech|absorb/i.test(l)) return `Drains ${e} from enemies, weakening them while restoring the user.`
  if (/creation|forge|craft/i.test(l)) return `Creates constructs of ${e} from nothing, manifesting weapons or shields.`
  if (/sense|sight|perception|awareness/i.test(l)) return `Enhances the user's perception using ${e}, detecting threats before they strike.`
  if (/curse|wither|decay/i.test(l)) return `Inflicts a ${e} curse that slowly destroys the target from within.`

  // Type-based fallback
  const type = classifyAbility(label, element)
  switch (type) {
    case 'Heal':         return `Channels ${e} to restore health and mend wounds.`
    case 'Defense':      return `Creates a ${e} barrier that protects against incoming attacks.`
    case 'Dodge':        return `Uses ${e} to evade attacks with supernatural speed.`
    case 'Nullification':return `Nullifies opposing abilities using ${e}.`
    case 'Buff':         return `Enhances the user's power and capabilities with ${e}.`
    case 'Debuff':       return `Weakens enemies by draining their strength with ${e}.`
    case 'Summon':       return `Summons ${e}-imbued entities to aid in battle.`
    case 'Passive':      return `Passively enhances the user's capabilities through ${e} attunement.`
    default:             return `Unleashes ${e} in a devastating attack.`
  }
}

export function generateWeaponDescription(label: string, element?: string, grade?: string): string {
  const e = elem(element)
  if (/sword|blade|edge|saber|cutlass/i.test(label)) return `A ${grade ?? ''} blade imbued with ${e}. Increases Physical Damage output.`.trim()
  if (/bow|arrow|crossbow|quiver/i.test(label))       return `A ${grade ?? ''} ranged weapon channeling ${e}. Enables long-range attacks.`.trim()
  if (/hammer|maul|warhammer|mace|club/i.test(label)) return `A ${grade ?? ''} bludgeon infused with ${e}. Deals crushing Physical Damage.`.trim()
  if (/spear|lance|trident|pike/i.test(label))        return `A ${grade ?? ''} polearm charged with ${e}. Extends reach and Physical Damage.`.trim()
  if (/scythe|sickle/i.test(label))                  return `A ${grade ?? ''} reaping weapon imbued with ${e}. Cuts through defenses.`.trim()
  if (/staff|wand|rod|orb/i.test(label))              return `A ${grade ?? ''} magical implement focused with ${e}. Amplifies Power Damage.`.trim()
  if (/dagger|knife|kris|stiletto/i.test(label))      return `A ${grade ?? ''} short blade laced with ${e}. Fast attacks, high crit potential.`.trim()
  if (/axe|hatchet/i.test(label))                    return `A ${grade ?? ''} axe crackling with ${e}. High cleaving Physical Damage.`.trim()
  if (/cannon|gun|rifle|pistol/i.test(label))         return `A ${grade ?? ''} firearm enhanced with ${e}. Deals devastating ranged damage.`.trim()
  return `A ${grade ?? ''} weapon imbued with ${e}. Increases Physical and Power Damage.`.trim()
}

export function generateArmorDescription(label: string, element?: string, grade?: string): string {
  const e = elem(element)
  if (/helmet|helm|cap|hood|mask|visor|crown/i.test(label)) return `A ${grade ?? ''} head piece fortified with ${e}. Provides head protection and reduces incoming damage.`.trim()
  if (/full.?suit|plate|panoply|gallea|cataphract/i.test(label)) return `A ${grade ?? ''} full body armor reinforced with ${e}. Maximum Armor Reduction.`.trim()
  if (/vest|breastplate|cuirass|chestplate/i.test(label)) return `A ${grade ?? ''} chest armor infused with ${e}. Strong Armor Reduction.`.trim()
  if (/robe|cloak|coat|mantle/i.test(label)) return `A ${grade ?? ''} cloth armor enhanced with ${e}. Light protection with magical affinity.`.trim()
  if (/gauntlet|glove|bracer/i.test(label)) return `A ${grade ?? ''} hand armor laced with ${e}. Reduces hand-based damage received.`.trim()
  if (/boots|greaves|sabatons/i.test(label)) return `A ${grade ?? ''} leg armor resonating with ${e}. Reduces leg damage, improves mobility.`.trim()
  if (/shield/i.test(label)) return `A ${grade ?? ''} shield bolstered with ${e}. High Armor Reduction, enables blocking.`.trim()
  return `A ${grade ?? ''} armor piece fortified with ${e}. Reduces incoming damage (Armor Reduction).`.trim()
}

export function generateAbilityDescription(label: string, element?: string, grade?: string): string {
  const e = elem(element)
  const type = classifyAbility(label, element)
  switch (type) {
    case 'Heal':         return `Passively or actively restores HP using ${e} during combat.`
    case 'Defense':      return `Creates defensive ${e} effects that reduce incoming damage.`
    case 'Dodge':        return `Enhances evasion using ${e}, improving dodge chance.`
    case 'Nullification':return `Passively or reactively negates certain abilities with ${e}.`
    case 'Buff':         return `Amplifies the user's stats or attacks with ${e}.`
    case 'Debuff':       return `Weakens enemy stats or attacks using ${e}.`
    case 'Summon':       return `Summons ${e} allies or constructs in battle.`
    default:             return `A ${grade ?? ''} ability that channels ${e}.`
  }
}

export function generateRaceDescription(label: string): string {
  return `A ${label} character with unique racial traits, abilities, and stat tendencies.`
}

export function generateArchetypeDescription(label: string): string {
  return `The ${label} archetype defines the character's combat role and power orientation.`
}

// ── Stat boost context text (shown below grade) ───────────────────────────────
export const ABILITY_BATTLE_EFFECT: Record<AbilityType, string> = {
  Attack:       'Contributes to Power Damage in battle',
  Heal:         'Can restore HP during combat',
  Defense:      'Contributes to Armor Reduction',
  Dodge:        'Increases Dodge Chance',
  Nullification:'Can negate opponent abilities',
  Passive:      'Provides a continuous passive bonus',
  Buff:         'Boosts allied stats during combat',
  Debuff:       'Reduces enemy stats during combat',
  Summon:       'Adds independent combatants to the fight',
}
