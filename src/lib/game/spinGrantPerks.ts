// Builds structured perk lists for every spin result that grants something
// concrete — race sub-type / class / transformation / rank / magic wheels.
// Mirrors the IdentityPerk format so SpinResultReveal can animate them the
// same way it does for race / archetype identity cards.
//
// Reads the full 2026-06 race-revamp field set off each pool entry:
// flatStatBonuses, statBonusGrants, statFloorBonuses, statCapBonuses,
// tierFloorBonus, grantedWeapons / grantedArmor / grantedPowerItems,
// grantedPowers (legacy string[]), grantedKeywords, bonusSpins,
// disableItemSpins, bypassHeightSpin, redirectToRace. If a field is absent,
// no perk is emitted for it — short lists are fine.

import type { IdentityPerk } from '$lib/identityCard'
import { getRace } from '$lib/content/races'
import { getRaceWheelSegments } from '$lib/game/raceWheelRegistry'
import type { GrantedItem, WheelSegment } from '$lib/content/types'

const STAT_LABELS: Record<string, string> = {
  strength: 'Strength', speed: 'Speed', agility: 'Agility', durability: 'Durability',
  iq: 'IQ', charisma: 'Charisma', fightingSkill: 'Fighting Skill',
  powerMastery: 'Power Mastery', weaponMastery: 'Weapon Mastery',
  armorMastery: 'Armor Mastery', potential: 'Potential', energyLevel: 'Energy Level',
}
function statName(key: string): string {
  return STAT_LABELS[key] ?? (key.charAt(0).toUpperCase() + key.slice(1))
}

// Pool entries share most of these optional fields. Use a permissive shape
// so we can collapse the per-category lookups into one builder. Hand-rolled
// rather than intersected because ClassEntry/SubTypeEntry have
// `grantedPowers: string[]` while WheelSegment has `grantedPowers:
// GrantedItem[]` — the intersection produces an impossible type.
type PerkSourceEntry = {
  label: string
  flatStatBonuses?: Record<string, number>
  statBonusGrants?: Record<string, 'statBonus' | 'statPenalty'>
  statFloorBonuses?: Record<string, number>
  statCapBonuses?: Record<string, number>
  tierFloorBonus?: number
  grantedPowers?: string[] | GrantedItem[]
  grantedPowerItems?: GrantedItem[]
  grantedWeapons?: GrantedItem[]
  grantedArmor?: GrantedItem[]
  grantedKeywords?: string[]
  bonusSpins?: { category: string; displayName: string }[]
  disableItemSpins?: ('weapon' | 'armor' | 'power')[]
  bypassHeightSpin?: boolean
  redirectToRace?: string
  skipRemainingRacialExtras?: boolean
  rareTag?: string
}

// Collect granted items into a single "Loadout" perk line per category so
// the reveal panel stays scannable when a Standard rank grants weapon +
// armor + power simultaneously.
function joinItemList(items: { label: string; grade?: string }[] | undefined): string | null {
  if (!items?.length) return null
  return items.map(i => i.grade ? `${i.label} (${i.grade})` : i.label).join(', ')
}

function appendStatBonuses(perks: IdentityPerk[], entry: PerkSourceEntry) {
  // Flat stat bonuses (face-value tier shifts). Most common output.
  if (entry.flatStatBonuses) {
    const lines = Object.entries(entry.flatStatBonuses)
      .filter(([, n]) => (n as number) !== 0)
      .map(([k, n]) => `${(n as number) > 0 ? '+' : ''}${n} ${statName(k)}`)
    if (lines.length) {
      perks.push({
        icon: 'trending_up',
        label: 'Stat Shift',
        detail: lines.join(' · '),
      })
    }
  }
  // statBonusGrants on race entries now applies as a +2/-2 flat tier
  // shift (not a bonus-spin splice). Render it as a stat-shift perk row.
  if (entry.statBonusGrants) {
    const lines = Object.entries(entry.statBonusGrants).map(([s, k]) => {
      const shift = k === 'statPenalty' ? -2 : 2
      return `${shift > 0 ? '+' : ''}${shift} ${statName(s)}`
    })
    if (lines.length) {
      perks.push({ icon: 'trending_up', label: 'Stat Shift', detail: lines.join(' · ') })
    }
  }
  // Per-stat floor lifts (protected against debuffs). Distinct from cap.
  if (entry.statFloorBonuses) {
    const lines = Object.entries(entry.statFloorBonuses)
      .filter(([, n]) => (n as number) !== 0)
      .map(([k, n]) => `${statName(k)} +${n}`)
    if (lines.length) {
      perks.push({ icon: 'shield', label: 'Stat Floor Lift', detail: lines.join(' · ') })
    }
  }
  if (entry.statCapBonuses) {
    const lines = Object.entries(entry.statCapBonuses)
      .filter(([, n]) => (n as number) !== 0)
      .map(([k, n]) => `${statName(k)} +${n}`)
    if (lines.length) {
      perks.push({ icon: 'north', label: 'Stat Cap Raise', detail: lines.join(' · ') })
    }
  }
  // Global tier-floor bonus (lifts the whole stat ladder by N).
  if (entry.tierFloorBonus && entry.tierFloorBonus !== 0) {
    perks.push({
      icon: 'arrow_circle_up',
      label: 'Tier Floor Bonus',
      detail: `+${entry.tierFloorBonus} to every stat's floor`,
    })
  }
}

