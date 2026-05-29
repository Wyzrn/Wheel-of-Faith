<script lang="ts">
  import { onMount } from 'svelte'
  import { gsap } from 'gsap'
  import { slicePath, weightedSegmentAngles } from '$lib/game/geometry'
  import { weightedRandom } from '$lib/game/random'
  import type { WeightedSegment, SpinStatus } from '$lib/session/types'
  import { effectsMultiplier, effectiveDpr, getPerfTier } from '$lib/perf'
  import { rootZoom } from '$lib/zoom'
  import LandingCelebration from './LandingCelebration.svelte'

  const SVG_SIZE = 500
  const CENTER = SVG_SIZE / 2          // 250
  const SVG_CENTER = `${CENTER} ${CENTER}`
  const WHEEL_RADIUS = 230
  const POINTER_SIZE = 24

  // Cursed Wheel gamepass — jagged spike ring drawn around the rim. Each spike
  // is a triangle: two base points on the inner circle, one tip on the outer.
  function buildSpikeRing(inner: number, outer: number, count: number): string {
    let d = ''
    for (let i = 0; i < count; i++) {
      const a0 = (i / count) * 2 * Math.PI
      const a1 = ((i + 0.5) / count) * 2 * Math.PI
      const a2 = ((i + 1) / count) * 2 * Math.PI
      const x0 = CENTER + inner * Math.cos(a0), y0 = CENTER + inner * Math.sin(a0)
      const xt = CENTER + outer * Math.cos(a1), yt = CENTER + outer * Math.sin(a1)
      const x2 = CENTER + inner * Math.cos(a2), y2 = CENTER + inner * Math.sin(a2)
      d += `M ${x0.toFixed(1)} ${y0.toFixed(1)} L ${xt.toFixed(1)} ${yt.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)} Z `
    }
    return d
  }
  const CURSED_SPIKES_LONG  = buildSpikeRing(WHEEL_RADIUS + 2, WHEEL_RADIUS + 30, 28)
  const CURSED_SPIKES_SHORT = buildSpikeRing(WHEEL_RADIUS + 2, WHEEL_RADIUS + 16, 56)

  // Pointer geometry — computed from wheel constants
  const PTR_TIP_Y   = CENTER - WHEEL_RADIUS - 3   // 17  blade tip (at wheel rim)
  const PTR_BASE_Y  = PTR_TIP_Y - 28              // -11 guard bottom
  const PTR_GUARD_Y = PTR_BASE_Y - 7              // -18 guard top
  const PTR_POMMEL  = PTR_GUARD_Y - 11            // -29 pommel apex
  const PTR_GW      = 22                          // guard half-width

  const COLORS = ['#E63946','#457B9D','#2A9D8F','#E9C46A','#F4A261','#264653','#6A0572','#0077B6']

  let { segments, onSpinComplete, categoryHue = undefined, soundEnabled = true, effectsEnabled = true, spinSpeedMultiplier = 1.0, wheelTheme = undefined, spinTrigger = 0, replayTrigger = 0, resolveLandingColors, onLanded, wheelSignature = null }: {
    segments: WeightedSegment[]
    onSpinComplete: (resultIndex: number, resultLabel: string) => void
    // Fires when the wheel finishes landing, just BEFORE celebration mounts
    // and BEFORE the reveal panel is allowed to show. Parent uses the
    // viewport-pixel coords to anchor the reveal modal over the wheel
    // instead of over the screen center. Null centerX/Y when the SVG
    // ref isn't measurable.
    onLanded?: (info: { centerX: number | null; centerY: number | null }) => void
    categoryHue?: number
    soundEnabled?: boolean
    effectsEnabled?: boolean
    spinSpeedMultiplier?: number
    wheelTheme?: import('$lib/wheelThemes').WheelTheme
    spinTrigger?: number
    // Per-race visual signature. When set to a race label, the SVG root
    // gets a matching .wheel-sig-* class that applies a bespoke CSS
    // treatment (Eldritch glitches, Fire Genasi heat distortion, Air
    // Genasi floating wheel, etc.). Set after the race spin lands and
    // cleared between sessions. Null = standard wheel.
    wheelSignature?: string | null
    // Increment to re-fire the most recent celebration (Replay button on
    // the reveal panel). No-op if no prior celebration was captured.
    replayTrigger?: number
    // Optional. Lets the host (main game / story) resolve the celebration's
    // element color + tier color + intensity for the landed segment. Without
    // it, we fall back to tier intensity guessed from segment.tier. Returns
    // null to suppress the celebration overlay (used by tutorial flows that
    // drive their own pacing).
    //
    // intensityOverride: 0..1; when provided overrides the tier-based scalar.
    // Use it for item spins so a God-tier weapon triggers mythic celebration
    // even though the segment carries no TierGrade.
    //
    // subtitle: shown under the mythic banner (e.g. "S+ TIER" or "Sea King").
    resolveLandingColors?: (resultIndex: number, label: string) => {
      tier?: string | null
      tierColor?: string | null
      elementColor?: string | null
      intensityOverride?: number
      subtitle?: string | null
    } | null
  } = $props()

  // ── Landing celebration overlay state ──────────────────────────────────────
  // Set in the spin's onComplete; LandingCelebration is mounted as a fixed
  // overlay until it self-completes and clears this. Center coords are
  // captured from svgEl.getBoundingClientRect() at landing time so emanating
  // VFX layers (particles, rings, lens flare, portal, sky pillar) burst
  // from the actual wheel center instead of viewport center — important
  // on desktop where the wheel sits in the right column.
  let celebration = $state<{
    key: number
    intensity: number
    tierColor: string
    elementColor: string | null
    tier: string | null
    subtitle: string | null
    centerX: number | null
    centerY: number | null
  } | null>(null)
  let celebrationKey = 0
  // Cached spec from the most recent celebration — used by Replay so the
  // player can re-watch the VFX without re-spinning the wheel.
  let lastCelebration: typeof celebration = null

  // Replay trigger — when the parent's counter increments, re-fire the
  // most-recently captured celebration spec. The lc-root component
  // unmounts when its onComplete fires; the key bump here guarantees the
  // new mount runs its animations fresh. prevReplayTrigger initialized
  // to the current value inside the effect (not at declaration) so we
  // don't capture a stale snapshot of the prop.
  let prevReplayTrigger = $state(0)
  let _replayInit = false
  $effect(() => {
    const t = replayTrigger
    if (!_replayInit) {
      _replayInit = true
      prevReplayTrigger = t
      return
    }
    if (t !== prevReplayTrigger) {
      prevReplayTrigger = t
      if (lastCelebration) {
        celebration = { ...lastCelebration, key: ++celebrationKey }
      }
    }
  })

  let spinStatus = $state<SpinStatus>('IDLE')
  let currentRotation = $state(Math.random() * 360)
  let lastResult = $state<{ index: number; label: string } | null>(null)
  // Snapshot taken at spin start — prevents post-spin segment mutations (dimming, weight
  // changes from usedRacialAbilities etc.) from shifting arc positions while the wheel is
  // frozen at targetAngle, which would misalign the pointer with the winning segment.
  let frozenSegments = $state<typeof segments | null>(null)

  let canSpin = $derived(spinStatus === 'IDLE')
  // True when a cosmetic wheel skin is active (not the default vanilla wheel).
  let _hasTheme = $derived(!!wheelTheme && wheelTheme.id !== 'default')
  let isRevealed = $derived(spinStatus === 'REVEALED')
  let activeSegments = $derived(frozenSegments ?? segments)
  // Only allocate a new displaySegments array when there is at least one dimmed segment
  // with weight < 1. Otherwise reuse the existing reference (most spins have no dimmed
  // segments, so this avoids per-tick allocation while a parent re-render fires).
  let displaySegments = $derived.by(() => {
    let needsClone = false
    for (let i = 0; i < activeSegments.length; i++) {
      if (activeSegments[i].dimmed && activeSegments[i].weight < 1) { needsClone = true; break }
    }
    return needsClone
      ? activeSegments.map(s => s.dimmed && s.weight < 1 ? { ...s, weight: 1 } : s)
      : activeSegments
  })
  let segmentAngles = $derived(weightedSegmentAngles(displaySegments))
  let maxSegmentWeight = $derived.by(() => {
    let m = 1
    for (let i = 0; i < activeSegments.length; i++) {
      const s = activeSegments[i]
      if (!s.dimmed && s.weight > m) m = s.weight
    }
    return m
  })

  let wheelGroupEl: SVGGElement
  let shakeEl: HTMLDivElement
  let svgEl: SVGSVGElement
  let particleCanvas: HTMLCanvasElement
  let ctx: gsap.Context

  let spinTween: gsap.core.Tween | null = null
  let idleTween: gsap.core.Tween | null = null
  let shakeStartTime = 0

  // External spin trigger — incremented by parent to programmatically fire a spin
  let prevSpinTrigger = $state(0)
  let _spinTriggerInit = false
  $effect(() => {
    const t = spinTrigger
    if (!_spinTriggerInit) { _spinTriggerInit = true; prevSpinTrigger = t; return }
    if (t !== prevSpinTrigger) {
      prevSpinTrigger = t
      if (spinStatus === 'IDLE') handleSpin()
    }
  })

  // ── Web Audio ─────────────────────────────────────────────────────────────
  let audioCtx: AudioContext | null = null
  let lastTickRot = 0
  let lastTickAt  = 0   // AudioContext time of last tick; enforces 40ms rate limit

  // Haptic feedback — short pulse on each tick boundary. Gated by Vibration API
  // support (mobile only) and rate-limited so a long spin doesn't drain battery.
  // Browsers only honour vibrate() during/after a user gesture; the spin button
  // click is the gesture, so calls fired during the tween are allowed.
  const _supportsVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
  let _lastVibrateAt = 0
  function pulseHaptic(speed: number) {
    if (!_supportsVibrate) return
    const now = performance.now()
    if (now - _lastVibrateAt < 60) return  // ~16 pulses/sec max
    _lastVibrateAt = now
    try { navigator.vibrate(Math.round(4 + speed * 6)) } catch { /* unsupported */ }
  }
  function pulseHapticLanding(intensity: number = 0.5) {
    if (!_supportsVibrate) return
    // Scale pulse strength + count by tier intensity. F-tier: single 8ms tap.
    // SSS+: long burst with multiple beats so the player feels the gravity.
    const a = Math.round(10 + intensity * 14)       // 10–24ms
    const b = Math.round(20 + intensity * 30)       // 20–50ms pause
    const c = Math.round(16 + intensity * 32)       // 16–48ms
    const pattern = intensity >= 0.65 ? [a, b, c, b, c, b, a] : [a, b, c]
    try { navigator.vibrate(pattern) } catch { /* unsupported */ }
  }

  function getAudioCtx(): AudioContext | null {
    if (!audioCtx) {
      try { audioCtx = new AudioContext() } catch { return null }
    }
    if (audioCtx.state === 'suspended') audioCtx.resume()
    return audioCtx
  }

  function playTick(speed: number) {
    const ac = getAudioCtx()
    if (!ac) return
    const now = ac.currentTime
    if (now - lastTickAt < 0.04) return   // 40ms gate → max ~25 ticks/sec
    lastTickAt = now

    const dur  = 0.013
    const freq = 480 + speed * 200        // 480 Hz slow → 680 Hz fast

    // Triangle-wave ping with slight downward sweep — softer, more "ratchet tooth" feel
    const osc = ac.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(freq, now)
    osc.frequency.exponentialRampToValueAtTime(freq * 0.55, now + dur)
    const g = ac.createGain()
    g.gain.setValueAtTime(0.22, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + dur)
    osc.connect(g); g.connect(ac.destination)
    osc.start(now); osc.stop(now + dur + 0.002)

    // 3ms noise transient for attack definition without harsh body
    const nLen = Math.floor(ac.sampleRate * 0.003)
    const nBuf = ac.createBuffer(1, nLen, ac.sampleRate)
    const nd   = nBuf.getChannelData(0)
    for (let i = 0; i < nLen; i++) nd[i] = (Math.random() * 2 - 1) * (1 - i / nLen)
    const nSrc = ac.createBufferSource()
    nSrc.buffer = nBuf
    const ng = ac.createGain()
    ng.gain.value = 0.06
    nSrc.connect(ng); ng.connect(ac.destination)
    nSrc.start(now)
  }

  // Maps a tier label to an "intensity" score in [0, 1]. F-tier = 0, Infinite+ = 1.
  // Used to scale the landing animation, sound design, and haptic punch so a
  // mythic roll feels different from a C-tier roll. Stat-less wheels (race, etc.)
  // pass undefined and we default to mid (0.4). Infinite+N overflow tiers
  // saturate at 1.
  function tierIntensity(tier: string | undefined): number {
    if (!tier) return 0.4
    if (/^Infinite\+\d+$/.test(tier)) return 1
    const ladder = [
      'F-','F','F+','E-','E','E+','D-','D','D+','C-','C','C+',
      'B-','B','B+','A-','A','A+','S-','S','S+','SS-','SS','SS+',
      'SSS-','SSS','SSS+','Z-','Z','Z+','ZZ-','ZZ','ZZ+','ZZZ-','ZZZ','ZZZ+',
      'Cosmic-','Cosmic','Cosmic+','Immortal-','Immortal','Immortal+',
      'Celestial-','Celestial','Celestial+','Godly-','Godly','Godly+',
      'Primordial-','Primordial','Primordial+','Absolute-','Absolute','Absolute+',
      'Transcendent-','Transcendent','Transcendent+','Infinite-','Infinite','Infinite+',
    ]
    const idx = ladder.indexOf(tier)
    if (idx < 0) return 0.4
    return Math.min(1, idx / (ladder.length - 1))
  }

  function playLanding(tier?: string) {
    const ac = getAudioCtx()
    if (!ac) return
    const now = ac.currentTime
    const t = tierIntensity(tier)            // 0..1
    const gainScale  = 0.7 + t * 0.6         // 0.7..1.3 — louder for higher tiers
    const pitchScale = 0.85 + t * 0.5        // 0.85..1.35 — brighter for high tiers
    const sustainExt = 0.35 * t              // extra ring sustain on mythic rolls

    // Sub weight — adds physical mass to the hit. Bigger on high tiers.
    const sub = ac.createOscillator()
    const sg  = ac.createGain()
    sub.type = 'sine'
    sub.frequency.setValueAtTime(58 * pitchScale, now)
    sub.frequency.exponentialRampToValueAtTime(26, now + 0.13 + sustainExt * 0.5)
    sg.gain.setValueAtTime(0.9 * gainScale, now)
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.13 + sustainExt * 0.5)
    sub.connect(sg); sg.connect(ac.destination)
    sub.start(now); sub.stop(now + 0.15 + sustainExt)

    // Hollow knock — square wave gives a "clonk" wood/metal character vs the sine thud
    const knock = ac.createOscillator()
    const kg    = ac.createGain()
    knock.type = 'square'
    knock.frequency.setValueAtTime(290 * pitchScale, now)
    knock.frequency.exponentialRampToValueAtTime(185, now + 0.09)
    kg.gain.setValueAtTime(0.22 * gainScale, now)
    kg.gain.exponentialRampToValueAtTime(0.001, now + 0.11)
    knock.connect(kg); kg.connect(ac.destination)
    knock.start(now); knock.stop(now + 0.13)

    // Resonant ring — pure sine, sustains and fades like a struck bowl. Mythic
    // rolls get noticeably longer ring + a second harmonic for "celestial" feel.
    const ring = ac.createOscillator()
    const rg   = ac.createGain()
    ring.type = 'sine'
    ring.frequency.value = 430 * pitchScale
    rg.gain.setValueAtTime(0.32 * gainScale, now)
    rg.gain.exponentialRampToValueAtTime(0.001, now + 0.7 + sustainExt * 1.2)
    ring.connect(rg); rg.connect(ac.destination)
    ring.start(now); ring.stop(now + 0.72 + sustainExt * 1.5)

    // High attack sparkle — short bright ping on initial contact
    const spark = ac.createOscillator()
    const spg   = ac.createGain()
    spark.type = 'sine'
    spark.frequency.setValueAtTime(1450 * pitchScale, now)
    spark.frequency.exponentialRampToValueAtTime(880, now + 0.16)
    spg.gain.setValueAtTime(0.13 * gainScale, now)
    spg.gain.exponentialRampToValueAtTime(0.001, now + 0.19)
    spark.connect(spg); spg.connect(ac.destination)
    spark.start(now); spark.stop(now + 0.21)

    // Mythic+: add a fifth harmonic shimmer for "celestial chime" character.
    if (t >= 0.65) {
      const fifth = ac.createOscillator()
      const fg    = ac.createGain()
      fifth.type = 'sine'
      fifth.frequency.value = 645 * pitchScale
      fg.gain.setValueAtTime(0.10 * gainScale, now + 0.05)
      fg.gain.exponentialRampToValueAtTime(0.001, now + 1.0 + sustainExt)
      fifth.connect(fg); fg.connect(ac.destination)
      fifth.start(now + 0.05); fifth.stop(now + 1.1 + sustainExt)
    }
  }

  // Count how many segment boundaries the pointer swept through as rotation moved
  // from prevRot to currRot (currRot > prevRot always during a spin).
  // The pointer angle = ((-rotation) mod 360) decreases as rotation increases, so we
  // walk backward through the segment boundary angles.
  function countBordersCrossed(prevRot: number, currRot: number): number {
    const prevPA = ((-prevRot % 360) + 360) % 360
    const currPA = ((-currRot % 360) + 360) % 360
    let count = 0
    for (const seg of segmentAngles) {
      const b = seg.startDeg
      const crossed = (prevPA > currPA)
        ? (b >= currPA && b < prevPA)   // no 0-wrap: backward arc stays in one range
        : (b < prevPA || b >= currPA)   // 0-wrap: arc crossed through 0 → two ranges
      if (crossed) count++
    }
    return count
  }

  // ── Particle system ───────────────────────────────────────────────────────
  type Particle = {
    x: number; y: number
    vx: number; vy: number
    life: number   // 1 → 0
    size: number
    color: string
    isStar: boolean
  }

  const SPARKLE_COLORS = ['#f0c040', '#ffdf96', '#ffffff', '#ffd700', '#ff9f43', '#fff0a0', '#5ad6ef', '#b47aec', '#e8b84b']
  let particles: Particle[] = []
  let rafId: number | null = null
  let lastFrameTime = 0
  let prevGsapRot = 0
  let prevGsapTime = 0

  // Pointer tip in SVG coordinate space: (250, 17)
  const TIP_SVG_X = CENTER
  const TIP_SVG_Y = CENTER - WHEEL_RADIUS - 3

  // Convert SVG coordinate space to canvas pixel space.
  // Scale by the canvas's own pixel buffer dimensions — these are set from the
  // canvas element's own offsetWidth/offsetHeight (not the SVG's getBoundingClientRect,
  // which on iOS Safari can return the SVG *attribute* size 500×500 instead of
  // the CSS layout size, causing particles to spawn at the wrong position on mobile).
  function svgToCanvas(svgX: number, svgY: number): [number, number] {
    if (!particleCanvas) return [0, 0]
    return [
      (svgX / SVG_SIZE) * particleCanvas.width,
      (svgY / SVG_SIZE) * particleCanvas.height,
    ]
  }

  function resizeCanvas() {
    if (!particleCanvas) return
    // effectiveDpr caps at 1× on low-end, 1.5× on mid — cuts particle fillrate
    // by 50–75% on phones without changing visual layout.
    const dpr = effectiveDpr()
    particleCanvas.width  = Math.round(particleCanvas.offsetWidth  * dpr)
    particleCanvas.height = Math.round(particleCanvas.offsetHeight * dpr)
  }

  const _fxMult = effectsMultiplier()
  const _perfTier = getPerfTier()

  // Maps a race label to its wheel-signature CSS class. The class drives the
  // bespoke visual treatment authored in app.css — Eldritch wheel-glitches,
  // Fire Genasi heat distortion, Air Genasi floating wheel, etc. Null when
  // either the wheelSignature prop is unset or the race has no special
  // treatment (most races still use the default wheel look).
  function signatureClass(race: string | null | undefined): string {
    if (!race) return ''
    const map: Record<string, string> = {
      'Eldritch Being':  'wheel-sig-eldritch',
      'Creator':         'wheel-sig-creator',
      'Primordial':      'wheel-sig-primordial',
      'God':             'wheel-sig-god',
      'Time Lord':       'wheel-sig-timelord',
      'Vampire':         'wheel-sig-vampire',
      'Demon':           'wheel-sig-demon',
      'Genasi (Fire)':   'wheel-sig-fire-genasi',
      'Genasi (Water)':  'wheel-sig-water-genasi',
      'Genasi (Air)':    'wheel-sig-air-genasi',
      'Genasi (Earth)':  'wheel-sig-earth-genasi',
      'Saiyan':          'wheel-sig-saiyan',
      'Kryptonian':      'wheel-sig-kryptonian',
      'Viltrumite':      'wheel-sig-viltrumite',
      'Mindflayer':      'wheel-sig-mindflayer',
      'Hollow / Arrancar': 'wheel-sig-hollow',
      'Angel':           'wheel-sig-angel',
    }
    return map[race] ?? ''
  }
  let _wheelSigClass = $derived(signatureClass(wheelSignature))

  function spawnParticles(normalizedSpeed: number) {
    if (normalizedSpeed < 0.04 || !particleCanvas || !svgEl) return
    if (_perfTier === 'low') return  // skip particle spawn entirely on low-end
    const count = Math.ceil(normalizedSpeed * 6 * _fxMult)
    if (count <= 0) return
    const [tipX, tipY] = svgToCanvas(TIP_SVG_X, TIP_SVG_Y)
    const dpr = effectiveDpr()
    const jitter = 7 * dpr

    for (let i = 0; i < count; i++) {
      // Fan out in the lower semicircle (right → down → left) so sparks stay inside canvas.
      // randomising the arc gives a splash pattern.
      const angle = Math.random() * Math.PI
      const speed  = normalizedSpeed * (55 + Math.random() * 90) * dpr
      particles.push({
        x: tipX + (Math.random() - 0.5) * jitter,
        y: tipY + (Math.random() - 0.5) * jitter * 0.4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        size: Math.max(0.8, (0.9 + Math.random() * 2.4) * normalizedSpeed) * dpr,
        color: SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)],
        isStar: Math.random() < 0.80,
      })
    }
  }

  // Sharp 4-prong star (✦ shape): 4 long outer spikes, 4 narrow inner valleys.
  // inner ratio 0.15 gives very crisp, distinct prongs vs the old 0.38 (which was stubby).
  function drawStar(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
    const inner = r * 0.15
    c.beginPath()
    for (let i = 0; i < 8; i++) {
      // Align first prong pointing straight up (−π/2 offset)
      const a = (i * Math.PI) / 4 - Math.PI / 2
      const radius = i % 2 === 0 ? r : inner
      if (i === 0) c.moveTo(x + Math.cos(a) * radius, y + Math.sin(a) * radius)
      else         c.lineTo(x + Math.cos(a) * radius, y + Math.sin(a) * radius)
    }
    c.closePath()
    c.fill()
  }

  function tickParticles(now: number) {
    if (!particleCanvas) return
    const dt = Math.min(now - lastFrameTime, 50) / 1000  // cap delta, convert to seconds
    lastFrameTime = now

    const c = particleCanvas.getContext('2d')
    if (!c) return
    c.clearRect(0, 0, particleCanvas.width, particleCanvas.height)

    const dpr = effectiveDpr()
    const gravity = 200 * dpr  // pixels/s²

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      p.x  += p.vx * dt
      p.y  += p.vy * dt
      p.vy += gravity * dt
      p.life -= dt / 0.65   // ~650 ms lifetime

      if (p.life <= 0) { particles.splice(i, 1); continue }

      const alpha = Math.pow(Math.max(0, p.life), 1.3)
      c.save()
      c.globalAlpha = alpha
      c.fillStyle   = p.color
      c.shadowColor = p.color
      c.shadowBlur  = p.size * 3.5

      if (p.isStar) {
        drawStar(c, p.x, p.y, p.size * 1.6)
      } else {
        c.beginPath()
        c.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        c.fill()
      }
      c.restore()
    }
  }

  function startRaf() {
    if (rafId !== null) return
    lastFrameTime = performance.now()
    const loop = (now: number) => {
      tickParticles(now)
      if (particles.length > 0 || spinStatus === 'SPINNING') {
        rafId = requestAnimationFrame(loop)
      } else {
        rafId = null
      }
    }
    rafId = requestAnimationFrame(loop)
  }

  onMount(() => {
    ctx = gsap.context(() => {}, wheelGroupEl)
    // Snap to random starting angle, then begin slow idle rotation
    gsap.set(wheelGroupEl, { rotation: currentRotation, svgOrigin: SVG_CENTER, force3D: true })
    // Skip idle rotation on low-tier devices — running a 9s loop forever
    // burns GPU on mobile even when nothing else is happening. The wheel
    // sits static at its random starting angle until the player spins.
    if (_perfTier !== 'low') {
      idleTween = gsap.to(wheelGroupEl, {
        rotation: '+=360',
        duration: _perfTier === 'mid' ? 18 : 9,
        ease: 'none',
        repeat: -1,
        svgOrigin: SVG_CENTER,
        force3D: true,
      })
    }
    // Resize after first paint so the canvas has its final layout dimensions.
    // Observe the canvas element itself — its size is what we resize from,
    // and observing it avoids the iOS SVG getBoundingClientRect attribute bug.
    requestAnimationFrame(() => resizeCanvas())
    const ro = new ResizeObserver(() => requestAnimationFrame(resizeCanvas))
    if (particleCanvas) ro.observe(particleCanvas)
    return () => {
      ctx.revert()
      idleTween?.kill()
      ro.disconnect()
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  })

  function handleSpin() {
    if (spinStatus !== 'IDLE') return

    // Capture exact position from idle tween before killing it
    if (idleTween) {
      currentRotation = gsap.getProperty(wheelGroupEl, 'rotation') as number
      idleTween.kill()
      idleTween = null
    }

    const resultIndex = weightedRandom(segments)
    // Freeze the visual layout now so post-spin reactive mutations (dimming, weight
    // changes from usedRacialAbilities etc.) can't shift arc positions after the wheel stops.
    frozenSegments = [...segments]
    // Land at a random position within the segment (not always the midpoint).
    // Pad 10–20% from each edge to vary how close to segment borders we land.
    const seg     = segmentAngles[resultIndex]
    const span    = seg.endDeg - seg.startDeg
    const padding = span * (0.10 + Math.random() * 0.10)
    const landDeg = seg.startDeg + padding + Math.random() * (span - 2 * padding)
    const currentMod = currentRotation % 360
    const delta = ((360 - landDeg) - currentMod + 360) % 360
    const extraSpins = 5 + Math.floor(Math.random() * 10)   // 5–14 full rotations
    const targetAngle = currentRotation + (extraSpins * 360) + delta
    // Duration scales with spin count so more rotations feel physically longer.
    // Base 1.9s + 0.13s per extra rotation + up to 0.7s random variance.
    const duration = (1.9 + extraSpins * 0.13 + Math.random() * 0.7) / spinSpeedMultiplier

    spinStatus     = 'SPINNING'
    prevGsapRot    = currentRotation
    prevGsapTime   = performance.now()
    shakeStartTime = performance.now()
    lastTickRot    = currentRotation
    getAudioCtx()  // warm up AudioContext on the user gesture

    spinTween = gsap.to(wheelGroupEl, {
      rotation: targetAngle,
      duration,
      ease: 'power4.out',
      svgOrigin: SVG_CENTER,
      force3D: true,
      onStart: () => { startRaf() },
      onUpdate: () => {
        const now = performance.now()
        const rot = gsap.getProperty(wheelGroupEl, 'rotation') as number
        const dt  = now - prevGsapTime

        // ── Tick on segment boundary crossing (rate-limited inside playTick) ─
        const angVelDps = dt > 0 ? Math.abs(rot - prevGsapRot) / dt * 1000 : 0
        const speed     = Math.min(1, angVelDps / 4500)
        const crossed   = countBordersCrossed(lastTickRot, rot) > 0
        if (crossed) {
          if (soundEnabled) playTick(speed)
          if (effectsEnabled) pulseHaptic(speed)
        }
        lastTickRot = rot

        // ── Particles ──────────────────────────────────────────────────────
        if (effectsEnabled && dt > 0) {
          const normalized = Math.min(1, angVelDps / 4500)
          spawnParticles(normalized)
        }
        prevGsapRot  = rot
        prevGsapTime = now

        // ── Shake ──────────────────────────────────────────────────────────
        const progress  = spinTween?.progress() ?? 0
        const elapsed   = (now - shakeStartTime) / 1000
        const intensity = Math.pow(progress, 2) * 8
        const freq      = 7 + progress * 14
        const dx = Math.sin(elapsed * freq * Math.PI * 2) * intensity
        const dy = Math.sin(elapsed * freq * Math.PI * 2 * 0.7 + 1.1) * intensity * 0.4
        if (effectsEnabled && shakeEl) gsap.set(shakeEl, { x: dx, y: dy })
      },
      onComplete: () => {
        if (shakeEl) gsap.set(shakeEl, { x: 0, y: 0 })
        // Pull the landed segment's tier so we can scale audio/haptic intensity
        // — higher tiers feel more dramatic without explicit fanfare overlays.
        const landed = segments[resultIndex]
        const landedTier = (landed as { tier?: string }).tier
        const intensity = tierIntensity(landedTier)
        if (soundEnabled) playLanding(landedTier)
        if (effectsEnabled) pulseHapticLanding(intensity)

        // Mythic+: brief screen flash on the wheel itself to mark special rolls.
        if (effectsEnabled && intensity >= 0.65 && wheelGroupEl) {
          gsap.fromTo(wheelGroupEl,
            { filter: 'brightness(2.8) drop-shadow(0 0 24px rgba(255,223,150,0.9))' },
            { filter: 'brightness(1) drop-shadow(0 0 0 transparent)', duration: 0.9, ease: 'power3.out' })
        }

        // ── Capture wheel center in viewport pixels (fires every land) ────
        // The reveal modal anchors to these coords so it appears centered
        // OVER the wheel rather than at viewport center (main game's wheel
        // sits in a right column on desktop). svgEl is the bound <svg>
        // element; its bounding rect reflects current layout. Falls back
        // to null only if the SVG isn't mounted.
        let cx: number | null = null, cy: number | null = null
        if (svgEl) {
          const r = svgEl.getBoundingClientRect()
          // Divide by zoom: the rect is in post-zoom screen px, but the reveal
          // modal / celebration anchor these as pre-zoom local left/top.
          const z = rootZoom()
          cx = (r.left + r.width / 2) / z
          cy = (r.top + r.height / 2) / z
        }
        onLanded?.({ centerX: cx, centerY: cy })

        // ── Tier-scaled landing celebration overlay ──────────────────────
        // The host resolver can override intensity (grade-based for item
        // spins, weight-based for race/archetype). Anything ≥ 0.10 mounts —
        // even E-tier rolls get a small puff so EVERY spin has a payoff.
        let finalIntensity = intensity
        if (effectsEnabled) {
          const resolved = resolveLandingColors?.(resultIndex, landed.label)
          // Host can return null to suppress the overlay (e.g. tutorial pacing).
          if (resolved !== null) {
            finalIntensity = resolved?.intensityOverride ?? intensity
            if (finalIntensity >= 0.10) {
              celebration = {
                key: ++celebrationKey,
                intensity: finalIntensity,
                tierColor: resolved?.tierColor ?? '#f0c040',
                elementColor: resolved?.elementColor ?? null,
                tier: resolved?.tier ?? landedTier ?? null,
                subtitle: resolved?.subtitle ?? landedTier ?? null,
                centerX: cx,
                centerY: cy,
              }
              lastCelebration = celebration
            }
          }
        }

        currentRotation = targetAngle
        lastResult = { index: resultIndex, label: segments[resultIndex].label }
        spinStatus = 'LANDED'
        // GSAP swallows exceptions thrown inside onComplete. If the host's
        // handler throws, the wheel would land with no result reveal and no
        // way forward — so surface the error and still advance the status.
        try {
          onSpinComplete(resultIndex, segments[resultIndex].label)
        } catch (err) {
          console.error('onSpinComplete handler threw:', err)
        }
        // Pop the reveal card early — the celebration layers OVER the
        // card (z-60) so the player sees fireworks crash on top of the
        // result. Short delay just so the wheel finishes its landing
        // pin before the panel arrives.
        setTimeout(() => { spinStatus = 'REVEALED' }, 350)
      }
    })
  }
</script>

<div class="sw-root flex flex-col items-center gap-5 w-full mx-auto select-none" style="contain: layout style;">

  <!-- Shake wrapper — GSAP applies translate() here during spin -->
  <div bind:this={shakeEl} class="sw-stage flex justify-center w-full">
  <!-- Wheel + canvas wrapper — CSS Grid overlay so canvas and SVG share identical pixel bounds -->
  <div class="sw-wheel-box {_hasTheme ? wheelTheme!.cssClass : ''}" style="display: grid; width: clamp(280px, min(90vw, 85vh), 500px); max-width: 500px; aspect-ratio: 1/1; filter: {_perfTier === 'low' ? 'drop-shadow(0 0 24px rgba(0,0,0,0.85))' : `drop-shadow(0 0 48px rgba(0,0,0,0.97)) ${_hasTheme ? `drop-shadow(0 0 32px ${wheelTheme!.glow}) drop-shadow(0 0 16px ${wheelTheme!.glow})` : 'drop-shadow(0 0 24px rgba(240,192,64,0.34)) drop-shadow(0 0 12px rgba(90,214,239,0.15))'}`}; {_hasTheme && _perfTier !== 'low' ? 'animation: cursedPulse 3s ease-in-out infinite;' : ''}">
    <svg
      bind:this={svgEl}
      viewBox="0 0 {SVG_SIZE} {SVG_SIZE}"
      class={_wheelSigClass}
      style="grid-area: 1/1; width: 100%; height: 100%; overflow: visible;"
      aria-label="Spinning wheel"
      role="img"
    >
      <defs>
        <!-- Blade gradient: silver tip → deep gold base -->
        <linearGradient id="pointerGrad" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%"   stop-color="#d0c8a8" />
          <stop offset="20%"  stop-color="#ffdf96" />
          <stop offset="60%"  stop-color="#e8b84b" />
          <stop offset="100%" stop-color="#9a6a10" />
        </linearGradient>
        <!-- Guard / pommel gradient: bright top face → dark bottom -->
        <linearGradient id="guardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stop-color="#ffdf96" />
          <stop offset="100%" stop-color="#8a5e08" />
        </linearGradient>
        <!-- Hub background: deep purple-black stone -->
        <radialGradient id="hubGrad" cx="50%" cy="45%" r="55%">
          <stop offset="0%"   stop-color="#2e2244" />
          <stop offset="55%"  stop-color="#18112e" />
          <stop offset="100%" stop-color="#080612" />
        </radialGradient>
        <!-- Center gem: arcane teal jewel -->
        <radialGradient id="jewelGrad" cx="38%" cy="32%" r="58%">
          <stop offset="0%"   stop-color="#b8f0ff" />
          <stop offset="40%"  stop-color="#5ad6ef" />
          <stop offset="100%" stop-color="#0e4858" />
        </radialGradient>
        <!-- Vignette: edge darkening on wheel face -->
        <radialGradient id="vignetteGrad" cx="50%" cy="50%" r="50%">
          <stop offset="62%" stop-color="transparent" />
          <stop offset="100%" stop-color="rgba(0,0,0,0.52)" />
        </radialGradient>
        <!-- Subtle glow filter for rim ring + hub ring -->
        <filter id="runeGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <!-- Cursed Wheel — violet spike gradient + glow -->
        <!-- Cosmetic-wheel spike crown gradient — stops bound to the active
             theme (Cursed/Hellfire/Void use this; the rest skip the spikes). -->
        <radialGradient id="cursedSpikeGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stop-color={wheelTheme?.spikeStops?.[0] ?? '#3b1066'} />
          <stop offset="70%"  stop-color={wheelTheme?.spikeStops?.[1] ?? '#7c3aed'} />
          <stop offset="100%" stop-color={wheelTheme?.spikeStops?.[2] ?? '#c084fc'} />
        </radialGradient>
        <!-- Cosmetic-wheel inner aura — stops bound to the active theme. Sits
             OVER segments with screen blend so the underlying colors still read
             through. Pulsates via .cursed-inner-glow keyframes. -->
        <radialGradient id="cursedInnerGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stop-color={wheelTheme?.innerStops?.[0] ?? 'rgba(168,85,247,0)'} />
          <stop offset="55%"  stop-color={wheelTheme?.innerStops?.[1] ?? 'rgba(168,85,247,0.18)'} />
          <stop offset="85%"  stop-color={wheelTheme?.innerStops?.[2] ?? 'rgba(124,58,237,0.45)'} />
          <stop offset="100%" stop-color={wheelTheme?.innerStops?.[3] ?? 'rgba(59,16,102,0.6)'} />
        </radialGradient>
        <filter id="cursedGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <!-- Stronger glow for hub center jewel -->
        <filter id="hubGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <!--
          Post-mortal tier gradients — used by Cosmic-, Cosmic, Cosmic+, Immortal-,
          ..., Infinite+ segments. Each tier-group shares one gradient (the -/none/+
          subdivisions render with the same gradient on the wheel since they're
          visually indistinguishable at segment scale). Gradient stops mirror the
          --tier-*-grad CSS variables in app.css so the wheel and the rest of the
          UI agree on what each tier looks like.
        -->
        <linearGradient id="tg-cosmic" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stop-color="#083344" />
          <stop offset="35%"  stop-color="#0e7490" />
          <stop offset="65%"  stop-color="#0891b2" />
          <stop offset="100%" stop-color="#22d3ee" />
        </linearGradient>
        <linearGradient id="tg-immortal" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stop-color="#ef4444" />
          <stop offset="18%"  stop-color="#f97316" />
          <stop offset="36%"  stop-color="#eab308" />
          <stop offset="54%"  stop-color="#22c55e" />
          <stop offset="72%"  stop-color="#06b6d4" />
          <stop offset="88%"  stop-color="#6366f1" />
          <stop offset="100%" stop-color="#d946ef" />
        </linearGradient>
        <linearGradient id="tg-celestial" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stop-color="#500724" />
          <stop offset="35%"  stop-color="#831843" />
          <stop offset="70%"  stop-color="#be185d" />
          <stop offset="100%" stop-color="#db2777" />
        </linearGradient>
        <linearGradient id="tg-godly" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stop-color="#fce7f3" />
          <stop offset="25%"  stop-color="#fbcfe8" />
          <stop offset="55%"  stop-color="#f9a8d4" />
          <stop offset="100%" stop-color="#f472b6" />
        </linearGradient>
        <linearGradient id="tg-primordial" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stop-color="#71717a" />
          <stop offset="30%"  stop-color="#a1a1aa" />
          <stop offset="60%"  stop-color="#d4d4d8" />
          <stop offset="100%" stop-color="#ffffff" />
        </linearGradient>
        <linearGradient id="tg-absolute" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stop-color="#bae6fd" />
          <stop offset="35%"  stop-color="#7dd3fc" />
          <stop offset="70%"  stop-color="#38bdf8" />
          <stop offset="100%" stop-color="#0ea5e9" />
        </linearGradient>
        <linearGradient id="tg-transcendent" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stop-color="#ecfccb" />
          <stop offset="25%"  stop-color="#bef264" />
          <stop offset="60%"  stop-color="#84cc16" />
          <stop offset="100%" stop-color="#4d7c0f" />
        </linearGradient>
        <linearGradient id="tg-infinite" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stop-color="#fafafa" />
          <stop offset="20%"  stop-color="#a3a3a3" />
          <stop offset="50%"  stop-color="#404040" />
          <stop offset="75%"  stop-color="#171717" />
          <stop offset="100%" stop-color="#000000" />
        </linearGradient>
      </defs>

      {#if _hasTheme}
        {#if wheelTheme!.spikeStops}
          <!-- ── Themed jagged spike crown (Cursed / Hellfire / Void) ── -->
          <path d={CURSED_SPIKES_LONG} fill="url(#cursedSpikeGrad)" stroke="#0d0418" stroke-width="0.6"
                filter="url(#cursedGlow)" class="cursed-spikes-spin" opacity="0.95"
                style="animation-duration: {wheelTheme!.spikeSpinS ?? 20}s;" />
          <path d={CURSED_SPIKES_SHORT} fill={wheelTheme!.spikeStops[0]} stroke={wheelTheme!.rimAccent} stroke-width="0.4"
                class="cursed-spikes-spin-rev" opacity="0.8" />
        {/if}
        <!-- Themed rim ring set — colors pulled from the active theme. -->
        <circle cx={CENTER} cy={CENTER} r={WHEEL_RADIUS + 8}  fill="none" stroke={wheelTheme!.rimStroke} stroke-width="2.6" opacity="0.85" filter="url(#cursedGlow)" class="rune-ring-main" />
        <circle cx={CENTER} cy={CENTER} r={WHEEL_RADIUS + 3}  fill="none" stroke={wheelTheme!.rimAccent} stroke-width="1.0" opacity="0.45" />
        <circle cx={CENTER} cy={CENTER} r={WHEEL_RADIUS + 15} fill="none" stroke={wheelTheme!.rimStroke} stroke-width="0.7" opacity="0.3" stroke-dasharray="3 7" class="rune-ring-slow" />
      {:else}
        <!-- Outer decorative rings — layered bronze-gold rim with arcane ghost -->
        <circle cx={CENTER} cy={CENTER} r={WHEEL_RADIUS + 20} fill="none" stroke="#5ad6ef"  stroke-width="1.0" opacity="0.05" />
        <circle cx={CENTER} cy={CENTER} r={WHEEL_RADIUS + 14} fill="none" stroke="#e8b84b"  stroke-width="0.6" opacity="0.18" class="rune-ring-slow" />
        <circle cx={CENTER} cy={CENTER} r={WHEEL_RADIUS + 8}  fill="none" stroke="#f0c040"  stroke-width="2.2" opacity="0.70" filter="url(#runeGlow)" class="rune-ring-main" />
        <circle cx={CENTER} cy={CENTER} r={WHEEL_RADIUS + 4}  fill="none" stroke="#ffdf96"  stroke-width="1.0" opacity="0.40" />
        <circle cx={CENTER} cy={CENTER} r={WHEEL_RADIUS + 1}  fill="none" stroke="#b88d2a"  stroke-width="0.5" opacity="0.22" />
      {/if}
      <!-- Runic tick marks — 8 major (cardinal+diagonal) + 16 minor -->
      {#each Array.from({length: 24}, (_, i) => i) as i}
        {@const isMajor = i % 3 === 0}
        {@const angle = (i * 15 - 90) * Math.PI / 180}
        {@const r1 = WHEEL_RADIUS + (isMajor ? 10 : 13)}
        {@const r2 = WHEEL_RADIUS + (isMajor ? 19 : 17)}
        <line
          x1={CENTER + r1 * Math.cos(angle)} y1={CENTER + r1 * Math.sin(angle)}
          x2={CENTER + r2 * Math.cos(angle)} y2={CENTER + r2 * Math.sin(angle)}
          stroke={isMajor ? '#e8b84b' : '#c0882a'}
          stroke-width={isMajor ? 1.4 : 0.65}
          opacity={isMajor ? 0.75 : 0.28}
        />
      {/each}

      <!-- Rotating wheel group -->
      <g bind:this={wheelGroupEl} style="will-change: transform;">
        {#each segmentAngles as seg, i}
          {@const isDimmed = segments[i]?.dimmed === true}
          {@const segWeight = isDimmed ? 1 : (segments[i]?.weight ?? 1)}
          {@const lightness = isDimmed ? 12 : (17 + 33 * (segWeight / maxSegmentWeight))}
          {@const saturation = isDimmed ? 0 : (50 + 20 * (segWeight / maxSegmentWeight))}
          {@const hue = categoryHue !== undefined ? categoryHue : (i * 47) % 360}
          {@const segTier = segments[i]?.tier}
          {@const gradId = !isDimmed && segTier ? (
            /^Cosmic[-+]?$/.test(segTier)      ? 'tg-cosmic' :
            /^Immortal[-+]?$/.test(segTier)    ? 'tg-immortal' :
            /^Celestial[-+]?$/.test(segTier)   ? 'tg-celestial' :
            /^Godly[-+]?$/.test(segTier)       ? 'tg-godly' :
            /^Primordial[-+]?$/.test(segTier)  ? 'tg-primordial' :
            /^Absolute[-+]?$/.test(segTier)    ? 'tg-absolute' :
            /^Transcendent[-+]?$/.test(segTier) ? 'tg-transcendent' :
            /^Infinite($|[-+]|\+\d+$)/.test(segTier) ? 'tg-infinite' :
            null
          ) : null}
          {@const baseFill = segments[i]?.color}
          {@const useLocalGrad = !isDimmed && !gradId && !baseFill}
          {@const segGradId = `seg-grad-${i}`}
          {@const cLight = `hsl(${hue}, ${saturation}%, ${Math.min(72, lightness + 13)}%)`}
          {@const cDark  = `hsl(${hue}, ${Math.max(0, saturation - 10)}%, ${Math.max(6, lightness - 13)}%)`}
          {@const color = isDimmed
            ? `hsl(0, 0%, ${lightness}%)`
            : (gradId ? `url(#${gradId})` : (baseFill ?? `url(#${segGradId})`))}
          {@const arcSpan = seg.endDeg - seg.startDeg}
          {@const fontSize = arcSpan >= 6 ? Math.max(7, Math.min(13, arcSpan * 0.42)) : 0}
          {@const tx = CENTER + WHEEL_RADIUS * 0.65 * Math.cos((seg.midDeg - 90) * Math.PI / 180)}
          {@const ty = CENTER + WHEEL_RADIUS * 0.65 * Math.sin((seg.midDeg - 90) * Math.PI / 180)}
          {@const textRotation = seg.midDeg <= 180 ? seg.midDeg - 90 : seg.midDeg + 90}
          {@const arcLength = WHEEL_RADIUS * 0.65 * (arcSpan * Math.PI / 180)}
          {@const maxChars = Math.max(3, Math.floor(arcLength / (fontSize * 0.58)))}
          {@const rawLabel = segments[i]?.label ?? ''}
          {@const displayLabel = rawLabel.length > maxChars ? rawLabel.slice(0, maxChars - 1) + '…' : rawLabel}
          {#if useLocalGrad}
            <linearGradient id={segGradId} x1="0%" y1="0%" x2="100%" y2="100%" gradientUnits="objectBoundingBox">
              <stop offset="0%" stop-color={cLight} />
              <stop offset="100%" stop-color={cDark} />
            </linearGradient>
          {/if}
          <path
            d={slicePath(CENTER, CENTER, WHEEL_RADIUS, seg.startDeg, seg.endDeg)}
            fill={color}
            stroke="rgba(0,0,0,0.38)"
            stroke-width="0.75"
            opacity={isDimmed ? 0.45 : 1}
          />
          {#if isRevealed && lastResult?.index === i}
            <path
              d={slicePath(CENTER, CENTER, WHEEL_RADIUS, seg.startDeg, seg.endDeg)}
              fill="rgba(240,192,64,0.18)"
              stroke="#f0c040"
              stroke-width="3.0"
            />
            <path
              d={slicePath(CENTER, CENTER, WHEEL_RADIUS, seg.startDeg, seg.endDeg)}
              fill="none"
              stroke="#5ad6ef"
              stroke-width="1.0"
              opacity="0.45"
            />
          {/if}
          {#if fontSize > 0}
            <text
              x={tx}
              y={ty}
              text-anchor="middle"
              dominant-baseline="middle"
              fill={isDimmed ? 'rgba(255,255,255,0.22)' : (isRevealed && lastResult?.index === i ? '#ffdf96' : 'rgba(255,255,255,0.88)')}
              font-size={fontSize}
              font-weight="600"
              font-family="Inter, sans-serif"
              transform={`rotate(${textRotation}, ${tx}, ${ty})`}
            >{displayLabel}</text>
          {/if}
        {/each}
      </g>

      <!-- Vignette overlay (non-rotating) -->
      <circle cx={CENTER} cy={CENTER} r={WHEEL_RADIUS} fill="url(#vignetteGrad)" />
      {#if _hasTheme}
        <!-- Themed pulsating inner aura (slice colors stay intact). -->
        <circle cx={CENTER} cy={CENTER} r={WHEEL_RADIUS - 2} fill="url(#cursedInnerGlow)" class="cursed-inner-glow" style="mix-blend-mode: screen; animation-duration: {wheelTheme!.innerPulseS ?? 2.4}s;" pointer-events="none" />
      {/if}

      <!-- Hub decoration (non-rotating) — deep stone boss with arcane jewel -->
      <!-- Outer ghost glow -->
      <circle cx={CENTER} cy={CENTER} r="46" fill="none" stroke="#5ad6ef" stroke-width="1.2" opacity="0.07" filter="url(#hubGlow)" />
      <!-- Hub stone body -->
      <circle cx={CENTER} cy={CENTER} r="42" fill="url(#hubGrad)" />
      <!-- Outer hub ring (animated gold) -->
      <circle cx={CENTER} cy={CENTER} r="40" fill="none" stroke="#e8b84b" stroke-width="2.2" opacity="0.92" filter="url(#runeGlow)" class="rune-ring-main" />
      <!-- Cardinal compass spokes -->
      {#each [0, 90, 180, 270] as deg}
        {@const rad = (deg - 90) * Math.PI / 180}
        <line
          x1={CENTER + 13 * Math.cos(rad)} y1={CENTER + 13 * Math.sin(rad)}
          x2={CENTER + 33 * Math.cos(rad)} y2={CENTER + 33 * Math.sin(rad)}
          stroke="#e8b84b" stroke-width="1.0" opacity="0.50"
        />
      {/each}
      <!-- Diagonal spokes (thinner) -->
      {#each [45, 135, 225, 315] as deg}
        {@const rad = (deg - 90) * Math.PI / 180}
        <line
          x1={CENTER + 13 * Math.cos(rad)} y1={CENTER + 13 * Math.sin(rad)}
          x2={CENTER + 29 * Math.cos(rad)} y2={CENTER + 29 * Math.sin(rad)}
          stroke="#b88d2a" stroke-width="0.6" opacity="0.28"
        />
      {/each}
      <!-- Secondary inner ring -->
      <circle cx={CENTER} cy={CENTER} r="32" fill="none" stroke="#f0c040" stroke-width="0.8" opacity="0.38" />
      <!-- Inner ring -->
      <circle cx={CENTER} cy={CENTER} r="19" fill="none" stroke="#b88d2a" stroke-width="0.5" opacity="0.40" />
      <!-- Center arcane gem (animated glow) -->
      <circle cx={CENTER} cy={CENTER} r="11" fill="url(#jewelGrad)" filter="url(#hubGlow)" class="hub-jewel" />
      <!-- Gem highlight: internal refraction glint -->
      <ellipse cx={CENTER - 3.5} cy={CENTER - 3.5} rx="4" ry="2.5" fill="rgba(255,255,255,0.28)" transform={`rotate(-30, ${CENTER}, ${CENTER})`} />

      <!-- Dagger pointer (fixed, non-rotating) — tip at wheel rim, pommel above -->
      <!-- Blade: concave quadratic bezier profile for dagger silhouette -->
      <path
        d={`M ${CENTER} ${PTR_TIP_Y} Q ${CENTER - 7} ${PTR_TIP_Y - 11}, ${CENTER - 8} ${PTR_BASE_Y} L ${CENTER + 8} ${PTR_BASE_Y} Q ${CENTER + 7} ${PTR_TIP_Y - 11}, ${CENTER} ${PTR_TIP_Y} Z`}
        fill="url(#pointerGrad)"
        stroke="rgba(184,141,42,0.55)"
        stroke-width="0.7"
      />
      <!-- Blade spine highlight (3D edge) -->
      <line
        x1={CENTER} y1={PTR_TIP_Y}
        x2={CENTER} y2={PTR_BASE_Y}
        stroke="rgba(255,255,255,0.58)"
        stroke-width="1.2"
        stroke-linecap="round"
      />
      <!-- Crossguard main face -->
      <rect
        x={CENTER - PTR_GW} y={PTR_GUARD_Y}
        width={PTR_GW * 2} height={PTR_BASE_Y - PTR_GUARD_Y}
        rx={2.5}
        fill="url(#guardGrad)"
        stroke="rgba(184,141,42,0.5)" stroke-width="0.6"
      />
      <!-- Guard top face — bright 3D highlight strip -->
      <rect
        x={CENTER - PTR_GW + 1} y={PTR_GUARD_Y}
        width={PTR_GW * 2 - 2} height={2}
        rx={1} fill="rgba(255,245,210,0.72)"
      />
      <!-- Guard end gems (arcane teal) -->
      <circle cx={CENTER - PTR_GW + 4.5} cy={(PTR_GUARD_Y + PTR_BASE_Y) / 2} r={2.8}
        fill="#5ad6ef" stroke="rgba(200,255,255,0.35)" stroke-width="0.5"
      />
      <circle cx={CENTER + PTR_GW - 4.5} cy={(PTR_GUARD_Y + PTR_BASE_Y) / 2} r={2.8}
        fill="#5ad6ef" stroke="rgba(200,255,255,0.35)" stroke-width="0.5"
      />
      <!-- Center guard gem (gold) -->
      <circle cx={CENTER} cy={(PTR_GUARD_Y + PTR_BASE_Y) / 2} r={3.5}
        fill="#f0c040" stroke="rgba(255,245,200,0.45)" stroke-width="0.5"
      />
      <!-- Handle -->
      <rect
        x={CENTER - 4.5} y={PTR_POMMEL}
        width={9} height={PTR_GUARD_Y - PTR_POMMEL}
        rx={2} fill="url(#guardGrad)"
        stroke="rgba(184,141,42,0.4)" stroke-width="0.5"
      />
      <!-- Pommel cap (oval) -->
      <ellipse
        cx={CENTER} cy={PTR_POMMEL}
        rx={9} ry={5.5}
        fill="url(#guardGrad)"
        stroke="#ffdf96" stroke-width="0.8"
      />
      <!-- Pommel center jewel -->
      <circle cx={CENTER} cy={PTR_POMMEL} r={2.8} fill="#e8b84b" opacity={0.88} />
    </svg>

    <!-- Particle canvas — grid-area: 1/1 overlays the SVG exactly; no absolute positioning needed -->
    <canvas
      bind:this={particleCanvas}
      style="grid-area: 1/1; width: 100%; height: 100%; pointer-events: none;"
    ></canvas>
  </div>
  </div><!-- end shake wrapper -->

  <!-- Spin button — pulses gently when idle so new users notice the call-to-action -->
  <button
    onclick={handleSpin}
    disabled={!canSpin}
    data-fx="big"
    class="sw-spin-btn {canSpin ? 'metal-stamp-gold spin-fx spin-btn-idle' : 'obsidian-slab'} px-10 py-3 rounded-lg relative disabled:opacity-40 disabled:cursor-not-allowed"
    style="font-family: 'Cinzel', serif; font-weight: 700; font-size: 0.85rem; letter-spacing: 0.2em; text-transform: uppercase; {!canSpin ? 'color: #9a907b; border: 1px solid #4e4635;' : ''}"
  >
    {#if canSpin}<div class="l-bracket" style="color: rgba(255,255,255,0.25);"></div>{/if}
    {spinStatus === 'IDLE' ? 'Spin Fate' : spinStatus === 'SPINNING' ? 'Spinning…' : 'Spun'}
  </button>

  <!-- Segment count + max-weight peek — small data badge under the button so
       users always know how many possible outcomes are on this wheel. -->
  {#if spinStatus === 'IDLE'}
    <p class="sw-outcomes font-mono text-[10px] tracking-[0.16em] uppercase" style="color: #4e4635;">
      {activeSegments.length} possible outcomes
    </p>
  {/if}

</div>

{#if celebration}
  {#key celebration.key}
    <LandingCelebration
      intensity={celebration.intensity}
      tierColor={celebration.tierColor}
      elementColor={celebration.elementColor}
      tier={celebration.tier}
      subtitle={celebration.subtitle}
      centerX={celebration.centerX}
      centerY={celebration.centerY}
      onComplete={() => { celebration = null }}
    />
  {/key}
{/if}

<style>
  /* Mobile (touch) only: the game is landscape-locked and vertical space is
     tight, so lay the wheel out as a row with the Spin Fate button to the
     LEFT of the wheel. This frees vertical room so the progress dots (rendered
     by the parent right after this component) sit directly below the wheel.
     Keyed on pointer:coarse because the mobile CSS `zoom` inflates the layout
     viewport width, making max-width media queries unreliable. */
  @media (pointer: coarse) {
    .sw-root {
      flex-direction: row;
      flex-wrap: nowrap;
      justify-content: center;
      align-items: center;
      gap: 20px;
    }
    .sw-stage { width: auto; flex: 0 0 auto; }
    .sw-spin-btn { order: -1; flex: 0 0 auto; }   /* sits left of the wheel */
    .sw-outcomes { display: none; }               /* declutter the row */
    /* Shrink the wheel so the button fits beside it within the parent
       container, and so the top isn't clipped on short landscape screens.
       The cap is overridable per-screen via --sw-mobile-cap (Story Mode sets
       a slightly larger one). !important overrides the inline clamp() width. */
    .sw-wheel-box { width: var(--sw-mobile-cap, min(62vh, 360px)) !important; }
  }

  @keyframes runeRingPulse {
    0%, 100% { opacity: 0.70; }
    50%       { opacity: 1.00; }
  }
  @keyframes hubJewelPulse {
    0%, 100% { filter: url(#hubGlow) brightness(1.0); }
    50%       { filter: url(#hubGlow) brightness(1.45); }
  }
  @keyframes cursedPulse {
    0%, 100% { filter: drop-shadow(0 0 48px rgba(0,0,0,0.97)) drop-shadow(0 0 32px rgba(139,92,246,0.5)) drop-shadow(0 0 16px rgba(100,0,200,0.4)); }
    50%       { filter: drop-shadow(0 0 48px rgba(0,0,0,0.97)) drop-shadow(0 0 48px rgba(139,92,246,0.8)) drop-shadow(0 0 24px rgba(180,0,255,0.6)); }
  }
  .rune-ring-main { animation: runeRingPulse 3.5s ease-in-out infinite; }
  .rune-ring-slow  { animation: runeRingPulse 7s   ease-in-out infinite 2s; }
  .hub-jewel       { animation: hubJewelPulse 2.4s ease-in-out infinite; }
  /* Cursed Wheel — counter-rotating violet spike crowns. */
  .cursed-spikes-spin {
    transform-box: view-box; transform-origin: 250px 250px;
    animation: cursedSpin 20s linear infinite;
  }
  .cursed-spikes-spin-rev {
    transform-box: view-box; transform-origin: 250px 250px;
    animation: cursedSpin 28s linear infinite reverse;
  }
  @keyframes cursedSpin { to { transform: rotate(360deg); } }
  /* Pulsating violet aura inside the wheel. */
  .cursed-inner-glow { animation: cursedInnerPulse 2.4s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
  @keyframes cursedInnerPulse {
    0%, 100% { opacity: 0.55; transform: scale(0.94); }
    50%      { opacity: 1;    transform: scale(1.02); }
  }
  @media (prefers-reduced-motion: reduce) {
    .cursed-spikes-spin, .cursed-spikes-spin-rev, .cursed-inner-glow { animation: none; }
  }
  :global([data-perf="low"]) .cursed-spikes-spin,
  :global([data-perf="low"]) .cursed-spikes-spin-rev { animation: none; }

  /* Mobile / low-tier devices: kill the always-running cosmetic
     animations that contribute to constant GPU usage even when idle.
     The wheel still looks ornate — just static instead of pulsing. */
  @media (pointer: coarse), (max-width: 640px) {
    .rune-ring-main, .rune-ring-slow, .hub-jewel { animation: none; }
  }

  /* Soft attention pulse on the idle spin button — draws the eye for new users
     without being intrusive. Only fires when the button is enabled. */
  @keyframes spinBtnPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(240, 192, 64, 0.35); }
    50%      { box-shadow: 0 0 0 10px rgba(240, 192, 64, 0); }
  }
  .spin-btn-idle:not(:disabled) {
    animation: spinBtnPulse 2.4s ease-in-out infinite;
  }
  @media (prefers-reduced-motion: reduce),
         (pointer: coarse) and (max-width: 768px) {
    .spin-btn-idle:not(:disabled) { animation: none; }
  }
</style>
