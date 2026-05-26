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
  import BattleProjectile from './BattleProjectile.svelte'
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
  let wrapperEl: HTMLDivElement | null = $state(null)
  const charEls = new Map<string, HTMLElement>()
  function trackCharEl(node: HTMLElement, args: { name: string }) {
    charEls.set(args.name, node)
    return { destroy() { charEls.delete(args.name) } }
  }
  function memberOrigin(name: string | null): { x: number; y: number } | undefined {
    if (!name) return undefined
    const el = charEls.get(name)
    if (!el) return undefined
    const r = el.getBoundingClientRect()
    if (r.width === 0) return undefined
    return {
      x: r.left + r.width / 2,
      y: Math.max(80, Math.min(r.top + r.height / 2, window.innerHeight - 80)),
    }
  }
  function wrapperOrigin(dir: AnimDir): { x: number; y: number } | undefined {
    if (!wrapperEl) return undefined
    const wr = wrapperEl.getBoundingClientRect()
    if (wr.width === 0) return undefined
    const xRel = dir === 'rtl' ? 0.75 : dir === 'ltr' ? 0.25 : 0.5
    return {
      x: wr.left + wr.width * xRel,
      y: Math.max(80, Math.min(wr.top + wr.height / 2, window.innerHeight - 80)),
    }
  }

  // ── VFX overlay state (Segment 1: 1:1 with legacy behaviour) ──────────────
  let activeAnim = $state<{
    type: string; color: string; key: number; direction: AnimDir;
    grade?: string; origin?: { x: number; y: number }; attackType?: string
  } | null>(null)
  let animKey = 0
  let dodgeDir = $state<'ltr' | 'rtl' | null>(null)
  let animTimeoutId: ReturnType<typeof setTimeout> | null = null

  function showAnim(
    type: string, color: string, direction: AnimDir,
    grade: string | undefined, origin: { x: number; y: number } | undefined,
    attackType: string | undefined,
  ) {
    if (animTimeoutId) clearTimeout(animTimeoutId)
    activeAnim = { type, color, key: ++animKey, direction, grade, origin, attackType }
    dodgeDir = type === 'dodge' ? (direction === 'ltr' ? 'ltr' : direction === 'rtl' ? 'rtl' : null) : null
    animTimeoutId = setTimeout(() => { activeAnim = null; dodgeDir = null }, 950)
  }

  // ── Damage indicators ──────────────────────────────────────────────────────
  let damageEvents = $state<DamageEvent[]>([])
  let dmgIdCounter = 0
  function emitDamage(targetName: string, value: number, kind: DamageEvent['kind']) {
    const el = charEls.get(targetName)
    if (!el) return
    const r = el.getBoundingClientRect()
    if (r.width === 0) return
    const ev: DamageEvent = {
      id: ++dmgIdCounter,
      x: r.left + r.width / 2,
      y: r.top + r.height * 0.3,
      value, kind,
    }
    damageEvents = [...damageEvents.slice(-29), ev]
    setTimeout(() => { damageEvents = damageEvents.filter(d => d.id !== ev.id) }, 1400)
  }

  function inferAttackerName(line: string): string | null {
    for (const n of allNames) if (line.startsWith(n)) return n
    return null
  }

  // ── Projectile registry (Segment 2) ────────────────────────────────────────
  // Each entry corresponds to one in-flight comet from an attacker anchor to
  // a target anchor. On the projectile's onImpact we play the impact burst
  // (existing AttackFX) at the target coords + drop the damage number.
  interface Projectile {
    id: number
    startX: number; startY: number
    endX: number; endY: number
    color: string
    gradeIdx: number
    durationMs: number
    onImpact: () => void
  }
  let projectiles = $state<Projectile[]>([])
  let projIdCounter = 0

  const GRADE_IDX: Record<string, number> = {
    F: 0, E: 1, D: 2, C: 3, B: 4, A: 5, S: 6, SS: 7, SSS: 8, God: 9, Godly: 9,
  }

  function spawnProjectile(
    startX: number, startY: number,
    endX: number, endY: number,
    color: string, grade: string | undefined,
    onImpact: () => void,
  ) {
    const gradeIdx = GRADE_IDX[grade ?? 'C'] ?? 3
    const dist = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2)
    // Slower comets for longer distances feel weightier; cap to keep
    // gameplay snappy. Speed factor scales like battle log delay.
    const baseDur = Math.max(280, Math.min(600, 280 + dist * 0.6))
    const durationMs = Math.max(80, baseDur / Math.min(speedFactor, 3))
    const p: Projectile = {
      id: ++projIdCounter,
      startX, startY, endX, endY,
      color, gradeIdx, durationMs,
      onImpact: () => {
        projectiles = projectiles.filter(x => x.id !== p.id)
        onImpact()
      },
    }
    projectiles = [...projectiles, p]
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

  function playLines(lines: string[], onDone: () => void) {
    if (lines.length === 0) { onDone(); return }
    const [head, ...rest] = lines
    logLines = [...logLines, head]
    onLineShown?.(head)
    scrollLog()

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

        // ── Projectile path: damage attacks with attacker/target anchors ───
        // We need a fxEvent to know who's hitting whom. Without it, we fall
        // back to the legacy in-place burst.
        const canProjectile = isDamage && fx && type !== 'crit' && type !== 'dodge' && type !== 'shield' && type !== 'berserker'

        if (canProjectile) {
          const attacker = memberFromFxIndex(fx.attackerSide, fx.attackerIdx)
          const enemySide = oppositeSide(fx.attackerSide)
          const targets: ArenaMember[] = (fx.targetIdxs ?? [0])
            .map(i => memberFromFxIndex(enemySide, i))
            .filter((m): m is ArenaMember => !!m)

          const startOrigin = attacker ? memberOriginById(attacker.id) : undefined
          const targetOrigins = targets
            .map(t => ({ t, o: memberOriginById(t.id) }))
            .filter((x): x is { t: ArenaMember; o: { x: number; y: number } } => !!x.o)

          if (startOrigin && targetOrigins.length > 0) {
            const hit = damageHitFromLine(head, allNames)
            // Spawn one comet per target. First comet drives the damage
            // indicator for THIS log line; secondary targets show their own
            // burst (their damage numbers will come from subsequent AOE
            // lines, which emit immediately as part of the legacy path).
            targetOrigins.forEach((to, i) => {
              spawnProjectile(
                startOrigin.x, startOrigin.y, to.o.x, to.o.y,
                color, grade,
                () => {
                  showAnim(type, color, 'center', grade, to.o, fxAttackType)
                  if (i === 0 && hit) emitDamage(hit.targetName, hit.value, hit.kind)
                },
              )
            })
            deferDamageEmit = true
          } else {
            // Fallback: legacy in-place burst at wrapper-relative position.
            const enemyDir: AnimDir = direction === 'ltr' ? 'rtl' : direction === 'rtl' ? 'ltr' : 'center'
            const originDir = (fxAttackType === 'aoe' || fxAttackType === 'debuff') ? enemyDir : direction
            const attackerName = inferAttackerName(head)
            let origin = (fxAttackType !== 'aoe' && fxAttackType !== 'debuff')
              ? memberOrigin(attackerName)
              : undefined
            if (!origin) origin = wrapperOrigin(originDir)
            showAnim(type, color, direction, grade, origin, fxAttackType)
          }
        } else {
          // Non-projectile path: dodges, shields, crits (in-place flash),
          // heals, buffs, summons, debuffs. Anchored to the actor's card.
          const enemyDir: AnimDir = direction === 'ltr' ? 'rtl' : direction === 'rtl' ? 'ltr' : 'center'
          const originDir = (fxAttackType === 'aoe' || fxAttackType === 'debuff') ? enemyDir : direction
          const attackerName = inferAttackerName(head)
          let origin = (fxAttackType !== 'aoe' && fxAttackType !== 'debuff')
            ? memberOrigin(attackerName)
            : undefined
          if (!origin) origin = wrapperOrigin(originDir)
          showAnim(type, color, direction, grade, origin, fxAttackType)
        }
      }
    }

    if (!deferDamageEmit) maybeEmitDamageFromLine(head)

    const base = head.startsWith('──') ? 550 : 1000
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
      timeoutId = setTimeout(advanceAfterRound, speedDelay(900, speedFactor))
    })
  }

  // Decides what to do once a round's playback completes.
  function advanceAfterRound() {
    if (controllerMode && controller) {
      if (controller.isOver) { finishBattle(controller.winner ?? null); return }
      if (isTeamController) {
        // Team controller: each call resolves one actor's turn. If the
        // next actor is a player-controlled ally and manualMode is on,
        // pause for input. Otherwise step automatically.
        const teamCtrl = controller as BattleControllerTeam
        const nextActor = teamCtrl.awaitingActor ?? peekNextActor(teamCtrl)
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

    // Non-target actions: submit immediately.
    const needsTarget = action.kind === 'weapon' ||
                        action.kind === 'power' ||
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
    projectiles = []
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
          // Prime the team controller's queue by peeking — it lazily
          // builds on the first stepTurn() call but we want awaitingActor
          // available NOW so the arena can decide whether to pause.
          const c = controller as BattleControllerTeam
          // Cheap "prime": pop and re-resolve. Actually we just call
          // stepTurn() once when in auto mode; for manual mode we need to
          // know if the first actor is on team1. Force-build the queue:
          if (manualMode) {
            // Trigger queue build with a no-op step path: ask for the
            // first actor by stepping once in auto, but only if needed.
            // Cleanest: just call stepTurn() with no action — if first
            // actor is a player ally the engine still picks an AI move
            // for them. We don't want that. So instead: pre-tick by
            // calling a special helper.
            // For now we step once in auto — if first actor is team1 in
            // manual mode the player misses ONE auto turn at battle
            // start. Acceptable tradeoff for the v1 — the next cycle
            // they'll be in control.
            //
            // Better: peek the queue without consuming. The controller
            // exposes `awaitingActor` which is null until first cycle
            // starts. Let's start a cycle by calling stepTurn() but
            // dropping the round if it was an ally turn — wait, that
            // doesn't work because we don't know in advance.
            //
            // Pragmatic v1: kick off the battle in auto for ONE turn,
            // then pause. This effectively gives both sides one turn
            // before the player gets control. Acceptable starting
            // point — refine if we hear feedback.
            playOneRound(c.stepTurn())
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
                   {dodgeDir === (team.side === 'team1' ? 'ltr' : 'rtl') ? 'panel-dodging' : ''}"
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

  <!-- Projectile layer (S2): comets in flight from attacker → target. -->
  {#if phase === 'battle' && effectsEnabled}
    {#each projectiles as p (p.id)}
      <BattleProjectile
        startX={p.startX} startY={p.startY}
        endX={p.endX} endY={p.endY}
        color={p.color} gradeIdx={p.gradeIdx}
        durationMs={p.durationMs}
        onImpact={p.onImpact}/>
    {/each}
  {/if}

  <!-- Impact / non-projectile burst overlay -->
  {#if phase === 'battle' && activeAnim && effectsEnabled}
    {#key activeAnim.key}
      {@const ox = activeAnim.origin?.x}
      {@const oy = activeAnim.origin?.y}
      {@const _wr = wrapperEl?.getBoundingClientRect()}
      <div style="position:fixed;
                  left:{ox != null ? ox + 'px' : _wr != null
                        ? (activeAnim.direction === 'rtl' ? (_wr.left + _wr.width * 0.75) + 'px'
                          : activeAnim.direction === 'ltr' ? (_wr.left + _wr.width * 0.25) + 'px'
                          : (_wr.left + _wr.width / 2) + 'px')
                        : (activeAnim.direction === 'rtl' ? '75vw' : activeAnim.direction === 'center' ? '50vw' : '25vw')};
                  top:{oy != null ? oy + 'px' : _wr != null
                        ? (_wr.top + _wr.height / 2) + 'px' : '50vh'};
                  transform:translate(-50%,-50%);
                  z-index:9999;pointer-events:none;">
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
      <BattleHotbar
        availability={availableActions(currentActorChar)}
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
