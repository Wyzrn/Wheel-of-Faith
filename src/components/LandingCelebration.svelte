<script lang="ts">
  // Tier-scaled landing celebration overlay. Mounted by SpinWheel on result
  // landing; renders a cinematic stack of VFX layers (flash, vignette tint,
  // aurora sweep, light rays, expanding rings, particle storm, lens flare,
  // sustained banner) calibrated to a single 0..1 intensity scalar so the
  // player FEELS exactly how rare what they rolled is.
  //
  // Five levels (re-tuned for "everything rewarding" — stat rolls B and up
  // hit at least 'good', S+ hits 'great', SSS+/God/Z+/etc. hits 'mythic'):
  //   0.00–0.10  silent     — overlay never mounts
  //   0.10–0.30  basic      — small particle puff + 1 ring
  //   0.30–0.50  good       — element-themed ring stack + mid burst
  //   0.50–0.70  great      — vignette tint + aurora + light rays + flash
  //   0.70–1.00  mythic     — full cinematic + lens flare + banner + subtitle
  //
  // The component is fire-and-forget: parent passes intensity + colors,
  // we mount, animate, fire onComplete, and unmount.
  import { onMount } from 'svelte'

  let {
    intensity,
    tierColor = '#f0c040',
    elementColor = null,
    tier = null,
    subtitle = null,
    durationMs,
    onComplete,
  }: {
    intensity: number          // 0..1 scalar
    tierColor?: string
    elementColor?: string | null
    tier?: string | null
    subtitle?: string | null   // shown under the banner (e.g. "S+ TIER" or "Mythological")
    durationMs?: number        // override; defaults by level (mythic holds longer)
    onComplete?: () => void
  } = $props()

  // Primary accent — element color when available (so a Fire roll bursts red,
  // not generic gold), tier color otherwise.
  let accent = $derived(elementColor ?? tierColor)
  // Secondary accent for layered gradients — lifts brightness for warm cast.
  let accent2 = $derived(tierColor)

  // ── Particle sprite pools — heavier assets unlocked at higher levels ────
  // Premium sprite pool lives at /fx/p/ (42 PNGs: bursts, stars, rings, etc.).
  const SPRITE_POOLS = {
    basic:  ['star_a.png', 'star_b.png', 'cstar_a.png', 'cstar_b.png'],
    good:   ['burst_a.png', 'burst_b.png', 'star_c.png', 'star_d.png', 'magic_a.png', 'magic_b.png', 'cstar_c.png'],
    great:  ['burst_c.png', 'burst_d.png', 'impact_a.png', 'impact_b.png', 'rays_a.png', 'spiro_a.png', 'star_e.png', 'star_f.png', 'orb_a.png'],
    mythic: ['impact_c.png', 'impact_d.png', 'rays_b.png', 'rays_c.png', 'spiro_b.png', 'spiro_c.png', 'flare_a.png', 'flare_b.png', 'magic_d.png', 'magic_e.png', 'orb_b.png', 'orb_c.png', 'star_g.png'],
  }

  let level = $derived(
    intensity >= 0.70 ? 'mythic' :
    intensity >= 0.50 ? 'great'  :
    intensity >= 0.30 ? 'good'   :
    intensity >= 0.10 ? 'basic'  :
    'silent',
  )

  // Default mount duration. Mythic holds long enough for the banner + tier
  // subtitle to land + shine + fade before the reveal panel takes over.
  let effectiveDur = $derived(
    durationMs ??
    (level === 'mythic' ? 2400 :
     level === 'great'  ? 1700 :
     level === 'good'   ? 1200 :
     level === 'basic'  ? 800  :
     0)
  )

  let particleCount = $derived(
    level === 'mythic' ? 56 :
    level === 'great'  ? 34 :
    level === 'good'   ? 18 :
    level === 'basic'  ? 10 :
    0,
  )

  // Bonus drifting "confetti" / spark trail at mythic — falls down slowly
  // after the initial burst to extend the cinematic feel.
  let confettiCount = $derived(level === 'mythic' ? 24 : 0)

  type Particle = {
    id: number
    sprite: string
    angle: number       // emission angle in radians
    distance: number    // travel distance in px
    size: number        // base size in px
    rotation: number    // initial rotation
    rotateBy: number    // total rotation during life
    delay: number       // ms before particle begins moving
    duration: number    // particle lifetime in ms
  }

  type Confetti = {
    id: number
    sprite: string
    startX: number      // % from center
    fallDist: number    // px to fall
    drift: number       // horizontal drift
    size: number
    delay: number
    duration: number
    rotation: number
    spin: number
  }

  let particles = $state<Particle[]>([])
  let confetti = $state<Confetti[]>([])

  let showRing = $derived(level === 'basic' || level === 'good' || level === 'great' || level === 'mythic')
  let ringCount = $derived(level === 'mythic' ? 5 : level === 'great' ? 4 : level === 'good' ? 3 : 1)
  let showVignette = $derived(level === 'great' || level === 'mythic')
  let showAurora = $derived(level === 'great' || level === 'mythic')
  let showRays = $derived(level === 'great' || level === 'mythic')
  let showFlash = $derived(level === 'great' || level === 'mythic')
  let showLensFlare = $derived(level === 'mythic')
  let showBanner = $derived(level === 'mythic')

  function buildParticles() {
    if (particleCount === 0) { particles = []; return }
    const pool =
      level === 'mythic' ? [...SPRITE_POOLS.great, ...SPRITE_POOLS.mythic] :
      level === 'great'  ? SPRITE_POOLS.great :
      level === 'good'   ? SPRITE_POOLS.good  :
                           SPRITE_POOLS.basic
    const out: Particle[] = []
    for (let i = 0; i < particleCount; i++) {
      const slice = (Math.PI * 2) / particleCount
      const angle = i * slice + (Math.random() - 0.5) * slice * 0.8
      const dist =
        level === 'mythic' ? 220 + Math.random() * 280 :
        level === 'great'  ? 170 + Math.random() * 180 :
        level === 'good'   ? 120 + Math.random() * 120 :
                              70 + Math.random() * 70
      const baseSize =
        level === 'mythic' ? 64 + Math.random() * 64 :
        level === 'great'  ? 50 + Math.random() * 40 :
        level === 'good'   ? 36 + Math.random() * 24 :
                             24 + Math.random() * 16
      out.push({
        id: i,
        sprite: pool[Math.floor(Math.random() * pool.length)],
        angle,
        distance: dist,
        size: baseSize,
        rotation: Math.random() * 360,
        rotateBy: (Math.random() - 0.5) * 720,
        delay: Math.random() * 80,
        duration: 800 + Math.random() * 600,
      })
    }
    particles = out
  }

  function buildConfetti() {
    if (confettiCount === 0) { confetti = []; return }
    const pool = [...SPRITE_POOLS.basic, ...SPRITE_POOLS.good]
    const out: Confetti[] = []
    for (let i = 0; i < confettiCount; i++) {
      out.push({
        id: i,
        sprite: pool[Math.floor(Math.random() * pool.length)],
        startX: -45 + Math.random() * 90,   // -45vw .. +45vw
        fallDist: 320 + Math.random() * 360,
        drift: (Math.random() - 0.5) * 220,
        size: 18 + Math.random() * 22,
        delay: 200 + Math.random() * 900,
        duration: 1600 + Math.random() * 1400,
        rotation: Math.random() * 360,
        spin: (Math.random() - 0.5) * 540,
      })
    }
    confetti = out
  }

  onMount(() => {
    if (level === 'silent') { onComplete?.(); return }
    buildParticles()
    buildConfetti()
    const t = setTimeout(() => onComplete?.(), effectiveDur)
    return () => clearTimeout(t)
  })

  // Mythic banner copy. We treat anything ≥ 0.70 as mythic; the tier label
  // drives the headline so SSS+ vs Absolute show different copy.
  let bannerText = $derived(
    !tier ? 'MYTHIC ROLL!' :
    /Absolute/i.test(tier) ? 'ABSOLUTE!' :
    /Primordial/i.test(tier) ? 'PRIMORDIAL!' :
    /Godly|^God$/i.test(tier) ? 'GODLY!' :
    /Celestial/i.test(tier) ? 'CELESTIAL!' :
    /ZZZ/.test(tier) ? 'BEYOND MYTHIC!' :
    /ZZ/.test(tier) ? 'TRANSCENDENT!' :
    /^Z[-+]?$/.test(tier) ? 'MYTHIC!' :
    /SSS/i.test(tier) ? 'LEGENDARY!' :
    /SS[-+]?$/i.test(tier) ? 'LEGENDARY!' :
    /^S[-+]?$/i.test(tier) ? 'EXCEPTIONAL!' :
    'MYTHIC!'
  )
