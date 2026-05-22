<script lang="ts">
  import { onMount } from 'svelte'
  import { gsap } from 'gsap'
  import { slicePath, weightedSegmentAngles } from '$lib/game/geometry'
  import { weightedRandom } from '$lib/game/random'
  import type { WeightedSegment, SpinStatus } from '$lib/session/types'

  const SVG_SIZE = 500
  const CENTER = SVG_SIZE / 2          // 250
  const SVG_CENTER = `${CENTER} ${CENTER}`
  const WHEEL_RADIUS = 230
  const POINTER_SIZE = 24

  // Pointer geometry — computed from wheel constants
  const PTR_TIP_Y   = CENTER - WHEEL_RADIUS - 3   // 17  blade tip (at wheel rim)
  const PTR_BASE_Y  = PTR_TIP_Y - 28              // -11 guard bottom
  const PTR_GUARD_Y = PTR_BASE_Y - 7              // -18 guard top
  const PTR_POMMEL  = PTR_GUARD_Y - 11            // -29 pommel apex
  const PTR_GW      = 22                          // guard half-width

  const COLORS = ['#E63946','#457B9D','#2A9D8F','#E9C46A','#F4A261','#264653','#6A0572','#0077B6']

  let { segments, onSpinComplete, categoryHue = undefined, soundEnabled = true, effectsEnabled = true, spinSpeedMultiplier = 1.0, cursedTheme = false }: {
    segments: WeightedSegment[]
    onSpinComplete: (resultIndex: number, resultLabel: string) => void
    categoryHue?: number
    soundEnabled?: boolean
    effectsEnabled?: boolean
    spinSpeedMultiplier?: number
    cursedTheme?: boolean
  } = $props()

  let spinStatus = $state<SpinStatus>('IDLE')
  let currentRotation = $state(Math.random() * 360)
  let lastResult = $state<{ index: number; label: string } | null>(null)
  // Snapshot taken at spin start — prevents post-spin segment mutations (dimming, weight
  // changes from usedRacialAbilities etc.) from shifting arc positions while the wheel is
  // frozen at targetAngle, which would misalign the pointer with the winning segment.
  let frozenSegments = $state<typeof segments | null>(null)

  let canSpin = $derived(spinStatus === 'IDLE')
  let isRevealed = $derived(spinStatus === 'REVEALED')
  let activeSegments = $derived(frozenSegments ?? segments)
  let displaySegments = $derived(activeSegments.map(s => s.dimmed ? { ...s, weight: Math.max(s.weight, 1) } : s))
  let segmentAngles = $derived(weightedSegmentAngles(displaySegments))
  let maxSegmentWeight = $derived(Math.max(...activeSegments.filter(s => !s.dimmed).map(s => s.weight), 1))

  let wheelGroupEl: SVGGElement
  let shakeEl: HTMLDivElement
  let svgEl: SVGSVGElement
  let particleCanvas: HTMLCanvasElement
  let ctx: gsap.Context

  let spinTween: gsap.core.Tween | null = null
  let idleTween: gsap.core.Tween | null = null
  let shakeStartTime = 0

  // ── Web Audio ─────────────────────────────────────────────────────────────
  let audioCtx: AudioContext | null = null
  let lastTickRot = 0
  let lastTickAt  = 0   // AudioContext time of last tick; enforces 40ms rate limit

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

  function playLanding() {
    const ac = getAudioCtx()
    if (!ac) return
    const now = ac.currentTime

    // Sub weight — very short, just gives physical mass to the hit
    const sub = ac.createOscillator()
    const sg  = ac.createGain()
    sub.type = 'sine'
    sub.frequency.setValueAtTime(58, now)
    sub.frequency.exponentialRampToValueAtTime(26, now + 0.13)
    sg.gain.setValueAtTime(0.9, now)
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.13)
    sub.connect(sg); sg.connect(ac.destination)
    sub.start(now); sub.stop(now + 0.15)

    // Hollow knock — square wave gives a "clonk" wood/metal character vs the sine thud
    const knock = ac.createOscillator()
    const kg    = ac.createGain()
    knock.type = 'square'
    knock.frequency.setValueAtTime(290, now)
    knock.frequency.exponentialRampToValueAtTime(185, now + 0.09)
    kg.gain.setValueAtTime(0.22, now)
    kg.gain.exponentialRampToValueAtTime(0.001, now + 0.11)
    knock.connect(kg); kg.connect(ac.destination)
    knock.start(now); knock.stop(now + 0.13)

    // Resonant ring — pure sine, sustains and fades like a struck bowl
    const ring = ac.createOscillator()
    const rg   = ac.createGain()
    ring.type = 'sine'
    ring.frequency.value = 430
    rg.gain.setValueAtTime(0.32, now)
    rg.gain.exponentialRampToValueAtTime(0.001, now + 0.7)
    ring.connect(rg); rg.connect(ac.destination)
    ring.start(now); ring.stop(now + 0.72)

    // High attack sparkle — short bright ping on initial contact
    const spark = ac.createOscillator()
    const spg   = ac.createGain()
    spark.type = 'sine'
    spark.frequency.setValueAtTime(1450, now)
    spark.frequency.exponentialRampToValueAtTime(880, now + 0.16)
    spg.gain.setValueAtTime(0.13, now)
    spg.gain.exponentialRampToValueAtTime(0.001, now + 0.19)
    spark.connect(spg); spg.connect(ac.destination)
    spark.start(now); spark.stop(now + 0.21)
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

  const SPARKLE_COLORS = ['#f0c040', '#ffdf96', '#ffffff', '#ffd700', '#ff9f43', '#fff0a0', '#48c8e0', '#b47aec', '#e8b84b']
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
    const dpr = window.devicePixelRatio || 1
    // Use the canvas element's own layout dimensions — offsetWidth/offsetHeight
    // always reflect the CSS-computed size regardless of SVG attribute quirks.
    particleCanvas.width  = Math.round(particleCanvas.offsetWidth  * dpr)
    particleCanvas.height = Math.round(particleCanvas.offsetHeight * dpr)
  }

  function spawnParticles(normalizedSpeed: number) {
    if (normalizedSpeed < 0.04 || !particleCanvas || !svgEl) return
    const count = Math.ceil(normalizedSpeed * 6)
    const [tipX, tipY] = svgToCanvas(TIP_SVG_X, TIP_SVG_Y)
    const dpr = window.devicePixelRatio || 1
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

    const dpr = window.devicePixelRatio || 1
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
    idleTween = gsap.to(wheelGroupEl, {
      rotation: '+=360',
      duration: 9,
      ease: 'none',
      repeat: -1,
      svgOrigin: SVG_CENTER,
      force3D: true,
    })
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
        if (soundEnabled && countBordersCrossed(lastTickRot, rot) > 0) playTick(speed)
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
        if (soundEnabled) playLanding()
        currentRotation = targetAngle
        lastResult = { index: resultIndex, label: segments[resultIndex].label }
        spinStatus = 'LANDED'
        onSpinComplete(resultIndex, segments[resultIndex].label)
        setTimeout(() => { spinStatus = 'REVEALED' }, 500)
      }
    })
  }
