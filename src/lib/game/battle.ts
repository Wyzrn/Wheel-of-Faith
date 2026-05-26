// battle.ts — Procedural battle simulation for Rivals Mode.
// Tier-scaled HP/damage, full stat mechanics. Pure functions only. No default export.

import type { SpinResult } from '$lib/session/types'
import { TIER_THRESHOLDS, scoreTier, extendedTierFromScore } from '$lib/game/scoreTier'
import type { TierGrade } from '$lib/game/scoreTier'
import { powers as powersPool } from '$lib/content/powers'
import { weapons as weaponsPool } from '$lib/content/weapons'
import { armors as armorsPool } from '$lib/content/armors'
import { ITEM_GRADE_INFO, highestGrade } from '$lib/content/elements'
import type { AttackType, ElementType } from '$lib/content/types'

// Grade lookup maps — built once at module load
const _powerMap  = new Map(powersPool.map(p => [p.label, p]))
const _weaponMap = new Map(weaponsPool.map(w => [w.label, w]))
const _armorMap  = new Map(armorsPool.map(a => [a.label, a]))

// ─── HP Table ─────────────────────────────────────────────────────────────────
// F- through C+ are user-specified. Higher tiers extrapolated ~2× per major tier.
const HP_TABLE: Record<string, number> = {
  'F-': 50,          'F': 100,          'F+': 150,
  'E-': 200,         'E': 300,          'E+': 400,
  'D-': 500,         'D': 650,          'D+': 800,
  'C-': 1_000,       'C': 1_250,        'C+': 1_500,
  'B-': 2_000,       'B': 2_500,        'B+': 3_000,
  'A-': 4_000,       'A': 5_000,        'A+': 6_500,
  'S-': 8_000,       'S': 10_000,       'S+': 13_000,
  'SS-': 17_000,     'SS': 22_000,      'SS+': 28_000,
  'SSS-': 36_000,    'SSS': 47_000,     'SSS+': 60_000,
  'Z-': 78_000,      'Z': 100_000,      'Z+': 130_000,
  'ZZ-': 170_000,    'ZZ': 220_000,     'ZZ+': 280_000,
  'ZZZ-': 360_000,   'ZZZ': 470_000,    'ZZZ+': 600_000,
  'Celestial-': 780_000, 'Celestial': 1_000_000, 'Celestial+': 1_300_000,
  'Godly-': 1_700_000,   'Godly': 2_200_000,
  'Primordial': 3_000_000,
  'Primordial+': 4_000_000,
  'Absolute-': 5_200_000,
  'Absolute': 6_800_000,
  'Absolute+': 9_000_000,
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface SummonedUnit {
  name: string
  hp: number
  maxHp: number
  damage: number
  element?: ElementType
}

export interface BattleCharacter {
  name: string
  raceLabel: string
  archetypeLabel: string
  hp: number
  maxHp: number
  physicalDamage: number   // base physical/weapon hit damage
  powerDamage: number      // base power hit damage
  armorReduction: number   // 0–0.80 fraction of damage absorbed
  armorType: string
  weaponType: string
  agilityRank: number      // 0–41 tier index
  speedRank: number
  charismaRank: number
  iqRank: number
  potentialRank: number
  energyRank: number
  fightingSkillRank: number
  weaponEnchantTags: string[]
  armorEnchantTags: string[]
  critChance: number
  critMultiplier: number
  dodgeChance: number
  initiative: number
  moves: BattleMove[]
  // Extended fields
  elementWeaknesses: ElementType[]   // elements that deal +25% damage to this character
  statusImmunities: string[]         // status types this character cannot receive
  passiveHealPerRound: number        // HP restored at start of each round (regen passives)
  powerDamageReduction: number       // 0–0.6; reduces power-type damage taken
  physicalDamageReduction: number    // 0–0.6; reduces physical-type damage taken
  damageReductionCap: number         // normally 0.80; "invincible"-type passives raise to 0.88
  summons: SummonedUnit[]            // currently active summoned allies
  buffMultiplier: number             // damage multiplier from active buff (1.0 = none)
  buffRoundsLeft: number             // rounds remaining on buff
}

export interface BattleMove {
  name: string
  type: 'physical' | 'power' | 'ability'
  effectTag: string | null
  behavior: 'attack' | 'defend' | 'heal'
  attackType: AttackType             // classified attack behaviour
  element?: ElementType              // elemental affinity of this move
  grade?: string                     // item grade (F–God) — drives FX intensity
}

export interface RoundFxEvent {
  attackerSide: 'p1' | 'p2' | 'team1' | 'team2'
  attackerIdx: number
  targetIdxs: number[]     // always 1 for single-target; multiple for AOE
  element?: ElementType
  grade?: string
  attackType: AttackType
  isCrit: boolean
}

export interface BattleRound {
  roundNum: number
  p1Hp: number
  p2Hp: number
  p1HpBefore: number
  p2HpBefore: number
  lines: string[]
  winner?: 'p1' | 'p2' | 'draw'
  fxEvents?: RoundFxEvent[]         // visual FX triggers for the UI layer
  p1SummonHp?: number               // summon HP (-1 if none)
  p2SummonHp?: number
}

// ─── Flavor Data ──────────────────────────────────────────────────────────────

const EFFECT_TAGS: Array<{ keywords: string[]; tag: string }> = [
  { keywords: ['fire','flame','blaze','inferno','burn','ember','magma','lava','heat'],         tag: 'burn' },
  { keywords: ['shadow','dark','void','abyss','death','soul','drain','leech','blood','curse'], tag: 'lifesteal' },
  { keywords: ['lightning','thunder','electric','storm','volt','spark','shock','arc'],         tag: 'stun' },
  { keywords: ['ice','frost','freeze','cryo','blizzard','snow','cold','glacier'],              tag: 'slow' },
  { keywords: ['divine','holy','celestial','angel','sacred','light','radiant','blessed'],      tag: 'heal' },
  { keywords: ['time','temporal','chrono','rewind','haste','blink','phase'],                   tag: 'double' },
  { keywords: ['psychic','mind','telepathy','mental','chaos','reality','warp','phantom'],      tag: 'pierce' },
  { keywords: ['poison','acid','toxic','venom','plague','rot','corrosive','bio'],              tag: 'poison' },
  { keywords: ['gravity','black hole','collapse','weight','crush','mass','singularity'],       tag: 'crush' },
]

const EFFECT_FLAVOR: Record<string, string> = {
  burn:      '{target} is left scorched and smoldering!',
  lifesteal: '{attacker} siphons {heal} HP of vital essence!',
  stun:      'The shock disrupts {target}\'s rhythm entirely!',
  slow:      '{target} staggers, movements slowed by bitter cold!',
  heal:      'Radiant energy restores {heal} HP to {attacker}!',
  double:    'Time itself stutters — the blow lands twice!',
  pierce:    'The attack cuts straight through all defenses!',
  poison:    '{target} reels, body seizing under spreading toxin!',
  crush:     'Gravity bends — {target} is crushed under impossible weight!',
}

const ATTACK_VERBS = [
  'unleashes', 'channels', 'fires', 'crashes into', 'hammers',
  'obliterates with', 'detonates', 'hurls', 'blasts with', 'tears into',
  'drives', 'smashes with', 'conjures', 'summons', 'launches', 'rips through with',
  'shatters reality with', 'erupts in', 'descends with', 'annihilates with',
]

const CRIT_LABELS = [
  'CRITICAL HIT —', 'DEVASTATING BLOW —', 'PERFECT STRIKE —',
  'OVERWHELMING FORCE —', 'UNSTOPPABLE —', 'OVERKILL —',
  'SKULL FRACTURE —', 'PLANET-SPLITTING —', 'ABSOLUTE DESTRUCTION —',
]

const DODGE_PHRASES = [
  'narrowly dodges', 'weaves around', 'barely evades',
  'slips past', 'anticipates and sidesteps', 'deflects',
  'phases through', 'blinks away from', 'mirrors away',
]

const RIPOSTE_LINES = [
  '{name} exploits the opening — lightning riposte for {dmg}!',
  '{name} turns the dodge into a brutal counter — {dmg} damage!',
  '{name} reads the attack perfectly and punishes — {dmg}!',
  '{name}\'s reflexes are terrifying — counter for {dmg}!',
]

const BERSERKER_LINES = [
  '🔥 {name} snaps — cornered, desperate — BERSERKER FURY UNLEASHED!',
  '💢 {name}\'s wounds fuel absolute rage — LAST STAND!',
  '⚡ {name} breaks all limits — the arena trembles!',
  '🩸 {name} fights through the pain — DESPERATION DRIVE!',
]

const ENVIRONMENTAL_EVENTS = [
  '⚡ A bolt of lightning sears the arena — combatants feel the surge!',
  '🌑 Darkness swallows the field — instinct replaces sight!',
  '🔥 The ground erupts in flame — the battlefield itself attacks!',
  '💨 A phantom wind howls through — movements become erratic!',
  '✨ Reality fractures — the laws of physics temporarily shatter!',
  '🌊 A tidal surge floods the arena — footing becomes treacherous!',
  '🌕 The moon blazes blood-red — ancient powers stir within!',
  '☄️ A meteor grazes the field — shockwaves ripple through everything!',
  '🕳️ Space warps — combatants phase in and out of existence!',
  '💀 The Reaper watches — every strike now carries mortal weight!',
  '🌪️ A vortex tears open at the center — both sides are buffeted!',
  '👁️ Something vast and unknowable turns its gaze upon the battle.',
]

const STATUS_APPLY_LINES: Record<string, string[]> = {
  burn:   ['{name} ignites — they\'re on fire!', '{name}\'s form erupts in flame!'],
  poison: ['{name} is poisoned — toxin spreads through their body!', '{name} staggers, venom coursing through them!'],
  freeze: ['{name} is frozen solid!', 'Ice encases {name} — they can\'t move!'],
  weaken: ['{name}\'s strength is sapped — weakened!'],
}

const STATUS_TICK_LINES: Record<string, string[]> = {
  burn:   ['🔥 {name} takes {dmg} burn damage!', '🔥 Flames consume {name} — {dmg} damage!'],
  poison: ['☠️ Poison tears through {name} — {dmg} damage!', '☠️ {name} writhes under spreading toxin — {dmg}!'],
}

const DEFEND_PHRASES = [
  '{name} focuses inward — an impenetrable barrier forms!',
  '{name} hardens their form, bracing for the next blow!',
  '{name} enters a defensive stance, nullifying incoming damage!',
  '{name}\'s defense flares to life — untouchable for a moment!',
  '{name} channels energy into a protective shell!',
]

const HEAL_PHRASES = [
  '{name}\'s wounds seal themselves with crackling energy!',
  '{name} breathes deep — vital force floods back in!',
  '{name} focuses — cellular regeneration kicks in!',
  '{name}\'s body mends rapidly before the enemy\'s eyes!',
  '{name} draws on hidden reserves, restoring their vitality!',
]

const STUPID_MISTAKES = [
  '{name} trips mid-charge and face-plants gloriously.',
  '{name} winds up for a huge attack and punches themselves.',
  '{name} forgets what they were doing and stares blankly at the sky.',
  '{name} attempts an elaborate combo and gets tangled up in themselves.',
  '{name} shouts their attack name for so long the moment completely passes.',
  '{name} tries something flashy, slips, and the turn evaporates.',
]

const CHARISMA_FUMBLES = [
  '{name} says something so embarrassing their opponent stops to mock them.',
  '{name}\'s battle cry comes out as a mortifying squeak.',
  '{name} opens their mouth and the awkwardness is so palpable they freeze.',
  '{name}\'s attempt at intimidation somehow inspires pity.',
]

const CHARM_LINES = [
  '{defender} speaks softly — {attacker} suddenly feels the urge to apologize.',
  '{defender}\'s sheer presence stops {attacker} cold. The attack never comes.',
  '{attacker} meets {defender}\'s gaze and completely forgets what they were doing.',
]

const INTIMIDATE_LINES = [
  '{attacker} fixes {defender} with a terrifying stare — {defender}\'s resolve shatters!',
  '{attacker}\'s presence alone makes {defender}\'s knees buckle!',
  '{attacker} points menacingly and {defender}\'s guard drops entirely.',
]

// ─── Utility ──────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ─── Attack Type Detection ─────────────────────────────────────────────────────

const PASSIVE_KW = [
  'invincib', 'invulnerab', 'immortal', 'eternal life', 'undying will', 'undying body',
  'absolute defense', 'perfect defense', 'unbreakable', 'indestructible existence',
  'passive', 'always active', 'aura of protection', 'aura of endurance',
  'absorb damage', 'permanent', 'damage resist', 'power resist', 'magic resist',
  'nullif', 'immune to', 'immunity', 'nullify poison', 'nullify fire',
  'infinite regeneration', 'auto-heal', 'auto-repair', 'self-repair', 'regeneration passiv',
  'natural armor', 'hardened skin', 'iron body', 'titan body', 'body of steel',
  'divine protection', 'holy aura', 'blessed existence', 'sacred aura',
  'mana shell', 'ki armor', 'energy armor', 'astral body',
  'power nullification', 'anti-magic', 'magic immunity', 'anti-demon', 'scripture ward',
]
const SUMMON_KW = [
  'summon', 'conjure', 'manifest ally', 'call forth', 'raise army', 'invoke spirit',
  'spirit call', 'familiar', 'servant', 'army of', 'horde', 'legion',
  'minion', 'ally manifestation', 'phantom army', 'undead legion', 'shadow clone',
  'clone', 'duplicate', 'doppelganger', 'shadow copy', 'echo',
]
const AOE_KW = [
  'eruption', 'explosion', 'tidal wave', 'rain of', 'meteor shower', 'apocalypse',
  'annihilation wave', 'area', 'widespread', 'scatter', 'barrage', 'cascade',
  'storm', 'burst', 'shockwave', 'flood', 'blizzard', 'inferno', 'wildfire',
  'firestorm', 'thunderstorm', 'quake', 'earthquake', 'nova', 'aoe',
  'world-ending', 'planet-wide', 'all enemies', 'dimensional rift', 'void storm',
  'stellar detonation', 'galactic', 'cosmic ray', 'reality shatter', 'existence erasure',
]
const DEBUFF_KW = [
  'paralyze', 'paralysis', 'freeze', 'frozen', 'poison', 'corrode', 'corrosion',
  'wither', 'withering', 'curse', 'hex', 'weaken', 'slow', 'blind', 'silence',
  'petrify', 'stun', 'cripple', 'rot', 'decay', 'drain', 'sap', 'afflict',
  'plague', 'disease', 'enervate', 'enfeeble', 'fatigue', 'exhaust',
  'dark binding', 'terror', 'fear', 'dread', 'despair', 'confusion', 'chaos touch',
]
const BUFF_KW = [
  'enhance', 'empower', 'strengthen', 'haste', 'rally', 'inspire', 'bless',
  'fortify', 'reinforce', 'speed boost', 'battle cry', 'war cry', 'protect allies',
  'power boost', 'shield allies', 'cover', 'aura of strength', 'aura of speed',
  'soul link', 'shared power', 'unity', 'synergy', 'team buff', 'power surge',
  'limit break', 'overdrive', 'hyper mode', 'power awakening',
]
const HEAL_KW = [
  'healing', 'regenerat', 'mend', 'restor', 'revive', 'resurrect',
  'life force', 'second wind', 'cure', 'vitality', 'recover', 'phoenix rebirth',
  'lay on hands', 'blessed healer', 'sacred heal', 'regrowth', 'song of rest',
  'sanity restoration', 'reverse cursed', 'life drain', 'empathic healing',
]

export function detectAttackType(label: string, explicitType?: AttackType): AttackType {
  if (explicitType) return explicitType
  const l = label.toLowerCase()
  if (PASSIVE_KW.some(k => l.includes(k))) return 'passive'
  if (SUMMON_KW.some(k => l.includes(k)))  return 'summon'
  if (AOE_KW.some(k => l.includes(k)))     return 'aoe'
  if (DEBUFF_KW.some(k => l.includes(k)))  return 'debuff'
  if (BUFF_KW.some(k => l.includes(k)))    return 'buff'
  if (HEAL_KW.some(k => l.includes(k)))    return 'heal'
  return 'attack'
}

// Detects which element a weakness label corresponds to
export function detectWeaknessElement(label: string): ElementType | undefined {
  const lower = label.toLowerCase()
  const ELEMENTS: ElementType[] = [
    'Fire','Ice','Lightning','Earth','Wind','Shadow','Light','Arcane','Nature',
    'Void','Cosmic','Blood','Metal','Soul','Poison','Time','Water','Sound',
    'Gravity','Psychic','Chaos','Neutral',
  ]
  for (const el of ELEMENTS) {
    if (lower.includes(el.toLowerCase())) return el
  }
  return undefined
}

// Summon stat % by grade
const SUMMON_STAT_PCT: Record<string, number> = {
  F: 0.10, E: 0.14, D: 0.20, C: 0.28, B: 0.38, A: 0.50,
  S: 0.64, SS: 0.78, SSS: 0.92, God: 1.10,
}

function detectEffectTag(label: string): string | null {
  const lower = label.toLowerCase()
  for (const entry of EFFECT_TAGS) {
    if (entry.keywords.some(kw => lower.includes(kw))) return entry.tag
  }
  return null
}

function detectMoveBehavior(label: string): 'attack' | 'defend' | 'heal' {
  const lower = label.toLowerCase()
  const defendKws = [
    'invulnerabilit', 'invincible', 'indestructible', 'barrier', 'force field',
    'deflect', 'parry', 'phase shifting', 'intangib', 'spectral form', 'void form',
    'ethereal form', 'ghost form', 'untouchable', 'impenetrable', 'anti-magic aura',
    'nullity zone', 'plot armour', 'plot armor', 'hardening', 'barkskin', 'mana shield',
    'psychic shield', 'mind fortress', 'crystal armor', 'infernal armor', 'stone endurance',
    'lava shield', 'beskar armor', 'radiant shield', 'counterspell', 'spell absorption',
    'magic reflection', 'power nullification', 'anti-demon barrier', 'scripture ward',
    'evasion', 'vanishing act', 'camouflage', 'shadow cloak', 'shadow veil',
    'iron body', 'holy aura', 'sacred vow', 'armored titan', 'shield wall',
    'runic ward', 'bari bari', 'absolute defense', 'perfect defense', 'deflection',
    'reflection', 'absorb', 'negate', 'nullif', 'resist',
  ]
  const healKws = [
    'healing factor', 'regenerat', 'cellular regeneration', 'bioregeneration',
    'second wind', 'vitality transfer', 'phoenix rebirth', 'phoenix mythical',
    'empathic healing', 'lay on hands', 'blessed healer', 'sacred heal',
    'regrowth', 'song of rest', 'sanity restoration', 'reverse cursed',
    'auto-heal', 'auto-repair', 'self-repair', 'life force', 'rejuvenat',
    'undying', 'rebirth', 'mend', 'restor', 'revive', 'resurrect',
  ]
  if (defendKws.some(kw => lower.includes(kw))) return 'defend'
  if (healKws.some(kw => lower.includes(kw))) return 'heal'
  return 'attack'
}

function getTier(results: SpinResult[], category: string): TierGrade {
  const r = results.find(s => s.category === category)
  if (r?.tier) return r.tier
  if (r?.score !== undefined) return scoreTier(r.score)
  return 'F-'
}

// Returns displayLabel when it's an "Absolute+N" extended grade, else falls back to tier/score.
function getDisplayTier(results: SpinResult[], category: string): string {
  const r = results.find(s => s.category === category)
  if (r?.displayLabel && /^Absolute\+\d+$/.test(r.displayLabel)) return r.displayLabel
  if (r?.tier) return r.tier
  if (r?.score !== undefined) return scoreTier(r.score)
  return 'F-'
}

function tierRank(grade: string): number {
  const idx = TIER_THRESHOLDS.findIndex(t => t.grade === grade)
  if (idx >= 0) return idx
  const m = /^Absolute\+(\d+)$/.exec(grade)
  if (m) return TIER_THRESHOLDS.length - 1 + parseInt(m[1])
  return 0
}

function hpForTier(grade: string): number {
  const val = HP_TABLE[grade as TierGrade]
  if (val !== undefined) return val
  // "Absolute+N" (N = 1..20): exponential scale from 9M base at ~18% per step
  const m = /^Absolute\+(\d+)$/.exec(grade)
  if (m) return Math.round(9_000_000 * Math.pow(1.18, parseInt(m[1])))
  return 50
}

export function formatHp(hp: number): string {
  if (hp >= 1_000_000) {
    const m = hp / 1_000_000
    return (m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)) + 'M'
  }
  if (hp >= 10_000) return Math.round(hp / 1_000) + 'K'
  return hp.toString()
}

