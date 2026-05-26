// arena.ts — Shared types & pure helpers for the unified BattleArena shell.
//
// The 4 battle views (Rivals, Quick, Team, Story) used to each carry their own
// copy of the element-FX table, anim-detection regexes, log-line damage
// parser, and HP/anchor bookkeeping. This module consolidates the shared
// machinery so BattleArena.svelte can drive playback uniformly across modes.
//
// Segment-1 scope: behaviour-preserving extraction. Segment 2 replaces the
// VFX layer with a projectile system; Segment 3 layers a stateful turn
// controller on top.

import type {
  BattleCharacter, BattleRound, TeamBattleRound, RoundFxEvent,
} from '$lib/game/battle'

// ── Member / Team / Round shape (mode-agnostic) ─────────────────────────────

export type ArenaSide = 'team1' | 'team2'

export interface ArenaMember {
  id: string                         // stable within a single battle (e.g. char shareId or `t1-0`)
  side: ArenaSide
  name: string
  raceLabel?: string
  archetypeLabel?: string
  hp: number
  maxHp: number
  stats?: Array<{ label: string; value: string | number }>
  accent?: string                    // optional per-member tint
}

export interface ArenaTeam {
  side: ArenaSide
  label: string                      // 'You' / 'Team 1' / 'Foe' / character name in 1v1
  accent: string                     // primary color for cards & log
  members: ArenaMember[]
}

export type ArenaWinner = ArenaSide | 'draw'

export interface ArenaRound {
  roundNum: number
  lines: string[]
  // Final HP per member-id after this round resolves on screen. Listed
  // explicitly (rather than implied) so future manual rounds can settle
  // partial HP without recomputing the engine state.
  hpAfter: Record<string, number>
  fxEvents?: RoundFxEvent[]
  winner?: ArenaWinner
}

// ── Element → FX lookup ─────────────────────────────────────────────────────
// Single source of truth — previously duplicated across all 4 views.

export const ELEMENT_FX: Record<string, { type: string; color: string }> = {
  Fire:      { type: 'fire',      color: '#f97316' },
  Ice:       { type: 'ice',       color: '#7dd3fc' },
  Lightning: { type: 'lightning', color: '#fbbf24' },
  Earth:     { type: 'earth',     color: '#a16207' },
  Wind:      { type: 'wind',      color: '#e2e8f0' },
  Shadow:    { type: 'shadow',    color: '#8b5cf6' },
  Light:     { type: 'holy',      color: '#fde68a' },
  Arcane:    { type: 'energy',    color: '#c084fc' },
  Nature:    { type: 'poison',    color: '#22c55e' },
  Void:      { type: 'void',      color: '#6b21a8' },
  Cosmic:    { type: 'energy',    color: '#818cf8' },
  Blood:     { type: 'blood',     color: '#dc2626' },
  Metal:     { type: 'slash',     color: '#94a3b8' },
  Soul:      { type: 'holy',      color: '#f9a8d4' },
  Poison:    { type: 'poison',    color: '#84cc16' },
  Time:      { type: 'time',      color: '#a78bfa' },
  Water:     { type: 'water',     color: '#38bdf8' },
  Sound:     { type: 'lightning', color: '#e0f2fe' },
  Gravity:   { type: 'gravity',   color: '#6366f1' },
  Psychic:   { type: 'psychic',   color: '#e879f9' },
  Chaos:     { type: 'cursed',    color: '#f43f5e' },
  Neutral:   { type: 'slash',     color: '#f87171' },
}

// ── Log-line → anim hint ────────────────────────────────────────────────────
// Returns the FX type/color and a direction relative to the log narrator.
// Called by BattleArena per line; the simulator-provided fxEvent (when
// present) overrides the inferred element so colors track the engine truth.

export type AnimDir = 'ltr' | 'rtl' | 'center'

export interface AnimHint { type: string; color: string; direction: AnimDir }