function appendItemGrants(perks: IdentityPerk[], entry: PerkSourceEntry) {
  const weaponList = joinItemList(entry.grantedWeapons)
  if (weaponList) {
    perks.push({ icon: 'swords', label: entry.grantedWeapons!.length > 1 ? 'Weapons Granted' : 'Weapon Granted', detail: weaponList })
  }
  const armorList = joinItemList(entry.grantedArmor)
  if (armorList) {
    perks.push({ icon: 'shield_locked', label: entry.grantedArmor!.length > 1 ? 'Armor Granted' : 'Armor Granted', detail: armorList })
  }
  // grantedPowerItems = structured grants with grade/element. grantedPowers
  // is the legacy string[] form. ClassEntry uses string[] for legacy +
  // grantedPowerItems for structured; WheelSegment uses GrantedItem[] for
  // both. Handle both shapes.
  const powerItems = (entry.grantedPowerItems as { label: string; grade?: string }[] | undefined)
    ?? (Array.isArray(entry.grantedPowers) && entry.grantedPowers.length > 0 && typeof entry.grantedPowers[0] === 'object'
        ? entry.grantedPowers as unknown as { label: string; grade?: string }[]
        : undefined)
  const powerList = joinItemList(powerItems)
  if (powerList) {
    perks.push({ icon: 'auto_awesome', label: powerItems!.length > 1 ? 'Powers Granted' : 'Power Granted', detail: powerList })
  } else if (Array.isArray(entry.grantedPowers) && entry.grantedPowers.length > 0 && typeof entry.grantedPowers[0] === 'string') {
    perks.push({ icon: 'auto_awesome', label: (entry.grantedPowers as string[]).length > 1 ? 'Powers Granted' : 'Power Granted', detail: (entry.grantedPowers as string[]).join(', ') })
  }
}

function appendMiscGrants(perks: IdentityPerk[], entry: PerkSourceEntry) {
  if (entry.grantedKeywords?.length) {
    perks.push({
      icon: 'sell',
      label: entry.grantedKeywords.length > 1 ? 'Perks Unlocked' : 'Perk Unlocked',
      detail: entry.grantedKeywords.join(' · '),
    })
  }
  if (entry.bonusSpins?.length) {
    perks.push({
      icon: 'casino',
      label: entry.bonusSpins.length > 1 ? 'Bonus Spins' : 'Bonus Spin',
      detail: entry.bonusSpins.map(b => b.displayName).join(' · '),
    })
  }
  if (entry.disableItemSpins?.length) {
    perks.push({
      icon: 'block',
      label: 'Disables Spins',
      detail: entry.disableItemSpins.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(' · '),
    })
  }
  if (entry.bypassHeightSpin) {
    perks.push({ icon: 'height', label: 'Bypasses Height', detail: 'Size hard-locked by this result' })
  }
  if (entry.redirectToRace) {
    perks.push({ icon: 'fork_right', label: 'Redirects to Race', detail: entry.redirectToRace })
  }
  if (entry.skipRemainingRacialExtras) {
    perks.push({ icon: 'skip_next', label: 'Ends Racial Spins', detail: 'Stops further race-specific wheels' })
  }
  if (entry.rareTag) {
    perks.push({ icon: 'star', label: 'Tagged', detail: entry.rareTag })
  }
}

/**
 * Find the pool entry that matches the rolled label and produce a structured
 * perk list describing everything it grants. Returns null when the spin
 * category isn't one we cover (item spins, stat spins, etc. surface their
 * info via the existing element/grade chips + description).
 */
export function buildSpinGrantPerks(args: {
  category: string
  raceLabel: string | null | undefined
  label: string
  raceWheelId?: string
}): IdentityPerk[] | null {
  const { category, raceLabel, label, raceWheelId } = args
  if (!raceLabel) return null
  const race = getRace(raceLabel)
  if (!race) return null

  let entry: PerkSourceEntry | undefined
  if (category === 'raceWheel' && raceWheelId) {
    const segs = getRaceWheelSegments(raceLabel, raceWheelId) as WheelSegment[] | null
    entry = segs?.find(s => s.label === label) as PerkSourceEntry | undefined
  } else if (category === 'raceSubType') {
    entry = race.subTypePool?.find(e => e.label === label)
  } else if (category === 'raceClass') {
    entry = race.classPool?.find(e => e.label === label)
  } else if (category === 'raceTransformation') {
    entry = race.transformationPool?.find(e => e.label === label)
  }
  if (!entry) return null

  const perks: IdentityPerk[] = []
  appendStatBonuses(perks, entry)
  appendItemGrants(perks, entry)
  appendMiscGrants(perks, entry)
  return perks.length ? perks : null
}
