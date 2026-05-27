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
    centerX = null,
    centerY = null,
    durationMs,
    onComplete,
  }: {
    intensity: number          // 0..1 scalar
    tierColor?: string
    elementColor?: string | null
    tier?: string | null
    subtitle?: string | null   // shown under the banner (e.g. "S+ TIER" or "Mythological")
    // Pixel coords of the wheel center in viewport space. When set,
    // emanating layers (particles, rings, lens flare, portal, sky pillar,
    // light rays, reality cracks) burst from these coords instead of
    // viewport center. Screen-wide layers (flash, vignette, aurora, rim
    // pulse, hue shift) stay screen-anchored regardless.
    centerX?: number | null
    centerY?: number | null
    durationMs?: number        // override; defaults by level (mythic holds longer)
    onComplete?: () => void
  } = $props()

  // CSS custom-prop values for the emanating-layer origin. Default to
  // viewport center when caller didn't pass coords.
  let originX = $derived(centerX != null ? `${centerX}px` : '50vw')
  let originY = $derived(centerY != null ? `${centerY}px` : '50vh')

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

  // "Transcendent" is the cinematic tier above mythic, reserved for the
  // truly cosmic stat rolls — Celestial / Godly / Primordial / Absolute.
  // Gated by tier label (not raw intensity) so a God-grade ITEM still hits
  // mythic, not transcendent — those grades aren't the same kind of
  // moment as a Primordial stat roll. Items + races/archetypes always
  // top out at 'mythic'.
  let isCosmicTier = $derived(
    !!tier && /Celestial|Godly|Primordial|Absolute/i.test(tier),
  )
  let level = $derived(
    isCosmicTier      ? 'transcendent' :
    intensity >= 0.70 ? 'mythic'       :
    intensity >= 0.50 ? 'great'        :
    intensity >= 0.30 ? 'good'         :
    intensity >= 0.10 ? 'basic'        :
    'silent',
  )

  // Default mount duration. Transcendent holds longest — the banner letters
  // type in one at a time and the portal ring rotates a full cycle.
  let effectiveDur = $derived(
    durationMs ??
    (level === 'transcendent' ? 3400 :
     level === 'mythic'       ? 2400 :
     level === 'great'        ? 1700 :
     level === 'good'         ? 1200 :
     level === 'basic'        ? 800  :
     0)
  )

  let particleCount = $derived(
    level === 'transcendent' ? 84 :
    level === 'mythic'       ? 56 :
    level === 'great'        ? 34 :
    level === 'good'         ? 18 :
    level === 'basic'        ? 10 :
    0,
  )

  // Bonus drifting "confetti" / spark trail at mythic + transcendent.
  let confettiCount = $derived(
    level === 'transcendent' ? 42 :
    level === 'mythic'       ? 24 :
    0,
  )

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

  let showRing = $derived(level !== 'silent')
  let ringCount = $derived(
    level === 'transcendent' ? 7 :
    level === 'mythic'       ? 5 :
    level === 'great'        ? 4 :
    level === 'good'         ? 3 :
                                1,
  )
  let showVignette = $derived(level === 'great' || level === 'mythic' || level === 'transcendent')
  let showAurora = $derived(level === 'great' || level === 'mythic' || level === 'transcendent')
  let showRays = $derived(level === 'great' || level === 'mythic' || level === 'transcendent')
  let showFlash = $derived(level === 'great' || level === 'mythic' || level === 'transcendent')
  let showLensFlare = $derived(level === 'mythic' || level === 'transcendent')
  let showBanner = $derived(level === 'mythic' || level === 'transcendent')
  // Transcendent-only layers
  let isTranscendent = $derived(level === 'transcendent')
  let showSkyPillar = $derived(isTranscendent)
  let showPortal = $derived(isTranscendent)
  let showHueShift = $derived(isTranscendent)
  let showRimPulse = $derived(isTranscendent)
  let showRealityCracks = $derived(isTranscendent)
  let crackCount = 12


  function buildParticles() {
    if (particleCount === 0) { particles = []; return }
    const pool =
      level === 'transcendent' ? [...SPRITE_POOLS.great, ...SPRITE_POOLS.mythic] :
      level === 'mythic'       ? [...SPRITE_POOLS.great, ...SPRITE_POOLS.mythic] :
      level === 'great'        ? SPRITE_POOLS.great :
      level === 'good'         ? SPRITE_POOLS.good  :
                                 SPRITE_POOLS.basic
    const out: Particle[] = []
    for (let i = 0; i < particleCount; i++) {
      const slice = (Math.PI * 2) / particleCount
      const angle = i * slice + (Math.random() - 0.5) * slice * 0.8
      const dist =
        level === 'transcendent' ? 260 + Math.random() * 340 :
        level === 'mythic'       ? 220 + Math.random() * 280 :
        level === 'great'        ? 170 + Math.random() * 180 :
        level === 'good'         ? 120 + Math.random() * 120 :
                                    70 + Math.random() * 70
      const baseSize =
        level === 'transcendent' ? 72 + Math.random() * 80 :
        level === 'mythic'       ? 64 + Math.random() * 64 :
        level === 'great'        ? 50 + Math.random() * 40 :
        level === 'good'         ? 36 + Math.random() * 24 :
                                   24 + Math.random() * 16
      out.push({
        id: i,
        sprite: pool[Math.floor(Math.random() * pool.length)],
        angle,
        distance: dist,
        size: baseSize,
        rotation: Math.random() * 360,
        rotateBy: (Math.random() - 0.5) * 720,
        delay: Math.random() * (level === 'transcendent' ? 240 : 80),
        duration: 900 + Math.random() * (level === 'transcendent' ? 1100 : 600),
      })
    }
    particles = out
  }

  function buildCracks() {
    if (!isTranscendent) { crackAngles = []; return }
    const out: number[] = []
    for (let i = 0; i < crackCount; i++) {
      // Even-ish angular spacing with jitter so the radial cracks aren't
      // perfectly symmetrical — feels organic, not stamped.
      const base = (i * 360) / crackCount
      out.push(base + (Math.random() - 0.5) * 24)
    }
    crackAngles = out
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
    buildCracks()
    const t = setTimeout(() => onComplete?.(), effectiveDur)
    return () => clearTimeout(t)
  })

  // Banner copy. The tier label drives the headline so each cosmic stat
  // tier gets its own announcement (Absolute, Primordial, Godly, Celestial
  // all distinct from generic mythic). ZZZ is reserved for "BEYOND MYTHIC"
  // since cosmic stats outrank it.
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

  // For transcendent we render the banner letter-by-letter so the headline
  // "BREAKS IN" rather than popping all at once. Cap the cascade to keep
  // long copy ("BEYOND MYTHIC!") from running off-screen on small phones.
  let bannerLetters = $derived(
    isTranscendent
      ? Array.from(bannerText).map((ch, i) => ({ ch, i }))
      : null,
  )

  // Precomputed crack angles for reality-shatter lines. Computed once at
  // mount and frozen so they don't churn under reactive triggers.
  let crackAngles = $state<number[]>([])

  // Same for orbital flares — 3 satellite lens flares orbit the impact point
  // at staggered angles.
  const ORBITAL_FLARES = [0, 120, 240]
