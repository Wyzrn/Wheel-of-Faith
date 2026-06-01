// Auto-generated character summary. Runs after the 23rd spin to produce a
// 2-3 sentence narrative "roast" that combines the rolled race, archetype,
// best+worst stat, signature power, and top weakness into a single line the
// player can share. Inspired by the spin-result wheel format's post-spin
// narration — every roll deserves a one-liner, not just stats.
//
// Deterministic given the same inputs (template choice seeded by name +
// race + archetype hash) so re-mounting the same character produces the
// same summary every time.

import type { SpinResult } from '$lib/session/types'
import type { TierGrade } from '$lib/game/scoreTier'
import { TIER_THRESHOLDS } from '$lib/game/scoreTier'
import { GIMMICKS, RACE_GIMMICKS, ARCHETYPE_GIMMICKS } from '$lib/gimmicks'

const STAT_CATEGORIES = [
  'strength', 'speed', 'agility', 'durability', 'iq',
  'charisma', 'fightingSkill', 'potential', 'energyLevel',
  'powerMastery', 'weaponMastery', 'armorStrength',
] as const

const STAT_NAMES: Record<string, string> = {
  strength: 'STR', speed: 'SPD', agility: 'AGI', durability: 'DUR',
  iq: 'IQ', charisma: 'CHA', fightingSkill: 'fighting skill',
  potential: 'potential', energyLevel: 'energy', powerMastery: 'power mastery',
  weaponMastery: 'weapon mastery', armorStrength: 'armor',
}

const STAT_HIGH_FLAVOR: Record<string, string[]> = {
  strength:      ['arm-snapping strength', 'overwhelming muscle', 'crushing force'],
  speed:         ['blink-and-miss speed', 'unfair reflexes', 'lightning footwork'],
  agility:       ['absurd agility', 'impossible-to-pin movement', 'serpentine grace'],
  durability:    ['tank-grade durability', 'won\'t-stay-down toughness', 'absurd resilience'],
  iq:            ['galaxy-brain intellect', 'absurd cunning', 'four-moves-ahead tactics'],
  charisma:      ['main-character charisma', 'unfair charm', 'gravitational presence'],
  fightingSkill: ['savant-tier combat', 'instinctive technique', 'martial mastery'],
  potential:     ['limitless potential', 'untapped wellspring', 'plot-armor potential'],
  energyLevel:   ['endless gas tank', 'reactor-core stamina', 'never-tired energy'],
  powerMastery:  ['ironclad power control', 'surgical power mastery', 'finishing-move precision'],
  weaponMastery: ['weapon-savant precision', 'lifetime-of-practice handling', 'casual lethal skill'],
  armorStrength: ['armor that laughs at swords', 'reinforced shell', 'unbreakable plating'],
}

const STAT_LOW_FLAVOR: Record<string, string[]> = {
  strength:      ['noodle arms', 'wet-paper grip', 'embarrassing pushup count'],
  speed:         ['quicksand reflexes', 'reading-in-slow-mo pace', 'glacier footwork'],
  agility:       ['bowling-pin balance', 'unfortunate clumsiness', 'falls down stairs'],
  durability:    ['glass jaw', 'origami bones', 'breaks if you look at them wrong'],
  iq:            ['microwave-tier IQ', 'eats crayons regularly', 'cannot find their keys ever'],
  charisma:      ['the social grace of damp cardboard', 'wallpaper-tier charisma', 'awkward in every conversation'],
  fightingSkill: ['fights like a tax accountant', 'haymaker-only repertoire', 'no fundamentals whatsoever'],
  potential:     ['ceiling already hit', 'topped out at age 12', 'no growth left'],
  energyLevel:   ['needs a nap mid-fight', 'reactor empty', 'gasses out by round two'],
  powerMastery:  ['accidentally levels civilians', 'cannot aim a fireball to save their life', 'collateral damage incarnate'],
  weaponMastery: ['holds the weapon backward sometimes', 'cuts themselves more than enemies', 'untrained but earnest'],
  armorStrength: ['armor held together by hope', 'fashion over function', 'cosmetic-only protection'],
}

const OPENING_HOOKS: string[] = [
  'A {race} {archetype}',
  'One part {race}, one part {archetype}',
  'A {race} who took the {archetype} path',
  'A {archetype}-classed {race}',
  'The {race} {archetype} the world warned you about',
]

const MID_CONJUNCTIONS = ['Carries', 'Wields', 'Brings', 'Packs']

// Deterministic seeded pick — same inputs always produce the same template.
function hashString(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i)
  return (h >>> 0)
}
function seedPick<T>(arr: T[], seed: number, salt: number = 0): T {
  return arr[(seed + salt) % arr.length]
}