// ─── Build ────────────────────────────────────────────────────────────────────

interface CrystalEquipInput { grade: string; name: string }
interface EquippedCrystals {
  weapons?: CrystalEquipInput[]
  armors?:  CrystalEquipInput[]
  powers?:  CrystalEquipInput[]
}

export function buildBattleCharacter(
  results: SpinResult[],
  name: string,
  equipped?: EquippedCrystals,
  statMultiplier?: number,
): BattleCharacter {
  const rs = results
  const durTier    = getDisplayTier(rs, 'durability')
  const strTier    = getDisplayTier(rs, 'strength')
  const elTier     = getDisplayTier(rs, 'energyLevel')
  const potTier    = getDisplayTier(rs, 'potential')
  const armStrTier = getDisplayTier(rs, 'armorStrength')

  const agilityRank       = tierRank(getDisplayTier(rs, 'agility'))
  const speedRank         = tierRank(getDisplayTier(rs, 'speed'))
  const charismaRank      = tierRank(getDisplayTier(rs, 'charisma'))
  const iqRank            = tierRank(getDisplayTier(rs, 'iq'))
  const potentialRank     = tierRank(potTier)
  const energyRank        = tierRank(elTier)
  const fightingSkillRank = tierRank(getDisplayTier(rs, 'fightingSkill'))
  const armStrRank        = tierRank(armStrTier)

  const hp = Math.round(
    hpForTier(durTier) * 0.55 +
    hpForTier(strTier) * 0.20 +
    hpForTier(elTier)  * 0.15 +
    hpForTier(potTier) * 0.10
  )

  const powerLabels  = rs.filter(r => r.category === 'power').map(r => r.resultLabel)
  const weaponLabel  = rs.find(r => r.category === 'weapon')?.resultLabel ?? ''
  const armorLabel   = rs.find(r => r.category === 'armor')?.resultLabel  ?? ''
  const topPowerGrade  = highestGrade(powerLabels.map(l => _powerMap.get(l)?.grade))
  const weaponGradeVal = _weaponMap.get(weaponLabel)?.grade ?? 'F'
  const armorGradeVal  = _armorMap.get(armorLabel)?.grade  ?? 'F'
  let powerGradeMult  = 1 + ITEM_GRADE_INFO[topPowerGrade].battleBonus  / 100
  let weaponGradeMult = 1 + ITEM_GRADE_INFO[weaponGradeVal].battleBonus / 100
  let armorGradeFlat  = ITEM_GRADE_INFO[armorGradeVal].battleBonus * 0.003
  // Crystal-equipped gear adds 25% of its grade bonus on top of the base spin gear
  for (const ew of equipped?.weapons ?? []) { const info = ITEM_GRADE_INFO[ew.grade as import('$lib/content/types').ItemGrade]; if (info) weaponGradeMult += info.battleBonus / 100 * 0.25 }
  for (const ep of equipped?.powers  ?? []) { const info = ITEM_GRADE_INFO[ep.grade as import('$lib/content/types').ItemGrade]; if (info) powerGradeMult  += info.battleBonus / 100 * 0.25 }
  for (const ea of equipped?.armors  ?? []) { const info = ITEM_GRADE_INFO[ea.grade as import('$lib/content/types').ItemGrade]; if (info) armorGradeFlat  += info.battleBonus * 0.003 * 0.25 }

  const strScore = rs.find(r => r.category === 'strength')?.score ?? 28
  const fskScore = rs.find(r => r.category === 'fightingSkill')?.score ?? 28
  const wmScore  = rs.find(r => r.category === 'weaponMastery')?.score ?? 28
  const physDamageTier = extendedTierFromScore(Math.round(strScore * 0.25 + fskScore * 0.55 + wmScore * 0.20))
  const physicalDamage = Math.round(hpForTier(physDamageTier) / 2 * weaponGradeMult)

  const pmScore = rs.find(r => r.category === 'powerMastery')?.score ?? 28
  const elScore = rs.find(r => r.category === 'energyLevel')?.score ?? 28
  const pwrDamageTier = extendedTierFromScore(Math.round(pmScore * 0.60 + elScore * 0.40))
  const powerDamage = Math.round(hpForTier(pwrDamageTier) / 2 * powerGradeMult)

  const armorTypeLabel = rs.find(r => r.category === 'armorType')?.resultLabel ?? 'None'
  const baseArmor = 0.05 + (armStrRank / (TIER_THRESHOLDS.length - 1)) * 0.45
  const ARMOR_TYPE_MULT: Record<string, number> = {
    'None': 0, 'Helmet Only': 0.40, 'Half-Suit': 0.70,
    'Full-Suit': 1.0, 'Exotic': 0.85, 'Cursed': 0.75, 'Ancient': 1.15,
  }
  const armorReduction = Math.min(0.62, baseArmor * (ARMOR_TYPE_MULT[armorTypeLabel] ?? 1.0) + armorGradeFlat)

  const weaponTypeLabel = rs.find(r => r.category === 'weaponType')?.resultLabel ?? 'Melee'

  const toTag = (r: SpinResult) => detectEffectTag(r.resultLabel)
  const weaponEnchantTags = rs
    .filter(r => r.category === 'weaponEnchantment')
    .map(toTag).filter((t): t is string => t !== null)
  const armorEnchantTags = rs
    .filter(r => r.category === 'armorEnchantment')
    .map(toTag).filter((t): t is string => t !== null)

  const critChance     = Math.max(0.05, Math.min(0.45, (fightingSkillRank + potentialRank) / 82 * 0.45))
  const critMultiplier = Math.min(2.5, 1.5 + potentialRank / 41)
  const dodgeChance    = Math.min(0.70, 0.01 + (agilityRank / 41) * 0.69)
  const initiative     = speedRank * 0.7 + agilityRank * 0.3

  // ── Passive & extended stat computation ───────────────────────────────────
  let damageReductionCap      = 0.80
  let powerDamageReduction    = 0.0
  let physicalDamageReduction = 0.0
  let passiveHealPerRound     = 0
  const statusImmunities: string[] = []

  const allPowerResults = rs.filter(r => r.category === 'power')
  const allAbilityResults = rs.filter(r => r.category === 'racialAbility' || r.category === 'archetypeAbility')

  // Process passives first (they modify build stats, not moves)
  for (const r of [...allPowerResults, ...allAbilityResults]) {
    const at = detectAttackType(r.resultLabel, _powerMap.get(r.resultLabel)?.attackType)
    if (at !== 'passive') continue
    const lower = r.resultLabel.toLowerCase()
    if (PASSIVE_KW.slice(0, 8).some(k => lower.includes(k))) damageReductionCap = 0.88
    if (lower.includes('magic resist') || lower.includes('power resist')) powerDamageReduction = Math.min(0.60, powerDamageReduction + 0.30)
    if (lower.includes('immune to') || lower.includes('nullif') || lower.includes('immunity')) {
      for (const s of ['poison','burn','freeze','paralyze','wither','bleed']) {
        if (lower.includes(s) && !statusImmunities.includes(s)) statusImmunities.push(s)
      }
    }
    if (lower.includes('regenerat') || lower.includes('auto-heal') || lower.includes('self-repair')) {
      passiveHealPerRound += Math.round(hp * 0.03)
    }
  }

  // Element weaknesses from weakness spin results
  const elementWeaknesses: ElementType[] = []
  for (const r of rs.filter(r => r.category === 'weakness')) {
    const el = detectWeaknessElement(r.resultLabel)
    if (el && !elementWeaknesses.includes(el)) elementWeaknesses.push(el)
  }

  // Build moves (passives excluded)
  const moves: BattleMove[] = []
  const powerSpins = allPowerResults.filter(r => detectAttackType(r.resultLabel, _powerMap.get(r.resultLabel)?.attackType) !== 'passive').slice(0, 5)
  const weaponSpins = rs.filter(r =>
    r.category === 'weapon' && !r.resultLabel.includes('No Weapon') && !r.resultLabel.includes('Unarmed')
  ).slice(0, 2)
  const abilitySpins = allAbilityResults.filter(r => detectAttackType(r.resultLabel, _powerMap.get(r.resultLabel)?.attackType) !== 'passive').slice(0, 2)

  for (const r of powerSpins) {
    const powerData = _powerMap.get(r.resultLabel)
    moves.push({
      name: r.resultLabel,
      type: 'power',
      effectTag: detectEffectTag(r.resultLabel),
      behavior: detectMoveBehavior(r.resultLabel),
      attackType: detectAttackType(r.resultLabel, powerData?.attackType),
      element: powerData?.element,
      grade: powerData?.grade,
    })
  }
  for (const r of weaponSpins) {
    const wepData = _weaponMap.get(r.resultLabel)
    moves.push({
      name: r.resultLabel,
      type: 'physical',
      effectTag: detectEffectTag(r.resultLabel),
      behavior: detectMoveBehavior(r.resultLabel),
      attackType: 'attack',
      element: wepData?.element,
      grade: wepData?.grade,
    })
  }
  for (const r of abilitySpins) {
    const at = detectAttackType(r.resultLabel)
    moves.push({
      name: r.resultLabel,
      type: 'ability',
      effectTag: detectEffectTag(r.resultLabel),
      behavior: detectMoveBehavior(r.resultLabel),
      attackType: at,
    })
  }
  if (moves.length === 0) {
    moves.push({ name: 'Desperate Strike', type: 'physical', effectTag: null, behavior: 'attack', attackType: 'attack' })
  }

  const mult = statMultiplier ?? 1
  const finalHp  = Math.round(hp * mult)
  const finalPhysDmg = Math.round(physicalDamage * mult)
  const finalPwrDmg  = Math.round(powerDamage * mult)

  return {
    name: name.trim() || (rs.find(r => r.category === 'race')?.resultLabel ?? 'Unknown'),
    raceLabel:      rs.find(r => r.category === 'race')?.resultLabel      ?? 'Unknown',
    archetypeLabel: rs.find(r => r.category === 'archetype')?.resultLabel ?? 'Unknown',
    hp: finalHp, maxHp: finalHp,
    physicalDamage: finalPhysDmg, powerDamage: finalPwrDmg,
    armorReduction, armorType: armorTypeLabel, weaponType: weaponTypeLabel,
    agilityRank, speedRank, charismaRank, iqRank, potentialRank, energyRank, fightingSkillRank,
    weaponEnchantTags, armorEnchantTags,
    critChance, critMultiplier, dodgeChance, initiative, moves,
    elementWeaknesses, statusImmunities, passiveHealPerRound,
    powerDamageReduction, physicalDamageReduction, damageReductionCap,
    summons: [], buffMultiplier: 1.0, buffRoundsLeft: 0,
  }
}

