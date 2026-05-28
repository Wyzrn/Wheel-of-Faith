// teamController.ts — Stateful turn controller for team-vs-team battles.
//
// Mirrors BattleController1v1 but resolves at PER-ACTOR granularity: every
// `stepTurn()` returns an ArenaRound containing exactly one actor's turn,
// in initiative order, so the arena can play back one comet at a time and
// the manual hotbar can ask the player for each ally's action separately.
//
// Player flow:
//   • Cycle begins: status ticks + buff countdown + regen, queue actors by
//     initiative.
//   • Loop: pop next actor →
//       – team1 ally + manualMode: pause (awaitingActor set), wait for
//         submitAction(action) → resolve.
//       – anything else: AI pick → resolve.
//     Return ArenaRound for that one turn.
//   • Queue empty: next call rebuilds queue + ticks statuses for the new
//     cycle.

import {
  doAction, formatHp,
  type BattleCharacter, type BattleMove, type RoundFxEvent,
} from '$lib/game/battle'
import type { ArenaRound, ArenaSide, ArenaWinner } from './arena'
import { POWER_COOLDOWN_TURNS, SPELL_COOLDOWN_TURNS, pickAutoMove, type PlayerAction } from './controller'
import { GIMMICKS, roundStartHealFraction, lastStandCheck } from '$lib/gimmicks'

export interface TeamControllerMember {
  id: string
  side: ArenaSide
  char: BattleCharacter
}

type StatusType = 'burn' | 'poison' | 'freeze' | 'paralyze' | 'wither' | 'bleed'
interface Status { intensity: number; duration: number }

const STATUS_DURATIONS: Record<StatusType, number> = {
  burn: 2, poison: 3, freeze: 1, paralyze: 1, wither: 4, bleed: 3,
}

interface DefendStance { shieldFraction: number }

function pickRandom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

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
      if (action.moveName) {
        return pwr.find(m => m.name === action.moveName) ?? null
      }
      const ready = pwr.filter(m => (powerCooldowns[m.name] ?? 0) <= 0)
      return ready.length > 0 ? pickRandom(ready) : pickRandom(pwr)
    }
    case 'spell': {
      const abil = pool.filter(m => m.type === 'ability' && m.attackType === action.spellCategory)
      return abil.length > 0 ? pickRandom(abil) : null
    }
    case 'defend':
      return null
  }
}

export class BattleControllerTeam {
  private team1: TeamControllerMember[]
  private team2: TeamControllerMember[]
  private hp: Record<string, number> = {}
  private statuses: Record<string, Partial<Record<StatusType, Status>>> = {}
  private defendStance: Record<string, DefendStance | null> = {}
  // Per-actor power cooldowns — see comment in controller.ts.
  private powerCooldowns: Record<string, Record<string, number>> = {}
  private actorQueue: TeamControllerMember[] = []
  private cycle = 0
  private _winner: ArenaWinner | null = null
  // Per-actor set of one-shot gimmicks that have already fired this battle
  // (Last Stand only triggers once). Mirrors BattleController1v1.
  private firedGimmicks: Record<string, Set<string>> = {}

  constructor(team1: TeamControllerMember[], team2: TeamControllerMember[]) {
    this.team1 = team1
    this.team2 = team2
    for (const m of [...team1, ...team2]) {
      this.hp[m.id] = m.char.hp
      this.statuses[m.id] = {}
      this.defendStance[m.id] = null
      this.powerCooldowns[m.id] = {}
      this.firedGimmicks[m.id] = new Set()
      // Leader gimmick — starts the battle with a +20% damage buff (3 rounds).
      if (m.char.gimmickIds?.includes('leader')) {
        const params = GIMMICKS.leader.params!
        m.char.buffMultiplier = (params.dmgMult as number) ?? 1.20
        m.char.buffRoundsLeft = (params.rounds as number) ?? 3
      }
    }
  }

  // Cooldown inspection for the UI (hotbar's Power popover).
  getPowerCooldowns(id: string): Record<string, number> {
    return { ...(this.powerCooldowns[id] ?? {}) }
  }