// Resolve tier rank for a stat result. Maps F- = 0 → Absolute+ = highest.
function tierRank(tier: string | undefined): number {
  if (!tier) return -1
  const idx = TIER_THRESHOLDS.findIndex(t => t.grade === tier)
  return idx >= 0 ? idx : -1
}

// ─── Public API ───────────────────────────────────────────────────────────
export interface CharacterSummary {
  // The full narrative line, 2-3 sentences.
  text: string
  // Optional structured pieces so callers can layout / style differently.
  race: string
  archetype: string
  topStat?: string
  topStatTier?: TierGrade
  bottomStat?: string
  bottomStatTier?: TierGrade
  signaturePower?: string
  topWeakness?: string
  gimmickHighlight?: string
}

export function generateCharacterSummary(
  results: SpinResult[],
  name: string,
): CharacterSummary {
  const race      = results.find(r => r.category === 'race')?.resultLabel ?? 'Unknown'
  const archetype = results.find(r => r.category === 'archetype')?.resultLabel ?? 'Unknown'
  const seed = hashString(`${name}|${race}|${archetype}`)

  // Pick best + worst stat among the canonical 12.
  const statResults = results.filter(r => STAT_CATEGORIES.includes(r.category as typeof STAT_CATEGORIES[number]))
  let topStat: string | undefined; let topStatTier: TierGrade | undefined; let topRank = -1
  let botStat: string | undefined; let botStatTier: TierGrade | undefined; let botRank = Infinity
  for (const s of statResults) {
    const rank = tierRank(s.tier)
    if (rank < 0) continue
    if (rank > topRank) { topRank = rank; topStat = s.category; topStatTier = s.tier }
    if (rank < botRank) { botRank = rank; botStat = s.category; botStatTier = s.tier }
  }

  // Signature power: first power result (already presented in order rolled).
  const signaturePower = results.find(r => r.category === 'power')?.resultLabel

  // Top weakness: just the first weakness rolled (most prominent in the
  // identity).
  const topWeakness = results.find(r => r.category === 'weakness')?.resultLabel

  // Notable gimmick — surface the FIRST race+archetype gimmick name as a
  // tagline modifier ("with Last Stand instincts", etc.).
  const gimmicks = [
    ...(RACE_GIMMICKS[race] ?? []),
    ...(ARCHETYPE_GIMMICKS[archetype] ?? []),
  ]
  const gimmickHighlight = gimmicks.length > 0 ? (GIMMICKS[gimmicks[0]]?.name) : undefined

  // ── Build the summary text ──────────────────────────────────────────────
  const opener = seedPick(OPENING_HOOKS, seed, 0)
    .replace('{race}', race)
    .replace('{archetype}', archetype)

  const parts: string[] = [opener]

  // Strength + weakness clause.
  if (topStat && botStat && topStat !== botStat) {
    const hi = seedPick(STAT_HIGH_FLAVOR[topStat] ?? [STAT_NAMES[topStat] ?? topStat], seed, 1)
    const lo = seedPick(STAT_LOW_FLAVOR[botStat] ?? [STAT_NAMES[botStat] ?? botStat], seed, 2)
    parts.push(`${hi} — paired with ${lo}.`)
  } else if (topStat) {
    const hi = seedPick(STAT_HIGH_FLAVOR[topStat] ?? [STAT_NAMES[topStat] ?? topStat], seed, 1)
    parts.push(`${hi} across the board.`)
  } else {
    parts.push('Stat sheet that defies easy reading.')
  }

  // Closing flourish: prefer gimmick + signature power, fall back to either,
  // fall back to weakness, fall back to a generic line.
  const conj = seedPick(MID_CONJUNCTIONS, seed, 3)
  if (gimmickHighlight && signaturePower) {
    parts.push(`${conj} "${signaturePower}" with ${gimmickHighlight} backing every swing.`)
  } else if (signaturePower && topWeakness) {
    parts.push(`${conj} "${signaturePower}" — just don't mention ${topWeakness.toLowerCase()}.`)
  } else if (signaturePower) {
    parts.push(`${conj} "${signaturePower}" into every fight.`)
  } else if (topWeakness) {
    parts.push(`Don't bring up ${topWeakness.toLowerCase()} at the dinner table.`)
  } else if (gimmickHighlight) {
    parts.push(`${gimmickHighlight} is doing a lot of heavy lifting on this build.`)
  } else {
    parts.push('Will probably be remembered for at least one of these.')
  }

  return {
    text: parts.join(' — ').replace(/—\s*—/g, '—'),
    race,
    archetype,
    topStat,
    topStatTier,
    bottomStat: botStat,
    bottomStatTier: botStatTier,
    signaturePower,
    topWeakness,
    gimmickHighlight,
  }
}
