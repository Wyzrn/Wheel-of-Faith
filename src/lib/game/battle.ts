// battle.ts — Procedural battle simulation for Rivals Mode.
// Tier-scaled HP/damage, full stat mechanics. Pure functions only. No default export.

import type { SpinResult } from '$lib/session/types'
import { TIER_THRESHOLDS, scoreTier } from '$lib/game/scoreTier'
import type { TierGrade } from '$lib/game/scoreTier'

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
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

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
}

export interface BattleMove {
  name: string
  type: 'physical' | 'power' | 'ability'
  effectTag: string | null
  behavior: 'attack' | 'defend' | 'heal'
}

export interface BattleRound {
  roundNum: number
  p1Hp: number
  p2Hp: number
  p1HpBefore: number
  p2HpBefore: number
  lines: string[]
  winner?: 'p1' | 'p2' | 'draw'
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

function tierRank(grade: TierGrade): number {
  const idx = TIER_THRESHOLDS.findIndex(t => t.grade === grade)
  return idx < 0 ? 0 : idx
}

function hpForTier(grade: TierGrade): number {
  return HP_TABLE[grade] ?? 50
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

export function buildBattleCharacter(results: SpinResult[], name: string): BattleCharacter {
  const durTier    = getTier(results, 'durability')
  const strTier    = getTier(results, 'strength')
  const elTier     = getTier(results, 'energyLevel')
  const potTier    = getTier(results, 'potential')
  const armStrTier = getTier(results, 'armorStrength')

  const agilityRank       = tierRank(getTier(results, 'agility'))
  const speedRank         = tierRank(getTier(results, 'speed'))
  const charismaRank      = tierRank(getTier(results, 'charisma'))
  const iqRank            = tierRank(getTier(results, 'iq'))
  const potentialRank     = tierRank(potTier)
  const energyRank        = tierRank(elTier)
  const fightingSkillRank = tierRank(getTier(results, 'fightingSkill'))
  const armStrRank        = tierRank(armStrTier)

  // HP: durability 55%, strength 20%, energy 15%, potential 10%
  // Spreading HP across stats means no single stat decides survivability
  const hp = Math.round(
    hpForTier(durTier) * 0.55 +
    hpForTier(strTier) * 0.20 +
    hpForTier(elTier)  * 0.15 +
    hpForTier(potTier) * 0.10
  )

  // Physical damage: fightingSkill (55%), strength (25%), weaponMastery (20%)
  // Technique and mastery matter more than raw power
  const strScore = results.find(r => r.category === 'strength')?.score ?? 28
  const fskScore = results.find(r => r.category === 'fightingSkill')?.score ?? 28
  const wmScore  = results.find(r => r.category === 'weaponMastery')?.score ?? 28
  const physDamageTier = scoreTier(Math.round(strScore * 0.25 + fskScore * 0.55 + wmScore * 0.20))
  const physicalDamage = Math.round(hpForTier(physDamageTier) / 2)

  // Power damage: blended score from power mastery (60%), energy level (40%)
  const pmScore = results.find(r => r.category === 'powerMastery')?.score ?? 28
  const elScore = results.find(r => r.category === 'energyLevel')?.score ?? 28
  const pwrDamageTier = scoreTier(Math.round(pmScore * 0.60 + elScore * 0.40))
  const powerDamage = Math.round(hpForTier(pwrDamageTier) / 2)

  // Armor: armorStrength rank → base fraction, modulated by armor type
  // Cap lowered to 0.62 — even the heaviest armor doesn't make you immune
  const armorTypeLabel = results.find(r => r.category === 'armorType')?.resultLabel ?? 'None'
  const baseArmor = 0.05 + (armStrRank / 41) * 0.45
  const ARMOR_TYPE_MULT: Record<string, number> = {
    'None': 0, 'Helmet Only': 0.40, 'Half-Suit': 0.70,
    'Full-Suit': 1.0, 'Exotic': 0.85, 'Cursed': 0.75, 'Ancient': 1.15,
  }
  const armorReduction = Math.min(0.62, baseArmor * (ARMOR_TYPE_MULT[armorTypeLabel] ?? 1.0))

  const weaponTypeLabel = results.find(r => r.category === 'weaponType')?.resultLabel ?? 'Melee'

  const toTag = (r: SpinResult) => detectEffectTag(r.resultLabel)
  const weaponEnchantTags = results
    .filter(r => r.category === 'weaponEnchantment')
    .map(toTag).filter((t): t is string => t !== null)
  const armorEnchantTags = results
    .filter(r => r.category === 'armorEnchantment')
    .map(toTag).filter((t): t is string => t !== null)

  const critChance     = Math.max(0.05, Math.min(0.45, (fightingSkillRank + potentialRank) / 82 * 0.45))
  const critMultiplier = Math.min(2.5, 1.5 + potentialRank / 41)
  const dodgeChance    = Math.min(0.70, 0.01 + (agilityRank / 41) * 0.69)
  const initiative     = speedRank * 0.7 + agilityRank * 0.3

  const moves: BattleMove[] = []
  const powers    = results.filter(r => r.category === 'power').slice(0, 4)
  const weapons   = results.filter(r =>
    r.category === 'weapon' && !r.resultLabel.includes('No Weapon') && !r.resultLabel.includes('Unarmed')
  ).slice(0, 2)
  const abilities = results.filter(r =>
    r.category === 'racialAbility' || r.category === 'archetypeAbility'
  ).slice(0, 2)

  for (const r of powers)    moves.push({ name: r.resultLabel, type: 'power',    effectTag: detectEffectTag(r.resultLabel), behavior: detectMoveBehavior(r.resultLabel) })
  for (const r of weapons)   moves.push({ name: r.resultLabel, type: 'physical', effectTag: detectEffectTag(r.resultLabel), behavior: detectMoveBehavior(r.resultLabel) })
  for (const r of abilities) moves.push({ name: r.resultLabel, type: 'ability',  effectTag: detectEffectTag(r.resultLabel), behavior: detectMoveBehavior(r.resultLabel) })
  if (moves.length === 0)    moves.push({ name: 'Desperate Strike', type: 'physical', effectTag: null, behavior: 'attack' })

  return {
    name: name.trim() || (results.find(r => r.category === 'race')?.resultLabel ?? 'Unknown'),
    raceLabel:      results.find(r => r.category === 'race')?.resultLabel      ?? 'Unknown',
    archetypeLabel: results.find(r => r.category === 'archetype')?.resultLabel ?? 'Unknown',
    hp, maxHp: hp,
    physicalDamage, powerDamage,
    armorReduction, armorType: armorTypeLabel, weaponType: weaponTypeLabel,
    agilityRank, speedRank, charismaRank, iqRank, potentialRank, energyRank, fightingSkillRank,
    weaponEnchantTags, armorEnchantTags,
    critChance, critMultiplier, dodgeChance, initiative, moves,
  }
}

// ─── Attack Resolution ────────────────────────────────────────────────────────

interface AttackResult {
  skipped: boolean
  damage: number
  heal: number
  reflected: number   // damage returned to the attacker
  stun: boolean       // skip defender's retaliation this round
  shieldFraction: number
  applyStatus?: 'burn' | 'poison' | 'freeze'  // status to inflict on the target
  lines: string[]
}

function doAction(
  attacker: BattleCharacter,
  defender: BattleCharacter,
  attackerCurrentHp?: number,
): AttackResult {
  const lines: string[] = []

  // IQ low: stupid mistake (lose own turn)
  if (attacker.iqRank <= 5 && Math.random() < 0.09) {
    lines.push(pick(STUPID_MISTAKES).replace('{name}', attacker.name))
    return { skipped: true, damage: 0, heal: 0, reflected: 0, stun: false, shieldFraction: 0, lines }
  }

  // Defender high charisma: talks attacker out of it
  if (defender.charismaRank >= 30 && Math.random() < 0.06) {
    lines.push(pick(CHARM_LINES)
      .replace('{attacker}', attacker.name)
      .replace('{defender}', defender.name))
    return { skipped: true, damage: 0, heal: 0, reflected: 0, stun: false, shieldFraction: 0, lines }
  }

  // Attacker low charisma: fumbles
  if (attacker.charismaRank <= 5 && Math.random() < 0.08) {
    lines.push(pick(CHARISMA_FUMBLES).replace('{name}', attacker.name))
    return { skipped: true, damage: 0, heal: 0, reflected: 0, stun: false, shieldFraction: 0, lines }
  }

  // Attacker high charisma: intimidate (halves defender armor this attack)
  let intimidated = false
  if (attacker.charismaRank >= 30 && Math.random() < 0.07) {
    lines.push(pick(INTIMIDATE_LINES)
      .replace('{attacker}', attacker.name)
      .replace('{defender}', defender.name))
    intimidated = true
  }

  // Ancient weapon: erratic — 20% extra miss chance
  if (attacker.weaponType === 'Ancient' && Math.random() < 0.20) {
    lines.push(`The ancient power is erratic — ${attacker.name}'s strike goes wide!`)
    return { skipped: false, damage: 0, heal: 0, reflected: 0, stun: false, shieldFraction: 0, lines }
  }

  // Select move (energy restriction can force physical moves)
  let available = [...attacker.moves]
  if (attacker.energyRank <= 5 && Math.random() < 0.35) {
    const nonPower = available.filter(m => m.type !== 'power')
    if (nonPower.length > 0) available = nonPower
  }
  const move = pick(available)

  // Defend behavior: no damage, partial self-heal, shield vs next incoming hit
  if (move.behavior === 'defend') {
    const selfHeal = Math.round(attacker.maxHp * 0.08)
    lines.push(pick(DEFEND_PHRASES).replace('{name}', attacker.name) + ` [${move.name}]`)
    if (selfHeal > 0) lines.push(`${attacker.name} recovers ${formatHp(selfHeal)} HP while bracing!`)
    return { skipped: false, damage: 0, heal: selfHeal, reflected: 0, stun: false, shieldFraction: 0.55, lines }
  }

  // Heal behavior: no damage, significant self-heal
  if (move.behavior === 'heal') {
    const selfHeal = Math.round(attacker.maxHp * 0.22)
    lines.push(pick(HEAL_PHRASES).replace('{name}', attacker.name) + ` [${move.name}]`)
    lines.push(`${attacker.name} restores ${formatHp(selfHeal)} HP!`)
    return { skipped: false, damage: 0, heal: selfHeal, reflected: 0, stun: false, shieldFraction: 0, lines }
  }

  // Dodge check (attack moves only)
  if (Math.random() < defender.dodgeChance) {
    lines.push(`${defender.name} ${pick(DODGE_PHRASES)} ${attacker.name}'s ${move.name}!`)
    // Riposte: skilled defenders punish the whiff
    if (defender.fightingSkillRank >= 12 && Math.random() < 0.40) {
      const riposteDmg = Math.max(1, Math.round(
        defender.physicalDamage * (0.20 + Math.random() * 0.28) * (1 - attacker.armorReduction)
      ))
      lines.push(pick(RIPOSTE_LINES)
        .replace('{name}', defender.name)
        .replace('{dmg}', formatHp(riposteDmg)))
      return { skipped: false, damage: 0, heal: 0, reflected: riposteDmg, stun: false, shieldFraction: 0, lines }
    }
    return { skipped: false, damage: 0, heal: 0, reflected: 0, stun: false, shieldFraction: 0, lines }
  }

  // Berserker fury: near-death triggers desperate power surge
  const hpFraction = (attackerCurrentHp ?? attacker.hp) / attacker.maxHp
  const isBerserker = hpFraction < 0.30 && Math.random() < 0.28
  if (isBerserker) {
    lines.push(pick(BERSERKER_LINES).replace('{name}', attacker.name))
  }

  // Base damage by move type
  const baseDmg = move.type === 'power' ? attacker.powerDamage : attacker.physicalDamage

  // Move multiplier
  let mult: number
  if (attacker.weaponType === 'Exotic' && move.type !== 'power') {
    mult = 0.60 + Math.random() * 0.80   // high variance for Exotic
  } else {
    mult = move.type === 'power'
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

  // Energy boost for power moves at high energy rank
  const energyMult = move.type === 'power' && attacker.energyRank >= 30 ? 1.25 : 1.0

  // IQ high: 5% chance to pierce all armor (precision read)
  let fullPierce = false
  if (attacker.iqRank >= 18 && Math.random() < 0.05) {
    fullPierce = true
    lines.push(`${attacker.name} reads the opening perfectly — a precision strike bypasses all defenses!`)
  }

  // Crit
  const isCrit   = Math.random() < attacker.critChance
  const critMult = isCrit ? attacker.critMultiplier : 1.0

  // Effective armor (reduced by intimidate, weapon pierce, or full IQ pierce)
  // Power moves bypass 60% of armor — energy/ability attacks ignore physical defenses
  let effectiveArmor = move.type === 'power'
    ? defender.armorReduction * 0.40
    : defender.armorReduction
  if (fullPierce) {
    effectiveArmor = 0
  } else {
    if (intimidated) effectiveArmor *= 0.50
    effectiveArmor *= (1 - armorPierceFraction)
  }

  // Variance + final damage (berserker multiplier applies when HP is critical)
  const berserkerMult = isBerserker ? 2.2 + Math.random() * 0.8 : 1.0
  const variance = 0.85 + Math.random() * 0.30
  let damage = Math.max(1, Math.round(
    baseDmg * mult * weaponBonus * energyMult * critMult * berserkerMult * (1 - effectiveArmor) * variance
  ))

  // Divine armor enchant: absorbs a slice of incoming damage
  if (defender.armorEnchantTags.includes('heal')) {
    const divineAbsorb = Math.round(damage * 0.08)
    damage = Math.max(1, damage - divineAbsorb)
    lines.push(`${defender.name}'s divine armor absorbs ${formatHp(divineAbsorb)} of the blow!`)
  }

  // Battle log line
  let logLine = `${attacker.name} ${pick(ATTACK_VERBS)} ${move.name}`
  if (isCrit) logLine += ` — ${pick(CRIT_LABELS)}`
  logLine += ` ${formatHp(damage)} damage!`
  lines.push(logLine)

  // Move effect flavors + healing
  let heal = 0
  if (move.effectTag && EFFECT_FLAVOR[move.effectTag]) {
    if (move.effectTag === 'lifesteal') heal = Math.round(damage * 0.35)
    else if (move.effectTag === 'heal') heal = Math.round(damage * 0.30)
    lines.push(EFFECT_FLAVOR[move.effectTag]
      .replace('{attacker}', attacker.name)
      .replace('{target}', defender.name)
      .replace('{heal}', formatHp(heal)))
  }

  // Weapon enchantment lifesteal
  if (attacker.weaponEnchantTags.includes('lifesteal')) {
    const eHeal = Math.round(damage * 0.10)
    heal += eHeal
    lines.push(`${attacker.name}'s weapon drains ${formatHp(eHeal)} HP!`)
  }

  // Reflected damage (goes back to the attacker)
  let reflected = 0
  if (attacker.weaponType === 'Cursed') {
    reflected += Math.round(damage * 0.08)
    lines.push(`${attacker.name}'s cursed weapon bites back — ${formatHp(Math.round(damage * 0.08))} reflected!`)
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

  // IQ high: strategic strike can stun (skip defender retaliation)
  let stun = false
  if (attacker.iqRank >= 30 && Math.random() < 0.08) {
    stun = true
    lines.push(`${attacker.name}'s calculated strike leaves ${defender.name} unable to retaliate!`)
  }

  // Speed multi-hit
  if (attacker.speedRank >= 30) {
    const multiChance = attacker.speedRank >= 36 ? 0.22 : 0.15
    if (Math.random() < multiChance) {
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

  // Combo finisher: very high fighting skill occasionally chains a second weaker hit
  if (attacker.fightingSkillRank >= 28 && Math.random() < 0.18) {
    const comboDmg = Math.max(1, Math.round(damage * (0.35 + Math.random() * 0.25) * (1 - effectiveArmor)))
    damage += comboDmg
    lines.push(`${attacker.name} doesn't stop — combo finisher for ${formatHp(comboDmg)} more!`)
  }

  // Status effect application based on effectTag
  let applyStatus: 'burn' | 'poison' | 'freeze' | undefined = undefined
  if (!isBerserker) {  // berserker attacks are too wild for precision status
    if (move.effectTag === 'burn'    && Math.random() < 0.38) applyStatus = 'burn'
    else if (move.effectTag === 'poison' && Math.random() < 0.32) applyStatus = 'poison'
    else if (move.effectTag === 'slow'   && Math.random() < 0.25) applyStatus = 'freeze'
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
  type StatusType = 'burn' | 'poison' | 'freeze'
  interface Status { intensity: number; duration: number }
  const statuses: Record<string, Partial<Record<StatusType, Status>>> = {}

  // Environmental event — fires once per battle at a random round (rounds 2-4)
  const eventRound = 2 + Math.floor(Math.random() * 3)
  const eventLine  = Math.random() < 0.70 ? pick(ENVIRONMENTAL_EVENTS) : null

  for (let roundNum = 1; roundNum <= maxRounds; roundNum++) {
    const lines: string[] = []
    const stunned = new Set<string>()
    const shields: Record<string, number> = {}

    // ── Environmental event ──
    if (roundNum === eventRound && eventLine) lines.push(eventLine)

    // ── Status effect ticks (burn / poison) ──
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
        lines.push(pick(STATUS_TICK_LINES.burn)
          .replace('{name}', charArr[idx].name)
          .replace('{dmg}', formatHp(dmg)))
        s.burn.duration--
        if (s.burn.duration <= 0) delete s.burn
      }
      if (s.poison) {
        const dmg = Math.max(1, Math.round(charArr[idx].maxHp * 0.04 * s.poison.intensity))
        hpArr[idx] = Math.max(0, hpArr[idx] - dmg)
        lines.push(pick(STATUS_TICK_LINES.poison)
          .replace('{name}', charArr[idx].name)
          .replace('{dmg}', formatHp(dmg)))
        s.poison.duration--
        if (s.poison.duration <= 0) delete s.poison
      }
      if (s.freeze) {
        stunned.add(key)
        s.freeze.duration--
        if (s.freeze.duration <= 0) delete s.freeze
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
      if (stunned.has(actorKey)) {
        lines.push(`${actor.char.name} is frozen — can't move this round!`)
        continue
      }

      const enemyTeam   = actor.team === 1 ? team2 : team1
      const enemyHpArr  = actor.team === 1 ? hp2 : hp1
      const enemyTeamId = actor.team === 1 ? 2 : 1
      const livingIdxs  = enemyHpArr.map((h, i) => h > 0 ? i : -1).filter(i => i >= 0)
      if (livingIdxs.length === 0) break

      const targetIdx = livingIdxs[Math.floor(Math.random() * livingIdxs.length)]
      const targetKey  = `${enemyTeamId}-${targetIdx}`
      const result = doAction(actor.char, enemyTeam[targetIdx], actorHpArr[actor.idx])
      lines.push(...result.lines)

      if (!result.skipped) {
        const shield    = shields[targetKey] ?? 0
        const netDamage = Math.round(result.damage * (1 - shield))
        const wasAlive  = enemyHpArr[targetIdx] > 0
        enemyHpArr[targetIdx] = Math.max(0, enemyHpArr[targetIdx] - netDamage)
        actorHpArr[actor.idx] = Math.min(actor.char.maxHp, actorHpArr[actor.idx] + result.heal)
        actorHpArr[actor.idx] = Math.max(0, actorHpArr[actor.idx] - result.reflected)
        if (result.shieldFraction > 0) shields[actorKey] = result.shieldFraction
        if (result.stun) stunned.add(targetKey)

        // Apply status effect to target
        if (result.applyStatus && netDamage > 0) {
          if (!statuses[targetKey]) statuses[targetKey] = {}
          const st = statuses[targetKey]
          switch (result.applyStatus) {
            case 'burn':
              st.burn = { intensity: 1 + (st.burn?.intensity ?? 0) * 0.4, duration: 2 }
              lines.push(pick(STATUS_APPLY_LINES.burn).replace('{name}', enemyTeam[targetIdx].name))
              break
            case 'poison':
              st.poison = { intensity: 1 + (st.poison?.intensity ?? 0) * 0.4, duration: 3 }
              lines.push(pick(STATUS_APPLY_LINES.poison).replace('{name}', enemyTeam[targetIdx].name))
              break
            case 'freeze':
              st.freeze = { intensity: 1, duration: 1 }
              lines.push(pick(STATUS_APPLY_LINES.freeze).replace('{name}', enemyTeam[targetIdx].name))
              break
          }
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

    rounds.push({ roundNum, t1Hp: [...hp1], t2Hp: [...hp2], lines, winner: roundWinner })
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

  for (let i = 1; i <= maxRounds; i++) {
    const p1HpBefore = p1Hp
    const p2HpBefore = p2Hp
    const lines: string[] = []

    const initiativeDiff = (p1.initiative - p2.initiative) / Math.max(p1.initiative, p2.initiative, 1)
    const p1First = Math.random() < 0.50 + initiativeDiff * 0.30

    const firstAtk  = p1First ? p1 : p2
    const secondAtk = p1First ? p2 : p1
    let firstHp     = p1First ? p1Hp : p2Hp
    let secondHp    = p1First ? p2Hp : p1Hp

    // First actor's turn
    const r1 = doAction(firstAtk, secondAtk)
    lines.push(...r1.lines)
    if (!r1.skipped) {
      secondHp = Math.max(0, secondHp - r1.damage)
      firstHp  = Math.min(firstAtk.maxHp, firstHp + r1.heal)
      firstHp  = Math.max(0, firstHp - r1.reflected)
    }

    // Second actor retaliates (only if alive and not stunned)
    if (secondHp > 0 && !r1.stun) {
      const r2 = doAction(secondAtk, firstAtk)
      lines.push(...r2.lines)
      if (!r2.skipped) {
        // r1.shieldFraction: if first actor defended, reduce damage they take from r2
        const shieldedDmg = Math.round(r2.damage * (1 - r1.shieldFraction))
        firstHp  = Math.max(0, firstHp - shieldedDmg)
        secondHp = Math.min(secondAtk.maxHp, secondHp + r2.heal)
        secondHp = Math.max(0, secondHp - r2.reflected)
      }
    } else if (secondHp > 0 && r1.stun) {
      lines.push(`${secondAtk.name} is too stunned to retaliate!`)
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
