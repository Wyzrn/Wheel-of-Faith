<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte'
  import {
    buildBattleCharacter, simulateTeamBattle, formatHp,
    type BattleCharacter, type TeamBattleRound, type RoundFxEvent,
  } from '$lib/game/battle'
  import { settings } from '$lib/settings.svelte'
  import AttackFX from './AttackFX.svelte'
  import DamageIndicator from './DamageIndicator.svelte'
  import type { DamageEvent } from '$lib/game/damageEvent'
  import { deriveStatusBadges } from '$lib/game/battleStatuses'
  import type { SpinResult } from '$lib/session/types'
  import { auth } from '$lib/stores/auth.svelte'

  export interface BattleTeamMember {
    results: SpinResult[]
    name: string
    shareId?: string
    statBonuses?: Record<string, number>
  }

  const {
    team1,
    team2,
    team1Label = 'Your Team',
    team2Label = 'Opponent',
    title = 'Battle',
    team2Color = '#f9a8d4',
    onComplete,
    onRematch,
    onBack,
    backLabel = 'Back',
  }: {
    team1: BattleTeamMember[]
    team2: BattleTeamMember[]
    team1Label?: string
    team2Label?: string
    title?: string
    team2Color?: string
    onComplete?: (winner: 'team1' | 'team2' | 'draw') => void
    onRematch: () => void
    onBack: () => void
    backLabel?: string
  } = $props()

  type Phase = 'intro' | 'fight' | 'result'
  let phase        = $state<Phase>('intro')
  let t1Chars      = $state<BattleCharacter[]>([])
  let t2Chars      = $state<BattleCharacter[]>([])
  let t1DispHp     = $state<number[]>([])
  let t2DispHp     = $state<number[]>([])
  let allRounds    = $state<TeamBattleRound[]>([])
  let roundIdx     = $state(0)
  let battleWinner = $state<'team1' | 'team2' | 'draw' | null>(null)
  let logLines     = $state<string[]>([])
  let logEl        = $state<HTMLDivElement | null>(null)
  let allT2Names   = $state(new Set<string>())

  type AnimDir = 'ltr' | 'rtl' | 'center'
  let activeAnim    = $state<{ type: string; color: string; key: number; direction: AnimDir; grade?: string; origin?: { x: number; y: number }; attackType?: string } | null>(null)
  let animKey       = 0
  let animTimeoutId: ReturnType<typeof setTimeout> | null = null
  let timeoutId:     ReturnType<typeof setTimeout> | null = null
  let currentFxEvents = $state<RoundFxEvent[]>([])
  let fxEventIdx = 0
  let aoeRemainingHits = 0
  let t1PanelEl = $state<HTMLDivElement | null>(null)
  let t2PanelEl = $state<HTMLDivElement | null>(null)
  let battleWrapperEl = $state<HTMLDivElement | null>(null)

  // Per-character refs so VFX shoots from the actual attacker card, not the
  // column midpoint. Populated by the `trackCharEl` action on each card.
  const t1CharEls = new Map<string, HTMLElement>()
  const t2CharEls = new Map<string, HTMLElement>()
  function trackCharEl(node: HTMLElement, args: { name: string; team: 1 | 2 }) {
    const map = args.team === 1 ? t1CharEls : t2CharEls
    map.set(args.name, node)
    return { destroy() { map.delete(args.name) } }
  }
  function getCharOriginByName(name: string | null): { x: number; y: number } | undefined {
    if (!name) return undefined
    const el = t1CharEls.get(name) ?? t2CharEls.get(name)
    if (!el) return undefined
    const r = el.getBoundingClientRect()
    if (r.width === 0) return undefined
    return {
      x: r.left + r.width / 2,
      y: Math.max(80, Math.min(r.top + r.height / 2, window.innerHeight - 80)),
    }
  }
  function inferAttackerName(line: string): string | null {
    for (const n of [...t1Chars.map(c => c.name), ...t2Chars.map(c => c.name)]) {
      if (line.startsWith(n)) return n
    }
    return null
  }

  const ELEMENT_FX: Record<string, { type: string; color: string }> = {
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

  // Wrapper-relative fallback so VFX never paints at the viewport edge when
  // a specific panel ref hasn't bound yet.
  function getWrapperOriginForDir(dir: AnimDir): { x: number; y: number } | undefined {
    if (!battleWrapperEl) return undefined
    const wr = battleWrapperEl.getBoundingClientRect()
    if (wr.width === 0) return undefined
    const xRel = dir === 'rtl' ? 0.75 : dir === 'ltr' ? 0.25 : 0.5
    return {
      x: wr.left + wr.width * xRel,
      y: Math.max(80, Math.min(wr.top + wr.height / 2, window.innerHeight - 80)),
    }
  }
  function getPanelOrigin(dir: AnimDir): { x: number; y: number } | undefined {
    if (dir === 'center') return getWrapperOriginForDir('center')
    const el = dir === 'ltr' ? t1PanelEl : dir === 'rtl' ? t2PanelEl : null
    if (el) {
      const r = el.getBoundingClientRect()
      if (r.width > 0) {
        return {
          x: r.left + r.width / 2,
          y: Math.max(80, Math.min(r.top + r.height / 2, window.innerHeight * 0.65)),
        }
      }
    }
    return getWrapperOriginForDir(dir)
  }

  // Status chips (derived from recent log lines, hover descriptions inline)
  let charStatusByName = $derived(
    deriveStatusBadges(logLines, [...t1Chars.map(c => c.name), ...t2Chars.map(c => c.name)])
  )

  // Floating damage indicators
  let damageEvents = $state<DamageEvent[]>([])
  let dmgIdCounter = 0
  function emitDamage(targetName: string, value: number, kind: DamageEvent['kind']) {
    const el = t1CharEls.get(targetName) ?? t2CharEls.get(targetName)
    if (!el) return
    const r = el.getBoundingClientRect()
    if (r.width === 0) return
    const ev: DamageEvent = { id: ++dmgIdCounter, x: r.left + r.width / 2, y: r.top + r.height * 0.3, value, kind }
    damageEvents = [...damageEvents.slice(-29), ev]
    setTimeout(() => { damageEvents = damageEvents.filter(d => d.id !== ev.id) }, 1400)
  }
  function parseDamageNumber(s: string): number {
    const cleaned = s.replace(/,/g, '').toUpperCase()
    if (cleaned.endsWith('K')) return Math.round(parseFloat(cleaned) * 1_000)
    if (cleaned.endsWith('M')) return Math.round(parseFloat(cleaned) * 1_000_000)
    if (cleaned.endsWith('B')) return Math.round(parseFloat(cleaned) * 1_000_000_000)
    return Math.round(parseFloat(cleaned) || 0)
  }
  function maybeEmitDamageFromLine(line: string) {
    if (!settings.effectsEnabled) return
    const allNames = [...t1Chars.map(c => c.name), ...t2Chars.map(c => c.name)]
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
        emitDamage(target, parseDamageNumber(dmgMatch[1]), isCrit ? 'crit' : 'damage')
        return
      }
    }
    const healMatch = line.match(/(?:restores|recovers|mends)\s+([\d.,]+[KMB]?)\s*HP/i)
    if (healMatch) {
      for (const n of allNames) if (line.startsWith(n)) { emitDamage(n, parseDamageNumber(healMatch[1]), 'heal'); return }
    }
    if (/evades|dodges|misses/i.test(line)) {
      for (const n of allNames) if (line.includes(n)) { emitDamage(n, 0, 'miss'); return }
    }
    if (/barrier forms around|defensive stance|bracing/i.test(line)) {
      for (const n of allNames) if (line.includes(n)) { emitDamage(n, 0, 'shield'); return }
    }
  }

  function speedDelay(ms: number): number {
    if (settings.battleSpeed >= 99) return 10
    return Math.max(50, ms / settings.battleSpeed)
  }

  let t1Names  = $derived(new Set(t1Chars.map(c => c.name)))
  let t2Names  = $derived(new Set(t2Chars.map(c => c.name)))
  let t1HpPct  = $derived(t1Chars.map((c, i) => c.maxHp > 0 ? Math.max(0, (t1DispHp[i] ?? 0) / c.maxHp) : 0))
  let t2HpPct  = $derived(t2Chars.map((c, i) => c.maxHp > 0 ? Math.max(0, (t2DispHp[i] ?? 0) / c.maxHp) : 0))
  let team1Won = $derived(battleWinner === 'team1')

  function hpColor(pct: number): string {
    if (pct > 0.50) return '#22c55e'
    if (pct > 0.25) return '#eab308'
    return '#ef4444'
  }

  function extractBattleModifiers(results: any[]): { critBonus: number; damageBonus: number; dodgeBonus: number } {
    let critBonus = 0, damageBonus = 0, dodgeBonus = 0
    for (const r of results ?? []) {
      const label = (r.resultLabel ?? r.label ?? r.result ?? '').toLowerCase()
      if (label.includes('crit') || label.includes('lethal') || label.includes('assassin')) critBonus += 0.05
      if (label.includes('berserker') || label.includes('titan') || label.includes('fury') || label.includes('rampage')) damageBonus += 0.08
      if (label.includes('dodge') || label.includes('phantom') || label.includes('shadow') || label.includes('wind')) dodgeBonus += 0.05
      if (label.includes('god') || label.includes('divine') || label.includes('absolute')) { damageBonus += 0.12; critBonus += 0.08 }
    }
    return {
      critBonus: Math.min(critBonus, 0.40),
      damageBonus: Math.min(damageBonus, 0.50),
      dodgeBonus: Math.min(dodgeBonus, 0.30),
    }
  }

  let showCritSurge = $state(false)

  onMount(() => {
    const gamepasses = auth.user?.gamepasses ?? []
    const hasCritSurge = gamepasses.includes('crit_surge')
    // Build base characters
    const t1Base = team1.map(m => buildBattleCharacter(m.results, m.name))
    const t2Base = team2.map(m => buildBattleCharacter(m.results, m.name))
    // Apply ability modifiers to HP as effective score proxy
    t1Chars = t1Base.map((c, i) => {
      const mods = extractBattleModifiers(team1[i]?.results ?? [])
      const critChance = mods.critBonus + (hasCritSurge ? 0.10 : 0)
      const hasCrit = Math.random() < critChance
      if (hasCrit) { showCritSurge = true; setTimeout(() => { showCritSurge = false }, 2500) }
      const mult = 1 + mods.damageBonus + (hasCrit ? 0.25 : 0)
      return { ...c, hp: Math.round(c.hp * mult), maxHp: Math.round(c.maxHp * mult) }
    })
    t2Chars = t2Base.map((c, i) => {
      const mods = extractBattleModifiers(team2[i]?.results ?? [])
      const hasCrit = Math.random() < mods.critBonus
      const mult = 1 + mods.damageBonus + (hasCrit ? 0.25 : 0)
      return { ...c, hp: Math.round(c.hp * mult), maxHp: Math.round(c.maxHp * mult) }
    })
    t1DispHp   = t1Chars.map(c => c.hp)
    t2DispHp   = t2Chars.map(c => c.hp)
    allT2Names = new Set(t2Chars.map(c => c.name))
    allRounds  = simulateTeamBattle(t1Chars, t2Chars)
    roundIdx   = 0
    logLines   = []
    timeoutId  = setTimeout(() => { phase = 'fight'; playRound() }, speedDelay(2600))
  })

  onDestroy(() => {
    if (timeoutId)     clearTimeout(timeoutId)
    if (animTimeoutId) clearTimeout(animTimeoutId)
  })

  function showAnim(type: string, color: string, direction: AnimDir = 'center', grade?: string, origin?: { x: number; y: number }, attackType?: string) {
    if (animTimeoutId) clearTimeout(animTimeoutId)
    activeAnim = { type, color, key: ++animKey, direction, grade, origin, attackType }
    animTimeoutId = setTimeout(() => { activeAnim = null }, 950)
  }

  function detectAnim(line: string): { type: string; color: string; direction: AnimDir } | null {
    const direction: AnimDir =
      [...t1Names].some(n => line.startsWith(n)) ? 'ltr' :
      [...t2Names].some(n => line.startsWith(n)) ? 'rtl' : 'center'
    const hasAction = line.includes('damage!') || line.includes('restores') || line.includes('recovers') ||
      line.includes('barrier') || line.includes('defensive') ||
      /BERSERK|combo finisher|follow-up/i.test(line) ||
      /narrowly dodges|weaves around|barely evades|slips past|anticipates|phases through|blinks away|mirrors away|deflects/i.test(line)
    if (!hasAction) return null
    if (/narrowly dodges|weaves around|barely evades|slips past|anticipates and sidesteps|phases through|blinks away from|mirrors away/i.test(line)) return { type: 'dodge', color: '#a5f3fc', direction }
    if (/barrier forms|defensive stance|protective shell|bracing/i.test(line)) return { type: 'shield', color: '#93c5fd', direction }
    if (/CRITICAL|DEVASTATING|PERFECT STRIKE|OVERWHELMING|UNSTOPPABLE|OVERKILL/i.test(line)) return { type: 'crit', color: '#fde047', direction }
    if (/berserk|frenzy/i.test(line)) return { type: 'berserker', color: '#ef4444', direction }
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
    if (line.includes('damage!')) return { type: 'slash', color: '#f87171', direction }
    return null
  }

  async function scrollLog() {
    await tick()
    if (logEl) logEl.scrollTop = logEl.scrollHeight
  }

  function playLines(lines: string[], onDone: () => void) {
    if (lines.length === 0) { onDone(); return }
    const [head, ...rest] = lines
    logLines = [...logLines, head]
    scrollLog()
    maybeEmitDamageFromLine(head)
    const anim = detectAnim(head)
    if (anim) {
      const fx = currentFxEvents[fxEventIdx]
      const isDamage = head.includes('damage!')
      const isHealLine = /restores|recovers.*HP|vital force|mends/i.test(head)
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
        if (fx && isDamage && type !== 'crit' && type !== 'berserker' && type !== 'dodge') {
          const elFx = fx.element ? ELEMENT_FX[fx.element] : null
          if (elFx) { type = elFx.type; color = elFx.color }
        }
        const fxAttackType = (fx && type !== 'dodge' && type !== 'shield') ? fx.attackType : undefined
        const enemyDir: AnimDir = direction === 'ltr' ? 'rtl' : direction === 'rtl' ? 'ltr' : 'center'
        const originDir = (fxAttackType === 'aoe' || fxAttackType === 'debuff') ? enemyDir : direction
        // Three-stage fallback: char card → team panel → wrapper rect. AOE
        // skips the char step so the burst lands on the enemy column.
        const attackerName = inferAttackerName(head)
        let origin = (fxAttackType !== 'aoe' && fxAttackType !== 'debuff')
          ? getCharOriginByName(attackerName)
          : undefined
        if (!origin) origin = getPanelOrigin(originDir)
        showAnim(type, color, direction, grade, origin, fxAttackType)
      }
    }
    const delay = speedDelay(head.startsWith('──') ? 350 : 600)
    timeoutId = setTimeout(() => playLines(rest, onDone), delay)
  }

  function playRound() {
    if (roundIdx >= allRounds.length) { finishBattle('draw'); return }
    const round = allRounds[roundIdx]
    roundIdx++
    currentFxEvents = round.fxEvents ?? []
    fxEventIdx = 0
    aoeRemainingHits = 0
    playLines([`── Round ${round.roundNum} ──`, ...round.lines], () => {
      t1DispHp = [...round.t1Hp]
      t2DispHp = [...round.t2Hp]
      if (round.winner !== undefined) {
        finishBattle(round.winner)
      } else {
        timeoutId = setTimeout(playRound, speedDelay(700))
      }
    })
  }

  function finishBattle(w: 'team1' | 'team2' | 'draw') {
    battleWinner = w
    onComplete?.(w)
    phase = 'result'
  }
