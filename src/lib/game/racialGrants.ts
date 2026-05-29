// Summarizes what a racial progression outcome (sub-type / class /
// transformation) grants, for display on the spin result label. The grants
// themselves live on the race pool entries (statBonusGrants / grantedPowers /
// bonusSpins) — many injected by the augmentation in races.ts so no racial
// spin goes unrewarded. Used by both the main game and Story reveals so their
// labels read identically.

import { getRace } from '$lib/content/races'
import { getRaceWheelSegments } from '$lib/game/raceWheelRegistry'

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
  for (const [stat, kind] of Object.entries(entry.statBonusGrants ?? {})) {
    const name = _STAT_LABELS[stat] ?? stat
    parts.push(kind === 'statPenalty' ? `−${name}` : `+${name}`)
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
