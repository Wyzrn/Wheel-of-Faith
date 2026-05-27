<!--
  BattleArena.svelte — Unified shell used by all 4 battle modes (Rivals,
  Quick, Team, Story). Owns the chrome that used to be duplicated across
  views: header, character cards, HP bars, status badges, battle log,
  VFX overlay, floating damage indicators, and intro/result phase gating.

  Modes plug in via snippets (`prebattle`, `result`, `hotbar`, `cardExtra`)
  and supply their own normalized rounds + teams. The arena drives playback
  internally via a single round/line state machine.

  Segment 1 (this file): behaviour-preserving extraction of the existing
  auto-playback path. Segment 2 will replace the VFX overlay block with a
  projectile system; Segment 3 layers a stateful turn controller for manual
  input.
-->
<script lang="ts">
  import { onDestroy, tick, type Snippet } from 'svelte'
  import AttackFX from './AttackFX.svelte'
  import BattleHotbar from './BattleHotbar.svelte'
  import DamageIndicator from './DamageIndicator.svelte'
  import type { DamageEvent } from '$lib/game/damageEvent'
  import { deriveStatusBadges } from '$lib/game/battleStatuses'
  import { formatHp } from '$lib/game/battle'
  import type { RoundFxEvent } from '$lib/game/battle'
  import {
    BattleController1v1, availableActions,
    type PlayerAction,
  } from '$lib/battle/controller'
  import { BattleControllerTeam } from '$lib/battle/teamController'
  import {
    type ArenaMember, type ArenaRound, type ArenaTeam, type ArenaWinner,
    type AnimDir, ELEMENT_FX, detectAnim, damageHitFromLine, hpColor, speedDelay,
  } from '$lib/battle/arena'

  interface Props {
    teams: [ArenaTeam, ArenaTeam]
    // Scripted-mode rounds (legacy). Ignored when `controller` is supplied.
    rounds?: ArenaRound[]
    phase: 'intro' | 'battle' | 'result'
    modeTitle: string
    modeSubtitle?: string
    modeAccent?: string
    introMs?: number
    speedFactor: number              // settings.battleSpeed (legacy)
    effectsEnabled: boolean          // settings.effectsEnabled
    autoStart?: boolean              // if true, auto-transition intro→battle
    // Controller mode — when provided, rounds are pulled from the
    // stateful controller on demand rather than from `rounds`. Accepts
    // either the 1v1 controller (full-round granularity) or the team
    // controller (per-actor turn granularity).
    controller?: BattleController1v1 | BattleControllerTeam
    // When true (and `controller` is provided), pause for player input
    // each turn. When false, controller auto-steps for visual playback.
    manualMode?: boolean
    // ID of the ArenaMember the player controls (controller mode only).
    playerActorId?: string
    // Fires when the player flips the visible Auto / Manual switch.
    onManualToggle?: (manual: boolean) => void
    // Instant Battle gamepass owners see a Skip button that fast-forwards
    // the whole fight to the result. Surfaced only when this is true.
    canInstant?: boolean
    // Snippets
    prebattle?: Snippet
    result?: Snippet
    hotbar?: Snippet
    cardExtra?: Snippet<[ArenaMember]>
    // Callbacks
    onPhaseChange?: (p: 'intro' | 'battle' | 'result') => void
    onRoundEnd?: (round: ArenaRound) => void
    onLineShown?: (line: string) => void
    onBattleEnd?: (winner: ArenaWinner) => void
  }
  let {
    teams, rounds = [], phase = $bindable(), modeTitle, modeSubtitle = '',
    modeAccent = '#f0c040', introMs = 2600, speedFactor, effectsEnabled,
    autoStart = true,
    controller, manualMode = false, playerActorId, onManualToggle,
    canInstant = false,
    prebattle, result, hotbar, cardExtra,
    onPhaseChange, onRoundEnd, onLineShown, onBattleEnd,
  }: Props = $props()

  // Whether this battle is being driven by a controller (turn-by-turn)
  // instead of a pre-baked rounds[] queue.
  let controllerMode = $derived(!!controller)
  let isTeamController = $derived(controller instanceof BattleControllerTeam)

  // ── Display HP (animated towards round.hpAfter on round-end) ───────────────
  // Member id → current displayed HP. Initialized from members and overwritten
  // as rounds resolve.
  let displayHp = $state<Record<string, number>>({})
  $effect(() => {
    const next: Record<string, number> = {}
    for (const t of teams) for (const m of t.members) next[m.id] = m.hp
    displayHp = next
  })

  let allMembers = $derived([...teams[0].members, ...teams[1].members])
  let allNames   = $derived(allMembers.map(m => m.name))

  // The actor the player is currently controlling. Default to team1[0] if
  // not provided. Held as derived so it tracks team changes.
  let playerActor = $derived(
    allMembers.find(m => m.id === playerActorId) ?? teams[0].members[0]
  )
  let t1Names    = $derived(new Set(teams[0].members.map(m => m.name)))
  let t2Names    = $derived(new Set(teams[1].members.map(m => m.name)))

  let logLines = $state<string[]>([])
  let charStatusByName = $derived(deriveStatusBadges(logLines, allNames))

  let roundIdx = $state(0)
  let roundDisplayN = $derived(Math.max(1, roundIdx))
  let totalRounds = $derived(rounds.length)
  let winner = $state<ArenaWinner | null>(null)

  // ── DOM refs for VFX anchoring ─────────────────────────────────────────────
  //
  // Positioning model (NEW — replaces the old viewport-fixed approach that
  // drifted off-card on Story Mode's narrow centered column and on any view
  // where the parent applied transforms or non-default writing modes):
  //
  //   1. The arena's outer wrapper is `position: relative`.
  //   2. ALL overlays — projectiles, impact bursts, damage numbers — are
  //      `position: absolute` inside that wrapper.
  //   3. Coords are computed by subtracting the wrapper's bounding rect from
  //      the card's bounding rect (so they're wrapper-local pixels, not
  //      viewport pixels).
  //
  // This means VFX always lands on the actual card, regardless of scroll,
  // transforms, parent widths, or whether the wrapper is centered.
  let wrapperEl: HTMLDivElement | null = $state(null)
  const charEls = new Map<string, HTMLElement>()
  function trackCharEl(node: HTMLElement, args: { name: string }) {
    charEls.set(args.name, node)
    return { destroy() { charEls.delete(args.name) } }
  }
  function memberOrigin(name: string | null): { x: number; y: number } | undefined {
    if (!name || !wrapperEl) return undefined
    const el = charEls.get(name)
    if (!el) return undefined
    const cardRect = el.getBoundingClientRect()
    const wrapRect = wrapperEl.getBoundingClientRect()
    if (cardRect.width === 0 || wrapRect.width === 0) return undefined
    return {
      x: cardRect.left - wrapRect.left + cardRect.width / 2,
      y: cardRect.top  - wrapRect.top  + cardRect.height / 2,
    }
  }
  function wrapperOrigin(dir: AnimDir): { x: number; y: number } | undefined {
    if (!wrapperEl) return undefined
    const wr = wrapperEl.getBoundingClientRect()
    if (wr.width === 0) return undefined
    const xRel = dir === 'rtl' ? 0.75 : dir === 'ltr' ? 0.25 : 0.5
    return {
      x: wr.width * xRel,
      y: wr.height / 2,
    }
  }

  // ── VFX overlay state (Segment 1: 1:1 with legacy behaviour) ──────────────
  let activeAnim = $state<{
    type: string; color: string; key: number; direction: AnimDir;
    grade?: string; origin?: { x: number; y: number }; attackType?: string
  } | null>(null)
  let animKey = 0
  // Name of the character currently playing the panel-dodge phase
  // animation — scoped so only their card phases, not the whole team.
  let dodgingName = $state<string | null>(null)
  let animTimeoutId: ReturnType<typeof setTimeout> | null = null

  function showAnim(
    type: string, color: string, direction: AnimDir,
    grade: string | undefined, origin: { x: number; y: number } | undefined,
    attackType: string | undefined,
    dodgeMember?: string,
  ) {
    if (animTimeoutId) clearTimeout(animTimeoutId)
    activeAnim = { type, color, key: ++animKey, direction, grade, origin, attackType }
    dodgingName = type === 'dodge' ? (dodgeMember ?? null) : null
    animTimeoutId = setTimeout(() => { activeAnim = null; dodgingName = null }, 950)
  }

  // ── Screen shake ─────────────────────────────────────────────────────────
  // Camera-style hit feedback. The wrapper translates briefly when an attack
  // lands; absolutely-positioned VFX children move with it (relative
  // positioning model is preserved). Skipped when reduced motion is set or
  // when effects are disabled. Driven by Web Animations API so a new shake
  // can cleanly cancel an in-flight one.
  let shakeAnimation: Animation | null = null
  type ShakeStrength = 'soft' | 'medium' | 'hard'
  const SHAKE_PROFILES: Record<ShakeStrength, { dur: number; amp: number }> = {
    soft:   { dur: 220, amp: 4 },
    medium: { dur: 320, amp: 8 },
    hard:   { dur: 460, amp: 14 },
  }
  function prefersReducedMotion(): boolean {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }
  function shakeStrengthFor(
    fxAttackType: string | undefined,
    type: string,
    grade: string | undefined,
  ): ShakeStrength | null {
    // No shake for dodges, shields, heals, buffs, summons — they aren't impacts.
    if (type === 'dodge' || type === 'shield') return null
    if (fxAttackType === 'heal' || fxAttackType === 'buff' || fxAttackType === 'summon') return null
    // AOE always shakes hard — it's an arena-wide event.
    if (fxAttackType === 'aoe') return 'hard'
    // Crits / berserker pop one step heavier than their grade would imply.
    const bump = (type === 'crit' || type === 'berserker') ? 1 : 0
    const g = (grade ?? '').replace(/[+-]/g, '').toUpperCase()
    let base: ShakeStrength
    if (g === 'GOD' || g === 'SSS' || g === 'SS') base = 'hard'
    else if (g === 'S' || g === 'A' || g === 'B')  base = 'medium'
    else                                            base = 'soft'
    if (bump) {
      if (base === 'soft')   return 'medium'
      if (base === 'medium') return 'hard'
    }
    return base
  }
  function triggerShake(strength: ShakeStrength | null) {
    if (!strength || !wrapperEl) return
    if (!effectsEnabled) return
    if (prefersReducedMotion()) return
    const { dur, amp } = SHAKE_PROFILES[strength]
    shakeAnimation?.cancel()
    // Classic camera-shake keyframes: decaying jitter on x/y.
    shakeAnimation = wrapperEl.animate(
      [
        { transform: 'translate(0, 0)' },
        { transform: `translate(${ amp}px, ${-amp * 0.5}px)` },
        { transform: `translate(${-amp * 0.85}px, ${ amp * 0.4}px)` },
        { transform: `translate(${ amp * 0.65}px, ${ amp * 0.25}px)` },
        { transform: `translate(${-amp * 0.45}px, ${-amp * 0.3}px)` },
        { transform: `translate(${ amp * 0.25}px, ${ amp * 0.15}px)` },
        { transform: 'translate(0, 0)' },
      ],
      { duration: dur, easing: 'cubic-bezier(.36,.07,.19,.97)', fill: 'none' },
    )
  }

  // ── Damage indicators ──────────────────────────────────────────────────────
  let damageEvents = $state<DamageEvent[]>([])
  let dmgIdCounter = 0
  function emitDamage(targetName: string, value: number, kind: DamageEvent['kind']) {
    const el = charEls.get(targetName)
    if (!el || !wrapperEl) return
    const cardRect = el.getBoundingClientRect()
    const wrapRect = wrapperEl.getBoundingClientRect()
    if (cardRect.width === 0 || wrapRect.width === 0) return
    // Wrapper-relative coords. DamageIndicator is rendered absolutely
    // inside the wrapper so positioning stays glued to the card across
    // scroll / transform / mobile viewport changes.
    const ev: DamageEvent = {
      id: ++dmgIdCounter,
      x: cardRect.left - wrapRect.left + cardRect.width / 2,
      y: cardRect.top  - wrapRect.top  + cardRect.height * 0.3,
      value, kind,
    }
    damageEvents = [...damageEvents.slice(-29), ev]
    setTimeout(() => { damageEvents = damageEvents.filter(d => d.id !== ev.id) }, 1400)
  }

  function inferAttackerName(line: string): string | null {
    for (const n of allNames) if (line.startsWith(n)) return n
    return null
  }

  // ── Projectile registry retired post-S5 — all damage now flows through
  //     the in-place / beam paths. Component file + helpers kept around
  //     only as reference if a future feature wants them back.

  // ── Beam registry ─────────────────────────────────────────────────────────
  // A beam is a straight line of light from the attacker anchor to the
  // target anchor — drawn in via a stroke-dashoffset animation, with the
  // impact burst firing at the target at the moment the line lands.
  // Beam-type elements (holy / arcane / cosmic / energy / void / sound)
  // use beams INSTEAD of the comet projectile so the effect reads as a
  // sustained channel rather than a thrown projectile.
  interface Beam {
    id: number
    startX: number; startY: number
    endX: number; endY: number
    color: string
    gradeIdx: number
    onImpact: () => void
    durationMs: number
    fadeMs: number
    widthMult: number
  }
  let beams = $state<Beam[]>([])
  let beamIdCounter = 0
  const BEAM_DURATION_MS = 380
  const BEAM_FADE_DURATION_MS = 220

  // Per-type beam width multipliers — kamehameha-style elements get wider
  // glow/main/core layers so they read as massive channeled blasts vs the
  // narrower precise lances of arcane/void.
  const BEAM_WIDTH_MULT: Record<string, number> = {
    cosmic: 1.8,   // wide cosmic ray
    energy: 2.0,   // KAMEHAMEHA — widest of all
    sound:  1.6,   // wide sonic blast
    holy:   1.1,   // baseline divine beam
    arcane: 0.85,  // focused arcane lance
    void:   0.95,  // tight void ray
  }

  function spawnBeam(
    startX: number, startY: number,
    endX: number, endY: number,
    color: string, grade: string | undefined,
    onImpact: () => void,
    typeKey?: string,
  ) {
    const gradeIdx = GRADE_IDX[grade ?? 'C'] ?? 3
    // Speed-scale the beam duration so "fast" actually feels fast — the
    // glow/main/core all share these timings via CSS variables below.
    const speed = Math.max(0.4, Math.min(4, speedFactor))
    const dur = Math.max(140, Math.round(BEAM_DURATION_MS / speed))
    const fade = Math.max(80, Math.round(BEAM_FADE_DURATION_MS / speed))
    const widthMult: number = (typeKey && BEAM_WIDTH_MULT[typeKey]) || 1.0
    const b: Beam = {
      id: ++beamIdCounter,
      startX, startY, endX, endY,
      color, gradeIdx,
      onImpact,
      durationMs: dur,
      fadeMs: fade,
      widthMult,
    }
    beams = [...beams, b]
    setTimeout(() => onImpact(), dur)
    setTimeout(() => {
      beams = beams.filter(x => x.id !== b.id)
    }, dur + fade)
  }

  // FX types that render as a beam line attacker→target. Everything else
  // anchors in-place on the target's card (the legacy "comet flies across
  // the screen" projectile path is gone — it looked like a skip every time
  // the comet over/undershot, and read worse than a clean stationary burst).
  const BEAM_TYPES = new Set(['holy', 'arcane', 'cosmic', 'energy', 'void', 'sound'])

  const GRADE_IDX: Record<string, number> = {
    F: 0, E: 1, D: 2, C: 3, B: 4, A: 5, S: 6, SS: 7, SSS: 8, God: 9, Godly: 9,
  }

  // Resolve an ArenaMember from a fxEvent.attackerSide / targetIdxs entry.
  function memberFromFxIndex(side: 'p1' | 'p2' | 'team1' | 'team2', idx: number): ArenaMember | undefined {
    if (side === 'p1' || side === 'team1') return teams[0].members[idx]
    if (side === 'p2' || side === 'team2') return teams[1].members[idx]
    return undefined
  }
  function oppositeSide(side: 'p1' | 'p2' | 'team1' | 'team2'): 'p1' | 'p2' | 'team1' | 'team2' {
    if (side === 'p1') return 'p2'
    if (side === 'p2') return 'p1'
    if (side === 'team1') return 'team2'
    return 'team1'
  }
  function memberOriginById(id: string): { x: number; y: number } | undefined {
    const m = allMembers.find(x => x.id === id)
    if (!m) return undefined
    return memberOrigin(m.name)
  }

  // ── Round / line playback ─────────────────────────────────────────────────
  let logEl: HTMLDivElement | null = $state(null)
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let currentFxEvents: RoundFxEvent[] = []
  let fxEventIdx = 0
  let aoeRemainingHits = 0

  async function scrollLog() {
    await tick()
    if (logEl) logEl.scrollTop = logEl.scrollHeight
  }

  function maybeEmitDamageFromLine(line: string) {
    if (!effectsEnabled) return
    const hit = damageHitFromLine(line, allNames)
    if (hit) emitDamage(hit.targetName, hit.value, hit.kind)
  }

  // Status-effect → FX mapping. Fires an in-place burst on the target
  // when the controller (or simulator) logs an "X is afflicted by Y" line
  // or one of the flavorful STATUS_APPLY_LINES variants.
  const STATUS_FX: Record<string, { type: string; color: string }> = {
    burn:     { type: 'fire',      color: '#f97316' },
    poison:   { type: 'poison',    color: '#84cc16' },
    freeze:   { type: 'ice',       color: '#7dd3fc' },
    paralyze: { type: 'lightning', color: '#fbbf24' },
    wither:   { type: 'shadow',    color: '#8b5cf6' },
    bleed:    { type: 'blood',     color: '#dc2626' },
    weaken:   { type: 'cursed',    color: '#7c3aed' },
    stun:     { type: 'lightning', color: '#fbbf24' },
  }

  // Returns {type, color, targetName} when the line announces a status
  // application. Recognizes both the controller's simple form ("X is
  // afflicted by Y!") and the simulator's flavorful variants ("X ignites
  // — they're on fire!", "Ice encases X — they can't move!", etc.).
  function detectStatusApply(line: string): { fx: { type: string; color: string }; targetName: string } | null {
    // Simple form first.
    const m = line.match(/^(.+?) is afflicted by (\w+)/)
    if (m) {
      const target = m[1]
      const kind   = m[2].toLowerCase()
      const fx = STATUS_FX[kind]
      if (fx && allNames.includes(target)) return { fx, targetName: target }
    }
    // Flavorful variants (text-only — no status word in line).
    for (const [kind, fx] of Object.entries(STATUS_FX)) {
      const patterns: Record<string, RegExp> = {
        burn:     /(.+?) ignites — they'?re on fire|(.+?)'?s form erupts in flame/,
        poison:   /(.+?) is poisoned — toxin spreads|(.+?) staggers, venom coursing/,
        freeze:   /(.+?) is frozen solid|Ice encases (.+?) —/,
        paralyze: /(.+?)'?s strength is sapped/,  // weaken-like; closest match
      }
      const re = patterns[kind]
      if (re) {
        const match = line.match(re)
        if (match) {
          const target = match[1] || match[2]
          if (target && allNames.includes(target)) return { fx, targetName: target }
        }
      }
    }
    return null
  }

  function playLines(lines: string[], onDone: () => void) {
    if (lines.length === 0) { onDone(); return }
    const [head, ...rest] = lines
    logLines = [...logLines, head]
    onLineShown?.(head)
    scrollLog()

    // Status-apply VFX — fires regardless of `anim` detection. The burst
    // lands on the afflicted target's card with the matching element color.
    const statusHit = effectsEnabled ? detectStatusApply(head) : null
    if (statusHit) {
      const origin = memberOrigin(statusHit.targetName) ?? wrapperOrigin('center')
      if (origin) {
        showAnim(statusHit.fx.type, statusHit.fx.color, 'center', undefined, origin, undefined)
      }
    }

    const anim = detectAnim(head, t1Names, t2Names)
    const isDamage   = head.includes('damage!')
    const isHealLine = /restores|recovers.*HP|vital force|mends/i.test(head)

    // Damage indicator timing:
    //  • Damage attacks with a paired fxEvent: defer until projectile impact
    //    so the number pops at the moment the comet lands.
    //  • Everything else (heals/misses/shields/no fxEvent): emit immediately.
    let deferDamageEmit = false

    if (anim && effectsEnabled) {
      const fx = currentFxEvents[fxEventIdx]
      const grade = (anim.type !== 'dodge' && anim.type !== 'shield' && fx) ? fx.grade : undefined

      let aoeSkip = false
      if (isDamage && aoeRemainingHits > 0) {
        aoeRemainingHits--
        aoeSkip = true
      } else if (fx && (isDamage || isHealLine)) {
        fxEventIdx++
        if (isDamage && fx.attackType === 'aoe' && fx.targetIdxs) {
          aoeRemainingHits = Math.max(0, fx.targetIdxs.length - 1)
        }
      }

      if (!aoeSkip) {
        let { type, color, direction } = anim
        // Override FX type/color from the simulator's element when present —
        // more accurate than the text-regex fallback in detectAnim.
        if (fx && isDamage && type !== 'crit' && type !== 'berserker' && type !== 'dodge') {
          const elFx = fx.element ? ELEMENT_FX[fx.element] : null
          if (elFx) { type = elFx.type; color = elFx.color }
        }
        const fxAttackType = (fx && type !== 'dodge' && type !== 'shield') ? fx.attackType : undefined

        // ── Dispatch by FX category ────────────────────────────────────────
        // Three rendering paths (projectile retired):
        //   1. HEAL (fxAttackType==='heal') — anchors on the CASTER and
        //      renders the holy heal-rise burst, never a beam.
        //   2. BEAM_TYPES (holy / arcane / cosmic / energy / void / sound)
        //      — beam line from attacker anchor to target anchor.
        //   3. IN_PLACE (default for every other damage attack + status
        //      VFX) — burst on the target's card. Uses the same
        //      positioning model as status effects: parse the target's
        //      name from the line text, look it up via memberOrigin(name),
        //      fall back to wrapper center.
        //
        // Dodge / shield / crit / berserker still take the legacy
        // non-projectile path below since they fire on the actor, not the
        // target, and the visual is self-contained at the card.
        const isHeal       = fxAttackType === 'heal'
        const isBeam       = !isHeal && BEAM_TYPES.has(type)
        const isActorBurst = type === 'crit' || type === 'dodge' ||
                             type === 'shield' || type === 'berserker'
        const isInPlace    = !isHeal && !isBeam && !isActorBurst && isDamage && !!fx

        // Resolve attacker + targets once for the next several branches.
        const resolveAttackerOrigin = (): { x: number; y: number } | undefined => {
          if (!fx) return undefined
          const att = memberFromFxIndex(fx.attackerSide, fx.attackerIdx)
          return att ? memberOriginById(att.id) : undefined
        }
        // Find the target the same way status effects do: parse the target
        // name out of the damage line, look it up in the live charEls map.
        // Falls back to fxEvent.targetIdxs[0], then to undefined.
        const resolveTargetOrigin = (): { x: number; y: number } | undefined => {
          const hit = damageHitFromLine(head, allNames)
          if (hit) {
            const fromLine = memberOrigin(hit.targetName)
            if (fromLine) return fromLine
          }
          if (fx) {
            const enemySide = oppositeSide(fx.attackerSide)
            const tgt = (fx.targetIdxs ?? [0])
              .map(i => memberFromFxIndex(enemySide, i))
              .filter((m): m is ArenaMember => !!m)[0]
            if (tgt) {
              const o = memberOriginById(tgt.id)
              if (o) return o
            }
          }
          return undefined
        }

        if (isHeal) {
          // Heal — anchor on the CASTER (line's leading name), trigger the
          // holy heal-rise mode by passing direction='center' + 'heal'
          // attackType. Never a beam, even when element is Light.
          const casterName = inferAttackerName(head)
          const origin = (casterName ? memberOrigin(casterName) : undefined)
                       ?? wrapperOrigin('center')
          showAnim('holy', color, 'center', grade, origin, 'heal')
          const hit = damageHitFromLine(head, allNames)
          if (hit) emitDamage(hit.targetName, hit.value, hit.kind)
          deferDamageEmit = true
        } else if (isInPlace) {
          // In-place at the target's card — uses status-effect positioning
          // (line-text → name → memberOrigin). Falls back to wrapper
          // CENTER instead of the previous direction-based offset which
          // misplaced attacks toward one side of the column.
          const targetOrigin = resolveTargetOrigin() ?? wrapperOrigin('center')
          showAnim(type, color, direction, grade, targetOrigin, fxAttackType)
          triggerShake(shakeStrengthFor(fxAttackType, type, grade))
          const hit = damageHitFromLine(head, allNames)
          if (hit) emitDamage(hit.targetName, hit.value, hit.kind)
          deferDamageEmit = true
        } else if (isBeam && fx) {
          // Beam path — line from attacker anchor to target anchor.
          const startOrigin = resolveAttackerOrigin()
          const targetOrigin = resolveTargetOrigin()
          if (startOrigin && targetOrigin) {
            const hit = damageHitFromLine(head, allNames)
            spawnBeam(
              startOrigin.x, startOrigin.y, targetOrigin.x, targetOrigin.y,
              color, grade,
              () => {
                // Impact burst at the target end of the beam. Use the
                // 'center' direction so beam-type SVGs (holy etc.) play
                // their compact center-burst instead of their long
                // beam-extension lines — those lines pointed BACK
                // toward the attacker and made beams look like they
                // were firing both directions at once.
                showAnim(type, color, 'center', grade, targetOrigin, fxAttackType)
                triggerShake(shakeStrengthFor(fxAttackType, type, grade))
                if (hit) emitDamage(hit.targetName, hit.value, hit.kind)
              },
              type,
            )
            deferDamageEmit = true
          } else {
            // Fallback to in-place burst at target.
            const fallbackOrigin = targetOrigin ?? wrapperOrigin(direction)
            showAnim(type, color, direction, grade, fallbackOrigin, fxAttackType)
            triggerShake(shakeStrengthFor(fxAttackType, type, grade))
          }
        } else {
          // Non-projectile path: dodges, shields, crits (in-place flash),
          // heals, buffs, summons, debuffs. Anchored to the actor's card.
          const enemyDir: AnimDir = direction === 'ltr' ? 'rtl' : direction === 'rtl' ? 'ltr' : 'center'
          const originDir = (fxAttackType === 'aoe' || fxAttackType === 'debuff') ? enemyDir : direction
          // For dodges the log line is "DefenderName narrowly dodges
          // AttackerName's StrikeName!" so the line starts with the
          // DEFENDER's name — that's whose card should phase, not the
          // whole team column.
          const lineLeader = inferAttackerName(head)
          let origin = (fxAttackType !== 'aoe' && fxAttackType !== 'debuff')
            ? memberOrigin(lineLeader)
            : undefined
          if (!origin) origin = wrapperOrigin(originDir)
          showAnim(type, color, direction, grade, origin, fxAttackType, lineLeader ?? undefined)
          // Crits/berserker land as impacts — shake. Dodges/shields/heals
          // are filtered out inside shakeStrengthFor.
          triggerShake(shakeStrengthFor(fxAttackType, type, grade))
        }
      }
    }

    if (!deferDamageEmit) maybeEmitDamageFromLine(head)

    // Base line pacing. Damage lines need to land roughly after the VFX
    // does — projectile is ~450ms, beam is ~380ms, in-place burst is
    // 600-900ms. 800ms reads as comfortable at Normal (1.0×); Fast (2.4×)
    // brings it to ~330ms which is genuinely brisk.
    const base = head.startsWith('──') ? 420 : 800
    timeoutId = setTimeout(() => playLines(rest, onDone), speedDelay(base, speedFactor))
  }

  // Plays back one already-resolved ArenaRound. After playback, dispatches
  // to the right next-round source (scripted queue, controller auto-step,
  // or pause for manual input).
  let lastSeparatorRound = 0
  function playOneRound(round: ArenaRound) {
    roundIdx++
    currentFxEvents = round.fxEvents ?? []
    fxEventIdx = 0
    aoeRemainingHits = 0

    // Team controller resolves PER ACTOR — multiple consecutive rounds can
    // share the same engine roundNum (one cycle). Print the separator only
    // when the round counter advances.
    const showSeparator = round.roundNum > lastSeparatorRound
    if (showSeparator) lastSeparatorRound = round.roundNum
    const lines = showSeparator
      ? [`── Round ${round.roundNum} ──`, ...round.lines]
      : [...round.lines]
    playLines(lines, () => {
      // Settle HPs for this round
      const next = { ...displayHp }
      for (const id of Object.keys(round.hpAfter)) next[id] = round.hpAfter[id]
      displayHp = next
      onRoundEnd?.(round)
      if (round.winner !== undefined) {
        finishBattle(round.winner)
        return
      }
      timeoutId = setTimeout(advanceAfterRound, speedDelay(650, speedFactor))
    })
  }

  // Decides what to do once a round's playback completes.
  function advanceAfterRound() {
    if (controllerMode && controller) {
      if (controller.isOver) { finishBattle(controller.winner ?? null); return }
      if (isTeamController) {
        // Team controller: awaitingActor primes the queue (cycle ticks +
        // initiative re-roll) and returns the actor whose turn is next.
        // If they're a player-controlled team1 ally in manual mode, pause
        // for input. Otherwise step automatically.
        const teamCtrl = controller as BattleControllerTeam
        const nextActor = teamCtrl.awaitingActor
        if (manualMode && nextActor?.side === 'team1') {
          awaitingPlayerInput = true
          currentActorId = nextActor.id
        } else {
          playOneRound(teamCtrl.stepTurn())
        }
      } else {
        // 1v1 controller: each call resolves a full engine round.
        const ctrl = controller as BattleController1v1
        if (manualMode) {
          awaitingPlayerInput = true
        } else {
          playOneRound(ctrl.stepAuto())
        }
      }
    } else {
      // Scripted mode — pull from the pre-baked queue
      if (roundIdx >= rounds.length) {
        finishBattle(rounds.at(-1)?.winner ?? null)
        return
      }
      playOneRound(rounds[roundIdx])
    }
  }

  // Looks at the team controller and returns the actor whose turn is up
  // *next* (the queue may not yet be primed if the cycle just ended).
  function peekNextActor(c: BattleControllerTeam) {
    return c.awaitingActor
  }

  // Called by the hotbar when the player submits an action.
  let awaitingPlayerInput = $state(false)
  // ID of the team1 ally currently up for input (team controller only).
  let currentActorId = $state<string | null>(null)
  // Pending action awaiting a target click (multi-enemy team battles).
  let pickingTarget = $state<PlayerAction | null>(null)

  // Returns the BattleCharacter for the team1 ally awaiting input.
  let currentActorChar = $derived.by(() => {
    if (!controller || !awaitingPlayerInput) return null
    if (isTeamController) {
      const c = controller as BattleControllerTeam
      const id = currentActorId
      if (!id) return null
      return c.member(id)?.char ?? null
    }
    const c = controller as BattleController1v1
    return playerActor ? c.member(playerActor.id)?.char ?? null : null
  })

  // The ID under the actor's nameplate is what the hotbar key reads.
  let currentActorMember = $derived(
    currentActorId ? allMembers.find(m => m.id === currentActorId) : playerActor,
  )

  function handlePlayerAction(action: PlayerAction) {
    if (!controller || awaitingPlayerInput === false) return

    // Some powers are buffs/heals/summons — they target the caster, not
    // an enemy. Look up the specific power's attackType so the target
    // picker only opens for actions that actually need an enemy.
    let powerNeedsTarget = true
    if (action.kind === 'power' && action.moveName && currentActorChar) {
      const move = currentActorChar.moves.find(m => m.name === action.moveName)
      if (move) {
        const at = move.attackType
        powerNeedsTarget = at !== 'buff' && at !== 'heal' && at !== 'summon'
      }
    }

    // Non-target actions: submit immediately.
    const needsTarget =
      action.kind === 'weapon' ||
      (action.kind === 'power' && powerNeedsTarget) ||
      (action.kind === 'spell' &&
       action.spellCategory !== 'heal' &&
       action.spellCategory !== 'buff' &&
       action.spellCategory !== 'summon')

    if (isTeamController) {
      const c = controller as BattleControllerTeam
      const enemies = currentActorMember
        ? c.livingEnemies(currentActorMember.side)
        : []
      if (needsTarget && enemies.length > 1) {
        // More than one possible target — let the player pick.
        pickingTarget = action
        return
      }
      // Auto-target (single enemy, or non-target action). The controller
      // will default-target the lowest-HP enemy when targetId is omitted.
      awaitingPlayerInput = false
      currentActorId = null
      const round = c.stepTurn(action)
      playOneRound(round)
    } else {
      const c = controller as BattleController1v1
      if (!playerActor) return
      awaitingPlayerInput = false
      const round = c.submitAction(playerActor.id, action)
      playOneRound(round)
    }
  }

  // Player tapped an enemy card while pickingTarget is set → submit.
  function handleTargetClick(target: ArenaMember) {
    if (!pickingTarget || !controller || !isTeamController) return
    if (!currentActorMember) return
    if (target.side === currentActorMember.side) return
    const c = controller as BattleControllerTeam
    if (c.getHp(target.id) <= 0) return
    const action: PlayerAction = { ...pickingTarget, targetId: target.id }
    pickingTarget = null
    awaitingPlayerInput = false
    currentActorId = null
    const round = c.stepTurn(action)
    playOneRound(round)
  }

  function cancelTargetPick() {
    pickingTarget = null
  }

  // ── Instant Battle (gamepass) — drain to result in one tap ─────────────
  function instantResolve() {
    if (timeoutId) clearTimeout(timeoutId)
    if (animTimeoutId) clearTimeout(animTimeoutId)
    timeoutId = null
    awaitingPlayerInput = false
    activeAnim = null

    if (controllerMode && controller) {
      // Step the controller until it declares a winner. We don't render the
      // intermediate lines — just settle the HPs to the final snapshot.
      let safety = 500
      let last: ArenaRound | null = null
      const step = isTeamController
        ? () => (controller as BattleControllerTeam).stepTurn()
        : () => (controller as BattleController1v1).stepAuto()
      while (!controller.isOver && safety-- > 0) last = step()
      if (last) {
        const next = { ...displayHp }
        for (const id of Object.keys(last.hpAfter)) next[id] = last.hpAfter[id]
        displayHp = next
      }
      finishBattle(controller.winner ?? 'draw')
    } else {
      // Scripted mode — fast-forward to the last round's hpAfter.
      const last = rounds.at(-1)
      if (last) {
        const next = { ...displayHp }
        for (const id of Object.keys(last.hpAfter)) next[id] = last.hpAfter[id]
        displayHp = next
        finishBattle(last.winner ?? 'draw')
      }
    }
  }

  // ── Auto / Manual visible switch ─────────────────────────────────────────
  function flipManual(newVal: boolean) {
    if (newVal === manualMode) return
    onManualToggle?.(newVal)
    // If the player flipped to Auto mid-wait, dequeue the wait and resume.
    if (!newVal && awaitingPlayerInput && controller && !controller.isOver) {
      awaitingPlayerInput = false
      pickingTarget = null
      currentActorId = null
      timeoutId = setTimeout(() => {
        if (isTeamController) {
          playOneRound((controller as BattleControllerTeam).stepTurn())
        } else {
          playOneRound((controller as BattleController1v1).stepAuto())
        }
      }, 200)
    }
  }

  function finishBattle(w: ArenaWinner | null) {
    winner = w
    phase = 'result'
    onPhaseChange?.('result')
    if (w) onBattleEnd?.(w)
  }

  // ── Lifecycle: kick off playback when battle phase begins ─────────────────
  let started = false
  $effect(() => {
    if (!autoStart || started) return
    if (phase !== 'intro') return
    // Need either a controller (live mode) or scripted rounds to play.
    if (!controllerMode && rounds.length === 0) return
    started = true
    timeoutId = setTimeout(() => {
      phase = 'battle'
      onPhaseChange?.('battle')
      if (controllerMode && controller) {
        if (isTeamController) {
          // Peek the upcoming actor BEFORE stepping. awaitingActor primes
          // the team controller's queue (running begin-of-cycle ticks if
          // needed) so we always know who's first. If it's a player ally
          // in manual mode, pause for input instead of auto-resolving
          // their turn — the bug fix for "I picked Weapon but it fired
          // a power" was this: stepTurn was being called without an
          // action, so the controller AI-picked for the player.
          const c = controller as BattleControllerTeam
          const first = c.awaitingActor
          if (manualMode && first?.side === 'team1') {
            awaitingPlayerInput = true
            currentActorId = first.id
          } else {
            playOneRound(c.stepTurn())
          }
        } else {
          if (manualMode) {
            awaitingPlayerInput = true
          } else {
            const c = controller as BattleController1v1
            playOneRound(c.stepAuto())
          }
        }
      } else {
        playOneRound(rounds[0])
      }
    }, introMs)
  })

  onDestroy(() => {
    if (timeoutId) clearTimeout(timeoutId)
    if (animTimeoutId) clearTimeout(animTimeoutId)
  })

  // ── Per-card rendering helpers ─────────────────────────────────────────────
  function hpPctFor(m: ArenaMember): number {
    return m.maxHp > 0 ? Math.max(0, (displayHp[m.id] ?? m.hp) / m.maxHp) : 0
  }
  function isVictor(m: ArenaMember): boolean {
    return phase === 'result' && winner === m.side && hpPctFor(m) > 0
  }
  function isDead(m: ArenaMember): boolean {
    return (displayHp[m.id] ?? m.hp) <= 0
  }
