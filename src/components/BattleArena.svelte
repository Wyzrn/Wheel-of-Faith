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
  import PortraitZoom from './PortraitZoom.svelte'
  import { goto } from '$app/navigation'
  import { getPerfTier } from '$lib/perf'
  import { rootZoom } from '$lib/zoom'
  import { triggerStoryHome } from '$lib/menuState.svelte'
  import SettingsPanel from './SettingsPanel.svelte'
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
    // Game-mode label shown in the command rail (e.g. "Rivals", "Ascension",
    // "Endless"). Falls back to modeSubtitle, then "Arcane Coliseum".
    modeName?: string
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
    // Optional override for the bottom-left exit button. When omitted, the
    // arena exits to the Story hub (Story/Endless modes) or the home menu.
    onExit?: () => void
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
    modeName, modeAccent = '#f0c040', introMs = 2600, speedFactor, effectsEnabled,
    autoStart = true,
    controller, manualMode = false, playerActorId, onManualToggle,
    canInstant = false, onExit,
    prebattle, result, hotbar, cardExtra,
    onPhaseChange, onRoundEnd, onLineShown, onBattleEnd,
  }: Props = $props()

  // Bottom-left exit: Story/Endless → Story hub; everything else → home menu.
  let showSettings = $state(false)
  let exitToHub = $derived(modeName === 'Ascension' || modeName === 'Endless')
  function doExit() {
    if (onExit) { onExit(); return }
    if (exitToHub) triggerStoryHome()
    else goto('/')
  }

  // ── Atmospheric embers (perf-gated; off on touch/low + reduced-motion) ───
  let arenaEmbers = $state<{ left: number; delay: number; dur: number; op: number }[]>([])
  // ── Full-screen takeover: lock background scroll while the arena is mounted.
  $effect(() => {
    if (typeof document === 'undefined') return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const reduce = matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (!reduce && getPerfTier() !== 'low') {
      arenaEmbers = Array.from({ length: getPerfTier() === 'high' ? 24 : 14 }, () => ({
        left: Math.random() * 100,
        delay: Math.random() * 5,
        dur: 3 + Math.random() * 4,
        op: Math.random() * 0.5,
      }))
    }
    return () => { document.body.style.overflow = prev }
  })

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
  // drifted off-card on Ascension's narrow centered column and on any view
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
  // On mobile the layout sets CSS `zoom` on <html> to shrink the UI. Under
  // zoom, getBoundingClientRect() returns POST-zoom screen pixels, but the
  // absolutely-positioned VFX children interpret their left/top in PRE-zoom
  // local pixels — so every rect-derived delta is divided by rootZoom() (from
  // $lib/zoom) to land on-card. On PC (no zoom) that's 1 and a no-op.
  function memberOrigin(name: string | null): { x: number; y: number } | undefined {
    if (!name || !wrapperEl) return undefined
    const el = charEls.get(name)
    if (!el) return undefined
    const cardRect = el.getBoundingClientRect()
    const wrapRect = wrapperEl.getBoundingClientRect()
    if (cardRect.width === 0 || wrapRect.width === 0) return undefined
    const z = rootZoom()
    return {
      x: (cardRect.left - wrapRect.left + cardRect.width / 2) / z,
      y: (cardRect.top  - wrapRect.top  + cardRect.height / 2) / z,
    }
  }
  function wrapperOrigin(dir: AnimDir): { x: number; y: number } | undefined {
    if (!wrapperEl) return undefined
    const wr = wrapperEl.getBoundingClientRect()
    if (wr.width === 0) return undefined
    const z = rootZoom()
    const xRel = dir === 'rtl' ? 0.75 : dir === 'ltr' ? 0.25 : 0.5
    return {
      x: (wr.width / z) * xRel,
      y: (wr.height / z) / 2,
    }
  }

  // ── VFX overlay state (Segment 1: 1:1 with legacy behaviour) ──────────────
  let activeAnim = $state<{
    type: string; color: string; key: number; direction: AnimDir;
    grade?: string; origin?: { x: number; y: number }; attackType?: string
  } | null>(null)
  let animKey = 0
  // Name of the character currently playing the full-card dodge animation —
  // scoped so only their card reacts, not the whole team. dodgingStyle drives
  // the overlay color + label (reflex / out-think / disrupt).
  let dodgingName = $state<string | null>(null)
  let dodgingStyle = $state<'agi' | 'iq' | 'cha'>('agi')
  // Name of the character currently playing the full-card block/shield VFX.
  let shieldingName = $state<string | null>(null)
  // Names currently showing a buff (on the caster) / debuff (on the target).
  let buffingName = $state<string | null>(null)
  let debuffingName = $state<string | null>(null)
  // Name currently showing the precision/observation read indicator.
  let precisionName = $state<string | null>(null)
  let animTimeoutId: ReturnType<typeof setTimeout> | null = null

  const isDodgeType = (t: string) => t === 'dodge' || t === 'dodge_iq' || t === 'dodge_cha'
  // Types that render only as a full-card overlay (no center AttackFX burst).
  const isCardOnlyFx = (t: string) =>
    isDodgeType(t) || t === 'buff' || t === 'debuff' || t === 'precision'

  function showAnim(
    type: string, color: string, direction: AnimDir,
    grade: string | undefined, origin: { x: number; y: number } | undefined,
    attackType: string | undefined,
    dodgeMember?: string,
  ) {
    if (animTimeoutId) clearTimeout(animTimeoutId)
    activeAnim = { type, color, key: ++animKey, direction, grade, origin, attackType }
    dodgingName = null; shieldingName = null; buffingName = null; debuffingName = null; precisionName = null
    if (isDodgeType(type)) {
      dodgingName = dodgeMember ?? null
      dodgingStyle = type === 'dodge_iq' ? 'iq' : type === 'dodge_cha' ? 'cha' : 'agi'
    } else if (type === 'shield') {
      shieldingName = dodgeMember ?? null
    } else if (type === 'buff') {
      buffingName = dodgeMember ?? null
    } else if (type === 'debuff') {
      debuffingName = dodgeMember ?? null
    } else if (type === 'precision') {
      precisionName = dodgeMember ?? null
    }
    animTimeoutId = setTimeout(() => {
      activeAnim = null; dodgingName = null; shieldingName = null
      buffingName = null; debuffingName = null; precisionName = null
    }, 1100)
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
    if (isDodgeType(type) || type === 'shield') return null
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
    const z = rootZoom()
    // Wrapper-relative coords (divided by zoom — see rootZoom). DamageIndicator
    // is rendered absolutely inside the wrapper so positioning stays glued to
    // the card across scroll / transform / mobile viewport changes.
    const ev: DamageEvent = {
      id: ++dmgIdCounter,
      x: (cardRect.left - wrapRect.left + cardRect.width / 2) / z,
      // Anchor at the TOP of the card so the floating number reads clearly
      // above the character art instead of half-occluded by it. The float
      // keyframe still drifts further up + fades while travelling.
      y: (cardRect.top  - wrapRect.top) / z + 8,
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
    // Floors keep the beam clearly visible even at fast/auto speeds.
    const dur = Math.max(200, Math.round(BEAM_DURATION_MS / speed))
    const fade = Math.max(120, Math.round(BEAM_FADE_DURATION_MS / speed))
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

  // ── Orb projectile registry ────────────────────────────────────────────────
  // Non-beam damage attacks fire a small glowing orb from the attacker to the
  // target. On arrival the orb vanishes and triggers the SAME impact burst the
  // attack always used (no VFX is flung across the screen — only the orb
  // travels). Beam-type attacks use spawnBeam instead.
  interface Orb {
    id: number
    startX: number; startY: number
    endX: number; endY: number
    color: string
    durationMs: number
    size: number
    rot: number       // travel angle in deg, so the comet tail points correctly
  }
  let orbs = $state<Orb[]>([])
  let orbIdCounter = 0
  const ORB_DURATION_MS = 420

  function spawnOrb(
    startX: number, startY: number,
    endX: number, endY: number,
    color: string, grade: string | undefined,
    onImpact: () => void,
  ) {
    const speed = Math.max(0.4, Math.min(4, speedFactor))
    // Keep a 220ms floor so the orb stays clearly visible even on fast/auto.
    const dur = Math.max(220, Math.round(ORB_DURATION_MS / speed))
    const gradeIdx = GRADE_IDX[grade ?? 'C'] ?? 3
    const size = 18 + gradeIdx * 2.6   // higher grades hurl a bigger orb
    const rot = Math.atan2(endY - startY, endX - startX) * 180 / Math.PI
    const o: Orb = { id: ++orbIdCounter, startX, startY, endX, endY, color, durationMs: dur, size, rot }
    orbs = [...orbs, o]
    setTimeout(() => {
      onImpact()
      orbs = orbs.filter(x => x.id !== o.id)
    }, dur)
  }

  // FX types that render as a beam line attacker→target. Everything else
  // anchors in-place on the target's card (the legacy "comet flies across
  // the screen" projectile path is gone — it looked like a skip every time
  // the comet over/undershot, and read worse than a clean stationary burst).
  const BEAM_TYPES = new Set(['holy', 'arcane', 'cosmic', 'energy', 'void', 'sound', 'lightning', 'psychic', 'time'])

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

  // Resolve the TRUE target name for a damage line. Direct attack lines
  // read "<attacker> verb <move> <X> damage!" — the only name in the text
  // is the attacker. The actual victim lives in fx.targetIdxs[0]. Status
  // / DoT / heal lines DO carry the victim's name (e.g. "Alice takes 5K
  // burn damage!"), so we prefer that when it disagrees with the attacker.
  function resolveDamageTargetName(line: string, fx?: RoundFxEvent): string | null {
    const hit = damageHitFromLine(line, allNames)
    // Try fxEvent target first — most reliable for direct attacks.
    if (fx) {
      const enemySide = oppositeSide(fx.attackerSide)
      const tgt = (fx.targetIdxs ?? [0])
        .map(i => memberFromFxIndex(enemySide, i))
        .filter((m): m is ArenaMember => !!m)[0]
      if (tgt) return tgt.name
    }
    return hit?.targetName ?? null
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
        // Buff (on the caster) / debuff (on the target) — card-only indicators,
        // never a projectile.
        const isBuff       = type === 'buff'
        const isDebuff     = type === 'debuff'
        const isBeam       = !isHeal && !isBuff && !isDebuff && BEAM_TYPES.has(type)
        // Only dodges + shields are true self-anchored effects (no hit lands,
        // no target). Crits and berserker hits DO land on the target, so they
        // now travel an orb to the target and explode on impact like any other
        // attack. (Their lines carry 'damage!' so they qualify for isInPlace.)
        const isActorBurst = isDodgeType(type) || type === 'shield'
        const isInPlace    = !isHeal && !isBuff && !isDebuff && !isBeam && !isActorBurst && isDamage && !!fx

        // Resolve attacker + targets once for the next several branches.
        const resolveAttackerOrigin = (): { x: number; y: number } | undefined => {
          if (!fx) return undefined
          const att = memberFromFxIndex(fx.attackerSide, fx.attackerIdx)
          return att ? memberOriginById(att.id) : undefined
        }
        // Resolve the TARGET position. Prefer the authoritative fxEvent target
        // (attacker side + targetIdxs) — attack lines name the ATTACKER and the
        // move, not the target, so a line-text parse (damageHitFromLine) returns
        // the attacker. Using that made startOrigin === targetOrigin, so the orb
        // spawned on the attacker and never travelled. Line-text is only the
        // fallback (covers the rare line that does name the defender).
        const resolveTargetOrigin = (): { x: number; y: number } | undefined => {
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
          const hit = damageHitFromLine(head, allNames)
          if (hit) {
            const fromLine = memberOrigin(hit.targetName)
            if (fromLine) return fromLine
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
          // Heal lines DO have the target name in text — use it directly.
          if (hit) emitDamage(hit.targetName, hit.value, hit.kind)
          deferDamageEmit = true
        } else if (isBuff) {
          // Buff — full-card aura on the CASTER (the buff line leads with them).
          const caster = fx ? memberFromFxIndex(fx.attackerSide, fx.attackerIdx) : undefined
          const casterName = caster?.name ?? inferAttackerName(head) ?? undefined
          showAnim('buff', color, direction, grade, undefined, fxAttackType, casterName)
        } else if (isDebuff) {
          // Debuff — full-card aura on the TARGET. The line reads "X curses Y
          // with Z", so Y isn't the leader; prefer the fx target, else the
          // first non-leader name in the line.
          const tgt = fx ? memberFromFxIndex(oppositeSide(fx.attackerSide), (fx.targetIdxs ?? [0])[0]) : undefined
          const leader = inferAttackerName(head)
          const fromLine = allNames.find(n => n !== leader && head.includes(n))
          const targetName = tgt?.name ?? fromLine ?? undefined
          showAnim('debuff', color, direction, grade, undefined, fxAttackType, targetName)
        } else if (isInPlace) {
          // In-place at the target's card — uses status-effect positioning
          // (line-text → name → memberOrigin). A small orb now travels from
          // the attacker to the target first; the SAME burst fires on impact
          // (the VFX is never launched across the screen). Falls back to an
          // immediate burst if origins can't be resolved.
          const targetOrigin = resolveTargetOrigin() ?? wrapperOrigin('center')
          const startOrigin = resolveAttackerOrigin()
          const hit = damageHitFromLine(head, allNames)
          const targetName = resolveDamageTargetName(head, fx) ?? hit?.targetName
          const doBurst = () => {
            showAnim(type, color, direction, grade, targetOrigin, fxAttackType)
            triggerShake(shakeStrengthFor(fxAttackType, type, grade))
            if (hit && targetName) emitDamage(targetName, hit.value, hit.kind)
          }
          if (effectsEnabled && startOrigin && targetOrigin) {
            spawnOrb(startOrigin.x, startOrigin.y, targetOrigin.x, targetOrigin.y, color, grade, doBurst)
          } else {
            doBurst()
          }
          deferDamageEmit = true
        } else if (isBeam && fx) {
          // Beam path — line from attacker anchor to target anchor.
          const startOrigin = resolveAttackerOrigin()
          const targetOrigin = resolveTargetOrigin()
          if (startOrigin && targetOrigin) {
            const hit = damageHitFromLine(head, allNames)
            const targetName = resolveDamageTargetName(head, fx) ?? hit?.targetName
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
                if (hit && targetName) emitDamage(targetName, hit.value, hit.kind)
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
          // Non-projectile path: dodges, shields, heals, buffs, summons,
          // debuffs. Anchored to the actor's card (no hit travels).
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

  // Click-to-zoom for the portrait sigil. null when not open. Lives here
  // (not per-fighter) so only one zoom can be active at a time and Escape
  // closes the right one regardless of which fighter was clicked.
  let zoomPortrait = $state<{ src: string; alt: string } | null>(null)

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

<!-- Reusable combatant banner (the Coliseum "fighter" frame). -->
{#snippet fighter(m: ArenaMember, team: ArenaTeam, isRight: boolean)}
  {@const pct = hpPctFor(m)}
  {@const badges = charStatusByName.get(m.name) ?? []}
  {@const accent = m.accent ?? team.accent}
  {@const dead = isDead(m)}
  {@const won = isVictor(m)}
  {@const isTargetable = !!pickingTarget && !dead &&
                         currentActorMember != null &&
                         m.side !== currentActorMember.side}
  <div use:trackCharEl={{ name: m.name }}
    class="fighter {isRight ? 'fighter-right' : ''}
           {dodgingName === m.name ? 'panel-dodging' : ''}
           {m.spinClass === 'paragon' ? 'bv-paragon' : m.spinClass === 'legend' ? 'bv-legend' : m.spinClass === 'hero' ? 'bv-hero' : ''}"
    class:fighter-victor={won}
    class:fighter-targetable={isTargetable}
    class:target-beckon={isTargetable}
    role={isTargetable ? 'button' : undefined}
    tabindex={isTargetable ? 0 : undefined}
    onclick={isTargetable ? () => handleTargetClick(m) : undefined}
    onkeydown={isTargetable
      ? (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') handleTargetClick(m) }
      : undefined}
    style="--accent-color: {accent}; opacity: {dead ? 0.4 : 1};">
    <div class="hp-ring" style="--hp: {Math.round(pct * 100)}%; --ring: {hpColor(pct)};">
      <!-- Portrait variant: when a character has an AI portrait we render
           it as the sigil image, click → fullscreen zoom. Won/dead overlays
           still take precedence so the player gets the same crown/skull
           feedback they got before portraits existed. -->
      {#if m.portraitUrl && !won && !dead}
        <button class="character-sigil sigil-portrait" style="border-color: {accent}66;"
          onclick={(e) => { e.stopPropagation(); zoomPortrait = { src: m.portraitUrl!, alt: m.name } }}
          aria-label="View full portrait of {m.name}">
          <img src={m.portraitUrl} alt="" />
        </button>
      {:else}
        <div class="character-sigil" style="border-color: {accent}66; color: {accent};">
          {#if won}
            <span class="material-symbols-outlined" style="font-size: 26px; color: {accent}; font-variation-settings: 'FILL' 1;">workspace_premium</span>
          {:else if dead}
            <span class="material-symbols-outlined" style="font-size: 26px; color: #ef4444; font-variation-settings: 'FILL' 1;">skull</span>
          {:else}
            <span class="font-cinzel" style="font-size: 1.5rem; font-weight: 700;">{m.name.charAt(0).toUpperCase()}</span>
          {/if}
        </div>
      {/if}
    </div>
    <div class="fighter-info {isRight ? 'items-end text-right' : ''}">
      <h2 class="fighter-name" style="color: {accent};">{m.name}</h2>
      {#if m.raceLabel || m.archetypeLabel}
        <span class="fighter-sub">{[m.raceLabel, m.archetypeLabel].filter(Boolean).join(' · ')}</span>
      {/if}
      <span class="fighter-hp" style="color: {hpColor(pct)};">
        {formatHp(displayHp[m.id] ?? m.hp)}<span style="color: #6b6150;"> / {formatHp(m.maxHp)}</span>
      </span>
      {#if m.stats?.length}
        <div class="fighter-stats {isRight ? 'justify-end' : ''}">
          {#each m.stats as s}
            <span class="fighter-stat">
              <span class="fighter-stat-label">{s.label}</span>
              <span class="fighter-stat-val">{s.value}</span>
            </span>
          {/each}
        </div>
      {/if}
      {#if badges.length > 0}
        <div class="fighter-badges {isRight ? 'justify-end' : ''}">
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
    <!-- Full-card dodge VFX — covers the whole card with a colored phase
         sweep + afterimage and a verdict label that reads WHY they evaded:
         reflex (agility), out-think (IQ), or disrupt (charisma). -->
    {#if dodgingName === m.name}
      <div class="dodge-fx dodge-fx-{dodgingStyle}" aria-hidden="true">
        <span class="dodge-fx-sweep"></span>
        <span class="dodge-fx-ring"></span>
        <span class="dodge-fx-label">
          {dodgingStyle === 'iq' ? 'OUTSMARTED' : dodgingStyle === 'cha' ? 'DISARMED' : 'DODGED'}
        </span>
        {#if dodgingStyle !== 'agi'}
          <span class="material-symbols-outlined dodge-fx-icon">
            {dodgingStyle === 'iq' ? 'psychology' : 'sentiment_very_satisfied'}
          </span>
        {/if}
      </div>
    {/if}
    <!-- Full-card block VFX — a hard-light barrier flares over the card when
         the character turns aside an incoming hit. -->
    {#if shieldingName === m.name}
      <div class="shield-fx" aria-hidden="true">
        <span class="shield-fx-barrier"></span>
        <span class="material-symbols-outlined shield-fx-icon">shield</span>
        <span class="shield-fx-label">BLOCKED</span>
      </div>
    {/if}
    <!-- Buff: rising gold motes + "EMPOWERED" on the caster. -->
    {#if buffingName === m.name}
      <div class="statmod-fx statmod-fx-buff" aria-hidden="true">
        <span class="statmod-fx-wash"></span>
        <span class="material-symbols-outlined statmod-fx-icon">keyboard_double_arrow_up</span>
        <span class="statmod-fx-label">EMPOWERED</span>
      </div>
    {/if}
    <!-- Debuff: sinking purple haze + "WEAKENED" on the target. -->
    {#if debuffingName === m.name}
      <div class="statmod-fx statmod-fx-debuff" aria-hidden="true">
        <span class="statmod-fx-wash"></span>
        <span class="material-symbols-outlined statmod-fx-icon">keyboard_double_arrow_down</span>
        <span class="statmod-fx-label">WEAKENED</span>
      </div>
    {/if}
    <!-- Observation: a targeting reticle locks on as the reader spots an
         opening for a precision strike. -->
    {#if precisionName === m.name}
      <div class="precision-fx" aria-hidden="true">
        <span class="precision-fx-reticle"></span>
        <span class="material-symbols-outlined precision-fx-icon">center_focus_strong</span>
        <span class="precision-fx-label">PRECISION</span>
      </div>
    {/if}
  </div>
{/snippet}

<div bind:this={wrapperEl} class="arena">
  <div class="void-grain"></div>
  {#if arenaEmbers.length > 0}
    <div class="arena-embers" aria-hidden="true">
      {#each arenaEmbers as e}
        <span class="ember" style="left: {e.left}vw; animation-delay: {e.delay}s; animation-duration: {e.dur}s; opacity: {e.op};"></span>
      {/each}
    </div>
  {/if}

  <!-- ── Command rail (top): gamemode · battle title · wave count ──────── -->
  <header class="arena-rail">
    <div class="flex items-center gap-3 min-w-0">
      <span class="font-cinzel arena-mode">{modeName ?? 'Arcane Coliseum'}</span>
      <span class="arena-rail-div"></span>
      <span class="font-jetbrains arena-rail-detail">{modeTitle}</span>
    </div>
    <div class="flex items-center gap-3 shrink-0">
      {#if modeSubtitle}
        <span class="arena-wave">{modeSubtitle}</span>
      {/if}
      {#if controllerMode && onManualToggle}
        <button class="arena-auto" class:arena-auto-on={!manualMode}
          onclick={() => flipManual(!manualMode)}
          aria-pressed={!manualMode} aria-label="{manualMode ? 'Enable' : 'Disable'} auto battle">
          <span class="arena-auto-label">Auto</span>
          <span class="arena-auto-track"><span class="arena-auto-dot"></span></span>
        </button>
      {/if}
      {#if canInstant && phase === 'battle'}
        <button class="arena-skip" onclick={instantResolve} title="Instant Battle — skip to result">
          <span class="material-symbols-outlined" style="font-size: 13px; font-variation-settings: 'FILL' 1;">fast_forward</span>
          SKIP
        </button>
      {/if}
    </div>
    <div class="rune-seam"></div>
  </header>

  <!-- ── Stage ───────────────────────────────────────────────────────── -->
  <main class="arena-stage">
    <div class="arena-seam"></div>
    <!-- Team 1 (player) — bottom-left -->
    <div class="stage-side stage-side-1">
      {#each teams[0].members as m (m.id)}{@render fighter(m, teams[0], false)}{/each}
    </div>
    <!-- Team 2 (enemy) — top-right -->
    <div class="stage-side stage-side-2">
      {#each teams[1].members as m (m.id)}{@render fighter(m, teams[1], true)}{/each}
    </div>
    <!-- Center ticker (latest battle-log line) -->
    {#if phase !== 'intro' && logLines.length > 0}
      <div class="arena-ticker"><span>{logLines.at(-1)}</span></div>
    {/if}
  </main>

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

  <!-- Orb projectiles: a small glowing ball flies attacker→target for every
       non-beam damage attack, then vanishes and triggers the impact burst. -->
  {#if phase === 'battle' && effectsEnabled && orbs.length > 0}
    {#each orbs as o (o.id)}
      <div class="ba-orb"
           style="left: {o.startX}px; top: {o.startY}px;
                  width: {o.size}px; height: {o.size}px;
                  --orb-color: {o.color};
                  --orb-dx: {o.endX - o.startX}px; --orb-dy: {o.endY - o.startY}px;
                  --orb-dur: {o.durationMs}ms; --orb-rot: {o.rot}deg;
                  z-index: 28; pointer-events: none;">
        <span class="ba-orb-tail"></span>
      </div>
    {/each}
  {/if}

  <!-- Impact / non-projectile burst overlay. Wrapper-relative absolute
       positioning — coords passed in are already local to .ba-wrapper so
       this never drifts off-card when the parent re-flows. -->
  {#if phase === 'battle' && activeAnim && effectsEnabled && !isCardOnlyFx(activeAnim.type)}
    {#key activeAnim.key}
      {@const ox = activeAnim.origin?.x}
      {@const oy = activeAnim.origin?.y}
      {@const wr = wrapperEl?.getBoundingClientRect()}
      {@const wz = rootZoom()}
      {@const ww = wr ? wr.width / wz : 0}
      {@const wh = wr ? wr.height / wz : 0}
      <div style="position: absolute;
                  left: {ox != null ? ox + 'px'
                         : (activeAnim.direction === 'rtl' ? ww * 0.75 + 'px'
                            : activeAnim.direction === 'ltr' ? ww * 0.25 + 'px'
                            : ww / 2 + 'px')};
                  top:  {oy != null ? oy + 'px' : wh / 2 + 'px'};
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

  <!-- Intro splash — centered stage overlay -->
  {#if phase === 'intro'}
    <div class="arena-intro">
      {#if prebattle}
        {@render prebattle()}
      {:else}
        <div class="text-center" style="animation: resultReveal 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards;">
          <p style="font-family: 'Cinzel', serif; font-size: 3rem; font-weight: 900;
                    color: {modeAccent}; letter-spacing: 0.2em;
                    filter: drop-shadow(0 0 20px {modeAccent}55);">VS</p>
          <p class="mt-2 text-sm tracking-[0.2em] uppercase"
             style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Calculating fate…</p>
        </div>
      {/if}
    </div>
  {/if}

  <!-- ── Action dock ─────────────────────────────────────────────────── -->
  <footer class="arena-dock">
    <div class="arena-dock-inner">
      <!-- Bottom-left: Hub (Ascension/Endless) or Home (other modes) -->
      <button class="dock-nav-btn" onclick={doExit}
        title={exitToHub ? 'Ascension Hub' : 'Home'} aria-label={exitToHub ? 'Ascension Hub' : 'Home'}>
        <span class="material-symbols-outlined" style="font-size: 20px; font-variation-settings: 'FILL' 1;">{exitToHub ? 'castle' : 'home'}</span>
      </button>
      <!-- Turn counter + roster avatars -->
      <div class="dock-turn">
        <div class="dock-turn-n">
          <span class="dock-turn-label">Turn</span>
          <span class="dock-turn-val">{String(roundDisplayN).padStart(2, '0')}</span>
        </div>
        <div class="dock-roster">
          {#each allMembers.slice(0, 5) as m (m.id)}
            <div class="dock-avatar" class:dock-avatar-dead={isDead(m)}
                 title={m.name}
                 style="border-color: {(m.accent ?? '#f0c052')}{isDead(m) ? '33' : 'aa'};">
              <span style="color: {m.accent ?? '#f0c052'};">{m.name.charAt(0).toUpperCase()}</span>
            </div>
          {/each}
        </div>
      </div>

      <!-- Hotbar / target prompt / auto state -->
      <div class="dock-actions">
        {#if phase === 'battle' && controllerMode && awaitingPlayerInput && currentActorChar && currentActorMember}
          {#if pickingTarget}
            <div class="ba-target-prompt" style="--accent: {modeAccent};">
              <p class="ba-target-prompt-title">Select a target</p>
              <p class="ba-target-prompt-sub">Tap an enemy to strike</p>
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
        {:else if phase === 'battle'}
          <span class="dock-idle">{manualMode ? 'Awaiting turn…' : 'Auto-resolving…'}</span>
        {/if}
      </div>
      <!-- Bottom-right: Settings -->
      <button class="dock-nav-btn" onclick={() => showSettings = true} title="Settings" aria-label="Settings">
        <span class="material-symbols-outlined" style="font-size: 20px; font-variation-settings: 'FILL' 1;">settings</span>
      </button>
    </div>
  </footer>

  {#if showSettings}
    <SettingsPanel onClose={() => showSettings = false} />
  {/if}

  <!-- Result overlay slot — each mode renders its own modal -->
  {#if phase === 'result' && result}
    {@render result()}
  {/if}
</div>

{#if zoomPortrait}
  <PortraitZoom src={zoomPortrait.src} alt={zoomPortrait.alt} onClose={() => zoomPortrait = null} />
{/if}

<style>
  /* ══ Arcane Coliseum — full-screen battle HUD ══════════════════════════ */
  .arena {
    position: fixed; inset: 0; z-index: 40;
    display: flex; flex-direction: column;
    overflow: hidden;
    background: radial-gradient(circle at 50% 42%, #221d2b 0%, #16121a 70%, #100d14 100%);
    color: #e9dfeb;
    font-family: 'Inter', sans-serif;
  }
  .void-grain {
    position: absolute; inset: 0; opacity: 0.05; pointer-events: none; z-index: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  }
  .arena-embers { position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 1; }
  .ember {
    position: absolute; bottom: -10px; width: 3px; height: 3px;
    background: #f0c052; border-radius: 50%; filter: blur(1px); opacity: 0;
    animation: rise 5s infinite ease-out;
  }
  @keyframes rise {
    0%   { transform: translateY(0) scale(0); opacity: 0; }
    50%  { opacity: 0.4; }
    100% { transform: translateY(-100vh) scale(1.5); opacity: 0; }
  }

  /* ── Command rail ─────────────────────────────────────────────────── */
  .arena-rail {
    position: relative; z-index: 30; flex: 0 0 auto;
    height: 44px; display: flex; align-items: center; justify-content: space-between;
    padding: 0 16px calc(0px) 16px; padding-top: env(safe-area-inset-top);
    background: rgba(17,19,12,0.92);
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .arena-mode {
    color: #ffdf9f; font-size: 0.8rem; font-weight: 700;
    letter-spacing: 0.18em; text-transform: uppercase; white-space: nowrap;
    text-shadow: 0 0 14px rgba(240,192,82,0.35);
  }
  .arena-rail-div { width: 1px; height: 12px; background: rgba(255,255,255,0.12); }
  .arena-rail-detail {
    font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase;
    color: rgba(90,214,239,0.6); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .arena-auto {
    display: flex; align-items: center; gap: 6px; background: none; border: none; cursor: pointer;
  }
  .arena-auto-label { font-family: 'JetBrains Mono', monospace; font-size: 9px; text-transform: uppercase; color: rgba(235,225,213,0.4); }
  .arena-auto-track {
    width: 32px; height: 16px; border-radius: 999px; position: relative;
    background: #231f17; border: 1px solid rgba(255,255,255,0.1); transition: border-color 0.3s;
  }
  .arena-auto-dot {
    position: absolute; left: 2px; top: 2px; width: 10px; height: 10px; border-radius: 50%;
    background: rgba(90,214,239,0.4); transition: left 0.3s, background 0.3s;
  }
  .arena-auto-on .arena-auto-track { border-color: rgba(90,214,239,0.5); }
  .arena-auto-on .arena-auto-dot   { left: 18px; background: #5ad6ef; }
  .arena-skip {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 2px 10px; border: 1px solid rgba(90,214,239,0.3); background: rgba(23,19,12,0.5);
    font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.1em; color: #5ad6ef;
    cursor: pointer; transition: background 0.2s;
  }
  .arena-skip:hover { background: rgba(90,214,239,0.1); }
  .arena-wave {
    font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.06em;
    padding: 2px 8px; border-radius: 999px;
    background: rgba(167,139,250,0.10); border: 1px solid rgba(167,139,250,0.28); color: #c4b5fd;
    white-space: nowrap;
  }

  /* ── Stage ────────────────────────────────────────────────────────── */
  .arena-stage { position: relative; flex: 1 1 auto; overflow: hidden; }
  .arena-seam {
    position: absolute; left: 50%; top: 6%; bottom: 8%; width: 2px; transform: translateX(-50%);
    background: linear-gradient(to bottom, transparent, #5ad6ef, #ff7b52, transparent);
    box-shadow: 0 0 20px rgba(90,214,239,0.4); z-index: 5;
    animation: arena-seam-pulse 3s infinite ease-in-out;
  }
  @keyframes arena-seam-pulse {
    0%, 100% { opacity: 0.3; filter: brightness(1); }
    50%      { opacity: 0.75; filter: brightness(1.5); }
  }
  .stage-side { position: absolute; z-index: 10; display: flex; flex-direction: column; gap: 12px; }
  .stage-side-1 { bottom: 6%; left: 3%; align-items: flex-start; }
  .stage-side-2 { top: 12px; right: 3%; align-items: flex-end; }

  .fighter {
    position: relative;
    width: min(82vw, 340px);
    display: flex; align-items: center; gap: 16px; padding: 12px 16px;
    clip-path: polygon(7% 0, 100% 0, 93% 100%, 0 100%);
    background: linear-gradient(135deg, rgba(45,40,49,0.94) 0%, rgba(20,17,26,0.94) 100%);
    border-right: 2px solid var(--accent-color, #5ad6ef);
    box-shadow: 0 12px 30px rgba(0,0,0,0.6);
    transition: transform 0.3s ease, filter 0.2s ease;
  }
  .fighter-right {
    flex-direction: row-reverse;
    clip-path: polygon(0 0, 93% 0, 100% 100%, 7% 100%);
    border-right: none; border-left: 2px solid var(--accent-color, #ff7b52);
  }
  .fighter-victor { filter: drop-shadow(0 0 16px var(--accent-color)); }
  .fighter-targetable { cursor: pointer; outline: 1px solid color-mix(in srgb, var(--accent-color) 60%, transparent); outline-offset: 3px; }

  /* Rank glows for Ascension characters — colors mirror RosterCard so the
     same character reads identically on the team-pick screen and in battle. */
  .bv-hero {
    border-color: rgba(251,191,36,0.85);
    box-shadow: 0 0 18px rgba(251,191,36,0.45), 0 12px 30px rgba(0,0,0,0.6);
    animation: bv-pulse-hero 2.6s ease-in-out infinite;
  }
  .bv-legend {
    border-color: rgba(168,85,247,0.9);
    box-shadow: 0 0 22px rgba(168,85,247,0.5), 0 12px 30px rgba(0,0,0,0.6);
    animation: bv-pulse-legend 2.4s ease-in-out infinite;
  }
  .bv-paragon {
    border-color: rgba(244,63,94,1.0);
    box-shadow: 0 0 28px rgba(244,63,94,0.6), 0 12px 30px rgba(0,0,0,0.6);
    animation: bv-pulse-paragon 2.2s ease-in-out infinite;
  }
  @keyframes bv-pulse-hero {
    0%, 100% { box-shadow: 0 0 14px rgba(251,191,36,0.35), 0 12px 30px rgba(0,0,0,0.6); }
    50%      { box-shadow: 0 0 24px rgba(251,191,36,0.6),  0 12px 30px rgba(0,0,0,0.6); }
  }
  @keyframes bv-pulse-legend {
    0%, 100% { box-shadow: 0 0 16px rgba(168,85,247,0.4), 0 12px 30px rgba(0,0,0,0.6); }
    50%      { box-shadow: 0 0 28px rgba(168,85,247,0.65), 0 12px 30px rgba(0,0,0,0.6); }
  }
  @keyframes bv-pulse-paragon {
    0%, 100% { box-shadow: 0 0 20px rgba(244,63,94,0.5), 0 12px 30px rgba(0,0,0,0.6); }
    50%      { box-shadow: 0 0 34px rgba(244,63,94,0.75), 0 12px 30px rgba(0,0,0,0.6); }
  }
  @media (prefers-reduced-motion: reduce) {
    .bv-hero, .bv-legend, .bv-paragon { animation: none; }
  }
  .target-beckon { animation: target-beckon 2s infinite ease-in-out; }
  @keyframes target-beckon {
    0%, 100% { transform: translateY(0) scale(1); filter: brightness(1); }
    50%      { transform: translateY(-4px) scale(1.02); filter: brightness(1.25); }
  }

  .hp-ring {
    width: 64px; height: 64px; flex-shrink: 0; border-radius: 50%; padding: 4px;
    position: relative; display: flex; align-items: center; justify-content: center;
    background: conic-gradient(var(--ring, #5ad6ef) var(--hp, 100%), rgba(255,255,255,0.07) var(--hp, 100%));
    box-shadow: 0 0 10px rgba(0,0,0,0.5);
    transition: --hp 0.45s ease;
  }
  .hp-ring::after { content: ''; position: absolute; inset: 3px; background: #16121a; border-radius: 50%; z-index: 1; }
  .character-sigil {
    position: relative; z-index: 2; width: 52px; height: 52px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: rgba(20,17,26,0.95); border: 1px solid rgba(255,255,255,0.1); overflow: hidden;
  }
  /* Portrait variant of the sigil — same size + ring, but a button with the
     AI portrait image inside. Click → zoom modal. */
  .sigil-portrait {
    padding: 0; cursor: zoom-in;
    transition: transform 140ms ease;
  }
  .sigil-portrait:hover  { transform: scale(1.06); }
  .sigil-portrait:active { transform: scale(0.96); }
  .sigil-portrait img    { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block; }
  .fighter-info { display: flex; flex-direction: column; min-width: 0; gap: 1px; }
  .fighter-name {
    font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; font-weight: 700;
    text-transform: uppercase; letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .fighter-sub {
    font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 0.12em;
    text-transform: uppercase; color: rgba(235,225,213,0.45);
  }
  .fighter-hp { font-family: 'JetBrains Mono', monospace; font-size: 0.78rem; font-weight: 700; margin-top: 2px; }
  .fighter-stats { display: flex; flex-wrap: wrap; gap: 3px 9px; margin-top: 4px; }
  .fighter-stats.justify-end { justify-content: flex-end; }
  .fighter-stat { display: inline-flex; align-items: baseline; gap: 3px; font-family: 'JetBrains Mono', monospace; }
  .fighter-stat-label { font-size: 0.5rem; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6150; }
  .fighter-stat-val { font-size: 0.64rem; font-weight: 700; color: #bcc9cc; }
  .fighter-badges { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 4px; }

  /* ── Central ticker (latest log line) ─────────────────────────────── */
  .arena-ticker {
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: min(90vw, 520px); pointer-events: none; z-index: 4; text-align: center;
    border-top: 1px solid rgba(255,255,255,0.06); border-bottom: 1px solid rgba(255,255,255,0.06);
    padding: 6px 0;
  }
  .arena-ticker span {
    font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 0.35em;
    text-transform: uppercase; color: rgba(235,225,213,0.5);
    display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .arena-intro { position: absolute; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center; pointer-events: none; }

  /* ── Action dock ──────────────────────────────────────────────────── */
  .arena-dock {
    position: relative; z-index: 30; flex: 0 0 auto;
    background: rgba(34,30,38,0.97);
    border-top: 2px solid rgba(240,192,82,0.4); box-shadow: 0 -10px 30px rgba(0,0,0,0.6);
    padding-bottom: env(safe-area-inset-bottom);
  }
  .arena-dock-inner {
    max-width: 720px; margin: 0 auto; min-height: 84px;
    display: flex; align-items: center; justify-content: space-between; gap: 12px 16px; padding: 8px 16px;
    flex-wrap: wrap;
  }
  .dock-turn { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
  .dock-turn-n { display: flex; flex-direction: column; align-items: center; }
  .dock-turn-label { font-family: 'JetBrains Mono', monospace; font-size: 8px; text-transform: uppercase; color: rgba(235,225,213,0.3); }
  .dock-turn-val { font-family: 'JetBrains Mono', monospace; font-size: 1.1rem; font-weight: 700; color: #ffdf9f; }
  .dock-roster { display: flex; }
  .dock-avatar {
    width: 34px; height: 34px; border-radius: 50%; margin-left: -8px;
    display: flex; align-items: center; justify-content: center;
    background: #231f17; border: 2px solid rgba(240,192,82,0.7);
    font-family: 'Cinzel', serif; font-weight: 700; font-size: 0.8rem; box-shadow: 0 2px 6px rgba(0,0,0,0.5);
  }
  .dock-avatar:first-child { margin-left: 0; }
  .dock-avatar-dead { opacity: 0.35; filter: grayscale(1); }
  .dock-actions { flex: 1 1 auto; display: flex; align-items: center; justify-content: flex-end; min-width: 0; }
  .dock-idle { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(235,225,213,0.35); }
  /* Hub/Home (bottom-left) + Settings (bottom-right) utility buttons */
  .dock-nav-btn {
    flex: 0 0 auto; width: 40px; height: 40px; border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    background: rgba(45,40,49,0.9); border: 1px solid rgba(240,192,82,0.30);
    color: #f0c052; cursor: pointer;
    transition: transform 0.12s ease-out, filter 0.15s, border-color 0.15s;
  }
  @media (hover: hover) and (pointer: fine) {
    .dock-nav-btn:hover { filter: brightness(1.15); border-color: rgba(240,192,82,0.6); }
  }
  .dock-nav-btn:active { transform: scale(0.92); }

  /* Mobile: shrink fighters + dock so nothing collides on narrow screens. */
  @media (max-width: 560px) {
    /* Row 1: hub · turn/roster · settings. The hotbar (dock-actions) wraps to
       its own full-width row below so manual actions never crowd anything. */
    .dock-actions { flex: 1 1 100%; justify-content: center; order: 5; }
    .dock-turn { flex: 1 1 auto; justify-content: center; }
  }
  @media (max-width: 480px) {
    .fighter { width: min(86vw, 300px); gap: 12px; padding: 10px 12px; }
    .hp-ring { width: 54px; height: 54px; }
    .character-sigil { width: 44px; height: 44px; }
    .stage-side-1 { left: 2%; bottom: 6%; }
    .stage-side-2 { right: 2%; top: 5%; }
  }

  /* Touch devices: keep the diagonal Coliseum positioning (team 1 bottom-
     left, team 2 top-right) but shrink the fighter cards so the two sides
     don't overlap mid-arena on short landscape viewports. Text scales down
     proportionally — never squished, no horizontal clipping. Keyed on
     pointer:coarse since the mobile CSS zoom inflates the layout viewport
     width, making max-width queries unreliable. */
  @media (pointer: coarse) {
    .stage-side-1 { bottom: 5%; left: 2%; top: auto; right: auto; transform: none; align-items: flex-start; }
    .stage-side-2 { top: 12px;  right: 2%; bottom: auto; left: auto;  transform: none; align-items: flex-end; }
    .fighter {
      width: min(58vw, 280px);
      gap: 11px;
      padding: 9px 12px;
    }
    .hp-ring { width: 56px; height: 56px; }
    .character-sigil { width: 46px; height: 46px; }
    .fighter-name { font-size: 1rem; line-height: 1.15; }
    .fighter-sub  { font-size: 0.66rem; line-height: 1.2; }
    .fighter-hp   { font-size: 0.78rem; }
    .fighter-stat-label { font-size: 0.46rem; }
    .fighter-stat-val   { font-size: 0.6rem; }
    .fighter-stats { gap: 3px 7px; margin-top: 3px; }
    .fighter-badges { gap: 2px; margin-top: 3px; }
    .fighter-info { min-width: 0; }
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
    animation: panel-dodge 0.95s ease-out forwards;
    will-change: transform, opacity, filter;
  }

  /* ── Full-card dodge VFX ───────────────────────────────────────────────── */
  /* Covers the entire fighter card (clipped to its polygon by the parent's
     clip-path). --dfx is the style accent: cyan reflex, teal IQ, pink charisma. */
  .dodge-fx {
    position: absolute; inset: 0; z-index: 6;
    pointer-events: none; overflow: hidden;
    display: flex; align-items: center; justify-content: center;
    --dfx: #a5f3fc;
  }
  .dodge-fx-agi { --dfx: #a5f3fc; }
  .dodge-fx-iq  { --dfx: #5ad6ef; }
  .dodge-fx-cha { --dfx: #f472b6; }
  /* Diagonal light sweep that wipes across the card. */
  .dodge-fx-sweep {
    position: absolute; inset: -20% -60%;
    background: linear-gradient(105deg, transparent 35%,
                color-mix(in srgb, var(--dfx) 70%, transparent) 50%,
                transparent 65%);
    transform: translateX(-120%);
    animation: dodge-sweep 0.95s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }
  /* Expanding "near-miss" ring that flares and fades. */
  .dodge-fx-ring {
    position: absolute; width: 40%; aspect-ratio: 1; border-radius: 50%;
    border: 2px solid var(--dfx);
    box-shadow: 0 0 18px var(--dfx), inset 0 0 12px color-mix(in srgb, var(--dfx) 60%, transparent);
    opacity: 0; transform: scale(0.3);
    animation: dodge-ring 0.8s ease-out forwards;
  }
  .dodge-fx-label {
    position: relative; z-index: 2;
    font-family: 'Cinzel', serif; font-weight: 900;
    font-size: clamp(0.7rem, 3.4vw, 1.05rem); letter-spacing: 0.14em;
    color: #fff; text-transform: uppercase;
    text-shadow: 0 0 10px var(--dfx), 0 0 22px var(--dfx), 0 2px 4px rgba(0,0,0,0.8);
    opacity: 0; transform: scale(0.6) translateY(6px);
    animation: dodge-label 1s cubic-bezier(0.2, 1.4, 0.5, 1) forwards;
  }
  .dodge-fx-icon {
    position: absolute; bottom: 8%; z-index: 2;
    font-size: 20px; color: var(--dfx);
    filter: drop-shadow(0 0 8px var(--dfx));
    opacity: 0; animation: dodge-label 1s ease-out 0.08s forwards;
  }
  @keyframes dodge-sweep {
    0%   { transform: translateX(-120%); opacity: 0; }
    25%  { opacity: 1; }
    100% { transform: translateX(120%);  opacity: 0; }
  }
  @keyframes dodge-ring {
    0%   { opacity: 0;    transform: scale(0.3); }
    35%  { opacity: 0.9;  transform: scale(1.0); }
    100% { opacity: 0;    transform: scale(1.6); }
  }
  @keyframes dodge-label {
    0%   { opacity: 0; transform: scale(0.6) translateY(6px); }
    30%  { opacity: 1; transform: scale(1.08) translateY(0); }
    72%  { opacity: 1; transform: scale(1) translateY(0); }
    100% { opacity: 0; transform: scale(1) translateY(-4px); }
  }
  @media (prefers-reduced-motion: reduce) {
    .dodge-fx-sweep, .dodge-fx-ring { animation: none; opacity: 0; }
    .dodge-fx-label, .dodge-fx-icon { animation: none; opacity: 1; transform: none; }
  }

  /* ── Full-card block / shield VFX ──────────────────────────────────────── */
  .shield-fx {
    position: absolute; inset: 0; z-index: 6;
    pointer-events: none; overflow: hidden;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
  }
  /* Hard-light barrier wash that flashes over the card and settles. */
  .shield-fx-barrier {
    position: absolute; inset: 0;
    background:
      repeating-linear-gradient(115deg,
        color-mix(in srgb, #93c5fd 22%, transparent) 0 6px,
        transparent 6px 14px),
      radial-gradient(circle at 50% 45%,
        color-mix(in srgb, #bfdbfe 55%, transparent) 0%, transparent 70%);
    box-shadow: inset 0 0 0 2px #93c5fd, inset 0 0 22px rgba(147,197,253,0.7);
    opacity: 0; transform: scale(1.08);
    animation: shield-barrier 1s cubic-bezier(0.3, 1.2, 0.5, 1) forwards;
  }
  .shield-fx-icon {
    position: relative; z-index: 2; font-size: 26px; color: #bfdbfe;
    font-variation-settings: 'FILL' 1;
    filter: drop-shadow(0 0 10px #93c5fd);
    opacity: 0; transform: scale(0.5);
    animation: shield-pop 1s cubic-bezier(0.2, 1.5, 0.5, 1) forwards;
  }
  .shield-fx-label {
    position: relative; z-index: 2;
    font-family: 'Cinzel', serif; font-weight: 900;
    font-size: clamp(0.62rem, 3vw, 0.92rem); letter-spacing: 0.16em; color: #fff;
    text-shadow: 0 0 10px #93c5fd, 0 0 20px #60a5fa, 0 2px 4px rgba(0,0,0,0.8);
    opacity: 0; animation: shield-pop 1s ease-out 0.06s forwards;
  }
  @keyframes shield-barrier {
    0%   { opacity: 0;    transform: scale(1.08); }
    20%  { opacity: 1;    transform: scale(1); }
    60%  { opacity: 0.85; }
    100% { opacity: 0;    transform: scale(1); }
  }
  @keyframes shield-pop {
    0%   { opacity: 0; transform: scale(0.5); }
    30%  { opacity: 1; transform: scale(1.1); }
    72%  { opacity: 1; transform: scale(1); }
    100% { opacity: 0; transform: scale(1) translateY(-3px); }
  }
  @media (prefers-reduced-motion: reduce) {
    .shield-fx-barrier { animation: none; opacity: 0.6; }
    .shield-fx-icon, .shield-fx-label { animation: none; opacity: 1; transform: none; }
  }

  /* ── Full-card buff / debuff indicators ────────────────────────────────── */
  .statmod-fx {
    position: absolute; inset: 0; z-index: 6;
    pointer-events: none; overflow: hidden;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px;
    --smc: #fbbf24;
  }
  .statmod-fx-buff   { --smc: #fbbf24; }   /* gold — power up */
  .statmod-fx-debuff { --smc: #a855f7; }   /* purple — sapped */
  /* Vertical gradient wash: buff sweeps UP, debuff sinks DOWN. */
  .statmod-fx-wash {
    position: absolute; inset: 0;
    background: linear-gradient(to top,
                color-mix(in srgb, var(--smc) 60%, transparent) 0%,
                transparent 70%);
    opacity: 0;
  }
  .statmod-fx-buff .statmod-fx-wash   { animation: statmod-wash-up 1s ease-out forwards; }
  .statmod-fx-debuff .statmod-fx-wash {
    background: linear-gradient(to bottom,
                color-mix(in srgb, var(--smc) 60%, transparent) 0%, transparent 70%);
    animation: statmod-wash-down 1s ease-out forwards;
  }
  .statmod-fx-icon {
    position: relative; z-index: 2; font-size: 24px; color: var(--smc);
    font-variation-settings: 'FILL' 1;
    filter: drop-shadow(0 0 9px var(--smc));
    opacity: 0; animation: statmod-pop 1s cubic-bezier(0.2, 1.5, 0.5, 1) forwards;
  }
  .statmod-fx-label {
    position: relative; z-index: 2;
    font-family: 'Cinzel', serif; font-weight: 900;
    font-size: clamp(0.6rem, 2.9vw, 0.9rem); letter-spacing: 0.15em; color: #fff;
    text-shadow: 0 0 10px var(--smc), 0 0 20px var(--smc), 0 2px 4px rgba(0,0,0,0.8);
    opacity: 0; animation: statmod-pop 1s ease-out 0.06s forwards;
  }
  @keyframes statmod-wash-up {
    0% { opacity: 0; transform: translateY(20%); }
    25% { opacity: 1; transform: translateY(0); }
    100% { opacity: 0; transform: translateY(-12%); }
  }
  @keyframes statmod-wash-down {
    0% { opacity: 0; transform: translateY(-20%); }
    25% { opacity: 1; transform: translateY(0); }
    100% { opacity: 0; transform: translateY(12%); }
  }
  @keyframes statmod-pop {
    0%   { opacity: 0; transform: scale(0.55); }
    30%  { opacity: 1; transform: scale(1.1); }
    72%  { opacity: 1; transform: scale(1); }
    100% { opacity: 0; transform: scale(1); }
  }
  @media (prefers-reduced-motion: reduce) {
    .statmod-fx-wash { animation: none; opacity: 0.5; }
    .statmod-fx-icon, .statmod-fx-label { animation: none; opacity: 1; transform: none; }
  }

  /* ── Observation / precision read indicator ────────────────────────────── */
  .precision-fx {
    position: absolute; inset: 0; z-index: 6;
    pointer-events: none; overflow: hidden;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px;
    --pc: #fcd34d;
  }
  /* Targeting reticle that snaps inward + spins, then locks. */
  .precision-fx-reticle {
    position: absolute; width: 58%; aspect-ratio: 1; border-radius: 50%;
    border: 2px dashed var(--pc);
    box-shadow: 0 0 14px color-mix(in srgb, var(--pc) 70%, transparent);
    opacity: 0; transform: scale(1.6) rotate(0deg);
    animation: precision-lock 1s cubic-bezier(0.3, 1.1, 0.5, 1) forwards;
  }
  .precision-fx-icon {
    position: relative; z-index: 2; font-size: 24px; color: var(--pc);
    filter: drop-shadow(0 0 9px var(--pc));
    opacity: 0; transform: scale(1.5);
    animation: precision-pop 1s cubic-bezier(0.2, 1.4, 0.5, 1) forwards;
  }
  .precision-fx-label {
    position: relative; z-index: 2;
    font-family: 'Cinzel', serif; font-weight: 900;
    font-size: clamp(0.58rem, 2.8vw, 0.88rem); letter-spacing: 0.16em; color: #fff;
    text-shadow: 0 0 10px var(--pc), 0 0 20px var(--pc), 0 2px 4px rgba(0,0,0,0.8);
    opacity: 0; animation: precision-pop 1s ease-out 0.08s forwards;
  }
  @keyframes precision-lock {
    0%   { opacity: 0;   transform: scale(1.6) rotate(0deg); }
    35%  { opacity: 1;   transform: scale(1) rotate(140deg); }
    75%  { opacity: 0.9; transform: scale(1) rotate(180deg); }
    100% { opacity: 0;   transform: scale(0.94) rotate(190deg); }
  }
  @keyframes precision-pop {
    0%   { opacity: 0; transform: scale(1.5); }
    35%  { opacity: 1; transform: scale(1); }
    75%  { opacity: 1; transform: scale(1); }
    100% { opacity: 0; transform: scale(1); }
  }
  @media (prefers-reduced-motion: reduce) {
    .precision-fx-reticle { animation: none; opacity: 0.6; transform: scale(1); }
    .precision-fx-icon, .precision-fx-label { animation: none; opacity: 1; transform: none; }
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
  /* ── Orb projectile ──────────────────────────────────────────────────── */
  .ba-orb {
    position: absolute;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 32%,
                                #fff 0%,
                                var(--orb-color) 50%,
                                color-mix(in srgb, var(--orb-color) 65%, transparent) 76%,
                                transparent 100%);
    box-shadow: 0 0 12px var(--orb-color), 0 0 26px var(--orb-color),
                0 0 40px color-mix(in srgb, var(--orb-color) 60%, transparent),
                0 0 8px #fff inset;
    transform: translate(-50%, -50%);
    animation: ba-orb-fly var(--orb-dur) cubic-bezier(0.4, 0, 0.7, 1) forwards;
    will-change: transform;
  }
  /* Comet tail trailing behind the orb along its travel direction. */
  .ba-orb-tail {
    position: absolute;
    right: 50%;
    top: 50%;
    height: 42%;
    width: 320%;
    transform-origin: right center;
    transform: translateY(-50%) rotate(calc(var(--orb-rot) + 180deg));
    background: linear-gradient(to left,
                var(--orb-color),
                color-mix(in srgb, var(--orb-color) 45%, transparent) 45%,
                transparent 100%);
    border-radius: 999px;
    filter: blur(2px);
    opacity: 0.85;
    pointer-events: none;
  }
  @keyframes ba-orb-fly {
    0%   { transform: translate(-50%, -50%) scale(0.5);  opacity: 0; }
    14%  { transform: translate(calc(-50% + var(--orb-dx) * 0.14), calc(-50% + var(--orb-dy) * 0.14)) scale(1.1); opacity: 1; }
    100% { transform: translate(calc(-50% + var(--orb-dx)), calc(-50% + var(--orb-dy))) scale(1); opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    .ba-orb { animation-duration: 1ms; }
    .ba-orb-tail { display: none; }
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
  .ba-target-cancel:hover { color: #e9dfeb; background: rgba(255,255,255,0.08); }
</style>
