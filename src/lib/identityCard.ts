// Race + Archetype identity card builder. Surfaces the "what makes this
// choice unique" data already encoded in races.ts / archetypes.ts so the
// reveal panel can read it back to the player. The point: rolling a
// Saiyan should FEEL different than rolling a Human, before they even
// see what gets spliced into the queue.

import { getRace, racesByLabel } from '$lib/content/races'
import { getArchetype } from '$lib/content/archetypes'
import { ELEMENT_COLORS } from '$lib/content/elements'
import type { ElementType, ItemGrade, Race } from '$lib/content/types'
import { GIMMICKS, RACE_GIMMICKS, ARCHETYPE_GIMMICKS } from '$lib/gimmicks'
import { backstories } from '$lib/content/backstories'
import { titles } from '$lib/content/titles'
import { RACE_TWIST_TRIGGERS, ARCHETYPE_TWIST_TRIGGERS, twistByKey } from '$lib/twists'
import { pickLineageParent } from '$lib/hallOfFame'

export interface IdentityPerk {
  // Material Symbols icon name
  icon: string
  // Short label (3–6 words ideal)
  label: string
  // Optional second-line detail
  detail?: string
}

export interface IdentityCard {
  // What kind of card to render — drives the badge above the card and
  // some style cues. "race" + "archetype" share the perks-list layout;
  // "backstory" + "title" use a stat-grants-only mini-card.
  kind: 'race' | 'archetype' | 'backstory' | 'title'
  // Display name shown in big letters
  name: string
  // Flavor description from races.ts / archetypes.ts
  description: string
  // Element-derived accent color used for border + glow + chip backgrounds.
  // Falls back to gold when no element can be derived.
  accentColor: string
  // The element that drove accentColor (for the chip + icon). Undefined when
  // nothing on the race/archetype carries an element.
  element?: ElementType
  // Rarity bucket label for the corner chip ("Mythological", "Legendary"...)
  rarity: string
  // Category badge — "Fighter", "Spellcaster" for archetypes. Race kind
  // doesn't have one so this is undefined for races.
  archetypeType?: string
  // 3–6 perk rows shown as a list inside the card body
  perks: IdentityPerk[]
  // The signature granted move (e.g. "Combat Training (Passive)") — shown
  // as a chip pinned to the top of the perk list. Undefined when none.
  signatureMove?: string
  // When the archetype renames its ability slot ("Stand", "Breathing
  // Style"), surface that so the player knows what to expect next.
  abilityRename?: string
}

// ── Stat key → short label for chips ─────────────────────────────────────
const STAT_ABBREV: Record<string, string> = {
  strength: 'STR', speed: 'SPD', agility: 'AGI', durability: 'DUR',
  iq: 'IQ', charisma: 'CHA', fightingSkill: 'FS', potential: 'POT',
  energyLevel: 'EN', powerMastery: 'PM', weaponMastery: 'WM',
  armorStrength: 'AS',
}
function statLabel(key: string): string {
  return STAT_ABBREV[key] ?? key.toUpperCase().slice(0, 3)
}

// ── Rarity buckets (mirror landingColors.ts so labels stay consistent) ──
function raceRarity(weight: number): string {
  if (weight <= 2) return 'Mythological'
  if (weight <= 4) return 'Legendary'
  if (weight <= 7) return 'Uncommon'
  return 'Common'
}
function archetypeRarity(weight: number): string {
  if (weight === 1) return 'Mythological'
  if (weight === 2) return 'Legendary'
  if (weight <= 4) return 'Rare'
  return 'Common'
}

// Tier of grade for picking the strongest element from a pool entry list.
const _GRADE_RANK: Record<ItemGrade, number> = {
  F: 0, E: 1, D: 2, C: 3, B: 4, A: 5, S: 6, SS: 7, SSS: 8, God: 9,
}

// Pick the most evocative element for a race — looks across class /
// transformation / subtype pools and grabs the element attached to the
// highest-grade entry. Falls back to undefined.
function pickRaceElement(race: Race): ElementType | undefined {
  const pools = [
    ...(race.classPool ?? []),
    ...(race.transformationPool ?? []),
    ...(race.subTypePool ?? []),
  ]
  let best: { el: ElementType; rank: number } | null = null
  for (const e of pools) {
    if (!e.element) continue
    const rank = _GRADE_RANK[e.grade ?? 'F']
    if (!best || rank > best.rank) best = { el: e.element, rank }
  }
  return best?.el
}