export function detectAnim(line: string, t1Names: Set<string>, t2Names: Set<string>): AnimHint | null {
  const hasAction =
    line.includes('damage!') || line.includes('restores') ||
    line.includes('recovers') || line.includes('barrier') || line.includes('defensive') ||
    /BERSERK|combo finisher|follow-up|evad|dodge|riposte|counter-attack|retaliates|strikes back/i.test(line) ||
    /narrowly dodges|weaves around|barely evades|slips past|anticipates|phases through|blinks away|mirrors away|deflects/i.test(line)
  if (!hasAction) return null

  const direction: AnimDir =
    [...t1Names].some(n => line.startsWith(n)) ? 'ltr' :
    [...t2Names].some(n => line.startsWith(n)) ? 'rtl' :
    'center'

  if (/narrowly dodges|weaves around|barely evades|slips past|anticipates and sidesteps|phases through|blinks away from|mirrors away/i.test(line))
    return { type: 'dodge', color: '#a5f3fc', direction }
  if (/barrier forms|defensive stance|protective shell|bracing/i.test(line))
    return { type: 'shield', color: '#93c5fd', direction: 'center' }
  if (/CRITICAL|DEVASTATING|PERFECT STRIKE|OVERWHELMING|UNSTOPPABLE|OVERKILL/i.test(line))
    return { type: 'crit', color: '#fde047', direction }
  if (/berserk|frenzy/i.test(line))     return { type: 'berserker', color: '#ef4444', direction }
  if (/combo finisher|follow-up/i.test(line)) return { type: 'combo', color: '#f59e0b', direction }
  if (/restores|recovers.*HP|vital force|mends/i.test(line)) return { type: 'holy', color: '#34d399', direction }
  if (/fire|flame|blaze|inferno|burn|ember|magma|lava|heat/i.test(line)) return { type: 'fire', color: '#f97316', direction }
  if (/shadow|void|abyss|soul drain|leech/i.test(line)) return { type: 'shadow', color: '#8b5cf6', direction }
  if (/blood|crimson/i.test(line)) return { type: 'blood', color: '#dc2626', direction }
  if (/curse/i.test(line)) return { type: 'cursed', color: '#7c3aed', direction }
  if (/lightning|thunder|electric|storm|volt|spark|shock|arc/i.test(line)) return { type: 'lightning', color: '#fbbf24', direction }
  if (/ice|frost|freeze|cryo|blizzard|snow|cold|glacier/i.test(line)) return { type: 'ice', color: '#7dd3fc', direction }
  if (/divine|holy|celestial|angel|sacred|radiant|blessed/i.test(line)) return { type: 'holy', color: '#fde68a', direction }
  if (/water|wave|aqua|flood|tidal|ocean|torrent/i.test(line)) return { type: 'water', color: '#38bdf8', direction }
  if (/time|temporal|chrono|rewind|haste|blink|phase/i.test(line)) return { type: 'time', color: '#a78bfa', direction }
  if (/psychic|mind|telepathy|mental|chaos|reality|warp|phantom/i.test(line)) return { type: 'psychic', color: '#e879f9', direction }
  if (/poison|acid|toxic|venom|plague|rot/i.test(line)) return { type: 'poison', color: '#84cc16', direction }
  if (/gravity|black hole|collapse|crush|singularity|weight/i.test(line)) return { type: 'gravity', color: '#6366f1', direction }
  if (/wind|gust|tornado|vortex|cyclone|whirlwind/i.test(line)) return { type: 'wind', color: '#e2e8f0', direction }
  if (/earth|rock|stone|ground|quake|mountain|boulder/i.test(line)) return { type: 'earth', color: '#a16207', direction }
  if (/energy|power|force|blast|surge|beam/i.test(line)) return { type: 'energy', color: '#60a5fa', direction }
  if (/riposte|counter-attack|retaliates|strikes back/i.test(line)) return { type: 'counter', color: '#f59e0b', direction }
  if (line.includes('damage!')) return { type: 'slash', color: '#f87171', direction }
  return null
}

// ── Damage-number parsing & log → damage event helpers ──────────────────────

export function parseDamageNumber(s: string): number {
  const cleaned = s.replace(/,/g, '').toUpperCase()
  if (cleaned.endsWith('K')) return Math.round(parseFloat(cleaned) * 1_000)
  if (cleaned.endsWith('M')) return Math.round(parseFloat(cleaned) * 1_000_000)
  if (cleaned.endsWith('B')) return Math.round(parseFloat(cleaned) * 1_000_000_000)
  return Math.round(parseFloat(cleaned) || 0)
}

export type DamageKind = 'damage' | 'heal' | 'crit' | 'miss' | 'shield'

export interface DamageHit { targetName: string; value: number; kind: DamageKind }