  private tickCooldowns(actorId: string) {
    const cds = this.powerCooldowns[actorId]
    if (!cds) return
    for (const name of Object.keys(cds)) {
      cds[name]--
      if (cds[name] <= 0) delete cds[name]
    }
  }

  // ── Inspection ──────────────────────────────────────────────────────────
  get isOver(): boolean { return this._winner !== null }
  get winner(): ArenaWinner | null { return this._winner }
  get currentCycle(): number { return this.cycle }
  // The actor whose turn will resolve on the NEXT stepTurn() call. Read by
  // the arena to decide whether to pause for player input. Primes the queue
  // (begin-of-cycle status ticks + initiative roll) if it's empty so this
  // value is never stale at the start of a cycle.
  get awaitingActor(): TeamControllerMember | null {
    if (this._winner) return null
    this.ensureQueueReady()
    return this.actorQueue[0] ?? null
  }

  // Make sure the actor queue has a living member at the front, ticking
  // cycles forward (regen / statuses / new initiative roll) as needed.
  // Idempotent — safe to call before every awaitingActor read.
  private ensureQueueReady() {
    if (this._winner) return
    // Drop any dead members at the front of the current queue.
    while (this.actorQueue.length > 0 && (this.hp[this.actorQueue[0].id] ?? 0) <= 0) {
      this.actorQueue.shift()
    }
    if (this.actorQueue.length === 0) {
      // Cycle finished. Start a new one (regen / status ticks / re-roll).
      this.beginCycle()
      // Strip dead members the new cycle might still have queued at the front.
      while (this.actorQueue.length > 0 && (this.hp[this.actorQueue[0].id] ?? 0) <= 0) {
        this.actorQueue.shift()
      }
    }
  }
  getHp(id: string): number { return this.hp[id] ?? 0 }
  member(id: string): TeamControllerMember | undefined {
    return this.team1.find(m => m.id === id) ?? this.team2.find(m => m.id === id)
  }
  livingEnemies(side: ArenaSide): TeamControllerMember[] {
    const enemy = side === 'team1' ? this.team2 : this.team1
    return enemy.filter(m => (this.hp[m.id] ?? 0) > 0)
  }
  defendArmed(id: string): boolean { return this.defendStance[id] !== null }

  // ── Step one actor's turn ───────────────────────────────────────────────
  // `action` is required when awaitingActor is on team1 in manual mode
  // (caller's responsibility). When omitted, the controller picks an AI
  // move (random, targeting a random living enemy).
  stepTurn(action?: PlayerAction): ArenaRound {
    if (this._winner) {
      return { roundNum: this.cycle, lines: [], hpAfter: { ...this.hp }, winner: this._winner }
    }

    // Make sure the queue is primed (cycle ticks / initiative re-rolled if needed).
    this.ensureQueueReady()

    const lines: string[] = []
    const fxEvents: RoundFxEvent[] = []

    // Pop the next living actor — ensureQueueReady already cleared dead front entries.
    const actor = this.actorQueue.shift()
    if (!actor) {
      // No living actors left even after a cycle refill — draw.
      this._winner = 'draw'
      return { roundNum: this.cycle, lines, hpAfter: { ...this.hp }, winner: 'draw' }
    }

    // Resolve this actor's turn.
    this.resolveTurn(actor, action ?? null, lines, fxEvents)

    // Winner check
    const t1Dead = this.team1.every(m => this.hp[m.id] <= 0)
    const t2Dead = this.team2.every(m => this.hp[m.id] <= 0)
    let winner: ArenaWinner | undefined
    if (t1Dead && t2Dead) winner = 'draw'
    else if (t1Dead)      winner = 'team2'
    else if (t2Dead)      winner = 'team1'
    if (winner !== undefined) this._winner = winner

    return {
      roundNum: this.cycle,
      lines,
      hpAfter: { ...this.hp },
      fxEvents,
      winner,
    }
  }