// Top N stats from a statModifiers map (highest multipliers first).
function topStatModifiers(
  mods: Record<string, number> | undefined,
  n: number,
  direction: 'boost' | 'penalty' = 'boost',
): string[] {
  if (!mods) return []
  const entries = Object.entries(mods).filter(([, v]) =>
    direction === 'boost' ? v > 1.0 : v < 1.0,
  )
  entries.sort(([, a], [, b]) => direction === 'boost' ? b - a : a - b)
  return entries.slice(0, n).map(([k]) => statLabel(k))
}

// Top N weapon types from a weaponTypeBias map (highest multipliers).
function topBias(
  bias: Record<string, number> | undefined,
  n: number,
): string[] {
  if (!bias) return []
  const entries = Object.entries(bias).filter(([k, v]) =>
    v > 1.0 && k !== 'None',
  )
  entries.sort(([, a], [, b]) => b - a)
  return entries.slice(0, n).map(([k]) => k)
}

// ── Race identity card builder ──────────────────────────────────────────
export function buildRaceIdentityCard(label: string): IdentityCard | null {
  const race = getRace(label)
  if (!race) return null

  const element = pickRaceElement(race)
  const accentColor = element ? ELEMENT_COLORS[element] : '#f0c040'

  const perks: IdentityPerk[] = []

  // Hybrid is a special "twist race" — it doesn't have its own extras;
  // the wheel splices two more race spins for the parents. Lead with that
  // perk so the player understands what's about to happen.
  if (label === 'Hybrid') {
    perks.push({
      icon: 'merge_type',
      label: 'Two-Race Bloodline',
      detail: 'The wheel spins twice more — both parents grant their full extras (abilities, classes, transformations, weapons, weaknesses).',
    })
  }

  // Lineage stub — if this is a Demi-god / Reincarnation-style race AND
  // the Hall of Fame has prior characters, surface one as the lineage
  // parent ("Born of GoldFist, your Saiyan ancestor"). Adds emergent
  // continuity across saved characters with no extra spin cost.
  if (label === 'Demi-god' || label === 'Hybrid') {
    const parent = pickLineageParent()
    if (parent) {
      perks.push({
        icon: 'family_tree',
        label: 'Lineage',
        detail: `Born of ${parent.name}, your ${parent.race} ancestor.`,
      })
    }
  }

  // Twist trigger — surface that this race spawns a unique sub-wheel.
  const raceTwistKey = RACE_TWIST_TRIGGERS[label]
  if (raceTwistKey) {
    const t = twistByKey(raceTwistKey)
    if (t) {
      perks.push({
        icon: 'casino',
        label: `${t.title} Sub-Wheel`,
        detail: t.prompt ?? 'A unique sub-wheel spawns when this race lands.',
      })
    }
  }

  // Gimmicks first — these are the race's signature COMBAT mechanic, not
  // just stat tilt. Lead with them so the player sees Saiyan's Last Stand
  // before they see "+2 weapon spins."
  for (const gid of RACE_GIMMICKS[label] ?? []) {
    const g = GIMMICKS[gid]
    if (!g) continue
    perks.push({
      icon: g.icon,
      label: g.name,
      detail: g.description,
    })
  }

  // Spin extras — most-noticed perk; lead with these.
  if (race.extraPowerSpins && race.extraPowerSpins > 0) {
    perks.push({
      icon: 'flash_on',
      label: `+${race.extraPowerSpins} Power Spin${race.extraPowerSpins > 1 ? 's' : ''}`,
      detail: 'Extra rolls on the Power wheel',
    })
  }
  if (race.extraWeaponSpins && race.extraWeaponSpins > 0) {
    perks.push({
      icon: 'swords',
      label: `+${race.extraWeaponSpins} Weapon Spin${race.extraWeaponSpins > 1 ? 's' : ''}`,
      detail: 'Extra rolls on the Weapon wheel',
    })
  }
  if (race.abilitySpinCount > 0) {
    perks.push({
      icon: 'auto_awesome',
      label: `${race.abilitySpinCount} Racial Abilit${race.abilitySpinCount === 1 ? 'y' : 'ies'}`,
      detail: 'Spun from this race\'s unique pool',
    })
  }
  // Subtype / class / transformation pools — major identity differentiators.
  if (race.classPool?.length) {
    perks.push({
      icon: 'group',
      label: `${race.classPool.length} Class options`,
      detail: 'Class spin picks from this race\'s roster',
    })
  } else if (race.subTypePool?.length) {
    perks.push({
      icon: 'group',
      label: `${race.subTypePool.length} Subtype options`,
    })
  }
  if (race.transformationPool?.length) {
    perks.push({
      icon: 'change_circle',
      label: `${race.transformationPool.length} Transformations`,
      detail: 'Forms that unlock huge stat bonuses',
    })
  }
  // Weaknesses — explicit count or derived.
  const weakCount = race.weaknessCount ?? Math.round(race.weaknessProbabilityModifier ?? 1)
  if (weakCount === 0) {
    perks.push({ icon: 'shield', label: 'Weakness Immune' })
  } else {
    perks.push({
      icon: 'warning',
      label: `${weakCount} Weakness${weakCount > 1 ? 'es' : ''}`,
      detail: 'Picked from race-modified pool',
    })
  }
  // Min stat tier — meaningful when set.
  if (race.minStatTier) {
    perks.push({
      icon: 'trending_up',
      label: `Min stat tier: ${race.minStatTier}`,
      detail: 'Lower tiers can\'t be rolled',
    })
  }
  // Stat tendencies — show top 1-2 boosted stats.
  const topBoosts = topStatModifiers(race.statModifiers, 2, 'boost')
  if (topBoosts.length > 0) {
    perks.push({
      icon: 'arrow_upward',
      label: `Boosts ${topBoosts.join(' + ')}`,
      detail: 'Stat tiers bias upward',
    })
  }
  // Weapon bias — top 1-2 types.
  const topWeapons = topBias(race.weaponTypeBias, 2)
  if (topWeapons.length > 0) {
    perks.push({
      icon: 'category',
      label: `Favors ${topWeapons.join(', ')}`,
      detail: 'Weapon type wheel weighted',
    })
  }

  return {
    kind: 'race',
    name: race.label,
    description: race.description ?? 'A distinct ancestry with characteristic stat tendencies, racial techniques, and signature weaknesses.',
    accentColor,
    element,
    rarity: raceRarity(race.weight),
    archetypeType: undefined,
    perks: perks.slice(0, 8),
  }
}