</script>

<div bind:this={wrapperEl} class="ba-wrapper" style="overflow:visible;">

  <!-- Header -->
  <div class="text-center mb-3 sm:mb-5 relative" style="animation: fadeIn 0.3s ease-out forwards;">
    {#if modeSubtitle}
      <p class="text-xs tracking-[0.28em] uppercase mb-1 sm:mb-2"
         style="font-family: 'JetBrains Mono', monospace; color: {modeAccent};">{modeSubtitle}</p>
    {/if}
    <h1 style="font-family: 'Cinzel', serif; font-size: clamp(1.2rem, 5vw, 2.4rem); font-weight: 900;
               color: #ffdf96; letter-spacing: 0.15em;">{modeTitle}</h1>

    <!-- Auto / Manual toggle (visible switch — only shown when controllable) -->
    {#if controllerMode && onManualToggle}
      <div class="ba-auto-toggle"
           role="group"
           aria-label="Auto battle on or off"
           style="--accent: {modeAccent};">
        <span class="ba-auto-label">Auto</span>
        <button
          class="ba-switch"
          class:ba-switch-on={!manualMode}
          onclick={() => flipManual(!manualMode)}
          aria-pressed={!manualMode}
          aria-label="{manualMode ? 'Enable' : 'Disable'} auto battle">
          <span class="ba-switch-knob"></span>
        </button>
      </div>
    {/if}

    <!-- Instant Battle skip button (Instant Battle gamepass) -->
    {#if canInstant && phase === 'battle'}
      <button class="ba-skip-btn"
              onclick={instantResolve}
              aria-label="Skip battle to result"
              title="Instant Battle — skip to result">
        <span class="material-symbols-outlined" style="font-size: 16px; font-variation-settings: 'FILL' 1;">fast_forward</span>
        <span>Skip</span>
      </button>
    {/if}
  </div>

  <!-- Two-team grid -->
  <div class="grid grid-cols-2 gap-2 sm:gap-4 relative w-full" style="overflow:visible;">
    {#each teams as team (team.side)}
      <div class="flex flex-col gap-2">
        {#if team.members.length > 1}
          <p class="text-[10px] tracking-[0.22em] uppercase mb-0.5"
             style="font-family: 'JetBrains Mono', monospace; color: {team.accent};">{team.label}</p>
        {/if}
        {#each team.members as m (m.id)}
          {@const pct = hpPctFor(m)}
          {@const badges = charStatusByName.get(m.name) ?? []}
          {@const accent = m.accent ?? team.accent}
          {@const dead = isDead(m)}
          {@const won = isVictor(m)}
          {@const isTargetable = !!pickingTarget && !dead &&
                                 currentActorMember != null &&
                                 m.side !== currentActorMember.side}
          <div use:trackCharEl={{ name: m.name }}
            class="bv-char-card {team.side === 'team1' ? 'bv-team-1' : 'bv-team-2'}
                   {dodgingName === m.name ? 'panel-dodging' : ''}
                   {m.spinClass === 'paragon' ? 'bv-paragon' : m.spinClass === 'legend' ? 'bv-legend' : m.spinClass === 'hero' ? 'bv-hero' : ''}"
            class:bv-victor={won}
            class:ba-targetable={isTargetable}
            role={isTargetable ? 'button' : undefined}
            tabindex={isTargetable ? 0 : undefined}
            onclick={isTargetable ? () => handleTargetClick(m) : undefined}
            onkeydown={isTargetable
              ? (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') handleTargetClick(m) }
              : undefined}
            style="padding: 12px; --team-accent: {accent}; opacity: {dead ? 0.45 : 1};
                   {isTargetable ? 'cursor: pointer;' : ''}">

            <div class="flex items-center gap-2 min-w-0 mb-1.5">
              {#if won}
                <span class="material-symbols-outlined shrink-0"
                  style="font-size: 18px; color: {accent}; font-variation-settings: 'FILL' 1;">workspace_premium</span>
              {:else if phase === 'result' && winner && winner !== 'draw' && winner !== team.side}
                <span class="material-symbols-outlined shrink-0"
                  style="font-size: 18px; color: #ef4444; font-variation-settings: 'FILL' 1;">skull</span>
              {/if}
              <p class="font-bold truncate"
                 style="font-family: 'Cinzel', serif; color: {accent}; font-size: 0.95rem;">{m.name}</p>
            </div>

            {#if m.raceLabel || m.archetypeLabel}
              <p class="text-xs truncate mb-1.5"
                 style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">{[m.raceLabel, m.archetypeLabel].filter(Boolean).join(' · ')}</p>
            {/if}

            <div class="bv-hp-track" style="height: 10px;">
              <div class="bv-hp-fill"
                style="width: {pct * 100}%; background: {hpColor(pct)}; color: {hpColor(pct)};"></div>
            </div>
            <p class="text-xs mt-1"
               style="font-family: 'JetBrains Mono', monospace; color: {hpColor(pct)};">
              {formatHp(displayHp[m.id] ?? m.hp)}<span style="color: #4e4635;"> / {formatHp(m.maxHp)} HP</span>
            </p>

            {#if m.stats && m.stats.length > 0}
              <div class="grid gap-1 mt-2"
                   style="grid-template-columns: repeat({m.stats.length}, minmax(0, 1fr));">
                {#each m.stats as s}
                  <div class="text-center rounded py-1"
                       style="background: {accent}10; border: 1px solid {accent}1f;">
                    <p style="font-family: 'JetBrains Mono', monospace; color: #9a907b; font-size: 9px;">{s.label}</p>
                    <p class="font-bold text-xs" style="font-family: 'Cinzel', serif; color: {accent};">{s.value}</p>
                  </div>
                {/each}
              </div>
            {/if}

            {#if badges.length > 0}
              <div class="flex flex-wrap gap-1 justify-center mt-2">
                {#each badges as b}
                  <span class="bv-status-chip" title="{b.label}: {b.description}"
                    style="background: {b.color}22; border-color: {b.color}66;">
                    <span class="material-symbols-outlined"
                      style="font-size: 11px; color: {b.color}; font-variation-settings: 'FILL' 1;">{b.icon}</span>
                  </span>
                {/each}
              </div>
            {/if}

            {#if cardExtra}{@render cardExtra(m)}{/if}
          </div>
        {/each}
      </div>
    {/each}
  </div>

  <!-- Projectile layer retired post-S5: damage dispatches go through the
       in-place / beam paths in showAnim now. Component file kept around
       only if a future feature wants it back. -->

  <!-- Beam layer: a static line from attacker anchor to target anchor that
       draws in (stroke-dashoffset), holds, and fades. Used by beam-type
       elements (holy / arcane / cosmic / energy / void / sound). Widths
       are kamehameha-scaled — wider for energy/cosmic/sound, narrower for
       arcane/void. All scaled by grade + per-beam widthMult. -->
  {#if phase === 'battle' && effectsEnabled && beams.length > 0}
    {#each beams as b (b.id)}
      {@const dx = b.endX - b.startX}
      {@const dy = b.endY - b.startY}
      {@const dist = Math.max(8, Math.sqrt(dx * dx + dy * dy))}
      {@const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI}
      {@const intensity = 1 + Math.max(0, b.gradeIdx - 3) * 0.30}
      {@const glowW = (18 + b.gradeIdx * 3.5) * intensity * b.widthMult}
      {@const mainW = (7  + b.gradeIdx * 1.2) * intensity * b.widthMult}
      {@const coreW = (2.4 + b.gradeIdx * 0.4) * intensity * b.widthMult}
      {@const totalMs = b.durationMs + b.fadeMs}
      <div class="ba-beam-anchor"
           style="position: absolute; left: {b.startX}px; top: {b.startY}px;
                  --beam-len: {dist}px; --beam-rot: {angleDeg}deg;
                  --beam-color: {b.color};
                  --beam-w-glow: {glowW}px; --beam-w-main: {mainW}px; --beam-w-core: {coreW}px;
                  --beam-dur: {totalMs}ms;
                  z-index: 27; pointer-events: none;">
        <div class="ba-beam ba-beam-glow"></div>
        <div class="ba-beam ba-beam-main"></div>
        <div class="ba-beam ba-beam-core"></div>
        <!-- Charge-up bulb at the attacker end — sells the "channeled
             power" feel that makes wide beams read as kamehameha. -->
        <div class="ba-beam-charge"></div>
      </div>
    {/each}
  {/if}

  <!-- Impact / non-projectile burst overlay. Wrapper-relative absolute
       positioning — coords passed in are already local to .ba-wrapper so
       this never drifts off-card when the parent re-flows. -->
  {#if phase === 'battle' && activeAnim && effectsEnabled}
    {#key activeAnim.key}
      {@const ox = activeAnim.origin?.x}
      {@const oy = activeAnim.origin?.y}
      {@const wr = wrapperEl?.getBoundingClientRect()}
      <div style="position: absolute;
                  left: {ox != null ? ox + 'px'
                         : (activeAnim.direction === 'rtl' ? (wr ? wr.width * 0.75 : 0) + 'px'
                            : activeAnim.direction === 'ltr' ? (wr ? wr.width * 0.25 : 0) + 'px'
                            : (wr ? wr.width / 2 : 0) + 'px')};
                  top:  {oy != null ? oy + 'px' : (wr ? wr.height / 2 : 0) + 'px'};
                  transform: translate(-50%, -50%);
                  z-index: 30; pointer-events: none;">
        <AttackFX type={activeAnim.type} color={activeAnim.color}
                  direction={activeAnim.direction} size={76}
                  grade={activeAnim.grade} attackType={activeAnim.attackType}/>
      </div>
    {/key}
  {/if}

  <!-- Floating damage / heal / miss indicators -->
  <DamageIndicator events={damageEvents} />

  <!-- Intro splash -->
  {#if phase === 'intro'}
    {#if prebattle}
      {@render prebattle()}
    {:else}
      <div class="text-center py-6" style="animation: resultReveal 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards;">
        <p style="font-family: 'Cinzel', serif; font-size: 3rem; font-weight: 900;
                  color: {modeAccent}; letter-spacing: 0.2em;
                  filter: drop-shadow(0 0 20px {modeAccent}55);">VS</p>
        <p class="mt-2 text-sm tracking-[0.2em] uppercase"
           style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Calculating fate…</p>
      </div>
    {/if}
  {/if}

  <!-- Battle log -->
  {#if phase !== 'intro'}
    <div class="w-full rounded-xl overflow-hidden mt-4 mb-4 sm:mb-6"
         style="border: 1px solid {modeAccent}1f; background: #0d0d16;">
      <div class="flex items-center gap-2 px-4 py-2.5"
           style="border-bottom: 1px solid {modeAccent}14;">
        <span class="material-symbols-outlined"
              style="font-size: 14px; color: #9a907b; font-variation-settings: 'FILL' 1;">menu_book</span>
        <p class="text-xs tracking-[0.15em] uppercase"
           style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Battle Log</p>
        {#if phase === 'battle' && totalRounds > 0}
          <span class="ml-auto text-xs px-2 py-0.5 rounded"
                style="background: {modeAccent}22; border: 1px solid {modeAccent}55;
                       font-family: 'JetBrains Mono', monospace; color: {modeAccent};">
            Round {roundDisplayN} of {totalRounds}
          </span>
        {/if}
      </div>
      <div bind:this={logEl} class="overflow-y-auto px-4 py-3"
           style="max-height: 300px; scroll-behavior: smooth;">
        {#if logLines.length === 0}
          <p class="text-xs text-center py-4" style="color: #4e4635; font-style: italic;">The battle begins…</p>
        {/if}
        {#each logLines as line}
          {#if line.startsWith('──')}
            <p class="text-xs mt-3 mb-1 tracking-[0.15em]"
               style="font-family: 'JetBrains Mono', monospace; color: #9a907b;
                      border-bottom: 1px solid {modeAccent}14; padding-bottom: 4px;">{line}</p>
          {:else if /CRITICAL|DEVASTATING|PERFECT STRIKE|OVERWHELMING|UNSTOPPABLE|OVERKILL/.test(line)}
            <p class="text-xs mb-1 font-bold"
               style="color: #fde047; font-family: 'JetBrains Mono', monospace;">{line}</p>
          {:else if [...t1Names].some(n => line.startsWith(n))}
            <p class="text-xs mb-1"
               style="color: #fde68a; font-family: 'JetBrains Mono', monospace;">{line}</p>
          {:else if [...t2Names].some(n => line.startsWith(n))}
            <p class="text-xs mb-1"
               style="color: #e9d5ff; font-family: 'JetBrains Mono', monospace;">{line}</p>
          {:else}
            <p class="text-xs mb-1"
               style="color: #9a907b; font-family: 'JetBrains Mono', monospace; font-style: italic;">{line}</p>
          {/if}
        {/each}
      </div>
    </div>
  {/if}

  <!-- Manual hotbar: either the built-in BattleHotbar (controller mode +
       awaiting player input) or a caller-supplied `hotbar` snippet. -->
  {#if phase === 'battle' && controllerMode && awaitingPlayerInput && currentActorChar && currentActorMember}
    {#if pickingTarget}
      <!-- Target-selection prompt — replaces the hotbar while the player
           chooses an enemy by clicking a highlighted card. -->
      <div class="ba-target-prompt" style="--accent: {modeAccent};">
        <p class="ba-target-prompt-title">Select a target</p>
        <p class="ba-target-prompt-sub">Tap an enemy card to strike</p>
        <button class="ba-target-cancel" onclick={cancelTargetPick}>Cancel</button>
      </div>
    {:else}
      {@const cd = controller!.getPowerCooldowns(currentActorMember.id)}
      <BattleHotbar
        availability={availableActions(currentActorChar, cd)}
        actorName={currentActorMember.name}
        accent={teams.find(t => t.side === currentActorMember.side)?.accent ?? '#f0c040'}
        onAction={handlePlayerAction}/>
    {/if}
  {:else if phase === 'battle' && hotbar}
    {@render hotbar()}
  {/if}

  <!-- Result overlay slot — each mode renders its own modal -->
  {#if phase === 'result' && result}
    {@render result()}
  {/if}
</div>

<style>
  .ba-wrapper {
    width: 100%;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  /* Rune-flash dodge — panel phases through reality. Inherited from
     the per-view CSS so the look is identical. */
  @keyframes panel-dodge {
    0%   { opacity: 1;    transform: translateX(0)     skewX(0deg);   filter: none; }
    10%  { opacity: 0.18; transform: translateX(-18px) skewX(-4deg);  filter: brightness(2.2) blur(3px) hue-rotate(30deg); }
    28%  { opacity: 0.40; transform: translateX(14px)  skewX(3deg);   filter: brightness(1.6) blur(2px); }
    48%  { opacity: 0.15; transform: translateX(-11px) skewX(-2deg);  filter: brightness(2.5) blur(3px) hue-rotate(-20deg); }
    66%  { opacity: 0.52; transform: translateX(7px)   skewX(1deg);   filter: blur(1px); }
    83%  { opacity: 0.88; transform: translateX(-3px)  skewX(0deg);   filter: none; }
    100% { opacity: 1;    transform: translateX(0)     skewX(0deg);   filter: none; }
  }
  :global(.panel-dodging) {
    animation: panel-dodge 0.80s ease-out forwards;
    will-change: transform, opacity, filter;
  }

  /* ── Beam attack rendering ──────────────────────────────────────────
     Three layered horizontal divs (glow / main / hot core) rotated to
     face the target. Each one scales from width 0 → full distance to
     visualize the beam drawing from attacker to target. */
  .ba-beam-anchor {
    width: 0;
    height: 0;
    transform-origin: 0 0;
  }
  .ba-beam {
    position: absolute;
    left: 0;
    top: 0;
    height: 0;
    border-radius: 999px;
    background: var(--beam-color);
    transform-origin: 0 50%;
    transform: rotate(var(--beam-rot)) scaleX(0);
    box-shadow: 0 0 24px var(--beam-color);
  }
  .ba-beam-glow {
    height: var(--beam-w-glow);
    margin-top: calc(var(--beam-w-glow) / -2);
    width: var(--beam-len);
    opacity: 0;
    filter: blur(8px);
    animation: ba-beam-fire-glow var(--beam-dur) cubic-bezier(0.22, 0.8, 0.3, 1) forwards;
  }
  .ba-beam-main {
    height: var(--beam-w-main);
    margin-top: calc(var(--beam-w-main) / -2);
    width: var(--beam-len);
    opacity: 0;
    animation: ba-beam-fire var(--beam-dur) cubic-bezier(0.22, 0.8, 0.3, 1) forwards;
  }
  .ba-beam-core {
    height: var(--beam-w-core);
    margin-top: calc(var(--beam-w-core) / -2);
    width: var(--beam-len);
    background: white;
    box-shadow: 0 0 12px var(--beam-color);
    opacity: 0;
    animation: ba-beam-fire var(--beam-dur) cubic-bezier(0.22, 0.8, 0.3, 1) forwards;
  }
  /* Charge bulb at the source — radial glow that pulses as the beam
     fires. Sells the "channeled energy" kamehameha feel. */
  .ba-beam-charge {
    position: absolute;
    left: 0; top: 0;
    width: calc(var(--beam-w-glow) * 2);
    height: calc(var(--beam-w-glow) * 2);
    margin-left: calc(var(--beam-w-glow) * -1);
    margin-top:  calc(var(--beam-w-glow) * -1);
    border-radius: 50%;
    background: radial-gradient(circle,
                                var(--beam-color) 0%,
                                var(--beam-color) 20%,
                                color-mix(in srgb, var(--beam-color) 50%, transparent) 50%,
                                transparent 80%);
    opacity: 0;
    filter: blur(2px);
    animation: ba-beam-charge var(--beam-dur) ease-out forwards;
  }
  @keyframes ba-beam-fire {
    0%   { transform: rotate(var(--beam-rot)) scaleX(0);    opacity: 0; }
    14%  { transform: rotate(var(--beam-rot)) scaleX(0.5);  opacity: 1; filter: brightness(3.2); }
    45%  { transform: rotate(var(--beam-rot)) scaleX(1);    opacity: 1; filter: brightness(2.2); }
    75%  { transform: rotate(var(--beam-rot)) scaleX(1);    opacity: 0.75; }
    100% { transform: rotate(var(--beam-rot)) scaleX(1);    opacity: 0; }
  }
  @keyframes ba-beam-fire-glow {
    0%   { transform: rotate(var(--beam-rot)) scaleX(0);    opacity: 0; }
    22%  { transform: rotate(var(--beam-rot)) scaleX(1);    opacity: 0.65; }
    65%  { transform: rotate(var(--beam-rot)) scaleX(1);    opacity: 0.45; }
    100% { transform: rotate(var(--beam-rot)) scaleX(1);    opacity: 0; }
  }
  @keyframes ba-beam-charge {
    0%   { transform: scale(0.2); opacity: 0; }
    18%  { transform: scale(1.6); opacity: 1; filter: brightness(3); }
    55%  { transform: scale(1.3); opacity: 0.7; }
    100% { transform: scale(0.7); opacity: 0; }
  }

  /* Auto / Manual visible switch */
  .ba-auto-toggle {
    position: absolute;
    top: 0;
    right: 4px;
    display: flex; align-items: center; gap: 8px;
    padding: 4px 8px;
    border-radius: 999px;
    background: rgba(20, 18, 30, 0.72);
    border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
    backdrop-filter: blur(6px);
  }
  .ba-auto-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #9a907b;
    line-height: 1;
  }
  .ba-switch {
    position: relative;
    width: 38px; height: 20px;
    border-radius: 999px;
    background: #2a2535;
    border: 1px solid rgba(255,255,255,0.08);
    cursor: pointer;
    transition: background 0.18s ease-out, border-color 0.18s ease-out, box-shadow 0.18s ease-out;
    padding: 0;
  }
  .ba-switch.ba-switch-on {
    background: color-mix(in srgb, var(--accent) 70%, #1a1325);
    border-color: var(--accent);
    box-shadow: 0 0 12px color-mix(in srgb, var(--accent) 45%, transparent);
  }
  .ba-switch-knob {
    position: absolute;
    top: 2px; left: 2px;
    width: 14px; height: 14px;
    border-radius: 50%;
    background: #f6efe2;
    box-shadow: 0 1px 3px rgba(0,0,0,0.5);
    transition: transform 0.20s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .ba-switch.ba-switch-on .ba-switch-knob {
    transform: translateX(18px);
    background: #fff;
  }

  /* Target-pick highlight: pulsing red outline on tappable enemies */
  @keyframes ba-targetable-pulse {
    0%, 100% { box-shadow: 0 0 0 1px rgba(248, 113, 113, 0.6), 0 0 18px rgba(248, 113, 113, 0.35); }
    50%      { box-shadow: 0 0 0 2px rgba(248, 113, 113, 1.0), 0 0 32px rgba(248, 113, 113, 0.55); }
  }
  :global(.bv-char-card.ba-targetable) {
    border-color: rgba(248, 113, 113, 0.9) !important;
    animation: ba-targetable-pulse 1.4s ease-in-out infinite;
    transform: translateY(-1px);
    transition: transform 0.18s ease-out;
  }
  :global(.bv-char-card.ba-targetable:hover) {
    transform: translateY(-3px) scale(1.02);
  }

  /* Target-selection prompt — sits in the hotbar slot during target pick */
  .ba-target-prompt {
    width: 100%;
    margin-top: 6px;
    padding: 12px 14px;
    border-radius: 14px;
    background: linear-gradient(180deg, rgba(64, 18, 22, 0.85), rgba(40, 10, 14, 0.95));
    border: 1px solid rgba(248, 113, 113, 0.55);
    box-shadow: 0 0 24px rgba(248, 113, 113, 0.22);
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    position: relative;
  }
  .ba-target-prompt-title {
    font-family: 'Cinzel', serif;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #fecaca;
  }
  .ba-target-prompt-sub {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: #f87171aa;
    letter-spacing: 0.12em;
  }
  .ba-target-cancel {
    position: absolute;
    top: 8px; right: 10px;
    padding: 3px 10px;
    border-radius: 999px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.1);
    color: #9a907b;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    cursor: pointer;
  }
  .ba-target-cancel:hover { color: #e4e1ee; background: rgba(255,255,255,0.08); }

  /* Instant-Battle Skip button (Skip ⏭ pill — top-left twin of the toggle) */
  .ba-skip-btn {
    position: absolute;
    top: 0;
    left: 4px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px 4px 8px;
    border-radius: 999px;
    background: linear-gradient(180deg, rgba(64, 32, 16, 0.78), rgba(40, 20, 8, 0.92));
    border: 1px solid #f59e0b;
    color: #fde68a;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    cursor: pointer;
    box-shadow: 0 0 14px rgba(245, 158, 11, 0.32);
    transition: transform 0.12s ease-out, box-shadow 0.18s ease-out;
  }
  .ba-skip-btn:hover { box-shadow: 0 0 22px rgba(245, 158, 11, 0.5); }
  .ba-skip-btn:active { transform: scale(0.94); }
</style>