  // ── Begin a new cycle: regen + buff countdown + status ticks + queue ────
  private beginCycle() {
    this.cycle++

    const allMembers = [...this.team1, ...this.team2]

    // Passive regen + Divine Favor gimmick (% maxHp at round start)
    for (const m of allMembers) {
      if (this.hp[m.id] <= 0) continue
      const r = m.char.passiveHealPerRound
      if (r > 0) this.hp[m.id] = Math.min(m.char.maxHp, this.hp[m.id] + r)
      const favorFrac = roundStartHealFraction(m.char.gimmickIds ?? [])
      if (favorFrac > 0 && this.hp[m.id] < m.char.maxHp) {
        const amount = Math.round(m.char.maxHp * favorFrac)
        this.hp[m.id] = Math.min(m.char.maxHp, this.hp[m.id] + amount)
      }
    }

    // Buff countdown
    for (const m of allMembers) {
      if (m.char.buffRoundsLeft > 0) {
        m.char.buffRoundsLeft--
        if (m.char.buffRoundsLeft === 0) m.char.buffMultiplier = 1.0
      }
    }

    // Status ticks (silent — actor-turn lines stay clean; future polish
    // can prepend status messages to the next actor's lines).
    for (const m of allMembers) {
      if (this.hp[m.id] <= 0) continue
      const s = this.statuses[m.id]
      const tick = (kind: StatusType, pct: number) => {
        const e = s[kind]; if (!e) return
        const dmg = Math.max(1, Math.round(m.char.maxHp * pct * e.intensity))
        this.hp[m.id] = Math.max(0, this.hp[m.id] - dmg)
        e.duration--
        if (e.duration <= 0) delete s[kind]
      }
      tick('burn',   0.06)
      tick('poison', 0.04)
      tick('wither', 0.03)
      tick('bleed',  0.05)
    }

    // Build initiative-ordered queue of living actors. Add a small random
    // jitter so equal-initiative actors don't always go in a fixed order.
    this.actorQueue = allMembers
      .filter(m => this.hp[m.id] > 0)
      .map(m => ({ m, roll: m.char.initiative + Math.random() * 5 }))
      .sort((a, b) => b.roll - a.roll)
      .map(x => x.m)
  }