// ─── Attack Resolution ────────────────────────────────────────────────────────

export type StatusType = 'burn' | 'poison' | 'freeze' | 'paralyze' | 'wither' | 'bleed'

interface AttackResult {
  skipped: boolean
  damage: number
  aoeDamages?: number[]      // per-target damage for AOE (parallel array to targets)
  heal: number
  reflected: number          // damage returned to the attacker
  stun: boolean              // skip defender's retaliation this round
  shieldFraction: number
  applyStatus?: StatusType   // status to inflict on the target
  buffApplied?: boolean      // applied a team buff
  summonedUnit?: SummonedUnit
  fxEvent?: RoundFxEvent
  lines: string[]
}

// Debuff preference by element
const ELEMENT_DEBUFF: Partial<Record<ElementType, StatusType>> = {
  Fire:      'burn',
  Ice:       'freeze',
  Lightning: 'paralyze',
  Poison:    'poison',
  Shadow:    'wither',
  Blood:     'bleed',
  Wind:      'paralyze',
  Nature:    'poison',
  Void:      'wither',
}

// `forcedMove` lets the manual-mode controller supply the player's chosen
// move directly, bypassing the random pick. The rest of doAction's logic
// (fumbles, charm, intimidate, dodge, crit, etc.) still applies — manual
// mode just controls WHICH move; outcomes still depend on stats + RNG.
export function doAction(
  attacker: BattleCharacter,
  defender: BattleCharacter,
  attackerCurrentHp?: number,
  forcedMove?: BattleMove,
): AttackResult {
  const lines: string[] = []
  const empty = (): AttackResult => ({ skipped: true, damage: 0, heal: 0, reflected: 0, stun: false, shieldFraction: 0, lines })

  // IQ low: stupid mistake (lose own turn)
  if (attacker.iqRank <= 5 && Math.random() < 0.09) {
    lines.push(pick(STUPID_MISTAKES).replace('{name}', attacker.name))
    return empty()
  }

  // Defender high charisma: talks attacker out of it
  if (defender.charismaRank >= 30 && Math.random() < 0.06) {
    lines.push(pick(CHARM_LINES).replace('{attacker}', attacker.name).replace('{defender}', defender.name))
    return empty()
  }

  // Attacker low charisma: fumbles
  if (attacker.charismaRank <= 5 && Math.random() < 0.08) {
    lines.push(pick(CHARISMA_FUMBLES).replace('{name}', attacker.name))
    return empty()
  }

  // Attacker high charisma: intimidate
  let intimidated = false
  if (attacker.charismaRank >= 30 && Math.random() < 0.07) {
    lines.push(pick(INTIMIDATE_LINES).replace('{attacker}', attacker.name).replace('{defender}', defender.name))
    intimidated = true
  }

  // Ancient weapon erratic miss
  if (attacker.weaponType === 'Ancient' && Math.random() < 0.20) {
    lines.push(`The ancient power is erratic — ${attacker.name}'s strike goes wide!`)
    return { skipped: false, damage: 0, heal: 0, reflected: 0, stun: false, shieldFraction: 0, lines }
  }

  // Select move (energy restriction can force physical moves) — unless the
  // caller (manual mode) supplied an explicit move.
  let move: BattleMove
  if (forcedMove) {
    move = forcedMove
  } else {
    let available = attacker.moves.filter(m => m.attackType !== 'passive')
    if (attacker.energyRank <= 5 && Math.random() < 0.35) {
      const nonPower = available.filter(m => m.type !== 'power')
      if (nonPower.length > 0) available = nonPower
    }
    if (available.length === 0) available = attacker.moves
    move = pick(available)
  }

  // ── Buff — team damage boost, no direct damage ────────────────────────────
  if (move.attackType === 'buff') {
    attacker.buffMultiplier = 1.25
    attacker.buffRoundsLeft = 2
    lines.push(`${attacker.name} channels ${move.name} — the team's power surges!`)
    return { skipped: false, damage: 0, heal: 0, reflected: 0, stun: false, shieldFraction: 0, buffApplied: true, lines }
  }

  // ── Summon ────────────────────────────────────────────────────────────────
  if (move.attackType === 'summon') {
    const pct = SUMMON_STAT_PCT[move.grade ?? 'F'] ?? 0.10
    const summoned: SummonedUnit = {
      name: `${move.name} Summon`,
      hp: Math.round(attacker.maxHp * pct),
      maxHp: Math.round(attacker.maxHp * pct),
      damage: Math.round(attacker.powerDamage * pct),
      element: move.element,
    }
    lines.push(`${attacker.name} summons ${summoned.name}! (${formatHp(summoned.hp)} HP, ${Math.round(pct * 100)}% stats)`)
    return { skipped: false, damage: 0, heal: 0, reflected: 0, stun: false, shieldFraction: 0, summonedUnit: summoned, lines }
  }

  // ── Defend behavior ───────────────────────────────────────────────────────
  if (move.behavior === 'defend') {
    const selfHeal = Math.round(attacker.maxHp * 0.08)
    lines.push(pick(DEFEND_PHRASES).replace('{name}', attacker.name) + ` [${move.name}]`)
    if (selfHeal > 0) lines.push(`${attacker.name} recovers ${formatHp(selfHeal)} HP while bracing!`)
    return { skipped: false, damage: 0, heal: selfHeal, reflected: 0, stun: false, shieldFraction: 0.55, lines }
  }

  // ── Heal behavior / attackType ────────────────────────────────────────────
  if (move.behavior === 'heal' || move.attackType === 'heal') {
    const selfHeal = Math.round(attacker.maxHp * 0.22)
    lines.push(pick(HEAL_PHRASES).replace('{name}', attacker.name) + ` [${move.name}]`)
    lines.push(`${attacker.name} restores ${formatHp(selfHeal)} HP!`)
    return { skipped: false, damage: 0, heal: selfHeal, reflected: 0, stun: false, shieldFraction: 0, lines }
  }

  // ── Debuff — apply status, minimal damage ────────────────────────────────
  if (move.attackType === 'debuff') {
    const preferred = move.element ? (ELEMENT_DEBUFF[move.element] ?? null) : null
    const fallback: StatusType[] = ['poison', 'wither', 'burn', 'freeze', 'paralyze', 'bleed']
    const statusToApply = preferred ?? pick(fallback)
    if (!defender.statusImmunities.includes(statusToApply)) {
      lines.push(`${attacker.name} curses ${defender.name} with ${move.name}!`)
      lines.push(pick(STATUS_APPLY_LINES[statusToApply] ?? STATUS_APPLY_LINES.poison ?? ['{name} is afflicted!']).replace('{name}', defender.name))
      const tickDmg = Math.round(defender.maxHp * 0.02)
      return { skipped: false, damage: tickDmg, heal: 0, reflected: 0, stun: false, shieldFraction: 0, applyStatus: statusToApply, lines }
    }
    lines.push(`${defender.name} resists ${attacker.name}'s ${move.name}!`)
    return { skipped: false, damage: 0, heal: 0, reflected: 0, stun: false, shieldFraction: 0, lines }
  }

  // ── Attack / AOE (damage moves) ───────────────────────────────────────────

  // Dodge check (AOE cannot be fully dodged — 50% reduced chance)
  const dodgeChance = move.attackType === 'aoe' ? defender.dodgeChance * 0.5 : defender.dodgeChance
  if (Math.random() < dodgeChance) {
    lines.push(`${defender.name} ${pick(DODGE_PHRASES)} ${attacker.name}'s ${move.name}!`)
    if (defender.fightingSkillRank >= 12 && Math.random() < 0.40) {
      const riposteDmg = Math.max(1, Math.round(
        defender.physicalDamage * (0.20 + Math.random() * 0.28) * (1 - attacker.armorReduction)
      ))
      lines.push(pick(RIPOSTE_LINES).replace('{name}', defender.name).replace('{dmg}', formatHp(riposteDmg)))
      return { skipped: false, damage: 0, heal: 0, reflected: riposteDmg, stun: false, shieldFraction: 0, lines }
    }
    return { skipped: false, damage: 0, heal: 0, reflected: 0, stun: false, shieldFraction: 0, lines }
  }

  // Berserker fury
  const hpFraction = (attackerCurrentHp ?? attacker.hp) / attacker.maxHp
  const isBerserker = hpFraction < 0.30 && Math.random() < 0.28
  if (isBerserker) lines.push(pick(BERSERKER_LINES).replace('{name}', attacker.name))

  // Base damage by move type; AOE hits at 65% per target
  const baseDmg = move.type === 'power' ? attacker.powerDamage : attacker.physicalDamage
  const aoeMult = move.attackType === 'aoe' ? 0.65 : 1.0

  // Buff multiplier from active buff
  const selfBuffMult = attacker.buffRoundsLeft > 0 ? attacker.buffMultiplier : 1.0

  // Move variance multiplier
  let moveMult: number
  if (attacker.weaponType === 'Exotic' && move.type !== 'power') {
    moveMult = 0.60 + Math.random() * 0.80
  } else {
    moveMult = move.type === 'power'
      ? 0.55 + Math.random() * 0.50
      : move.type === 'physical'
        ? 0.60 + Math.random() * 0.45
        : 0.45 + Math.random() * 0.40
  }

  // Weapon type modifiers
  let weaponBonus = 1.0
  let armorPierceFraction = 0.0
  if (move.type !== 'power') {
    switch (attacker.weaponType) {
      case 'Ranged':  armorPierceFraction = 0.30; break
      case 'Magical': armorPierceFraction = 0.15; weaponBonus = 1.10; break
      case 'Cursed':  weaponBonus = 1.25; break
      case 'Ancient': weaponBonus = 1.35; break
      case 'None':    weaponBonus = 0.90; break
    }
  }

  const energyMult = move.type === 'power' && attacker.energyRank >= 30 ? 1.25 : 1.0

  // IQ precision pierce
  let fullPierce = false
  if (attacker.iqRank >= 18 && Math.random() < 0.05) {
    fullPierce = true
    lines.push(`${attacker.name} reads the opening perfectly — a precision strike bypasses all defenses!`)
  }

  // Crit
  const isCrit   = Math.random() < attacker.critChance
  const critMult = isCrit ? attacker.critMultiplier : 1.0

  // Effective armor — power moves bypass 60%; power resist reduces further
  let effectiveArmor = move.type === 'power'
    ? Math.min(defender.damageReductionCap, defender.armorReduction * 0.40 + defender.powerDamageReduction)
    : Math.min(defender.damageReductionCap, defender.armorReduction + defender.physicalDamageReduction)
  if (fullPierce) {
    effectiveArmor = 0
  } else {
    if (intimidated) effectiveArmor *= 0.50
    effectiveArmor *= (1 - armorPierceFraction)
    effectiveArmor = Math.min(effectiveArmor, defender.damageReductionCap)
  }

  // Elemental weakness: +25% damage
  const weaknessMult = (move.element && defender.elementWeaknesses.includes(move.element)) ? 1.25 : 1.0
  if (weaknessMult > 1) lines.push(`${defender.name} is weak to ${move.element}! Damage amplified!`)

  // Final damage
  const berserkerMult = isBerserker ? 2.2 + Math.random() * 0.8 : 1.0
  const variance = 0.85 + Math.random() * 0.30
  let damage = Math.max(1, Math.round(
    baseDmg * moveMult * weaponBonus * energyMult * critMult * berserkerMult * aoeMult * selfBuffMult * weaknessMult * (1 - effectiveArmor) * variance
  ))

  // Divine armor absorb
  if (defender.armorEnchantTags.includes('heal')) {
    const divineAbsorb = Math.round(damage * 0.08)
    damage = Math.max(1, damage - divineAbsorb)
    lines.push(`${defender.name}'s divine armor absorbs ${formatHp(divineAbsorb)} of the blow!`)
  }

  // Battle log line
  let logLine = `${attacker.name} ${pick(ATTACK_VERBS)} ${move.name}`
  if (isCrit) logLine += ` — ${pick(CRIT_LABELS)}`
  if (move.attackType === 'aoe') logLine += ` (AOE)`
  logLine += ` ${formatHp(damage)} damage!`
  lines.push(logLine)

  // Move effect healing
  let heal = 0
  if (move.effectTag && EFFECT_FLAVOR[move.effectTag]) {
    if (move.effectTag === 'lifesteal') heal = Math.round(damage * 0.35)
    else if (move.effectTag === 'heal') heal = Math.round(damage * 0.30)
    lines.push(EFFECT_FLAVOR[move.effectTag]
      .replace('{attacker}', attacker.name)
      .replace('{target}', defender.name)
      .replace('{heal}', formatHp(heal)))
  }

  if (attacker.weaponEnchantTags.includes('lifesteal')) {
    const eHeal = Math.round(damage * 0.10)
    heal += eHeal
    lines.push(`${attacker.name}'s weapon drains ${formatHp(eHeal)} HP!`)
  }

  // Reflected damage
  let reflected = 0
  if (attacker.weaponType === 'Cursed') {
    const rb = Math.round(damage * 0.08)
    reflected += rb
    lines.push(`${attacker.name}'s cursed weapon bites back — ${formatHp(rb)} reflected!`)
  }
  if (defender.armorType === 'Cursed') {
    const r = Math.round(damage * 0.06)
    reflected += r
    lines.push(`${defender.name}'s cursed armor reflects ${formatHp(r)} back at ${attacker.name}!`)
  }
  if (defender.armorEnchantTags.includes('burn')) {
    const b = Math.round(damage * 0.05)
    reflected += b
    lines.push(`${defender.name}'s flaming armor scorches ${attacker.name} for ${formatHp(b)}!`)
  }

  // IQ stun
  let stun = false
  if (attacker.iqRank >= 30 && Math.random() < 0.08) {
    stun = true
    lines.push(`${attacker.name}'s calculated strike leaves ${defender.name} unable to retaliate!`)
  }

  // Speed multi-hit
  if (attacker.speedRank >= 30) {
    if (Math.random() < (attacker.speedRank >= 36 ? 0.22 : 0.15)) {
      const bonusDmg = Math.max(1, Math.round(damage * (0.40 + Math.random() * 0.30)))
      damage += bonusDmg
      lines.push(`${attacker.name} blurs — a follow-up strike adds ${formatHp(bonusDmg)} more!`)
    }
  }

  // Potential burst
  if (attacker.potentialRank >= 30 && Math.random() < 0.10) {
    const burstDmg = Math.max(1, Math.round(damage * (0.30 + Math.random() * 0.30)))
    damage += burstDmg
    lines.push(`${attacker.name}'s dormant power explodes — ${formatHp(burstDmg)} bonus damage!`)
  }

  // Combo finisher
  if (attacker.fightingSkillRank >= 28 && Math.random() < 0.18) {
    const comboDmg = Math.max(1, Math.round(damage * (0.35 + Math.random() * 0.25) * (1 - effectiveArmor)))
    damage += comboDmg
    lines.push(`${attacker.name} doesn't stop — combo finisher for ${formatHp(comboDmg)} more!`)
  }

  // Status application — element-preferred debuff, expanded to 6 types
  let applyStatus: StatusType | undefined = undefined
  if (!isBerserker) {
    const tag = move.effectTag
    const el  = move.element
    if (tag === 'burn'    && Math.random() < 0.38) applyStatus = 'burn'
    else if (tag === 'poison' && Math.random() < 0.32) applyStatus = 'poison'
    else if (tag === 'slow'   && Math.random() < 0.25) applyStatus = 'freeze'
    else if (tag === 'stun'   && Math.random() < 0.22) applyStatus = 'paralyze'
    else if (el) {
      const preferred = ELEMENT_DEBUFF[el]
      if (preferred && Math.random() < 0.20) applyStatus = preferred
    }
    // Check immunity
    if (applyStatus && defender.statusImmunities.includes(applyStatus)) applyStatus = undefined
  }

  return { skipped: false, damage, heal, reflected, stun, shieldFraction: 0, applyStatus, lines }
}