// ── Archetype identity card builder ─────────────────────────────────────
export function buildArchetypeIdentityCard(label: string): IdentityCard | null {
  const arc = getArchetype(label)
  if (!arc) return null

  // Archetype tint comes from its first elemental ability.
  const arcAbil = arc.abilities?.find(a => a.element)
  const element = arcAbil?.element
  const accentColor = element ? ELEMENT_COLORS[element] : '#f0c040'

  const perks: IdentityPerk[] = []

  // Possessed is a twist archetype — surface the dynamic flow explicitly
  // so the player knows the possession % determines how much they graft on.
  if (label === 'Possessed') {
    perks.push({
      icon: 'psychology_alt',
      label: 'Possession Sub-Wheels',
      detail: 'Spins for a possessing race, then for % strength. Higher % grafts more of that race onto you — traits, class, awakening.',
    })
  }

  // Twist trigger — surface that this archetype spawns a unique sub-wheel.
  const arcTwistKey = ARCHETYPE_TWIST_TRIGGERS[label]
  if (arcTwistKey) {
    const t = twistByKey(arcTwistKey)
    if (t) {
      perks.push({
        icon: 'casino',
        label: `${t.title} Sub-Wheel`,
        detail: t.prompt ?? 'A unique sub-wheel spawns when this archetype lands.',
      })
    }
  }

  // Gimmicks first — combat passives are the archetype's signature.
  for (const gid of ARCHETYPE_GIMMICKS[label] ?? []) {
    const g = GIMMICKS[gid]
    if (!g) continue
    perks.push({
      icon: g.icon,
      label: g.name,
      detail: g.description,
    })
  }

  // Ability rename (Stand, Breathing Style, Titan Form…) — top of card.
  if (arc.abilitySpinDisplayName) {
    perks.push({
      icon: 'edit',
      label: `Abilities = "${arc.abilitySpinDisplayName}"`,
      detail: 'This archetype renames the ability slot',
    })
  }
  // Spin extras.
  if (arc.extraPowerSpins && arc.extraPowerSpins > 0) {
    perks.push({
      icon: 'flash_on',
      label: `+${arc.extraPowerSpins} Power Spin${arc.extraPowerSpins > 1 ? 's' : ''}`,
    })
  }
  if (arc.bonusWeaponSpins && arc.bonusWeaponSpins > 0) {
    perks.push({
      icon: 'swords',
      label: `+${arc.bonusWeaponSpins} Weapon Spin${arc.bonusWeaponSpins > 1 ? 's' : ''}`,
    })
  }
  if (arc.abilitySpinCount > 0) {
    perks.push({
      icon: 'auto_awesome',
      label: `${arc.abilitySpinCount} ${arc.abilitySpinDisplayName ?? 'Archetype Abilit' + (arc.abilitySpinCount === 1 ? 'y' : 'ies')}`,
    })
  }
  // Granted powers — surface up to 2 by name.
  if (arc.grantedPowers && arc.grantedPowers.length > 0) {
    const lead = arc.grantedPowers.slice(0, 2).join(', ')
    perks.push({
      icon: 'card_giftcard',
      label: 'Auto-Granted',
      detail: lead + (arc.grantedPowers.length > 2 ? ` + ${arc.grantedPowers.length - 2} more` : ''),
    })
  }
  // Granted weapons.
  if (arc.grantedWeapons && arc.grantedWeapons.length > 0) {
    perks.push({
      icon: 'redeem',
      label: 'Auto-Equipped',
      detail: arc.grantedWeapons.join(', '),
    })
  }
  // Stat boost grants — show specific boosts (not just "boosts STR" but
  // "+STR, +DUR boost spins" because they're concrete free bonuses).
  if (arc.statBonusGrants) {
    const boosts = Object.entries(arc.statBonusGrants).filter(([, v]) => v === 'statBonus').map(([k]) => statLabel(k))
    const pens   = Object.entries(arc.statBonusGrants).filter(([, v]) => v === 'statPenalty').map(([k]) => statLabel(k))
    if (boosts.length > 0) {
      perks.push({
        icon: 'arrow_upward',
        label: `Bonus: ${boosts.join(' + ')}`,
        detail: 'Free stat boost spins',
      })
    }
    if (pens.length > 0) {
      perks.push({
        icon: 'arrow_downward',
        label: `Penalty: ${pens.join(' + ')}`,
        detail: 'Forced stat penalty spins',
      })
    }
  }
  // Stat-modifier tendencies — top 1 boosted stat (if not already covered).
  const topBoosts = topStatModifiers(arc.statModifiers, 1, 'boost')
  const hasStatBonusAlready = perks.some(p => p.label.startsWith('Bonus:'))
  if (topBoosts.length > 0 && !hasStatBonusAlready) {
    perks.push({
      icon: 'trending_up',
      label: `Stat tilt: ${topBoosts.join(' + ')}`,
    })
  }
  // Weapon bias.
  const topWeapons = topBias(arc.weaponTypeBias, 2)
  if (topWeapons.length > 0) {
    perks.push({
      icon: 'category',
      label: `Favors ${topWeapons.join(', ')}`,
      detail: 'Weapon type wheel weighted',
    })
  }
  // Bonus spins (e.g. Possessed's possessionRace + possessionStrength).
  if (arc.bonusSpins && arc.bonusSpins.length > 0) {
    perks.push({
      icon: 'add_circle',
      label: `+${arc.bonusSpins.length} Bonus Spin${arc.bonusSpins.length > 1 ? 's' : ''}`,
      detail: arc.bonusSpins.map(b => b.displayName).join(' + '),
    })
  }
  // Custom ability pool overrides the standard pool with archetype-flavored
  // names (Stand types, Devil Fruits, etc.). Surface that it exists.
  if (arc.customAbilityPool && arc.customAbilityPool.length > 0 && !arc.abilitySpinDisplayName) {
    perks.push({
      icon: 'palette',
      label: 'Unique ability pool',
      detail: `${arc.customAbilityPool.length} archetype-only options`,
    })
  }

  return {
    kind: 'archetype',
    name: arc.label,
    description: arc.description ?? `The ${arc.label} archetype shapes the character's combat role, preferred range, and how their powers come together.`,
    accentColor,
    element,
    rarity: archetypeRarity(arc.weight),
    archetypeType: arc.archetypeType,
    perks: perks.slice(0, 8),
    signatureMove: arc.grantedPowers?.[0],
    abilityRename: arc.abilitySpinDisplayName,
  }
}

