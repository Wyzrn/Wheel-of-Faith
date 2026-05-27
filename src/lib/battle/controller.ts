// controller.ts — Stateful turn controller for manual + auto battles.
//
// The pure simulator (`simulateBattle` in `$lib/game/battle.ts`) runs the
// whole fight upfront and returns every round. That's perfect for replays
// and auto-only views, but useless for a manual-input mode where the player
// chooses Power / Weapon / Spell-category / Defend each turn.
//
// BattleController wraps the same primitives (`doAction`, status ticks)
// but pauses on each side's turn so a caller can either:
//   • supply a PlayerAction (manual mode), or
//   • let `stepAuto()` pick randomly (auto mode — equivalent to the
//     simulator but driven turn-by-turn so the UI can interleave VFX).
//
// Segment-3 scope: 1v1 only. Team-battle controller extends this in S6.

import {
  doAction, formatHp, moveGradeMult,
  type BattleCharacter, type BattleMove, type RoundFxEvent,
} from '$lib/game/battle'
import type { ArenaRound, ArenaSide, ArenaWinner } from './arena'
import type { AttackType } from '$lib/content/types'

// ── PlayerAction shapes ─────────────────────────────────────────────────────

export type PlayerActionKind = 'weapon' | 'power' | 'spell' | 'defend'

export interface PlayerAction {
  kind: PlayerActionKind
  // For 'spell' actions only — which category of spell to cast. The
  // controller picks a random move from the actor's pool that matches this
  // category (matching the prompt: "it will use a random attack from that
  // category that's in your character's ability list").
  spellCategory?: AttackType
  // For 'power' actions — the exact power move to fire. Power picks are
  // explicit (not random) because each power surfaces individually in the
  // hotbar's power popover with its own damage estimate + cooldown badge.
  moveName?: string
  // For multi-enemy battles only — defaults to the lone opponent in 1v1.
  targetId?: string
}

// ── Per-move cooldowns ─────────────────────────────────────────────────────
// Powers and spell abilities each go on cooldown after use. Decremented at
// the start of each turn the actor takes (not on every engine cycle), so a
// move locked on turn N is available again on turn N + COOLDOWN + 1.
//
// Spells (especially heals) used to lock characters into invincibility
// loops — full heal every turn outpaced incoming damage. Cooldowns + a
// 12% heal cap (in battle.ts) keep healers useful without making them
// unkillable.
export const POWER_COOLDOWN_TURNS = 3
export const SPELL_COOLDOWN_TURNS = 3

// ── Defend state (reactive — auto-applies on next incoming hit) ─────────────
// Per the locked decision: "Defend stays armed across multiple hits until
// consumed. Reactive — auto-applies on next hit." The defender's next
// incoming attack is reduced; one consumption disarms.
interface DefendStance {
  shieldFraction: number    // 0..1 — fraction of next hit's damage to absorb
  selfHeal: number          // small HP refund applied immediately when armed
}

// ── Status tracking (mirrors the simulator's status model) ─────────────────
type StatusType = 'burn' | 'poison' | 'freeze' | 'paralyze' | 'wither' | 'bleed'
interface Status { intensity: number; duration: number }

const STATUS_DURATIONS: Record<StatusType, number> = {
  burn: 2, poison: 3, freeze: 1, paralyze: 1, wither: 4, bleed: 3,
}

// ── Spell-category catalog (what to show in the spell submenu) ─────────────
// A "spell" in the hotbar sense maps to any move with type='ability'. Their
// attackType determines which category bucket they live in.

export const SPELL_CATEGORIES: AttackType[] = ['attack', 'aoe', 'heal', 'buff', 'debuff', 'summon']

export const SPELL_CATEGORY_LABEL: Record<AttackType, string> = {
  attack:  'Strike',
  aoe:     'Storm',
  heal:    'Mend',
  buff:    'Empower',
  debuff:  'Curse',
  summon:  'Summon',
  passive: 'Passive',
}

export const SPELL_CATEGORY_ICON: Record<AttackType, string> = {
  attack:  'bolt',
  aoe:     'blur_on',
  heal:    'favorite',
  buff:    'auto_awesome',
  debuff:  'scatter_plot',
  summon:  'pets',
  passive: 'security',
}

// Returns the categories the actor has at least one matching ability move
// for. Used by the manual hotbar's spell submenu — categories with no
// available moves never appear.
export function castableSpellCategories(char: BattleCharacter): AttackType[] {
  const out = new Set<AttackType>()
  for (const m of char.moves) {
    if (m.type !== 'ability') continue
    if (m.attackType === 'passive') continue
    out.add(m.attackType)
  }
  return SPELL_CATEGORIES.filter(c => out.has(c))
}