</script>

{#if level !== 'silent'}
  <!-- Fullscreen overlay; pointer-events:none so the reveal modal underneath
       still receives clicks. -->
  <div
    class="lc-root"
    style="--accent: {accent}; --accent2: {accent2}; --tier-color: {tierColor}; --origin-x: {originX}; --origin-y: {originY};"
    aria-hidden="true"
  >
    <!-- TRANSCENDENT-ONLY: reality hue-shift wash. Briefly tints the whole
         viewport with the accent color via a screen-blended layer — feels
         like reality is being rewritten. -->
    {#if showHueShift}
      <div class="lc-hueshift"></div>
    {/if}

    <!-- Edge vignette tint — great + mythic + transcendent. Subtle darken-
         and-tint at the viewport edges that makes the rest of the page
         recede so the eye focuses on the center burst. -->
    {#if showVignette}
      <div
        class="lc-vignette"
        class:lc-vignette-mythic={level === 'mythic'}
        class:lc-vignette-transcendent={level === 'transcendent'}
      ></div>
    {/if}

    <!-- TRANSCENDENT-ONLY: pulsing rim glow at the viewport edges. Reads as
         "the world itself is reacting to this roll." -->
    {#if showRimPulse}
      <div class="lc-rim-pulse"></div>
    {/if}

    <!-- Aurora gradient sweep — great + mythic + transcendent. -->
    {#if showAurora}
      <div class="lc-aurora" class:lc-aurora-transcendent={isTranscendent}></div>
      {#if isTranscendent}
        <!-- Second aurora pass crossing the opposite direction. -->
        <div class="lc-aurora lc-aurora-cross"></div>
      {/if}
    {/if}

    <!-- Light rays radiating from center — great + mythic + transcendent. -->
    {#if showRays}
      <div
        class="lc-rays"
        class:lc-rays-mythic={level === 'mythic'}
        class:lc-rays-transcendent={isTranscendent}
      ></div>
    {/if}

    <!-- TRANSCENDENT-ONLY: vertical sky pillar. Beam of light coming down
         from above through the impact point — the "chosen one" shot. -->
    {#if showSkyPillar}
      <div class="lc-sky-pillar"></div>
      <div class="lc-sky-pillar lc-sky-pillar-core"></div>
    {/if}

    <!-- TRANSCENDENT-ONLY: reality-shatter cracks. Radial light streaks
         that look like the universe just got cracked open at the impact
         point. Pre-randomized angles + delays so they read as a shatter,
         not a synchronized burst. -->
    {#if showRealityCracks}
      <div class="lc-cracks">
        {#each crackAngles as a, i (i)}
          <div
            class="lc-crack"
            style="--crack-rot: {a}deg; --crack-delay: {i * 18}ms;"
          ></div>
        {/each}
      </div>
    {/if}

    <!-- TRANSCENDENT-ONLY: rotating portal ring with notches. Slow rotate
         so it feels like a portal opening at the moment of contact. -->
    {#if showPortal}
      <div class="lc-portal lc-portal-outer"></div>
      <div class="lc-portal lc-portal-inner"></div>
    {/if}

    <!-- Tinted screen flash — great + mythic + transcendent. -->
    {#if showFlash}
      <div
        class="lc-flash"
        class:lc-flash-mythic={level === 'mythic'}
        class:lc-flash-transcendent={isTranscendent}
      ></div>
    {/if}

    <!-- Radial energy rings expanding outward from screen center. -->
    {#if showRing}
      {#each Array.from({ length: ringCount }, (_, i) => i) as i (i)}
        <div class="lc-ring lc-ring-{i + 1}" style="--ring-i: {i};"></div>
      {/each}
    {/if}

    <!-- Lens flare — mythic + transcendent. A bright multi-layered sun
         with cross + starburst at impact center. Transcendent adds 3
         smaller satellite flares orbiting the main one. -->
    {#if showLensFlare}
      <div class="lc-flare" class:lc-flare-transcendent={isTranscendent}>
        <div class="lc-flare-core"></div>
        <div class="lc-flare-halo"></div>
        <div class="lc-flare-cross"></div>
        <div class="lc-flare-burst"></div>
        {#if isTranscendent}
          {#each ORBITAL_FLARES as a, i (i)}
            <div class="lc-flare-orbital" style="--orbit-start: {a}deg; --orbit-delay: {i * 90}ms;"></div>
          {/each}
        {/if}
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

    <!-- Banner — mythic gets a pop, transcendent gets letter-by-letter
         "break-in" reveal so the headline lands one character at a time. -->
    {#if showBanner}
      <div class="lc-banner-wrap" class:lc-banner-wrap-transcendent={isTranscendent}>
        <div class="lc-banner-bg" class:lc-banner-bg-transcendent={isTranscendent}></div>
        <div class="lc-banner-stack">
          {#if isTranscendent && bannerLetters}
            <div class="lc-banner lc-banner-letters">
              {#each bannerLetters as L (L.i)}
                <span
                  class="lc-banner-letter"
                  style="--letter-delay: {120 + L.i * 70}ms;"
                >{L.ch === ' ' ? ' ' : L.ch}</span>
              {/each}
            </div>
          {:else}
            <div class="lc-banner">{bannerText}</div>
          {/if}
          {#if subtitle}
            <div
              class="lc-banner-sub"
              class:lc-banner-sub-transcendent={isTranscendent}
            >{subtitle}</div>
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
    left: var(--origin-x);
    top: var(--origin-y);
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
    left: var(--origin-x);
    top: var(--origin-y);
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
    left: var(--origin-x);
    top: var(--origin-y);
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
    left: var(--origin-x);
    top: var(--origin-y);
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
    left: var(--origin-x);
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

  /* ════════════════════════════════════════════════════════════════════
     TRANSCENDENT-TIER LAYERS
     For Celestial / Godly / Primordial / Absolute stat rolls. These layers
     compound on top of the mythic stack — they don't replace it. The goal
     is "the universe is bending around this number."
     ════════════════════════════════════════════════════════════════════ */

  /* ── Reality hue-shift wash ────────────────────────────────────────── */
  .lc-hueshift {
    position: absolute;
    inset: 0;
    background: radial-gradient(
      ellipse at center,
      color-mix(in srgb, var(--accent) 28%, transparent) 0%,
      color-mix(in srgb, var(--accent) 14%, transparent) 45%,
      transparent 75%
    );
    opacity: 0;
    mix-blend-mode: screen;
    animation: lc-hueshift 3000ms cubic-bezier(0.22, 0.85, 0.3, 1) forwards;
  }
  @keyframes lc-hueshift {
    0%   { opacity: 0; filter: hue-rotate(0deg); }
    15%  { opacity: 0.95; filter: hue-rotate(20deg); }
    50%  { opacity: 0.65; filter: hue-rotate(-15deg); }
    85%  { opacity: 0.4; filter: hue-rotate(8deg); }
    100% { opacity: 0; filter: hue-rotate(0deg); }
  }

  /* ── Heavier transcendent vignette ─────────────────────────────────── */
  .lc-vignette-transcendent {
    animation: lc-vignette-trans-anim 3100ms cubic-bezier(0.22, 0.85, 0.3, 1) forwards;
  }
  @keyframes lc-vignette-trans-anim {
    0%   { opacity: 0; }
    15%  { opacity: 1; }
    70%  { opacity: 0.85; }
    100% { opacity: 0; }
  }

  /* ── Viewport rim pulse — the screen edges glow with the accent ──── */
  .lc-rim-pulse {
    position: absolute;
    inset: 0;
    border-radius: 0;
    box-shadow:
      inset 0 0 40px 6px color-mix(in srgb, var(--accent) 85%, transparent),
      inset 0 0 120px 20px color-mix(in srgb, var(--accent) 55%, transparent),
      inset 0 0 240px 40px color-mix(in srgb, var(--accent) 25%, transparent);
    opacity: 0;
    animation: lc-rim-pulse 2800ms cubic-bezier(0.22, 0.85, 0.3, 1) forwards;
    pointer-events: none;
  }
  @keyframes lc-rim-pulse {
    0%   { opacity: 0; }
    12%  { opacity: 0.95; }
    35%  { opacity: 0.5; }
    55%  { opacity: 0.85; }
    78%  { opacity: 0.45; }
    100% { opacity: 0; }
  }

  /* ── Cross-direction aurora ────────────────────────────────────────── */
  .lc-aurora-transcendent {
    animation-duration: 2800ms;
  }
  .lc-aurora-cross {
    transform: translateX(30%) skewX(12deg);
    animation: lc-aurora-cross-anim 2600ms cubic-bezier(0.36, 0.4, 0.3, 1) 200ms forwards;
  }
  @keyframes lc-aurora-cross-anim {
    0%   { transform: translateX(30%) skewX(12deg); opacity: 0; }
    25%  { opacity: 0.9; }
    100% { transform: translateX(-30%) skewX(12deg); opacity: 0; }
  }

  /* ── Wider, longer rays for transcendent ───────────────────────────── */
  .lc-rays-transcendent {
    animation: lc-rays-transcendent-anim 3000ms cubic-bezier(0.22, 0.85, 0.3, 1) forwards;
  }
  @keyframes lc-rays-transcendent-anim {
    0%   { transform: scale(0) rotate(0deg);    opacity: 0; }
    16%  { transform: scale(0.55) rotate(15deg); opacity: 1; }
    55%  { transform: scale(0.9) rotate(55deg);  opacity: 0.7; }
    100% { transform: scale(1.15) rotate(140deg); opacity: 0; }
  }

  /* ── Heavier transcendent flash ────────────────────────────────────── */
  .lc-flash-transcendent {
    animation: lc-flash-trans-anim 1900ms cubic-bezier(0.22, 0.85, 0.3, 1) forwards;
  }
  @keyframes lc-flash-trans-anim {
    0%   { opacity: 0; }
    8%   { opacity: 1; }
    22%  { opacity: 0.7; }
    45%  { opacity: 0.9; }    /* second flash beat */
    65%  { opacity: 0.45; }
    100% { opacity: 0; }
  }

  /* ── Sky pillar — vertical beam through the impact point ───────────── */
  .lc-sky-pillar {
    position: absolute;
    left: var(--origin-x);
    top: 0;
    bottom: 0;
    width: 360px;
    margin-left: -180px;
    background: linear-gradient(
      180deg,
      transparent 0%,
      color-mix(in srgb, var(--accent) 30%, transparent) 18%,
      color-mix(in srgb, var(--accent) 70%, transparent) 50%,
      color-mix(in srgb, var(--accent) 30%, transparent) 82%,
      transparent 100%
    );
    transform: scaleX(0);
    transform-origin: 50% 50%;
    opacity: 0;
    filter: blur(18px);
    mix-blend-mode: screen;
    animation: lc-sky-pillar 3000ms cubic-bezier(0.22, 0.85, 0.3, 1) 60ms forwards;
  }
  .lc-sky-pillar-core {
    width: 80px;
    margin-left: -40px;
    background: linear-gradient(
      180deg,
      transparent 0%,
      color-mix(in srgb, var(--accent) 60%, transparent) 15%,
      #ffffff 50%,
      color-mix(in srgb, var(--accent) 60%, transparent) 85%,
      transparent 100%
    );
    filter: blur(4px);
    animation: lc-sky-pillar-core 2600ms cubic-bezier(0.22, 0.85, 0.3, 1) 120ms forwards;
  }
  @keyframes lc-sky-pillar {
    0%   { transform: scaleX(0);   opacity: 0; }
    18%  { transform: scaleX(1);   opacity: 1; }
    70%  { transform: scaleX(1.05); opacity: 0.7; }
    100% { transform: scaleX(0.6); opacity: 0; }
  }
  @keyframes lc-sky-pillar-core {
    0%   { transform: scaleX(0); opacity: 0; }
    14%  { transform: scaleX(1); opacity: 1; }
    60%  { transform: scaleX(1); opacity: 0.95; }
    100% { transform: scaleX(0.5); opacity: 0; }
  }

  /* ── Reality cracks — radial light streaks from center ─────────────── */
  .lc-cracks {
    position: absolute;
    left: var(--origin-x);
    top: var(--origin-y);
    width: 0;
    height: 0;
  }
  .lc-crack {
    position: absolute;
    left: 0;
    top: 0;
    width: 130vmax;
    height: 4px;
    margin-top: -2px;
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--accent) 95%, white) 0%,
      color-mix(in srgb, var(--accent) 70%, transparent) 40%,
      transparent 85%
    );
    transform: rotate(var(--crack-rot)) scaleX(0);
    transform-origin: 0 50%;
    opacity: 0;
    filter: blur(1.5px) drop-shadow(0 0 14px var(--accent));
    animation: lc-crack 1700ms cubic-bezier(0.18, 0.85, 0.25, 1) var(--crack-delay) forwards;
    mix-blend-mode: screen;
  }
  @keyframes lc-crack {
    0%   { transform: rotate(var(--crack-rot)) scaleX(0);    opacity: 0; }
    10%  { opacity: 1; }
    22%  { transform: rotate(var(--crack-rot)) scaleX(1);    opacity: 1; }
    100% { transform: rotate(var(--crack-rot)) scaleX(1.05); opacity: 0; }
  }

  /* ── Portal ring — rotating notched ring around impact ─────────────── */
  .lc-portal {
    position: absolute;
    left: var(--origin-x);
    top: var(--origin-y);
    border-radius: 50%;
    border: 4px dashed var(--accent);
    box-shadow:
      0 0 30px var(--accent),
      inset 0 0 30px color-mix(in srgb, var(--accent) 70%, transparent);
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.2) rotate(0deg);
    will-change: transform, opacity;
    mix-blend-mode: screen;
  }
  .lc-portal-outer {
    width: 460px;
    height: 460px;
    border-width: 5px;
    animation: lc-portal-outer 2800ms cubic-bezier(0.22, 0.85, 0.3, 1) 80ms forwards;
  }
  .lc-portal-inner {
    width: 280px;
    height: 280px;
    border-width: 3px;
    border-style: dotted;
    animation: lc-portal-inner 2800ms cubic-bezier(0.22, 0.85, 0.3, 1) 220ms forwards;
  }
  @keyframes lc-portal-outer {
    0%   { transform: translate(-50%, -50%) scale(0.15) rotate(0deg);   opacity: 0; }
    15%  { transform: translate(-50%, -50%) scale(1.05) rotate(45deg);  opacity: 1; }
    75%  { transform: translate(-50%, -50%) scale(1.0)  rotate(220deg); opacity: 0.85; }
    100% { transform: translate(-50%, -50%) scale(1.4)  rotate(300deg); opacity: 0; }
  }
  @keyframes lc-portal-inner {
    0%   { transform: translate(-50%, -50%) scale(0.15) rotate(0deg);    opacity: 0; }
    18%  { transform: translate(-50%, -50%) scale(1.05) rotate(-50deg);  opacity: 0.95; }
    75%  { transform: translate(-50%, -50%) scale(1.0)  rotate(-220deg); opacity: 0.8; }
    100% { transform: translate(-50%, -50%) scale(0.6)  rotate(-300deg); opacity: 0; }
  }

  /* ── Orbital satellite lens flares ─────────────────────────────────── */
  .lc-flare-orbital {
    position: absolute;
    left: 0;
    top: 0;
    width: 70px;
    height: 70px;
    margin-left: -35px;
    margin-top: -35px;
    background: radial-gradient(circle, #fff 0%, var(--accent) 35%, transparent 70%);
    border-radius: 50%;
    filter: blur(3px);
    opacity: 0;
    mix-blend-mode: screen;
    animation: lc-orbital 2400ms cubic-bezier(0.22, 0.85, 0.3, 1) var(--orbit-delay) forwards;
    transform-origin: 0 0;
  }
  @keyframes lc-orbital {
    0% {
      transform: rotate(var(--orbit-start)) translateX(0) rotate(calc(-1 * var(--orbit-start))) scale(0);
      opacity: 0;
    }
    20% {
      opacity: 1;
      transform: rotate(calc(var(--orbit-start) + 60deg)) translateX(140px) rotate(calc(-1 * (var(--orbit-start) + 60deg))) scale(1);
    }
    100% {
      opacity: 0;
      transform: rotate(calc(var(--orbit-start) + 300deg)) translateX(280px) rotate(calc(-1 * (var(--orbit-start) + 300deg))) scale(0.6);
    }
  }
  .lc-flare-transcendent .lc-flare-core { animation-duration: 2000ms; }
  .lc-flare-transcendent .lc-flare-halo { animation-duration: 2400ms; }

  /* ── Transcendent banner — letter cascade + bigger background ──────── */
  .lc-banner-wrap-transcendent {
    height: 280px;
    width: min(96vw, 1000px);
  }
  .lc-banner-bg-transcendent {
    height: 180px;
    margin-top: -90px;
    animation: lc-banner-bg-trans 3000ms cubic-bezier(0.22, 0.85, 0.3, 1) 80ms forwards;
  }
  @keyframes lc-banner-bg-trans {
    0%   { opacity: 0; transform: scaleX(0.2); }
    14%  { opacity: 1; transform: scaleX(1); }
    85%  { opacity: 1; }
    100% { opacity: 0; }
  }
  .lc-banner-letters {
    display: inline-flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0;
    font-size: clamp(3rem, 9vw, 6rem);
    letter-spacing: 0.2em;
  }
  .lc-banner-letter {
    display: inline-block;
    opacity: 0;
    transform: translateY(40px) scale(0.4) rotate(-12deg);
    filter: blur(8px);
    animation: lc-letter-drop 1800ms cubic-bezier(0.34, 1.5, 0.5, 1) var(--letter-delay) forwards;
    text-shadow:
      0 0 12px var(--accent),
      0 0 30px var(--accent),
      0 0 60px color-mix(in srgb, var(--accent) 80%, transparent),
      0 3px 8px rgba(0,0,0,0.7);
    color: #fffceb;
    will-change: transform, opacity, filter;
  }
  @keyframes lc-letter-drop {
    0%   { opacity: 0; transform: translateY(40px) scale(0.4) rotate(-12deg); filter: blur(8px); }
    35%  { opacity: 1; transform: translateY(-10px) scale(1.25) rotate(2deg); filter: blur(0); }
    55%  { opacity: 1; transform: translateY(0)   scale(1)    rotate(0deg);  filter: blur(0); }
    85%  { opacity: 1; transform: translateY(0)   scale(1)    rotate(0deg);  filter: blur(0); }
    100% { opacity: 0; transform: translateY(-20px) scale(1.15) rotate(0deg); filter: blur(4px); }
  }
  .lc-banner-sub-transcendent {
    font-size: clamp(0.95rem, 2.2vw, 1.5rem);
    letter-spacing: 0.5em;
    animation: lc-banner-sub-trans 3000ms cubic-bezier(0.34, 1.4, 0.5, 1) 1100ms forwards;
  }
  @keyframes lc-banner-sub-trans {
    0%   { transform: translateY(12px); opacity: 0; letter-spacing: 0.2em; }
    20%  { transform: translateY(0);    opacity: 1; letter-spacing: 0.5em; }
    85%  { transform: translateY(0);    opacity: 1; letter-spacing: 0.5em; }
    100% { transform: translateY(0);    opacity: 0; letter-spacing: 0.6em; }
  }

  @media (prefers-reduced-motion: reduce) {
    .lc-flash, .lc-ring, .lc-particle, .lc-banner, .lc-banner-bg,
    .lc-banner-shine, .lc-banner-sub, .lc-aurora, .lc-rays, .lc-vignette,
    .lc-flare-core, .lc-flare-halo, .lc-flare-cross, .lc-flare-burst,
    .lc-confetto, .lc-hueshift, .lc-rim-pulse, .lc-sky-pillar, .lc-crack,
    .lc-portal, .lc-flare-orbital, .lc-banner-letter {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
    }
  }
</style>