// ── Pool entry (subType / class / transformation) identity card ────────
// Race pool entries (e.g. "Vampire Elder", "Saiyan: Super Saiyan",
// "Symbiote Bonded") sit one level below the race itself but still carry
// their own perks (granted powers, ability list, stat bonus grants,
// element + grade, transformation statBonus). Landing on one is a major
// identity moment so we surface its perks the same way.
export function buildPoolEntryIdentityCard(
  kind: 'raceSubType' | 'raceClass' | 'raceTransformation',
  label: string,
): IdentityCard | null {
  // Scan every race's pools to find an entry with matching label. There's
  // no central index for subtype/class/transformation labels so we accept
  // the O(N) loop — only runs once per landing.
  let entry: {
    label: string
    element?: ElementType
    grade?: ItemGrade
    statBonus?: number
    statBonusGrants?: Record<string, 'statBonus' | 'statPenalty'>
    grantedPowers?: string[]
    powerPool?: { label: string; weight: number }[]
    abilities?: { label: string; weight: number; element?: ElementType; grade?: ItemGrade }[]
  } | undefined
  let parentRace: Race | undefined

  for (const r of racesByLabel.values()) {
    const pool =
      kind === 'raceClass' ? r.classPool :
      kind === 'raceTransformation' ? r.transformationPool :
      r.subTypePool
    const found = pool?.find(e => e.label === label)
    if (found) { entry = found; parentRace = r; break }
  }
  if (!entry) return null

  const accentColor = entry.element ? ELEMENT_COLORS[entry.element] : '#f0c040'
  const perks: IdentityPerk[] = []

  // Transformation stat bonus — major perk, lead with it.
  if (kind === 'raceTransformation' && entry.statBonus) {
    perks.push({
      icon: 'rocket_launch',
      label: `+${entry.statBonus} Stat Bonus`,
      detail: 'Applied to base stats when active',
    })
  }
  // Granted powers — surface up to 2.
  if (entry.grantedPowers && entry.grantedPowers.length > 0) {
    const lead = entry.grantedPowers.slice(0, 2).join(', ')
    perks.push({
      icon: 'card_giftcard',
      label: 'Auto-Granted',
      detail: lead + (entry.grantedPowers.length > 2 ? ` + ${entry.grantedPowers.length - 2} more` : ''),
    })
  }
  // Stat bonus / penalty grants.
  if (entry.statBonusGrants) {
    const boosts = Object.entries(entry.statBonusGrants).filter(([, v]) => v === 'statBonus').map(([k]) => statLabel(k))
    const pens   = Object.entries(entry.statBonusGrants).filter(([, v]) => v === 'statPenalty').map(([k]) => statLabel(k))
    if (boosts.length > 0) {
      perks.push({
        icon: 'arrow_upward',
        label: `Bonus: ${boosts.join(' + ')}`,
        detail: 'Free stat boost spins',
      })
    }
    if (pens.length > 0) {
      perks.push({
        icon: 'arrow_downward',
        label: `Penalty: ${pens.join(' + ')}`,
      })
    }
  }
  // Custom ability pool size.
  if (entry.abilities && entry.abilities.length > 0) {
    perks.push({
      icon: 'auto_awesome',
      label: `${entry.abilities.length} unique abilities`,
      detail: 'Drawn from this entry\'s pool when ability spins fire',
    })
  }
  // Custom power pool size.
  if (entry.powerPool && entry.powerPool.length > 0) {
    perks.push({
      icon: 'flash_on',
      label: `${entry.powerPool.length} biased powers`,
      detail: 'Power spins weighted toward this list',
    })
  }
  // Parent race trail — gives context for what this entry belongs to.
  if (parentRace) {
    perks.push({
      icon: 'family_tree',
      label: `From: ${parentRace.label}`,
    })
  }

  const kindLabel =
    kind === 'raceClass' ? 'CLASS' :
    kind === 'raceTransformation' ? 'TRANSFORMATION' :
    'SUBTYPE'

  // Rarity bucket from grade — pool entries don't carry weight in the
  // same sense as races, so derive from grade.
  const gradeRank = entry.grade ? _GRADE_RANK[entry.grade] : 0
  const rarity =
    gradeRank >= 8 ? 'Mythological' :
    gradeRank >= 6 ? 'Legendary' :
    gradeRank >= 4 ? 'Rare' :
    gradeRank >= 2 ? 'Uncommon' :
    'Common'

  return {
    kind: 'race',  // share the race card styling
    name: entry.label,
    description: `${kindLabel.charAt(0) + kindLabel.slice(1).toLowerCase()} of ${parentRace?.label ?? 'unknown lineage'} — ${entry.grade ? `grade ${entry.grade}` : 'pool entry'}.`,
    accentColor,
    element: entry.element,
    rarity,
    archetypeType: kindLabel,    // shown as the gold "Fighter/Spellcaster"-style chip
    perks: perks.slice(0, 8),
  }
}

