<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte'
  import { buildBattleCharacter, simulateTeamBattle, formatHp, detectWeaknessElement } from '$lib/game/battle'
  import type { BattleCharacter, TeamBattleRound, RoundFxEvent } from '$lib/game/battle'
  import { computeOverallScore, scoreTier } from '$lib/game/scoreTier'
  import { settings } from '$lib/settings.svelte'
  import type { SpinResult } from '$lib/session/types'
  import AttackFX from './AttackFX.svelte'

  interface TeamMember {
    results: SpinResult[]
    name: string
    shareId?: string
    startedAt?: string
  }
  interface Props {
    team1: TeamMember[]
    team2: TeamMember[]
    onRematch: () => void
    onBackToMenu: () => void
  }
  let { team1, team2, onRematch, onBackToMenu }: Props = $props()

  const is1v1 = team1.length === 1 && team2.length === 1

  // ─── Battle state ─────────────────────────────────────────────────────────────
  let t1Chars  = $state<BattleCharacter[]>([])
  let t2Chars  = $state<BattleCharacter[]>([])
  let t1DispHp = $state<number[]>([])
  let t2DispHp = $state<number[]>([])
  let rounds   = $state<TeamBattleRound[]>([])
  let roundIdx = $state(0)
  let logLines = $state<string[]>([])
  let phase    = $state<'intro' | 'battle' | 'result'>('intro')
  let winner   = $state<'team1' | 'team2' | 'draw' | null>(null)

  let saveStatus   = $state<'idle' | 'saving' | 'saved' | 'error'>('idle')
  let savedShareId = $state('')
  let savedWins    = $state(0)

  let logEl: HTMLDivElement | null = $state(null)
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let animTimeoutId: ReturnType<typeof setTimeout> | null = null
  type AnimDir = 'ltr' | 'rtl' | 'center'
  let activeAnim = $state<{ type: string; color: string; key: number; direction: AnimDir; grade?: string; origin?: { x: number; y: number }; attackType?: string } | null>(null)
  let animKey = 0
  let currentFxEvents = $state<RoundFxEvent[]>([])
  let fxEventIdx = 0
  let aoeRemainingHits = 0

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

  function getPanelOrigin(dir: AnimDir): { x: number; y: number } | undefined {
    // For 'center' anims (AOE bursts on system events), anchor on the battle
    // wrapper midpoint, not the viewport. Otherwise VFX from a scrolled-down
    // battle log appears floating in the middle of the viewport.
    if (dir === 'center') {
      if (!wrapperEl) return undefined
      const r = wrapperEl.getBoundingClientRect()
      // Clamp Y into the visible viewport so the VFX never paints off-screen.
      const cx = r.left + r.width / 2
      const cy = Math.max(80, Math.min(r.top + r.height / 2, window.innerHeight - 80))
      return { x: cx, y: cy }
    }
    const el = dir === 'ltr' ? t1PanelEl : dir === 'rtl' ? t2PanelEl : null
    if (!el) return undefined
    const r = el.getBoundingClientRect()
    const x = r.left + r.width / 2
    const y = Math.max(80, Math.min(r.top + r.height / 2, window.innerHeight * 0.65))
    return { x, y }
  }

  function showAnim(type: string, color: string, direction: AnimDir = 'center', grade?: string, origin?: { x: number; y: number }, attackType?: string) {
    if (animTimeoutId) clearTimeout(animTimeoutId)
    activeAnim = { type, color, key: ++animKey, direction, grade, origin, attackType }
    animTimeoutId = setTimeout(() => { activeAnim = null }, 950)
    if (direction !== 'center') emitTrail(direction, color, type)
  }

  function detectAnim(line: string): { type: string; color: string; direction: AnimDir } | null {
    const hasAction = line.includes('damage!') || line.includes('restores') ||
      line.includes('recovers') || line.includes('barrier') || line.includes('defensive') ||
      /BERSERK|combo finisher|follow-up|evad|dodge|riposte|counter-attack|retaliates|strikes back/i.test(line)
    if (!hasAction) return null

    const direction: AnimDir =
      [...t1Names].some(n => line.startsWith(n)) ? 'ltr' :
      [...t2Names].some(n => line.startsWith(n)) ? 'rtl' :
      'center'

    if (/CRITICAL|DEVASTATING|PERFECT STRIKE|OVERWHELMING|UNSTOPPABLE|OVERKILL/i.test(line)) return { type: 'crit', color: '#fde047', direction }
    if (/berserk|frenzy/i.test(line)) return { type: 'berserker', color: '#ef4444', direction }
    if (/combo finisher|follow-up/i.test(line)) return { type: 'combo', color: '#f59e0b', direction }
    if (/barrier forms|defensive stance|protective shell|bracing/i.test(line)) return { type: 'shield', color: '#93c5fd', direction: 'center' }
    if (/restores|recovers.*HP|vital force|mends/i.test(line)) return { type: 'holy', color: '#34d399', direction }
    if (/fire|flame|blaze|inferno|burn|ember|magma|lava|heat/i.test(line)) return { type: 'fire', color: '#f97316', direction }
    if (/shadow|void|abyss|soul drain|leech/i.test(line)) return { type: 'shadow', color: '#8b5cf6', direction }
    if (/blood|crimson/i.test(line)) return { type: 'blood', color: '#dc2626', direction }
    if (/curse/i.test(line)) return { type: 'cursed', color: '#7c3aed', direction }
    if (/lightning|thunder|electric|storm|volt|spark|shock|arc/i.test(line)) return { type: 'lightning', color: '#fbbf24', direction }
    if (/ice|frost|freeze|cryo|blizzard|snow|cold|glacier/i.test(line)) return { type: 'ice', color: '#7dd3fc', direction }
    if (/divine|holy|celestial|angel|sacred|radiant|blessed/i.test(line)) return { type: 'holy', color: '#fde68a', direction }
    if (/time|temporal|chrono|rewind|haste|blink|phase/i.test(line)) return { type: 'time', color: '#a78bfa', direction }
    if (/psychic|mind|telepathy|mental|chaos|reality|warp|phantom/i.test(line)) return { type: 'psychic', color: '#e879f9', direction }
    if (/poison|acid|toxic|venom|plague|rot/i.test(line)) return { type: 'poison', color: '#84cc16', direction }
    if (/gravity|black hole|collapse|crush|singularity|weight/i.test(line)) return { type: 'gravity', color: '#6366f1', direction }
    if (/wind|gust|tornado|vortex|cyclone|whirlwind/i.test(line)) return { type: 'wind', color: '#e2e8f0', direction }
    if (/earth|rock|stone|ground|quake|mountain|boulder/i.test(line)) return { type: 'earth', color: '#a16207', direction }
    if (/energy|power|force|blast|surge|beam/i.test(line)) return { type: 'energy', color: '#60a5fa', direction }
    if (/evad|dodge|sidestep|narrowly avoids|slips past/i.test(line)) return { type: 'dodge', color: '#94a3b8', direction: 'center' }
    if (/riposte|counter-attack|retaliates|strikes back/i.test(line)) return { type: 'counter', color: '#f59e0b', direction }
    if (line.includes('damage!')) return { type: 'slash', color: '#f87171', direction }
    return null
  }

  // ─── DOM refs for effects ─────────────────────────────────────────────────────
  let wrapperEl:    HTMLDivElement | null = $state(null)
  let t1PanelEl:   HTMLDivElement | null = $state(null)
  let t2PanelEl:   HTMLDivElement | null = $state(null)
  let speedLinesEl: HTMLDivElement | null = $state(null)

  // ─── Particle state ───────────────────────────────────────────────────────────
  interface Particle {
    id: number; x: number; y: number; text: string
    color: string; shadowColor: string; size: number
    ambient?: boolean; confetti?: boolean; trail?: boolean
  }
  let particles   = $state<Particle[]>([])
  let pId = 0

  interface ImpactRing { id: number; x: number; y: number }
  let impactRings = $state<ImpactRing[]>([])

  // ─── Overlay / HUD state ──────────────────────────────────────────────────────
  let screenFlash    = $state(false)
  let deathFlash     = $state(false)
  let roundBanner    = $state<string | null>(null)
  let centerText     = $state<{ text: string; color: string } | null>(null)
  let t1StatusBadges = $state<string[]>([])
  let t2StatusBadges = $state<string[]>([])

  let audioCtx: AudioContext | null = null
  let ambientInterval: ReturnType<typeof setInterval> | null = null

  // ─── Derived ──────────────────────────────────────────────────────────────────
  let t1Names = $derived(new Set(t1Chars.map(c => c.name)))
  let t2Names = $derived(new Set(t2Chars.map(c => c.name)))
  let t1HpPct = $derived(t1Chars.map((c, i) => c.maxHp > 0 ? Math.max(0, (t1DispHp[i] ?? 0) / c.maxHp) : 0))
  let t2HpPct = $derived(t2Chars.map((c, i) => c.maxHp > 0 ? Math.max(0, (t2DispHp[i] ?? 0) / c.maxHp) : 0))
  let t1Label = $derived(is1v1 ? (t1Chars[0]?.name ?? 'Team 1') : 'Team 1')
  let t2Label = $derived(is1v1 ? (t2Chars[0]?.name ?? 'Team 2') : 'Team 2')

  let vignetteActive = $derived(
    phase === 'battle' && (
      t1HpPct.some(p => p < 0.25 && p > 0) ||
      t2HpPct.some(p => p < 0.25 && p > 0)
    )
  )

  function hpColor(pct: number): string {
    if (pct > 0.50) return '#22c55e'
    if (pct > 0.25) return '#eab308'
    return '#ef4444'
  }

  function speedDelay(ms: number): number {
    if (settings.battleSpeed >= 99) return 10
    return Math.max(50, ms / settings.battleSpeed)
  }

  // ─── Audio ────────────────────────────────────────────────────────────────────
  function getCtx(): AudioContext | null {
    if (typeof AudioContext === 'undefined') return null
    if (!audioCtx) { try { audioCtx = new AudioContext() } catch { return null } }
    return audioCtx
  }

  function playSound(type: 'hit' | 'crit' | 'heal' | 'death' | 'round' | 'defend' | 'defeat') {
    if (!settings.soundEnabled) return
    const ctx = getCtx()
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume()
    const now = ctx.currentTime
    const master = ctx.createGain()
    master.connect(ctx.destination)

    const noise = (dur: number, freq: number, decay: number, gain: number) => {
      const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * decay))
      const src = ctx.createBufferSource()
      const flt = ctx.createBiquadFilter()
      const g   = ctx.createGain()
      flt.type = 'lowpass'; flt.frequency.value = freq
      g.gain.setValueAtTime(gain, now); g.gain.exponentialRampToValueAtTime(0.001, now + dur)
      src.buffer = buf; src.connect(flt); flt.connect(g); g.connect(master)
      src.start(now); src.stop(now + dur)
    }
    const osc = (type_: OscillatorType, freq: number, freqEnd: number, dur: number, gain: number, delay = 0) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = type_
      o.frequency.setValueAtTime(freq, now + delay)
      if (freqEnd !== freq) o.frequency.exponentialRampToValueAtTime(freqEnd, now + delay + dur)
      g.gain.setValueAtTime(gain, now + delay); g.gain.exponentialRampToValueAtTime(0.001, now + delay + dur)
      o.connect(g); g.connect(master); o.start(now + delay); o.stop(now + delay + dur)
    }

    switch (type) {
      case 'hit':
        master.gain.value = 0.22
        noise(0.12, 600, 0.03, 0.8)
        osc('sine', 140, 60, 0.15, 0.25)
        break
      case 'crit':
        master.gain.value = 0.28
        noise(0.08, 1200, 0.015, 1.0)
        osc('sawtooth', 220, 880, 0.04, 0.35)
        osc('sawtooth', 880, 110, 0.28, 0.3, 0.04)
        osc('square',   110,  55, 0.35, 0.2)
        break
      case 'heal':
        master.gain.value = 0.16
        ;[523, 659, 784, 1047].forEach((f, i) => osc('sine', f, f * 1.02, 0.45, 0.13, i * 0.06))
        break
      case 'defend':
        master.gain.value = 0.20
        osc('triangle', 900, 220, 0.35, 0.28)
        noise(0.06, 2000, 0.01, 0.5)
        break
      case 'death':
        master.gain.value = 0.30
        noise(0.3, 400, 0.12, 0.9)
        osc('sine', 200, 30, 0.9, 0.4)
        osc('square', 80, 40, 0.6, 0.15, 0.1)
        break
      case 'defeat':
        master.gain.value = 0.25
        osc('sine', 440, 220, 0.4, 0.3)
        osc('sine', 330, 165, 0.6, 0.2, 0.2)
        osc('sine', 220, 110, 0.8, 0.15, 0.35)
        break
      case 'round':
        master.gain.value = 0.10
        osc('triangle', 330, 320, 0.6, 0.18)
        break
    }
  }

  // ─── Visual effects ───────────────────────────────────────────────────────────
  function shake(intensity: 'light' | 'heavy') {
    if (!settings.effectsEnabled || !wrapperEl) return
    wrapperEl.classList.remove('fx-shake-light', 'fx-shake-heavy')
    void wrapperEl.offsetWidth
    wrapperEl.classList.add(intensity === 'heavy' ? 'fx-shake-heavy' : 'fx-shake-light')
    setTimeout(() => wrapperEl?.classList.remove('fx-shake-light', 'fx-shake-heavy'), 520)
  }

  function flashPanel(team: 1 | 2, kind: 'hit' | 'crit' | 'heal' | 'death') {
    if (!settings.effectsEnabled) return
    const el = team === 1 ? t1PanelEl : t2PanelEl
    if (!el) return
    el.classList.remove('fx-flash-hit', 'fx-flash-crit', 'fx-flash-heal', 'fx-flash-death')
    void el.offsetWidth
    el.classList.add(`fx-flash-${kind}`)
    setTimeout(() => el?.classList.remove('fx-flash-hit', 'fx-flash-crit', 'fx-flash-heal', 'fx-flash-death'), 500)
  }

  function triggerSpeedLines() {
    if (!settings.effectsEnabled || !speedLinesEl) return
    speedLinesEl.classList.remove('speed-lines-active')
    void speedLinesEl.offsetWidth
    speedLinesEl.classList.add('speed-lines-active')
    setTimeout(() => speedLinesEl?.classList.remove('speed-lines-active'), 250)
  }

  function spawnParticle(team: 1 | 2, text: string, color: string, shadowColor: string, size = 1.1) {
    if (!settings.effectsEnabled) return
    const el = team === 1 ? t1PanelEl : t2PanelEl
    let x = team === 1 ? 20 : 80
    let y = 45
    if (el) {
      const r = el.getBoundingClientRect()
      x = ((r.left + r.width * 0.5) / window.innerWidth)  * 100
      y = ((r.top  + r.height * 0.4) / window.innerHeight) * 100
    }
    x += (Math.random() - 0.5) * 10
    y += (Math.random() - 0.5) * 12
    const p: Particle = { id: pId++, x, y, text, color, shadowColor, size }
    particles = [...particles, p]
    setTimeout(() => { particles = particles.filter(q => q.id !== p.id) }, 1300)
  }

  function spawnImpactRing(team: 1 | 2) {
    if (!settings.effectsEnabled) return
    const el = team === 1 ? t1PanelEl : t2PanelEl
    if (!el) return
    const r = el.getBoundingClientRect()
    const ring: ImpactRing = { id: pId++, x: r.left + r.width / 2, y: r.top + r.height / 2 }
    impactRings = [...impactRings, ring]
    setTimeout(() => { impactRings = impactRings.filter(q => q.id !== ring.id) }, 750)
  }

  function addStatusBadge(team: 1 | 2, icon: string) {
    if (team === 1) {
      if (!t1StatusBadges.includes(icon)) t1StatusBadges = [...t1StatusBadges, icon]
      setTimeout(() => { t1StatusBadges = t1StatusBadges.filter(s => s !== icon) }, 8000)
    } else {
      if (!t2StatusBadges.includes(icon)) t2StatusBadges = [...t2StatusBadges, icon]
      setTimeout(() => { t2StatusBadges = t2StatusBadges.filter(s => s !== icon) }, 8000)
    }
  }

  function showCenter(text: string, color: string, dur = 1200) {
    if (!settings.effectsEnabled) return
    centerText = { text, color }
    setTimeout(() => { centerText = null }, dur)
  }

  function spawnConfetti() {
    if (!settings.effectsEnabled) return
    const colors = ['#f0c040', '#e879f9', '#34d399', '#f87171', '#60a5fa', '#fbbf24', '#a78bfa']
    const chars  = ['✦', '★', '◆', '●', '■', '▲', '✸', '✿']
    for (let i = 0; i < 40; i++) {
      setTimeout(() => {
        const p: Particle = {
          id: pId++,
          x: 5 + Math.random() * 90,
          y: -5,
          text: chars[Math.floor(Math.random() * chars.length)],
          color: colors[Math.floor(Math.random() * colors.length)],
          shadowColor: 'rgba(255,255,255,0.4)',
          size: 0.6 + Math.random() * 0.8,
          confetti: true
        }
        particles = [...particles, p]
        setTimeout(() => { particles = particles.filter(q => q.id !== p.id) }, 3500)
      }, i * 90)
    }
  }

  function spawnAmbient() {
    if (phase !== 'battle' || !settings.effectsEnabled) return
    const chars = ['✦', '·', '⋆', '✧', '◦', '∘']
    const p: Particle = {
      id: pId++,
      x: 3 + Math.random() * 94,
      y: 65 + Math.random() * 30,
      text: chars[Math.floor(Math.random() * chars.length)],
      color: Math.random() > 0.5 ? 'rgba(240,192,64,0.4)' : 'rgba(167,139,250,0.35)',
      shadowColor: 'rgba(240,192,64,0.15)',
      size: 0.35 + Math.random() * 0.3,
      ambient: true
    }
    particles = [...particles, p]
    setTimeout(() => { particles = particles.filter(q => q.id !== p.id) }, 2800)
  }

  function getTrailSymbol(type: string): string {
    const m: Record<string, string> = {
      fire: '∗', lightning: '╻', ice: '·', shadow: '◦', holy: '✦',
      psychic: '◦', void: '○', poison: '·', energy: '·', blood: '∙',
      earth: '∙', wind: '·', slash: '╱', crit: '★', counter: '✦',
      berserker: '∗', cursed: '◦', time: '◦', gravity: '·',
    }
    return m[type] ?? '·'
  }

  function emitTrail(direction: AnimDir, color: string, type: string) {
    if (!settings.effectsEnabled) return
    const t1El = t1PanelEl
    const t2El = t2PanelEl
    if (!t1El || !t2El) return
    const t1R = t1El.getBoundingClientRect()
    const t2R = t2El.getBoundingClientRect()
    const startX = ((direction === 'ltr' ? t1R.left + t1R.width / 2 : t2R.left + t2R.width / 2) / window.innerWidth) * 100
    const endX   = ((direction === 'ltr' ? t2R.left + t2R.width / 2 : t1R.left + t1R.width / 2) / window.innerWidth) * 100
    const baseY  = ((t1R.top + t1R.height * 0.4) / window.innerHeight) * 100
    const steps = 8
    const sym = getTrailSymbol(type)
    for (let i = 1; i <= steps; i++) {
      const delay = (i / (steps + 1)) * 560
      setTimeout(() => {
        const t = i / (steps + 1)
        const x = startX + (endX - startX) * t + (Math.random() - 0.5) * 3
        const yArc = Math.sin(t * Math.PI) * -7
        const y = baseY + yArc + (Math.random() - 0.5) * 5
        const p: Particle = { id: pId++, x, y, text: sym, color, shadowColor: color + 'cc', size: 0.26 + Math.random() * 0.22, trail: true }
        particles = [...particles, p]
        setTimeout(() => { particles = particles.filter(q => q.id !== p.id) }, 320)
      }, delay)
    }
  }

  function emitImpactBurst(team: 1 | 2, color: string, isCrit: boolean) {
    if (!settings.effectsEnabled) return
    const el = team === 1 ? t1PanelEl : t2PanelEl
    let cx = team === 1 ? 20 : 80
    let cy = 45
    if (el) {
      const r = el.getBoundingClientRect()
      cx = ((r.left + r.width * 0.5) / window.innerWidth)  * 100
      cy = ((r.top  + r.height * 0.4) / window.innerHeight) * 100
    }
    const count = isCrit ? 14 : 8
    const chars = ['✦', '★', '·', '◆', '∗', '◦', '∘']
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      const dist = (isCrit ? 9 : 5) + Math.random() * (isCrit ? 9 : 5)
      setTimeout(() => {
        const p: Particle = {
          id: pId++,
          x: cx + Math.cos(angle) * dist * 0.75,
          y: cy + Math.sin(angle) * dist * 0.5,
          text: chars[Math.floor(Math.random() * chars.length)],
          color, shadowColor: color + 'aa', size: 0.28 + Math.random() * 0.38,
          trail: true
        }
        particles = [...particles, p]
        setTimeout(() => { particles = particles.filter(q => q.id !== p.id) }, isCrit ? 650 : 450)
      }, i * 28)
    }
  }

  function parseDamage(line: string): string | null {
    const m = line.match(/([0-9]+(?:\.[0-9]+)?[KM]?) damage!/)
    return m ? `-${m[1]}` : null
  }
  function parseHeal(line: string): string | null {
    const m = line.match(/(?:restores?|recovers?|drains?) ([0-9]+(?:\.[0-9]+)?[KM]?) HP/)
    return m ? `+${m[1]}` : null
  }

  function triggerLineEffect(line: string) {
    const isCrit    = /CRITICAL|DEVASTATING|PERFECT STRIKE|OVERWHELMING|UNSTOPPABLE|OVERKILL/.test(line)
    const isHit     = line.includes('damage!')
    const isHeal    = line.includes('restores') || line.includes('recovers HP') || line.includes('drains')
    const isDefend  = line.includes('barrier forms') || line.includes('defensive stance') || line.includes('protective shell') || line.includes('bracing')
    const isDeath   = line.includes('has been defeated!')
    const isRound   = line.startsWith('──')
    const isCombo   = /follows up|chained|COMBO FINISHER/i.test(line)
    const isBerserk = /BERSERK|FRENZY|berserk fury/i.test(line)
    const isBurn    = /burn|scorch|ignit|on fire/i.test(line)
    const isPoison  = /poison|venom|toxic/i.test(line)
    const isFreeze  = /freez|frozen|ice|frost|chill/i.test(line)
    const isDodge   = /evad|dodge|sidestep|narrowly avoids|slips past/i.test(line)
    const isCounter = /riposte|counter-attack|retaliates|strikes back/i.test(line)

    if (isRound) { playSound('round'); return }

    const startsT1 = [...t1Names].some(n => line.startsWith(n))
    const startsT2 = [...t2Names].some(n => line.startsWith(n))
    const victimTeam: 1 | 2 | null = startsT1 ? 2 : startsT2 ? 1 : null
    const actorTeam:  1 | 2 | null = startsT1 ? 1 : startsT2 ? 2 : null

    if (isDeath) {
      const diedTeam = startsT1 ? 1 : startsT2 ? 2 : null
      if (diedTeam) flashPanel(diedTeam, 'death')
      shake('heavy')
      playSound('death')
      deathFlash = true
      setTimeout(() => { deathFlash = false }, 600)
      return
    }

    if (isCrit && isHit) {
      shake('heavy')
      screenFlash = true
      setTimeout(() => { screenFlash = false }, 200)
      triggerSpeedLines()
      if (victimTeam) {
        flashPanel(victimTeam, 'crit')
        spawnImpactRing(victimTeam)
        setTimeout(() => spawnImpactRing(victimTeam), 70)
        setTimeout(() => spawnImpactRing(victimTeam), 150)
        emitImpactBurst(victimTeam, '#fde047', true)
        const dmg = parseDamage(line)
        spawnParticle(victimTeam, dmg ?? '💥 CRIT', '#fde047', 'rgba(253,224,71,0.9)', 1.4)
        spawnParticle(victimTeam, '✦', '#fbbf24', 'rgba(251,191,36,0.7)', 0.9)
        spawnParticle(victimTeam, '★', '#fde047', 'rgba(253,224,71,0.6)', 0.8)
      }
      playSound('crit')
    } else if (isHit) {
      shake('light')
      triggerSpeedLines()
      if (victimTeam) {
        flashPanel(victimTeam, 'hit')
        spawnImpactRing(victimTeam)
        emitImpactBurst(victimTeam, '#f87171', false)
        const dmg = parseDamage(line)
        if (dmg) spawnParticle(victimTeam, dmg, '#f87171', 'rgba(248,113,113,0.7)', 1.0)
      }
      playSound('hit')
    } else if (isHeal) {
      if (actorTeam) {
        const hp = parseHeal(line)
        if (hp) spawnParticle(actorTeam, hp, '#34d399', 'rgba(52,211,153,0.8)', 1.0)
        flashPanel(actorTeam, 'heal')
      }
      playSound('heal')
    } else if (isDefend) {
      if (actorTeam) {
        spawnParticle(actorTeam, '🛡', '#93c5fd', 'rgba(147,197,253,0.7)', 1.1)
        flashPanel(actorTeam, 'heal')
      }
      playSound('defend')
    }

    if (isCombo)   showCenter('COMBO!',   '#fde047', 1100)
    if (isBerserk) showCenter('BERSERK!', '#f87171', 1300)

    if (isDodge) {
      const dodgingTeam: 1 | 2 | null = startsT1 ? 1 : startsT2 ? 2 : null
      if (dodgingTeam) {
        showCenter('DODGE!', '#94a3b8', 900)
        flashPanel(dodgingTeam, 'heal')
        spawnParticle(dodgingTeam, '💨', '#94a3b8', 'rgba(148,163,184,0.7)', 1.1)
        emitImpactBurst(dodgingTeam, '#94a3b8', false)
      }
    }

    if (isCounter) {
      showCenter('COUNTER!', '#f59e0b', 1100)
      triggerSpeedLines()
      if (actorTeam) {
        flashPanel(actorTeam, 'crit')
        spawnImpactRing(actorTeam)
        spawnParticle(actorTeam, '⚡', '#f59e0b', 'rgba(245,158,11,0.8)', 1.2)
        emitImpactBurst(actorTeam, '#f59e0b', false)
      }
    }

    if (isBurn || isPoison || isFreeze) {
      const icon = isBurn ? '🔥' : isPoison ? '☠️' : '❄️'
      const isTickLine = /takes.*damage|is burning|is poisoned|is frozen/i.test(line)
      const badgeTeam = isTickLine ? actorTeam : (victimTeam ?? actorTeam)
      if (badgeTeam) {
        addStatusBadge(badgeTeam, icon)
        spawnParticle(badgeTeam, icon, '#fff', 'rgba(255,255,255,0.4)', 1.0)
      }
    }
  }

  // ─── Playback ─────────────────────────────────────────────────────────────────
  async function scrollLog() {
    await tick()
    if (logEl) logEl.scrollTop = logEl.scrollHeight
  }

  function playLines(lines: string[], onDone: () => void) {
    if (lines.length === 0) { onDone(); return }

    if (settings.battleSpeed >= 99) {
      logLines = [...logLines, ...lines]
      scrollLog()
      for (const l of lines) {
        if (/CRITICAL|DEVASTATING|has been defeated!/.test(l)) triggerLineEffect(l)
      }
      timeoutId = setTimeout(onDone, 20)
      return
    }

    const [head, ...rest] = lines
    logLines = [...logLines, head]
    scrollLog()
    triggerLineEffect(head)
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
        const origin = getPanelOrigin(originDir)
        showAnim(type, color, direction, grade, origin, fxAttackType)
      }
    }
    const base = head.startsWith('──') ? 550 : 1600
    timeoutId = setTimeout(() => playLines(rest, onDone), speedDelay(base))
  }

  function playRound() {
    if (roundIdx >= rounds.length) {
      phase  = 'result'
      winner = rounds.at(-1)?.winner ?? null
      afterBattle()
      return
    }
    const round = rounds[roundIdx]
    roundIdx++
    currentFxEvents = round.fxEvents ?? []
    fxEventIdx = 0
    aoeRemainingHits = 0

    if (settings.battleSpeed < 99) {
      roundBanner = `ROUND ${round.roundNum}`
      setTimeout(() => { roundBanner = null }, 800)
    }

    const lines = [`── Round ${round.roundNum} ──`, ...round.lines]
    playLines(lines, () => {
      // HP bars update after all lines have played — log explains the damage first
      t1DispHp = [...round.t1Hp]
      t2DispHp = [...round.t2Hp]

      if (round.winner !== undefined) {
        phase  = 'result'
        winner = round.winner
        playSound('defeat')
        afterBattle()
      } else {
        timeoutId = setTimeout(playRound, speedDelay(900))
      }
    })
  }

  function afterBattle() {
    if (is1v1 && winner && winner !== 'draw') saveWinnerToBackend()
    if (winner && winner !== 'draw') setTimeout(spawnConfetti, 400)
  }

  async function saveWinnerToBackend() {
    if (!winner || winner === 'draw') return
    saveStatus = 'saving'
    const winMember = winner === 'team1' ? team1[0] : team2[0]
    const existingId = winMember.shareId ?? ''
    const winnerResults = winMember.results
    const winnerName    = winMember.name
    const winnerStart   = winMember.startedAt ?? ''
    try {
      let shareId = existingId
      if (!shareId) {
        const race      = winnerResults.find(r => r.category === 'race')?.resultLabel      ?? ''
        const archetype = winnerResults.find(r => r.category === 'archetype')?.resultLabel ?? ''
        const STAT_CATS = ['strength','speed','agility','durability','iq','charisma','fightingSkill','powerMastery','weaponMastery','potential','energyLevel']
        const statScores = Object.fromEntries(STAT_CATS.map(c => [c, winnerResults.find(r => r.category === c)?.score ?? 0]))
        const res = await fetch('/api/characters', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: winnerName || race, race, archetype,
            overall_score: computeOverallScore(statScores), overall_tier: scoreTier(computeOverallScore(statScores)),
            spins: winnerResults, session_started_at: winnerStart,
            elementWeaknesses: winnerResults
              .filter(r => r.category === 'weakness')
              .map(r => detectWeaknessElement(r.resultLabel))
              .filter((e): e is NonNullable<typeof e> => !!e) }),
        })
        if (!res.ok) { saveStatus = 'error'; return }
        const data = await res.json() as { shareId: string }
        shareId = data.shareId
        try {
          const ex: string[] = JSON.parse(localStorage.getItem('wof_saved_chars') ?? '[]')
          if (!ex.includes(shareId)) localStorage.setItem('wof_saved_chars', JSON.stringify([shareId, ...ex].slice(0, 50)))
        } catch { /* ignore */ }
      }
      // credentials:'include' is required — the server now gates this endpoint
      // by ownership (PATCH /characters/:shareId/rivals-win checks userId match),
      // so the auth cookie has to ride along or the increment silently 401s
      // and the medal never appears on the character card.
      const patchRes = await fetch(`/api/characters/${shareId}/rivals-win`, { method: 'PATCH', credentials: 'include' })
      if (patchRes.ok) {
        const pd = await patchRes.json() as { rivals_wins: number }
        savedWins = pd.rivals_wins; savedShareId = shareId; saveStatus = 'saved'
      } else { savedShareId = shareId; saveStatus = 'saved' }
    } catch { saveStatus = 'error' }
  }

  onMount(() => {
    t1Chars  = team1.map(m => buildBattleCharacter(m.results, m.name))
    t2Chars  = team2.map(m => buildBattleCharacter(m.results, m.name))
    t1DispHp = t1Chars.map(c => c.hp)
    t2DispHp = t2Chars.map(c => c.hp)
    rounds   = simulateTeamBattle(t1Chars, t2Chars)
    timeoutId = setTimeout(() => { phase = 'battle'; playRound() }, 2600)
    ambientInterval = setInterval(spawnAmbient, 2000)
  })

  onDestroy(() => {
    if (timeoutId) clearTimeout(timeoutId)
    if (animTimeoutId) clearTimeout(animTimeoutId)
    if (ambientInterval) clearInterval(ambientInterval)
    audioCtx?.close()
  })