  // ── Resolve a single actor's turn ──────────────────────────────────────
  private resolveTurn(
    actor: TeamControllerMember,
    action: PlayerAction | null,
    lines: string[],
    fxEvents: RoundFxEvent[],
  ) {
    // Defend — reactive stance, ends the turn here.
    if (action?.kind === 'defend') {
      const selfHeal = Math.round(actor.char.maxHp * 0.06)
      this.defendStance[actor.id] = { shieldFraction: 0.60 }
      this.hp[actor.id] = Math.min(actor.char.maxHp, this.hp[actor.id] + selfHeal)
      lines.push(`${actor.char.name} braces in a defensive stance — next blow will be turned aside!`)
      if (selfHeal > 0) lines.push(`${actor.char.name} recovers ${formatHp(selfHeal)} HP while guarding!`)
      return
    }

    // Frozen / paralyzed gating
    const myStatus = this.statuses[actor.id]
    if (myStatus.freeze) {
      lines.push(`${actor.char.name} is frozen — can't act this turn!`)
      return
    }
    if (myStatus.paralyze && Math.random() < 0.5) {
      lines.push(`${actor.char.name} is paralyzed — can't move!`)
      return
    }

    // Target resolution. action.targetId wins; otherwise a RANDOM living enemy.
    // Random targeting (rather than always picking the lowest-HP or first
    // member) means enemy AI in story mode spreads damage across the party
    // instead of focus-firing the same hero every round, which used to make
    // battles feel like "the AI hates this one character." Player attacks
    // still honor an explicit action.targetId picked from the UI.
    const enemies = this.livingEnemies(actor.side)
    if (enemies.length === 0) return

    let target: TeamControllerMember | undefined
    if (action?.targetId) target = this.member(action.targetId)
    if (!target || (this.hp[target.id] ?? 0) <= 0 || target.side === actor.side) {
      target = enemies[Math.floor(Math.random() * enemies.length)]
    }

    // Decrement this actor's power cooldowns at the start of their turn.
    this.tickCooldowns(actor.id)

    const forced = action
      ? resolveMove(actor.char, action, this.powerCooldowns[actor.id]) ?? undefined
      : pickAutoMove(actor.char, this.powerCooldowns[actor.id])

    const result = doAction(actor.char, target.char, this.hp[actor.id], forced)
    lines.push(...result.lines)

    // If a power or spell was used, set its cooldown so it can't be
    // re-fired immediately. +1 because tickCooldowns already ran this
    // turn — net wait is the full cooldown of THIS actor's own turns.
    if (forced && forced.type === 'power') {
      this.powerCooldowns[actor.id][forced.name] = POWER_COOLDOWN_TURNS + 1
    } else if (forced && forced.type === 'ability') {
      this.powerCooldowns[actor.id][forced.name] = SPELL_COOLDOWN_TURNS + 1
    }

    if (result.skipped) return

    // Damage application (with reactive Defend on the target side)
    let damage = result.damage
    const targetStance = this.defendStance[target.id]
    if (damage > 0 && targetStance) {
      const blocked = Math.round(damage * targetStance.shieldFraction)
      damage = Math.max(0, damage - blocked)
      lines.push(`${target.char.name}'s defensive stance turns aside ${formatHp(blocked)} damage!`)
      this.defendStance[target.id] = null
    }

    // Reflector enemy type — bounces 35% of damage back to the attacker
    // before the hit resolves. The actor still takes the reduced damage,
    // so a glass-cannon attacker can KO themselves on a tanky reflector.
    if (damage > 0 && target.char.gimmickIds?.includes('reflectShield')) {
      const bounced = Math.round(damage * 0.35)
      if (bounced > 0) {
        this.hp[actor.id] = Math.max(0, this.hp[actor.id] - bounced)
        lines.push(`${target.char.name}'s Reflective Shell bounces ${formatHp(bounced)} damage back to ${actor.char.name}!`)
      }
    }

    this.hp[target.id] = Math.max(0, this.hp[target.id] - damage)
    this.hp[actor.id]  = Math.min(actor.char.maxHp, this.hp[actor.id] + result.heal)
    this.hp[actor.id]  = Math.max(0, this.hp[actor.id] - result.reflected)
    if (result.applyStatus) this.applyStatus(target, result.applyStatus, lines)

    // Cursed enemy type — every successful hit they land applies a
    // random status effect to the defender on top of damage. Status
    // immunities still apply (applyStatus is a no-op when immune).
    if (damage > 0 && actor.char.gimmickIds?.includes('curseStrike')) {
      const cursedStatuses: StatusType[] = ['burn', 'poison', 'bleed', 'wither']
      const pick = cursedStatuses[Math.floor(Math.random() * cursedStatuses.length)]
      this.applyStatus(target, pick, lines)
    }

    // Last Stand gimmick — once per battle, when HP drops below threshold,
    // surge back with a fraction of maxHp restored.
    if (this.hp[target.id] > 0) {
      const hpFrac = this.hp[target.id] / target.char.maxHp
      const fired  = this.firedGimmicks[target.id]
      const ls = lastStandCheck(target.char.gimmickIds ?? [], hpFrac, fired.has('lastStand'))
      if (ls) {
        const heal = Math.round(target.char.maxHp * ls.healFraction)
        this.hp[target.id] = Math.min(target.char.maxHp, this.hp[target.id] + heal)
        fired.add('lastStand')
        lines.push(`${target.char.name}'s Last Stand triggers — surges back with ${formatHp(heal)} HP!`)
      }
    }

    // FX event for the projectile layer. attackerIdx / targetIdxs are
    // indices into team1/team2 in the arena's natural order.
    const move = forced ?? actor.char.moves.find(m => m.attackType !== 'passive')
    const attackerTeam = actor.side === 'team1' ? this.team1 : this.team2
    const targetTeam   = actor.side === 'team1' ? this.team2 : this.team1
    const attackerIdx  = attackerTeam.findIndex(m => m.id === actor.id)
    const targetIdx    = targetTeam.findIndex(m => m.id === target.id)
    fxEvents.push({
      attackerSide: actor.side,
      attackerIdx: Math.max(0, attackerIdx),
      targetIdxs:  [Math.max(0, targetIdx)],
      element:     move?.element,
      grade:       move?.grade,
      attackType:  move?.attackType ?? 'attack',
      isCrit:      false,
    })

    if (this.hp[target.id] <= 0) {
      lines.push(`${target.char.name} has been defeated!`)
      this._handleOnDeathGimmicks(target, actor, lines)
    }
  }