// ── Backstory identity card builder ─────────────────────────────────────
// Backstories are pure flavor + stat grants. The card surfaces the
// statBonusGrants as perk rows so the player understands the build
// implication without having to parse it from the +CHA / -STR icons.
const _backstoriesByLabel = new Map(backstories.map(b => [b.label, b]))
export function buildBackstoryIdentityCard(label: string): IdentityCard | null {
  const b = _backstoriesByLabel.get(label)
  if (!b) return null
  const perks: IdentityPerk[] = []
  if (b.statBonusGrants) {
    const boosts = Object.entries(b.statBonusGrants).filter(([, v]) => v === 'statBonus').map(([k]) => statLabel(k))
    const pens   = Object.entries(b.statBonusGrants).filter(([, v]) => v === 'statPenalty').map(([k]) => statLabel(k))
    if (boosts.length > 0) {
      perks.push({
        icon: 'arrow_upward',
        label: `Bonus: ${boosts.join(' + ')}`,
        detail: 'Free stat boost spins from this backstory',
      })
    }
    if (pens.length > 0) {
      perks.push({
        icon: 'arrow_downward',
        label: `Penalty: ${pens.join(' + ')}`,
        detail: 'Forced stat penalty spins from this backstory',
      })
    }
  }
  return {
    kind: 'backstory',
    name: label,
    description: 'The history that shaped them. Twisted, lucky, or just unbearably specific.',
    accentColor: '#c9a050',  // parchment/sepia gold — backstory tone
    rarity: 'Backstory',
    perks,
  }
}