// ─── Team Battle Interfaces ───────────────────────────────────────────────────

export interface TeamBattleRound {
  roundNum: number
  t1Hp: number[]   // HP snapshot per team-1 member at end of round
  t2Hp: number[]   // HP snapshot per team-2 member at end of round
  lines: string[]
  winner?: 'team1' | 'team2' | 'draw'
  fxEvents?: RoundFxEvent[]
}

export function simulateTeamBattle(
  team1: BattleCharacter[],
  team2: BattleCharacter[],
  maxRounds = 24,
): TeamBattleRound[] {
  const rounds: TeamBattleRound[] = []
  const hp1 = team1.map(c => c.hp)
  const hp2 = team2.map(c => c.hp)

  // Status effect tracking: keyed by "team-idx"
  interface Status { intensity: number; duration: number }
  const statuses: Record<string, Partial<Record<StatusType, Status>>> = {}

  // Environmental event — fires once per battle at a random round (rounds 2-4)
  const eventRound = 2 + Math.floor(Math.random() * 3)
  const eventLine  = Math.random() < 0.70 ? pick(ENVIRONMENTAL_EVENTS) : null

  for (let roundNum = 1; roundNum <= maxRounds; roundNum++) {
    const lines: string[] = []
    const stunned = new Set<string>()
    const skippedParalyze = new Set<string>()
    const shields: Record<string, number> = {}
    const fxEvents: RoundFxEvent[] = []

    // ── Environmental event ──
    if (roundNum === eventRound && eventLine) lines.push(eventLine)

    // ── Passive regen tick ──
    for (let i = 0; i < team1.length; i++) {
      if (hp1[i] > 0 && team1[i].passiveHealPerRound > 0) {
        hp1[i] = Math.min(team1[i].maxHp, hp1[i] + team1[i].passiveHealPerRound)
        lines.push(`${team1[i].name} regenerates ${formatHp(team1[i].passiveHealPerRound)} HP!`)
      }
    }
    for (let i = 0; i < team2.length; i++) {
      if (hp2[i] > 0 && team2[i].passiveHealPerRound > 0) {
        hp2[i] = Math.min(team2[i].maxHp, hp2[i] + team2[i].passiveHealPerRound)
        lines.push(`${team2[i].name} regenerates ${formatHp(team2[i].passiveHealPerRound)} HP!`)
      }
    }

    // ── Buff countdown ──
    for (const char of [...team1, ...team2]) {
      if (char.buffRoundsLeft > 0) {
        char.buffRoundsLeft--
        if (char.buffRoundsLeft === 0) char.buffMultiplier = 1.0
      }
    }

    // ── Status effect ticks ──
    for (const key of Object.keys(statuses)) {
      const s = statuses[key]
      const [teamStr, idxStr] = key.split('-')
      const idx     = parseInt(idxStr)
      const hpArr   = teamStr === '1' ? hp1 : hp2
      const charArr = teamStr === '1' ? team1 : team2
      if (hpArr[idx] <= 0) { delete statuses[key]; continue }

      if (s.burn) {
        const dmg = Math.max(1, Math.round(charArr[idx].maxHp * 0.06 * s.burn.intensity))
        hpArr[idx] = Math.max(0, hpArr[idx] - dmg)
        lines.push(pick(STATUS_TICK_LINES.burn).replace('{name}', charArr[idx].name).replace('{dmg}', formatHp(dmg)))
        s.burn.duration--
        if (s.burn.duration <= 0) delete s.burn
      }
      if (s.poison) {
        const dmg = Math.max(1, Math.round(charArr[idx].maxHp * 0.04 * s.poison.intensity))
        hpArr[idx] = Math.max(0, hpArr[idx] - dmg)
        lines.push(pick(STATUS_TICK_LINES.poison).replace('{name}', charArr[idx].name).replace('{dmg}', formatHp(dmg)))
        s.poison.duration--
        if (s.poison.duration <= 0) delete s.poison
      }
      if (s.wither) {
        const dmg = Math.max(1, Math.round(charArr[idx].maxHp * 0.03 * s.wither.intensity))
        hpArr[idx] = Math.max(0, hpArr[idx] - dmg)
        lines.push(`💀 ${charArr[idx].name} withers — ${formatHp(dmg)} damage!`)
        s.wither.duration--
        if (s.wither.duration <= 0) delete s.wither
      }
      if (s.bleed) {
        const dmg = Math.max(1, Math.round(charArr[idx].maxHp * 0.05 * s.bleed.intensity))
        hpArr[idx] = Math.max(0, hpArr[idx] - dmg)
        lines.push(`🩸 ${charArr[idx].name} bleeds — ${formatHp(dmg)} damage!`)
        s.bleed.duration--
        if (s.bleed.duration <= 0) delete s.bleed
      }
      if (s.freeze) {
        stunned.add(key)
        s.freeze.duration--
        if (s.freeze.duration <= 0) delete s.freeze
      }
      if (s.paralyze) {
        if (Math.random() < 0.50) skippedParalyze.add(key)
        s.paralyze.duration--
        if (s.paralyze.duration <= 0) delete s.paralyze
      }
    }

    // ── Build turn order ──
    type Actor = { team: 1 | 2; idx: number; char: BattleCharacter; roll: number }
    const actorList: Actor[] = [
      ...team1.map((c, i) => ({ team: 1 as const, idx: i, char: c, roll: c.initiative + Math.random() * 5 })),
      ...team2.map((c, i) => ({ team: 2 as const, idx: i, char: c, roll: c.initiative + Math.random() * 5 })),
    ]
      .filter(a => (a.team === 1 ? hp1[a.idx] : hp2[a.idx]) > 0)
      .sort((a, b) => b.roll - a.roll)

    for (const actor of actorList) {
      const actorKey  = `${actor.team}-${actor.idx}`
      const actorHpArr = actor.team === 1 ? hp1 : hp2
      if (actorHpArr[actor.idx] <= 0) continue
      if (stunned.has(actorKey)) { lines.push(`${actor.char.name} is frozen — can't move this round!`); continue }
      if (skippedParalyze.has(actorKey)) { lines.push(`${actor.char.name} is paralyzed — can't move this turn!`); continue }

      const allyTeam    = actor.team === 1 ? team1 : team2
      const allyHpArr   = actor.team === 1 ? hp1 : hp2
      const enemyTeam   = actor.team === 1 ? team2 : team1
      const enemyHpArr  = actor.team === 1 ? hp2 : hp1
      const enemyTeamId = actor.team === 1 ? 2 : 1
      const livingIdxs  = enemyHpArr.map((h, i) => h > 0 ? i : -1).filter(i => i >= 0)
      if (livingIdxs.length === 0) break

      // Pick a move to check attackType before targeting
      const available = actor.char.moves.filter(m => m.attackType !== 'passive')
      const peekMove = available.length > 0 ? available[Math.floor(Math.random() * available.length)] : null

      // Heal: target most injured ally
      if (peekMove?.attackType === 'heal') {
        const injuredIdx = allyHpArr
          .map((h, i) => ({ ratio: allyTeam[i].maxHp > 0 ? h / allyTeam[i].maxHp : 1, i }))
          .filter(x => allyHpArr[x.i] > 0)
          .sort((a, b) => a.ratio - b.ratio)[0]?.i ?? actor.idx
        const healAmt = Math.round(allyTeam[actor.idx].maxHp * 0.22)
        allyHpArr[injuredIdx] = Math.min(allyTeam[injuredIdx].maxHp, allyHpArr[injuredIdx] + healAmt)
        lines.push(`${actor.char.name} heals ${allyTeam[injuredIdx].name} for ${formatHp(healAmt)} HP! [${peekMove.name}]`)
        fxEvents.push({ attackerSide: actor.team === 1 ? 'team1' : 'team2', attackerIdx: actor.idx, targetIdxs: [injuredIdx], element: peekMove.element, grade: peekMove.grade, attackType: 'heal', isCrit: false })
        continue
      }

      // AOE: attack all living enemies
      if (peekMove?.attackType === 'aoe') {
        const result = doAction(actor.char, enemyTeam[livingIdxs[0]], actorHpArr[actor.idx])
        lines.push(...result.lines)
        const aoeTargets: number[] = []
        for (const ti of livingIdxs) {
          const shield = shields[`${enemyTeamId}-${ti}`] ?? 0
          const dmg = Math.round(result.damage * (1 - shield))
          const was = enemyHpArr[ti] > 0
          enemyHpArr[ti] = Math.max(0, enemyHpArr[ti] - dmg)
          if (was && enemyHpArr[ti] <= 0) lines.push(`${enemyTeam[ti].name} has been defeated!`)
          aoeTargets.push(ti)
        }
        actorHpArr[actor.idx] = Math.min(actor.char.maxHp, actorHpArr[actor.idx] + result.heal)
        fxEvents.push({ attackerSide: actor.team === 1 ? 'team1' : 'team2', attackerIdx: actor.idx, targetIdxs: aoeTargets, element: peekMove.element, grade: peekMove.grade, attackType: 'aoe', isCrit: false })
        continue
      }

      const targetIdx = livingIdxs[Math.floor(Math.random() * livingIdxs.length)]
      const targetKey  = `${enemyTeamId}-${targetIdx}`
      const result = doAction(actor.char, enemyTeam[targetIdx], actorHpArr[actor.idx])
      lines.push(...result.lines)

      // Summon
      if (result.summonedUnit) {
        actor.char.summons.push(result.summonedUnit)
        continue
      }

      if (!result.skipped) {
        const shield    = shields[targetKey] ?? 0
        const netDamage = Math.round(result.damage * (1 - shield))
        const wasAlive  = enemyHpArr[targetIdx] > 0
        enemyHpArr[targetIdx] = Math.max(0, enemyHpArr[targetIdx] - netDamage)
        actorHpArr[actor.idx] = Math.min(actor.char.maxHp, actorHpArr[actor.idx] + result.heal)
        actorHpArr[actor.idx] = Math.max(0, actorHpArr[actor.idx] - result.reflected)
        if (result.shieldFraction > 0) shields[actorKey] = result.shieldFraction
        if (result.stun) stunned.add(targetKey)

        const usedMove = actor.char.moves.find(m => m.attackType !== 'passive')
        fxEvents.push({
          attackerSide: actor.team === 1 ? 'team1' : 'team2',
          attackerIdx: actor.idx,
          targetIdxs: [targetIdx],
          element: usedMove?.element,
          grade: usedMove?.grade,
          attackType: usedMove?.attackType ?? 'attack',
          isCrit: false,
        })

        // Apply status effect to target
        if (result.applyStatus) {
          if (!statuses[targetKey]) statuses[targetKey] = {}
          const st = statuses[targetKey]
          const existing = st[result.applyStatus]
          const newIntensity = 1 + (existing?.intensity ?? 0) * 0.4
          const durations: Record<StatusType, number> = { burn: 2, poison: 3, freeze: 1, paralyze: 1, wither: 4, bleed: 3 }
          st[result.applyStatus] = { intensity: newIntensity, duration: durations[result.applyStatus] }
          const applyLines = STATUS_APPLY_LINES[result.applyStatus] ?? STATUS_APPLY_LINES.poison
          lines.push(pick(applyLines ?? ['{name} is afflicted!']).replace('{name}', enemyTeam[targetIdx].name))
        }

        if (wasAlive && enemyHpArr[targetIdx] <= 0) {
          lines.push(`${enemyTeam[targetIdx].name} has been defeated!`)
        }
      }
    }

    const t1Alive = hp1.some(h => h > 0)
    const t2Alive = hp2.some(h => h > 0)
    const roundWinner: 'team1' | 'team2' | 'draw' | undefined =
      !t1Alive && !t2Alive ? 'draw' :
      !t2Alive ? 'team1' :
      !t1Alive ? 'team2' :
      undefined

    rounds.push({ roundNum, t1Hp: [...hp1], t2Hp: [...hp2], lines, winner: roundWinner, fxEvents })
    if (roundWinner !== undefined) break
  }

  const last = rounds.at(-1)!
  if (!last.winner) {
    const t1Max = team1.reduce((s, c) => s + c.maxHp, 0)
    const t2Max = team2.reduce((s, c) => s + c.maxHp, 0)
    const t1Pct = hp1.reduce((s, h) => s + h, 0) / t1Max
    const t2Pct = hp2.reduce((s, h) => s + h, 0) / t2Max
    const tw: 'team1' | 'team2' | 'draw' = t1Pct > t2Pct ? 'team1' : t2Pct > t1Pct ? 'team2' : 'draw'
    last.winner = tw
    last.lines.push(
      tw === 'draw'
        ? "Time runs out — both sides stand exhausted. It's a DRAW!"
        : `Time runs out — ${tw === 'team1' ? 'Team 1' : 'Team 2'} wins by endurance!`
    )
  }

  return rounds
}