  // On-death gimmick hooks. Enemy-only Story Mode threat types apply
  // their signature mechanic here: bombers detonate their remaining
  // damage to a random enemy, cloners spawn weakened copies of themselves.
  private _handleOnDeathGimmicks(
    dead: TeamControllerMember,
    killer: TeamControllerMember,
    lines: string[],
  ): void {
    const gids = dead.char.gimmickIds ?? []
    if (gids.includes('bomberDeath')) {
      // Detonates for 1× the bomber's PHYSICAL damage stat to a random
      // living enemy (i.e. someone on the killer's side). Predictable
      // enough to play around — never one-shots a maxed-HP hero, but
      // chunks a wounded one badly.
      const targets = (killer.side === 'team1' ? this.team1 : this.team2)
        .filter(m => (this.hp[m.id] ?? 0) > 0)
      if (targets.length > 0) {
        const t = targets[Math.floor(Math.random() * targets.length)]
        const dmg = Math.max(1, Math.round(dead.char.physicalDamage * 1.5))
        this.hp[t.id] = Math.max(0, this.hp[t.id] - dmg)
        lines.push(`💥 ${dead.char.name} detonates — ${t.char.name} takes ${formatHp(dmg)} damage!`)
        if (this.hp[t.id] <= 0) {
          lines.push(`${t.char.name} has been defeated!`)
          // Recurse into death-gimmicks of the new victim (rare chain).
          this._handleOnDeathGimmicks(t, dead, lines)
        }
      }
    }
    if (gids.includes('clonerDeath')) {
      // Spawn 3 mini-clones onto the dead enemy's side, each at 10% of
      // its original max HP and damage. New clones get IDs derived from
      // the parent so each gets unique controller state. Skipped if the
      // dead enemy is itself a clone (no infinite splitting).
      if (!dead.id.startsWith('clone-')) {
        const COUNT = 3
        const FRAC = 0.10
        const team = dead.side === 'team1' ? this.team1 : this.team2
        for (let k = 0; k < COUNT; k++) {
          const cloneId = `clone-${dead.id}-${k}-${Date.now()}`
          const cloneHp = Math.max(1, Math.round(dead.char.maxHp * FRAC))
          const cloneDmg = Math.max(1, Math.round(dead.char.physicalDamage * FRAC))
          const cloneChar = {
            ...dead.char,
            name: `${dead.char.name} Clone ${k + 1}`,
            hp: cloneHp,
            maxHp: cloneHp,
            physicalDamage: cloneDmg,
            powerDamage: Math.round(cloneDmg * 0.9),
            gimmickIds: [],  // clones don't re-split
            moves: dead.char.moves,
          }
          team.push({ id: cloneId, side: dead.side, char: cloneChar })
          this.hp[cloneId] = cloneHp
          this.statuses[cloneId] = {}
          this.defendStance[cloneId] = null
          this.powerCooldowns[cloneId] = {}
          this.firedGimmicks[cloneId] = new Set()
          this.actorQueue.push({ id: cloneId, side: dead.side, char: cloneChar })
        }
        lines.push(`🧬 ${dead.char.name} splits into ${COUNT} weakened clones!`)
      }
    }
  }

  private applyStatus(target: TeamControllerMember, type: StatusType, lines: string[]) {
    if (target.char.statusImmunities.includes(type)) return
    const s = this.statuses[target.id]
    const existing = s[type]
    s[type] = {
      intensity: 1 + (existing?.intensity ?? 0) * 0.4,
      duration:  STATUS_DURATIONS[type],
    }
    lines.push(`${target.char.name} is afflicted by ${type}!`)
  }
}