// ── Title identity card builder ─────────────────────────────────────────
// Titles tend to be more grandiose (Epic + Comedic tier system). Same
// stat-grants surfacing as backstory but with a different accent so the
// player visually distinguishes the categories.
const _titlesByLabel = new Map(titles.map(t => [t.label, t]))
export function buildTitleIdentityCard(label: string): IdentityCard | null {
  const t = _titlesByLabel.get(label)
  if (!t) return null
  const perks: IdentityPerk[] = []
  if (t.statBonusGrants) {
    const boosts = Object.entries(t.statBonusGrants).filter(([, v]) => v === 'statBonus').map(([k]) => statLabel(k))
    const pens   = Object.entries(t.statBonusGrants).filter(([, v]) => v === 'statPenalty').map(([k]) => statLabel(k))
    if (boosts.length > 0) {
      perks.push({
        icon: 'arrow_upward',
        label: `Bonus: ${boosts.join(' + ')}`,
        detail: 'Granted by holding this title',
      })
    }
    if (pens.length > 0) {
      perks.push({
        icon: 'arrow_downward',
        label: `Penalty: ${pens.join(' + ')}`,
        detail: 'The cost of bearing this name',
      })
    }
  }
  // Heuristic: titles with more boost grants feel rarer.
  const boostCount = Object.values(t.statBonusGrants ?? {}).filter(v => v === 'statBonus').length
  const rarity =
    boostCount >= 3 ? 'Mythic Title' :
    boostCount === 2 ? 'Epic Title' :
    'Title'
  return {
    kind: 'title',
    name: label,
    description: 'The name they answer to. The story the world will remember.',
    accentColor: '#f0c040',  // gold — titles are grand
    rarity,
    perks,
  }
}

// Convenience: resolves the right card kind from a SpinCategory + label.
export function buildIdentityCard(
  category: string | undefined,
  label: string,
): IdentityCard | null {
  if (category === 'race') return buildRaceIdentityCard(label)
  if (category === 'archetype') return buildArchetypeIdentityCard(label)
  if (category === 'raceSubType' || category === 'raceClass' || category === 'raceTransformation') {
    return buildPoolEntryIdentityCard(category, label)
  }
  if (category === 'backstory') return buildBackstoryIdentityCard(label)
  if (category === 'title')     return buildTitleIdentityCard(label)
  return null
}
