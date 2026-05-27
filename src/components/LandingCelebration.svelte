<script lang="ts">
  // Tier-scaled landing celebration overlay. Mounted by SpinWheel on result
  // landing; renders particle bursts, expanding rings, screen flash, and
  // (for mythic+) a sustained banner so the player FEELS the rarity of what
  // they just rolled. Intensity is the 0..1 scalar from tierIntensity() so
  // F-tier ≈ 0 (silent) and Absolute+ ≈ 1 (cinematic).
  //
  // Five levels:
  //   0.00–0.25  mundane    — no extra VFX (handled by skipping mount)
  //   0.25–0.50  basic      — small particle puff
  //   0.50–0.65  good       — element-themed energy ring + mid burst
  //   0.65–0.85  great      — full-screen tinted flash + big shockwave + premium sprites
  //   0.85–1.00  mythic     — sustained banner + slow-mo + sprite storm
  //
  // The component is fire-and-forget: parent passes intensity + colors,
  // we mount, animate, fire onComplete, and unmount.
  import { onMount } from 'svelte'

  let {
    intensity,
    tierColor = '#f0c040',
    elementColor = null,
    tier = null,
    durationMs = 1800,
    onComplete,
  }: {
    intensity: number          // 0..1 scalar
    tierColor?: string
    elementColor?: string | null
    tier?: string | null
    durationMs?: number
    onComplete?: () => void
  } = $props()

  // Primary accent — element color when available (so a Fire roll bursts red,
  // not generic gold), tier color otherwise.
  let accent = $derived(elementColor ?? tierColor)

  // ── Particle config — count + asset palette scales with intensity ────────
  // Premium sprite pool lives at /fx/p/ (42 PNGs: bursts, stars, rings, etc.).
  // We pick from sub-pools depending on intensity so basic rolls don't pull
  // the same heavyweight assets as mythic rolls.
  const SPRITE_POOLS = {
    basic:  ['star_a.png', 'star_b.png', 'cstar_a.png', 'cstar_b.png'],
    good:   ['burst_a.png', 'burst_b.png', 'star_c.png', 'star_d.png', 'magic_a.png', 'magic_b.png'],
    great:  ['burst_c.png', 'burst_d.png', 'impact_a.png', 'impact_b.png', 'rays_a.png', 'spiro_a.png', 'star_e.png', 'star_f.png'],
    mythic: ['impact_c.png', 'impact_d.png', 'rays_b.png', 'rays_c.png', 'spiro_b.png', 'spiro_c.png', 'flare_a.png', 'flare_b.png', 'magic_d.png', 'magic_e.png'],
  }

  let level = $derived(
    intensity >= 0.85 ? 'mythic' :
    intensity >= 0.65 ? 'great'  :
    intensity >= 0.50 ? 'good'   :
    intensity >= 0.25 ? 'basic'  :
    'silent',
  )

  let particleCount = $derived(
    level === 'mythic' ? 38 :
    level === 'great'  ? 24 :
    level === 'good'   ? 14 :
    level === 'basic'  ? 8  :
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

  let particles = $state<Particle[]>([])
  let showRing = $derived(level === 'good' || level === 'great' || level === 'mythic')
  let showFlash = $derived(level === 'great' || level === 'mythic')
  let showBanner = $derived(level === 'mythic')

  // Stable pool seed per mount so particles don't re-shuffle on every keystroke
  // anywhere else in the tree.
  function buildParticles() {
    if (particleCount === 0) { particles = []; return }
    const pool =
      level === 'mythic' ? [...SPRITE_POOLS.great, ...SPRITE_POOLS.mythic] :
      level === 'great'  ? SPRITE_POOLS.great :
      level === 'good'   ? SPRITE_POOLS.good  :
                           SPRITE_POOLS.basic
    const out: Particle[] = []
    for (let i = 0; i < particleCount; i++) {
      // Spread evenly around the circle with a touch of jitter so the burst
      // reads as energetic, not perfectly symmetrical.
      const slice = (Math.PI * 2) / particleCount
      const angle = i * slice + (Math.random() - 0.5) * slice * 0.7
      const dist =
        level === 'mythic' ? 180 + Math.random() * 220 :
        level === 'great'  ? 140 + Math.random() * 160 :
        level === 'good'   ? 100 + Math.random() * 100 :
                              60 + Math.random() * 60
      const baseSize =
        level === 'mythic' ? 56 + Math.random() * 48 :
        level === 'great'  ? 44 + Math.random() * 32 :
        level === 'good'   ? 32 + Math.random() * 20 :
                             22 + Math.random() * 14
      out.push({
        id: i,
        sprite: pool[Math.floor(Math.random() * pool.length)],
        angle,
        distance: dist,
        size: baseSize,
        rotation: Math.random() * 360,
        rotateBy: (Math.random() - 0.5) * 720,
        delay: Math.random() * 80,
        duration: 700 + Math.random() * 500,
      })
    }
    particles = out
  }

  onMount(() => {
    if (level === 'silent') {
      onComplete?.()
      return
    }
    buildParticles()
    const t = setTimeout(() => onComplete?.(), durationMs)
    return () => clearTimeout(t)
  })

  // Mythic banner copy. We treat anything ≥ 0.85 as mythic; the tier label
  // itself drives the headline so SSS+ vs Absolute show different copy.
  let bannerText = $derived(
    !tier ? 'MYTHIC ROLL' :
    /Absolute/i.test(tier) ? 'ABSOLUTE!' :
    /Primordial/i.test(tier) ? 'PRIMORDIAL!' :
    /Godly|God/i.test(tier) ? 'GODLY!' :
    /Celestial/i.test(tier) ? 'CELESTIAL!' :
    /ZZZ/.test(tier) ? 'BEYOND MYTHIC!' :
    /ZZ/.test(tier) ? 'TRANSCENDENT!' :
    /^Z/.test(tier) ? 'MYTHIC!' :
    'LEGENDARY!'
  )
</script>

{#if level !== 'silent'}
  <!-- Fullscreen overlay; pointer-events:none so the reveal modal underneath
       still receives clicks. -->
  <div
    class="lc-root"
    style="--accent: {accent}; --tier-color: {tierColor};"
    aria-hidden="true"
  >
    <!-- Tinted screen flash — great + mythic only -->
    {#if showFlash}
      <div class="lc-flash" class:lc-flash-mythic={level === 'mythic'}></div>
    {/if}

    <!-- Radial energy ring(s) expanding outward from screen center -->
    {#if showRing}
      <div class="lc-ring lc-ring-1"></div>
      <div class="lc-ring lc-ring-2"></div>
      {#if level === 'mythic' || level === 'great'}
        <div class="lc-ring lc-ring-3"></div>
      {/if}
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
            filter: drop-shadow(0 0 {Math.round(p.size / 5)}px {accent});
          "
        />
      {/each}
    </div>

    <!-- Mythic-only sustained banner -->
    {#if showBanner}
      <div class="lc-banner-wrap">
        <div class="lc-banner-bg"></div>
        <div class="lc-banner">{bannerText}</div>
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

  /* ── Screen flash ─────────────────────────────────────────────────────── */
  .lc-flash {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 50% 50%, var(--accent) 0%, transparent 70%);
    opacity: 0;
    animation: lc-flash-anim 480ms cubic-bezier(0.22, 0.85, 0.3, 1) forwards;
    mix-blend-mode: screen;
  }
  .lc-flash-mythic {
    animation: lc-flash-mythic-anim 1100ms cubic-bezier(0.22, 0.85, 0.3, 1) forwards;
  }
  @keyframes lc-flash-anim {
    0%   { opacity: 0; }
    25%  { opacity: 0.42; }
    100% { opacity: 0; }
  }
  @keyframes lc-flash-mythic-anim {
    0%   { opacity: 0; }
    15%  { opacity: 0.78; }
    40%  { opacity: 0.45; }
    100% { opacity: 0; }
  }

  /* ── Expanding energy rings ──────────────────────────────────────────── */
  .lc-ring {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 60px;
    height: 60px;
    margin-left: -30px;
    margin-top: -30px;
    border-radius: 50%;
    border: 3px solid var(--accent);
    opacity: 0;
    box-shadow: 0 0 24px var(--accent), inset 0 0 24px var(--accent);
    will-change: transform, opacity;
  }
  .lc-ring-1 { animation: lc-ring-anim 900ms cubic-bezier(0.22, 0.85, 0.3, 1) forwards; }
  .lc-ring-2 { animation: lc-ring-anim 1200ms cubic-bezier(0.22, 0.85, 0.3, 1) 90ms forwards; border-width: 2px; }
  .lc-ring-3 { animation: lc-ring-anim 1500ms cubic-bezier(0.22, 0.85, 0.3, 1) 200ms forwards; border-width: 1px; opacity: 0.6; }
  @keyframes lc-ring-anim {
    0%   { transform: scale(0.1); opacity: 0.95; }
    60%  { opacity: 0.6; }
    100% { transform: scale(28); opacity: 0; }
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
    transform: translate(0, 0) rotate(var(--rot0)) scale(0.2);
    opacity: 0;
    animation: lc-particle-fly var(--dur) cubic-bezier(0.18, 0.72, 0.3, 1) var(--delay) forwards;
    will-change: transform, opacity;
  }
  @keyframes lc-particle-fly {
    0% {
      transform:
        translate(0, 0)
        rotate(var(--rot0))
        scale(0.15);
      opacity: 0;
    }
    18% {
      opacity: 1;
      transform:
        translate(calc(cos(var(--angle)) * var(--dist) * 0.18),
                  calc(sin(var(--angle)) * var(--dist) * 0.18))
        rotate(calc(var(--rot0) + var(--rotBy) * 0.18))
        scale(1.05);
    }
    100% {
      opacity: 0;
      transform:
        translate(calc(cos(var(--angle)) * var(--dist)),
                  calc(sin(var(--angle)) * var(--dist)))
        rotate(calc(var(--rot0) + var(--rotBy)))
        scale(0.4);
    }
  }

  /* ── Mythic banner ───────────────────────────────────────────────────── */
  .lc-banner-wrap {
    /* Banner sits in the upper third so the reveal panel (which pops at
       viewport center after 500ms) can coexist with the mythic celebration
       instead of fighting it for the same pixels. */
    position: absolute;
    left: 50%;
    top: 18%;
    transform: translate(-50%, -50%);
    pointer-events: none;
    width: min(92vw, 720px);
    height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: visible;
  }
  .lc-banner-bg {
    position: absolute;
    left: 0; right: 0; top: 50%;
    height: 110px;
    margin-top: -55px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      color-mix(in srgb, var(--accent) 70%, transparent) 12%,
      color-mix(in srgb, var(--accent) 85%, transparent) 50%,
      color-mix(in srgb, var(--accent) 70%, transparent) 88%,
      transparent 100%
    );
    opacity: 0;
    animation: lc-banner-bg 1500ms cubic-bezier(0.22, 0.85, 0.3, 1) 50ms forwards;
    filter: blur(2px);
  }
  .lc-banner {
    position: relative;
    font-family: 'Cinzel', serif;
    font-weight: 900;
    font-size: clamp(2.2rem, 7vw, 4.2rem);
    letter-spacing: 0.16em;
    color: #fffceb;
    text-shadow:
      0 0 8px var(--accent),
      0 0 24px var(--accent),
      0 2px 6px rgba(0,0,0,0.6);
    transform: scale(0.6);
    opacity: 0;
    animation: lc-banner-text 1500ms cubic-bezier(0.34, 1.4, 0.5, 1) 80ms forwards;
    z-index: 1;
  }
  .lc-banner-shine {
    position: absolute;
    left: -10%;
    right: -10%;
    top: 50%;
    height: 110px;
    margin-top: -55px;
    background: linear-gradient(
      105deg,
      transparent 30%,
      rgba(255,255,255,0.55) 50%,
      transparent 70%
    );
    transform: translateX(-100%);
    opacity: 0;
    animation: lc-banner-shine 1500ms cubic-bezier(0.4, 0, 0.3, 1) 250ms forwards;
    mix-blend-mode: overlay;
  }
  @keyframes lc-banner-bg {
    0%   { opacity: 0; transform: scaleX(0.3); }
    20%  { opacity: 1; transform: scaleX(1); }
    75%  { opacity: 1; }
    100% { opacity: 0; }
  }
  @keyframes lc-banner-text {
    0%   { transform: scale(0.55); opacity: 0; }
    18%  { transform: scale(1.12); opacity: 1; }
    32%  { transform: scale(1.0);  opacity: 1; }
    75%  { transform: scale(1.0);  opacity: 1; }
    100% { transform: scale(1.18); opacity: 0; }
  }
  @keyframes lc-banner-shine {
    0%   { transform: translateX(-100%); opacity: 0; }
    20%  { opacity: 1; }
    80%  { opacity: 1; }
    100% { transform: translateX(100%); opacity: 0; }
  }

  @media (prefers-reduced-motion: reduce) {
    .lc-flash, .lc-ring, .lc-particle, .lc-banner, .lc-banner-bg, .lc-banner-shine {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
    }
  }
</style>