// ── Power option (UI helper) ──────────────────────────────────────────────
// One entry per power move on a character — surfaces the move name, an
// optional element, a deterministic damage estimate, and remaining cooldown
// turns (0 = ready). Used by the manual hotbar's Power popover.
export interface PowerOption {
  name: string
  element?: string
  grade?: string
  damage: number
  cooldown: number   // 0 = ready, >0 = turns until usable
  // The power's underlying attackType — exposed so the hotbar knows
  // whether the move needs an enemy target (attack/aoe/debuff) or fires
  // on the caster (buff/heal/summon).
  attackType: AttackType
}

// Deterministic mid-range damage estimate FOR A SPECIFIC POWER. Folds in
// the move's own grade multiplier so an F-tier power and a God-tier power
// surface visibly different damage numbers — matching what doAction will
// actually roll (the same gradeMult lives inside the engine's damage
// formula). Variance, crits, armor, and weakness aren't applied here —
// this is the typical-hit preview, not a guaranteed roll.
function powerDamageEstimate(char: BattleCharacter, move: BattleMove): number {
  const energyBonus = char.energyRank >= 30 ? 1.25 : 1.0
  const buffMult    = char.buffRoundsLeft > 0 ? char.buffMultiplier : 1.0
  // Power moveMult mid-range ≈ 0.80.
  const gradeMult   = moveGradeMult(move.grade)
  return Math.max(1, Math.round(char.powerDamage * 0.80 * energyBonus * buffMult * gradeMult))
}

export function powerOptions(
  char: BattleCharacter,
  cooldowns: Record<string, number> = {},
): PowerOption[] {
  const out: PowerOption[] = []
  for (const m of char.moves) {
    if (m.type !== 'power' || m.attackType === 'passive') continue
    out.push({
      name:       m.name,
      element:    m.element,
      grade:      m.grade,
      damage:     powerDamageEstimate(char, m),
      cooldown:   cooldowns[m.name] ?? 0,
      attackType: m.attackType,
    })
  }
  // Sort by descending damage so the heaviest hitter sits at the top of
  // the popover — easier to read at a glance.
  return out.sort((a, b) => b.damage - a.damage)
}

// ── Controller availability summary (UI helper) ─────────────────────────────
export interface ActionAvailability {
  weapon:  boolean                       // has any 'physical' attack move
  defend:  boolean                       // always true — defend is intrinsic
  spell:   AttackType[]                  // categories with at least one move
  powers:  PowerOption[]                 // per-power entries with cooldowns
}

export function availableActions(
  char: BattleCharacter,
  powerCooldowns: Record<string, number> = {},
): ActionAvailability {
  let hasPhysical = false
  for (const m of char.moves) {
    if (m.attackType === 'passive') continue
    if (m.type === 'physical') hasPhysical = true
  }
  return {
    weapon: hasPhysical,
    defend: true,
    spell:  castableSpellCategories(char),
    powers: powerOptions(char, powerCooldowns),
  }
}

// Resolve a PlayerAction into a concrete BattleMove on the actor. Honors
// per-power cooldowns: random-power AI picks (no moveName specified) skip
// powers that are still cooling down. Returns null if no move matches.
function resolveMove(
  char: BattleCharacter,
  action: PlayerAction,
  powerCooldowns: Record<string, number> = {},
): BattleMove | null {
  const pool = char.moves.filter(m => m.attackType !== 'passive')
  switch (action.kind) {
    case 'weapon': {
      const phys = pool.filter(m => m.type === 'physical')
      return phys.length > 0 ? pickRandom(phys) : null
    }
    case 'power': {
      const pwr = pool.filter(m => m.type === 'power')
      if (pwr.length === 0) return null
      // Explicit pick from the hotbar's power popover.
      if (action.moveName) {
        const exact = pwr.find(m => m.name === action.moveName)
        return exact ?? null   // don't silently fall through if the named power isn't theirs
      }
      // AI / random pick — prefer powers off cooldown.
      const ready = pwr.filter(m => (powerCooldowns[m.name] ?? 0) <= 0)
      return ready.length > 0 ? pickRandom(ready) : pickRandom(pwr)
    }
    case 'spell': {
      const abil = pool.filter(m => m.type === 'ability' && m.attackType === action.spellCategory)
      if (abil.length === 0) return null
      // Prefer abilities off cooldown if any — fall back to any matching
      // ability when all are recharging.
      const ready = abil.filter(m => (powerCooldowns[m.name] ?? 0) <= 0)
      return ready.length > 0 ? pickRandom(ready) : pickRandom(abil)
    }
    case 'defend':
      return null   // defend has no underlying move — handled directly
  }
}