</script>

<!-- ─── Global overlays (fixed, pointer-events: none) ─────────────────────── -->

<!-- Vignette: pulses red when someone is near death -->
<div class="vignette-overlay" class:vignette-active={vignetteActive}></div>

<!-- Speed lines layer -->
<div bind:this={speedLinesEl} class="speed-lines-overlay">
  <div class="speed-line" style="top:16%;animation-delay:0s;"></div>
  <div class="speed-line" style="top:32%;animation-delay:0.02s;"></div>
  <div class="speed-line" style="top:50%;animation-delay:0.01s;"></div>
  <div class="speed-line" style="top:67%;animation-delay:0.03s;"></div>
  <div class="speed-line" style="top:82%;animation-delay:0.015s;"></div>
</div>

<!-- Crit screen flash -->
{#if screenFlash}
  <div class="screen-flash-overlay"></div>
{/if}

<!-- Death screen flash -->
{#if deathFlash}
  <div class="death-flash-overlay"></div>
{/if}

<!-- Round banner -->
{#if roundBanner}
  <div class="round-banner">{roundBanner}</div>
{/if}

<!-- Combo / Berserk center text -->
{#if centerText}
  <div class="center-text-display" style="color:{centerText.color};text-shadow:0 0 30px {centerText.color}99,0 0 60px {centerText.color}55;">
    {centerText.text}
  </div>
{/if}

<!-- Impact rings -->
{#each impactRings as ring (ring.id)}
  <div class="impact-ring" style="left:{ring.x}px;top:{ring.y}px;"></div>
{/each}

<!-- All particles (combat, ambient, confetti, trail) -->
{#each particles as p (p.id)}
  <div
    class={p.confetti ? 'confetti-particle' : p.ambient ? 'ambient-particle' : p.trail ? 'trail-particle' : 'particle'}
    style="left:{p.x}%;top:{p.y}%;color:{p.color};text-shadow:0 0 10px {p.shadowColor};font-size:{p.size}rem;"
  >{p.text}</div>
{/each}

<!-- ─── Main wrapper ────────────────────────────────────────────────────────── -->
<div bind:this={wrapperEl} class="battle-root vignette-crit">
  <div class="radial-energy-left" style="z-index: -1;"></div>
  <div class="radial-energy-right" style="z-index: -1;"></div>

  <!-- Header -->
  <div class="text-center mb-4" style="animation: fadeIn 0.3s ease-out forwards; padding: 2rem 1rem 0;">
    <p class="text-xs tracking-[0.28em] uppercase mb-1" style="font-family:'JetBrains Mono',monospace;color:#f9a8d4;">⚔ Rivals Mode</p>
    <h1 style="font-family:'Cinzel',serif;font-size:clamp(1.3rem,4vw,2rem);font-weight:900;color:#ffdf96;letter-spacing:0.15em;">
      {is1v1 ? 'RIVALS BATTLE' : `${team1.length}v${team2.length} TEAM BATTLE`}
    </h1>
  </div>

  <!-- 3-column battle arena -->
  <div class="battle-grid" style="padding:0 0.75rem 1rem;position:relative;overflow:visible;">

    <!-- Attack FX overlay: fixed to attacker panel center, fly animation travels to target -->
    {#if phase === 'battle' && activeAnim}
      {#key activeAnim.key}
        {@const ox = activeAnim.origin?.x}
        {@const oy = activeAnim.origin?.y}
        {@const _wrapperRect = wrapperEl?.getBoundingClientRect()}
        <!-- Fallback positioning when origin couldn't be resolved (panel ref not
             mounted yet on the very first frame). Use the wrapper midpoint instead
             of 50vw/50vh so scrolled views don't paint VFX floating in air. -->
        <div style="position:fixed;
                    left:{ox != null ? ox + 'px' : _wrapperRect != null
                          ? (activeAnim.direction === 'rtl' ? (_wrapperRect.right - _wrapperRect.width * 0.25) + 'px'
                            : activeAnim.direction === 'ltr' ? (_wrapperRect.left + _wrapperRect.width * 0.25) + 'px'
                            : (_wrapperRect.left + _wrapperRect.width / 2) + 'px')
                          : (activeAnim.direction === 'rtl' ? '75vw' : activeAnim.direction === 'center' ? '50vw' : '25vw')};
                    top:{oy != null ? oy + 'px' : _wrapperRect != null
                          ? (_wrapperRect.top + Math.min(_wrapperRect.height / 2, window.innerHeight * 0.4)) + 'px'
                          : '50vh'};
                    transform:translate(-50%,-50%);
                    z-index:9999;pointer-events:none;">
          <AttackFX type={activeAnim.type} color={activeAnim.color}
                    direction={activeAnim.direction} size={68} grade={activeAnim.grade} attackType={activeAnim.attackType}/>
        </div>
      {/key}
    {/if}

    <!-- ── Team 1 (left) ── -->
    <div bind:this={t1PanelEl} class="team-col">
      {#if !is1v1}
        <p class="team-label" style="color:#f0c040;border-bottom:1px solid rgba(240,192,64,0.2);">Team 1</p>
      {/if}
      {#each t1Chars as char, i}
        {@const hp   = t1DispHp[i] ?? 0}
        {@const pct  = t1HpPct[i] ?? 0}
        {@const dead = hp <= 0}
        {@const won  = phase === 'result' && winner === 'team1'}
        {@const lost = phase === 'result' && winner === 'team2'}
        <div class="member-card" style="border-color:rgba(240,192,64,{dead?'0.07':won?'0.7':'0.22'});box-shadow:0 8px 24px rgba(0,0,0,0.7),inset 1px 1px 0 rgba(255,223,150,0.08){won&&!dead?',0 0 28px rgba(240,192,64,0.22)':''};opacity:{dead?0.4:1};">
          <div class="flex items-center gap-1.5 min-w-0">
            {#if dead}<span class="material-symbols-outlined" style="font-size:13px;color:#ef4444;font-variation-settings:'FILL' 1;">skull</span>
            {:else if won}<span class="material-symbols-outlined" style="font-size:13px;color:#f0c040;font-variation-settings:'FILL' 1;">workspace_premium</span>
            {:else if lost}<span class="material-symbols-outlined" style="font-size:13px;color:#ef4444;font-variation-settings:'FILL' 1;">skull</span>
            {/if}
            <p class="font-bold truncate" style="font-family:'Cinzel',serif;color:#ffdf96;font-size:{is1v1?'0.9rem':'0.78rem'};">{char.name}</p>
          </div>
          <p class="truncate" style="font-family:'JetBrains Mono',monospace;color:#9a907b;font-size:0.65rem;">{char.raceLabel} · {char.archetypeLabel}</p>
          <div class="hp-track"><div class="hp-fill" style="width:{pct*100}%;background:{hpColor(pct)};"></div></div>
          <p style="font-family:'JetBrains Mono',monospace;color:{hpColor(pct)};font-size:0.65rem;">{formatHp(hp)}<span style="color:#4e4635;"> / {formatHp(char.maxHp)}</span></p>
          {#if is1v1}
            <div class="stat-row">
              {#each [['ATK',formatHp(char.physicalDamage)],['DEF',Math.round(char.armorReduction*100)+'%'],['INIT',Math.round(char.initiative)]] as [l,v]}
                <div class="stat-chip" style="border-color:rgba(240,192,64,0.12);">
                  <p style="color:#9a907b;font-size:7px;">{l}</p>
                  <p style="color:#ffdf96;font-size:0.68rem;font-family:'Cinzel',serif;">{v}</p>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
      <!-- Status badges T1 -->
      {#if t1StatusBadges.length > 0}
        <div class="status-badges">
          {#each t1StatusBadges as badge}<span class="status-badge">{badge}</span>{/each}
        </div>
      {/if}
    </div>

    <!-- ── Center column ── -->
    <div class="center-col">

      <!-- VS intro -->
      {#if phase === 'intro'}
        <div class="text-center" style="padding:2rem 0;animation:resultReveal 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards;">
          <p style="font-family:'Cinzel',serif;font-size:clamp(2.5rem,8vw,4rem);font-weight:900;color:#f0c040;letter-spacing:0.2em;filter:drop-shadow(0 0 24px rgba(240,192,64,0.6));">VS</p>
          <p class="mt-2 text-xs tracking-[0.2em] uppercase" style="font-family:'JetBrains Mono',monospace;color:#9a907b;">
            {is1v1 ? 'Calculating fate…' : `${team1.length}v${team2.length} — Calculating fate…`}
          </p>
        </div>
      {/if}

      <!-- Battle log -->
      {#if phase !== 'intro'}
        <div class="log-box">
          <div class="log-header">
            <span class="material-symbols-outlined" style="font-size:13px;color:#9a907b;font-variation-settings:'FILL' 1;">menu_book</span>
            <p style="font-family:'JetBrains Mono',monospace;color:#9a907b;font-size:0.7rem;letter-spacing:0.12em;text-transform:uppercase;">Battle Log</p>
            {#if phase === 'battle'}
              <span class="ml-auto" style="font-family:'JetBrains Mono',monospace;color:#f9a8d4;font-size:0.65rem;background:rgba(157,23,77,0.3);border:1px solid rgba(157,23,77,0.5);border-radius:4px;padding:2px 8px;">
                Round {roundIdx}/{rounds.length}
              </span>
            {/if}
          </div>
          <div bind:this={logEl} class="log-scroll">
            {#if logLines.length === 0}
              <p style="color:#4e4635;font-style:italic;font-size:0.72rem;text-align:center;padding:1rem 0;">The battle begins…</p>
            {/if}
            {#each logLines as line}
              {@const isT1  = [...t1Names].some(n => line.startsWith(n))}
              {@const isT2  = [...t2Names].some(n => line.startsWith(n))}
              {@const isDead = line.includes('has been defeated!')}
              {@const isBig  = /CRITICAL|DEVASTATING|PERFECT STRIKE|OVERWHELMING|UNSTOPPABLE|OVERKILL/.test(line)}
              {#if line.startsWith('──')}
                <p class="log-round-header">{line}</p>
              {:else if isDead}
                <p class="log-line" style="color:#ef4444;font-weight:700;">{line}</p>
              {:else if isBig}
                <p class="log-line" style="color:#fde047;font-weight:700;">{line}</p>
              {:else if isT1}
                <p class="log-line" style="color:#fde68a;">{line}</p>
              {:else if isT2}
                <p class="log-line" style="color:#e9d5ff;">{line}</p>
              {:else}
                <p class="log-line log-italic">{line}</p>
              {/if}
            {/each}
          </div>
        </div>
      {/if}

      <!-- Winner declaration -->
      {#if phase === 'result' && winner}
        {@const winLabel = winner === 'team1' ? t1Label : winner === 'team2' ? t2Label : null}
        {@const wc = winner === 'draw' ? '#9ca3af' : winner === 'team1' ? '#f0c040' : '#e879f9'}
        <div class="winner-box" style="border-color:{wc}55;background:{winner==='draw'?'rgba(156,163,175,0.07)':winner==='team1'?'rgba(240,192,64,0.07)':'rgba(232,121,249,0.07)'};box-shadow:0 0 60px {wc}14;">
          {#if winner === 'draw'}
            <p class="winner-sub" style="color:#9a907b;">The battle concludes</p>
            <p class="winner-name" style="color:#d1d5db;">IT'S A DRAW!</p>
            <p class="winner-flavor">Two sides of equal destiny.</p>
          {:else}
            <p class="winner-sub" style="color:{wc};">{is1v1 ? 'Victory' : winner === 'team1' ? 'Team 1 Victory' : 'Team 2 Victory'}</p>
            <p class="winner-name" style="color:{wc};filter:drop-shadow(0 0 14px {wc}55);">{winLabel} WINS!</p>
            <p class="winner-flavor">Fate has spoken.</p>
            {#if is1v1}
              {#if saveStatus === 'saving'}
                <p class="save-line" style="color:#9a907b;">Saving to champions record…</p>
              {:else if saveStatus === 'saved'}
                <div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:10px;">
                  <span class="material-symbols-outlined" style="font-size:13px;color:#34d399;font-variation-settings:'FILL' 1;">check_circle</span>
                  <p class="save-line" style="color:#34d399;">Saved — {savedWins} rival win{savedWins!==1?'s':''} total</p>
                </div>
              {:else if saveStatus === 'error'}
                <p class="save-line" style="color:#f87171;">Could not save — server unavailable.</p>
              {/if}
            {:else}
              <p class="save-line" style="color:#4e4635;">Win records not tracked for team battles.</p>
            {/if}
          {/if}
        </div>

        <div style="display:flex;gap:0.75rem;justify-content:center;margin-top:1rem;">
          <button onclick={onRematch} class="btn-action" style="color:#f9a8d4;border-color:#9d174d;box-shadow:0 0 16px rgba(157,23,77,0.15);">⚔ Rematch</button>
          <button onclick={onBackToMenu} class="btn-action" style="color:#9a907b;border-color:#4e4635;">Characters</button>
        </div>
      {/if}

    </div><!-- /center-col -->

    <!-- ── Team 2 (right) ── -->
    <div bind:this={t2PanelEl} class="team-col">
      {#if !is1v1}
        <p class="team-label" style="color:#e879f9;border-bottom:1px solid rgba(232,121,249,0.2);">Team 2</p>
      {/if}
      {#each t2Chars as char, i}
        {@const hp   = t2DispHp[i] ?? 0}
        {@const pct  = t2HpPct[i] ?? 0}
        {@const dead = hp <= 0}
        {@const won  = phase === 'result' && winner === 'team2'}
        {@const lost = phase === 'result' && winner === 'team1'}
        <div class="member-card" style="border-color:rgba(232,121,249,{dead?'0.07':won?'0.7':'0.22'});box-shadow:0 8px 24px rgba(0,0,0,0.7),inset 1px 1px 0 rgba(232,121,249,0.06){won&&!dead?',0 0 28px rgba(232,121,249,0.22)':''};opacity:{dead?0.4:1};">
          <div class="flex items-center gap-1.5 min-w-0">
            {#if dead}<span class="material-symbols-outlined" style="font-size:13px;color:#ef4444;font-variation-settings:'FILL' 1;">skull</span>
            {:else if won}<span class="material-symbols-outlined" style="font-size:13px;color:#e879f9;font-variation-settings:'FILL' 1;">workspace_premium</span>
            {:else if lost}<span class="material-symbols-outlined" style="font-size:13px;color:#ef4444;font-variation-settings:'FILL' 1;">skull</span>
            {/if}
            <p class="font-bold truncate" style="font-family:'Cinzel',serif;color:#e879f9;font-size:{is1v1?'0.9rem':'0.78rem'};">{char.name}</p>
          </div>
          <p class="truncate" style="font-family:'JetBrains Mono',monospace;color:#9a907b;font-size:0.65rem;">{char.raceLabel} · {char.archetypeLabel}</p>
          <div class="hp-track"><div class="hp-fill" style="width:{pct*100}%;background:{hpColor(pct)};"></div></div>
          <p style="font-family:'JetBrains Mono',monospace;color:{hpColor(pct)};font-size:0.65rem;">{formatHp(hp)}<span style="color:#4e4635;"> / {formatHp(char.maxHp)}</span></p>
          {#if is1v1}
            <div class="stat-row">
              {#each [['ATK',formatHp(char.physicalDamage)],['DEF',Math.round(char.armorReduction*100)+'%'],['INIT',Math.round(char.initiative)]] as [l,v]}
                <div class="stat-chip" style="border-color:rgba(232,121,249,0.12);">
                  <p style="color:#9a907b;font-size:7px;">{l}</p>
                  <p style="color:#e879f9;font-size:0.68rem;font-family:'Cinzel',serif;">{v}</p>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
      <!-- Status badges T2 -->
      {#if t2StatusBadges.length > 0}
        <div class="status-badges">
          {#each t2StatusBadges as badge}<span class="status-badge">{badge}</span>{/each}
        </div>
      {/if}
    </div>

  </div><!-- /battle-grid -->

</div><!-- /battle-root -->

<style>
  /* ── Arena root — runic battlefield ── */
  .battle-root {
    width: 100%;
    min-height: 100vh;
    max-width: 1100px;
    margin: 0 auto;
    position: relative;
    isolation: isolate;
    overflow-x: hidden;
    /* Contain layout only — 'paint' would clip flying particles to the
       .battle-root box and chop their tail off. We pay a little extra paint
       area but FX animations no longer look cut off at the panel edges. */
    contain: layout;
    /* Stone-floor grid: fine rune lines + cardinal vein */
    background-image:
      radial-gradient(ellipse 70% 30% at 50% 0%,   rgba(200,136,42,0.08) 0%, transparent 70%),
      radial-gradient(ellipse 70% 30% at 50% 100%, rgba(138,60,200,0.06) 0%, transparent 70%),
      linear-gradient(rgba(200,136,42,0.022) 1px, transparent 1px),
      linear-gradient(90deg, rgba(200,136,42,0.022) 1px, transparent 1px),
      linear-gradient(rgba(200,136,42,0.055) 1px, transparent 1px),
      linear-gradient(90deg, rgba(200,136,42,0.055) 1px, transparent 1px);
    background-size:
      100% 100%, 100% 100%,
      40px 40px, 40px 40px,
      200px 200px, 200px 200px;
  }

  .battle-grid {
    display: grid;
    grid-template-columns: 220px 1fr 220px;
    gap: 0.75rem;
    align-items: start;
  }
  @media (max-width: 700px) {
    .battle-grid { grid-template-columns: 1fr; }
  }

  /* ── Team columns — stone fortress bastions ── */
  .team-col {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.5rem;
    border-radius: 14px;
    position: relative;
    transition: box-shadow 0.35s;
    /* Bastion wall glow */
    background: linear-gradient(180deg, rgba(26,20,48,0.4) 0%, rgba(10,8,18,0.6) 100%);
    border: 1px solid rgba(200,136,42,0.08);
    box-shadow: inset 0 1px 0 rgba(255,225,140,0.04);
  }

  .team-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.60rem;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    text-align: center;
    padding-bottom: 6px;
    margin-bottom: 2px;
    /* Runic separator line */
    border-bottom: 1px solid rgba(200,136,42,0.12);
    text-shadow: 0 0 10px currentColor;
  }

  /* Member card — carved obsidian tablet */
  .member-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px;
    border-radius: 10px;
    border: 1px solid;
    background: linear-gradient(160deg, #1c1730 0%, #100d1e 60%, #09070f 100%);
    box-shadow:
      0 6px 0 #06040e,
      0 9px 0 #040309,
      0 14px 28px rgba(0,0,0,0.85),
      inset 0 1px 0 rgba(255,225,140,0.08),
      inset 1px 0 0 rgba(255,225,140,0.04);
    transition: opacity 0.6s, box-shadow 0.5s, border-color 0.5s;
    /* Subtle noise texture */
    position: relative;
  }

  /* HP track — carved channel */
  .hp-track {
    height: 8px;
    border-radius: 99px;
    overflow: hidden;
    background: #04030a;
    box-shadow:
      inset 3px 2px 6px rgba(0,0,0,0.90),
      inset 0 0 0 1px rgba(0,0,0,0.5);
  }
  .hp-fill {
    height: 100%;
    border-radius: 99px;
    filter: brightness(1.18) saturate(1.1);
    transition: width 0.9s ease-out, background 0.5s;
    box-shadow: 0 0 6px currentColor;
  }

  .stat-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 3px;
    margin-top: 3px;
  }
  /* Stat chip — small carved stone chip */
  .stat-chip {
    text-align: center;
    padding: 3px 2px;
    border-radius: 5px;
    border: 1px solid;
    background: rgba(0,0,0,0.35);
    box-shadow: inset 1px 1px 3px rgba(0,0,0,0.6);
  }

  /* Status badges */
  .status-badges {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    padding: 4px 2px 0;
  }
  .status-badge {
    font-size: 1rem;
    filter: drop-shadow(0 0 7px rgba(255,255,255,0.5));
    animation: badgePop 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards;
  }
  @keyframes badgePop {
    0%   { opacity: 0; transform: scale(0.4) rotate(-15deg); }
    70%  { transform: scale(1.2) rotate(3deg); }
    100% { opacity: 1; transform: scale(1.0) rotate(0deg); }
  }

  /* ── Center column — the arena sanctum ── */
  .center-col {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  /* Battle log — arcane scrying stone */
  .log-box {
    border: 1px solid rgba(200,136,42,0.14);
    border-top-color: rgba(200,136,42,0.22);
    border-radius: 14px;
    overflow: hidden;
    background: linear-gradient(165deg, #14112a 0%, #0a0815 100%);
    box-shadow:
      0 0 0 1px rgba(200,136,42,0.06),
      0 4px 0 #04030a,
      0 8px 0 #030208,
      0 18px 50px rgba(0,0,0,0.92),
      inset 0 1px 0 rgba(255,225,140,0.10),
      inset 0 -1px 0 rgba(0,0,0,0.5);
    position: relative;
  }
  /* Animated rune border on the log box */
  .log-box::before {
    content: '';
    position: absolute;
    top: -1px; left: 0; right: 0;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(200,136,42,0.8) 30%,
      rgba(72,200,224,0.7) 55%,
      rgba(200,136,42,0.8) 75%,
      transparent 100%
    );
    background-size: 300% 100%;
    animation: runeFlow 5s linear infinite;
    pointer-events: none;
  }

  .log-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 14px;
    border-bottom: 1px solid rgba(200,136,42,0.09);
    background: rgba(0,0,0,0.2);
  }
  .log-scroll {
    overflow-y: auto;
    padding: 10px 14px;
    max-height: 420px;
    scroll-behavior: smooth;
  }
  .log-round-header {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.66rem;
    color: #806020;
    letter-spacing: 0.14em;
    border-bottom: 1px solid rgba(200,136,42,0.09);
    padding: 10px 0 4px;
    margin-bottom: 2px;
    text-shadow: 0 0 8px rgba(200,136,42,0.35);
  }
  .log-line {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.67rem;
    margin-bottom: 3px;
    line-height: 1.45;
  }
  .log-italic { color: #685440; font-style: italic; }

  /* Winner announcement — raised gold victory tablet */
  .winner-box {
    border: 1px solid;
    border-radius: 18px;
    padding: 1.5rem 1rem;
    text-align: center;
    animation: resultReveal 0.65s cubic-bezier(0.34,1.56,0.64,1) forwards;
    position: relative;
    overflow: hidden;
  }
  .winner-box::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      rgba(200,136,42,0.0) 0%,
      rgba(200,136,42,0.6) 30%,
      rgba(72,200,224,0.5) 55%,
      rgba(200,136,42,0.6) 75%,
      rgba(200,136,42,0.0) 100%
    );
    background-size: 300% 100%;
    animation: runeFlow 4s linear infinite;
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    padding: 1px;
    border-radius: inherit;
    pointer-events: none;
  }
  .winner-sub   { font-family:'JetBrains Mono',monospace; font-size:0.62rem; letter-spacing:0.24em; text-transform:uppercase; margin-bottom:6px; color:#806020; }
  .winner-name  { font-family:'Cinzel',serif; font-size:clamp(1.3rem,4vw,1.9rem); font-weight:900; letter-spacing:0.12em; }
  .winner-flavor{ font-size:0.78rem; color:#685440; margin-top:6px; }
  .save-line    { font-family:'JetBrains Mono',monospace; font-size:0.68rem; margin-top:8px; }

  /* Action button — carved rune button */
  .btn-action {
    font-family: 'Cinzel', serif;
    font-size: 0.78rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    font-weight: 700;
    padding: 10px 22px;
    border-radius: 9px;
    background: linear-gradient(160deg, #1c1730 0%, #0e0b1c 100%);
    border: 1px solid rgba(200,136,42,0.30);
    border-top-color: rgba(200,136,42,0.45);
    cursor: pointer;
    transition: transform 0.10s, box-shadow 0.15s, border-color 0.15s;
    box-shadow:
      0 3px 0 #04030a,
      0 6px 16px rgba(0,0,0,0.7),
      inset 0 1px 0 rgba(255,225,140,0.08);
  }
  .btn-action:hover {
    border-color: rgba(200,136,42,0.55);
    box-shadow:
      0 3px 0 #04030a,
      0 6px 20px rgba(0,0,0,0.7),
      0 0 12px rgba(200,136,42,0.12),
      inset 0 1px 0 rgba(255,225,140,0.12);
  }
  .btn-action:active {
    transform: translateY(3px);
    box-shadow: 0 1px 0 #04030a, 0 4px 8px rgba(0,0,0,0.6);
  }

  /* ── Particles ── */
  :global(.particle) {
    position: fixed; pointer-events: none; z-index: 9999;
    font-family: 'Cinzel', serif; font-weight: 900;
    animation: particleRise 1.3s ease-out forwards;
    white-space: nowrap;
    text-shadow: 0 0 8px currentColor;
  }
  :global(.ambient-particle) {
    position: fixed; pointer-events: none; z-index: 100;
    animation: ambientFloat 2.8s ease-out forwards;
    white-space: nowrap;
  }
  :global(.confetti-particle) {
    position: fixed; pointer-events: none; z-index: 9999;
    font-weight: 900;
    animation: confettiFall 3.5s linear forwards;
    white-space: nowrap;
  }
  :global(.trail-particle) {
    position: fixed; pointer-events: none; z-index: 9997;
    animation: trailFade 0.32s ease-out forwards;
    white-space: nowrap;
  }
  @keyframes trailFade {
    0%   { opacity: 0.9; transform: scale(1.1); }
    60%  { opacity: 0.5; transform: scale(0.8); }
    100% { opacity: 0;   transform: scale(0.3) translateY(-6px); }
  }
  @keyframes particleRise {
    0%   { opacity: 1;   transform: translateY(0)      scale(1); }
    55%  { opacity: 0.9; transform: translateY(-58px)  scale(1.18); }
    100% { opacity: 0;   transform: translateY(-115px) scale(0.65); }
  }
  @keyframes ambientFloat {
    0%   { opacity: 0;    transform: translateY(0)     scale(0.8); }
    15%  { opacity: 0.65; }
    85%  { opacity: 0.35; transform: translateY(-84px) scale(1); }
    100% { opacity: 0;    transform: translateY(-115px) scale(0.9); }
  }
  @keyframes confettiFall {
    0%   { opacity: 1;   transform: translateY(0)    rotate(0deg)   scale(1); }
    25%  { opacity: 0.9; transform: translateY(25vh) rotate(180deg) translateX(15px); }
    50%  { opacity: 0.8; transform: translateY(50vh) rotate(360deg) translateX(-12px); }
    75%  { opacity: 0.5; transform: translateY(75vh) rotate(540deg) translateX(8px); }
    100% { opacity: 0;   transform: translateY(106vh) rotate(720deg) scale(0.5); }
  }

  /* ── Screen shake ── */
  :global(.fx-shake-light) { animation: shakeLight 0.46s ease-out; }
  :global(.fx-shake-heavy) { animation: shakeHeavy 0.54s ease-out; }
  @keyframes shakeLight {
    0%,100% { transform: translate(0); }
    20% { transform: translate(-6px, 2px); }
    40% { transform: translate(6px,-2px); }
    60% { transform: translate(-4px, 3px); }
    80% { transform: translate(4px,-1px); }
  }
  @keyframes shakeHeavy {
    0%,100% { transform: translate(0) rotate(0deg); }
    10% { transform: translate(-12px, 5px) rotate(-0.6deg); }
    20% { transform: translate(12px,-5px) rotate(0.6deg); }
    30% { transform: translate(-9px, 9px) rotate(-0.4deg); }
    40% { transform: translate(9px,-9px) rotate(0.4deg); }
    55% { transform: translate(-5px, 5px); }
    70% { transform: translate(5px,-3px); }
    85% { transform: translate(-2px, 2px); }
  }

  /* ── Panel flash effects ── */
  :global(.fx-flash-hit)   { animation: flashHit   0.42s ease-out; }
  :global(.fx-flash-crit)  { animation: flashCrit  0.52s ease-out; }
  :global(.fx-flash-heal)  { animation: flashHeal  0.52s ease-out; }
  :global(.fx-flash-death) { animation: flashDeath 0.65s ease-out; }

  @keyframes flashHit {
    0%   { box-shadow: none; }
    25%  { box-shadow: inset 0 0 36px rgba(224,64,48,0.50), 0 0 28px rgba(224,64,48,0.35), 0 0 0 1px rgba(224,64,48,0.2); }
    100% { box-shadow: none; }
  }
  @keyframes flashCrit {
    0%   { box-shadow: none; background-color: transparent; }
    12%  {
      box-shadow:
        inset 0 0 60px rgba(232,184,75,0.55),
        0 0 60px rgba(232,184,75,0.55),
        0 0 0 2px rgba(232,184,75,0.3);
      background-color: rgba(232,184,75,0.07);
    }
    100% { box-shadow: none; background-color: transparent; }
  }
  @keyframes flashHeal {
    0%   { box-shadow: none; }
    25%  { box-shadow: inset 0 0 36px rgba(52,211,153,0.45), 0 0 28px rgba(52,211,153,0.35), 0 0 0 1px rgba(52,211,153,0.2); }
    100% { box-shadow: none; }
  }
  @keyframes flashDeath {
    0%   { box-shadow: none; }
    18%  { box-shadow: inset 0 0 70px rgba(200,48,30,0.65), 0 0 70px rgba(200,48,30,0.45), 0 0 0 2px rgba(200,48,30,0.3); }
    100% { box-shadow: none; }
  }

  /* ── Impact rings ── */
  :global(.impact-ring) {
    position: fixed;
    width: 14px; height: 14px;
    border-radius: 50%;
    border: 3px solid rgba(232,184,75,0.95);
    pointer-events: none;
    z-index: 9998;
    transform: translate(-50%, -50%);
    animation: impactRingAnim 0.72s ease-out forwards;
    box-shadow: 0 0 8px rgba(232,184,75,0.6);
  }
  @keyframes impactRingAnim {
    0%   { width: 14px;  height: 14px;  opacity: 1.0;  border-width: 3px; }
    50%  { opacity: 0.6; }
    100% { width: 140px; height: 140px; opacity: 0;    border-width: 1px; }
  }

  /* ── Speed lines ── */
  :global(.speed-lines-overlay) {
    position: fixed; inset: 0;
    pointer-events: none; z-index: 150;
    overflow: hidden; opacity: 0;
  }
  :global(.speed-lines-active) { animation: speedLinesReveal 0.26s ease-out forwards; }
  :global(.speed-line) {
    position: absolute;
    left: -100%; right: -100%;
    height: 1px;
    background: linear-gradient(90deg,
      transparent 0%,
      rgba(232,184,75,0.18) 25%,
      rgba(255,255,255,0.30) 50%,
      rgba(232,184,75,0.18) 75%,
      transparent 100%);
    animation: speedLineMove 0.26s ease-out forwards;
    opacity: 0;
  }
  @keyframes speedLinesReveal { 0% { opacity: 1; } 100% { opacity: 0; } }
  @keyframes speedLineMove {
    0%   { opacity: 0; transform: translateX(-40%); }
    22%  { opacity: 1; }
    100% { opacity: 0; transform: translateX(40%); }
  }

  /* ── Screen flash overlays ── */
  :global(.screen-flash-overlay) {
    position: fixed; inset: 0;
    pointer-events: none; z-index: 200;
    animation: screenFlashCrit 0.24s ease-out forwards;
  }
  @keyframes screenFlashCrit {
    0%   { background: rgba(232,184,75,0.18); }
    35%  { background: rgba(232,184,75,0.24); }
    100% { background: transparent; }
  }
  :global(.death-flash-overlay) {
    position: fixed; inset: 0;
    pointer-events: none; z-index: 200;
    animation: deathFlashFull 0.65s ease-out forwards;
  }
  @keyframes deathFlashFull {
    0%   { background: transparent; }
    18%  { background: rgba(200,48,30,0.32); }
    100% { background: transparent; }
  }

  /* ── Vignette ── */
  :global(.vignette-overlay) {
    position: fixed; inset: 0;
    pointer-events: none; z-index: 50;
    box-shadow: none;
    transition: box-shadow 0.8s;
  }
  :global(.vignette-active) {
    box-shadow: inset 0 0 100px rgba(200,48,30,0.20);
    animation: vignettePulse 2.2s ease-in-out infinite;
  }
  @keyframes vignettePulse {
    0%, 100% { box-shadow: inset 0 0 80px rgba(200,48,30,0.14); }
    50%       { box-shadow: inset 0 0 130px rgba(200,48,30,0.32); }
  }

  /* ── Round banner — runic proclamation ── */
  :global(.round-banner) {
    position: fixed;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    font-family: 'Cinzel', serif;
    font-size: clamp(1.6rem, 5vw, 2.6rem);
    font-weight: 900;
    color: #e8b84b;
    letter-spacing: 0.38em;
    text-transform: uppercase;
    text-shadow:
      0 0 20px rgba(200,136,42,0.9),
      0 0 50px rgba(200,136,42,0.5),
      0 0 90px rgba(200,136,42,0.2),
      0 2px 0 rgba(0,0,0,0.9);
    pointer-events: none;
    z-index: 9990;
    animation: roundBannerAnim 0.85s ease-out forwards;
  }
  @keyframes roundBannerAnim {
    0%   { opacity: 0; transform: translate(-50%, -50%) scale(1.7) rotate(-2deg); }
    22%  { opacity: 1; transform: translate(-50%, -50%) scale(1.0) rotate(0deg); }
    68%  { opacity: 1; transform: translate(-50%, -50%) scale(1.0); }
    100% { opacity: 0; transform: translate(-50%, -50%) scale(0.82) translateY(-12px); }
  }

  /* ── Center text (COMBO / BERSERK) ── */
  :global(.center-text-display) {
    position: fixed;
    top: 42%; left: 50%;
    transform: translate(-50%, -50%);
    font-family: 'Cinzel', serif;
    font-size: clamp(1.8rem, 6vw, 3.2rem);
    font-weight: 900;
    letter-spacing: 0.28em;
    pointer-events: none;
    z-index: 9991;
    animation: centerTextPop 1.25s ease-out forwards;
    filter: drop-shadow(0 0 20px currentColor);
  }
  @keyframes centerTextPop {
    0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.35) rotate(-10deg); }
    16%  { opacity: 1; transform: translate(-50%, -50%) scale(1.30)  rotate(2deg); }
    32%  { opacity: 1; transform: translate(-50%, -50%) scale(1.00)  rotate(0deg); }
    72%  { opacity: 1; transform: translate(-50%, -50%) scale(1.00); }
    100% { opacity: 0; transform: translate(-50%, -50%) scale(0.78) translateY(-22px); }
  }

  @keyframes runeFlow {
    0%   { background-position: 0% 50%; }
    50%  { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
</style>