</script>

<div class="flex flex-col items-center gap-5 w-full mx-auto select-none">

  <!-- Shake wrapper — GSAP applies translate() here during spin -->
  <div bind:this={shakeEl} class="flex justify-center w-full">
  <!-- Wheel + canvas wrapper — CSS Grid overlay so canvas and SVG share identical pixel bounds -->
  <div style="display: grid; width: clamp(280px, min(90vw, 85vh), 500px); max-width: 500px; aspect-ratio: 1/1; filter: drop-shadow(0 0 48px rgba(0,0,0,0.97)) {cursedTheme ? 'drop-shadow(0 0 32px rgba(139,92,246,0.5)) drop-shadow(0 0 16px rgba(100,0,200,0.4))' : 'drop-shadow(0 0 24px rgba(240,192,64,0.34)) drop-shadow(0 0 12px rgba(72,200,224,0.15))'}; {cursedTheme ? 'animation: cursedPulse 3s ease-in-out infinite;' : ''}">
    <svg
      bind:this={svgEl}
      viewBox="0 0 {SVG_SIZE} {SVG_SIZE}"
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
          <stop offset="40%"  stop-color="#48c8e0" />
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
        <!-- Stronger glow for hub center jewel -->
        <filter id="hubGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <!-- Outer decorative rings — layered bronze-gold rim with arcane ghost -->
      <circle cx={CENTER} cy={CENTER} r={WHEEL_RADIUS + 20} fill="none" stroke="#48c8e0"  stroke-width="1.0" opacity="0.05" />
      <circle cx={CENTER} cy={CENTER} r={WHEEL_RADIUS + 14} fill="none" stroke="#e8b84b"  stroke-width="0.6" opacity="0.18" class="rune-ring-slow" />
      <circle cx={CENTER} cy={CENTER} r={WHEEL_RADIUS + 8}  fill="none" stroke="#f0c040"  stroke-width="2.2" opacity="0.70" filter="url(#runeGlow)" class="rune-ring-main" />
      <circle cx={CENTER} cy={CENTER} r={WHEEL_RADIUS + 4}  fill="none" stroke="#ffdf96"  stroke-width="1.0" opacity="0.40" />
      <circle cx={CENTER} cy={CENTER} r={WHEEL_RADIUS + 1}  fill="none" stroke="#b88d2a"  stroke-width="0.5" opacity="0.22" />
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
          {@const color = isDimmed ? `hsl(0, 0%, ${lightness}%)` : (segments[i]?.color ?? `hsl(${hue}, ${saturation}%, ${lightness}%)`)}
          {@const arcSpan = seg.endDeg - seg.startDeg}
          {@const fontSize = arcSpan >= 6 ? Math.max(7, Math.min(13, arcSpan * 0.42)) : 0}
          {@const tx = CENTER + WHEEL_RADIUS * 0.65 * Math.cos((seg.midDeg - 90) * Math.PI / 180)}
          {@const ty = CENTER + WHEEL_RADIUS * 0.65 * Math.sin((seg.midDeg - 90) * Math.PI / 180)}
          {@const textRotation = seg.midDeg <= 180 ? seg.midDeg - 90 : seg.midDeg + 90}
          {@const arcLength = WHEEL_RADIUS * 0.65 * (arcSpan * Math.PI / 180)}
          {@const maxChars = Math.max(3, Math.floor(arcLength / (fontSize * 0.58)))}
          {@const rawLabel = segments[i]?.label ?? ''}
          {@const displayLabel = rawLabel.length > maxChars ? rawLabel.slice(0, maxChars - 1) + '…' : rawLabel}
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
              stroke="#48c8e0"
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

      <!-- Hub decoration (non-rotating) — deep stone boss with arcane jewel -->
      <!-- Outer ghost glow -->
      <circle cx={CENTER} cy={CENTER} r="46" fill="none" stroke="#48c8e0" stroke-width="1.2" opacity="0.07" filter="url(#hubGlow)" />
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
        fill="#48c8e0" stroke="rgba(200,255,255,0.35)" stroke-width="0.5"
      />
      <circle cx={CENTER + PTR_GW - 4.5} cy={(PTR_GUARD_Y + PTR_BASE_Y) / 2} r={2.8}
        fill="#48c8e0" stroke="rgba(200,255,255,0.35)" stroke-width="0.5"
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

  <!-- Spin button -->
  <button
    onclick={handleSpin}
    disabled={!canSpin}
    class="{canSpin ? 'metal-stamp-gold' : 'obsidian-slab'} px-10 py-3 rounded-lg relative disabled:opacity-40 disabled:cursor-not-allowed"
    style="font-family: 'Cinzel', serif; font-weight: 700; font-size: 0.85rem; letter-spacing: 0.2em; text-transform: uppercase; {!canSpin ? 'color: #9a907b; border: 1px solid #4e4635;' : ''}"
  >
    {#if canSpin}<div class="l-bracket" style="color: rgba(255,255,255,0.25);"></div>{/if}
    {spinStatus === 'IDLE' ? 'Spin Fate' : spinStatus === 'SPINNING' ? 'Spinning…' : 'Spun'}
  </button>

</div>

<style>
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
</style>