function pickRandom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

// AI / auto-mode move picker. Mirrors the simulator's behaviour (skip
// passives; energy-rank≤5 biases toward non-power) but ALSO filters out
// power and spell moves that are currently on cooldown so the AI doesn't
// spam the same recently-fired ability. Returns undefined if no specific
// pick — caller passes that through and lets doAction pick on its own.
export function pickAutoMove(
  char: BattleCharacter,
  cooldowns: Record<string, number> = {},
): BattleMove | undefined {
  let pool = char.moves.filter(m => m.attackType !== 'passive')
  // Low-energy bias: 35% of the time, drop power moves entirely.
  if (char.energyRank <= 5 && Math.random() < 0.35) {
    const nonPower = pool.filter(m => m.type !== 'power')
    if (nonPower.length > 0) pool = nonPower
  }
  // Remove cooled-down moves — applies to BOTH power and spell (ability)
  // moves. Weapons (type='physical') are never on cooldown.
  const ready = pool.filter(m => {
    if (m.type === 'physical') return true
    return (cooldowns[m.name] ?? 0) <= 0
  })
  const final = ready.length > 0 ? ready : pool
  return final.length > 0 ? pickRandom(final) : undefined
}

// ── BattleController (1v1) ──────────────────────────────────────────────────

export interface ControllerMember {
  id: string
  side: ArenaSide
  char: BattleCharacter
}

export class BattleController1v1 {
  // Mutable runtime state
  private members: [ControllerMember, ControllerMember]
  private hp: Record<string, number> = {}
  private statuses: Record<string, Partial<Record<StatusType, Status>>> = {}
  private defendStance: Record<string, DefendStance | null> = {}
  // Per-actor power cooldowns. `{ actorId: { moveName: turnsRemaining } }`.
  private powerCooldowns: Record<string, Record<string, number>> = {}
  private roundNum = 0
  private _winner: ArenaWinner | null = null
  // Whose turn the controller is awaiting input for (null = controller can
  // resolve a full round without waiting; e.g. all-auto mode). Reserved
  // for a future asymmetric step API where one side's input is collected
  // before the round resolves; for now both turns resolve inside runRound.
  private awaiting: ControllerMember | null = null

  constructor(team1: ControllerMember, team2: ControllerMember) {
    this.members = [team1, team2]
    for (const m of [team1, team2]) {
      this.hp[m.id] = m.char.hp
      this.statuses[m.id] = {}
      this.defendStance[m.id] = null
      this.powerCooldowns[m.id] = {}
    }
  }

  // Cooldown inspection for the UI (hotbar's Power popover).
  getPowerCooldowns(id: string): Record<string, number> {
    return { ...(this.powerCooldowns[id] ?? {}) }
  }

  // ── Inspection ──────────────────────────────────────────────────────────
  get isOver(): boolean { return this._winner !== null }
  get winner(): ArenaWinner | null { return this._winner }
  get currentRoundNum(): number { return this.roundNum }
  get awaitingInputFor(): ControllerMember | null { return this.awaiting }
  getHp(id: string): number { return this.hp[id] ?? 0 }
  getDefendArmed(id: string): boolean { return this.defendStance[id] !== null }
  member(id: string): ControllerMember | undefined {
    return this.members.find(m => m.id === id)
  }
  opponent(id: string): ControllerMember {
    return this.members[0].id === id ? this.members[1] : this.members[0]
  }

  // ── Step (auto) ─────────────────────────────────────────────────────────
  // Runs one full engine round with no player input — random moves on both
  // sides. Returns the assembled ArenaRound.
  stepAuto(): ArenaRound {
    return this.runRound(/*p1Action*/ null, /*p2Action*/ null)
  }

  // ── Step (manual) ───────────────────────────────────────────────────────
  // Apply the player's action for `actorId`. The opponent's response is
  // picked automatically (random). Returns the round.
  submitAction(actorId: string, action: PlayerAction): ArenaRound {
    const actor = this.member(actorId)
    if (!actor) throw new Error(`unknown actor ${actorId}`)
    const isTeam1 = actor.side === 'team1'
    return this.runRound(isTeam1 ? action : null, isTeam1 ? null : action)
  }