// ─── 1v1 Simulation ───────────────────────────────────────────────────────────

export function simulateBattle(p1: BattleCharacter, p2: BattleCharacter, maxRounds = 18): BattleRound[] {
  const rounds: BattleRound[] = []
  let p1Hp = p1.hp
  let p2Hp = p2.hp

  interface Status { intensity: number; duration: number }
  const p1Statuses: Partial<Record<StatusType, Status>> = {}
  const p2Statuses: Partial<Record<StatusType, Status>> = {}

  function tickStatuses(statuses: Partial<Record<StatusType, Status>>, char: BattleCharacter, hpRef: { v: number }, lines: string[]) {
    if (statuses.burn) {
      const dmg = Math.max(1, Math.round(char.maxHp * 0.06 * statuses.burn.intensity))
      hpRef.v = Math.max(0, hpRef.v - dmg)
      lines.push(pick(STATUS_TICK_LINES.burn).replace('{name}', char.name).replace('{dmg}', formatHp(dmg)))
      statuses.burn.duration--
      if (statuses.burn.duration <= 0) delete statuses.burn
    }
    if (statuses.poison) {
      const dmg = Math.max(1, Math.round(char.maxHp * 0.04 * statuses.poison.intensity))
      hpRef.v = Math.max(0, hpRef.v - dmg)
      lines.push(pick(STATUS_TICK_LINES.poison).replace('{name}', char.name).replace('{dmg}', formatHp(dmg)))
      statuses.poison.duration--
      if (statuses.poison.duration <= 0) delete statuses.poison
    }
    if (statuses.wither) {
      const dmg = Math.max(1, Math.round(char.maxHp * 0.03 * statuses.wither.intensity))
      hpRef.v = Math.max(0, hpRef.v - dmg)
      lines.push(`💀 ${char.name} withers — ${formatHp(dmg)} damage!`)
      statuses.wither.duration--
      if (statuses.wither.duration <= 0) delete statuses.wither
    }
    if (statuses.bleed) {
      const dmg = Math.max(1, Math.round(char.maxHp * 0.05 * statuses.bleed.intensity))
      hpRef.v = Math.max(0, hpRef.v - dmg)
      lines.push(`🩸 ${char.name} bleeds — ${formatHp(dmg)} damage!`)
      statuses.bleed.duration--
      if (statuses.bleed.duration <= 0) delete statuses.bleed
    }
  }

  function applyStatus(statuses: Partial<Record<StatusType, Status>>, type: StatusType, char: BattleCharacter, lines: string[]) {
    const existing = statuses[type]
    const newIntensity = 1 + (existing?.intensity ?? 0) * 0.4
    const durations: Record<StatusType, number> = { burn: 2, poison: 3, freeze: 1, paralyze: 1, wither: 4, bleed: 3 }
    statuses[type] = { intensity: newIntensity, duration: durations[type] }
    const applyLines = STATUS_APPLY_LINES[type] ?? STATUS_APPLY_LINES.poison
    lines.push(pick(applyLines ?? ['{name} is afflicted!']).replace('{name}', char.name))
  }

  for (let i = 1; i <= maxRounds; i++) {
    const p1HpBefore = p1Hp
    const p2HpBefore = p2Hp
    const lines: string[] = []
    const fxEvents: RoundFxEvent[] = []

    // Passive regen
    if (p1.passiveHealPerRound > 0 && p1Hp > 0) { p1Hp = Math.min(p1.maxHp, p1Hp + p1.passiveHealPerRound); lines.push(`${p1.name} regenerates ${formatHp(p1.passiveHealPerRound)} HP!`) }
    if (p2.passiveHealPerRound > 0 && p2Hp > 0) { p2Hp = Math.min(p2.maxHp, p2Hp + p2.passiveHealPerRound); lines.push(`${p2.name} regenerates ${formatHp(p2.passiveHealPerRound)} HP!`) }

    // Buff countdown
    if (p1.buffRoundsLeft > 0) { p1.buffRoundsLeft--; if (p1.buffRoundsLeft === 0) p1.buffMultiplier = 1.0 }
    if (p2.buffRoundsLeft > 0) { p2.buffRoundsLeft--; if (p2.buffRoundsLeft === 0) p2.buffMultiplier = 1.0 }

    // Status ticks
    const p1Ref = { v: p1Hp }; tickStatuses(p1Statuses, p1, p1Ref, lines); p1Hp = p1Ref.v
    const p2Ref = { v: p2Hp }; tickStatuses(p2Statuses, p2, p2Ref, lines); p2Hp = p2Ref.v

    const p1Frozen = p1Statuses.freeze && p1Statuses.freeze.duration > 0
    const p2Frozen = p2Statuses.freeze && p2Statuses.freeze.duration > 0
    if (p1Frozen) { p1Statuses.freeze!.duration--; if (p1Statuses.freeze!.duration <= 0) delete p1Statuses.freeze }
    if (p2Frozen) { p2Statuses.freeze!.duration--; if (p2Statuses.freeze!.duration <= 0) delete p2Statuses.freeze }
    const p1Paralyzed = !!(p1Statuses.paralyze && Math.random() < 0.5)
    const p2Paralyzed = !!(p2Statuses.paralyze && Math.random() < 0.5)
    if (p1Statuses.paralyze) { p1Statuses.paralyze.duration--; if (p1Statuses.paralyze.duration <= 0) delete p1Statuses.paralyze }
    if (p2Statuses.paralyze) { p2Statuses.paralyze.duration--; if (p2Statuses.paralyze.duration <= 0) delete p2Statuses.paralyze }

    const initiativeDiff = (p1.initiative - p2.initiative) / Math.max(p1.initiative, p2.initiative, 1)
    const p1First = Math.random() < 0.50 + initiativeDiff * 0.30

    const firstAtk  = p1First ? p1 : p2
    const secondAtk = p1First ? p2 : p1
    const firstStatuses  = p1First ? p1Statuses : p2Statuses
    const secondStatuses = p1First ? p2Statuses : p1Statuses
    const firstFrozen    = p1First ? p1Frozen : p2Frozen
    const secondFrozen   = p1First ? p2Frozen : p1Frozen
    const firstParalyzed = p1First ? p1Paralyzed : p2Paralyzed
    const secondParalyzed= p1First ? p2Paralyzed : p1Paralyzed
    let firstHp  = p1First ? p1Hp : p2Hp
    let secondHp = p1First ? p2Hp : p1Hp

    // First actor's turn
    if (!firstFrozen && !firstParalyzed && firstHp > 0) {
      const r1 = doAction(firstAtk, secondAtk, firstHp)
      lines.push(...r1.lines)
      if (!r1.skipped) {
        secondHp = Math.max(0, secondHp - r1.damage)
        firstHp  = Math.min(firstAtk.maxHp, firstHp + r1.heal)
        firstHp  = Math.max(0, firstHp - r1.reflected)
        if (r1.applyStatus) applyStatus(secondStatuses, r1.applyStatus, secondAtk, lines)
        const fxMove = firstAtk.moves.find(m => m.attackType !== 'passive')
        fxEvents.push({ attackerSide: p1First ? 'p1' : 'p2', attackerIdx: 0, targetIdxs: [0], element: fxMove?.element, grade: fxMove?.grade, attackType: fxMove?.attackType ?? 'attack', isCrit: false })
      }

      // Second actor retaliates
      if (secondHp > 0 && !r1.stun && !secondFrozen && !secondParalyzed) {
        const r2 = doAction(secondAtk, firstAtk, secondHp)
        lines.push(...r2.lines)
        if (!r2.skipped) {
          const shieldedDmg = Math.round(r2.damage * (1 - r1.shieldFraction))
          firstHp  = Math.max(0, firstHp - shieldedDmg)
          secondHp = Math.min(secondAtk.maxHp, secondHp + r2.heal)
          secondHp = Math.max(0, secondHp - r2.reflected)
          if (r2.applyStatus) applyStatus(firstStatuses, r2.applyStatus, firstAtk, lines)
          const fxMove2 = secondAtk.moves.find(m => m.attackType !== 'passive')
          fxEvents.push({ attackerSide: p1First ? 'p2' : 'p1', attackerIdx: 0, targetIdxs: [0], element: fxMove2?.element, grade: fxMove2?.grade, attackType: fxMove2?.attackType ?? 'attack', isCrit: false })
        }
      } else if (secondHp > 0 && r1.stun) {
        lines.push(`${secondAtk.name} is too stunned to retaliate!`)
      } else if (secondFrozen) {
        lines.push(`${secondAtk.name} is frozen — can't move this round!`)
      } else if (secondParalyzed) {
        lines.push(`${secondAtk.name} is paralyzed — can't move this turn!`)
      }
    } else {
      if (firstFrozen) lines.push(`${firstAtk.name} is frozen — can't act this round!`)
      else if (firstParalyzed) lines.push(`${firstAtk.name} is paralyzed — can't act this turn!`)
      // Second still attacks if first is frozen/paralyzed
      if (secondHp > 0 && !secondFrozen && !secondParalyzed) {
        const r2 = doAction(secondAtk, firstAtk, secondHp)
        lines.push(...r2.lines)
        if (!r2.skipped) {
          firstHp  = Math.max(0, firstHp - r2.damage)
          secondHp = Math.min(secondAtk.maxHp, secondHp + r2.heal)
          if (r2.applyStatus) applyStatus(firstStatuses, r2.applyStatus, firstAtk, lines)
        }
      }
    }

    p1Hp = p1First ? firstHp : secondHp
    p2Hp = p1First ? secondHp : firstHp

    const dead1 = p1Hp <= 0
    const dead2 = p2Hp <= 0
    const roundWinner: 'p1' | 'p2' | 'draw' | undefined =
      dead1 && dead2 ? 'draw' : dead1 ? 'p2' : dead2 ? 'p1' : undefined

    rounds.push({
      roundNum: i,
      p1Hp: Math.max(0, p1Hp),
      p2Hp: Math.max(0, p2Hp),
      p1HpBefore, p2HpBefore,
      lines,
      winner: roundWinner,
      fxEvents,
    })
    if (roundWinner !== undefined) break
  }

  // Time limit: decide by HP % remaining
  const last = rounds.at(-1)!
  if (!last.winner) {
    const p1Pct = p1Hp / p1.maxHp
    const p2Pct = p2Hp / p2.maxHp
    const timeWinner: 'p1' | 'p2' | 'draw' =
      p1Pct > p2Pct ? 'p1' : p2Pct > p1Pct ? 'p2' : 'draw'
    last.winner = timeWinner
    last.lines.push(
      timeWinner === 'draw'
        ? "Time runs out — both warriors stand exhausted. It's a DRAW!"
        : `Time runs out — ${timeWinner === 'p1' ? p1.name : p2.name} wins by endurance!`
    )
  }

  return rounds
}