// Pure parser — given a log line and the list of known character names,
// returns the implied damage / heal / miss / shield event (if any). Caller
// converts to a DamageEvent (adds id & screen coords).
export function damageHitFromLine(line: string, allNames: string[]): DamageHit | null {
  const dmgMatch = line.match(/for\s+([\d.,]+[KMB]?)\s+damage!?/i)
  if (dmgMatch) {
    const preBoundary = line.lastIndexOf(' for ')
    const head = preBoundary > 0 ? line.slice(0, preBoundary) : line
    let target: string | null = null
    let lastIdx = -1
    for (const n of allNames) {
      const i = head.lastIndexOf(n)
      if (i > lastIdx) { lastIdx = i; target = n }
    }
    if (target) {
      const isCrit = /CRITICAL|DEVASTATING|PERFECT STRIKE|OVERWHELMING|UNSTOPPABLE|OVERKILL/i.test(line)
      return { targetName: target, value: parseDamageNumber(dmgMatch[1]), kind: isCrit ? 'crit' : 'damage' }
    }
  }
  const healMatch = line.match(/(?:restores|recovers|mends)\s+([\d.,]+[KMB]?)\s*HP/i)
  if (healMatch) {
    for (const n of allNames) {
      if (line.startsWith(n)) return { targetName: n, value: parseDamageNumber(healMatch[1]), kind: 'heal' }
    }
  }
  if (/evades|dodges|misses/i.test(line)) {
    for (const n of allNames) if (line.includes(n)) return { targetName: n, value: 0, kind: 'miss' }
  }
  if (/barrier forms around|defensive stance|bracing/i.test(line)) {
    for (const n of allNames) if (line.includes(n)) return { targetName: n, value: 0, kind: 'shield' }
  }
  return null
}

// ── Normalizers: engine round → ArenaRound ─────────────────────────────────
// 1v1: BattleRound has p1Hp / p2Hp; we map them to the two members' ids.
// Team: TeamBattleRound has t1Hp[] / t2Hp[] arrays parallel to team order.

export function normalizeRound1v1(
  r: BattleRound, p1Id: string, p2Id: string,
): ArenaRound {
  const winner: ArenaWinner | undefined =
    r.winner === 'p1' ? 'team1' :
    r.winner === 'p2' ? 'team2' :
    r.winner === 'draw' ? 'draw' :
    undefined
  return {
    roundNum: r.roundNum,
    lines: r.lines,
    hpAfter: { [p1Id]: r.p1Hp, [p2Id]: r.p2Hp },
    fxEvents: r.fxEvents,
    winner,
  }
}

export function normalizeRoundTeam(
  r: TeamBattleRound, team1Ids: string[], team2Ids: string[],
): ArenaRound {
  const hpAfter: Record<string, number> = {}
  team1Ids.forEach((id, i) => { hpAfter[id] = r.t1Hp[i] ?? 0 })
  team2Ids.forEach((id, i) => { hpAfter[id] = r.t2Hp[i] ?? 0 })
  return {
    roundNum: r.roundNum,
    lines: r.lines,
    hpAfter,
    fxEvents: r.fxEvents,
    winner: r.winner,
  }
}

// ── Convenience: build ArenaMember from BattleCharacter ─────────────────────

export function memberFromChar(
  char: BattleCharacter, id: string, side: ArenaSide, formatHp: (n: number) => string,
): ArenaMember {
  return {
    id, side,
    name: char.name,
    raceLabel: char.raceLabel,
    archetypeLabel: char.archetypeLabel,
    hp: char.hp,
    maxHp: char.maxHp,
    stats: [
      { label: 'ATK',  value: formatHp(char.physicalDamage) },
      { label: 'DEF',  value: Math.round(char.armorReduction * 100) + '%' },
      { label: 'INIT', value: Math.round(char.initiative) },
    ],
  }
}

// ── HP color heuristic (shared) ─────────────────────────────────────────────
export function hpColor(pct: number): string {
  if (pct > 0.50) return '#22c55e'
  if (pct > 0.25) return '#eab308'
  return '#ef4444'
}

// ── Speed: settings.battleSpeed (legacy slider) → playback delay ────────────
// Kept identical to the per-view implementations so Segment-1 migration is
// behaviour-preserving. Segment 5 swaps battleSpeed for an autoBattle toggle.
export function speedDelay(ms: number, speedFactor: number): number {
  if (speedFactor >= 99) return 10
  return Math.max(50, ms / speedFactor)
}