  // ── Core: one engine round (both sides act once each) ────────────────────
  private runRound(p1Action: PlayerAction | null, p2Action: PlayerAction | null): ArenaRound {
    if (this._winner) {
      // Battle's over — return an empty round so callers can detect end-of-fight.
      return { roundNum: this.roundNum, lines: [], hpAfter: { ...this.hp }, winner: this._winner }
    }
    this.roundNum++

    const [m1, m2] = this.members
    const lines: string[] = []
    const fxEvents: RoundFxEvent[] = []

    // Passive regen
    for (const m of this.members) {
      const c = m.char
      if (c.passiveHealPerRound > 0 && this.hp[m.id] > 0) {
        this.hp[m.id] = Math.min(c.maxHp, this.hp[m.id] + c.passiveHealPerRound)
        lines.push(`${c.name} regenerates ${formatHp(c.passiveHealPerRound)} HP!`)
      }
    }

    // Buff countdown
    for (const m of this.members) {
      if (m.char.buffRoundsLeft > 0) {
        m.char.buffRoundsLeft--
        if (m.char.buffRoundsLeft === 0) m.char.buffMultiplier = 1.0
      }
    }

    // Status ticks
    for (const m of this.members) this.tickStatuses(m, lines)

    const m1Frozen = this.consumeFreezeOrParalyze(m1)
    const m2Frozen = this.consumeFreezeOrParalyze(m2)

    // Initiative order — match simulateBattle's biasing
    const initDiff = (m1.char.initiative - m2.char.initiative) /
                     Math.max(m1.char.initiative, m2.char.initiative, 1)
    const m1First = Math.random() < 0.50 + initDiff * 0.30

    const order = m1First ? [m1, m2] : [m2, m1]
    const actions: Array<PlayerAction | null> = m1First
      ? [p1Action, p2Action]
      : [p2Action, p1Action]
    const blocked = m1First ? [m1Frozen, m2Frozen] : [m2Frozen, m1Frozen]

    let firstStun = false
    for (let i = 0; i < 2; i++) {
      const actor = order[i]
      const target = order[1 - i]
      if (this.hp[actor.id] <= 0) continue
      if (this.hp[target.id] <= 0) break
      if (i === 1 && firstStun) {
        lines.push(`${actor.char.name} is too stunned to retaliate!`)
        continue
      }
      const block = blocked[i]
      if (block) {
        lines.push(`${actor.char.name} is ${block}!`)
        continue
      }
      const action = actions[i]
      this.resolveTurn(actor, target, action, lines, fxEvents)
      if (this.hp[actor.id] <= 0 || this.hp[target.id] <= 0) break
      // Stun propagates to the next iteration's actor (the opponent).
      firstStun = i === 0 && this.lastStun
      this.lastStun = false
    }

    // End-of-round winner check
    const m1Dead = this.hp[m1.id] <= 0
    const m2Dead = this.hp[m2.id] <= 0
    let winner: ArenaWinner | undefined
    if (m1Dead && m2Dead) winner = 'draw'
    else if (m1Dead)      winner = 'team2'
    else if (m2Dead)      winner = 'team1'

    if (winner !== undefined) this._winner = winner

    return {
      roundNum: this.roundNum,
      lines,
      hpAfter: { ...this.hp },
      fxEvents,
      winner,
    }
  }

  private lastStun = false

