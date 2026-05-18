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

  const COLORS = ['#E63946','#457B9D','#2A9D8F','#E9C46A','#F4A261','#264653','#6A0572','#0077B6']

  let { segments, onSpinComplete, categoryHue = undefined, soundEnabled = true, effectsEnabled = true, spinSpeedMultiplier = 1.0 }: {
    segments: WeightedSegment[]
    onSpinComplete: (resultIndex: number, resultLabel: string) => void
    categoryHue?: number
    soundEnabled?: boolean
    effectsEnabled?: boolean
    spinSpeedMultiplier?: number
  } = $props()

  let spinStatus = $state<SpinStatus>('IDLE')
  let currentRotation = $state(Math.random() * 360)
  let lastResult = $state<{ index: number; label: string } | null>(null)

  let canSpin = $derived(spinStatus === 'IDLE')
  let isRevealed = $derived(spinStatus === 'REVEALED')
  let displaySegments = $derived(segments.map(s => s.dimmed ? { ...s, weight: Math.max(s.weight, 1) } : s))
  let segmentAngles = $derived(weightedSegmentAngles(displaySegments))
  let maxSegmentWeight = $derived(Math.max(...segments.filter(s => !s.dimmed).map(s => s.weight), 1))

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

  const SPARKLE_COLORS = ['#f0c040', '#ffdf96', '#ffffff', '#ffd700', '#ff9f43', '#fff0a0']
  let particles: Particle[] = []
  let rafId: number | null = null
  let lastFrameTime = 0
  let prevGsapRot = 0
  let prevGsapTime = 0

  // Pointer tip in SVG coordinate space: (250, 17)
  const TIP_SVG_X = CENTER
  const TIP_SVG_Y = CENTER - WHEEL_RADIUS - 3

  function svgToCanvas(svgX: number, svgY: number): [number, number] {
    if (!particleCanvas || !svgEl) return [0, 0]
    const rect = svgEl.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    return [(svgX / SVG_SIZE) * rect.width * dpr, (svgY / SVG_SIZE) * rect.height * dpr]
  }

  function resizeCanvas() {
    if (!particleCanvas || !svgEl) return
    const rect = svgEl.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    particleCanvas.width  = rect.width  * dpr
    particleCanvas.height = rect.height * dpr
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
        isStar: Math.random() < 0.35,
      })
    }
  }

  function drawStar(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
    const inner = r * 0.38
    c.beginPath()
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 - Math.PI / 8
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
    // Resize after first paint so the SVG has its final layout dimensions
    requestAnimationFrame(() => resizeCanvas())
    const ro = new ResizeObserver(() => requestAnimationFrame(resizeCanvas))
    if (svgEl) ro.observe(svgEl)
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
    // Land at a random position within the segment (not always the midpoint).
    // Pad 15% from each edge to avoid ambiguity at narrow segment borders.
    const seg     = segmentAngles[resultIndex]
    const span    = seg.endDeg - seg.startDeg
    const padding = span * 0.15
    const landDeg = seg.startDeg + padding + Math.random() * (span - 2 * padding)
    const currentMod = currentRotation % 360
    const delta = ((360 - landDeg) - currentMod + 360) % 360
    const extraSpins = 8 + Math.floor(Math.random() * 5)   // 8–12 full rotations
    const targetAngle = currentRotation + (extraSpins * 360) + delta

    spinStatus     = 'SPINNING'
    prevGsapRot    = currentRotation
    prevGsapTime   = performance.now()
    shakeStartTime = performance.now()
    lastTickRot    = currentRotation
    getAudioCtx()  // warm up AudioContext on the user gesture

    spinTween = gsap.to(wheelGroupEl, {
      rotation: targetAngle,
      duration: (2.5 + Math.random() * 0.8) / spinSpeedMultiplier,
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
  <div bind:this={shakeEl} class="w-full flex justify-center">
  <!-- Wheel + canvas wrapper (relative so canvas can overlay) -->
  <div class="w-full max-w-lg relative" style="filter: drop-shadow(0 0 28px rgba(0,0,0,0.92)) drop-shadow(0 0 14px rgba(240,192,64,0.22));">
    <svg
      bind:this={svgEl}
      width={SVG_SIZE}
      height={SVG_SIZE}
      viewBox="0 0 {SVG_SIZE} {SVG_SIZE}"
      class="w-full"
      style="overflow: visible;"
      aria-label="Spinning wheel"
      role="img"
    >
      <defs>
        <linearGradient id="pointerGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#9a907b" />
          <stop offset="45%" stop-color="#ffdf96" />
          <stop offset="100%" stop-color="#f0c040" />
        </linearGradient>
        <radialGradient id="hubGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#1f1f28" />
          <stop offset="100%" stop-color="#0d0d16" />
        </radialGradient>
        <radialGradient id="vignetteGrad" cx="50%" cy="50%" r="50%">
          <stop offset="65%" stop-color="transparent" />
          <stop offset="100%" stop-color="rgba(0,0,0,0.45)" />
        </radialGradient>
      </defs>

      <!-- Outer decorative gold rings -->
      <circle cx={CENTER} cy={CENTER} r={WHEEL_RADIUS + 12} fill="none" stroke="#f0c040" stroke-width="0.5" opacity="0.2" />
      <circle cx={CENTER} cy={CENTER} r={WHEEL_RADIUS + 6}  fill="none" stroke="#f0c040" stroke-width="1.5" opacity="0.55" />
      <circle cx={CENTER} cy={CENTER} r={WHEEL_RADIUS + 3}  fill="none" stroke="#ffdf96" stroke-width="0.5" opacity="0.3" />

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
              fill="rgba(240,192,64,0.16)"
              stroke="#f0c040"
              stroke-width="2.5"
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

      <!-- Hub decoration (non-rotating) -->
      <circle cx={CENTER} cy={CENTER} r="38" fill="url(#hubGrad)" />
      <circle cx={CENTER} cy={CENTER} r="36" fill="none" stroke="#f0c040" stroke-width="1.5" opacity="0.85" />
      <circle cx={CENTER} cy={CENTER} r="28" fill="none" stroke="#f0c040" stroke-width="0.5" opacity="0.4" />
      <circle cx={CENTER} cy={CENTER} r="18" fill="none" stroke="#9a907b" stroke-width="0.5" opacity="0.45" />
      <circle cx={CENTER} cy={CENTER} r="9"  fill="#f0c040" opacity="0.75" />
      <circle cx={CENTER} cy={CENTER} r="4.5" fill="#ffdf96" />

      <!-- Dagger pointer (fixed, non-rotating) -->
      <!-- Blade tip: (CENTER, CENTER - WHEEL_RADIUS - 3); base: goes upward -->
      <polygon
        points="{CENTER},{CENTER - WHEEL_RADIUS - 3} {CENTER - 13},{CENTER - WHEEL_RADIUS - POINTER_SIZE - 10} {CENTER + 13},{CENTER - WHEEL_RADIUS - POINTER_SIZE - 10}"
        fill="url(#pointerGrad)"
        stroke="#9a907b"
        stroke-width="0.5"
      />
      <!-- Blade spine highlight -->
      <line
        x1="{CENTER}" y1="{CENTER - WHEEL_RADIUS - 3}"
        x2="{CENTER}" y2="{CENTER - WHEEL_RADIUS - POINTER_SIZE - 10}"
        stroke="rgba(255,255,255,0.45)"
        stroke-width="1.5"
        stroke-linecap="round"
      />
      <!-- Crossguard -->
      <rect
        x="{CENTER - 17}" y="{CENTER - WHEEL_RADIUS - POINTER_SIZE - 12}"
        width="34" height="5" rx="2.5"
        fill="#f0c040"
      />
    </svg>

    <!-- Particle canvas — covers the SVG exactly, pointer-events off so clicks pass through -->
    <canvas
      bind:this={particleCanvas}
      style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"
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
