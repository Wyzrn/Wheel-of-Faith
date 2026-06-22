// Summarizes what a racial progression outcome (sub-type / class /
// transformation) grants, for display on the spin result label. The grants
// themselves live on the race pool entries (statBonusGrants / grantedPowers /
// bonusSpins) — many injected by the augmentation in races.ts so no racial
// spin goes unrewarded. Used by both the main game and Story reveals so their
// labels read identically.

import { getRace } from '$lib/content/races'
import { getRaceWheelSegments } from '$lib/game/raceWheelRegistry'
import { twistByKey } from '$lib/twists'

const _STAT_LABELS: Record<string, string> = {
  strength: 'Strength', speed: 'Speed', agility: 'Agility', durability: 'Durability',
  iq: 'IQ', charisma: 'Charisma', fightingSkill: 'Fighting Skill', powerMastery: 'Power Mastery',
  weaponMastery: 'Weapon Mastery', potential: 'Potential', energyLevel: 'Energy',
}

type _Entry = {
  label: string
  statBonusGrants?: Record<string, 'statBonus' | 'statPenalty'>
  grantedPowers?: string[]
  bonusSpins?: { category: string; displayName: string }[]
}

export function describeRacialGrants(
  category: string,
  raceLabel: string | undefined | null,
  label: string,
  raceWheelId?: string,
): string | null {
  if (!raceLabel) return null
  const race = getRace(raceLabel)
  if (!race) return null
  let entry: _Entry | undefined
  if (category === 'raceWheel' && raceWheelId) {
    const segs = getRaceWheelSegments(raceLabel, raceWheelId) as _Entry[] | null
    entry = segs?.find(e => e.label === label)
  } else {
    const pool: _Entry[] | undefined =
      category === 'raceSubType' ? (race.subTypePool as _Entry[] | undefined)
      : category === 'raceClass' ? (race.classPool as _Entry[] | undefined)
      : category === 'raceTransformation' ? (race.transformationPool as _Entry[] | undefined)
      : undefined
    entry = pool?.find(e => e.label === label)
  }
  if (!entry) return null

  const parts: string[] = []
  // statBonusGrants spawns an EXTRA stat spin — not a flat bonus. Label
  // it as a Bonus Spin so the player isn't tricked into thinking "+Stat"
  // means a direct stat increase. Flat shifts surface separately via
  // the structured perk list (flatStatBonuses → "+N Stat" row).
  for (const [stat, kind] of Object.entries(entry.statBonusGrants ?? {})) {
    const name = _STAT_LABELS[stat] ?? stat
    parts.push(kind === 'statPenalty' ? `Bonus ${name} Penalty Spin` : `Bonus ${name} Spin`)
  }
  for (const p of entry.grantedPowers ?? []) parts.push(`Unlocks ${p}`)
  for (const b of entry.bonusSpins ?? []) {
    parts.push(
      b.category === 'weakness' ? 'an Innate Flaw'
      : b.category === 'weapon' ? 'a Signature Weapon'
      : b.category === 'armor' ? 'Natural Armor'
      : b.displayName,
    )
  }
  return parts.length ? `Grants ${parts.join(' · ')}` : null
}

// Twist outcomes (Chaos Factor, Power Level, etc.) carry a `flavor` line and
// stat/element effects. Returns both so the reveal can show the flavor as the
// description and the effects in the reward badge.
export function describeTwist(
  twistKind: string | undefined | null,
  label: string,
): { flavor: string | null; grants: string | null } {
  if (!twistKind) return { flavor: null, grants: null }
  const eff = twistByKey(twistKind)?.effects?.[label]
  if (!eff) return { flavor: null, grants: null }
  const parts: string[] = []
  for (const [stat, kind] of Object.entries(eff.statBonusGrants ?? {})) {
    const name = _STAT_LABELS[stat] ?? stat
    parts.push(kind === 'statPenalty' ? `−${name}` : `+${name}`)
  }
  if (eff.lockElement) parts.push(`${eff.lockElement} bias`)
  return {
    flavor: eff.flavor ?? null,
    grants: parts.length ? `Grants ${parts.join(' · ')}` : null,
  }
}