  // Apply one side's turn — defend (no doAction), or doAction with the
  // appropriate forced/random move.
  private resolveTurn(
    actor: ControllerMember,
    target: ControllerMember,
    action: PlayerAction | null,
    lines: string[],
    fxEvents: RoundFxEvent[],
  ) {
    // ── Defend: arm a reactive stance for next incoming hit ──────────────
    if (action?.kind === 'defend') {
      const selfHeal = Math.round(actor.char.maxHp * 0.06)
      this.defendStance[actor.id] = { shieldFraction: 0.60, selfHeal: 0 }
      this.hp[actor.id] = Math.min(actor.char.maxHp, this.hp[actor.id] + selfHeal)
      lines.push(`${actor.char.name} braces in a defensive stance — next blow will be turned aside!`)
      if (selfHeal > 0) lines.push(`${actor.char.name} recovers ${formatHp(selfHeal)} HP while guarding!`)
      return
    }

    // Decrement this actor's power cooldowns at the start of their turn —
    // a cooldown set on turn N expires after N + POWER_COOLDOWN_TURNS.
    this.tickCooldowns(actor.id)

    // Resolve the move to play. Manual-mode actions name an exact move (or
    // a category to pick from); AI turns force a non-cooldown-aware random
    // pick that nonetheless avoids re-using a power that's still cooling.
    const forced = action
      ? resolveMove(actor.char, action, this.powerCooldowns[actor.id]) ?? undefined
      : pickAutoMove(actor.char, this.powerCooldowns[actor.id])

    const result = doAction(actor.char, target.char, this.hp[actor.id], forced)
    lines.push(...result.lines)

    // If a power or spell move was used, set its cooldown so the same
    // ability can't be re-fired immediately. +1 because tickCooldowns
    // already ran at the start of THIS turn.
    if (forced && forced.type === 'power') {
      this.powerCooldowns[actor.id][forced.name] = POWER_COOLDOWN_TURNS + 1
    } else if (forced && forced.type === 'ability') {
      this.powerCooldowns[actor.id][forced.name] = SPELL_COOLDOWN_TURNS + 1
    }

    if (result.skipped) return

    // Apply target defend-stance reduction (reactive shield)
    let damage = result.damage
    const targetStance = this.defendStance[target.id]
    if (damage > 0 && targetStance) {
      const blocked = Math.round(damage * targetStance.shieldFraction)
      damage = Math.max(0, damage - blocked)
      lines.push(`${target.char.name}'s defensive stance turns aside ${formatHp(blocked)} damage!`)
      this.defendStance[target.id] = null   // consume on first hit
    }

    this.hp[target.id] = Math.max(0, this.hp[target.id] - damage)
    this.hp[actor.id]  = Math.min(actor.char.maxHp, this.hp[actor.id] + result.heal)
    this.hp[actor.id]  = Math.max(0, this.hp[actor.id] - result.reflected)
    if (result.applyStatus) this.applyStatus(target, result.applyStatus, lines)
    if (result.stun) this.lastStun = true

    // Emit a fx event for the UI's projectile layer
    const fxMove = forced ?? actor.char.moves.find(m => m.attackType !== 'passive')
    fxEvents.push({
      attackerSide: actor.side === 'team1' ? 'team1' : 'team2',
      attackerIdx: 0,
      targetIdxs: [0],
      element:    fxMove?.element,
      grade:      fxMove?.grade,
      attackType: fxMove?.attackType ?? 'attack',
      isCrit:     false,
    })
  }

  // ── Status helpers (mirrors simulateBattle) ─────────────────────────────
  private tickStatuses(m: ControllerMember, lines: string[]) {
    const s = this.statuses[m.id]
    const c = m.char
    const ref = { v: this.hp[m.id] }
    const tickOne = (kind: StatusType, pctOfMax: number, lineFn: (d: string) => string) => {
      const e = s[kind]
      if (!e) return
      const dmg = Math.max(1, Math.round(c.maxHp * pctOfMax * e.intensity))
      ref.v = Math.max(0, ref.v - dmg)
      lines.push(lineFn(formatHp(dmg)))
      e.duration--
      if (e.duration <= 0) delete s[kind]
    }
    tickOne('burn',   0.06, d => `🔥 ${c.name} burns — ${d} damage!`)
    tickOne('poison', 0.04, d => `☠️ Poison tears through ${c.name} — ${d} damage!`)
    tickOne('wither', 0.03, d => `💀 ${c.name} withers — ${d} damage!`)
    tickOne('bleed',  0.05, d => `🩸 ${c.name} bleeds — ${d} damage!`)
    this.hp[m.id] = ref.v
  }

  // Consume freeze (always blocks turn while active) and paralyze (50% block).
  // Returns a label string ("frozen"/"paralyzed") if the actor is blocked,
  // null otherwise.
  private consumeFreezeOrParalyze(m: ControllerMember): string | null {
    const s = this.statuses[m.id]
    let blocked: string | null = null
    if (s.freeze && s.freeze.duration > 0) {
      blocked = 'frozen — can\'t act this round'
      s.freeze.duration--
      if (s.freeze.duration <= 0) delete s.freeze
    }
    if (s.paralyze && Math.random() < 0.5) blocked = blocked ?? 'paralyzed — can\'t act this turn'
    if (s.paralyze) {
      s.paralyze.duration--
      if (s.paralyze.duration <= 0) delete s.paralyze
    }
    return blocked
  }

  // Decrement all of `actorId`'s power cooldowns by 1. Called at the start
  // of every turn the actor takes — so cooldowns advance with the actor's
  // own pacing rather than wall-clock rounds.
  private tickCooldowns(actorId: string) {
    const cds = this.powerCooldowns[actorId]
    if (!cds) return
    for (const name of Object.keys(cds)) {
      cds[name]--
      if (cds[name] <= 0) delete cds[name]
    }
  }

  private applyStatus(m: ControllerMember, type: StatusType, lines: string[]) {
    const s = this.statuses[m.id]
    const existing = s[type]
    const newIntensity = 1 + (existing?.intensity ?? 0) * 0.4
    s[type] = { intensity: newIntensity, duration: STATUS_DURATIONS[type] }
    lines.push(`${m.char.name} is afflicted by ${type}!`)
  }
}