</script>

{#if level !== 'silent'}
  <!-- Fullscreen overlay; pointer-events:none so the reveal modal underneath
       still receives clicks. -->
  <div
    class="lc-root"
    style="--accent: {accent}; --accent2: {accent2}; --tier-color: {tierColor};"
    aria-hidden="true"
  >
    <!-- Edge vignette tint — great + mythic. Subtle darken-and-tint at the
         viewport edges that makes the rest of the page recede so the eye
         focuses on the center burst. -->
    {#if showVignette}
      <div class="lc-vignette" class:lc-vignette-mythic={level === 'mythic'}></div>
    {/if}

    <!-- Aurora gradient sweep — great + mythic. Slow diagonal wash of the
         accent color across the viewport behind everything else. Mimics a
         "the world recognizes this moment" cinematic gradient pass. -->
    {#if showAurora}
      <div class="lc-aurora"></div>
    {/if}

    <!-- Light rays radiating from center — great + mythic. Conic-gradient
         "shutter rays" that fan out from the impact point. -->
    {#if showRays}
      <div class="lc-rays" class:lc-rays-mythic={level === 'mythic'}></div>
    {/if}

    <!-- Tinted screen flash — great + mythic. -->
    {#if showFlash}
      <div class="lc-flash" class:lc-flash-mythic={level === 'mythic'}></div>
    {/if}

    <!-- Radial energy rings expanding outward from screen center. -->
    {#if showRing}
      {#each Array.from({ length: ringCount }, (_, i) => i) as i (i)}
        <div class="lc-ring lc-ring-{i + 1}" style="--ring-i: {i};"></div>
      {/each}
    {/if}

    <!-- Lens flare — mythic only. A bright multi-layered sun with cross +
         starburst at impact center. -->
    {#if showLensFlare}
      <div class="lc-flare">
        <div class="lc-flare-core"></div>
        <div class="lc-flare-halo"></div>
        <div class="lc-flare-cross"></div>
        <div class="lc-flare-burst"></div>
      </div>
    {/if}

    <!-- Particle burst -->
    <div class="lc-particles">
      {#each particles as p (p.id)}
        <img
          src="/fx/p/{p.sprite}"
          alt=""
          class="lc-particle"
          style="
            --angle: {p.angle}rad;
            --dist: {p.distance}px;
            --size: {p.size}px;
            --rot0: {p.rotation}deg;
            --rotBy: {p.rotateBy}deg;
            --delay: {p.delay}ms;
            --dur: {p.duration}ms;
            filter: drop-shadow(0 0 {Math.round(p.size / 4)}px {accent}) drop-shadow(0 0 {Math.round(p.size / 8)}px {accent2});
          "
        />
      {/each}
    </div>

    <!-- Drifting confetti — mythic only. Slow fall extends the cinematic. -->
    {#if confetti.length > 0}
      <div class="lc-confetti">
        {#each confetti as c (c.id)}
          <img
            src="/fx/p/{c.sprite}"
            alt=""
            class="lc-confetto"
            style="
              --startX: {c.startX}vw;
              --fallDist: {c.fallDist}px;
              --drift: {c.drift}px;
              --size: {c.size}px;
              --delay: {c.delay}ms;
              --dur: {c.duration}ms;
              --rot0: {c.rotation}deg;
              --spin: {c.spin}deg;
              filter: drop-shadow(0 0 {Math.round(c.size / 4)}px {accent});
            "
          />
        {/each}
      </div>
    {/if}

    <!-- Mythic banner — headline + optional subtitle (tier label or category). -->
    {#if showBanner}
      <div class="lc-banner-wrap">
        <div class="lc-banner-bg"></div>
        <div class="lc-banner-stack">
          <div class="lc-banner">{bannerText}</div>
          {#if subtitle}
            <div class="lc-banner-sub">{subtitle}</div>
          {/if}
        </div>
        <div class="lc-banner-shine"></div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .lc-root {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 45;
    overflow: hidden;
  }

  /* ── Edge vignette tint ────────────────────────────────────────────────── */
  .lc-vignette {
    position: absolute;
    inset: 0;
    background: radial-gradient(
      ellipse at center,
      transparent 38%,
      color-mix(in srgb, var(--accent) 20%, transparent) 78%,
      rgba(0,0,0,0.55) 100%
    );
    opacity: 0;
    animation: lc-vignette-anim 1500ms cubic-bezier(0.22, 0.85, 0.3, 1) forwards;
    mix-blend-mode: multiply;
  }
  .lc-vignette-mythic {
    animation: lc-vignette-mythic-anim 2200ms cubic-bezier(0.22, 0.85, 0.3, 1) forwards;
  }
  @keyframes lc-vignette-anim {
    0%   { opacity: 0; }
    25%  { opacity: 0.7; }
    100% { opacity: 0; }
  }
  @keyframes lc-vignette-mythic-anim {
    0%   { opacity: 0; }
    20%  { opacity: 0.95; }
    65%  { opacity: 0.85; }
    100% { opacity: 0; }
  }

  /* ── Aurora gradient sweep ─────────────────────────────────────────────── */
  .lc-aurora {
    position: absolute;
    left: -10%;
    right: -10%;
    top: 0;
    bottom: 0;
    background:
      linear-gradient(
        110deg,
        transparent 0%,
        color-mix(in srgb, var(--accent) 22%, transparent) 25%,
        color-mix(in srgb, var(--accent2) 28%, transparent) 50%,
        color-mix(in srgb, var(--accent) 22%, transparent) 75%,
        transparent 100%
      );
    transform: translateX(-30%) skewX(-12deg);
    opacity: 0;
    animation: lc-aurora-anim 1900ms cubic-bezier(0.36, 0.4, 0.3, 1) 100ms forwards;
    filter: blur(28px);
    mix-blend-mode: screen;
  }
  @keyframes lc-aurora-anim {
    0%   { transform: translateX(-30%) skewX(-12deg); opacity: 0; }
    20%  { opacity: 0.95; }
    70%  { opacity: 0.6; }
    100% { transform: translateX(30%) skewX(-12deg); opacity: 0; }
  }

  /* ── Light rays (conic-gradient shutter rays) ──────────────────────────── */
  .lc-rays {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 220vmax;
    height: 220vmax;
    margin-left: -110vmax;
    margin-top: -110vmax;
    background: conic-gradient(
      from 0deg,
      transparent 0deg,
      color-mix(in srgb, var(--accent) 60%, transparent) 2deg,
      transparent 6deg,
      transparent 18deg,
      color-mix(in srgb, var(--accent) 45%, transparent) 20deg,
      transparent 24deg,
      transparent 36deg,
      color-mix(in srgb, var(--accent) 55%, transparent) 38deg,
      transparent 42deg,
      transparent 60deg,
      color-mix(in srgb, var(--accent) 50%, transparent) 62deg,
      transparent 66deg,
      transparent 90deg,
      color-mix(in srgb, var(--accent) 60%, transparent) 92deg,
      transparent 96deg,
      transparent 120deg,
      color-mix(in srgb, var(--accent) 45%, transparent) 122deg,
      transparent 126deg,
      transparent 150deg,
      color-mix(in srgb, var(--accent) 55%, transparent) 152deg,
      transparent 156deg,
      transparent 180deg,
      color-mix(in srgb, var(--accent) 50%, transparent) 182deg,
      transparent 186deg,
      transparent 210deg,
      color-mix(in srgb, var(--accent) 60%, transparent) 212deg,
      transparent 216deg,
      transparent 240deg,
      color-mix(in srgb, var(--accent) 45%, transparent) 242deg,
      transparent 246deg,
      transparent 270deg,
      color-mix(in srgb, var(--accent) 55%, transparent) 272deg,
      transparent 276deg,
      transparent 300deg,
      color-mix(in srgb, var(--accent) 50%, transparent) 302deg,
      transparent 306deg,
      transparent 330deg,
      color-mix(in srgb, var(--accent) 60%, transparent) 332deg,
      transparent 336deg,
      transparent 360deg
    );
    transform: scale(0.0) rotate(0deg);
    opacity: 0;
    animation: lc-rays-anim 1500ms cubic-bezier(0.22, 0.85, 0.3, 1) forwards;
    mix-blend-mode: screen;
    filter: blur(2px);
  }
  .lc-rays-mythic {
    animation: lc-rays-mythic-anim 2200ms cubic-bezier(0.22, 0.85, 0.3, 1) forwards;
  }
  @keyframes lc-rays-anim {
    0%   { transform: scale(0) rotate(0deg);    opacity: 0; }
    25%  { transform: scale(0.6) rotate(20deg); opacity: 0.7; }
    100% { transform: scale(1) rotate(50deg);   opacity: 0; }
  }
  @keyframes lc-rays-mythic-anim {
    0%   { transform: scale(0) rotate(0deg);     opacity: 0; }
    20%  { transform: scale(0.55) rotate(20deg); opacity: 0.9; }
    60%  { transform: scale(0.85) rotate(50deg); opacity: 0.55; }
    100% { transform: scale(1.05) rotate(95deg); opacity: 0; }
  }

  /* ── Screen flash ─────────────────────────────────────────────────────── */
  .lc-flash {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 50% 50%, var(--accent) 0%, transparent 70%);
    opacity: 0;
    animation: lc-flash-anim 580ms cubic-bezier(0.22, 0.85, 0.3, 1) forwards;
    mix-blend-mode: screen;
  }
  .lc-flash-mythic {
    animation: lc-flash-mythic-anim 1300ms cubic-bezier(0.22, 0.85, 0.3, 1) forwards;
  }
  @keyframes lc-flash-anim {
    0%   { opacity: 0; }
    25%  { opacity: 0.55; }
    100% { opacity: 0; }
  }
  @keyframes lc-flash-mythic-anim {
    0%   { opacity: 0; }
    12%  { opacity: 0.92; }
    35%  { opacity: 0.6; }
    100% { opacity: 0; }
  }

  /* ── Expanding energy rings ──────────────────────────────────────────── */
  .lc-ring {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 64px;
    height: 64px;
    margin-left: -32px;
    margin-top: -32px;
    border-radius: 50%;
    border: 3px solid var(--accent);
    opacity: 0;
    box-shadow: 0 0 28px var(--accent), inset 0 0 28px var(--accent);
    will-change: transform, opacity;
    animation: lc-ring-anim 1200ms cubic-bezier(0.22, 0.85, 0.3, 1) forwards;
    animation-delay: calc(var(--ring-i) * 110ms);
  }
  .lc-ring-2 { animation-duration: 1400ms; border-width: 2px; }
  .lc-ring-3 { animation-duration: 1600ms; border-width: 1.5px; opacity: 0.7; }
  .lc-ring-4 { animation-duration: 1800ms; border-width: 1px; opacity: 0.55; }
  .lc-ring-5 { animation-duration: 2000ms; border-width: 1px; opacity: 0.4; }
  @keyframes lc-ring-anim {
    0%   { transform: scale(0.1); opacity: 1; }
    60%  { opacity: 0.55; }
    100% { transform: scale(34); opacity: 0; }
  }

  /* ── Lens flare ──────────────────────────────────────────────────────── */
  .lc-flare {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 0;
    height: 0;
    pointer-events: none;
  }
  .lc-flare-core,
  .lc-flare-halo,
  .lc-flare-cross,
  .lc-flare-burst {
    position: absolute;
    left: 0;
    top: 0;
    opacity: 0;
    will-change: transform, opacity;
    mix-blend-mode: screen;
  }
  .lc-flare-core {
    width: 120px;
    height: 120px;
    margin-left: -60px;
    margin-top: -60px;
    background: radial-gradient(circle, #fff 0%, var(--accent) 30%, transparent 70%);
    border-radius: 50%;
    filter: blur(2px);
    animation: lc-flare-core 1500ms cubic-bezier(0.22, 0.85, 0.3, 1) forwards;
  }
  .lc-flare-halo {
    width: 320px;
    height: 320px;
    margin-left: -160px;
    margin-top: -160px;
    background: radial-gradient(circle, color-mix(in srgb, var(--accent) 70%, transparent) 0%, transparent 60%);
    border-radius: 50%;
    filter: blur(8px);
    animation: lc-flare-halo 1800ms cubic-bezier(0.22, 0.85, 0.3, 1) 60ms forwards;
  }
  .lc-flare-cross {
    width: 480px;
    height: 18px;
    margin-left: -240px;
    margin-top: -9px;
    background: linear-gradient(90deg, transparent 0%, var(--accent) 50%, transparent 100%);
    filter: blur(3px);
    animation: lc-flare-cross 1600ms cubic-bezier(0.22, 0.85, 0.3, 1) 40ms forwards;
  }
  .lc-flare-cross::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    width: 18px;
    height: 480px;
    margin-left: -9px;
    margin-top: -240px;
    background: linear-gradient(180deg, transparent 0%, var(--accent) 50%, transparent 100%);
    filter: blur(3px);
  }
  .lc-flare-burst {
    width: 280px;
    height: 280px;
    margin-left: -140px;
    margin-top: -140px;
    background:
      conic-gradient(
        from 22.5deg,
        transparent 0deg, #fff 5deg, transparent 10deg,
        transparent 80deg, #fff 85deg, transparent 90deg,
        transparent 170deg, #fff 175deg, transparent 180deg,
        transparent 260deg, #fff 265deg, transparent 270deg,
        transparent 360deg
      );
    filter: blur(2px);
    animation: lc-flare-burst 1300ms cubic-bezier(0.22, 0.85, 0.3, 1) 30ms forwards;
  }
  @keyframes lc-flare-core {
    0%   { transform: scale(0.2); opacity: 0; }
    18%  { transform: scale(1.4); opacity: 1; }
    100% { transform: scale(0.8); opacity: 0; }
  }
  @keyframes lc-flare-halo {
    0%   { transform: scale(0.3); opacity: 0; }
    25%  { transform: scale(1.0); opacity: 0.9; }
    100% { transform: scale(1.6); opacity: 0; }
  }
  @keyframes lc-flare-cross {
    0%   { transform: scaleX(0) rotate(0deg);    opacity: 0; }
    20%  { transform: scaleX(1.0) rotate(8deg);  opacity: 0.95; }
    100% { transform: scaleX(1.0) rotate(20deg); opacity: 0; }
  }
  @keyframes lc-flare-burst {
    0%   { transform: scale(0) rotate(0deg);     opacity: 0; }
    25%  { transform: scale(1) rotate(15deg);    opacity: 0.85; }
    100% { transform: scale(1.4) rotate(60deg);  opacity: 0; }
  }

  /* ── Particle field ──────────────────────────────────────────────────── */
  .lc-particles {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 0;
    height: 0;
  }
  .lc-particle {
    position: absolute;
    left: 0;
    top: 0;
    width: var(--size);
    height: var(--size);
    margin-left: calc(var(--size) / -2);
    margin-top: calc(var(--size) / -2);
    transform: translate(0, 0) rotate(var(--rot0)) scale(0.15);
    opacity: 0;
    animation: lc-particle-fly var(--dur) cubic-bezier(0.18, 0.72, 0.3, 1) var(--delay) forwards;
    will-change: transform, opacity;
  }
  @keyframes lc-particle-fly {
    0% {
      transform: translate(0, 0) rotate(var(--rot0)) scale(0.12);
      opacity: 0;
    }
    16% {
      opacity: 1;
      transform:
        translate(calc(cos(var(--angle)) * var(--dist) * 0.18),
                  calc(sin(var(--angle)) * var(--dist) * 0.18))
        rotate(calc(var(--rot0) + var(--rotBy) * 0.18))
        scale(1.15);
    }
    100% {
      opacity: 0;
      transform:
        translate(calc(cos(var(--angle)) * var(--dist)),
                  calc(sin(var(--angle)) * var(--dist)))
        rotate(calc(var(--rot0) + var(--rotBy)))
        scale(0.35);
    }
  }

  /* ── Confetti (mythic only) ──────────────────────────────────────────── */
  .lc-confetti {
    position: absolute;
    left: 50%;
    top: 0;
    width: 0;
    height: 0;
  }
  .lc-confetto {
    position: absolute;
    left: 0;
    top: -40px;
    width: var(--size);
    height: var(--size);
    margin-left: calc(var(--size) / -2);
    transform: translate(var(--startX), 0) rotate(var(--rot0));
    opacity: 0;
    animation: lc-confetto-fall var(--dur) cubic-bezier(0.3, 0.05, 0.5, 1) var(--delay) forwards;
    will-change: transform, opacity;
  }
  @keyframes lc-confetto-fall {
    0%   { transform: translate(var(--startX), 0) rotate(var(--rot0)); opacity: 0; }
    10%  { opacity: 0.95; }
    85%  { opacity: 0.6; }
    100% {
      transform: translate(calc(var(--startX) + var(--drift)), var(--fallDist))
                 rotate(calc(var(--rot0) + var(--spin)));
      opacity: 0;
    }
  }

  /* ── Mythic banner ───────────────────────────────────────────────────── */
  .lc-banner-wrap {
    /* Banner sits in the upper third so the reveal panel (which pops 800ms
       after landing) can coexist with the mythic celebration. */
    position: absolute;
    left: 50%;
    top: 22%;
    transform: translate(-50%, -50%);
    pointer-events: none;
    width: min(94vw, 820px);
    height: 220px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: visible;
  }
  .lc-banner-bg {
    position: absolute;
    left: 0; right: 0; top: 50%;
    height: 140px;
    margin-top: -70px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      color-mix(in srgb, var(--accent) 75%, transparent) 12%,
      color-mix(in srgb, var(--accent) 92%, transparent) 50%,
      color-mix(in srgb, var(--accent) 75%, transparent) 88%,
      transparent 100%
    );
    opacity: 0;
    animation: lc-banner-bg 2200ms cubic-bezier(0.22, 0.85, 0.3, 1) 50ms forwards;
    filter: blur(3px);
  }
  .lc-banner-stack {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    z-index: 1;
  }
  .lc-banner {
    font-family: 'Cinzel', serif;
    font-weight: 900;
    font-size: clamp(2.6rem, 8vw, 5rem);
    letter-spacing: 0.18em;
    color: #fffceb;
    text-shadow:
      0 0 12px var(--accent),
      0 0 30px var(--accent),
      0 0 60px color-mix(in srgb, var(--accent) 70%, transparent),
      0 3px 8px rgba(0,0,0,0.65);
    transform: scale(0.6);
    opacity: 0;
    animation: lc-banner-text 2200ms cubic-bezier(0.34, 1.4, 0.5, 1) 80ms forwards;
  }
  .lc-banner-sub {
    font-family: 'JetBrains Mono', monospace;
    font-weight: 700;
    font-size: clamp(0.85rem, 2vw, 1.3rem);
    letter-spacing: 0.4em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--accent) 80%, #fff);
    text-shadow:
      0 0 8px var(--accent),
      0 2px 4px rgba(0,0,0,0.6);
    opacity: 0;
    transform: translateY(8px);
    animation: lc-banner-sub 2200ms cubic-bezier(0.34, 1.4, 0.5, 1) 280ms forwards;
  }
  .lc-banner-shine {
    position: absolute;
    left: -10%;
    right: -10%;
    top: 50%;
    height: 140px;
    margin-top: -70px;
    background: linear-gradient(
      105deg,
      transparent 30%,
      rgba(255,255,255,0.65) 50%,
      transparent 70%
    );
    transform: translateX(-100%);
    opacity: 0;
    animation: lc-banner-shine 2200ms cubic-bezier(0.4, 0, 0.3, 1) 280ms forwards;
    mix-blend-mode: overlay;
  }
  @keyframes lc-banner-bg {
    0%   { opacity: 0; transform: scaleX(0.3); }
    18%  { opacity: 1; transform: scaleX(1); }
    80%  { opacity: 1; }
    100% { opacity: 0; }
  }
  @keyframes lc-banner-text {
    0%   { transform: scale(0.5)  rotate(-2deg); opacity: 0; }
    14%  { transform: scale(1.18) rotate(0deg);  opacity: 1; }
    28%  { transform: scale(1.0)  rotate(0deg);  opacity: 1; }
    80%  { transform: scale(1.0)  rotate(0deg);  opacity: 1; }
    100% { transform: scale(1.18) rotate(0deg);  opacity: 0; }
  }
  @keyframes lc-banner-sub {
    0%   { transform: translateY(8px); opacity: 0; }
    14%  { transform: translateY(0);   opacity: 1; }
    85%  { transform: translateY(0);   opacity: 1; }
    100% { transform: translateY(0);   opacity: 0; }
  }
  @keyframes lc-banner-shine {
    0%   { transform: translateX(-100%); opacity: 0; }
    20%  { opacity: 1; }
    80%  { opacity: 1; }
    100% { transform: translateX(100%); opacity: 0; }
  }

  @media (prefers-reduced-motion: reduce) {
    .lc-flash, .lc-ring, .lc-particle, .lc-banner, .lc-banner-bg,
    .lc-banner-shine, .lc-banner-sub, .lc-aurora, .lc-rays, .lc-vignette,
    .lc-flare-core, .lc-flare-halo, .lc-flare-cross, .lc-flare-burst,
    .lc-confetto {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
    }
  }
</style>