</script>

<!-- ── Fixed header ──────────────────────────────────────────────────────────── -->
<header class="fixed top-0 left-0 right-0 z-30 flex items-center gap-3 px-4"
  style="height: 64px; background: rgba(7,7,13,0.97); border-bottom: 1px solid rgba(240,192,64,0.15); backdrop-filter: blur(20px);">
  <button onclick={onBack}
    style="background: none; border: none; cursor: pointer; color: var(--color-outline, #9a907b); font-size: 20px; line-height: 1; padding: 8px;">←</button>
  <h2 class="font-bold flex-1 text-center truncate"
    style="font-family: var(--font-cinzel, 'Cinzel', serif); font-size: 15px; color: var(--color-on-surface, #e4e1ee);">
    {title}
  </h2>
  {#if phase === 'fight'}
    <span class="font-mono text-xs px-2 py-1 rounded shrink-0"
      style="background: rgba(240,192,64,0.08); border: 1px solid rgba(240,192,64,0.2); color: #f0c040;">
      R{roundIdx}/{allRounds.length}
    </span>
  {:else}
    <div style="width: 52px;"></div>
  {/if}
</header>

<div class="pt-20 px-3 w-full flex flex-col"
  style="max-width: 800px; margin: 0 auto; min-height: 100dvh; padding-bottom: max(96px, calc(env(safe-area-inset-bottom, 0px) + 96px));">

  <!-- CRITICAL HIT surge banner -->
  {#if showCritSurge}
    <div class="fixed top-16 inset-x-0 z-40 flex justify-center pointer-events-none" style="animation: resultReveal 0.3s ease-out forwards;">
      <div class="px-5 py-2 rounded-xl font-bold text-sm" style="font-family: 'Cinzel', serif; background: rgba(253,224,71,0.2); border: 1px solid rgba(253,224,71,0.5); color: #fde047; letter-spacing: 0.12em;">⚡ CRITICAL HIT!</div>
    </div>
  {/if}

  <!-- ══ Intro + Fight phases ════════════════════════════════════════════════ -->
  {#if t1Chars.length > 0}

    <!-- Team HP panels -->
    <div bind:this={battleWrapperEl} class="w-full relative mb-3" style="overflow: visible;">
      <div class="grid grid-cols-2 gap-2">

        <!-- Player / Team 1 -->
        <div bind:this={t1PanelEl} class="flex flex-col gap-1.5">
          {#if t1Chars.length > 1}
            <p class="font-mono text-xs text-center tracking-widest uppercase"
              style="color: rgba(240,192,64,0.6);">{team1Label}</p>
          {/if}
          {#each t1Chars as char, i}
            {@const hp  = t1DispHp[i] ?? 0}
            {@const pct = t1HpPct[i]  ?? 0}
            {@const dead = hp <= 0}
            {@const won  = phase === 'result' && team1Won}
            {@const badges = charStatusByName.get(char.name) ?? []}
            <div use:trackCharEl={{ name: char.name, team: 1 }} class="bv-char-card bv-team-1"
              class:bv-dead={dead}
              class:bv-victor={won && !dead}>
              <div class="flex items-center justify-center gap-1.5 min-w-0 w-full mb-1.5">
                {#if dead}
                  <span class="material-symbols-outlined shrink-0" style="font-size: 13px; color: #ef4444; font-variation-settings: 'FILL' 1;">skull</span>
                {:else if won}
                  <span class="material-symbols-outlined shrink-0" style="font-size: 13px; color: #f0c040; font-variation-settings: 'FILL' 1;">workspace_premium</span>
                {/if}
                <p class="font-bold truncate" style="font-family: 'Cinzel', serif; color: #ffdf96; font-size: 0.78rem; letter-spacing: 0.03em;">{char.name}</p>
              </div>
              <div class="bv-hp-track">
                <div class="bv-hp-fill" style="width: {pct * 100}%; background: {hpColor(pct)}; color: {hpColor(pct)};"></div>
              </div>
              <p class="text-center mt-1" style="font-family: 'JetBrains Mono', monospace; color: {hpColor(pct)}; font-size: 0.62rem; letter-spacing: 0.04em;">{formatHp(hp)}<span style="color: #4e4635;"> / {formatHp(char.maxHp)}</span></p>
              {#if badges.length > 0 && !dead}
                <div class="flex flex-wrap gap-1 justify-center mt-1.5">
                  {#each badges as b}
                    <span class="bv-status-chip" title="{b.label}: {b.description}"
                      style="background: {b.color}22; border-color: {b.color}66;">
                      <span class="material-symbols-outlined" style="font-size: 11px; color: {b.color}; font-variation-settings: 'FILL' 1;">{b.icon}</span>
                    </span>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>

        <!-- Opponent / Team 2 -->
        <div bind:this={t2PanelEl} class="flex flex-col gap-1.5">
          {#if t2Chars.length > 1}
            <p class="font-mono text-xs text-center tracking-widest uppercase"
              style="color: {team2Color}99;">{team2Label}</p>
          {/if}
          {#each t2Chars as char, i}
            {@const hp  = t2DispHp[i] ?? 0}
            {@const pct = t2HpPct[i]  ?? 0}
            {@const dead = hp <= 0}
            {@const lost = phase === 'result' && !team1Won}
            {@const badges = charStatusByName.get(char.name) ?? []}
            <div use:trackCharEl={{ name: char.name, team: 2 }} class="bv-char-card bv-team-2"
              class:bv-dead={dead}
              class:bv-victor={lost && !dead}
              style="--team-accent: {team2Color};">
              <div class="flex items-center justify-center gap-1.5 min-w-0 w-full mb-1.5">
                {#if dead}
                  <span class="material-symbols-outlined shrink-0" style="font-size: 13px; color: #ef4444; font-variation-settings: 'FILL' 1;">skull</span>
                {:else if lost}
                  <span class="material-symbols-outlined shrink-0" style="font-size: 13px; color: {team2Color}; font-variation-settings: 'FILL' 1;">workspace_premium</span>
                {/if}
                <p class="font-bold truncate" style="font-family: 'Cinzel', serif; color: {team2Color}; font-size: 0.78rem; letter-spacing: 0.03em;">{char.name}</p>
              </div>
              <div class="bv-hp-track">
                <div class="bv-hp-fill" style="width: {pct * 100}%; background: {hpColor(pct)}; color: {hpColor(pct)};"></div>
              </div>
              <p class="text-center mt-1" style="font-family: 'JetBrains Mono', monospace; color: {hpColor(pct)}; font-size: 0.62rem; letter-spacing: 0.04em;">{formatHp(hp)}<span style="color: #4e4635;"> / {formatHp(char.maxHp)}</span></p>
              {#if badges.length > 0 && !dead}
                <div class="flex flex-wrap gap-1 justify-center mt-1.5">
                  {#each badges as b}
                    <span class="bv-status-chip" title="{b.label}: {b.description}"
                      style="background: {b.color}22; border-color: {b.color}66;">
                      <span class="material-symbols-outlined" style="font-size: 11px; color: {b.color}; font-variation-settings: 'FILL' 1;">{b.icon}</span>
                    </span>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>

      <!-- Attack FX overlay — anchored on attacker's actual rect with three-stage
           fallback (char card → team panel → battle wrapper). Viewport-percent
           defaults below only fire if all three refs failed (shouldn't happen). -->
      {#if phase === 'fight' && activeAnim}
        {#key activeAnim.key}
          {@const ox = activeAnim.origin?.x}
          {@const oy = activeAnim.origin?.y}
          {@const _wr = battleWrapperEl?.getBoundingClientRect()}
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
                      direction={activeAnim.direction} size={76} grade={activeAnim.grade} attackType={activeAnim.attackType}/>
          </div>
        {/key}
      {/if}

      <!-- Floating damage indicators -->
      <DamageIndicator events={damageEvents} />
    </div>

    <!-- VS splash (intro only) -->
    {#if phase === 'intro'}
      <div class="text-center py-8" style="animation: resultReveal 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards;">
        <div class="flex items-center justify-center gap-6 mb-4">
          <div class="text-right">
            {#each t1Chars as c}
              <p class="font-bold text-sm truncate" style="font-family: 'Cinzel', serif; color: #ffdf96;">{c.name}</p>
            {/each}
            <p class="font-mono text-xs mt-1" style="color: rgba(240,192,64,0.6);">{team1Label}</p>
          </div>
          <p style="font-family: 'Cinzel', serif; font-size: 2.5rem; font-weight: 900; color: #f0c040;
                    letter-spacing: 0.2em; filter: drop-shadow(0 0 20px rgba(240,192,64,0.5));">VS</p>
          <div class="text-left">
            {#each t2Chars as c}
              <p class="font-bold text-sm truncate" style="font-family: 'Cinzel', serif; color: {team2Color};">{c.name}</p>
            {/each}
            <p class="font-mono text-xs mt-1" style="color: {team2Color}99;">{team2Label}</p>
          </div>
        </div>
        <p class="mt-2 text-xs tracking-[0.2em] uppercase"
          style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">
          {t1Chars.length}v{t2Chars.length} · Calculating fate…
        </p>
      </div>
    {/if}

    <!-- Battle log (fight + result) -->
    {#if phase !== 'intro'}
      <div class="w-full rounded-xl overflow-hidden mb-4"
        style="border: 1px solid rgba(240,192,64,0.12); background: #0d0d16;">
        <div class="flex items-center gap-2 px-4 py-2.5"
          style="border-bottom: 1px solid rgba(240,192,64,0.08);">
          <span class="material-symbols-outlined" style="font-size: 14px; color: #9a907b; font-variation-settings: 'FILL' 1;">menu_book</span>
          <p class="text-xs tracking-[0.15em] uppercase"
            style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Battle Log</p>
          {#if phase === 'fight'}
            <span class="ml-auto text-xs px-2 py-0.5 rounded"
              style="background: rgba(157,23,77,0.3); border: 1px solid rgba(157,23,77,0.5); font-family: 'JetBrains Mono', monospace; color: #f9a8d4;">
              Round {roundIdx} / {allRounds.length}
            </span>
          {/if}
        </div>
        <div bind:this={logEl} class="overflow-y-auto px-4 py-3" style="max-height: 300px; scroll-behavior: smooth;">
          {#if logLines.length === 0}
            <p class="text-xs text-center py-4" style="color: #4e4635; font-style: italic;">The battle begins…</p>
          {/if}
          {#each logLines as line}
            {#if line.startsWith('──')}
              <p class="text-xs mt-3 mb-1 tracking-[0.15em]"
                style="font-family: 'JetBrains Mono', monospace; color: #9a907b; border-bottom: 1px solid rgba(240,192,64,0.08); padding-bottom: 4px;">{line}</p>
            {:else if /CRITICAL|DEVASTATING|PERFECT STRIKE|OVERWHELMING|UNSTOPPABLE|OVERKILL/.test(line)}
              <p class="text-xs mb-1 font-bold" style="color: #fde047; font-family: 'JetBrains Mono', monospace;">{line}</p>
            {:else if line.includes('has been defeated!')}
              <p class="text-xs mb-1 font-bold" style="color: #ef4444; font-family: 'JetBrains Mono', monospace;">{line}</p>
            {:else if [...t1Names].some(n => line.startsWith(n))}
              <p class="text-xs mb-1" style="color: #fde68a; font-family: 'JetBrains Mono', monospace;">{line}</p>
            {:else if [...allT2Names].some(n => line.startsWith(n))}
              <p class="text-xs mb-1" style="color: #e9d5ff; font-family: 'JetBrains Mono', monospace;">{line}</p>
            {:else}
              <p class="text-xs mb-1" style="color: #9a907b; font-family: 'JetBrains Mono', monospace; font-style: italic;">{line}</p>
            {/if}
          {/each}
        </div>
      </div>
    {/if}

  {:else if phase === 'intro'}
    <!-- Pre-mount loading state -->
    <div class="flex flex-col items-center justify-center py-24 gap-4">
      <span class="material-symbols-outlined text-4xl" style="color: #f0c040; font-variation-settings: 'FILL' 1;">swords</span>
      <p class="font-mono text-xs tracking-widest uppercase" style="color: #9a907b;">Preparing battle…</p>
    </div>
  {/if}

</div>

<!-- ══ Result overlay ════════════════════════════════════════════════════════ -->
{#if phase === 'result'}
  {@const winColor = team1Won ? '#f0c040' : battleWinner === 'draw' ? '#9a907b' : team2Color}
  {@const winLabel = team1Won ? team1Label : battleWinner === 'draw' ? 'Draw' : team2Label}
  <div class="fixed inset-0 z-50 flex items-end justify-center px-4"
    style="background: rgba(0,0,0,0.72); backdrop-filter: blur(10px); padding-bottom: max(88px, calc(env(safe-area-inset-bottom,0px) + 88px));">
    <div class="w-full max-w-md rounded-2xl overflow-hidden"
      style="background: {winColor}0a; border: 1px solid {winColor}44; box-shadow: 0 0 60px {winColor}14; animation: resultReveal 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards;">
      <div class="px-5 py-6 text-center">

        <p class="text-xs tracking-[0.25em] uppercase mb-2"
          style="font-family: 'JetBrains Mono', monospace; color: {winColor};">
          {team1Won ? 'Victory' : battleWinner === 'draw' ? 'Draw' : 'Defeated'}
        </p>

        <p style="font-family: 'Cinzel', serif; font-size: clamp(1.3rem, 5vw, 2rem); font-weight: 900; color: {winColor};
                  letter-spacing: 0.1em; filter: drop-shadow(0 0 16px {winColor}55);">
          {battleWinner === 'draw' ? 'DRAW!' : `${winLabel} WINS!`}
        </p>

        {#if battleWinner !== 'draw'}
          <p class="mt-1 text-sm" style="color: #9a907b;">
            {team1Won ? 'Fate has spoken.' : 'Better luck next time.'}
          </p>
        {:else}
          <p class="mt-1 text-sm" style="color: #9a907b;">The fates are balanced.</p>
        {/if}

        <!-- Winner stats summary -->
        {#if battleWinner !== 'draw'}
          {@const winChars = team1Won ? t1Chars : t2Chars}
          {@const winHp    = team1Won ? t1DispHp : t2DispHp}
          <div class="mt-4 rounded-xl px-4 py-3 text-left" style="background: rgba(0,0,0,0.3); border: 1px solid {winColor}18;">
            <p class="font-mono text-xs mb-2 tracking-widest uppercase" style="color: #9a907b;">Survivors</p>
            {#each winChars as c, i}
              {@const hp  = winHp[i] ?? 0}
              {@const pct = c.maxHp > 0 ? hp / c.maxHp : 0}
              {#if hp > 0}
                <div class="flex items-center gap-3 mb-1.5">
                  <span class="font-bold text-xs truncate flex-1" style="font-family: 'Cinzel', serif; color: {winColor};">{c.name}</span>
                  <div class="w-20 rounded-full overflow-hidden" style="height: 5px; background: rgba(255,255,255,0.08);">
                    <div class="h-full rounded-full" style="width: {pct * 100}%; background: {hpColor(pct)};"></div>
                  </div>
                  <span class="font-mono text-xs shrink-0" style="color: {hpColor(pct)};">{formatHp(hp)}</span>
                </div>
              {/if}
            {/each}
          </div>
        {/if}

        <!-- Action buttons -->
        <div class="mt-5 flex flex-col gap-2">
          <button onclick={onRematch}
            class="w-full metal-stamp-gold py-3 rounded-xl font-bold font-mono text-sm tracking-widest">
            ↺ Rematch
          </button>
          <button onclick={onBack}
            class="w-full obsidian-slab py-2.5 rounded-xl font-mono text-sm tracking-widest"
            style="border: 1px solid {winColor}28; color: {winColor};">
            ← {backLabel}
          </button>
        </div>

      </div>
    </div>
  </div>
{/if}
