<script lang="ts">
  import { getPerfTier } from '$lib/perf'
  interface Props {
    type: string
    color?: string
    size?: number
    direction?: 'ltr' | 'rtl' | 'center'
    grade?: string      // F | E | D | C | B | A | S | SS | SSS | God
    attackType?: string // attack | aoe | heal | buff | debuff | summon | passive
  }
  let { type, color = '#ffffff', size = 100, direction = 'center', grade = 'C', attackType = 'attack' }: Props = $props()

  // Grade → intensity index (0=F … 9=God)
  const GRADE_IDX: Record<string, number> = { F: 0, E: 1, D: 2, C: 3, B: 4, A: 5, S: 6, SS: 7, SSS: 8, God: 9, Godly: 9 }
  let gradeIdx = $derived(GRADE_IDX[grade ?? 'C'] ?? 3)

  // Scale multipliers by grade
  const GRADE_SCALE  = [0.75, 0.85, 0.95, 1.0, 1.15, 1.30, 1.60, 2.00, 2.50, 3.20]
  const GRADE_SPREAD = [0.80, 0.85, 0.90, 1.0, 1.10, 1.20, 1.40, 1.60, 2.00, 2.50]
  let scaleMult  = $derived(GRADE_SCALE[gradeIdx] ?? 1.0)
  let spreadMult = $derived(GRADE_SPREAD[gradeIdx] ?? 1.0)

  // Shockwave rings — expanding concentric rings behind the main FX.
  // Tuned per FX category so power + spell hits feel weighty at every
  // grade, while weapon slashes keep their grade-scaled rendering as the
  // primary intensity signal.
  //   slash (weapon):  0 / 0 / 0 / 0 / 0 / 0 / 0 / 0 / 1 / 2   (SSS+ only)
  //   dodge / shield:  0  (no shockwaves — separate kinetic anims)
  //   everything else (powers + spells): 0 / 0 / 1 / 1 / 2 / 2 / 3 / 3 / 3 / 3
  //                                       F   E   D   C   B   A   S   SS  SSS God
  let shockwaveCount = $derived.by(() => {
    if (type === 'slash')                       return gradeIdx >= 9 ? 2 : gradeIdx >= 8 ? 1 : 0
    if (type === 'dodge' || type === 'shield')  return 0
    if (gradeIdx >= 6) return 3
    if (gradeIdx >= 4) return 2
    if (gradeIdx >= 2) return 1
    return 0
  })

  // Per-grade slash intensity for weapon attacks. The slash SVG renders this
  // many primary blade lines (plus matching echoes + sparks) so an F-grade
  // weapon shows a single muted swipe and a God-tier weapon erupts into a
  // screen-filling 8-line crosscut.
  //   F (0) → 1 slash · E (1) → 1 · D (2) → 2 · C (3) → 3 · B (4) → 3 ·
  //   A (5) → 4 · S (6) → 5 · SS (7) → 6 · SSS (8) → 7 · God (9) → 8
  const _SLASH_COUNTS = [1, 1, 2, 3, 3, 4, 5, 6, 7, 8]
  let slashCount = $derived(_SLASH_COUNTS[gradeIdx] ?? 3)

  // Procedurally-laid slash lines. Each line is a full chord across the
  // 100×100 viewBox at a DIFFERENT angle — the bundle reads as a flurry
  // of cuts coming from many directions converging on the target rather
  // than a single fan. Lengths and widths taper with index so the first
  // strike is the heaviest. Angles are deterministic per grade so the
  // same character's slashes don't shuffle on every render.
  interface SlashLine { x1: number; y1: number; x2: number; y2: number; w: number; delay: number }
  let slashLines = $derived.by<SlashLine[]>(() => {
    const lines: SlashLine[] = []
    const n = slashCount
    // Deterministic angle seed so the bundle looks consistent for a given
    // grade but varies between grades.
    const baseDeg = 22 + gradeIdx * 11
    const stepDeg = n > 0 ? 360 / n : 0
    for (let i = 0; i < n; i++) {
      // Small deterministic jitter so equal-step angles don't look mechanical.
      const jitter = ((i * 37) % 23) - 11
      const angleDeg = baseDeg + stepDeg * i + jitter
      const angle = (angleDeg * Math.PI) / 180
      const len = 38 + (i % 3) * 2          // slight length variation per index
      const cos = Math.cos(angle), sin = Math.sin(angle)
      // Top-most line is the thickest, trailing ones taper down.
      const w = Math.max(1.6, 4.2 - i * 0.32)
      const delay = i * 0.04
      lines.push({
        x1: 50 - cos * len, y1: 50 - sin * len,
        x2: 50 + cos * len, y2: 50 + sin * len,
        w, delay,
      })
    }
    return lines
  })

  // Grade CSS class for filter/brightness effects
  let gradeClass = $derived(
    gradeIdx >= 9 ? 'fx-grade-god' :
    gradeIdx >= 8 ? 'fx-grade-sss' :
    gradeIdx >= 7 ? 'fx-grade-ss' :
    gradeIdx >= 6 ? 'fx-grade-s' : ''
  )

  // Tier band — drives the per-element 4-variant visual identity.
  //   F, E, D       → 'small'   (single projectile / quick burst)
  //   C, B, A       → 'medium'  (orbiting build-up → directional detonation)
  //   S, SS, SSS    → 'large'   (sky-falling impact + layered shockwaves)
  //   God / Godly   → 'epic'    (screen-covering signature moment)
  type TierBand = 'small' | 'medium' | 'large' | 'epic'
  let tierBand = $derived<TierBand>(
    gradeIdx >= 9 ? 'epic' :
    gradeIdx >= 6 ? 'large' :
    gradeIdx >= 3 ? 'medium' :
    'small'
  )

  let isRtl = $derived(direction === 'rtl')

  // (Legacy `noFlyTypes` / `swirlTypes` / `crashTypes` sets were retired
  // when flyClass stopped applying directional translations — kept the
  // names here as a breadcrumb in case the trajectory animations ever
  // come back for specific edge cases.)

  // All damage attacks now render STATIONARY at their anchor point. The
  // legacy `fx-ltr-arc` / `fx-rtl-crash` / `fx-ltr-swirl` translate-across-
  // screen animations made every directional attack look like it was
  // launching itself off the target's card — replaced with no-op '' so
  // the SVG plays in place. Special-purpose attackType animations (aoe
  // burst, heal rise, buff pulse, debuff spread, summon portal) still
  // apply because they're in-place motions (expand / pulse / rise),
  // not directional travel.
  let flyClass = $derived(
    attackType === 'aoe'    ? 'fx-aoe-burst' :
    attackType === 'heal'   ? 'fx-heal-rise' :
    attackType === 'buff'   ? 'fx-buff-pulse' :
    attackType === 'debuff' ? 'fx-debuff-spread' :
    attackType === 'summon' ? 'fx-summon-portal' :
    ''
  )

  // ─── Particle sprite definitions ─────────────────────────────────────────
  const K  = '/fx/k/'   // Kenney pack — base sprites
  const CI = '/fx/c/'   // Complex impacts (single-shot impact discs)
  const CF = '/fx/c/'
  const CS = '/fx/c/'
  const P  = '/fx/p/'   // Premium pack — colored stars, magic, spirowires,
                        // energyballs, lightrays, complex bursts/flares.
                        // Used by the 7 new element banks below.

  interface Sprite { src: string; x: number; y: number; tx: number; ty: number; rot: number; scale: number; delay: number; size: number }

  function p(src: string, x: number, y: number, tx: number, ty: number, rot: number, scale: number, delay: number, sz = 24): Sprite {
    return { src, x, y, tx, ty, rot, scale, delay, size: sz }
  }

  const PARTICLES: Record<string, Sprite[]> = {
    slash: [
      p(K+'slash_01.png',   50, 45,  30, -25, -20, 1.2, 0.00, 28),
      p(K+'slash_02.png',   50, 50, -28, -18,  30, 1.0, 0.05, 22),
      p(K+'slash_03.png',   50, 48,  15, -35,  10, 1.1, 0.08, 20),
      p(K+'spark_05.png',   50, 50,  40, -20,  45, 0.8, 0.12, 16),
      p(K+'spark_07.png',   50, 50, -35, -28, -35, 0.9, 0.10, 14),
      p(K+'scorch_01.png',  50, 55,  10,  20,   0, 0.7, 0.18, 18),
      p(CI+'impact_5.png',  50, 50,   0,   0,   0, 1.4, 0.15, 32),
    ],
    fire: [
      p(K+'flame_01.png',   50, 50,  -8, -40,  10, 1.3, 0.00, 30),
      p(K+'flame_03.png',   50, 50,  18, -35, -12, 1.1, 0.06, 26),
      p(K+'fire_01.png',    50, 50, -20, -30,   5, 1.2, 0.10, 24),
      p(K+'scorch_01.png',  50, 58,  25,  15,  20, 0.9, 0.14, 20),
      p(K+'smoke_01.png',   50, 52, -18,  22, -15, 0.8, 0.20, 22),
      p(K+'spark_04.png',   50, 50,  35, -22,  40, 0.7, 0.08, 14),
      p(K+'spark_06.png',   50, 50, -30, -15, -40, 0.7, 0.12, 14),
      p(CI+'impact_3.png',  50, 50,   0,   0,   0, 1.5, 0.18, 36),
    ],
    lightning: [
      p(K+'spark_01.png',   50, 30,  12, -40,  15, 1.4, 0.00, 28),
      p(K+'spark_03.png',   50, 50, -22, -28, -20, 1.2, 0.04, 24),
      p(K+'spark_06.png',   50, 50,  28, -20,  35, 1.0, 0.08, 20),
      p(K+'spark_07.png',   50, 50, -15,  30, -45, 0.8, 0.12, 16),
      p(K+'muzzle_01.png',  50, 50,   0,   0,   0, 1.3, 0.05, 30),
      p(K+'muzzle_03.png',  50, 50,  20,  -8,  20, 1.0, 0.10, 22),
      p(CI+'impact_1.png',  50, 50,   0,   0,   0, 1.6, 0.16, 38),
    ],
    ice: [
      p(K+'twirl_01.png',   50, 50,  -5,  -5,  45, 1.4, 0.00, 32),
      p(K+'twirl_03.png',   50, 50,  22, -20, -30, 1.1, 0.06, 26),
      p(K+'circle_04.png',  50, 50, -25, -15,  60, 1.0, 0.10, 22),
      p(K+'circle_05.png',  50, 50,  18,  25, -20, 0.8, 0.14, 18),
      p(K+'star_05.png',    50, 50, -20,  20,  30, 0.9, 0.08, 16),
      p(K+'star_06.png',    50, 50,  30, -28,  15, 0.7, 0.12, 14),
      p(CI+'impact_8.png',  50, 50,   0,   0,   0, 1.3, 0.20, 32),
    ],
    shadow: [
      p(K+'smoke_07.png',   50, 50, -12, -35, -10, 1.3, 0.00, 28),
      p(K+'smoke_08.png',   50, 50,  20, -28,  15, 1.1, 0.08, 26),
      p(K+'smoke_09.png',   50, 50, -25,  18, -20, 1.0, 0.12, 24),
      p(K+'smoke_10.png',   50, 50,  15,  30,  10, 0.9, 0.16, 22),
      p(K+'circle_04.png',  50, 50,  -8, -20,  40, 0.8, 0.10, 18),
      p(CS+'smoke2_3.png',  50, 50,   0, -25,   0, 1.2, 0.20, 30),
    ],
    holy: [
      p(K+'light_01.png',   50, 50,   0,   0,   0, 1.6, 0.00, 36),
      p(K+'light_02.png',   50, 50,  20, -22,  30, 1.2, 0.06, 28),
      p(K+'light_03.png',   50, 50, -18, -25, -20, 1.1, 0.10, 26),
      p(K+'star_03.png',    50, 50,  25,  20,  45, 0.9, 0.08, 20),
      p(K+'star_05.png',    50, 50, -28,  18, -35, 0.8, 0.12, 18),
      p(K+'star_07.png',    50, 50,  15, -30,  20, 0.7, 0.14, 16),
      p(CF+'flare_5.png',   50, 50,   0,   0,   0, 1.4, 0.18, 38),
    ],
    time: [
      p(K+'twirl_02.png',   50, 50,   5,   5, 360, 1.4, 0.00, 32),
      p(K+'twirl_03.png',   50, 50, -20, -20, 180, 1.1, 0.06, 26),
      p(K+'circle_01.png',  50, 50,  25,  -8,  90, 1.0, 0.10, 22),
      p(K+'trace_06.png',   50, 50, -28,  15, -45, 0.8, 0.12, 20),
      p(K+'symbol_01.png',  50, 50,  15, -28,  30, 0.7, 0.16, 18),
    ],
    psychic: [
      p(K+'symbol_02.png',  50, 50,   0,   0,   0, 1.5, 0.00, 32),
      p(K+'circle_02.png',  50, 50,  22, -18,  45, 1.2, 0.06, 26),
      p(K+'circle_05.png',  50, 50, -20,  22, -30, 1.0, 0.10, 22),
      p(K+'trace_04.png',   50, 50,  28, -25,  20, 0.8, 0.08, 18),
      p(K+'trace_07.png',   50, 50, -25,  20, -40, 0.7, 0.12, 16),
    ],
    poison: [
      p(K+'circle_02.png',  50, 50,  15, -30,  20, 1.3, 0.00, 28),
      p(K+'circle_03.png',  50, 50, -22, -22, -15, 1.1, 0.06, 24),
      p(K+'smoke_05.png',   50, 50,  -8,  28, -20, 1.0, 0.12, 22),
      p(K+'smoke_06.png',   50, 50,  25,  18,  10, 0.8, 0.16, 20),
      p(K+'trace_05.png',   50, 50, -20, -18,  35, 0.7, 0.10, 16),
    ],
    gravity: [
      p(K+'circle_01.png',  50, 50,   0,   0,   0, 1.5, 0.00, 36),
      p(K+'dirt_01.png',    50, 50,  20, -18,  25, 1.2, 0.06, 24),
      p(K+'dirt_02.png',    50, 50, -22,  15, -20, 1.0, 0.08, 22),
      p(K+'dirt_03.png',    50, 50,  12,  25,  15, 0.9, 0.12, 20),
      p(K+'circle_04.png',  50, 50, -18, -22,  40, 0.8, 0.10, 18),
    ],
    combo: [
      p(K+'star_01.png',    50, 50,  25, -20,  30, 1.2, 0.00, 22),
      p(K+'star_02.png',    50, 50, -22, -18, -25, 1.0, 0.10, 20),
      p(K+'star_03.png',    50, 50,  20,  22,  15, 0.9, 0.20, 18),
      p(K+'spark_04.png',   50, 50, -25,  20, -35, 0.8, 0.30, 16),
      p(K+'spark_02.png',   50, 50,  18, -28,  40, 0.7, 0.40, 14),
    ],
    crit: [
      p(K+'star_04.png',    50, 50,   0,   0,   0, 1.8, 0.00, 40),
      p(K+'star_05.png',    50, 50,  30, -25,  45, 1.3, 0.06, 30),
      p(K+'star_06.png',    50, 50, -28, -22, -30, 1.2, 0.10, 28),
      p(K+'flare_01.png',   50, 50,   0,   0,   0, 1.6, 0.08, 38),
      p(K+'spark_06.png',   50, 50,  35,  20,  50, 1.0, 0.12, 22),
      p(K+'spark_07.png',   50, 50, -32,  18, -45, 0.9, 0.14, 20),
      p(K+'muzzle_02.png',  50, 50,  18, -30,  25, 0.8, 0.16, 18),
      p(CI+'impact_10.png', 50, 50,   0,   0,   0, 1.8, 0.18, 44),
    ],
    shield: [
      p(K+'circle_01.png',  50, 50,  42, -28,  25, 1.4, 0.28, 34),
      p(K+'circle_05.png',  50, 50, -38, -32, -22, 1.3, 0.30, 30),
      p(K+'window_01.png',  50, 50,  32,  36,  18, 1.2, 0.26, 28),
      p(K+'window_02.png',  50, 50, -36,  30, -20, 1.1, 0.32, 26),
      p(K+'light_01.png',   50, 50,   0, -46,   0, 1.3, 0.24, 30),
      p(K+'light_03.png',   50, 50,  44,   0,  35, 1.1, 0.34, 24),
      p(K+'spark_06.png',   50, 50, -42,   0, -32, 1.0, 0.36, 20),
      p(K+'spark_07.png',   50, 50,   0,  44,   0, 0.9, 0.38, 18),
      p(CI+'flare_5.png',   50, 50,   0,   0,   0, 1.6, 0.20, 44),
    ],
    berserker: [
      p(K+'scorch_03.png',  50, 50,   0,   0,   0, 1.5, 0.00, 36),
      p(K+'slash_03.png',   50, 50,  25, -22,  35, 1.3, 0.06, 28),
      p(K+'slash_04.png',   50, 50, -22,  20, -40, 1.1, 0.10, 26),
      p(K+'smoke_03.png',   50, 50,  -8,  30, -10, 1.0, 0.14, 24),
      p(K+'spark_07.png',   50, 50,  30, -18,  50, 0.9, 0.08, 20),
      p(CI+'impact_12.png', 50, 50,   0,   0,   0, 1.6, 0.20, 40),
    ],
    wind: [
      p(K+'trace_01.png',   50, 50,  35,  -5,  15, 1.3, 0.00, 28),
      p(K+'trace_02.png',   50, 50,  30,  -8, -10, 1.1, 0.06, 24),
      p(K+'trace_07.png',   50, 50,  38, -12,  20, 1.0, 0.10, 22),
      p(K+'circle_03.png',  50, 50,  25,  15, -15, 0.8, 0.12, 18),
      p(K+'scratch_01.png', 50, 50,  20, -20,  25, 0.7, 0.14, 16),
    ],
    earth: [
      p(K+'dirt_01.png',    50, 55,  20, -15,  20, 1.3, 0.00, 26),
      p(K+'dirt_02.png',    50, 55, -18, -12, -15, 1.1, 0.05, 24),
      p(K+'dirt_03.png',    50, 55,  -8, -20,  10, 1.0, 0.08, 22),
      p(K+'scorch_01.png',  50, 58,  25,  10,  15, 0.9, 0.12, 20),
      p(K+'scorch_02.png',  50, 58, -22,   8, -20, 0.8, 0.14, 18),
      p(CI+'impact_7.png',  50, 50,   0,   0,   0, 1.4, 0.18, 36),
    ],
    blood: [
      p(K+'scorch_02.png',  50, 50,  18, -25,  20, 1.4, 0.00, 30),
      p(K+'scorch_03.png',  50, 50, -20, -20, -25, 1.2, 0.05, 26),
      p(K+'circle_03.png',  50, 50,  25,  20,  10, 1.0, 0.10, 22),
      p(K+'circle_02.png',  50, 50, -22,  18, -15, 0.9, 0.14, 20),
      p(K+'trace_05.png',   50, 50,  15, -28,  35, 0.7, 0.08, 16),
    ],
    void: [
      p(K+'circle_04.png',  50, 50,  -5,  -5, 180, 1.5, 0.00, 36),
      p(K+'smoke_09.png',   50, 50,  18, -20, -90, 1.2, 0.08, 28),
      p(K+'smoke_10.png',   50, 50, -20,  18,  90, 1.0, 0.12, 26),
      p(K+'symbol_01.png',  50, 50,  22, -22,  45, 0.8, 0.10, 22),
      p(K+'circle_02.png',  50, 50, -25,  15, -60, 0.7, 0.14, 18),
    ],
    energy: [
      p(K+'magic_01.png',   50, 50,   0,   0,   0, 1.5, 0.00, 34),
      p(K+'magic_03.png',   50, 50,  22, -18,  30, 1.2, 0.06, 28),
      p(K+'light_02.png',   50, 50, -20,  20, -25, 1.0, 0.10, 24),
      p(K+'circle_02.png',  50, 50,  25,  18,  45, 0.8, 0.08, 20),
      p(K+'spark_03.png',   50, 50, -22, -20, -30, 0.7, 0.12, 16),
      p(CF+'flare_3.png',   50, 50,   0,   0,   0, 1.4, 0.16, 36),
    ],
    cursed: [
      p(K+'symbol_02.png',  50, 50,   0,   0,   0, 1.4, 0.00, 32),
      p(K+'smoke_09.png',   50, 50,  18, -22,  20, 1.2, 0.06, 26),
      p(K+'circle_04.png',  50, 50, -20,  18, -30, 1.0, 0.10, 22),
      p(K+'trace_06.png',   50, 50,  25, -18,  40, 0.8, 0.12, 18),
      p(K+'twirl_02.png',   50, 50, -22,  22, -20, 0.7, 0.14, 16),
    ],
    counter: [
      p(K+'star_06.png',    50, 50,   0,   0,   0, 1.5, 0.00, 34),
      p(K+'spark_02.png',   50, 50,  25, -20,  35, 1.2, 0.06, 24),
      p(K+'light_01.png',   50, 50, -22,  18, -30, 1.0, 0.10, 22),
      p(K+'circle_05.png',  50, 50,  20,  22,  20, 0.8, 0.12, 18),
      p(CI+'impact_2.png',  50, 50,   0,   0,   0, 1.4, 0.18, 36),
    ],
    dodge: [
      p(K+'trace_01.png',  35, 50,  22,  -3,   0, 1.1, 0.00, 28),
      p(K+'trace_02.png',  40, 50,  18,  -5,   5, 1.0, 0.03, 24),
      p(K+'trace_04.png',  30, 50,  25,  -4,   0, 0.9, 0.06, 22),
      p(K+'trace_07.png',  60, 50, -22,  -3,  -5, 0.9, 0.02, 24),
      p(K+'smoke_02.png',  50, 50,  -8,  10,  -5, 0.7, 0.12, 18),
      p(K+'smoke_03.png',  50, 50,  10,   8,   5, 0.6, 0.10, 16),
      p(K+'circle_03.png', 50, 50,  -4,  -4,  15, 0.5, 0.15, 14),
    ],
    water: [
      p(K+'circle_01.png',  50, 50,  24, -32, -12, 1.3, 0.48, 30),
      p(K+'circle_03.png',  50, 50, -22, -28,  16, 1.1, 0.50, 26),
      p(K+'twirl_01.png',   50, 50,  -6, -38,  22, 1.2, 0.46, 28),
      p(K+'circle_02.png',  50, 50,  30, -18,  38, 1.0, 0.52, 22),
      p(K+'circle_05.png',  50, 50, -20,  24, -28, 0.9, 0.54, 20),
      p(K+'twirl_03.png',   50, 50,  18,  26, -15, 0.8, 0.56, 18),
      p(CI+'impact_4.png',  50, 50,   0,   0,   0, 1.5, 0.44, 36),
      p(K+'smoke_01.png',   50, 50,  14,  22, -10, 0.7, 0.60, 16),
    ],

    // ── Particle banks for the 7 new element types ─────────────────────
    // These layer on top of the type-specific SVG geometry below. Each
    // bank uses the premium /fx/p/ asset pack heavily — magic particles,
    // colored stars, spirowires, energyballs, lightrays — to deliver
    // visible spectacle rather than relying on minimal SVG primitives.

    arcane: [
      p(P+'magic_a.png',    50, 50,   0,   0,   0, 1.6, 0.00, 40),
      p(P+'magic_c.png',    50, 50,  22, -20,  45, 1.2, 0.06, 28),
      p(P+'magic_e.png',    50, 50, -22, -18, -30, 1.1, 0.10, 26),
      p(P+'spiro_a.png',    50, 50,  -4,  -4, 120, 1.4, 0.04, 34),
      p(P+'spiro_c.png',    50, 50,   2,   2,-180, 1.0, 0.14, 26),
      p(K+'symbol_01.png',  50, 50,  28, -28,  60, 0.9, 0.08, 20),
      p(K+'symbol_02.png',  50, 50, -28,  24, -60, 0.9, 0.12, 20),
      p(P+'star_a.png',     50, 50,  -8, -32,  30, 0.85,0.16, 18),
      p(P+'star_d.png',     50, 50,  30,  -8, -45, 0.85,0.18, 18),
      p(CF+'flare_3.png',   50, 50,   0,   0,   0, 1.5, 0.22, 38),
    ],

    nature: [
      p(P+'ring_a.png',     50, 50,   0,   0,   0, 1.5, 0.00, 36),
      p(P+'ring_b.png',     50, 50,  -4,  -4,  20, 1.3, 0.04, 30),
      p(P+'magic_b.png',    50, 50,  22, -18,  30, 1.1, 0.08, 24),
      p(P+'magic_d.png',    50, 50, -22, -16, -25, 1.0, 0.10, 22),
      p(K+'scratch_01.png', 50, 50,  28, -22,  35, 0.9, 0.06, 22),
      p(K+'scratch_01.png', 50, 50, -28,  22,-145, 0.9, 0.12, 22),
      p(P+'star_b.png',     50, 50,  20,  24,  15, 0.8, 0.14, 18),
      p(P+'star_e.png',     50, 50, -24,  20, -25, 0.8, 0.16, 18),
      p(K+'circle_03.png',  50, 50,  10, -34,  10, 0.7, 0.18, 16),
      p(K+'circle_04.png',  50, 50, -12,  30, -10, 0.7, 0.20, 16),
    ],

    cosmic: [
      p(P+'orb_a.png',      50, 50,   0,   0,   0, 1.7, 0.00, 42),
      p(P+'orb_c.png',      50, 50,  -2,  -2,  45, 1.4, 0.04, 36),
      p(P+'cstar_a.png',    50, 50,  28, -28,  60, 1.2, 0.08, 26),
      p(P+'cstar_b.png',    50, 50, -28,  24, -50, 1.1, 0.10, 24),
      p(P+'cstar_c.png',    50, 50,  24,  26,  40, 1.0, 0.12, 22),
      p(P+'star_c.png',     50, 50, -32, -22, -40, 0.95,0.06, 20),
      p(P+'star_f.png',     50, 50,  32, -20,  30, 0.95,0.14, 20),
      p(P+'star_g.png',     50, 50, -20,  32,  50, 0.9, 0.16, 18),
      p(P+'magic_a.png',    50, 50,  -8, -36,  60, 0.85,0.18, 18),
      p(CF+'flare_5.png',   50, 50,   0,   0,   0, 1.6, 0.22, 40),
    ],

    metal: [
      p(K+'slash_01.png',   50, 50,  22, -18,  30, 1.5, 0.00, 34),
      p(K+'slash_02.png',   50, 50, -22, -16, -25, 1.3, 0.04, 30),
      p(K+'slash_03.png',   50, 50,  18,  22,  45, 1.2, 0.08, 28),
      p(K+'slash_04.png',   50, 50, -20,  20, -45, 1.1, 0.10, 26),
      p(K+'spark_01.png',   50, 50,  28, -28,  60, 1.0, 0.06, 22),
      p(K+'spark_03.png',   50, 50, -32, -24, -55, 0.9, 0.08, 20),
      p(K+'spark_05.png',   50, 50,  32,  26,  45, 0.9, 0.12, 20),
      p(K+'spark_06.png',   50, 50, -28,  28, -40, 0.85,0.14, 18),
      p(K+'spark_07.png',   50, 50,   6, -38,  20, 0.8, 0.16, 16),
      p(CI+'impact_10.png', 50, 50,   0,   0,   0, 1.7, 0.20, 42),
    ],

    soul: [
      p(P+'magic_e.png',    50, 50,   0, -10,  10, 1.5, 0.00, 38),
      p(P+'magic_c.png',    50, 50,  18, -24, -20, 1.2, 0.06, 28),
      p(K+'smoke_09.png',   50, 50, -22, -20,  30, 1.2, 0.04, 30),
      p(K+'smoke_10.png',   50, 50,  20,  18, -25, 1.1, 0.10, 26),
      p(K+'smoke_07.png',   50, 50, -18,  22,  45, 0.95,0.12, 24),
      p(K+'light_01.png',   50, 50,   0, -32,   0, 1.0, 0.16, 22),
      p(K+'light_03.png',   50, 50,  28, -24,  20, 0.9, 0.18, 20),
      p(K+'light_03.png',   50, 50, -28,  20, -20, 0.9, 0.20, 20),
      p(P+'star_g.png',     50, 50,   0, -40,  60, 0.8, 0.22, 16),
      p(CS+'smoke2_3.png',  50, 50,   0,   0,   0, 1.6, 0.24, 38),
    ],

    sound: [
      p(P+'ring_a.png',     50, 50,   0,   0,   0, 1.4, 0.00, 36),
      p(P+'ring_b.png',     50, 50,   0,   0,   0, 1.7, 0.10, 44),
      p(P+'ring_c.png',     50, 50,   0,   0,   0, 2.0, 0.22, 52),
      p(P+'muzz_a.png',     50, 50,  28,   0,   0, 1.2, 0.06, 28),
      p(P+'muzz_b.png',     50, 50, -28,   0, 180, 1.2, 0.08, 28),
      p(P+'rays_a.png',     50, 50,   0,   0,   0, 1.3, 0.04, 32),
      p(K+'window_01.png',  50, 50,  22, -22,  45, 0.9, 0.14, 20),
      p(K+'window_02.png',  50, 50, -22,  22, -45, 0.9, 0.16, 20),
      p(K+'spark_06.png',   50, 50,  32,   0,   0, 0.7, 0.18, 16),
      p(K+'spark_07.png',   50, 50, -32,   0, 180, 0.7, 0.20, 16),
    ],

    chaos: [
      p(P+'burst_a.png',    50, 50,   0,   0,   0, 1.6, 0.00, 38),
      p(P+'burst_c.png',    50, 50,   0,   0,  60, 1.4, 0.06, 34),
      p(P+'burst_d.png',    50, 50,   0,   0, -45, 1.3, 0.10, 32),
      p(P+'spiro_b.png',    50, 50,  -4,  -4,  90, 1.2, 0.08, 28),
      p(P+'line_a.png',     50, 50,  22, -18,  25, 1.0, 0.04, 24),
      p(P+'line_b.png',     50, 50, -22,  18, -25, 1.0, 0.12, 24),
      p(P+'line_c.png',     50, 50,  18,  22,  55, 0.95,0.14, 22),
      p(K+'spark_02.png',   50, 50,  28, -28,  45, 0.9, 0.06, 20),
      p(K+'spark_04.png',   50, 50, -28,  24, -50, 0.85,0.16, 18),
      p(P+'impact_a.png',   50, 50,   0,   0,   0, 1.8, 0.22, 44),
    ],
  }

  const GENERIC_PARTICLES: Sprite[] = [
    p(K+'spark_01.png',   50, 50,  22, -18,  30, 1.2, 0.00, 22),
    p(K+'circle_01.png',  50, 50, -20,  20, -25, 1.0, 0.06, 20),
    p(K+'star_01.png',    50, 50,  18,  22,  15, 0.9, 0.10, 18),
    p(K+'smoke_02.png',   50, 50, -22, -15, -20, 0.7, 0.14, 16),
    p(CI+'impact_4.png',  50, 50,   0,   0,   0, 1.3, 0.18, 30),
  ]

  // Perf tier: drop the trailing half of particles on low-end devices.
  // Capture once per component instance — these are static device props.
  const _perfTier = getPerfTier()
  const _maxDelay = _perfTier === 'low' ? 0.10 : _perfTier === 'mid' ? 0.18 : Infinity

  // Base sprites, filtered by grade (F/E drops lower-weight trailing particles)
  let particleSprites = $derived.by((): Sprite[] => {
    const base = PARTICLES[type] ?? GENERIC_PARTICLES
    let filtered: Sprite[]
    if (gradeIdx <= 1) filtered = base.filter(s => s.delay <= 0.10)   // F/E: only early particles
    else if (gradeIdx <= 2) filtered = base.filter(s => s.delay <= 0.16)  // D
    else if (_maxDelay !== Infinity) filtered = base.filter(s => s.delay <= _maxDelay)
    else filtered = base
    // Apply grade scale to size and spread (skip alloc if no scale needed)
    if (gradeIdx <= 2 && _maxDelay === Infinity) return filtered
    return filtered.map(s => ({
      ...s,
      size: Math.round(s.size * scaleMult),
      tx: s.tx * spreadMult,
      ty: s.ty * spreadMult,
    }))
  })
</script>

<div class="fx-root {flyClass} {gradeClass}" style="width:{size}px;height:{size}px;--c:{color};">
  <!-- Shockwave rings. The thick primary ring sells the impact; secondary
       and tertiary rings layer over for the high-grade screen-shake feel.
       Each ring has its own width, color opacity, and animation offset
       so they read as overlapping kinetic waves, not stacked clones. -->
  {#if shockwaveCount >= 1}
    <div class="fx-shockwave sw-primary" style="border-color:{color};box-shadow:0 0 18px {color}88;"></div>
  {/if}
  {#if shockwaveCount >= 2}
    <div class="fx-shockwave sw-secondary" style="border-color:{color}aa;animation-delay:0.08s;"></div>
  {/if}
  {#if shockwaveCount >= 3}
    <div class="fx-shockwave sw-tertiary" style="border-color:{color}66;animation-delay:0.16s;"></div>
  {/if}

  {#if type === 'slash'}
    <!-- Weapon slash — grade-scaled. F-tier weapons show one tired
         swipe; God-tier weapons erupt with 8 stacked slashes plus a
         heavy motion-blur sweep and a shockwave ring. -->
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <!-- Motion-blur sweep band that brightens with grade -->
      <ellipse cx="50" cy="38" rx={34 + gradeIdx * 1.6} ry={22 + gradeIdx * 1.2}
               fill="var(--c)" opacity={0.10 + gradeIdx * 0.018}
               style="filter:blur({8 + gradeIdx}px)"/>
      <!-- Trailing echo of each slash (drawn first so it sits beneath) -->
      {#each slashLines as l, i}
        <line class="sl-echo"
              x1={l.x1 + 8} y1={l.y1 + 4}
              x2={l.x2 + 8} y2={l.y2 + 4}
              stroke="var(--c)" stroke-width={l.w * 0.55} stroke-linecap="round"
              opacity={0.18 + Math.min(0.18, gradeIdx * 0.02)}
              style="--d:{l.delay - 0.08}s"/>
      {/each}
      <!-- Primary slash lines -->
      {#each slashLines as l, i}
        <line class="sl"
              x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke="var(--c)" stroke-width={l.w} stroke-linecap="round"
              style="--d:{l.delay}s"/>
      {/each}
      <!-- Endpoint sparks — one per line endpoint -->
      {#each slashLines as l, i}
        <circle class="sp" cx={l.x1} cy={l.y1} r={Math.max(1.8, 3.5 - i * 0.3)} fill="var(--c)"
                style="animation-delay:{0.18 + l.delay}s"/>
        <circle class="sp" cx={l.x2} cy={l.y2} r={Math.max(1.5, 3.0 - i * 0.3)} fill="var(--c)" opacity="0.85"
                style="animation-delay:{0.22 + l.delay}s"/>
      {/each}
      <!-- High-grade exclusives: cross-cuts + impact ring -->
      {#if gradeIdx >= 6}
        <line class="sl-cross sl-cross-a" x1="20" y1="20" x2="80" y2="80"
              stroke="var(--c)" stroke-width="3.5" stroke-linecap="round" opacity="0.9"/>
        <line class="sl-cross sl-cross-b" x1="80" y1="20" x2="20" y2="80"
              stroke="var(--c)" stroke-width="3.5" stroke-linecap="round" opacity="0.9"/>
      {/if}
      {#if gradeIdx >= 8}
        <circle class="sl-ring" cx="50" cy="50" r="38"
                stroke="var(--c)" stroke-width="2.5" fill="none" opacity="0.7"/>
      {/if}
    </svg>

  {:else if type === 'fire'}
    <!-- Fire — tier-band visual identity. Each band tells a different
         story of heat escalation. Shared filter for heat distortion is
         declared once and reused per-band where appropriate. -->
    <svg viewBox="0 0 100 100" class="fx-svg fire-band-{tierBand}" overflow="visible">
      <defs>
        <!-- Heat distortion turbulence — multiplied onto bloom layers for
             that "watching through hot air" wobble. Cheap on GPU. -->
        <filter id="fi-heat" x="-50%" y="-50%" width="200%" height="200%">
          <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="3">
            <animate attributeName="baseFrequency" dur="0.85s" values="0.018;0.045;0.018" repeatCount="1"/>
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" scale="6"/>
        </filter>
        <!-- Hot core radial: white-yellow-orange-c. Used everywhere. -->
        <radialGradient id="fi-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#fff" stop-opacity="1"/>
          <stop offset="35%" stop-color="#ffe39a" stop-opacity="0.95"/>
          <stop offset="70%" stop-color="var(--c)" stop-opacity="0.85"/>
          <stop offset="100%" stop-color="var(--c)" stop-opacity="0"/>
        </radialGradient>
      </defs>

      {#if tierBand === 'small'}
        <!-- F–D: a small ember launches forward and bursts into a quick
             flame engulf. Reads as a single-cast spell, not a presence. -->
        <!-- Travel streak: ember rides from off-screen left to center -->
        <g class="fi-s-streak">
          <ellipse cx="50" cy="60" rx="14" ry="3.5" fill="var(--c)" opacity="0.55"/>
          <circle cx="50" cy="60" r="3.2" fill="#fff"/>
        </g>
        <!-- Impact burst at target center -->
        <g class="fi-s-burst">
          <circle cx="50" cy="60" r="18" fill="url(#fi-core)"/>
          <!-- Six flame tongues fanning outward -->
          {#each [0, 60, 120, 180, 240, 300] as deg, i}
            <path class="fi-s-tongue" style="--rot:{deg}deg; animation-delay:{0.18 + i * 0.012}s;"
                  d="M50 60 C46 50 46 40 50 28 C54 40 54 50 50 60Z"
                  fill="var(--c)" opacity="0.85"/>
          {/each}
        </g>
        <!-- Scorch pool -->
        <ellipse class="fi-s-scorch" cx="50" cy="80" rx="22" ry="5" fill="var(--c)" opacity="0.5"/>
        <!-- A few rising embers -->
        {#each [{x:38,y:60,d:0.22},{x:50,y:54,d:0.26},{x:62,y:60,d:0.24},{x:44,y:48,d:0.30},{x:56,y:48,d:0.32}] as e, i}
          <circle class="fi-s-emb" style="animation-delay:{e.d}s;" cx={e.x} cy={e.y} r="1.6" fill="var(--c)"/>
        {/each}

      {:else if tierBand === 'medium'}
        <!-- C–A: fire SPIRALS around the target (orbital build-up), then
             DETONATES outward in a fiery bloom. Two-beat: gather → bloom. -->
        <!-- Spinning bloom underlayer (heat haze) -->
        <ellipse cx="50" cy="55" rx="52" ry="38" fill="var(--c)" opacity="0.22"
                 class="fi-m-haze" style="filter:url(#fi-heat) blur(8px)"/>
        <!-- Orbit ring: 8 flame petals spiral inward then outward -->
        <g class="fi-m-orbit">
          {#each Array.from({length: 8}) as _, i}
            {@const a = (i * Math.PI * 2) / 8}
            {@const x = 50 + Math.cos(a) * 42}
            {@const y = 55 + Math.sin(a) * 30}
            <ellipse class="fi-m-petal" style="--delay:{i * 0.025}s;"
                     cx={x} cy={y} rx="4" ry="9"
                     transform="rotate({(a * 180) / Math.PI + 90} {x} {y})"
                     fill="var(--c)" opacity="0.85"/>
          {/each}
        </g>
        <!-- Detonation bloom — fires after the spiral closes -->
        <circle class="fi-m-deton" cx="50" cy="55" r="34" fill="url(#fi-core)"/>
        <!-- Shockwave ring -->
        <circle class="fi-m-shock" cx="50" cy="55" r="20" fill="none"
                stroke="var(--c)" stroke-width="2.5" opacity="0"/>
        <!-- Outward flame tongues -->
        {#each [0, 45, 90, 135, 180, 225, 270, 315] as deg, i}
          <path class="fi-m-tongue" style="--rot:{deg}deg; animation-delay:{0.42 + i * 0.018}s;"
                d="M50 55 C46 42 46 30 50 14 C54 30 54 42 50 55Z"
                fill="var(--c)" opacity="0.9"/>
        {/each}
        <!-- Scorch pool spreads wider -->
        <ellipse class="fi-m-scorch" cx="50" cy="88" rx="42" ry="8" fill="var(--c)" opacity="0.55"/>
        <!-- Embers spray outward -->
        {#each Array.from({length: 12}) as _, i}
          {@const a = (i * Math.PI * 2) / 12}
          <circle class="fi-m-emb" style="--dx:{Math.cos(a) * 60}px; --dy:{Math.sin(a) * 50}px; animation-delay:{0.48 + i * 0.015}s;"
                  cx="50" cy="55" r="1.8" fill="var(--c)"/>
        {/each}

      {:else if tierBand === 'large'}
        <!-- S–SSS: a MASSIVE molten fireball crashes down from the sky,
             exploding into layered shockwaves of flame. Three concentric
             rings + falling impact + tall column. -->
        <!-- Sky bloom where the meteor falls from -->
        <ellipse cx="50" cy="-140" rx="60" ry="30" fill="var(--c)" opacity="0.6"
                 class="fi-l-sky" style="filter:blur(20px)"/>
        <!-- Trail streak from sky to target -->
        <line class="fi-l-trail" x1="50" y1="-140" x2="50" y2="60"
              stroke="url(#fi-core)" stroke-width="14" stroke-linecap="round"/>
        <!-- Falling fireball -->
        <g class="fi-l-meteor">
          <circle cx="50" cy="60" r="22" fill="var(--c)"/>
          <circle cx="50" cy="60" r="14" fill="url(#fi-core)"/>
          <!-- Trailing flames behind the meteor -->
          <path d="M44 60 C36 30 32 0 40 -40 L50 -50 L60 -40 C68 0 64 30 56 60Z"
                fill="var(--c)" opacity="0.7"/>
        </g>
        <!-- Three layered shockwave rings -->
        <circle class="fi-l-shock fi-l-s1" cx="50" cy="62" r="20" fill="none"
                stroke="var(--c)" stroke-width="3" opacity="0"/>
        <circle class="fi-l-shock fi-l-s2" cx="50" cy="62" r="20" fill="none"
                stroke="#fff" stroke-width="2" opacity="0"/>
        <circle class="fi-l-shock fi-l-s3" cx="50" cy="62" r="20" fill="none"
                stroke="var(--c)" stroke-width="2" opacity="0"/>
        <!-- Tall central pillar of flame post-impact -->
        <g class="fi-l-pillar">
          <path d="M30 100 C20 60 26 30 36 -20 C44 14 56 14 64 -20 C74 30 80 60 70 100Z"
                fill="var(--c)" opacity="0.85"/>
          <path d="M40 100 C32 60 38 30 46 -10 C50 16 56 16 60 -10 C68 30 68 60 60 100Z"
                fill="url(#fi-core)"/>
        </g>
        <!-- Wide scorched ground -->
        <ellipse class="fi-l-scorch" cx="50" cy="94" rx="60" ry="11" fill="var(--c)" opacity="0.7"/>
        <!-- Heavy ember storm -->
        {#each Array.from({length: 18}) as _, i}
          {@const a = (i * Math.PI * 2) / 18}
          {@const r = 60 + (i % 3) * 12}
          <circle class="fi-l-emb" style="--dx:{Math.cos(a) * r}px; --dy:{Math.sin(a) * r * 0.7 - 30}px; animation-delay:{0.45 + i * 0.014}s;"
                  cx="50" cy="62" r="2.2" fill="var(--c)"/>
        {/each}

      {:else}
        <!-- GOD: a MINIATURE SUN forms overhead, pulling flames inward
             before collapsing into a CATASTROPHIC solar eruption that
             covers the screen. Four-beat: form → gather → collapse → erupt. -->
        <!-- Screen-wide darken flash so the scene reads as cataclysm -->
        <rect class="fi-g-darken" x="-300" y="-300" width="700" height="700"
              fill="#1a0500" opacity="0"/>
        <!-- Sun forms overhead (above viewBox) -->
        <g class="fi-g-sun">
          <circle cx="50" cy="-30" r="60" fill="url(#fi-core)" opacity="0.9"/>
          <circle cx="50" cy="-30" r="36" fill="#fff" opacity="0.95"/>
          <circle cx="50" cy="-30" r="22" fill="#fff"/>
          <!-- Solar flares licking around the sun -->
          {#each [0, 36, 72, 108, 144, 180, 216, 252, 288, 324] as deg, i}
            <path class="fi-g-flare" style="--rot:{deg}deg; animation-delay:{0.08 + i * 0.025}s;"
                  d="M50 -30 C44 -55 44 -75 50 -95 C56 -75 56 -55 50 -30Z"
                  fill="var(--c)" opacity="0.85"/>
          {/each}
        </g>
        <!-- Inward gathering streams: flame ribbons pulled from off-screen
             edges toward the sun above -->
        {#each Array.from({length: 16}) as _, i}
          {@const a = (i * Math.PI * 2) / 16}
          {@const sx = 50 + Math.cos(a) * 220}
          {@const sy = -30 + Math.sin(a) * 200}
          <line class="fi-g-stream" style="animation-delay:{0.18 + i * 0.012}s;"
                x1={sx} y1={sy} x2="50" y2="-30"
                stroke="var(--c)" stroke-width="3" stroke-linecap="round" opacity="0"/>
        {/each}
        <!-- White-hot collapse pulse before eruption -->
        <circle class="fi-g-collapse" cx="50" cy="-30" r="80" fill="#fff" opacity="0"/>
        <!-- ERUPTION: gigantic radial shockwave rings (cover screen) -->
        <circle class="fi-g-erupt fi-g-e1" cx="50" cy="50" r="20" fill="none"
                stroke="#fff" stroke-width="6" opacity="0"/>
        <circle class="fi-g-erupt fi-g-e2" cx="50" cy="50" r="20" fill="none"
                stroke="var(--c)" stroke-width="5" opacity="0"/>
        <circle class="fi-g-erupt fi-g-e3" cx="50" cy="50" r="20" fill="none"
                stroke="var(--c)" stroke-width="4" opacity="0"/>
        <!-- Massive central inferno after eruption -->
        <g class="fi-g-inferno">
          <circle cx="50" cy="50" r="180" fill="url(#fi-core)" opacity="0.85"/>
          <circle cx="50" cy="50" r="100" fill="#fff" opacity="0.7"/>
        </g>
        <!-- Twelve enormous outward flame columns -->
        {#each [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330] as deg, i}
          <path class="fi-g-column" style="--rot:{deg}deg; animation-delay:{0.62 + i * 0.012}s;"
                d="M50 50 C42 30 38 0 46 -60 C50 -30 50 -30 54 -60 C62 0 58 30 50 50Z"
                fill="var(--c)" opacity="0.9"/>
        {/each}
        <!-- Apocalyptic scorched ground -->
        <ellipse class="fi-g-scorch" cx="50" cy="100" rx="200" ry="22" fill="var(--c)" opacity="0.75"/>
        <!-- Burning ember rain across screen -->
        {#each Array.from({length: 28}) as _, i}
          {@const a = (i * Math.PI * 2) / 28}
          {@const r = 120 + (i % 4) * 30}
          <circle class="fi-g-emb" style="--dx:{Math.cos(a) * r}px; --dy:{Math.sin(a) * r * 0.85 - 20}px; animation-delay:{0.7 + i * 0.01}s;"
                  cx="50" cy="50" r="2.5" fill="var(--c)"/>
        {/each}
      {/if}
    </svg>

  {:else if type === 'lightning'}
    <!-- Lightning — speed, snapping, overcharge. Each band escalates from
         a single strike to a storm-apocalypse. -->
    <svg viewBox="0 0 100 100" class="fx-svg lit-band-{tierBand}" overflow="visible">
      {#if tierBand === 'small'}
        <!-- F–D: sudden lightning strike snaps down instantly from above -->
        <ellipse cx="50" cy="-120" rx="32" ry="16" fill="var(--c)" opacity="0.5"
                 class="lit-s-sky" style="filter:blur(12px)"/>
        <polyline class="lit-s-bolt lit-s-bolt-glow"
          points="48,-140 56,-90 40,-50 56,-10 46,30 52,60 50,72"
          stroke="var(--c)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.3"/>
        <polyline class="lit-s-bolt lit-s-bolt-main"
          points="48,-140 56,-90 40,-50 56,-10 46,30 52,60 50,72"
          stroke="var(--c)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <polyline class="lit-s-bolt lit-s-bolt-core"
          points="48,-140 56,-90 40,-50 56,-10 46,30 52,60 50,72"
          stroke="#fff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <!-- Ground impact spark + shock ring -->
        <ellipse class="lit-s-shock" cx="50" cy="72" rx="18" ry="5" fill="none"
                 stroke="var(--c)" stroke-width="2.5" opacity="0"/>
        <circle class="lit-s-flash" cx="50" cy="72" r="14" fill="var(--c)" opacity="0"/>
        {#each [{x:36,y:72,r:2,d:0.18},{x:64,y:72,r:2,d:0.20},{x:50,y:66,r:1.8,d:0.22}] as s, i}
          <circle class="lit-s-spark" style="animation-delay:{s.d}s;" cx={s.x} cy={s.y} r={s.r} fill="var(--c)"/>
        {/each}

      {:else if tierBand === 'medium'}
        <!-- C–A: chain lightning erupts repeatedly between target and
             nearby air distortions -->
        <!-- 5 jagged chain bolts arcing in from edges -->
        {#each [
          {p:'2,18 18,30 14,46 28,50',   d:0.00},
          {p:'98,22 80,34 84,48 70,52',  d:0.06},
          {p:'4,82 22,72 18,58 36,54',   d:0.10},
          {p:'96,78 78,68 84,56 66,52',  d:0.14},
          {p:'50,4 46,22 56,32 50,46',   d:0.18},
        ] as bolt, i}
          <polyline class="lit-m-chain" style="animation-delay:{bolt.d}s;"
                    points={bolt.p} stroke="var(--c)" stroke-width="2.5"
                    stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0"/>
        {/each}
        <!-- Central overcharge ball + secondary discharge -->
        <circle class="lit-m-ball" cx="50" cy="50" r="18" fill="var(--c)" opacity="0"/>
        <circle class="lit-m-ball-core" cx="50" cy="50" r="9" fill="#fff" opacity="0"/>
        <!-- 8 outward forks -->
        {#each [0, 45, 90, 135, 180, 225, 270, 315] as deg, i}
          <line class="lit-m-fork" style="--rot:{deg}deg; animation-delay:{0.28 + i * 0.022}s;"
                x1="50" y1="50" x2="50" y2="14" stroke="var(--c)"
                stroke-width="2.2" stroke-linecap="round" opacity="0"/>
        {/each}
        <!-- Air distortion crackles -->
        <ellipse class="lit-m-haze" cx="50" cy="50" rx="48" ry="38"
                 fill="var(--c)" opacity="0.18" style="filter:blur(10px)"/>

      {:else if tierBand === 'large'}
        <!-- S–SSS: THREE enormous lightning bolts crash down simultaneously,
             overcharging the battlefield -->
        <ellipse cx="50" cy="-160" rx="70" ry="26" fill="var(--c)" opacity="0.6"
                 class="lit-l-sky" style="filter:blur(20px)"/>
        <!-- Bolt 1: left -->
        <polyline class="lit-l-bolt lit-l-bolt-glow" points="22,-200 30,-160 18,-110 32,-70 14,-30 28,0 18,30 28,55 22,75"
          stroke="var(--c)" stroke-width="14" stroke-linecap="round" fill="none" opacity="0.3"/>
        <polyline class="lit-l-bolt lit-l-bolt-main" points="22,-200 30,-160 18,-110 32,-70 14,-30 28,0 18,30 28,55 22,75"
          stroke="var(--c)" stroke-width="4" stroke-linecap="round" fill="none"/>
        <polyline class="lit-l-bolt lit-l-bolt-core" points="22,-200 30,-160 18,-110 32,-70 14,-30 28,0 18,30 28,55 22,75"
          stroke="#fff" stroke-width="1.8" stroke-linecap="round" fill="none"/>
        <!-- Bolt 2: center -->
        <polyline class="lit-l-bolt lit-l-bolt-glow lit-l-b2-d" points="48,-200 56,-160 42,-110 60,-70 38,-30 56,0 44,30 56,55 50,72"
          stroke="var(--c)" stroke-width="14" stroke-linecap="round" fill="none" opacity="0.3"/>
        <polyline class="lit-l-bolt lit-l-bolt-main lit-l-b2-d" points="48,-200 56,-160 42,-110 60,-70 38,-30 56,0 44,30 56,55 50,72"
          stroke="var(--c)" stroke-width="4" stroke-linecap="round" fill="none"/>
        <polyline class="lit-l-bolt lit-l-bolt-core lit-l-b2-d" points="48,-200 56,-160 42,-110 60,-70 38,-30 56,0 44,30 56,55 50,72"
          stroke="#fff" stroke-width="1.8" stroke-linecap="round" fill="none"/>
        <!-- Bolt 3: right -->
        <polyline class="lit-l-bolt lit-l-bolt-glow lit-l-b3-d" points="78,-200 70,-160 82,-110 68,-70 86,-30 72,0 82,30 72,55 78,75"
          stroke="var(--c)" stroke-width="14" stroke-linecap="round" fill="none" opacity="0.3"/>
        <polyline class="lit-l-bolt lit-l-bolt-main lit-l-b3-d" points="78,-200 70,-160 82,-110 68,-70 86,-30 72,0 82,30 72,55 78,75"
          stroke="var(--c)" stroke-width="4" stroke-linecap="round" fill="none"/>
        <polyline class="lit-l-bolt lit-l-bolt-core lit-l-b3-d" points="78,-200 70,-160 82,-110 68,-70 86,-30 72,0 82,30 72,55 78,75"
          stroke="#fff" stroke-width="1.8" stroke-linecap="round" fill="none"/>
        <!-- Battlefield-wide ground shock -->
        <ellipse class="lit-l-shock-a" cx="50" cy="76" rx="60" ry="14" fill="none" stroke="var(--c)" stroke-width="3.5" opacity="0"/>
        <ellipse class="lit-l-shock-b" cx="50" cy="76" rx="60" ry="14" fill="none" stroke="#fff" stroke-width="2" opacity="0"/>
        <!-- Heavy spark scatter -->
        {#each Array.from({length: 12}) as _, i}
          {@const a = (i * Math.PI * 2) / 12}
          <circle class="lit-l-spark" style="--dx:{Math.cos(a) * 50}px; --dy:{Math.sin(a) * 30 + 6}px; animation-delay:{0.42 + i * 0.018}s;"
                  cx="50" cy="72" r="2.2" fill="var(--c)"/>
        {/each}

      {:else}
        <!-- GOD: storm cloud tears open the sky as HUNDREDS of rapid
             lightning strikes bombard the screen in chaotic succession -->
        <!-- Screen-wide flash strobe -->
        <rect class="lit-g-strobe" x="-300" y="-300" width="700" height="700" fill="#fff" opacity="0"/>
        <!-- Massive storm cloud overhead -->
        <ellipse class="lit-g-cloud" cx="50" cy="-100" rx="180" ry="48"
                 fill="var(--c)" opacity="0" style="filter:blur(22px)"/>
        <ellipse class="lit-g-cloud-d" cx="50" cy="-100" rx="180" ry="48"
                 fill="#1a1830" opacity="0" style="filter:blur(8px)"/>
        <!-- 14 chaotic strikes raining across screen — extend beyond viewBox
             so it reads as full-width bombardment -->
        {#each [
          {x:-40, d:0.10},{x:-15, d:0.16},{x:8,   d:0.12},{x:25,  d:0.22},
          {x:42,  d:0.18},{x:50,  d:0.26},{x:58,  d:0.30},{x:72,  d:0.20},
          {x:88,  d:0.34},{x:110, d:0.24},{x:135, d:0.38},{x:-25, d:0.42},
          {x:160, d:0.28},{x:0,   d:0.46},
        ] as strike, i}
          <polyline class="lit-g-strike lit-g-strike-glow"
            points="{strike.x},-200 {strike.x+8},-150 {strike.x-4},-100 {strike.x+10},-50 {strike.x-2},0 {strike.x+6},40 {strike.x},90"
            stroke="var(--c)" stroke-width="10" stroke-linecap="round" fill="none" opacity="0"
            style="animation-delay:{strike.d}s;"/>
          <polyline class="lit-g-strike lit-g-strike-main"
            points="{strike.x},-200 {strike.x+8},-150 {strike.x-4},-100 {strike.x+10},-50 {strike.x-2},0 {strike.x+6},40 {strike.x},90"
            stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none" opacity="0"
            style="animation-delay:{strike.d}s;"/>
        {/each}
        <!-- Battlefield-wide overcharge sheet -->
        <ellipse class="lit-g-charge" cx="50" cy="50" rx="160" ry="100"
                 fill="var(--c)" opacity="0" style="filter:blur(30px)"/>
        <!-- Sustained shock rings -->
        <circle class="lit-g-shock lit-g-sh1" cx="50" cy="50" r="20" fill="none" stroke="#fff" stroke-width="5" opacity="0"/>
        <circle class="lit-g-shock lit-g-sh2" cx="50" cy="50" r="20" fill="none" stroke="var(--c)" stroke-width="4" opacity="0"/>
        <!-- Crackle motes scattered everywhere -->
        {#each Array.from({length: 26}) as _, i}
          {@const a = (i * Math.PI * 2) / 26}
          {@const r = 110 + (i % 5) * 28}
          <circle class="lit-g-mote" style="--dx:{Math.cos(a) * r}px; --dy:{Math.sin(a) * r * 0.7 - 20}px; animation-delay:{0.55 + i * 0.011}s;"
                  cx="50" cy="50" r="2.4" fill="var(--c)"/>
        {/each}
      {/if}
    </svg>

  {:else if type === 'ice'}
    <!-- Ice — precision, fracturing, crystalline destruction. Each band
         tells a different freezing story; existing snowflake geometry is
         preserved at S-SSS scale, while GOD escalates into a frozen-star
         apocalypse. -->
    <svg viewBox="0 0 100 100" class="fx-svg ice-band-{tierBand}" overflow="visible">
      <defs>
        <radialGradient id="ic-core-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#fff" stop-opacity="1"/>
          <stop offset="45%" stop-color="#dff5ff" stop-opacity="0.9"/>
          <stop offset="80%" stop-color="var(--c)" stop-opacity="0.85"/>
          <stop offset="100%" stop-color="var(--c)" stop-opacity="0"/>
        </radialGradient>
      </defs>

      {#if tierBand === 'small'}
        <!-- F–D: razor-sharp snowflake spins forward, freezes target on impact -->
        <!-- Spinning snowflake projectile -->
        <g class="ic-s-flake">
          <line x1="30" y1="50" x2="70" y2="50" stroke="var(--c)" stroke-width="2.6" stroke-linecap="round"/>
          <line x1="50" y1="30" x2="50" y2="70" stroke="var(--c)" stroke-width="2.6" stroke-linecap="round"/>
          <line x1="36" y1="36" x2="64" y2="64" stroke="var(--c)" stroke-width="2" stroke-linecap="round"/>
          <line x1="64" y1="36" x2="36" y2="64" stroke="var(--c)" stroke-width="2" stroke-linecap="round"/>
          <!-- Tip notches -->
          <path d="M30 50 L36 46 M30 50 L36 54 M70 50 L64 46 M70 50 L64 54" stroke="var(--c)" stroke-width="1.6" fill="none"/>
          <circle cx="50" cy="50" r="4" fill="#fff"/>
        </g>
        <!-- Impact frost burst -->
        <circle class="ic-s-burst" cx="50" cy="50" r="22" fill="url(#ic-core-grad)"/>
        <!-- Frost ring + crystallisation overlay -->
        <circle class="ic-s-ring" cx="50" cy="50" r="20" fill="none" stroke="var(--c)" stroke-width="2.5" opacity="0"/>
        <!-- 4 sharp ice shards thrusting out -->
        {#each [0, 90, 180, 270] as deg, i}
          <polygon class="ic-s-shard" style="--rot:{deg}deg; animation-delay:{0.18 + i * 0.025}s;"
                   points="50,50 47,28 53,28" fill="var(--c)"/>
        {/each}

      {:else if tierBand === 'medium'}
        <!-- C–A: multiple crystalline snowflakes spiral around enemy as
             jagged ice erupts beneath them -->
        <ellipse cx="50" cy="55" rx="48" ry="34" fill="var(--c)" opacity="0.25"
                 class="ic-m-haze" style="filter:blur(10px)"/>
        <!-- 6 spiraling snowflakes -->
        {#each Array.from({length: 6}) as _, i}
          {@const a = (i * Math.PI * 2) / 6}
          {@const x = 50 + Math.cos(a) * 38}
          {@const y = 55 + Math.sin(a) * 28}
          <g class="ic-m-flake" style="--cx:{x}px; --cy:{y}px; --delay:{i * 0.04}s;">
            <line x1={x-6} y1={y} x2={x+6} y2={y} stroke="var(--c)" stroke-width="1.8"/>
            <line x1={x} y1={y-6} x2={x} y2={y+6} stroke="var(--c)" stroke-width="1.8"/>
            <line x1={x-4} y1={y-4} x2={x+4} y2={y+4} stroke="var(--c)" stroke-width="1.5"/>
            <line x1={x+4} y1={y-4} x2={x-4} y2={y+4} stroke="var(--c)" stroke-width="1.5"/>
          </g>
        {/each}
        <!-- Ground ice spikes erupting beneath the target -->
        {#each [22, 34, 46, 50, 54, 66, 78] as x, i}
          <polygon class="ic-m-spike" style="animation-delay:{0.35 + i * 0.03}s;"
                   points="{x},92 {x-3},70 {x+3},70" fill="var(--c)"/>
        {/each}
        <!-- Detonation flash at center -->
        <circle class="ic-m-flash" cx="50" cy="55" r="18" fill="url(#ic-core-grad)"/>
        <!-- Outward frost dust ring -->
        <circle class="ic-m-ring" cx="50" cy="55" r="20" fill="none" stroke="var(--c)" stroke-width="2.5" opacity="0"/>

      {:else if tierBand === 'large'}
        <!-- S–SSS: gigantic frozen sigil overhead, enormous ice spikes burst
             upward in every direction. Keeps the rich snowflake silhouette
             that lived here previously but slams it harder. -->
        <circle cx="50" cy="50" r="46" fill="var(--c)" opacity="0.28" class="ic-bloom" style="filter:blur(18px)"/>
        <!-- Overhead frozen sigil (hexagram-like, drifts down from above) -->
        <g class="ic-l-sigil">
          <polygon points="50,-30 70,-15 70,15 50,30 30,15 30,-15" stroke="var(--c)" stroke-width="2" fill="none" opacity="0.85"/>
          <polygon points="50,-20 62,-10 62,10 50,20 38,10 38,-10" stroke="var(--c)" stroke-width="1.4" fill="none" opacity="0.6"/>
          <line x1="50" y1="-30" x2="50" y2="30"   stroke="var(--c)" stroke-width="1.2" opacity="0.7"/>
          <line x1="30" y1="-15" x2="70" y2="15"   stroke="var(--c)" stroke-width="1.2" opacity="0.7"/>
          <line x1="70" y1="-15" x2="30" y2="15"   stroke="var(--c)" stroke-width="1.2" opacity="0.7"/>
        </g>
        <!-- 8 frost rays -->
        <g class="ic-rays">
          <line class="ic-ry" x1="50" y1="50" x2="50" y2="8"  stroke="var(--c)" stroke-width="3" stroke-linecap="round"/>
          <line class="ic-ry" x1="50" y1="50" x2="92" y2="50" stroke="var(--c)" stroke-width="3" stroke-linecap="round"/>
          <line class="ic-ry" x1="50" y1="50" x2="50" y2="92" stroke="var(--c)" stroke-width="3" stroke-linecap="round"/>
          <line class="ic-ry" x1="50" y1="50" x2="8"  y2="50" stroke="var(--c)" stroke-width="3" stroke-linecap="round"/>
          <line class="ic-ry" x1="50" y1="50" x2="20" y2="20" stroke="var(--c)" stroke-width="2.4" stroke-linecap="round"/>
          <line class="ic-ry" x1="50" y1="50" x2="80" y2="20" stroke="var(--c)" stroke-width="2.4" stroke-linecap="round"/>
          <line class="ic-ry" x1="50" y1="50" x2="80" y2="80" stroke="var(--c)" stroke-width="2.4" stroke-linecap="round"/>
          <line class="ic-ry" x1="50" y1="50" x2="20" y2="80" stroke="var(--c)" stroke-width="2.4" stroke-linecap="round"/>
        </g>
        <!-- 12 giant outward ice spikes (extend beyond viewBox) -->
        {#each Array.from({length: 12}) as _, i}
          {@const a = (i * Math.PI * 2) / 12}
          {@const tx = 50 + Math.cos(a) * 75}
          {@const ty = 50 + Math.sin(a) * 75}
          {@const bx1 = 50 + Math.cos(a - 0.08) * 18}
          {@const by1 = 50 + Math.sin(a - 0.08) * 18}
          {@const bx2 = 50 + Math.cos(a + 0.08) * 18}
          {@const by2 = 50 + Math.sin(a + 0.08) * 18}
          <polygon class="ic-l-spike" style="animation-delay:{0.18 + i * 0.018}s;"
                   points="{tx},{ty} {bx1},{by1} {bx2},{by2}" fill="var(--c)" opacity="0.9"/>
        {/each}
        <!-- Central core crystal -->
        <g class="ic-core">
          <polygon points="50,38 60,50 50,62 40,50" fill="var(--c)"/>
          <polygon points="50,42 56,50 50,58 44,50" fill="white" opacity="0.85"/>
        </g>
        <!-- Hanging frozen mist -->
        {#each [{x:32,y:32,r:2,o:0.85},{x:68,y:32,r:1.6,o:0.75},{x:32,y:68,r:1.6,o:0.75},{x:68,y:68,r:2,o:0.85},{x:50,y:22,r:1.4,o:0.7},{x:78,y:50,r:1.4,o:0.7},{x:50,y:78,r:1.4,o:0.7},{x:22,y:50,r:1.4,o:0.7}] as f}
          <circle class="ic-frost" cx={f.x} cy={f.y} r={f.r} fill="var(--c)" opacity={f.o}/>
        {/each}

      {:else}
        <!-- GOD: a colossal frozen star forms in the sky, then COLLAPSES
             into a glacier-sized eruption of ice crystals + blizzards -->
        <!-- Screen darken (cold pallor) -->
        <rect class="ic-g-pallor" x="-300" y="-300" width="700" height="700"
              fill="#cce8ff" opacity="0"/>
        <!-- Frozen star overhead -->
        <g class="ic-g-star">
          <polygon points="50,-80 60,-50 90,-50 65,-30 75,0 50,-18 25,0 35,-30 10,-50 40,-50"
                   fill="url(#ic-core-grad)"/>
          <polygon points="50,-70 56,-50 78,-50 60,-36 68,-14 50,-26 32,-14 40,-36 22,-50 44,-50"
                   fill="#fff"/>
          <!-- Star rays piercing outward -->
          {#each [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330] as deg, i}
            <line class="ic-g-ray" style="--rot:{deg}deg; animation-delay:{0.1 + i * 0.015}s;"
                  x1="50" y1="-40" x2="50" y2="-130" stroke="var(--c)" stroke-width="2.5"
                  stroke-linecap="round" opacity="0"/>
          {/each}
        </g>
        <!-- Collapse flash -->
        <circle class="ic-g-collapse" cx="50" cy="-30" r="60" fill="#fff" opacity="0"/>
        <!-- Massive eruption shockwave rings -->
        <circle class="ic-g-shock ic-g-s1" cx="50" cy="50" r="20" fill="none" stroke="#fff" stroke-width="5" opacity="0"/>
        <circle class="ic-g-shock ic-g-s2" cx="50" cy="50" r="20" fill="none" stroke="var(--c)" stroke-width="4" opacity="0"/>
        <circle class="ic-g-shock ic-g-s3" cx="50" cy="50" r="20" fill="none" stroke="var(--c)" stroke-width="3" opacity="0"/>
        <!-- Glacier-sized ice spikes erupting from all directions (extend
             far beyond viewBox to read as continent-shattering) -->
        {#each Array.from({length: 16}) as _, i}
          {@const a = (i * Math.PI * 2) / 16}
          {@const tx = 50 + Math.cos(a) * 220}
          {@const ty = 50 + Math.sin(a) * 220}
          {@const bx1 = 50 + Math.cos(a - 0.05) * 22}
          {@const by1 = 50 + Math.sin(a - 0.05) * 22}
          {@const bx2 = 50 + Math.cos(a + 0.05) * 22}
          {@const by2 = 50 + Math.sin(a + 0.05) * 22}
          <polygon class="ic-g-spike" style="animation-delay:{0.55 + i * 0.012}s;"
                   points="{tx},{ty} {bx1},{by1} {bx2},{by2}" fill="var(--c)" opacity="0.92"/>
        {/each}
        <!-- Central frozen core -->
        <g class="ic-g-core">
          <polygon points="50,30 70,50 50,70 30,50" fill="var(--c)"/>
          <polygon points="50,38 62,50 50,62 38,50" fill="#fff"/>
        </g>
        <!-- Blizzard crystals (snowflake hash spread across screen) -->
        {#each Array.from({length: 22}) as _, i}
          {@const a = (i * Math.PI * 2) / 22}
          {@const r = 130 + (i % 4) * 30}
          <g class="ic-g-flake" style="--dx:{Math.cos(a) * r}px; --dy:{Math.sin(a) * r * 0.85 - 20}px; animation-delay:{0.7 + i * 0.01}s;">
            <line x1="48" y1="50" x2="52" y2="50" stroke="var(--c)" stroke-width="1.4"/>
            <line x1="50" y1="48" x2="50" y2="52" stroke="var(--c)" stroke-width="1.4"/>
          </g>
        {/each}
      {/if}
    </svg>

  {:else if type === 'shadow'}
    <!-- Shadow — devouring umbral void. Bloom backdrop, churning dark core
         that pulses, six writhing tendrils reaching outward with stagger,
         drip droplets falling away, twin glowing eyes peering from the core. -->
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <circle cx="50" cy="50" r="44" fill="var(--c)" opacity="0.28" class="sh-bloom" style="filter:blur(18px)"/>
      <!-- Dark inner halo -->
      <circle cx="50" cy="50" r="34" fill="var(--c)" opacity="0.20" style="filter:blur(8px)"/>
      <!-- Core void mass -->
      <g class="sh-core">
        <circle cx="50" cy="50" r="20" fill="var(--c)" opacity="0.95"/>
        <circle cx="50" cy="50" r="13" fill="#0d0d16" opacity="0.55"/>
        <!-- Glowing eyes peering through -->
        <ellipse cx="44" cy="48" rx="2.5" ry="3.5" fill="var(--c)" class="sh-eye"/>
        <ellipse cx="56" cy="48" rx="2.5" ry="3.5" fill="var(--c)" class="sh-eye"/>
        <circle cx="44" cy="48" r="0.9" fill="white" opacity="0.85"/>
        <circle cx="56" cy="48" r="0.9" fill="white" opacity="0.85"/>
      </g>
      <!-- Six writhing tendrils — staggered reach outward -->
      <g class="sh-tendrils">
        <path class="sh-tnd st1" d="M50 50 Q34 30 18 12" stroke="var(--c)" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path class="sh-tnd st2" d="M50 50 Q66 30 82 12" stroke="var(--c)" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path class="sh-tnd st3" d="M50 50 Q70 60 92 64" stroke="var(--c)" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <path class="sh-tnd st4" d="M50 50 Q30 60 8 64"  stroke="var(--c)" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <path class="sh-tnd st5" d="M50 50 Q60 70 70 92" stroke="var(--c)" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path class="sh-tnd st6" d="M50 50 Q40 70 30 92" stroke="var(--c)" stroke-width="2" fill="none" stroke-linecap="round"/>
      </g>
      <!-- Drip droplets falling from underside -->
      <ellipse class="sh-drip sd1" cx="38" cy="74" rx="2.5" ry="4" fill="var(--c)"/>
      <ellipse class="sh-drip sd2" cx="50" cy="80" rx="2"   ry="3.5" fill="var(--c)" opacity="0.85"/>
      <ellipse class="sh-drip sd3" cx="62" cy="76" rx="2.5" ry="4" fill="var(--c)" opacity="0.9"/>
    </svg>

  {:else if type === 'holy'}
    {#if direction === 'center'}
      <!-- Heal mode — radiant divine bloom. Massive halo glow, a healing
           rune circle expanding outward with cross + 8 rays inside,
           rising starlight motes drift upward (signals "restoration" not
           "attack"), and bright central core that pulses. -->
      <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
        <!-- Big halo backdrop -->
        <circle cx="50" cy="50" r="48" fill="var(--c)" opacity="0.34" class="hh-bloom" style="filter:blur(20px)"/>
        <!-- Healing rune ring -->
        <circle class="hh-rune-ring" cx="50" cy="50" r="36" stroke="var(--c)" stroke-width="2" fill="none" opacity="0.85" stroke-dasharray="3 4"/>
        <!-- Cross + 8 divine rays inside the ring -->
        <g class="hh-rays">
          <line x1="50" y1="38" x2="50" y2="14" stroke="var(--c)" stroke-width="3.5" stroke-linecap="round"/>
          <line x1="50" y1="62" x2="50" y2="86" stroke="var(--c)" stroke-width="3.5" stroke-linecap="round"/>
          <line x1="38" y1="50" x2="14" y2="50" stroke="var(--c)" stroke-width="3.5" stroke-linecap="round"/>
          <line x1="62" y1="50" x2="86" y2="50" stroke="var(--c)" stroke-width="3.5" stroke-linecap="round"/>
          <line x1="41" y1="41" x2="22" y2="22" stroke="var(--c)" stroke-width="2.2" stroke-linecap="round" opacity="0.8"/>
          <line x1="59" y1="59" x2="78" y2="78" stroke="var(--c)" stroke-width="2.2" stroke-linecap="round" opacity="0.8"/>
          <line x1="59" y1="41" x2="78" y2="22" stroke="var(--c)" stroke-width="2.2" stroke-linecap="round" opacity="0.8"/>
          <line x1="41" y1="59" x2="22" y2="78" stroke="var(--c)" stroke-width="2.2" stroke-linecap="round" opacity="0.8"/>
        </g>
        <!-- Central healing orb -->
        <g class="hh-core">
          <circle cx="50" cy="50" r="11" fill="var(--c)"/>
          <circle cx="50" cy="50" r="6"  fill="white" opacity="0.95"/>
        </g>
        <!-- Rising healing motes — drift UPWARD signaling "restoration" -->
        <circle class="hh-mote hm1" cx="32" cy="70" r="1.8" fill="var(--c)"/>
        <circle class="hh-mote hm2" cx="50" cy="74" r="2"   fill="var(--c)"/>
        <circle class="hh-mote hm3" cx="68" cy="70" r="1.8" fill="var(--c)"/>
        <circle class="hh-mote hm4" cx="40" cy="78" r="1.5" fill="var(--c)" opacity="0.85"/>
        <circle class="hh-mote hm5" cx="60" cy="78" r="1.5" fill="var(--c)" opacity="0.85"/>
        <circle class="hh-mote hm6" cx="26" cy="66" r="1.6" fill="var(--c)" opacity="0.8"/>
        <circle class="hh-mote hm7" cx="74" cy="66" r="1.6" fill="var(--c)" opacity="0.8"/>
        <!-- Tip sparkles at ray endpoints -->
        <circle class="hh-sparkle hs1" cx="50" cy="14" r="2.2" fill="white"/>
        <circle class="hh-sparkle hs2" cx="86" cy="50" r="2"   fill="white"/>
        <circle class="hh-sparkle hs3" cx="50" cy="86" r="2.2" fill="white"/>
        <circle class="hh-sparkle hs4" cx="14" cy="50" r="2"   fill="white"/>
      </svg>
    {:else}
      <!-- Attack mode: star charges up → fires light beam trailing behind -->
      <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
        <!-- Charge-up bloom glow -->
        <circle cx="50" cy="50" r="38" fill="var(--c)" opacity="0.28" class="beam-bloom" style="filter:blur(18px)"/>
        <!-- Star that charges, then collapses into beam source -->
        <g class="star-charge">
          <polygon class="star-body" points="50,20 56,42 78,42 61,56 68,78 50,64 32,78 39,56 22,42 44,42" fill="var(--c)"/>
          <polygon points="50,28 54,43 67,43 57,51 61,64 50,56 39,64 43,51 33,43 46,43" fill="white" opacity="0.55"/>
          <circle cx="50" cy="50" r="7" fill="white" opacity="0.95"/>
        </g>
        <!-- Beam extending behind travel direction (trail) -->
        <line class="beam-line bl-glow"
          x1="50" y1="50"
          x2={isRtl ? 550 : -450} y2="50"
          stroke="var(--c)" stroke-width="22" stroke-linecap="round"/>
        <line class="beam-line bl-main"
          x1="50" y1="50"
          x2={isRtl ? 550 : -450} y2="50"
          stroke="var(--c)" stroke-width="8" stroke-linecap="round"/>
        <line class="beam-line bl-core"
          x1="50" y1="50"
          x2={isRtl ? 550 : -450} y2="50"
          stroke="white" stroke-width="3" stroke-linecap="round" opacity="0.9"/>
        <!-- Beam source sparkles -->
        <circle class="beam-spark bsp1" cx="50" cy="50" r="6" fill="var(--c)"/>
        <circle class="beam-spark bsp2" cx="50" cy="50" r="3.5" fill="white" opacity="0.9"/>
      </svg>
    {/if}

  {:else if type === 'time'}
    <!-- Time — concentric clock face with rotating gears, ticking minute
         and hour hands, hourglass ghosts trailing behind, and chrono-rune
         ticks at the cardinal positions. -->
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <circle cx="50" cy="50" r="44" fill="var(--c)" opacity="0.14" style="filter:blur(12px)"/>
      <!-- Outer clock-face ring with tick marks -->
      <g class="time-face">
        <circle cx="50" cy="50" r="42" stroke="var(--c)" stroke-width="2.5" fill="none" opacity="0.85"/>
        <circle cx="50" cy="50" r="36" stroke="var(--c)" stroke-width="1"   fill="none" opacity="0.45" stroke-dasharray="2 4"/>
        <!-- 12 cardinal tick marks -->
        <line x1="50" y1="10" x2="50" y2="16" stroke="var(--c)" stroke-width="2.5"/>
        <line x1="90" y1="50" x2="84" y2="50" stroke="var(--c)" stroke-width="2.5"/>
        <line x1="50" y1="90" x2="50" y2="84" stroke="var(--c)" stroke-width="2.5"/>
        <line x1="10" y1="50" x2="16" y2="50" stroke="var(--c)" stroke-width="2.5"/>
        <line x1="78" y1="22" x2="74" y2="26" stroke="var(--c)" stroke-width="1.8"/>
        <line x1="78" y1="78" x2="74" y2="74" stroke="var(--c)" stroke-width="1.8"/>
        <line x1="22" y1="22" x2="26" y2="26" stroke="var(--c)" stroke-width="1.8"/>
        <line x1="22" y1="78" x2="26" y2="74" stroke="var(--c)" stroke-width="1.8"/>
      </g>
      <!-- Concentric middle + inner rings (counter-rotating) -->
      <g class="time-mid">
        <circle cx="50" cy="50" r="27" stroke="var(--c)" stroke-width="2"   fill="none" opacity="0.75"/>
        <line x1="50" y1="23" x2="50" y2="29" stroke="var(--c)" stroke-width="1.8"/>
        <line x1="77" y1="50" x2="71" y2="50" stroke="var(--c)" stroke-width="1.8"/>
        <line x1="50" y1="77" x2="50" y2="71" stroke="var(--c)" stroke-width="1.8"/>
        <line x1="23" y1="50" x2="29" y2="50" stroke="var(--c)" stroke-width="1.8"/>
      </g>
      <g class="time-inner">
        <circle cx="50" cy="50" r="16" stroke="var(--c)" stroke-width="1.5" fill="none" opacity="0.55"/>
      </g>
      <!-- Echo hands — trailing ghost copies of the clock hands -->
      <line class="th-echo th-e1" x1="50" y1="50" x2="50" y2="22" stroke="var(--c)" stroke-width="1.5" stroke-linecap="round" opacity="0.35"/>
      <line class="th-echo th-e2" x1="50" y1="50" x2="68" y2="50" stroke="var(--c)" stroke-width="1.2" stroke-linecap="round" opacity="0.30"/>
      <!-- Primary clock hands -->
      <line class="time-hand th1" x1="50" y1="50" x2="50" y2="20" stroke="var(--c)" stroke-width="3" stroke-linecap="round"/>
      <line class="time-hand th2" x1="50" y1="50" x2="72" y2="50" stroke="var(--c)" stroke-width="2.2" stroke-linecap="round"/>
      <!-- Center hub -->
      <circle cx="50" cy="50" r="4.5" fill="var(--c)"/>
      <circle cx="50" cy="50" r="2"   fill="white" opacity="0.85"/>
      <!-- Sand particles falling through (hourglass feel) -->
      <circle class="sand-grain sg1" cx="46" cy="32" r="1.3" fill="var(--c)"/>
      <circle class="sand-grain sg2" cx="54" cy="34" r="1.0" fill="var(--c)" opacity="0.85"/>
      <circle class="sand-grain sg3" cx="50" cy="38" r="1.2" fill="var(--c)" opacity="0.7"/>
      <circle class="sand-grain sg4" cx="48" cy="62" r="1.3" fill="var(--c)" opacity="0.8"/>
      <circle class="sand-grain sg5" cx="52" cy="66" r="1.0" fill="var(--c)" opacity="0.65"/>
    </svg>

  {:else if type === 'psychic'}
    <!-- Psychic — concentric mental-wave rings + third eye + radiating
         thought spokes + neural sparks scattering outward. -->
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <circle cx="50" cy="50" r="44" fill="var(--c)" opacity="0.15" style="filter:blur(14px)"/>
      <!-- Brainwave rings — staggered expansion -->
      <circle cx="50" cy="50" r="10" stroke="var(--c)" stroke-width="3"   fill="none" class="psy-ring pr1"/>
      <circle cx="50" cy="50" r="22" stroke="var(--c)" stroke-width="2.5" fill="none" class="psy-ring pr2" opacity="0.8"/>
      <circle cx="50" cy="50" r="34" stroke="var(--c)" stroke-width="2"   fill="none" class="psy-ring pr3" opacity="0.6"/>
      <circle cx="50" cy="50" r="44" stroke="var(--c)" stroke-width="1.5" fill="none" class="psy-ring pr4" opacity="0.35"/>
      <!-- Third-eye almond shape -->
      <g class="psy-eye">
        <ellipse cx="50" cy="50" rx="20" ry="11" fill="var(--c)" opacity="0.18"/>
        <ellipse cx="50" cy="50" rx="20" ry="11" stroke="var(--c)" stroke-width="2" fill="none" opacity="0.9"/>
        <!-- Iris -->
        <circle cx="50" cy="50" r="7"  fill="var(--c)"/>
        <!-- Pupil -->
        <circle cx="50" cy="50" r="3.5" fill="#0d0d16"/>
        <!-- Highlight -->
        <circle cx="48" cy="48" r="1.5" fill="white" opacity="0.85"/>
      </g>
      <!-- Radiating thought-spokes (8 rays) -->
      <g class="psy-spokes">
        <line x1="50" y1="50" x2="50" y2="6"  stroke="var(--c)" stroke-width="1.6" opacity="0.55" stroke-linecap="round"/>
        <line x1="50" y1="50" x2="50" y2="94" stroke="var(--c)" stroke-width="1.6" opacity="0.55" stroke-linecap="round"/>
        <line x1="50" y1="50" x2="6"  y2="50" stroke="var(--c)" stroke-width="1.6" opacity="0.55" stroke-linecap="round"/>
        <line x1="50" y1="50" x2="94" y2="50" stroke="var(--c)" stroke-width="1.6" opacity="0.55" stroke-linecap="round"/>
        <line x1="50" y1="50" x2="20" y2="20" stroke="var(--c)" stroke-width="1.2" opacity="0.45" stroke-linecap="round"/>
        <line x1="50" y1="50" x2="80" y2="20" stroke="var(--c)" stroke-width="1.2" opacity="0.45" stroke-linecap="round"/>
        <line x1="50" y1="50" x2="20" y2="80" stroke="var(--c)" stroke-width="1.2" opacity="0.45" stroke-linecap="round"/>
        <line x1="50" y1="50" x2="80" y2="80" stroke="var(--c)" stroke-width="1.2" opacity="0.45" stroke-linecap="round"/>
      </g>
      <!-- Mind-sparks at the spoke tips -->
      <circle class="psy-spark ps1" cx="50" cy="6"  r="2" fill="var(--c)"/>
      <circle class="psy-spark ps2" cx="94" cy="50" r="2" fill="var(--c)"/>
      <circle class="psy-spark ps3" cx="50" cy="94" r="2" fill="var(--c)"/>
      <circle class="psy-spark ps4" cx="6"  cy="50" r="2" fill="var(--c)"/>
    </svg>

  {:else if type === 'poison'}
    <!-- Poison — toxic miasma cloud + corrosive acid drips. Bloom backdrop,
         skull silhouette inside the cloud, multiple bubbling toxin orbs,
         dripping acid droplets falling from the cloud underside, hazard
         tendrils curling outward. (Replaced the cartoon smiley.) -->
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <circle cx="50" cy="50" r="44" fill="var(--c)" opacity="0.24" class="ps-bloom" style="filter:blur(16px)"/>
      <!-- Cloud body — irregular blob -->
      <path class="ps-cloud" d="M30 46 Q22 34 32 28 Q40 22 50 26 Q60 22 68 28 Q78 34 70 46 Q82 50 74 60 Q66 70 50 66 Q34 70 26 60 Q18 50 30 46 Z"
            fill="var(--c)" opacity="0.85"/>
      <!-- Skull silhouette — sinister threat inside the cloud -->
      <g class="ps-skull">
        <ellipse cx="50" cy="44" rx="10" ry="11" fill="#0d0d16"/>
        <ellipse cx="45" cy="43" rx="2.2" ry="3" fill="var(--c)"/>
        <ellipse cx="55" cy="43" rx="2.2" ry="3" fill="var(--c)"/>
        <rect x="44" y="50" width="12" height="3" fill="#0d0d16"/>
        <line x1="47" y1="50" x2="47" y2="53" stroke="var(--c)" stroke-width="0.6"/>
        <line x1="50" y1="50" x2="50" y2="53" stroke="var(--c)" stroke-width="0.6"/>
        <line x1="53" y1="50" x2="53" y2="53" stroke="var(--c)" stroke-width="0.6"/>
      </g>
      <!-- Toxin bubble orbs floating outside the cloud -->
      <circle class="ps-bub pb1" cx="22" cy="32" r="3.5" fill="var(--c)" opacity="0.85"/>
      <circle class="ps-bub pb2" cx="78" cy="34" r="3"   fill="var(--c)" opacity="0.85"/>
      <circle class="ps-bub pb3" cx="80" cy="60" r="3.5" fill="var(--c)" opacity="0.9"/>
      <circle class="ps-bub pb4" cx="20" cy="62" r="3"   fill="var(--c)" opacity="0.85"/>
      <!-- Acid drips falling from cloud underside -->
      <ellipse class="ps-drip pd1" cx="36" cy="74" rx="1.8" ry="3.5" fill="var(--c)" opacity="0.85"/>
      <ellipse class="ps-drip pd2" cx="46" cy="80" rx="1.5" ry="3"   fill="var(--c)" opacity="0.8"/>
      <ellipse class="ps-drip pd3" cx="54" cy="82" rx="1.8" ry="3.5" fill="var(--c)" opacity="0.9"/>
      <ellipse class="ps-drip pd4" cx="64" cy="76" rx="1.5" ry="3"   fill="var(--c)" opacity="0.85"/>
    </svg>

  {:else if type === 'gravity'}
    <!-- Gravity — spacetime imploding into a singularity. Bloom backdrop,
         warped-space concentric rings collapsing inward, 8 streak lines
         shooting INTO the core (instead of outward), heavy debris flying
         in from the perimeter, dense compressed core with white-hot center. -->
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <circle cx="50" cy="50" r="46" fill="var(--c)" opacity="0.30" class="gv-bloom" style="filter:blur(20px)"/>
      <!-- Warped-space concentric rings -->
      <g class="gv-rings">
        <ellipse cx="50" cy="50" rx="40" ry="38" stroke="var(--c)" stroke-width="1.8" fill="none" opacity="0.5"  class="gv-ring gv-r1"/>
        <ellipse cx="50" cy="50" rx="30" ry="28" stroke="var(--c)" stroke-width="1.5" fill="none" opacity="0.7"  class="gv-ring gv-r2"/>
        <ellipse cx="50" cy="50" rx="20" ry="18" stroke="var(--c)" stroke-width="1.2" fill="none" opacity="0.85" class="gv-ring gv-r3"/>
      </g>
      <!-- 8 implosion streak lines pointing INTO center (with arrowheads at the inner end) -->
      <g class="gv-streaks">
        <line class="gv-st" x1="14" y1="50" x2="38" y2="50" stroke="var(--c)" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M38 50 L33 47 M38 50 L33 53" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round" fill="none"/>
        <line class="gv-st" x1="86" y1="50" x2="62" y2="50" stroke="var(--c)" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M62 50 L67 47 M62 50 L67 53" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round" fill="none"/>
        <line class="gv-st" x1="50" y1="14" x2="50" y2="38" stroke="var(--c)" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M50 38 L47 33 M50 38 L53 33" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round" fill="none"/>
        <line class="gv-st" x1="50" y1="86" x2="50" y2="62" stroke="var(--c)" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M50 62 L47 67 M50 62 L53 67" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round" fill="none"/>
        <line class="gv-st" x1="18" y1="18" x2="38" y2="38" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round"/>
        <line class="gv-st" x1="82" y1="18" x2="62" y2="38" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round"/>
        <line class="gv-st" x1="82" y1="82" x2="62" y2="62" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round"/>
        <line class="gv-st" x1="18" y1="82" x2="38" y2="62" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round"/>
      </g>
      <!-- Debris being pulled in from the perimeter -->
      <circle class="gv-debris gd1" cx="14" cy="22" r="2.4" fill="var(--c)"/>
      <circle class="gv-debris gd2" cx="86" cy="22" r="2.0" fill="var(--c)" opacity="0.85"/>
      <circle class="gv-debris gd3" cx="14" cy="78" r="2.2" fill="var(--c)" opacity="0.9"/>
      <circle class="gv-debris gd4" cx="86" cy="78" r="2.0" fill="var(--c)" opacity="0.85"/>
      <circle class="gv-debris gd5" cx="50" cy="8"  r="1.8" fill="var(--c)" opacity="0.75"/>
      <circle class="gv-debris gd6" cx="92" cy="50" r="1.8" fill="var(--c)" opacity="0.75"/>
      <!-- Compressed core -->
      <g class="gv-core">
        <circle cx="50" cy="50" r="10" fill="var(--c)"/>
        <circle cx="50" cy="50" r="5"  fill="white" opacity="0.95"/>
      </g>
    </svg>

  {:else if type === 'combo'}
    <!-- Combo — flurry of rapid strikes converging on the target. Six
         sequential slash arcs draw inward with stagger, plus a finishing
         crosscut at the end and an impact burst at the center. -->
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <circle cx="50" cy="50" r="44" fill="var(--c)" opacity="0.26" class="cb-bloom" style="filter:blur(16px)"/>
      <!-- 6 sequential strikes — each is a short arc swiping in from a
           different perimeter direction, staggered so it reads as a combo. -->
      <g class="cb-strikes">
        <path class="cb-s s1" d="M10 26 L34 36" stroke="var(--c)" stroke-width="3.5" stroke-linecap="round" fill="none"/>
        <path class="cb-s s2" d="M90 30 L66 38" stroke="var(--c)" stroke-width="3.5" stroke-linecap="round" fill="none"/>
        <path class="cb-s s3" d="M12 74 L36 64" stroke="var(--c)" stroke-width="3.2" stroke-linecap="round" fill="none"/>
        <path class="cb-s s4" d="M88 70 L64 62" stroke="var(--c)" stroke-width="3.2" stroke-linecap="round" fill="none"/>
        <path class="cb-s s5" d="M50 8  L50 36" stroke="var(--c)" stroke-width="3"   stroke-linecap="round" fill="none"/>
        <path class="cb-s s6" d="M50 92 L50 64" stroke="var(--c)" stroke-width="3"   stroke-linecap="round" fill="none"/>
      </g>
      <!-- Finishing cross-cut at the end -->
      <line class="cb-finish cb-f1" x1="14" y1="14" x2="86" y2="86" stroke="var(--c)" stroke-width="4" stroke-linecap="round"/>
      <line class="cb-finish cb-f2" x1="86" y1="14" x2="14" y2="86" stroke="var(--c)" stroke-width="4" stroke-linecap="round"/>
      <!-- Impact burst at the center -->
      <g class="cb-impact">
        <circle cx="50" cy="50" r="11" fill="var(--c)"/>
        <circle cx="50" cy="50" r="6"  fill="white" opacity="0.95"/>
      </g>
      <!-- Tip sparks at the strike endpoints -->
      <circle class="cb-spark sp1" cx="34" cy="36" r="2.2" fill="var(--c)"/>
      <circle class="cb-spark sp2" cx="66" cy="38" r="2.2" fill="var(--c)"/>
      <circle class="cb-spark sp3" cx="36" cy="64" r="2"   fill="var(--c)"/>
      <circle class="cb-spark sp4" cx="64" cy="62" r="2"   fill="var(--c)"/>
      <circle class="cb-spark sp5" cx="50" cy="36" r="2"   fill="var(--c)"/>
      <circle class="cb-spark sp6" cx="50" cy="64" r="2"   fill="var(--c)"/>
    </svg>

  {:else if type === 'crit'}
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <circle cx="50" cy="50" r="48" fill="var(--c)" opacity="0.22" style="filter:blur(16px)"/>
      <circle class="crit-shockwave csw" cx="50" cy="50" r="44" stroke="var(--c)" stroke-width="2" fill="none" opacity="0.5"/>
      <g class="crit-g">
        <polygon points="50,8 55,44 90,50 55,56 50,92 45,56 10,50 45,44" fill="var(--c)" opacity="0.9"/>
        <polygon points="50,22 53,44 74,50 53,56 50,78 47,56 26,50 47,44" fill="var(--c)"/>
        <circle cx="50" cy="50" r="9" fill="white" opacity="0.92"/>
      </g>
      <line class="shard sh1" x1="50" y1="50" x2="10" y2="8"  stroke="var(--c)" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
      <line class="shard sh2" x1="50" y1="50" x2="90" y2="10" stroke="var(--c)" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
      <line class="shard sh3" x1="50" y1="50" x2="8"  y2="90" stroke="var(--c)" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
      <line class="shard sh4" x1="50" y1="50" x2="92" y2="88" stroke="var(--c)" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
      <line class="shard sh5" x1="50" y1="50" x2="50" y2="2"  stroke="var(--c)" stroke-width="2" stroke-linecap="round" opacity="0.55"/>
      <line class="shard sh6" x1="50" y1="50" x2="50" y2="98" stroke="var(--c)" stroke-width="1.5" stroke-linecap="round" opacity="0.45"/>
    </svg>

  {:else if type === 'shield'}
    <!-- Shield — divine aegis. Bloom pulses, three nested hex shields
         with runic etchings rotate in opposite directions, an impact
         flash sparks off the center where the blow lands, sparks burst
         from each hex vertex. Three layered block-impact rings ripple
         outward. -->
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <circle cx="50" cy="50" r="54" fill="var(--c)" opacity="0.38" class="sd-bloom" style="filter:blur(22px)"/>
      <!-- Outer hex shield -->
      <g class="sd-hex-outer">
        <polygon points="50,4 90,27 90,73 50,96 10,73 10,27"
                 stroke="var(--c)" stroke-width="4" fill="var(--c)" fill-opacity="0.22"/>
        <!-- Runic etchings on each face -->
        <line x1="50" y1="4"  x2="50" y2="14" stroke="var(--c)" stroke-width="1.5" opacity="0.7"/>
        <line x1="90" y1="27" x2="82" y2="32" stroke="var(--c)" stroke-width="1.5" opacity="0.7"/>
        <line x1="90" y1="73" x2="82" y2="68" stroke="var(--c)" stroke-width="1.5" opacity="0.7"/>
        <line x1="50" y1="96" x2="50" y2="86" stroke="var(--c)" stroke-width="1.5" opacity="0.7"/>
        <line x1="10" y1="73" x2="18" y2="68" stroke="var(--c)" stroke-width="1.5" opacity="0.7"/>
        <line x1="10" y1="27" x2="18" y2="32" stroke="var(--c)" stroke-width="1.5" opacity="0.7"/>
      </g>
      <!-- Middle hex (counter-rotating) -->
      <g class="sd-hex-mid">
        <polygon points="50,18 76,33 76,67 50,82 24,67 24,33"
                 stroke="var(--c)" stroke-width="2" fill="none" opacity="0.75"/>
      </g>
      <!-- Inner hex with cross and core -->
      <g class="sd-hex-inner">
        <polygon points="50,28 66,38 66,62 50,72 34,62 34,38"
                 stroke="var(--c)" stroke-width="1.5" fill="var(--c)" fill-opacity="0.18" opacity="0.85"/>
        <line x1="50" y1="28" x2="50" y2="72" stroke="var(--c)" stroke-width="3" stroke-linecap="round" opacity="0.9"/>
        <line x1="34" y1="50" x2="66" y2="50" stroke="var(--c)" stroke-width="3" stroke-linecap="round" opacity="0.9"/>
        <circle cx="50" cy="50" r="9" fill="var(--c)" class="sd-core"/>
        <circle cx="50" cy="50" r="5" fill="white" opacity="0.95"/>
      </g>
      <!-- Three expanding block-impact rings (drawn LAST so they sit on top) -->
      <circle class="sd-ring sdr1" cx="50" cy="50" r="46" stroke="var(--c)" stroke-width="5"   fill="none"/>
      <circle class="sd-ring sdr2" cx="50" cy="50" r="46" stroke="var(--c)" stroke-width="3"   fill="none"/>
      <circle class="sd-ring sdr3" cx="50" cy="50" r="46" stroke="var(--c)" stroke-width="2"   fill="none"/>
      <!-- Hex-vertex impact sparks -->
      <circle class="sd-spark ss1" cx="50" cy="4"  r="4"   fill="var(--c)"/>
      <circle class="sd-spark ss2" cx="90" cy="27" r="3.5" fill="var(--c)"/>
      <circle class="sd-spark ss3" cx="90" cy="73" r="3.5" fill="var(--c)"/>
      <circle class="sd-spark ss4" cx="50" cy="96" r="4"   fill="var(--c)"/>
      <circle class="sd-spark ss5" cx="10" cy="73" r="3.5" fill="var(--c)"/>
      <circle class="sd-spark ss6" cx="10" cy="27" r="3.5" fill="var(--c)"/>
    </svg>

  {:else if type === 'berserker'}
    <!-- Berserker — primal fury surge. Crimson bloom pulses, jagged rage
         spikes burst outward from a roaring core, dripping bloodlust
         motes shake violently, screaming arc lines vibrate the air. -->
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <circle cx="50" cy="50" r="48" fill="var(--c)" opacity="0.36" class="bk-bloom" style="filter:blur(20px)"/>
      <!-- Outer pulsing rage ring with jagged inner edge -->
      <polygon class="bk-ring" fill="none" stroke="var(--c)" stroke-width="2.5" opacity="0.7"
               points="50,2 56,18 70,8 64,24 84,16 70,30 92,32 74,40 96,52 76,52 92,68 72,60 80,80 62,70 64,92 50,76 36,92 38,70 20,80 28,60 8,68 24,52 4,52 26,40 8,32 30,30 16,16 36,24 30,8 44,18"/>
      <!-- Eight rage spikes — jagged, thicker at the inside -->
      <g class="bk-spikes">
        <polygon class="bk-sp bsp1" points="50,50 38,8 50,18 62,8" fill="var(--c)"/>
        <polygon class="bk-sp bsp2" points="50,50 92,38 82,50 92,62" fill="var(--c)" opacity="0.92"/>
        <polygon class="bk-sp bsp3" points="50,50 62,92 50,82 38,92" fill="var(--c)" opacity="0.92"/>
        <polygon class="bk-sp bsp4" points="50,50 8,62 18,50 8,38" fill="var(--c)" opacity="0.92"/>
        <polygon class="bk-sp bsp5" points="50,50 18,18 32,22 26,32" fill="var(--c)" opacity="0.85"/>
        <polygon class="bk-sp bsp6" points="50,50 82,18 74,32 68,22" fill="var(--c)" opacity="0.85"/>
        <polygon class="bk-sp bsp7" points="50,50 82,82 68,78 74,68" fill="var(--c)" opacity="0.85"/>
        <polygon class="bk-sp bsp8" points="50,50 18,82 26,68 32,78" fill="var(--c)" opacity="0.85"/>
      </g>
      <!-- Roaring core — pulsing dark center -->
      <g class="bk-core">
        <circle cx="50" cy="50" r="16" fill="var(--c)"/>
        <circle cx="50" cy="50" r="10" fill="#0d0d16" opacity="0.55"/>
        <circle cx="50" cy="50" r="5"  fill="white" opacity="0.95"/>
      </g>
      <!-- Vibrating arc lines (screaming air) -->
      <path class="bk-arc bka1" d="M16 32 Q30 24 44 32" stroke="var(--c)" stroke-width="1.6" fill="none" stroke-linecap="round" opacity="0.7"/>
      <path class="bk-arc bka2" d="M84 32 Q70 24 56 32" stroke="var(--c)" stroke-width="1.6" fill="none" stroke-linecap="round" opacity="0.7"/>
      <path class="bk-arc bka3" d="M16 68 Q30 76 44 68" stroke="var(--c)" stroke-width="1.4" fill="none" stroke-linecap="round" opacity="0.6"/>
      <path class="bk-arc bka4" d="M84 68 Q70 76 56 68" stroke="var(--c)" stroke-width="1.4" fill="none" stroke-linecap="round" opacity="0.6"/>
      <!-- Bloodlust motes scattering outward -->
      <circle class="bk-mote bm1" cx="50" cy="4"  r="2.4" fill="var(--c)"/>
      <circle class="bk-mote bm2" cx="96" cy="50" r="2"   fill="var(--c)" opacity="0.85"/>
      <circle class="bk-mote bm3" cx="50" cy="96" r="2.4" fill="var(--c)"/>
      <circle class="bk-mote bm4" cx="4"  cy="50" r="2"   fill="var(--c)" opacity="0.85"/>
    </svg>

  {:else if type === 'wind'}
    <!-- Wind — motion, slicing, displacement. From a single blade-cut to a
         world-sized hurricane apocalypse. -->
    <svg viewBox="0 0 100 100" class="fx-svg wn-band-{tierBand}" overflow="visible">
      {#if tierBand === 'small'}
        <!-- F–D: a compressed BLADE of wind slices across the target -->
        <path class="wn-s-blade-glow"
              d="M-10 52 Q30 38 50 50 Q72 62 110 48"
              stroke="var(--c)" stroke-width="10" fill="none" stroke-linecap="round" opacity="0"/>
        <path class="wn-s-blade"
              d="M-10 52 Q30 38 50 50 Q72 62 110 48"
              stroke="var(--c)" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path class="wn-s-blade-core"
              d="M-10 52 Q30 38 50 50 Q72 62 110 48"
              stroke="#fff" stroke-width="1.4" fill="none" stroke-linecap="round" opacity="0.9"/>
        <!-- Trailing slipstream lines -->
        <line class="wn-s-slip" style="animation-delay:0.04s;" x1="60" y1="42" x2="100" y2="40" stroke="var(--c)" stroke-width="1.6" opacity="0"/>
        <line class="wn-s-slip" style="animation-delay:0.07s;" x1="62" y1="58" x2="98"  y2="60" stroke="var(--c)" stroke-width="1.4" opacity="0"/>
        <line class="wn-s-slip" style="animation-delay:0.10s;" x1="55" y1="48" x2="92"  y2="46" stroke="var(--c)" stroke-width="1.2" opacity="0"/>
        <!-- Endpoint mote scatter -->
        {#each [{x:78,y:40,d:0.18},{x:84,y:52,d:0.20},{x:82,y:58,d:0.22}] as m, i}
          <circle class="wn-s-mote" style="animation-delay:{m.d}s;" cx={m.x} cy={m.y} r="1.6" fill="var(--c)"/>
        {/each}

      {:else if tierBand === 'medium'}
        <!-- C–A: violent gusts spiral around the enemy, launching cutting
             air currents rapidly -->
        <ellipse cx="50" cy="50" rx="48" ry="42" fill="var(--c)" opacity="0.18" class="wn-m-haze" style="filter:blur(10px)"/>
        <!-- 8 spiral gust arcs orbiting the target -->
        {#each [0, 45, 90, 135, 180, 225, 270, 315] as deg, i}
          <path class="wn-m-arc" style="--rot:{deg}deg; animation-delay:{i * 0.04}s;"
                d="M50 50 Q60 28 80 22 Q72 36 60 44" stroke="var(--c)" stroke-width="2.4"
                fill="none" stroke-linecap="round" opacity="0"/>
        {/each}
        <!-- Cutting air currents (sharp diagonal slashes) -->
        {#each [
          {x1:8, y1:18, x2:38, y2:42, d:0.20},
          {x1:92,y1:24, x2:64, y2:42, d:0.24},
          {x1:6, y1:80, x2:38, y2:60, d:0.28},
          {x1:94,y1:78, x2:60, y2:58, d:0.32},
          {x1:50,y1:0,  x2:50, y2:34, d:0.36},
          {x1:50,y1:100,x2:50, y2:64, d:0.40},
        ] as s, i}
          <line class="wn-m-cut" style="animation-delay:{s.d}s;"
                x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="var(--c)"
                stroke-width="2.2" stroke-linecap="round" opacity="0"/>
        {/each}
        <!-- Central vortex eye -->
        <g class="wn-m-eye">
          <path d="M50 50 Q58 40 50 28 Q40 24 38 40 Q36 58 56 62 Q72 60 70 46"
                stroke="var(--c)" stroke-width="2" fill="none" stroke-linecap="round"/>
          <circle cx="50" cy="50" r="6" fill="var(--c)" opacity="0.9"/>
        </g>

      {:else if tierBand === 'large'}
        <!-- S–SSS: a COLOSSAL tornado forms, dragging debris and enemies
             upward violently -->
        <!-- Tornado funnel — wide top, narrow base (extends above viewBox) -->
        <g class="wn-l-funnel">
          <path d="M-40 -100 Q-20 -60 10 -40 Q22 -10 30 20 Q36 50 40 90 L60 90 Q64 50 70 20 Q78 -10 90 -40 Q120 -60 140 -100 Z"
                fill="var(--c)" opacity="0.35"/>
          <path d="M-20 -100 Q0 -60 22 -40 Q30 -10 36 20 Q40 50 44 90 L56 90 Q60 50 64 20 Q70 -10 78 -40 Q100 -60 120 -100 Z"
                fill="var(--c)" opacity="0.55"/>
          <path d="M10 -100 Q20 -60 32 -40 Q38 -10 42 20 Q44 50 46 90 L54 90 Q56 50 58 20 Q62 -10 68 -40 Q80 -60 90 -100 Z"
                fill="var(--c)" opacity="0.75"/>
          <!-- Internal swirl lines -->
          {#each [-80, -50, -20, 10, 40, 70] as y, i}
            {@const w = 18 + Math.abs(y + 30) * 0.45}
            <ellipse cx="50" cy={y} rx={w} ry="3" fill="none" stroke="#fff" stroke-width="1" opacity="0.5"/>
          {/each}
        </g>
        <!-- Whipping debris flying around -->
        {#each Array.from({length: 14}) as _, i}
          {@const a = (i * Math.PI * 2) / 14}
          {@const r = 50 + (i % 3) * 18}
          <polygon class="wn-l-debris" style="--dx:{Math.cos(a) * r}px; --dy:{Math.sin(a) * r * 0.5 - 30}px; animation-delay:{i * 0.025}s;"
                   points="50,50 53,48 55,52 51,54" fill="var(--c)" opacity="0.9"/>
        {/each}
        <!-- Ground impact shock + dust ring -->
        <ellipse class="wn-l-shock" cx="50" cy="94" rx="56" ry="10" fill="none" stroke="var(--c)" stroke-width="3" opacity="0"/>
        <ellipse class="wn-l-dust" cx="50" cy="94" rx="60" ry="12" fill="var(--c)" opacity="0" style="filter:blur(8px)"/>

      {:else}
        <!-- GOD: multiple world-sized tornadoes twist together into a
             HURRICANE APOCALYPSE, creating shockwaves with every rotation -->
        <!-- Screen warp haze -->
        <rect class="wn-g-warp" x="-300" y="-300" width="700" height="700"
              fill="var(--c)" opacity="0" style="filter:blur(40px)"/>
        <!-- Three intertwined tornado columns (left/center/right) -->
        {#each [-60, 0, 60] as off, i}
          <g class="wn-g-tornado" style="--off:{off}px; animation-delay:{i * 0.08}s;">
            <path d={`M${-90+off} -200 Q${-40+off} -100 ${10+off} -60 Q${20+off} 0 ${30+off} 50 Q${36+off} 90 ${40+off} 120 L${60+off} 120 Q${64+off} 90 ${70+off} 50 Q${80+off} 0 ${90+off} -60 Q${140+off} -100 ${190+off} -200 Z`}
                  fill="var(--c)" opacity="0.55"/>
            <path d={`M${-40+off} -200 Q${0+off} -100 ${22+off} -60 Q${30+off} 0 ${38+off} 50 Q${42+off} 90 ${44+off} 120 L${56+off} 120 Q${58+off} 90 ${62+off} 50 Q${70+off} 0 ${78+off} -60 Q${100+off} -100 ${140+off} -200 Z`}
                  fill="#fff" opacity="0.35"/>
          </g>
        {/each}
        <!-- Massive rotational shockwaves -->
        <ellipse class="wn-g-shock wn-g-sh1" cx="50" cy="80" rx="20" ry="6" fill="none" stroke="var(--c)" stroke-width="5" opacity="0"/>
        <ellipse class="wn-g-shock wn-g-sh2" cx="50" cy="80" rx="20" ry="6" fill="none" stroke="#fff" stroke-width="3" opacity="0"/>
        <ellipse class="wn-g-shock wn-g-sh3" cx="50" cy="80" rx="20" ry="6" fill="none" stroke="var(--c)" stroke-width="2" opacity="0"/>
        <!-- Screen-wide flying debris storm -->
        {#each Array.from({length: 30}) as _, i}
          {@const a = (i * Math.PI * 2) / 30}
          {@const r = 130 + (i % 5) * 30}
          <polygon class="wn-g-debris" style="--dx:{Math.cos(a) * r}px; --dy:{Math.sin(a) * r * 0.7 - 30}px; animation-delay:{0.4 + i * 0.01}s;"
                   points="50,50 53,48 55,52 51,54" fill="var(--c)" opacity="0.85"/>
        {/each}
        <!-- Slipstream warp lines stretched across screen -->
        {#each [-50, -30, -10, 10, 30, 50, 70, 90, 110, 130] as y, i}
          <path class="wn-g-slip" style="animation-delay:{0.3 + i * 0.04}s;"
                d={`M-200 ${y} Q0 ${y - 6} 50 ${y} Q140 ${y + 6} 280 ${y}`}
                stroke="#fff" stroke-width="1.4" fill="none" opacity="0"/>
        {/each}
      {/if}
    </svg>

  {:else if type === 'earth'}
    <!-- Earth — weight, pressure, destruction. From a single fissure to a
         continent-shattering quake. -->
    <svg viewBox="0 0 100 100" class="fx-svg er-band-{tierBand}" overflow="visible">
      {#if tierBand === 'small'}
        <!-- F–D: the ground cracks beneath the enemy as jagged stone erupts upward -->
        <line x1="14" y1="88" x2="86" y2="88" stroke="var(--c)" stroke-width="2.4" stroke-linecap="round" class="er-s-ground"/>
        <!-- Fissure crack -->
        <polyline class="er-s-crack" points="50,88 46,76 54,68 48,56 56,46" stroke="var(--c)" stroke-width="2" fill="none" stroke-linecap="round" opacity="0"/>
        <!-- 3 stone spikes erupting -->
        {#each [{x:50,h:50,d:0.10},{x:34,h:34,d:0.14},{x:66,h:34,d:0.18}] as s, i}
          <polygon class="er-s-spike" style="animation-delay:{s.d}s;"
                   points="{s.x},88 {s.x-5},{88-s.h} {s.x+5},{88-s.h}" fill="var(--c)"/>
        {/each}
        <!-- Rock chips + dust -->
        {#each [{x:36,y:60,d:0.20},{x:60,y:58,d:0.22},{x:50,y:46,d:0.24}] as c, i}
          <polygon class="er-s-chip" style="animation-delay:{c.d}s;"
                   points="{c.x},{c.y} {c.x+3},{c.y-2} {c.x+4},{c.y+2} {c.x+1},{c.y+3}" fill="var(--c)"/>
        {/each}

      {:else if tierBand === 'medium'}
        <!-- C–A: massive boulders slam down while the battlefield fractures -->
        <ellipse cx="50" cy="88" rx="50" ry="12" fill="var(--c)" opacity="0.3" class="er-m-bloom" style="filter:blur(10px)"/>
        <line x1="2" y1="88" x2="98" y2="88" stroke="var(--c)" stroke-width="2.4" stroke-linecap="round"/>
        <!-- Multi-direction fissures -->
        {#each [
          'M50,88 L40,76 L46,64 L36,52 L42,40',
          'M50,88 L60,76 L54,64 L64,52 L58,40',
          'M50,88 L36,82 L24,84 L12,88',
          'M50,88 L64,82 L76,84 L88,88',
        ] as path, i}
          <path class="er-m-crack" style="animation-delay:{0.06 + i * 0.04}s;"
                d={path} stroke="var(--c)" stroke-width="2.2" fill="none" stroke-linecap="round" opacity="0"/>
        {/each}
        <!-- 4 massive boulders crashing down -->
        {#each [{x:24,d:0.18,r:7},{x:42,d:0.22,r:9},{x:58,d:0.26,r:9},{x:76,d:0.20,r:7}] as b, i}
          <circle class="er-m-boulder" style="--bx:{b.x}px; animation-delay:{b.d}s;"
                  cx={b.x} cy="50" r={b.r} fill="var(--c)" opacity="0.95"/>
          <ellipse class="er-m-bdust" style="animation-delay:{b.d + 0.18}s; filter:blur(4px);"
                   cx={b.x} cy="88" rx="14" ry="4" fill="var(--c)" opacity="0"/>
        {/each}
        <!-- Spike eruption row -->
        {#each [{x:14,h:24},{x:30,h:34},{x:50,h:46},{x:70,h:34},{x:86,h:24}] as s, i}
          <polygon class="er-m-spike" style="animation-delay:{0.30 + i * 0.025}s;"
                   points="{s.x},88 {s.x-5},{88-s.h} {s.x+5},{88-s.h}" fill="var(--c)"/>
        {/each}

      {:else if tierBand === 'large'}
        <!-- S–SSS: TITANIC stone pillars burst upward as shockwaves split
             the earth open -->
        <ellipse cx="50" cy="88" rx="60" ry="14" fill="var(--c)" opacity="0.35" class="er-l-bloom" style="filter:blur(12px)"/>
        <line x1="-10" y1="88" x2="110" y2="88" stroke="var(--c)" stroke-width="3" stroke-linecap="round"/>
        <!-- Deep canyon fissures across the field -->
        {#each [
          'M50,88 L40,70 L48,52 L36,32 L42,12 L30,-10',
          'M50,88 L60,70 L52,52 L64,32 L58,12 L70,-10',
          'M50,88 L30,82 L14,80 L-6,86',
          'M50,88 L70,82 L86,80 L106,86',
        ] as path, i}
          <path class="er-l-crack" style="animation-delay:{i * 0.05}s;"
                d={path} stroke="var(--c)" stroke-width="3" fill="none" stroke-linecap="round" opacity="0"/>
        {/each}
        <!-- 5 titanic pillars (extend high above viewBox) -->
        {#each [{x:14,d:0.20},{x:32,d:0.24},{x:50,d:0.16},{x:68,d:0.24},{x:86,d:0.20}] as p, i}
          <polygon class="er-l-pillar" style="animation-delay:{p.d}s;"
                   points="{p.x},88 {p.x-9},-30 {p.x+9},-30" fill="var(--c)" opacity="0.92"/>
          <polygon class="er-l-pillar" style="animation-delay:{p.d}s;"
                   points="{p.x},88 {p.x-3},-20 {p.x+3},-20" fill="#fff" opacity="0.15"/>
        {/each}
        <!-- Ground shockwave -->
        <ellipse class="er-l-shock" cx="50" cy="88" rx="20" ry="6" fill="none"
                 stroke="var(--c)" stroke-width="3" opacity="0"/>
        <!-- Flying boulders + rock storm -->
        {#each Array.from({length: 12}) as _, i}
          {@const a = -Math.PI + (i / 12) * Math.PI}
          <polygon class="er-l-boulder" style="--dx:{Math.cos(a) * 55}px; --dy:{Math.sin(a) * 50 - 10}px; animation-delay:{0.32 + i * 0.018}s;"
                   points="50,88 56,84 58,90 52,94" fill="var(--c)" opacity="0.9"/>
        {/each}
        <!-- Dust column post-impact -->
        <ellipse class="er-l-dustcol" cx="50" cy="74" rx="40" ry="22"
                 fill="var(--c)" opacity="0" style="filter:blur(10px)"/>

      {:else}
        <!-- GOD: a MOUNTAIN-SIZED mass crashes down from above, obliterating
             the battlefield in a continent-shattering quake -->
        <!-- Screen ground darken -->
        <rect class="er-g-darken" x="-300" y="-300" width="700" height="700" fill="#1a0e00" opacity="0"/>
        <!-- Mountain silhouette falling from above viewBox -->
        <g class="er-g-mountain">
          <path d="M-60 -300 L20 -180 L50 -260 L80 -180 L160 -300 L180 -100 L-80 -100 Z"
                fill="var(--c)" opacity="0.95"/>
          <path d="M-60 -300 L20 -180 L50 -260 L80 -180 L160 -300 L180 -100 L-80 -100 Z"
                fill="#000" opacity="0.35"/>
          <!-- Mountain peak highlight -->
          <polygon points="50,-260 60,-200 40,-200" fill="#fff" opacity="0.25"/>
        </g>
        <!-- Catastrophic crack network covering screen -->
        {#each [
          'M-100,100 L0,90 L20,80 L40,90 L50,100',
          'M50,100 L60,90 L80,80 L100,90 L200,100',
          'M-100,100 L-50,80 L-30,50 L0,30 L20,0',
          'M200,100 L150,80 L130,50 L100,30 L80,0',
          'M50,100 L40,60 L60,30 L50,-10',
        ] as path, i}
          <path class="er-g-crack" style="animation-delay:{0.55 + i * 0.04}s;"
                d={path} stroke="var(--c)" stroke-width="5" fill="none" stroke-linecap="round" opacity="0"/>
        {/each}
        <!-- Battlefield-wide shockwaves -->
        <ellipse class="er-g-shock er-g-sh1" cx="50" cy="100" rx="30" ry="8" fill="none" stroke="var(--c)" stroke-width="5" opacity="0"/>
        <ellipse class="er-g-shock er-g-sh2" cx="50" cy="100" rx="30" ry="8" fill="none" stroke="#fff" stroke-width="3" opacity="0"/>
        <ellipse class="er-g-shock er-g-sh3" cx="50" cy="100" rx="30" ry="8" fill="none" stroke="var(--c)" stroke-width="2" opacity="0"/>
        <!-- Massive screen-wide dust cloud -->
        <ellipse class="er-g-dust" cx="50" cy="90" rx="200" ry="50" fill="var(--c)" opacity="0" style="filter:blur(20px)"/>
        <!-- Boulder fragments scattered everywhere -->
        {#each Array.from({length: 24}) as _, i}
          {@const a = -Math.PI * 0.1 + (i / 24) * Math.PI * 1.2}
          {@const r = 100 + (i % 4) * 30}
          <polygon class="er-g-rock" style="--dx:{Math.cos(a) * r}px; --dy:{Math.sin(a) * r * 0.55 + 10}px; animation-delay:{0.65 + i * 0.012}s;"
                   points="50,90 56,84 58,90 52,94" fill="var(--c)" opacity="0.92"/>
        {/each}
      {/if}
    </svg>

  {:else if type === 'blood'}
    <!-- Blood — visceral splatter + arterial spray. Bloom backdrop, core
         wound pool, 8 spray droplets flying radially with stagger, drip
         trails forming on the ground, splatter mini-droplets scattered. -->
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <circle cx="50" cy="50" r="42" fill="var(--c)" opacity="0.26" class="bl-bloom" style="filter:blur(14px)"/>
      <!-- Splatter background — large irregular blob -->
      <path class="bl-splat" d="M50 18 Q60 22 70 30 Q86 36 80 50 Q90 60 78 70 Q72 84 56 80 Q44 88 32 80 Q18 72 22 56 Q12 44 22 34 Q30 22 50 18 Z"
            fill="var(--c)" opacity="0.45"/>
      <!-- Core wound -->
      <g class="bl-core">
        <circle cx="50" cy="50" r="14" fill="var(--c)" opacity="0.95"/>
        <circle cx="50" cy="50" r="8"  fill="#3a0000" opacity="0.7"/>
      </g>
      <!-- 8 arterial spray droplets — elongated, flying radially -->
      <g class="bl-spray">
        <ellipse class="bl-d bd1" cx="50" cy="20" rx="4"   ry="9"  fill="var(--c)"/>
        <ellipse class="bl-d bd2" cx="72" cy="28" rx="3.5" ry="8"  fill="var(--c)" transform="rotate(45 72 28)"/>
        <ellipse class="bl-d bd3" cx="82" cy="50" rx="4"   ry="9"  fill="var(--c)" transform="rotate(90 82 50)"/>
        <ellipse class="bl-d bd4" cx="72" cy="72" rx="3.5" ry="8"  fill="var(--c)" transform="rotate(135 72 72)"/>
        <ellipse class="bl-d bd5" cx="50" cy="82" rx="3.5" ry="8"  fill="var(--c)" transform="rotate(180 50 82)"/>
        <ellipse class="bl-d bd6" cx="28" cy="72" rx="3.5" ry="8"  fill="var(--c)" transform="rotate(-135 28 72)"/>
        <ellipse class="bl-d bd7" cx="18" cy="50" rx="4"   ry="9"  fill="var(--c)" transform="rotate(-90 18 50)"/>
        <ellipse class="bl-d bd8" cx="28" cy="28" rx="3.5" ry="8"  fill="var(--c)" transform="rotate(-45 28 28)"/>
      </g>
      <!-- Splatter sub-droplets scattered around -->
      <circle class="bl-dot" cx="36" cy="14" r="1.5" fill="var(--c)"/>
      <circle class="bl-dot" cx="62" cy="14" r="1.5" fill="var(--c)"/>
      <circle class="bl-dot" cx="88" cy="36" r="1.3" fill="var(--c)" opacity="0.85"/>
      <circle class="bl-dot" cx="88" cy="64" r="1.5" fill="var(--c)" opacity="0.85"/>
      <circle class="bl-dot" cx="62" cy="86" r="1.5" fill="var(--c)" opacity="0.9"/>
      <circle class="bl-dot" cx="36" cy="86" r="1.5" fill="var(--c)" opacity="0.9"/>
      <circle class="bl-dot" cx="12" cy="64" r="1.5" fill="var(--c)" opacity="0.85"/>
      <circle class="bl-dot" cx="12" cy="36" r="1.3" fill="var(--c)" opacity="0.8"/>
    </svg>

  {:else if type === 'void'}
    <!-- Void — annihilating rift. Bloom backdrop, 4 concentric event-horizon
         rings collapsing inward, jagged tear-cracks fracturing space, twin
         shadow tentacles emerging from the void mouth, pure-black core
         devouring light, debris dissolving into nothing. -->
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <circle cx="50" cy="50" r="46" fill="var(--c)" opacity="0.28" class="vd-bloom" style="filter:blur(20px)"/>
      <!-- 4 collapsing event horizon rings -->
      <g class="vd-rings">
        <circle cx="50" cy="50" r="42" stroke="var(--c)" stroke-width="1.5" fill="none" opacity="0.35" class="vd-ring vr1"/>
        <circle cx="50" cy="50" r="32" stroke="var(--c)" stroke-width="2"   fill="none" opacity="0.55" class="vd-ring vr2"/>
        <circle cx="50" cy="50" r="22" stroke="var(--c)" stroke-width="2.5" fill="none" opacity="0.75" class="vd-ring vr3"/>
        <circle cx="50" cy="50" r="13" stroke="var(--c)" stroke-width="3"   fill="none" opacity="0.95" class="vd-ring vr4"/>
      </g>
      <!-- Jagged reality cracks emanating from rift -->
      <g class="vd-cracks">
        <polyline class="vd-cr" points="50,50 38,32 32,28 18,12"  stroke="var(--c)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <polyline class="vd-cr" points="50,50 62,32 68,28 82,12"  stroke="var(--c)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <polyline class="vd-cr" points="50,50 62,68 68,72 82,88"  stroke="var(--c)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <polyline class="vd-cr" points="50,50 38,68 32,72 18,88"  stroke="var(--c)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
      <!-- Twin tentacles slithering out of the rift -->
      <path class="vd-tnd vt1" d="M50 50 Q40 38 30 40 Q22 44 14 38"
            stroke="var(--c)" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.85"/>
      <path class="vd-tnd vt2" d="M50 50 Q60 38 70 40 Q78 44 86 38"
            stroke="var(--c)" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.85"/>
      <!-- Pure-black void mouth -->
      <g class="vd-core">
        <circle cx="50" cy="50" r="10" fill="#0a0210" opacity="0.95"/>
        <circle cx="50" cy="50" r="6"  fill="var(--c)" opacity="0.7"/>
        <circle cx="50" cy="50" r="3"  fill="white" opacity="0.85"/>
      </g>
      <!-- Dissolving debris being pulled toward the rift -->
      <circle class="vd-deb vd1" cx="18" cy="22" r="1.8" fill="var(--c)" opacity="0.7"/>
      <circle class="vd-deb vd2" cx="82" cy="22" r="1.5" fill="var(--c)" opacity="0.65"/>
      <circle class="vd-deb vd3" cx="82" cy="78" r="1.8" fill="var(--c)" opacity="0.7"/>
      <circle class="vd-deb vd4" cx="18" cy="78" r="1.5" fill="var(--c)" opacity="0.65"/>
    </svg>

  {:else if type === 'energy'}
    <!-- Energy — crackling plasma core with branching forks. Bloom backdrop,
         pulsing central orb, 6 jagged fork-lightning branches reaching out,
         double containment ring, plasma sparks at the fork tips. -->
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <circle cx="50" cy="50" r="46" fill="var(--c)" opacity="0.28" class="en-bloom" style="filter:blur(18px)"/>
      <!-- Containment rings — counter-rotating -->
      <circle cx="50" cy="50" r="38" stroke="var(--c)" stroke-width="1.8" fill="none" opacity="0.55"
              stroke-dasharray="6 4" class="en-ring en-rA"/>
      <circle cx="50" cy="50" r="30" stroke="var(--c)" stroke-width="1.3" fill="none" opacity="0.4"
              stroke-dasharray="4 2" class="en-ring en-rB"/>
      <!-- Six branching fork-lightning paths -->
      <g class="en-forks">
        <polyline class="en-fork ef1" points="50,50 42,32 48,28 38,10"  stroke="var(--c)" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <polyline class="en-fork ef2" points="50,50 60,34 54,30 66,12"  stroke="var(--c)" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <polyline class="en-fork ef3" points="50,50 68,42 72,48 90,40"  stroke="var(--c)" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <polyline class="en-fork ef4" points="50,50 62,62 58,68 70,86"  stroke="var(--c)" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <polyline class="en-fork ef5" points="50,50 38,62 42,68 30,86"  stroke="var(--c)" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <polyline class="en-fork ef6" points="50,50 32,42 28,48 10,40"  stroke="var(--c)" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
      <!-- Core orb (pulses) -->
      <g class="en-core">
        <circle cx="50" cy="50" r="14" fill="var(--c)"/>
        <circle cx="50" cy="50" r="9"  fill="white" opacity="0.65"/>
        <circle cx="50" cy="50" r="4"  fill="white"/>
      </g>
      <!-- Plasma sparks at fork tips -->
      <circle class="en-spark es1" cx="38" cy="10" r="2.2" fill="var(--c)"/>
      <circle class="en-spark es2" cx="66" cy="12" r="2.2" fill="var(--c)"/>
      <circle class="en-spark es3" cx="90" cy="40" r="2"   fill="var(--c)" opacity="0.9"/>
      <circle class="en-spark es4" cx="70" cy="86" r="2"   fill="var(--c)" opacity="0.9"/>
      <circle class="en-spark es5" cx="30" cy="86" r="2"   fill="var(--c)" opacity="0.85"/>
      <circle class="en-spark es6" cx="10" cy="40" r="2"   fill="var(--c)" opacity="0.85"/>
    </svg>

  {:else if type === 'cursed'}
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <circle cx="50" cy="50" r="40" fill="var(--c)" opacity="0.14" style="filter:blur(12px)"/>
      <g class="curs-g">
        <circle cx="50" cy="50" r="37" stroke="var(--c)" stroke-width="2" fill="none"/>
        <polygon points="50,18 59,44 87,44 64,60 72,86 50,70 28,86 36,60 13,44 41,44" stroke="var(--c)" stroke-width="2" fill="none" opacity="0.8"/>
        <circle cx="50" cy="50" r="7" fill="var(--c)" opacity="0.6"/>
        <circle cx="46" cy="48" r="2" fill="white" opacity="0.8"/>
        <circle cx="54" cy="48" r="2" fill="white" opacity="0.8"/>
        <path d="M44 54 Q50 57 56 54" stroke="white" stroke-width="1.5" fill="none" opacity="0.8"/>
        <circle class="wisp ws1" cx="50" cy="14" r="2"   fill="var(--c)" opacity="0.6"/>
        <circle class="wisp ws2" cx="86" cy="44" r="1.8" fill="var(--c)" opacity="0.55"/>
        <circle class="wisp ws3" cx="72" cy="84" r="1.8" fill="var(--c)" opacity="0.55"/>
        <circle class="wisp ws4" cx="28" cy="84" r="1.5" fill="var(--c)" opacity="0.5"/>
        <circle class="wisp ws5" cx="14" cy="44" r="2"   fill="var(--c)" opacity="0.6"/>
      </g>
    </svg>

    {:else if type === 'counter'}
    <!-- Counter — mirror flash + rebounding ray. Bloom backdrop, chevron
         "return to sender" V-shape facing the attacker, mirror reflection
         disc with sharp edge highlight, 8 rebounding ray-lines with
         arrowheads showing the redirect outward, bright center flash. -->
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <circle cx="50" cy="50" r="46" fill="var(--c)" opacity="0.32" class="ct-bloom" style="filter:blur(18px)"/>
      <!-- Reflective shield disc (mirror) -->
      <g class="ct-mirror">
        <circle cx="50" cy="50" r="30" stroke="var(--c)" stroke-width="3.5" fill="var(--c)" fill-opacity="0.18"/>
        <circle cx="50" cy="50" r="22" stroke="var(--c)" stroke-width="1.5" fill="none" opacity="0.7"/>
        <!-- Edge highlight crescent -->
        <path d="M50 24 A26 26 0 0 1 76 50" stroke="white" stroke-width="2" fill="none" opacity="0.7"/>
      </g>
      <!-- 8 rebound rays with outward chevrons (energy bouncing back) -->
      <g class="ct-rebound">
        <line class="ct-ray ct1" x1="50" y1="50" x2="14" y2="14" stroke="var(--c)" stroke-width="3" stroke-linecap="round"/>
        <path d="M14 14 L20 14 M14 14 L14 20" stroke="var(--c)" stroke-width="2" stroke-linecap="round"/>
        <line class="ct-ray ct2" x1="50" y1="50" x2="86" y2="14" stroke="var(--c)" stroke-width="3" stroke-linecap="round"/>
        <path d="M86 14 L80 14 M86 14 L86 20" stroke="var(--c)" stroke-width="2" stroke-linecap="round"/>
        <line class="ct-ray ct3" x1="50" y1="50" x2="14" y2="86" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M14 86 L20 86 M14 86 L14 80" stroke="var(--c)" stroke-width="1.8" stroke-linecap="round"/>
        <line class="ct-ray ct4" x1="50" y1="50" x2="86" y2="86" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M86 86 L80 86 M86 86 L86 80" stroke="var(--c)" stroke-width="1.8" stroke-linecap="round"/>
        <line class="ct-ray ct5" x1="50" y1="50" x2="50" y2="6"  stroke="var(--c)" stroke-width="3"   stroke-linecap="round"/>
        <path d="M50 6 L46 12 M50 6 L54 12" stroke="var(--c)" stroke-width="2" stroke-linecap="round"/>
        <line class="ct-ray ct6" x1="50" y1="50" x2="50" y2="94" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round"/>
        <line class="ct-ray ct7" x1="50" y1="50" x2="6"  y2="50" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round"/>
        <line class="ct-ray ct8" x1="50" y1="50" x2="94" y2="50" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round"/>
      </g>
      <!-- Bright center flash -->
      <g class="ct-flash">
        <circle cx="50" cy="50" r="11" fill="var(--c)"/>
        <circle cx="50" cy="50" r="6"  fill="white" opacity="0.95"/>
      </g>
    </svg>

  {:else if type === 'dodge'}
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <!-- Motion blur field -->
      <ellipse cx="50" cy="50" rx="48" ry="30" fill="var(--c)" opacity="0.07" style="filter:blur(16px)"/>
      <!-- Ghost afterimage LEFT — displaced character silhouette -->
      <g class="dodge-ghost dgh1">
        <ellipse cx="32" cy="50" rx="12" ry="20" fill="var(--c)"/>
        <ellipse cx="32" cy="43" rx="7"  ry="7"  fill="var(--c)"/>
      </g>
      <!-- Ghost afterimage RIGHT -->
      <g class="dodge-ghost dgh2">
        <ellipse cx="68" cy="50" rx="12" ry="20" fill="var(--c)"/>
        <ellipse cx="68" cy="43" rx="7"  ry="7"  fill="var(--c)"/>
      </g>
      <!-- Speed lines LEFT side -->
      <line class="spd-line sdl1" x1="4"  y1="35" x2="44" y2="35" stroke="var(--c)" stroke-width="2"   stroke-linecap="round"/>
      <line class="spd-line sdl2" x1="0"  y1="44" x2="40" y2="44" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round"/>
      <line class="spd-line sdl3" x1="2"  y1="53" x2="42" y2="53" stroke="var(--c)" stroke-width="2"   stroke-linecap="round"/>
      <line class="spd-line sdl4" x1="6"  y1="62" x2="44" y2="62" stroke="var(--c)" stroke-width="1.5" stroke-linecap="round"/>
      <!-- Speed lines RIGHT side -->
      <line class="spd-line sdl5" x1="56" y1="38" x2="96" y2="38" stroke="var(--c)" stroke-width="2"   stroke-linecap="round"/>
      <line class="spd-line sdl6" x1="58" y1="57" x2="98" y2="57" stroke="var(--c)" stroke-width="2"   stroke-linecap="round"/>
      <!-- Ripple rings expanding from dodge point -->
      <circle class="dod-ring dr1" cx="50" cy="50" r="22" stroke="var(--c)" stroke-width="2.5" fill="none"/>
      <circle class="dod-ring dr2" cx="50" cy="50" r="34" stroke="var(--c)" stroke-width="1.8" fill="none" opacity="0.7"/>
      <circle class="dod-ring dr3" cx="50" cy="50" r="44" stroke="var(--c)" stroke-width="1.2" fill="none" opacity="0.4"/>
    </svg>

  {:else if type === 'water'}
    <!-- Water — TIDAL WAVE crashing in. A wide curved wave swells from the
         attacker's side and breaks across the target's card with foam crest
         and splash. No more single droplet. Direction (isRtl) flips the
         wave so it always sweeps in from the attacker. -->
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <!-- Approach bloom — the rising water mass before it crashes -->
      <ellipse cx={isRtl ? 78 : 22} cy="60" rx="58" ry="32"
               fill="var(--c)" opacity="0.32" class="wt-bloom" style="filter:blur(16px)"/>
      <!-- Main wave body — a wide curved swell crashing across the target.
           Path drawn to face the attacker's side; isRtl mirrors it. -->
      <g class="wt-wave" style="transform-origin: {isRtl ? '100% 60%' : '0 60%'};">
        {#if isRtl}
          <path d="M120 96 L120 60 C110 40 95 28 80 30 C70 32 65 38 60 52 C55 64 48 70 40 70 C32 70 25 64 18 56 C12 50 6 50 -8 56 L-8 96 Z"
                fill="var(--c)"/>
          <!-- Foam crest along the top edge -->
          <path d="M-8 56 C6 48 14 52 22 58 C30 64 38 66 46 64 C56 60 62 54 70 38 C78 24 92 32 110 50"
                stroke="white" stroke-width="2.5" fill="none" opacity="0.85"/>
          <!-- Inner highlight -->
          <ellipse cx="40" cy="78" rx="46" ry="9" fill="white" opacity="0.22"/>
        {:else}
          <path d="M-20 96 L-20 60 C-10 40 5 28 20 30 C30 32 35 38 40 52 C45 64 52 70 60 70 C68 70 75 64 82 56 C88 50 94 50 108 56 L108 96 Z"
                fill="var(--c)"/>
          <path d="M108 56 C94 48 86 52 78 58 C70 64 62 66 54 64 C44 60 38 54 30 38 C22 24 8 32 -10 50"
                stroke="white" stroke-width="2.5" fill="none" opacity="0.85"/>
          <ellipse cx="60" cy="78" rx="46" ry="9" fill="white" opacity="0.22"/>
        {/if}
      </g>
      <!-- Splash droplets flying upward as the wave crashes -->
      <ellipse class="wt-drop wd1" cx="44" cy="44" rx="3.5" ry="6" fill="var(--c)" opacity="0.85"/>
      <ellipse class="wt-drop wd2" cx="56" cy="38" rx="3"   ry="5" fill="var(--c)" opacity="0.85"/>
      <ellipse class="wt-drop wd3" cx="62" cy="30" rx="2.5" ry="4" fill="var(--c)" opacity="0.8"/>
      <ellipse class="wt-drop wd4" cx="36" cy="34" rx="2.5" ry="4" fill="var(--c)" opacity="0.8"/>
      <ellipse class="wt-drop wd5" cx="50" cy="22" rx="3"   ry="5" fill="var(--c)" opacity="0.75"/>
      <!-- Foam spray dots -->
      <circle class="wt-foam" cx="40" cy="50" r="1.5" fill="white" opacity="0.85"/>
      <circle class="wt-foam" cx="62" cy="48" r="1.5" fill="white" opacity="0.85"/>
      <circle class="wt-foam" cx="50" cy="42" r="1.2" fill="white" opacity="0.85"/>
      <circle class="wt-foam" cx="32" cy="60" r="1.5" fill="white" opacity="0.8"/>
      <circle class="wt-foam" cx="68" cy="60" r="1.5" fill="white" opacity="0.8"/>
      <!-- Final crash ripples on the target's ground -->
      <ellipse class="wt-rip wr1" cx="50" cy="86" rx="20" ry="6"
               stroke="var(--c)" stroke-width="2.5" fill="none"/>
      <ellipse class="wt-rip wr2" cx="50" cy="86" rx="32" ry="9"
               stroke="var(--c)" stroke-width="1.8" fill="none" opacity="0.7"/>
    </svg>

  {:else if type === 'arcane'}
    <!-- Arcane — counter-rotating sigil rings, runic glyphs, mystic core.
         Massive mana bloom backdrop pulses behind the channel. -->
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <circle cx="50" cy="50" r="48" fill="var(--c)" opacity="0.30" class="arc-bloom" style="filter:blur(20px)"/>
      <circle cx="50" cy="50" r="42" fill="var(--c)" opacity="0.20" style="filter:blur(14px)"/>
      <!-- Outer rotating ring with runic marks -->
      <g class="arc-ring-out">
        <circle cx="50" cy="50" r="40" stroke="var(--c)" stroke-width="1.5" fill="none" opacity="0.55"
                stroke-dasharray="3 5"/>
        <circle cx="50" cy="50" r="36" stroke="var(--c)" stroke-width="1"   fill="none" opacity="0.35"
                stroke-dasharray="6 3"/>
      </g>
      <!-- Inner pentagram sigil — counter-rotating -->
      <g class="arc-pent">
        <polygon points="50,14 60,42 90,42 65,60 76,88 50,70 24,88 35,60 10,42 40,42"
                 stroke="var(--c)" stroke-width="1.8" fill="none" opacity="0.85"/>
        <polygon points="50,28 56,44 72,44 58,55 64,72 50,62 36,72 42,55 28,44 44,44"
                 stroke="var(--c)" stroke-width="1.2" fill="var(--c)" fill-opacity="0.08" opacity="0.7"/>
      </g>
      <!-- Hex glyphs around perimeter -->
      <g class="arc-glyph">
        <polygon points="50,4 53,10 50,14 47,10"   fill="var(--c)" opacity="0.85"/>
        <polygon points="96,50 90,53 86,50 90,47"  fill="var(--c)" opacity="0.85"/>
        <polygon points="50,96 47,90 50,86 53,90"  fill="var(--c)" opacity="0.85"/>
        <polygon points="4,50 10,47 14,50 10,53"   fill="var(--c)" opacity="0.85"/>
      </g>
      <!-- Crackling lines between glyphs -->
      <line class="arc-bolt arc-b1" x1="50" y1="10" x2="50" y2="38" stroke="var(--c)" stroke-width="1.5" opacity="0.7"/>
      <line class="arc-bolt arc-b2" x1="90" y1="50" x2="62" y2="50" stroke="var(--c)" stroke-width="1.5" opacity="0.7"/>
      <line class="arc-bolt arc-b3" x1="50" y1="90" x2="50" y2="62" stroke="var(--c)" stroke-width="1.5" opacity="0.7"/>
      <line class="arc-bolt arc-b4" x1="10" y1="50" x2="38" y2="50" stroke="var(--c)" stroke-width="1.5" opacity="0.7"/>
      <!-- Core orb -->
      <circle cx="50" cy="50" r="9" fill="var(--c)" class="arc-core"/>
      <circle cx="50" cy="50" r="4" fill="white" opacity="0.85"/>
    </svg>

  {:else if type === 'nature'}
    <!-- Nature — overgrowing wildgrowth burst. Bloom backdrop, 8 vine arms
         drawing outward from center, ferns at each vine tip, layered
         flower bloom in the middle with 6 petals + pollen-bearing
         stamens, dancing pollen motes, falling leaves drifting away. -->
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <circle cx="50" cy="50" r="46" fill="var(--c)" opacity="0.28" class="nt-bloom" style="filter:blur(16px)"/>
      <!-- 8 vine arms drawing outward (4 cardinal + 4 diagonal, two thicknesses) -->
      <g class="nt-vines">
        <path class="nt-vn nv1" d="M50 50 Q40 32 28 18"  stroke="var(--c)" stroke-width="2.8" fill="none" stroke-linecap="round"/>
        <path class="nt-vn nv2" d="M50 50 Q60 32 72 18"  stroke="var(--c)" stroke-width="2.8" fill="none" stroke-linecap="round"/>
        <path class="nt-vn nv3" d="M50 50 Q40 68 28 82"  stroke="var(--c)" stroke-width="2.6" fill="none" stroke-linecap="round"/>
        <path class="nt-vn nv4" d="M50 50 Q60 68 72 82"  stroke="var(--c)" stroke-width="2.6" fill="none" stroke-linecap="round"/>
        <path class="nt-vn nv5" d="M50 50 Q32 48 14 44"  stroke="var(--c)" stroke-width="2.3" fill="none" stroke-linecap="round"/>
        <path class="nt-vn nv6" d="M50 50 Q68 48 86 44"  stroke="var(--c)" stroke-width="2.3" fill="none" stroke-linecap="round"/>
        <path class="nt-vn nv7" d="M50 50 Q50 32 50 12"  stroke="var(--c)" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <path class="nt-vn nv8" d="M50 50 Q50 68 50 88"  stroke="var(--c)" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      </g>
      <!-- Fern fronds at vine tips -->
      <g class="nt-ferns">
        <ellipse class="leaf nt-l nl1" cx="28" cy="18" rx="5" ry="3" fill="var(--c)" transform="rotate(-40 28 18)"/>
        <ellipse class="leaf nt-l nl2" cx="72" cy="18" rx="5" ry="3" fill="var(--c)" transform="rotate(40 72 18)"/>
        <ellipse class="leaf nt-l nl3" cx="28" cy="82" rx="5" ry="3" fill="var(--c)" opacity="0.92" transform="rotate(40 28 82)"/>
        <ellipse class="leaf nt-l nl4" cx="72" cy="82" rx="5" ry="3" fill="var(--c)" opacity="0.92" transform="rotate(-40 72 82)"/>
        <ellipse class="leaf nt-l nl5" cx="14" cy="44" rx="5" ry="2.5" fill="var(--c)" opacity="0.85"/>
        <ellipse class="leaf nt-l nl6" cx="86" cy="44" rx="5" ry="2.5" fill="var(--c)" opacity="0.85"/>
        <ellipse class="leaf nt-l nl7" cx="50" cy="12" rx="3" ry="5" fill="var(--c)" opacity="0.9"/>
        <ellipse class="leaf nt-l nl8" cx="50" cy="88" rx="3" ry="5" fill="var(--c)" opacity="0.9"/>
      </g>
      <!-- 6-petal flower bloom in the center -->
      <g class="nt-bloom-flower">
        <ellipse cx="50" cy="36" rx="6" ry="11" fill="var(--c)" opacity="0.92"/>
        <ellipse cx="62" cy="43" rx="6" ry="11" fill="var(--c)" opacity="0.92" transform="rotate(60 62 43)"/>
        <ellipse cx="62" cy="57" rx="6" ry="11" fill="var(--c)" opacity="0.92" transform="rotate(120 62 57)"/>
        <ellipse cx="50" cy="64" rx="6" ry="11" fill="var(--c)" opacity="0.92" transform="rotate(180 50 64)"/>
        <ellipse cx="38" cy="57" rx="6" ry="11" fill="var(--c)" opacity="0.92" transform="rotate(-120 38 57)"/>
        <ellipse cx="38" cy="43" rx="6" ry="11" fill="var(--c)" opacity="0.92" transform="rotate(-60 38 43)"/>
        <!-- Stamens (yellow center dots) -->
        <circle cx="50" cy="50" r="7" fill="var(--c)"/>
        <circle cx="50" cy="50" r="3.5" fill="white" opacity="0.95"/>
      </g>
      <!-- Pollen motes -->
      <circle class="nt-pol p1" cx="32" cy="38" r="1.6" fill="var(--c)"/>
      <circle class="nt-pol p2" cx="68" cy="38" r="1.6" fill="var(--c)"/>
      <circle class="nt-pol p3" cx="32" cy="62" r="1.4" fill="var(--c)" opacity="0.85"/>
      <circle class="nt-pol p4" cx="68" cy="62" r="1.4" fill="var(--c)" opacity="0.85"/>
      <circle class="nt-pol p5" cx="50" cy="28" r="1.3" fill="var(--c)" opacity="0.8"/>
      <circle class="nt-pol p6" cx="50" cy="72" r="1.3" fill="var(--c)" opacity="0.8"/>
    </svg>

  {:else if type === 'cosmic'}
    <!-- Cosmic — galactic supernova. Massive bloom, four spiral arms
         sweeping around the core, supernova flash at center, exploding
         star points at the corners, scattered stardust + comet streak
         tails radiating outward from the explosion. -->
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <circle cx="50" cy="50" r="50" fill="var(--c)" opacity="0.34" class="cs-bloom" style="filter:blur(22px)"/>
      <!-- Four spiral arms sweeping around the core -->
      <g class="cs-spiral">
        <path d="M50 50 Q40 30 20 28 Q8 38 12 56 Q24 70 50 50" stroke="var(--c)" stroke-width="2.5" fill="none" opacity="0.8"/>
        <path d="M50 50 Q60 70 80 72 Q92 62 88 44 Q76 30 50 50" stroke="var(--c)" stroke-width="2.5" fill="none" opacity="0.8"/>
        <path d="M50 50 Q70 40 72 20 Q60 8 42 12 Q28 24 50 50" stroke="var(--c)" stroke-width="2" fill="none" opacity="0.7"/>
        <path d="M50 50 Q30 60 28 80 Q40 92 58 88 Q72 76 50 50" stroke="var(--c)" stroke-width="2" fill="none" opacity="0.7"/>
        <!-- Thin secondary arms -->
        <path d="M50 50 Q34 44 28 18" stroke="var(--c)" stroke-width="1.4" fill="none" opacity="0.5"/>
        <path d="M50 50 Q66 56 72 82" stroke="var(--c)" stroke-width="1.4" fill="none" opacity="0.5"/>
        <path d="M50 50 Q66 44 88 36" stroke="var(--c)" stroke-width="1.4" fill="none" opacity="0.5"/>
        <path d="M50 50 Q34 56 12 64" stroke="var(--c)" stroke-width="1.4" fill="none" opacity="0.5"/>
      </g>
      <!-- Comet streak tails radiating outward -->
      <g class="cs-comets">
        <line class="cs-ct" x1="50" y1="50" x2="14" y2="14" stroke="var(--c)" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
        <line class="cs-ct" x1="50" y1="50" x2="86" y2="14" stroke="var(--c)" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
        <line class="cs-ct" x1="50" y1="50" x2="86" y2="86" stroke="var(--c)" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
        <line class="cs-ct" x1="50" y1="50" x2="14" y2="86" stroke="var(--c)" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
      </g>
      <!-- Supernova core flash -->
      <g class="cs-core">
        <circle cx="50" cy="50" r="18" fill="var(--c)" opacity="0.6" style="filter:blur(4px)"/>
        <circle cx="50" cy="50" r="11" fill="var(--c)"/>
        <circle cx="50" cy="50" r="6"  fill="white" opacity="0.95"/>
      </g>
      <!-- Exploding star points at the corners -->
      <g class="cs-stars">
        <polygon class="cs-star csA" points="22,14 24,20 30,20 25,24 27,30 22,26 17,30 19,24 14,20 20,20" fill="var(--c)"/>
        <polygon class="cs-star csB" points="78,12 80,18 86,18 81,22 83,28 78,24 73,28 75,22 70,18 76,18" fill="var(--c)" opacity="0.95"/>
        <polygon class="cs-star csC" points="80,82 82,88 88,88 83,92 85,98 80,94 75,98 77,92 72,88 78,88" fill="var(--c)" opacity="0.9"/>
        <polygon class="cs-star csD" points="20,84 22,90 28,90 23,94 25,100 20,96 15,100 17,94 12,90 18,90" fill="var(--c)" opacity="0.9"/>
        <circle class="cs-dot" cx="90" cy="50" r="2" fill="var(--c)"/>
        <circle class="cs-dot" cx="10" cy="50" r="2" fill="var(--c)"/>
        <circle class="cs-dot" cx="50" cy="6"  r="1.8" fill="var(--c)" opacity="0.85"/>
        <circle class="cs-dot" cx="50" cy="94" r="1.8" fill="var(--c)" opacity="0.85"/>
        <!-- Stardust scatter -->
        <circle class="cs-dust" cx="34" cy="34" r="1.2" fill="var(--c)" opacity="0.7"/>
        <circle class="cs-dust" cx="66" cy="34" r="1.2" fill="var(--c)" opacity="0.7"/>
        <circle class="cs-dust" cx="34" cy="66" r="1.2" fill="var(--c)" opacity="0.7"/>
        <circle class="cs-dust" cx="66" cy="66" r="1.2" fill="var(--c)" opacity="0.7"/>
      </g>
    </svg>

  {:else if type === 'metal'}
    <!-- Metal — razor-shard storm with hard impact crack. Bloom backdrop
         pulses, 8 starburst crack lines fracture outward, 8 razor blades
         fan in all directions, diamond core glints white-hot. -->
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <circle cx="50" cy="50" r="46" fill="var(--c)" opacity="0.32" class="met-bloom" style="filter:blur(18px)"/>
      <ellipse cx="50" cy="50" rx="38" ry="30" fill="var(--c)" opacity="0.18" style="filter:blur(10px)"/>
      <!-- Impact starburst crack lines (geometric, sharp) -->
      <g class="met-crack">
        <line x1="50" y1="50" x2="12" y2="20" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="50" y1="50" x2="88" y2="20" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="50" y1="50" x2="10" y2="80" stroke="var(--c)" stroke-width="2"   stroke-linecap="round"/>
        <line x1="50" y1="50" x2="90" y2="80" stroke="var(--c)" stroke-width="2"   stroke-linecap="round"/>
        <line x1="50" y1="50" x2="50" y2="6"  stroke="var(--c)" stroke-width="2.2" stroke-linecap="round"/>
        <line x1="50" y1="50" x2="50" y2="94" stroke="var(--c)" stroke-width="2"   stroke-linecap="round"/>
        <line x1="50" y1="50" x2="6"  y2="50" stroke="var(--c)" stroke-width="2.2" stroke-linecap="round"/>
        <line x1="50" y1="50" x2="94" y2="50" stroke="var(--c)" stroke-width="2"   stroke-linecap="round"/>
      </g>
      <!-- Razor shards fanning outward — sharp triangular blades -->
      <g class="met-shards">
        <polygon class="shard mshd1" points="50,50 32,12 38,16" fill="var(--c)"/>
        <polygon class="shard mshd2" points="50,50 70,14 64,18" fill="var(--c)"/>
        <polygon class="shard mshd3" points="50,50 88,38 84,44" fill="var(--c)" opacity="0.9"/>
        <polygon class="shard mshd4" points="50,50 88,62 84,56" fill="var(--c)" opacity="0.9"/>
        <polygon class="shard mshd5" points="50,50 70,86 64,82" fill="var(--c)" opacity="0.85"/>
        <polygon class="shard mshd6" points="50,50 32,88 36,84" fill="var(--c)" opacity="0.85"/>
        <polygon class="shard mshd7" points="50,50 12,60 18,54" fill="var(--c)" opacity="0.8"/>
        <polygon class="shard mshd8" points="50,50 12,38 18,44" fill="var(--c)" opacity="0.8"/>
      </g>
      <!-- Metallic core glint -->
      <g class="met-core">
        <polygon points="50,38 58,50 50,62 42,50" fill="var(--c)"/>
        <polygon points="50,42 54,50 50,58 46,50" fill="white" opacity="0.85"/>
      </g>
    </svg>

  {:else if type === 'soul'}
    <!-- Soul — wispy ghost form, skull silhouette, ethereal threads.
         Big ethereal bloom backdrop, ghost emerges + skull face peers
         through, three wisp threads trail upward with glowing motes. -->
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <circle cx="50" cy="50" r="46" fill="var(--c)" opacity="0.30" class="soul-bloom" style="filter:blur(20px)"/>
      <ellipse cx="50" cy="48" rx="34" ry="40" fill="var(--c)" opacity="0.22" style="filter:blur(12px)"/>
      <!-- Ghost form -->
      <g class="soul-ghost">
        <path d="M50 14 C32 14 22 28 22 46 C22 58 24 68 22 82 L30 76 L36 84 L42 76 L50 84 L58 76 L64 84 L70 76 L78 82 C76 68 78 58 78 46 C78 28 68 14 50 14 Z"
              fill="var(--c)" opacity="0.9"/>
      </g>
      <!-- Empty eye sockets -->
      <g class="soul-eyes">
        <ellipse cx="40" cy="42" rx="5" ry="7" fill="#0d0d16"/>
        <ellipse cx="60" cy="42" rx="5" ry="7" fill="#0d0d16"/>
        <circle  cx="40" cy="44" r="2" fill="var(--c)" opacity="0.9"/>
        <circle  cx="60" cy="44" r="2" fill="var(--c)" opacity="0.9"/>
      </g>
      <!-- Skull mouth grid -->
      <g class="soul-mouth">
        <rect x="36" y="58" width="28" height="6" fill="#0d0d16" rx="1"/>
        <line x1="42" y1="58" x2="42" y2="64" stroke="var(--c)" stroke-width="0.8" opacity="0.5"/>
        <line x1="50" y1="58" x2="50" y2="64" stroke="var(--c)" stroke-width="0.8" opacity="0.5"/>
        <line x1="58" y1="58" x2="58" y2="64" stroke="var(--c)" stroke-width="0.8" opacity="0.5"/>
      </g>
      <!-- Wisp threads trailing upward -->
      <g class="soul-wisps">
        <path class="wisp-thread sw1" d="M30 20 Q26 8 18 4"  stroke="var(--c)" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.7"/>
        <path class="wisp-thread sw2" d="M50 12 Q50 4 52 0"  stroke="var(--c)" stroke-width="1.8" fill="none" stroke-linecap="round" opacity="0.8"/>
        <path class="wisp-thread sw3" d="M70 20 Q74 8 82 4"  stroke="var(--c)" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.7"/>
        <circle class="wisp-mote wm1" cx="18" cy="4"  r="1.5" fill="var(--c)" opacity="0.7"/>
        <circle class="wisp-mote wm2" cx="52" cy="0"  r="1.8" fill="var(--c)" opacity="0.8"/>
        <circle class="wisp-mote wm3" cx="82" cy="4"  r="1.5" fill="var(--c)" opacity="0.7"/>
      </g>
    </svg>

  {:else if type === 'sound'}
    <!-- Sound — concentric sonic ripples expanding outward + speaker
         cones on both sides + pulsing core. Big audio-bloom backdrop. -->
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <circle cx="50" cy="50" r="48" fill="var(--c)" opacity="0.28" class="snd-bloom" style="filter:blur(18px)"/>
      <circle cx="50" cy="50" r="44" fill="var(--c)" opacity="0.14" style="filter:blur(10px)"/>
      <!-- Three expanding rings — staggered to create a pulsing sonic feel -->
      <circle class="sonic-ring snr1" cx="50" cy="50" r="14" stroke="var(--c)" stroke-width="3"   fill="none"/>
      <circle class="sonic-ring snr2" cx="50" cy="50" r="14" stroke="var(--c)" stroke-width="2.5" fill="none"/>
      <circle class="sonic-ring snr3" cx="50" cy="50" r="14" stroke="var(--c)" stroke-width="2"   fill="none"/>
      <circle class="sonic-ring snr4" cx="50" cy="50" r="14" stroke="var(--c)" stroke-width="1.5" fill="none"/>
      <!-- Speaker-cone arcs to one side (direction-agnostic) -->
      <g class="sonic-cone">
        <path d="M62 30 Q78 50 62 70"   stroke="var(--c)" stroke-width="3"   fill="none" opacity="0.85" stroke-linecap="round"/>
        <path d="M68 22 Q88 50 68 78"   stroke="var(--c)" stroke-width="2.5" fill="none" opacity="0.7" stroke-linecap="round"/>
        <path d="M38 30 Q22 50 38 70"   stroke="var(--c)" stroke-width="3"   fill="none" opacity="0.85" stroke-linecap="round"/>
        <path d="M32 22 Q12 50 32 78"   stroke="var(--c)" stroke-width="2.5" fill="none" opacity="0.7" stroke-linecap="round"/>
      </g>
      <!-- Center pulse -->
      <circle cx="50" cy="50" r="6" fill="var(--c)" class="sonic-core"/>
      <circle cx="50" cy="50" r="3" fill="white" opacity="0.85"/>
    </svg>

  {:else if type === 'chaos'}
    <!-- Chaos — fractured reality glitch, jagged shards, color-shift +
         permanent jitter wobble. Big reality-warp bloom backdrop. -->
    <svg viewBox="0 0 100 100" class="fx-svg chaos-glitch" overflow="visible">
      <circle cx="50" cy="50" r="48" fill="var(--c)" opacity="0.32" class="chaos-bloom" style="filter:blur(20px)"/>
      <circle cx="50" cy="50" r="42" fill="var(--c)" opacity="0.20" style="filter:blur(12px)"/>
      <!-- Reality fracture lines — irregular, branching -->
      <g class="chaos-frac">
        <polyline points="20,18 32,30 28,42 42,46 38,60 54,58" stroke="var(--c)" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.85"/>
        <polyline points="82,18 70,28 76,40 62,46 68,58 54,58" stroke="var(--c)" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.85"/>
        <polyline points="82,82 70,72 76,60 62,54" stroke="var(--c)" stroke-width="1.8" fill="none" stroke-linecap="round" opacity="0.75"/>
        <polyline points="20,82 32,72 28,60 42,54" stroke="var(--c)" stroke-width="1.8" fill="none" stroke-linecap="round" opacity="0.75"/>
      </g>
      <!-- Reality fragments — irregular geometric shapes -->
      <g class="chaos-frags">
        <polygon class="cfrag cf1" points="30,32 38,28 42,38 34,42" fill="var(--c)" opacity="0.7"/>
        <polygon class="cfrag cf2" points="70,28 78,34 72,42 64,38" fill="var(--c)" opacity="0.7"/>
        <polygon class="cfrag cf3" points="28,68 38,66 34,76 26,74" fill="var(--c)" opacity="0.65"/>
        <polygon class="cfrag cf4" points="68,72 76,68 74,78 64,76" fill="var(--c)" opacity="0.65"/>
      </g>
      <!-- Glitched core: stacked offset rings to suggest dimensional misalignment -->
      <g class="chaos-core">
        <rect class="chaos-glitch-a" x="40" y="40" width="20" height="20" fill="var(--c)" opacity="0.9"/>
        <rect class="chaos-glitch-b" x="38" y="42" width="20" height="20" fill="var(--c)" opacity="0.6"/>
        <rect class="chaos-glitch-c" x="42" y="38" width="20" height="20" fill="var(--c)" opacity="0.4"/>
        <circle cx="50" cy="50" r="5" fill="white" opacity="0.9"/>
      </g>
    </svg>

  {:else}
    <!-- generic impact -->
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <circle cx="50" cy="50" r="34" fill="var(--c)" opacity="0.14" style="filter:blur(10px)"/>
      <g class="gen-g">
        <circle cx="50" cy="50" r="28" stroke="var(--c)" stroke-width="3" fill="none" class="gen-ring"/>
        <line x1="32" y1="32" x2="68" y2="68" stroke="var(--c)" stroke-width="3" stroke-linecap="round"/>
        <line x1="68" y1="32" x2="32" y2="68" stroke="var(--c)" stroke-width="3" stroke-linecap="round"/>
        <circle class="gen-spark gs1" cx="32" cy="32" r="2.5" fill="var(--c)"/>
        <circle class="gen-spark gs2" cx="68" cy="32" r="2.5" fill="var(--c)"/>
        <circle class="gen-spark gs3" cx="32" cy="68" r="2"   fill="var(--c)"/>
        <circle class="gen-spark gs4" cx="68" cy="68" r="2"   fill="var(--c)"/>
      </g>
    </svg>
  {/if}

  <!-- ── Particle sprite overlay ──────────────────────────────────────── -->
  <div class="particles">
    {#each particleSprites as sp, i}
      <img
        src={sp.src}
        class="ps"
        alt=""
        style="
          left: {sp.x}%; top: {sp.y}%;
          width: {sp.size}px; height: {sp.size}px;
          --tx: {sp.tx}px; --ty: {sp.ty}px;
          --pr: {sp.rot}deg; --ps: {sp.scale};
          --pd: {sp.delay}s;
          filter: drop-shadow(0 0 4px var(--c));
        "
      />
    {/each}
  </div>

</div>

<style>
.fx-root {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  filter: drop-shadow(0 0 8px var(--c));
  /* contain layout+style so child animations don't trigger reflows in sibling
     battle UI. NOTE: 'paint' is intentionally omitted — it would clip flying
     particles to the .fx-root box, which is exactly the cutoff bug we want
     to avoid. The trade is a little extra paint area; particles already self-
     contain because they animate within the SVG viewport. */
  contain: layout style;
  will-change: transform, opacity;
  /* Belt-and-suspenders: explicitly let children render outside our box.
     Some parent panels use overflow:hidden for rounded corners and that
     clipping is the actual visual culprit for the "cutoff VFX" complaint. */
  overflow: visible;
}
.fx-svg {
  width: 100%; height: 100%;
  /* SVG defaults to overflow:hidden on its inner box; setting visible lets
     elements drawn beyond viewBox (slashes, shockwaves, sparks) actually paint. */
  overflow: visible;
}

/* ── Particle sprite layer ─────────────────────────────────────────── */
.particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: visible;
}
.ps {
  position: absolute;
  transform: translate(-50%, -50%);
  object-fit: contain;
  opacity: 0;
  animation: ps-burst 0.65s var(--pd, 0s) cubic-bezier(0.22, 0.8, 0.3, 1) forwards;
}
@keyframes ps-burst {
  0%   { transform: translate(-50%, -50%) scale(0) rotate(0deg);                          opacity: 0; }
  18%  { opacity: 1; }
  55%  { transform: translate(calc(-50% + var(--tx,0px)), calc(-50% + var(--ty,0px))) scale(var(--ps,1)) rotate(var(--pr,0deg)); opacity: 0.85; }
  100% { transform: translate(calc(-50% + var(--tx,0px)*1.6), calc(-50% + var(--ty,0px)*1.6)) scale(calc(var(--ps,1) * 0.3)) rotate(calc(var(--pr,0deg) * 1.5)); opacity: 0; }
}

/* ─── ARC: curves upward at midpoint, crashes into target ─────────── */
.fx-ltr-arc { animation: fly-ltr-arc 0.75s cubic-bezier(0.22, 0.8, 0.3, 1) forwards; }
.fx-rtl-arc { animation: fly-rtl-arc 0.75s cubic-bezier(0.22, 0.8, 0.3, 1) forwards; }

@keyframes fly-ltr-arc {
  0%   { transform: translate(0,0)                                   scale(0.5);  opacity: 0;   filter: drop-shadow(0 0 6px var(--c)); }
  8%   { transform: translate(min(2vw,16px),-6px)                    scale(1.1);  opacity: 1;   filter: drop-shadow(0 0 14px var(--c)); }
  45%  { transform: translate(min(28vw,224px),-32px)                 scale(1.05); opacity: 1;   filter: drop-shadow(0 0 18px var(--c)); }
  70%  { transform: translate(min(55vw,440px),-6px)                  scale(1.05); opacity: 1;   filter: drop-shadow(0 0 14px var(--c)); }
  82%  { transform: translate(min(60vw,480px),0px)                   scale(1.55); opacity: 1;   filter: brightness(3.2) drop-shadow(0 0 32px var(--c)); }
  100% { transform: translate(min(60vw,480px),0px)                   scale(0.3);  opacity: 0;   filter: brightness(1); }
}
@keyframes fly-rtl-arc {
  0%   { transform: translate(0,0)                                    scale(0.5);  opacity: 0;   filter: drop-shadow(0 0 6px var(--c)); }
  8%   { transform: translate(max(-2vw,-16px),-6px)                   scale(1.1);  opacity: 1;   filter: drop-shadow(0 0 14px var(--c)); }
  45%  { transform: translate(max(-28vw,-224px),-32px)                scale(1.05); opacity: 1;   filter: drop-shadow(0 0 18px var(--c)); }
  70%  { transform: translate(max(-55vw,-440px),-6px)                 scale(1.05); opacity: 1;   filter: drop-shadow(0 0 14px var(--c)); }
  82%  { transform: translate(max(-60vw,-480px),0px)                  scale(1.55); opacity: 1;   filter: brightness(3.2) drop-shadow(0 0 32px var(--c)); }
  100% { transform: translate(max(-60vw,-480px),0px)                  scale(0.3);  opacity: 0;   filter: brightness(1); }
}

/* ─── SWIRL: spiral corkscrew path ───────────────────────────────── */
.fx-ltr-swirl { animation: fly-ltr-swirl 0.75s ease-in-out forwards; }
.fx-rtl-swirl { animation: fly-rtl-swirl 0.75s ease-in-out forwards; }

@keyframes fly-ltr-swirl {
  0%   { transform: translate(0,0)                        rotate(0deg)    scale(0.5); opacity: 0; filter: drop-shadow(0 0 6px var(--c)); }
  12%  { transform: translate(min(7vw,56px),-18px)        rotate(60deg)   scale(1.1); opacity: 1; filter: drop-shadow(0 0 14px var(--c)); }
  30%  { transform: translate(min(18vw,144px),16px)       rotate(140deg)  scale(1.0); opacity: 1; filter: drop-shadow(0 0 16px var(--c)); }
  50%  { transform: translate(min(32vw,256px),-20px)      rotate(230deg)  scale(1.05); opacity: 1; }
  68%  { transform: translate(min(47vw,376px),12px)       rotate(310deg)  scale(1.0); opacity: 1; }
  80%  { transform: translate(min(60vw,480px),0px)        rotate(360deg)  scale(1.6); opacity: 1; filter: brightness(3.2) drop-shadow(0 0 32px var(--c)); }
  100% { transform: translate(min(60vw,480px),0px)        rotate(380deg)  scale(0.3); opacity: 0; }
}
@keyframes fly-rtl-swirl {
  0%   { transform: translate(0,0)                         rotate(0deg)    scale(0.5); opacity: 0; filter: drop-shadow(0 0 6px var(--c)); }
  12%  { transform: translate(max(-7vw,-56px),-18px)       rotate(-60deg)  scale(1.1); opacity: 1; filter: drop-shadow(0 0 14px var(--c)); }
  30%  { transform: translate(max(-18vw,-144px),16px)      rotate(-140deg) scale(1.0); opacity: 1; filter: drop-shadow(0 0 16px var(--c)); }
  50%  { transform: translate(max(-32vw,-256px),-20px)     rotate(-230deg) scale(1.05); opacity: 1; }
  68%  { transform: translate(max(-47vw,-376px),12px)      rotate(-310deg) scale(1.0); opacity: 1; }
  80%  { transform: translate(max(-60vw,-480px),0px)       rotate(-360deg) scale(1.6); opacity: 1; filter: brightness(3.2) drop-shadow(0 0 32px var(--c)); }
  100% { transform: translate(max(-60vw,-480px),0px)       rotate(-380deg) scale(0.3); opacity: 0; }
}

/* ─── CRASH: fast, straight, slams into target ────────────────────── */
.fx-ltr-crash { animation: fly-ltr-crash 0.75s cubic-bezier(0.1, 0.7, 0.25, 1) forwards; }
.fx-rtl-crash { animation: fly-rtl-crash 0.75s cubic-bezier(0.1, 0.7, 0.25, 1) forwards; }

@keyframes fly-ltr-crash {
  0%   { transform: translate(0,0)                  scale(0.4); opacity: 0; filter: drop-shadow(0 0 4px var(--c)); }
  5%   { transform: translate(min(1vw,8px),0)        scale(1.5); opacity: 1; filter: brightness(4) drop-shadow(0 0 24px var(--c)); }
  68%  { transform: translate(min(57vw,456px),0)     scale(1.3); opacity: 1; filter: brightness(2.5) drop-shadow(0 0 20px var(--c)); }
  82%  { transform: translate(min(60vw,480px),0)     scale(2.2); opacity: 1; filter: brightness(5.5) drop-shadow(0 0 50px var(--c)); }
  100% { transform: translate(min(60vw,480px),0)     scale(0.2); opacity: 0; filter: brightness(1); }
}
@keyframes fly-rtl-crash {
  0%   { transform: translate(0,0)                   scale(0.4); opacity: 0; filter: drop-shadow(0 0 4px var(--c)); }
  5%   { transform: translate(max(-1vw,-8px),0)       scale(1.5); opacity: 1; filter: brightness(4) drop-shadow(0 0 24px var(--c)); }
  68%  { transform: translate(max(-57vw,-456px),0)    scale(1.3); opacity: 1; filter: brightness(2.5) drop-shadow(0 0 20px var(--c)); }
  82%  { transform: translate(max(-60vw,-480px),0)    scale(2.2); opacity: 1; filter: brightness(5.5) drop-shadow(0 0 50px var(--c)); }
  100% { transform: translate(max(-60vw,-480px),0)    scale(0.2); opacity: 0; filter: brightness(1); }
}

/* ─── AOE BURST: expands outward from attacker position ──────────── */
.fx-aoe-burst { animation: fx-aoe-burst 0.80s cubic-bezier(0.22, 0.8, 0.3, 1) forwards; }
@keyframes fx-aoe-burst {
  0%   { transform: scale(0.2) rotate(0deg);   opacity: 0;    filter: drop-shadow(0 0 6px var(--c)); }
  15%  { transform: scale(1.2) rotate(10deg);  opacity: 1;    filter: brightness(3) drop-shadow(0 0 28px var(--c)); }
  45%  { transform: scale(1.8) rotate(20deg);  opacity: 0.85; }
  70%  { transform: scale(2.8) rotate(25deg);  opacity: 0.5;  }
  100% { transform: scale(4.0) rotate(30deg);  opacity: 0;    filter: brightness(1); }
}

/* ─── HEAL RISE: floats upward at target location ────────────────── */
.fx-heal-rise { animation: fx-heal-rise 0.90s ease-out forwards; }
@keyframes fx-heal-rise {
  0%   { transform: translate(0,  20px) scale(0.4); opacity: 0;   filter: brightness(2) drop-shadow(0 0 12px var(--c)); }
  20%  { transform: translate(0,   0px) scale(1.2); opacity: 1;   filter: brightness(3) drop-shadow(0 0 22px var(--c)); }
  60%  { transform: translate(0, -30px) scale(1.0); opacity: 0.8; }
  100% { transform: translate(0, -60px) scale(0.6); opacity: 0;   filter: brightness(1); }
}

/* ─── BUFF PULSE: scale pulse in place ───────────────────────────── */
.fx-buff-pulse { animation: fx-buff-pulse 0.80s ease-out forwards; }
@keyframes fx-buff-pulse {
  0%   { transform: scale(0.3) rotate(-10deg); opacity: 0;   filter: drop-shadow(0 0 6px var(--c)); }
  25%  { transform: scale(1.4) rotate(  5deg); opacity: 1;   filter: brightness(3) drop-shadow(0 0 24px var(--c)); }
  55%  { transform: scale(0.9) rotate( -3deg); opacity: 0.9; }
  75%  { transform: scale(1.1) rotate(  2deg); opacity: 0.7; }
  100% { transform: scale(1.5) rotate(  0deg); opacity: 0;   filter: brightness(1); }
}

/* ─── DEBUFF SPREAD: corrupt drip/spread ─────────────────────────── */
.fx-debuff-spread { animation: fx-debuff-spread 0.85s ease-out forwards; }
@keyframes fx-debuff-spread {
  0%   { transform: scale(0.4) rotate(  0deg); opacity: 0;   filter: drop-shadow(0 0 8px var(--c)); }
  20%  { transform: scale(1.1) rotate( -5deg); opacity: 1;   filter: brightness(2.5) drop-shadow(0 0 20px var(--c)); }
  50%  { transform: scale(1.3) rotate(  5deg); opacity: 0.8; }
  80%  { transform: scale(1.6) rotate( -3deg); opacity: 0.4; }
  100% { transform: scale(1.8) rotate(  0deg); opacity: 0;   filter: brightness(1); }
}

/* ─── SUMMON PORTAL: spinning vortex materializing ───────────────── */
.fx-summon-portal { animation: fx-summon-portal 1.0s ease-out forwards; }
@keyframes fx-summon-portal {
  0%   { transform: scale(0.0) rotate(   0deg); opacity: 0;   filter: brightness(1) drop-shadow(0 0 4px var(--c)); }
  10%  { transform: scale(0.6) rotate( -90deg); opacity: 0.7; filter: brightness(2) drop-shadow(0 0 16px var(--c)); }
  35%  { transform: scale(1.6) rotate(-200deg); opacity: 1;   filter: brightness(4) drop-shadow(0 0 36px var(--c)); }
  65%  { transform: scale(1.3) rotate(-300deg); opacity: 0.9; }
  100% { transform: scale(0.5) rotate(-420deg); opacity: 0;   filter: brightness(1); }
}

/* ─── SLASH (grade-scaled weapon strike) ─────────────────────────── */
.sl,
.sl-echo {
  stroke-dasharray: 80;
  stroke-dashoffset: 80;
  animation: slash-draw 0.65s ease-out forwards;
  animation-delay: var(--d, 0s);
}
@keyframes slash-draw {
  0%   { stroke-dashoffset: 80; opacity: 0; }
  28%  { stroke-dashoffset: 0;  opacity: 0.95; }
  72%  { stroke-dashoffset: 0;  opacity: 0.85; }
  100% { stroke-dashoffset: 0;  opacity: 0; }
}
.sl-echo { opacity: 0.2; }
/* High-grade-only cross-cut: two long diagonals scissor across the target.
   Drawn at 100% opacity for visual weight, fading at the end. */
.sl-cross {
  stroke-dasharray: 110;
  stroke-dashoffset: 110;
  animation: slash-cross 0.55s 0.22s ease-out forwards;
}
.sl-cross-b { animation-delay: 0.28s; }
@keyframes slash-cross {
  0%   { stroke-dashoffset: 110; opacity: 0; }
  30%  { stroke-dashoffset: 0;   opacity: 1; filter: brightness(2); }
  100% { stroke-dashoffset: 0;   opacity: 0; }
}
/* God-tier exclusive: shockwave ring expanding from the impact center. */
.sl-ring {
  transform-origin: 50% 50%;
  animation: slash-ring 0.6s 0.32s ease-out forwards;
}
@keyframes slash-ring {
  0%   { transform: scale(0.2); opacity: 1; }
  60%  { transform: scale(1.1); opacity: 0.6; }
  100% { transform: scale(1.6); opacity: 0; }
}
.sp { transform-origin: center center; transform-box: fill-box; animation: spark-pop 0.5s ease-out forwards; opacity: 0; }
.sp1 { animation-delay: 0.18s; }
.sp2 { animation-delay: 0.22s; }
.sp3 { animation-delay: 0.20s; }
.sp4 { animation-delay: 0.24s; }
.sp5 { animation-delay: 0.26s; }
@keyframes spark-pop {
  0%   { transform: scale(0); opacity: 0; }
  40%  { transform: scale(2.2); opacity: 1; }
  100% { transform: scale(0.5); opacity: 0; }
}

/* ─── FIRE ───────────────────────────────────────────────────────── */
.fire-g { transform-origin: 50% 88%; animation: fire-rise 0.85s ease-out forwards; }
@keyframes fire-rise {
  0%   { transform: scaleY(0.1) scaleX(0.4); opacity: 0; }
  25%  { transform: scaleY(1.1) scaleX(1.05); opacity: 1; }
  60%  { transform: scaleY(1.0) scaleX(1.0);  opacity: 0.95; }
  85%  { transform: scaleY(1.05) scaleX(0.95); opacity: 0.6; }
  100% { transform: scaleY(0.7) scaleX(0.85) translateY(-10px); opacity: 0; }
}
.fire-echo { transform-origin: 50% 88%; }
.fe1 { animation: fire-rise 0.85s -0.22s ease-out forwards; }
.fe2 { animation: fire-rise 0.85s -0.11s ease-out forwards; }
.emb { transform-origin: center; transform-box: fill-box; animation: ember-fly 0.9s ease-out forwards; opacity: 0; }
.emb1 { animation-delay: 0.15s; }
.emb2 { animation-delay: 0.20s; }
.emb3 { animation-delay: 0.12s; }
.emb4 { animation-delay: 0.28s; }
.emb5 { animation-delay: 0.22s; }
.emb6 { animation-delay: 0.32s; }
@keyframes ember-fly {
  0%   { transform: translate(0,0)     scale(0);   opacity: 0; }
  25%  { transform: translate(0,-6px)  scale(1.4); opacity: 1; }
  100% { transform: translate(var(--ex,4px), -22px) scale(0.4); opacity: 0; }
}
.emb1 { --ex: -5px; } .emb2 { --ex: 6px; } .emb3 { --ex: -3px; }
.emb4 { --ex: 4px; } .emb5 { --ex: -6px; } .emb6 { --ex: 3px; }

/* ─── LIGHTNING ──────────────────────────────────────────────────── */
.bolt, .bolt-glow { stroke-dasharray: 100; stroke-dashoffset: 100; }
.bolt      { animation: bolt-draw 0.18s ease-out forwards, bolt-fade 0.55s 0.22s ease-in forwards; }
.bolt-glow { animation: bolt-draw 0.18s ease-out forwards, bolt-fade 0.55s 0.22s ease-in forwards; }
@keyframes bolt-draw { to { stroke-dashoffset: 0; } }
@keyframes bolt-fade { to { opacity: 0; } }
.branch { stroke-dasharray: 40; stroke-dashoffset: 40; }
.br1 { animation: branch-draw 0.22s 0.10s ease-out forwards, bolt-fade 0.4s 0.28s ease-in forwards; }
.br2 { animation: branch-draw 0.20s 0.15s ease-out forwards, bolt-fade 0.35s 0.32s ease-in forwards; }
.br3 { animation: branch-draw 0.18s 0.08s ease-out forwards, bolt-fade 0.3s 0.24s ease-in forwards; }
@keyframes branch-draw { to { stroke-dashoffset: 0; } }
.bsp { transform-origin: center; transform-box: fill-box; animation: spark-pop 0.4s 0.20s ease-out forwards; opacity: 0; }

/* ─── ICE ────────────────────────────────────────────────────────── */
.ice-g { transform-origin: 50% 50%; animation: ice-crystal 0.78s ease-out forwards; }
@keyframes ice-crystal {
  0%   { transform: scale(0.1) rotate(45deg); opacity: 0; }
  40%  { transform: scale(1.1) rotate(2deg);  opacity: 1; }
  65%  { transform: scale(1.0) rotate(0deg);  opacity: 1; }
  100% { transform: scale(0.9) rotate(-4deg); opacity: 0; }
}
.ice-shard { transform-box: fill-box; transform-origin: center; animation: shard-burst 0.7s ease-out forwards; opacity: 0; }
.is1 { animation-delay: 0.15s; }
.is2 { animation-delay: 0.18s; }
.is3 { animation-delay: 0.17s; }
.is4 { animation-delay: 0.16s; }
.is5 { animation-delay: 0.22s; }
.is6 { animation-delay: 0.24s; }
@keyframes shard-burst {
  0%   { transform: scale(0) translate(0,0);   opacity: 0; }
  35%  { transform: scale(1.4) translate(0,0); opacity: 1; }
  100% { transform: scale(0.6) translate(0,0); opacity: 0; }
}
.frost { transform-origin: center; transform-box: fill-box; animation: spark-pop 0.6s 0.25s ease-out forwards; opacity: 0; }

/* ─── SHADOW ─────────────────────────────────────────────────────── */
.shadow-g { transform-origin: 50% 50%; animation: shadow-bloom 0.88s ease-out forwards; }
@keyframes shadow-bloom {
  0%   { transform: scale(0.2) rotate(-25deg); opacity: 0; }
  30%  { transform: scale(1.15) rotate(8deg);  opacity: 0.9; }
  65%  { transform: scale(1.0) rotate(0deg);   opacity: 0.8; }
  100% { transform: scale(1.3) rotate(15deg);  opacity: 0; }
}
.tendril { stroke-dasharray: 60; stroke-dashoffset: 60; }
.t1 { animation: branch-draw 0.5s 0.15s ease-out forwards, bolt-fade 0.5s 0.55s ease-in forwards; }
.t2 { animation: branch-draw 0.5s 0.20s ease-out forwards, bolt-fade 0.5s 0.60s ease-in forwards; }
.t3 { animation: branch-draw 0.4s 0.25s ease-out forwards, bolt-fade 0.4s 0.60s ease-in forwards; }
.t4 { animation: branch-draw 0.4s 0.28s ease-out forwards, bolt-fade 0.4s 0.62s ease-in forwards; }

/* ─── HOLY ───────────────────────────────────────────────────────── */
.holy-g { transform-origin: 50% 50%; animation: holy-burst 0.78s ease-out forwards; }
@keyframes holy-burst {
  0%   { transform: scale(0); opacity: 0; filter: brightness(4); }
  25%  { transform: scale(1.2); opacity: 1; filter: brightness(2); }
  60%  { transform: scale(1.0); opacity: 0.9; filter: brightness(1.3); }
  100% { transform: scale(0.9); opacity: 0; filter: brightness(1); }
}
.holy-mote { transform-origin: center; transform-box: fill-box; animation: spark-pop 0.55s 0.20s ease-out forwards; opacity: 0; }

/* ─── TIME ───────────────────────────────────────────────────────── */
/* Multi-layer clock — outer face rotates one way, middle ring counter-rotates,
   echo hands lag behind the primary hands, sand grains drift down. */
.time-face   { transform-origin: 50% 50%; animation: time-face 0.95s ease-out forwards; }
.time-mid    { transform-origin: 50% 50%; animation: time-mid  0.95s ease-out forwards; }
.time-inner  { transform-origin: 50% 50%; animation: time-inner 0.95s ease-out forwards; }
.time-hand   { transform-origin: 50% 50%; }
.th1         { animation: clock-spin-h 0.95s linear forwards; }
.th2         { animation: clock-spin-m 0.65s linear forwards; }
.th-echo     { transform-origin: 50% 50%; }
.th-e1       { animation: clock-spin-h 0.95s -0.05s linear forwards; opacity: 0; }
.th-e2       { animation: clock-spin-m 0.65s -0.05s linear forwards; opacity: 0; }
.sand-grain  { transform-origin: center; transform-box: fill-box; opacity: 0; animation: sand-fall 0.9s ease-in forwards; }
.sg1 { animation-delay: 0.06s; }
.sg2 { animation-delay: 0.14s; }
.sg3 { animation-delay: 0.22s; }
.sg4 { animation-delay: 0.30s; }
.sg5 { animation-delay: 0.38s; }
@keyframes time-face   { 0% { transform: scale(0.3) rotate(0); opacity: 0; } 30% { transform: scale(1.05) rotate(20deg); opacity: 1; filter: brightness(2); } 100% { transform: scale(1.3) rotate(60deg); opacity: 0; } }
@keyframes time-mid    { 0% { transform: scale(0.4) rotate(0); opacity: 0; } 30% { transform: scale(1) rotate(-25deg); opacity: 0.85; } 100% { transform: scale(1.2) rotate(-90deg); opacity: 0; } }
@keyframes time-inner  { 0% { transform: scale(0.4) rotate(0); opacity: 0; } 30% { transform: scale(1) rotate(45deg);  opacity: 0.7; } 100% { transform: scale(1.15) rotate(180deg); opacity: 0; } }
@keyframes clock-spin-h{ 0% { transform: rotate(0); opacity: 1; } 100% { transform: rotate(540deg); opacity: 0; } }
@keyframes clock-spin-m{ 0% { transform: rotate(0); opacity: 1; } 100% { transform: rotate(720deg); opacity: 0; } }
@keyframes sand-fall   { 0% { transform: translateY(-8px) scale(0); opacity: 0; } 30% { transform: translateY(0) scale(1.3); opacity: 1; } 100% { transform: translateY(14px) scale(0.6); opacity: 0; } }

/* ─── PSYCHIC ────────────────────────────────────────────────────── */
/* Brain-wave rings expand outward; third-eye opens; thought spokes
   shoot from center to perimeter; mind-sparks burst at the tips. */
.psy-ring { transform-origin: 50% 50%; }
.psy-ring.pr1 { animation: psy-ripple 0.85s         ease-out forwards; }
.psy-ring.pr2 { animation: psy-ripple 0.85s 0.08s   ease-out forwards; }
.psy-ring.pr3 { animation: psy-ripple 0.85s 0.16s   ease-out forwards; }
.psy-ring.pr4 { animation: psy-ripple 0.85s 0.24s   ease-out forwards; }
.psy-eye      { transform-origin: 50% 50%; animation: psy-eye-open 0.85s ease-out forwards; }
.psy-spokes line { stroke-dasharray: 60; stroke-dashoffset: 60; animation: psy-spoke-draw 0.55s ease-out forwards; }
.psy-spokes line:nth-child(1) { animation-delay: 0.20s; }
.psy-spokes line:nth-child(2) { animation-delay: 0.22s; }
.psy-spokes line:nth-child(3) { animation-delay: 0.24s; }
.psy-spokes line:nth-child(4) { animation-delay: 0.26s; }
.psy-spokes line:nth-child(5) { animation-delay: 0.28s; }
.psy-spokes line:nth-child(6) { animation-delay: 0.30s; }
.psy-spokes line:nth-child(7) { animation-delay: 0.32s; }
.psy-spokes line:nth-child(8) { animation-delay: 0.34s; }
.psy-spark    { transform-origin: center; transform-box: fill-box; opacity: 0; animation: spark-pop 0.5s 0.42s ease-out forwards; }
.ps2 { animation-delay: 0.45s; }
.ps3 { animation-delay: 0.48s; }
.ps4 { animation-delay: 0.51s; }
@keyframes psy-ripple    { 0% { transform: scale(0.4); opacity: 0; } 25% { transform: scale(1); opacity: 1; filter: brightness(2); } 100% { transform: scale(1.6); opacity: 0; } }
@keyframes psy-eye-open  { 0% { transform: scale(0.2); opacity: 0; filter: brightness(1); } 30% { transform: scale(1.2); opacity: 1; filter: brightness(2.2) drop-shadow(0 0 16px var(--c)); } 100% { transform: scale(0.9); opacity: 0; } }
@keyframes psy-spoke-draw{ 0% { stroke-dashoffset: 60; opacity: 0; } 50% { stroke-dashoffset: 0; opacity: 1; } 100% { stroke-dashoffset: 0; opacity: 0; } }

/* ─── POISON ─────────────────────────────────────────────────────── */
.pb { transform-origin: 50% 50%; }
.pb1 { animation: bubble-float 0.88s ease-out forwards; }
.pb2 { animation: bubble-float 0.88s 0.07s ease-out forwards; }
.pb3 { animation: bubble-float 0.88s 0.04s ease-out forwards; }
.pb4 { animation: bubble-float 0.88s 0.15s ease-out forwards; }
.pb5 { animation: bubble-float 0.88s 0.22s ease-out forwards; }
.pb6 { animation: bubble-float 0.88s 0.11s ease-out forwards; }
@keyframes bubble-float {
  0%   { transform: scale(0) translateY(0);    opacity: 0; }
  30%  { transform: scale(1.2) translateY(-4px); opacity: 1; }
  70%  { transform: scale(1.0) translateY(-10px); opacity: 0.8; }
  100% { transform: scale(1.4) translateY(-22px); opacity: 0; }
}
.drip { transform-origin: center; transform-box: fill-box; animation: drip-fall 0.7s 0.30s ease-in forwards; opacity: 0; }
@keyframes drip-fall {
  0%   { transform: translateY(0) scale(1);   opacity: 0.8; }
  100% { transform: translateY(12px) scale(0.6); opacity: 0; }
}

/* ─── GRAVITY ────────────────────────────────────────────────────── */
.grav-g { transform-origin: 50% 50%; animation: gravity-crush 0.72s ease-in forwards; }
@keyframes gravity-crush {
  0%   { transform: scale(2.2); opacity: 0; }
  35%  { transform: scale(1.1); opacity: 1; }
  70%  { transform: scale(1.0); opacity: 1; }
  100% { transform: scale(0.1); opacity: 0; }
}
.debris { transform-box: fill-box; transform-origin: center; animation: debris-suck 0.65s 0.08s ease-in forwards; }
.db1 { animation-delay: 0.05s; }
.db2 { animation-delay: 0.08s; }
.db3 { animation-delay: 0.06s; }
.db4 { animation-delay: 0.10s; }
@keyframes debris-suck {
  0%   { transform: translate(0,0) scale(1); opacity: 0.6; }
  100% { transform: translate(calc(50px - var(--ox,0px)), calc(50px - var(--oy,0px))) scale(0); opacity: 0; }
}

/* ─── COMBO ──────────────────────────────────────────────────────── */
.cmb { opacity: 0; }
.cmb1 { animation: x-pop 0.55s ease-out forwards; }
.cmb2 { animation: x-pop 0.55s 0.10s ease-out forwards; }
.cmb3 { animation: x-pop 0.55s 0.20s ease-out forwards; }
.cmb4 { animation: x-pop 0.55s 0.30s ease-out forwards; }
.cmb5 { animation: x-pop 0.55s 0.40s ease-out forwards; }
@keyframes x-pop {
  0%   { transform: scale(0); opacity: 0; }
  45%  { transform: scale(1.3); opacity: 1; }
  75%  { transform: scale(1.0); opacity: 1; }
  100% { transform: scale(0.9); opacity: 0; }
}

/* ─── CRIT ───────────────────────────────────────────────────────── */
.crit-g { transform-origin: 50% 50%; animation: crit-explosion 0.72s cubic-bezier(0.34,1.56,0.64,1) forwards; }
@keyframes crit-explosion {
  0%   { transform: scale(0) rotate(-20deg); opacity: 0; filter: brightness(5); }
  30%  { transform: scale(1.3) rotate(4deg); opacity: 1; filter: brightness(2.5); }
  60%  { transform: scale(1.1) rotate(0deg); opacity: 1; filter: brightness(1.5); }
  100% { transform: scale(0.85) rotate(-3deg); opacity: 0; filter: brightness(1); }
}
.crit-shockwave { transform-origin: 50% 50%; }
.csw { animation: crit-wave 0.65s ease-out forwards; opacity: 0; }
@keyframes crit-wave {
  0%   { transform: scale(0.2); opacity: 0.9; }
  60%  { transform: scale(1.0); opacity: 0.4; }
  100% { transform: scale(1.4); opacity: 0; }
}
.shard { stroke-dasharray: 55; stroke-dashoffset: 55; opacity: 0; }
.sh1 { animation: shard-shoot 0.55s 0.18s ease-out forwards; }
.sh2 { animation: shard-shoot 0.55s 0.20s ease-out forwards; }
.sh3 { animation: shard-shoot 0.5s  0.22s ease-out forwards; }
.sh4 { animation: shard-shoot 0.5s  0.24s ease-out forwards; }
.sh5 { animation: shard-shoot 0.52s 0.19s ease-out forwards; }
.sh6 { animation: shard-shoot 0.48s 0.25s ease-out forwards; }
@keyframes shard-shoot {
  0%   { stroke-dashoffset: 55; opacity: 0; }
  25%  { stroke-dashoffset: 0;  opacity: 1; }
  100% { stroke-dashoffset: -20; opacity: 0; }
}

/* ─── SHIELD ─────────────────────────────────────────────────────── */
.shld-bloom { transform-origin: 50% 50%; animation: bloom-flash 0.88s ease-out forwards; opacity: 0; }
@keyframes bloom-flash {
  0%   { opacity: 0;    transform: scale(0.2); }
  18%  { opacity: 0.52; transform: scale(1.25); }
  52%  { opacity: 0.28; transform: scale(1.0); }
  100% { opacity: 0;    transform: scale(1.5); }
}
.shld-body { transform-origin: 50% 50%; animation: shield-form-new 0.90s cubic-bezier(0.34,1.56,0.64,1) forwards; }
.shld-hex  { stroke-dasharray: 300; stroke-dashoffset: 300; animation: hex-draw-new 0.50s ease-out forwards; }
@keyframes shield-form-new {
  0%   { transform: scale(0.1); opacity: 0; filter: brightness(7); }
  26%  { transform: scale(1.30); opacity: 1; filter: brightness(3); }
  55%  { transform: scale(1.0);  opacity: 1; filter: brightness(1.6); }
  80%  { transform: scale(1.06); opacity: 0.88; filter: brightness(1.2); }
  100% { transform: scale(1.02); opacity: 0; filter: brightness(1); }
}
@keyframes hex-draw-new { to { stroke-dashoffset: 0; } }
.shld-core { transform-origin: 50% 50%; animation: core-flash 0.90s ease-out forwards; }
@keyframes core-flash {
  0%   { transform: scale(0); opacity: 0; }
  18%  { transform: scale(2.8); opacity: 1; }
  55%  { transform: scale(1.3); opacity: 0.75; }
  100% { transform: scale(0.4); opacity: 0; }
}
.blk-ring { transform-origin: 50% 50%; opacity: 0; }
.bkr1 { animation: blk-ring-expand 0.62s 0.16s cubic-bezier(0.1, 0.6, 0.3, 1) forwards; }
.bkr2 { animation: blk-ring-expand 0.68s 0.26s cubic-bezier(0.1, 0.6, 0.3, 1) forwards; }
.bkr3 { animation: blk-ring-expand 0.75s 0.38s cubic-bezier(0.1, 0.6, 0.3, 1) forwards; }
@keyframes blk-ring-expand {
  0%   { transform: scale(0.15); opacity: 0.98; }
  55%  { transform: scale(1.0);  opacity: 0.5; }
  100% { transform: scale(1.75); opacity: 0; }
}
.blk-spark { transform-origin: center; transform-box: fill-box; opacity: 0; }
.bks1 { animation: spark-fly 0.58s 0.22s ease-out forwards; --sfx:  0px; --sfy:-26px; }
.bks2 { animation: spark-fly 0.58s 0.25s ease-out forwards; --sfx: 22px; --sfy:-13px; }
.bks3 { animation: spark-fly 0.58s 0.25s ease-out forwards; --sfx: 22px; --sfy: 13px; }
.bks4 { animation: spark-fly 0.58s 0.22s ease-out forwards; --sfx:  0px; --sfy: 26px; }
.bks5 { animation: spark-fly 0.58s 0.25s ease-out forwards; --sfx:-22px; --sfy: 13px; }
.bks6 { animation: spark-fly 0.58s 0.25s ease-out forwards; --sfx:-22px; --sfy:-13px; }
@keyframes spark-fly {
  0%   { transform: translate(0,0) scale(0); opacity: 0; }
  18%  { transform: translate(0,0) scale(2.2); opacity: 1; }
  100% { transform: translate(var(--sfx,0px), var(--sfy,0px)) scale(0.25); opacity: 0; }
}

/* ─── BERSERKER ──────────────────────────────────────────────────── */
.bsrk-g { transform-origin: 50% 50%; animation: berserk-rage 0.72s ease-out forwards; }
@keyframes berserk-rage {
  0%   { transform: scale(0.3) rotate(-10deg); opacity: 0; }
  18%  { transform: scale(1.25) rotate(6deg);  opacity: 1; }
  38%  { transform: scale(0.9) rotate(-4deg);  opacity: 1; }
  58%  { transform: scale(1.12) rotate(3deg);  opacity: 0.9; }
  78%  { transform: scale(1.0) rotate(0deg);   opacity: 0.7; }
  100% { transform: scale(1.2) rotate(-5deg);  opacity: 0; }
}
.rage-mote { transform-origin: center; transform-box: fill-box; animation: spark-pop 0.6s ease-out forwards; opacity: 0; }
.rm1 { animation-delay: 0.12s; }
.rm2 { animation-delay: 0.16s; }
.rm3 { animation-delay: 0.14s; }
.rm4 { animation-delay: 0.18s; }

/* ─── WIND ───────────────────────────────────────────────────────── */
.wind-g { animation: wind-sweep 0.72s ease-out forwards; }
.wl { stroke-dasharray: 110; stroke-dashoffset: 110; }
.wl1 { animation: wind-draw 0.42s ease-out forwards; }
.wl2 { animation: wind-draw 0.42s 0.07s ease-out forwards; }
.wl3 { animation: wind-draw 0.42s 0.14s ease-out forwards; }
@keyframes wind-sweep {
  0%   { transform: translateX(-18px); opacity: 0; }
  35%  { transform: translateX(4px);   opacity: 1; }
  100% { transform: translateX(14px);  opacity: 0; }
}
@keyframes wind-draw { to { stroke-dashoffset: 0; } }
.wind-mote { transform-origin: center; transform-box: fill-box; animation: spark-pop 0.5s ease-out forwards; opacity: 0; }
.wm1 { animation-delay: 0.22s; }
.wm2 { animation-delay: 0.28s; }
.wm3 { animation-delay: 0.34s; }

/* ─── EARTH ──────────────────────────────────────────────────────── */
.erth-g { animation: erth-shake 0.78s ease-out forwards; }
.es { transform-box: fill-box; transform-origin: bottom center; transform: scaleY(0); opacity: 0; }
.es1 { animation: spike-rise 0.5s 0.05s ease-out forwards; }
.es2 { animation: spike-rise 0.5s ease-out forwards; }
.es3 { animation: spike-rise 0.5s 0.09s ease-out forwards; }
.es4 { animation: spike-rise 0.4s 0.16s ease-out forwards; }
.es5 { animation: spike-rise 0.4s 0.13s ease-out forwards; }
@keyframes spike-rise {
  0%   { transform: scaleY(0); opacity: 0; }
  55%  { transform: scaleY(1.1); opacity: 1; }
  80%  { transform: scaleY(1.0); opacity: 1; }
  100% { transform: scaleY(0.8); opacity: 0; }
}
@keyframes erth-shake {
  0%,100% { transform: translateX(0); }
  20%     { transform: translateX(-3px); }
  40%     { transform: translateX(3px); }
  60%     { transform: translateX(-2px); }
  80%     { transform: translateX(2px); }
}
.rock-chip { transform-origin: center; transform-box: fill-box; animation: spark-pop 0.55s ease-out forwards; opacity: 0; }
.rc1 { animation-delay: 0.18s; }
.rc2 { animation-delay: 0.22s; }
.rc3 { animation-delay: 0.20s; }
.rc4 { animation-delay: 0.26s; }

/* ─── BLOOD ──────────────────────────────────────────────────────── */
.bld-g { transform-origin: 50% 50%; animation: blood-splat 0.82s ease-out forwards; }
.bd { transform-box: fill-box; transform-origin: center center; }
.bd1 { animation: drop-fly 0.65s ease-out forwards; }
.bd2 { animation: drop-fly 0.65s 0.04s ease-out forwards; }
.bd3 { animation: drop-fly 0.65s 0.02s ease-out forwards; }
.bd4 { animation: drop-fly 0.65s 0.08s ease-out forwards; }
.bd5 { animation: drop-fly 0.65s 0.06s ease-out forwards; }
.bd6 { animation: drop-fly 0.65s 0.03s ease-out forwards; }
.bd7 { animation: drop-fly 0.65s 0.01s ease-out forwards; }
@keyframes blood-splat {
  0%   { transform: scale(0); opacity: 0; }
  32%  { transform: scale(1.25); opacity: 1; }
  100% { transform: scale(0.9); opacity: 0; }
}
@keyframes drop-fly {
  0%   { transform: scale(0) translate(0,0);    opacity: 0; }
  38%  { transform: scale(1.25) translate(0,-5px); opacity: 1; }
  100% { transform: scale(0.6) translate(0,-18px); opacity: 0; }
}

/* ─── VOID ───────────────────────────────────────────────────────── */
.void-g { transform-origin: 50% 50%; animation: void-spin 0.92s ease-in-out forwards; }
.vr { transform-origin: 50% 50%; }
.vr1 { animation: void-collapse 0.82s ease-in forwards; }
.vr2 { animation: void-collapse 0.82s 0.05s ease-in forwards; }
.vr3 { animation: void-collapse 0.82s 0.10s ease-in forwards; }
.void-core  { transform-origin: 50% 50%; animation: void-core-anim 0.82s ease-out forwards; }
.void-debris { transform-box: fill-box; transform-origin: center; animation: debris-suck 0.7s ease-in forwards; }
.vd1 { animation-delay: 0.05s; }
.vd2 { animation-delay: 0.08s; }
.vd3 { animation-delay: 0.06s; }
.vd4 { animation-delay: 0.10s; }
.vd5 { animation-delay: 0.04s; }
.vd6 { animation-delay: 0.12s; }
@keyframes void-spin {
  0%   { transform: rotate(0deg); opacity: 0; }
  18%  { opacity: 1; }
  100% { transform: rotate(-200deg); opacity: 0; }
}
@keyframes void-collapse {
  0%   { transform: scale(1.6); opacity: 0; }
  38%  { transform: scale(1.0); opacity: 1; }
  100% { transform: scale(0.15); opacity: 0; }
}
@keyframes void-core-anim {
  0%   { transform: scale(0); opacity: 0; }
  45%  { transform: scale(1.6); opacity: 1; }
  100% { transform: scale(0); opacity: 0; }
}

/* ─── ENERGY ─────────────────────────────────────────────────────── */
.enrg-g { transform-origin: 50% 50%; animation: energy-pulse 0.78s ease-out forwards; }
.er { transform-origin: 50% 50%; }
.er1 { animation: ring-expand-fade 0.62s ease-out forwards; }
.er2 { animation: ring-expand-fade 0.72s 0.09s ease-out forwards; }
.eb  { animation: beam-flash 0.52s ease-out forwards; }
.enrg-core { transform-origin: 50% 50%; animation: enrg-core-anim 0.78s ease-out forwards; }
.enrg-mote { transform-origin: center; transform-box: fill-box; animation: spark-pop 0.55s ease-out forwards; opacity: 0; }
.em1 { animation-delay: 0.16s; }
.em2 { animation-delay: 0.20s; }
.em3 { animation-delay: 0.18s; }
.em4 { animation-delay: 0.22s; }
@keyframes energy-pulse {
  0%   { transform: scale(0.2); opacity: 0; }
  32%  { transform: scale(1.15); opacity: 1; }
  68%  { transform: scale(1.0); opacity: 0.9; }
  100% { transform: scale(0.9); opacity: 0; }
}
@keyframes ring-expand-fade {
  0%   { transform: scale(0.3); opacity: 0; }
  38%  { transform: scale(1.0); opacity: 0.85; }
  100% { transform: scale(1.55); opacity: 0; }
}
@keyframes beam-flash {
  0%   { opacity: 0; }
  22%  { opacity: 0.85; }
  100% { opacity: 0; }
}
@keyframes enrg-core-anim {
  0%   { transform: scale(0); opacity: 0; }
  35%  { transform: scale(1.3); opacity: 1; }
  70%  { transform: scale(1.0); opacity: 0.9; }
  100% { transform: scale(0.6); opacity: 0; }
}

/* ─── CURSED ─────────────────────────────────────────────────────── */
.curs-g { transform-origin: 50% 50%; animation: curse-appear 0.88s ease-out forwards; }
@keyframes curse-appear {
  0%   { transform: scale(0.2) rotate(-30deg); opacity: 0; filter: brightness(2.5); }
  28%  { transform: scale(1.1) rotate(4deg);   opacity: 1; filter: brightness(1.6); }
  62%  { transform: scale(1.0) rotate(0deg);   opacity: 0.9; filter: brightness(1); }
  100% { transform: scale(1.05) rotate(-3deg); opacity: 0; }
}
.wisp { transform-origin: center; transform-box: fill-box; animation: spark-pop 0.6s ease-out forwards; opacity: 0; }
.ws1 { animation-delay: 0.18s; }
.ws2 { animation-delay: 0.22s; }
.ws3 { animation-delay: 0.26s; }
.ws4 { animation-delay: 0.30s; }
.ws5 { animation-delay: 0.20s; }

/* ─── COUNTER ────────────────────────────────────────────────────── */
.counter-g { transform-origin: 50% 50%; animation: counter-clash 0.72s cubic-bezier(0.34,1.56,0.64,1) forwards; }
@keyframes counter-clash {
  0%   { transform: scale(0) rotate(-15deg); opacity: 0; filter: brightness(5); }
  22%  { transform: scale(1.35) rotate(5deg); opacity: 1; filter: brightness(2.5); }
  50%  { transform: scale(1.1) rotate(0deg); opacity: 1; filter: brightness(1.4); }
  100% { transform: scale(0.8) rotate(-4deg); opacity: 0; filter: brightness(1); }
}
.counter-ring { transform-origin: 50% 50%; }
.cr1 { animation: ring-expand 0.65s ease-out forwards; }
.cr2 { animation: ring-expand 0.72s 0.06s ease-out forwards; }
.counter-core  { transform-origin: 50% 50%; animation: enrg-core-anim 0.72s ease-out forwards; }
.counter-inner { transform-origin: 50% 50%; animation: core-pulse 0.72s ease-out forwards; }
.ct { stroke-dasharray: 80; stroke-dashoffset: 80; opacity: 0; }
.ct1 { animation: shard-shoot 0.45s 0.08s ease-out forwards; }
.ct2 { animation: shard-shoot 0.45s 0.10s ease-out forwards; }
.ct3 { animation: shard-shoot 0.42s 0.12s ease-out forwards; }
.ct4 { animation: shard-shoot 0.42s 0.14s ease-out forwards; }
.ct5 { animation: shard-shoot 0.45s 0.09s ease-out forwards; }
.ct6 { animation: shard-shoot 0.40s 0.15s ease-out forwards; }
.ct7 { animation: shard-shoot 0.38s 0.16s ease-out forwards; }
.ct8 { animation: shard-shoot 0.38s 0.18s ease-out forwards; }

/* ─── DODGE ──────────────────────────────────────────────────────── */
.dodge-ghost { transform-origin: 50% 50%; opacity: 0; }
.dgh1 { animation: ghost-left  0.75s ease-out forwards; }
.dgh2 { animation: ghost-right 0.75s 0.05s ease-out forwards; }
@keyframes ghost-left {
  0%   { opacity: 0;    transform: translate(0,0)       scale(1.0); filter: blur(0px); }
  15%  { opacity: 0.58; transform: translate(-10px,-3px) scale(1.02); filter: blur(1.5px); }
  52%  { opacity: 0.30; transform: translate(-15px, 0px) scale(0.95); filter: blur(3px); }
  100% { opacity: 0;    transform: translate(-22px, 2px) scale(0.68); filter: blur(6px); }
}
@keyframes ghost-right {
  0%   { opacity: 0;    transform: translate(0,0)      scale(1.0); filter: blur(0px); }
  20%  { opacity: 0.52; transform: translate(10px,3px) scale(1.02); filter: blur(1.5px); }
  56%  { opacity: 0.26; transform: translate(15px,0px) scale(0.95); filter: blur(3px); }
  100% { opacity: 0;    transform: translate(22px,-2px) scale(0.68); filter: blur(6px); }
}
.spd-line { stroke-dasharray: 50; stroke-dashoffset: 50; opacity: 0; }
.sdl1 { animation: spd-draw 0.24s 0.04s ease-out forwards, bolt-fade 0.26s 0.22s ease-in forwards; }
.sdl2 { animation: spd-draw 0.20s 0.00s ease-out forwards, bolt-fade 0.22s 0.18s ease-in forwards; }
.sdl3 { animation: spd-draw 0.24s 0.07s ease-out forwards, bolt-fade 0.26s 0.26s ease-in forwards; }
.sdl4 { animation: spd-draw 0.20s 0.11s ease-out forwards, bolt-fade 0.22s 0.28s ease-in forwards; }
.sdl5 { animation: spd-draw 0.24s 0.02s ease-out forwards, bolt-fade 0.26s 0.20s ease-in forwards; }
.sdl6 { animation: spd-draw 0.24s 0.09s ease-out forwards, bolt-fade 0.26s 0.28s ease-in forwards; }
@keyframes spd-draw { to { stroke-dashoffset: 0; opacity: 1; } }
.dod-ring { transform-origin: 50% 50%; opacity: 0; }
.dr1 { animation: ring-burst 0.55s 0.06s ease-out forwards; }
.dr2 { animation: ring-burst 0.58s 0.14s ease-out forwards; }
.dr3 { animation: ring-burst 0.62s 0.22s ease-out forwards; }
@keyframes ring-burst {
  0%   { transform: scale(0.2); opacity: 0.92; }
  55%  { transform: scale(1.0); opacity: 0.42; }
  100% { transform: scale(1.38); opacity: 0; }
}

/* ─── HOLY BEAM ──────────────────────────────────────────────────── */
.beam-bloom { transform-origin: 50% 50%; animation: beam-bloom-anim 0.80s ease-out forwards; opacity: 0; }
@keyframes beam-bloom-anim {
  0%   { opacity: 0;    transform: scale(0.1); }
  22%  { opacity: 0.58; transform: scale(1.35); }
  55%  { opacity: 0.22; transform: scale(1.1); }
  100% { opacity: 0;    transform: scale(2.4); }
}
.star-charge { transform-origin: 50% 50%; animation: star-charge-up 0.42s ease-out forwards; }
@keyframes star-charge-up {
  0%   { transform: scale(0);    opacity: 0; filter: brightness(7); }
  28%  { transform: scale(1.55); opacity: 1; filter: brightness(3.5); }
  65%  { transform: scale(1.1);  opacity: 1; filter: brightness(1.8); }
  100% { transform: scale(0.12); opacity: 0; filter: brightness(9); }
}
.star-body { transform-origin: 50% 50%; animation: star-body-spin 0.42s ease-out forwards; }
@keyframes star-body-spin {
  0%   { transform: rotate(-35deg); }
  45%  { transform: rotate(6deg); }
  100% { transform: rotate(18deg); }
}
.beam-line {
  stroke-dasharray: 500;
  stroke-dashoffset: 500;
  animation: beam-fire 0.52s 0.32s ease-out forwards;
  opacity: 0;
}
.bl-glow {
  animation: beam-fire-glow 0.52s 0.30s ease-out forwards;
  stroke-dasharray: 500;
  stroke-dashoffset: 500;
  opacity: 0;
  filter: blur(7px);
}
@keyframes beam-fire {
  0%   { stroke-dashoffset: 500; opacity: 0; }
  10%  { opacity: 1; filter: brightness(4); }
  45%  { stroke-dashoffset: 0; opacity: 1; filter: brightness(2.5); }
  100% { stroke-dashoffset: 0; opacity: 0; filter: brightness(1); }
}
@keyframes beam-fire-glow {
  0%   { stroke-dashoffset: 500; opacity: 0; }
  15%  { opacity: 0.5; }
  50%  { stroke-dashoffset: 0; opacity: 0.32; }
  100% { stroke-dashoffset: 0; opacity: 0; }
}
.beam-spark { transform-origin: 50% 50%; animation: spark-pop 0.70s ease-out forwards; opacity: 0; }
.bsp1 { animation-delay: 0.28s; }
.bsp2 { animation-delay: 0.30s; }

/* ─── WATER ──────────────────────────────────────────────────────── */
.water-main  { transform-origin: 50% 60%; animation: water-drop-anim 0.78s ease-out forwards; }
@keyframes water-drop-anim {
  0%   { transform: scale(0.28); opacity: 0; filter: brightness(2.5); }
  18%  { transform: scale(1.18); opacity: 1; filter: brightness(1.6); }
  72%  { transform: scale(1.0);  opacity: 1; filter: brightness(1.2); }
  100% { transform: scale(0.45); opacity: 0; filter: brightness(1); }
}
.water-glow  { transform-origin: 50% 50%; animation: bloom-flash 0.78s ease-out forwards; opacity: 0; }
.water-trail { opacity: 0; }
.wtr1 { animation: trail-fade 0.78s 0.08s ease-out forwards; }
.wtr2 { animation: trail-fade 0.78s 0.16s ease-out forwards; }
.wtr3 { animation: trail-fade 0.78s 0.24s ease-out forwards; }
@keyframes trail-fade {
  0%   { opacity: 0; }
  18%  { opacity: 1; }
  72%  { opacity: 0.4; }
  100% { opacity: 0; }
}
.water-ripple { transform-origin: 50% 80%; opacity: 0; }
.wr1 { animation: ring-burst 0.52s 0.50s ease-out forwards; }
.wr2 { animation: ring-burst 0.58s 0.58s ease-out forwards; }

/* ─── GENERIC ────────────────────────────────────────────────────── */
.gen-g { transform-origin: 50% 50%; animation: gen-impact 0.68s ease-out forwards; }
.gen-ring { transform-origin: 50% 50%; animation: ring-expand-fade 0.62s ease-out forwards; }
@keyframes gen-impact {
  0%   { transform: scale(0); opacity: 0; }
  38%  { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(1.0); opacity: 0; }
}
.gen-spark { transform-origin: center; transform-box: fill-box; animation: spark-pop 0.5s ease-out forwards; opacity: 0; }
.gs1 { animation-delay: 0.16s; }
.gs2 { animation-delay: 0.18s; }
.gs3 { animation-delay: 0.20s; }
.gs4 { animation-delay: 0.22s; }

/* ─── GRADE INTENSITY ──────────────────────────────────────────────── */
.fx-grade-s   { filter: brightness(1.4) saturate(1.3); }
.fx-grade-ss  { filter: brightness(1.7) saturate(1.6); animation: fx-grade-shake 0.25s ease both; }
.fx-grade-sss { filter: brightness(2.0) saturate(2.0); animation: fx-grade-shake 0.35s ease both; }
.fx-grade-god { filter: brightness(2.5) saturate(2.5) contrast(1.15); animation: fx-grade-shake 0.45s ease both; }
@keyframes fx-grade-shake {
  0%,100% { transform: translate(0,0); }
  20%     { transform: translate(-3px, 2px); }
  40%     { transform: translate(3px, -2px); }
  60%     { transform: translate(-2px, 3px); }
  80%     { transform: translate(2px, -1px); }
}

/* ─── SHOCKWAVE ────────────────────────────────────────────────────── */
.fx-shockwave {
  position: absolute;
  left: 50%; top: 50%;
  width: 0; height: 0;
  border-radius: 50%;
  border: 2px solid transparent;
  transform: translate(-50%, -50%);
  pointer-events: none;
}
.sw-primary {
  border-width: 4px;
  animation: fx-shockwave-primary 0.62s cubic-bezier(0.22, 0.8, 0.3, 1) forwards;
}
.sw-secondary {
  border-width: 2.5px;
  animation: fx-shockwave-secondary 0.7s cubic-bezier(0.22, 0.8, 0.3, 1) forwards;
}
.sw-tertiary {
  border-width: 1.5px;
  animation: fx-shockwave-tertiary 0.8s cubic-bezier(0.22, 0.8, 0.3, 1) forwards;
}
/* Primary: punches outward fast, with a starting flash to sell the impact */
@keyframes fx-shockwave-primary {
  0%   { width: 0;    height: 0;    opacity: 1.0; filter: brightness(2.5); }
  20%  { width: 60px; height: 60px; opacity: 1.0; filter: brightness(1.8); }
  100% { width: 200px;height: 200px;opacity: 0;   filter: brightness(1); }
}
@keyframes fx-shockwave-secondary {
  0%   { width: 0;    height: 0;    opacity: 0.9; }
  100% { width: 240px;height: 240px;opacity: 0; }
}
@keyframes fx-shockwave-tertiary {
  0%   { width: 0;    height: 0;    opacity: 0.7; }
  100% { width: 280px;height: 280px;opacity: 0; }
}

/* ─── ARCANE ─────────────────────────────────────────────────────── */
.arc-ring-out  { transform-origin: 50% 50%; animation: arc-rotate 1.4s linear infinite; }
.arc-pent      { transform-origin: 50% 50%; animation: arc-pent 0.85s ease-out forwards; }
.arc-glyph polygon { transform-origin: 50% 50%; transform-box: fill-box; animation: arc-glyph-flash 0.7s ease-out forwards; opacity: 0; }
.arc-glyph polygon:nth-child(1) { animation-delay: 0.08s; }
.arc-glyph polygon:nth-child(2) { animation-delay: 0.14s; }
.arc-glyph polygon:nth-child(3) { animation-delay: 0.20s; }
.arc-glyph polygon:nth-child(4) { animation-delay: 0.26s; }
.arc-bolt { stroke-dasharray: 30; stroke-dashoffset: 30; animation: arc-bolt-draw 0.55s ease-out forwards; }
.arc-b1 { animation-delay: 0.16s; } .arc-b2 { animation-delay: 0.22s; }
.arc-b3 { animation-delay: 0.18s; } .arc-b4 { animation-delay: 0.24s; }
.arc-core { transform-origin: 50% 50%; transform-box: fill-box; animation: arc-core-pulse 0.85s ease-out forwards; }
@keyframes arc-rotate     { 0% { transform: rotate(0); } 100% { transform: rotate(360deg); } }
@keyframes arc-pent       { 0% { transform: rotate(0)    scale(0.5); opacity: 0; } 25% { opacity: 1; transform: rotate(-30deg) scale(1.15); } 100% { transform: rotate(-90deg) scale(1); opacity: 0; } }
@keyframes arc-glyph-flash{ 0% { transform: scale(0); opacity: 0; } 40% { transform: scale(1.6); opacity: 1; filter: brightness(2.5); } 100% { transform: scale(1); opacity: 0; } }
@keyframes arc-bolt-draw  { 0% { stroke-dashoffset: 30; opacity: 0; } 35% { stroke-dashoffset: 0; opacity: 1; } 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes arc-core-pulse { 0% { transform: scale(0); opacity: 0; } 35% { transform: scale(1.5); opacity: 1; filter: brightness(3); } 100% { transform: scale(0.6); opacity: 0; } }

/* ─── NATURE ─────────────────────────────────────────────────────── */
.nat-vines  { transform-origin: 50% 50%; animation: nat-grow 0.85s ease-out forwards; }
.nat-leaves .leaf { transform-origin: center; transform-box: fill-box; animation: nat-leaf 0.6s ease-out forwards; opacity: 0; }
.nat-leaves .leaf.l1 { animation-delay: 0.20s; }
.nat-leaves .leaf.l2 { animation-delay: 0.22s; }
.nat-leaves .leaf.l3 { animation-delay: 0.26s; }
.nat-leaves .leaf.l4 { animation-delay: 0.28s; }
.nat-bloom  { transform-origin: 50% 50%; animation: nat-bloom 0.75s 0.10s ease-out forwards; }
.pollen     { transform-origin: center; transform-box: fill-box; animation: nat-pollen 0.8s 0.30s ease-out forwards; opacity: 0; }
@keyframes nat-grow   { 0% { transform: scale(0); opacity: 0; } 30% { transform: scale(1); opacity: 1; } 100% { transform: scale(1.1); opacity: 0; } }
@keyframes nat-leaf   { 0% { transform: scale(0) rotate(-20deg); opacity: 0; } 50% { transform: scale(1.3) rotate(0); opacity: 1; } 100% { transform: scale(1) rotate(20deg); opacity: 0; } }
@keyframes nat-bloom  { 0% { transform: scale(0); opacity: 0; } 45% { transform: scale(1.3); opacity: 1; filter: brightness(2); } 100% { transform: scale(0.9); opacity: 0; } }
@keyframes nat-pollen { 0% { transform: translateY(0) scale(0); opacity: 0; } 40% { transform: translateY(-8px) scale(1.4); opacity: 1; } 100% { transform: translateY(-22px) scale(0.6); opacity: 0; } }

/* ─── COSMIC ─────────────────────────────────────────────────────── */
.cos-spiral { transform-origin: 50% 50%; animation: cos-spiral 1.1s ease-out forwards; }
.cos-core   { transform-origin: 50% 50%; animation: cos-core 0.85s ease-out forwards; }
.cos-stars .cstar { transform-origin: center; transform-box: fill-box; animation: cos-twinkle 0.7s ease-out forwards; opacity: 0; }
.cos-stars .cstar.cs1 { animation-delay: 0.10s; }
.cos-stars .cstar.cs2 { animation-delay: 0.16s; }
.cos-stars .cstar.cs3 { animation-delay: 0.22s; }
.cos-stars .cstar.cs4 { animation-delay: 0.28s; }
.cstar-dot { transform-origin: center; transform-box: fill-box; animation: cos-twinkle 0.6s 0.34s ease-out forwards; opacity: 0; }
@keyframes cos-spiral { 0% { transform: scale(0.3) rotate(0); opacity: 0; } 35% { transform: scale(1.2) rotate(-60deg); opacity: 1; } 100% { transform: scale(1.4) rotate(-180deg); opacity: 0; } }
@keyframes cos-core   { 0% { transform: scale(0); opacity: 0; filter: brightness(1); } 40% { transform: scale(1.4); opacity: 1; filter: brightness(3) drop-shadow(0 0 18px var(--c)); } 100% { transform: scale(0.8); opacity: 0; } }
@keyframes cos-twinkle{ 0% { transform: scale(0) rotate(0); opacity: 0; } 50% { transform: scale(1.4) rotate(40deg); opacity: 1; filter: brightness(2); } 100% { transform: scale(0.6) rotate(80deg); opacity: 0; } }

/* ─── METAL ──────────────────────────────────────────────────────── */
.met-crack line { stroke-dasharray: 80; stroke-dashoffset: 80; animation: met-crack 0.45s ease-out forwards; }
.met-crack line:nth-child(1) { animation-delay: 0.00s; }
.met-crack line:nth-child(2) { animation-delay: 0.04s; }
.met-crack line:nth-child(3) { animation-delay: 0.08s; }
.met-crack line:nth-child(4) { animation-delay: 0.12s; }
.met-crack line:nth-child(5) { animation-delay: 0.06s; }
.met-crack line:nth-child(6) { animation-delay: 0.10s; }
.met-crack line:nth-child(7) { animation-delay: 0.14s; }
.met-crack line:nth-child(8) { animation-delay: 0.16s; }
.met-shards .shard { transform-origin: 50% 50%; transform-box: fill-box; animation: met-shard 0.55s ease-out forwards; opacity: 0; }
.met-shards .shard.mshd1 { animation-delay: 0.18s; }
.met-shards .shard.mshd2 { animation-delay: 0.20s; }
.met-shards .shard.mshd3 { animation-delay: 0.22s; }
.met-shards .shard.mshd4 { animation-delay: 0.24s; }
.met-shards .shard.mshd5 { animation-delay: 0.26s; }
.met-shards .shard.mshd6 { animation-delay: 0.28s; }
.met-shards .shard.mshd7 { animation-delay: 0.30s; }
.met-shards .shard.mshd8 { animation-delay: 0.32s; }
.met-core { transform-origin: 50% 50%; animation: met-core 0.55s 0.08s ease-out forwards; }
@keyframes met-crack { 0% { stroke-dashoffset: 80; opacity: 0; } 30% { stroke-dashoffset: 0; opacity: 1; filter: brightness(2.5); } 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes met-shard { 0% { transform: scale(0); opacity: 0; } 45% { transform: scale(1.2); opacity: 1; filter: brightness(2); } 100% { transform: scale(0.8); opacity: 0; } }
@keyframes met-core  { 0% { transform: scale(0); opacity: 0; } 40% { transform: scale(1.4); opacity: 1; filter: brightness(3) drop-shadow(0 0 14px var(--c)); } 100% { transform: scale(0.5); opacity: 0; } }

/* ─── SOUL ───────────────────────────────────────────────────────── */
.soul-ghost  { transform-origin: 50% 50%; animation: soul-rise 0.95s ease-out forwards; }
.soul-eyes   { animation: soul-eyes 0.85s 0.15s ease-out forwards; opacity: 0; }
.soul-mouth  { animation: soul-eyes 0.85s 0.20s ease-out forwards; opacity: 0; }
.soul-wisps .wisp-thread { stroke-dasharray: 40; stroke-dashoffset: 40; animation: soul-wisp 0.85s 0.10s ease-out forwards; }
.soul-wisps .wisp-mote   { transform-origin: center; transform-box: fill-box; animation: soul-mote 0.7s 0.40s ease-out forwards; opacity: 0; }
@keyframes soul-rise { 0% { transform: translateY(12px) scale(0.7); opacity: 0; filter: brightness(1); } 30% { transform: translateY(0)    scale(1.05); opacity: 1; filter: brightness(2) drop-shadow(0 0 14px var(--c)); } 100% { transform: translateY(-16px) scale(0.95); opacity: 0; } }
@keyframes soul-eyes { 0% { opacity: 0; } 40% { opacity: 1; } 100% { opacity: 0; } }
@keyframes soul-wisp { 0% { stroke-dashoffset: 40; opacity: 0; } 40% { stroke-dashoffset: 0; opacity: 0.9; } 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes soul-mote { 0% { transform: translateY(6px) scale(0); opacity: 0; } 40% { transform: translateY(0) scale(1.4); opacity: 1; } 100% { transform: translateY(-14px) scale(0.6); opacity: 0; } }

/* ─── SOUND ──────────────────────────────────────────────────────── */
.sonic-ring { transform-origin: 50% 50%; animation: sonic-ring 1.0s ease-out forwards; opacity: 0; }
.sonic-ring.snr1 { animation-delay: 0.00s; }
.sonic-ring.snr2 { animation-delay: 0.10s; }
.sonic-ring.snr3 { animation-delay: 0.22s; }
.sonic-ring.snr4 { animation-delay: 0.34s; }
.sonic-cone { transform-origin: 50% 50%; animation: sonic-cone-pulse 0.85s ease-out forwards; }
.sonic-core { transform-origin: 50% 50%; transform-box: fill-box; animation: sonic-core-pulse 0.85s ease-out forwards; }
@keyframes sonic-ring       { 0% { transform: scale(0.2); opacity: 1; stroke-width: 4; } 50% { opacity: 0.9; } 100% { transform: scale(3.4); opacity: 0; stroke-width: 1; } }
@keyframes sonic-cone-pulse { 0% { transform: scale(0.6); opacity: 0; } 30% { transform: scale(1.1); opacity: 1; filter: brightness(2.5); } 100% { transform: scale(1.4); opacity: 0; } }
@keyframes sonic-core-pulse { 0% { transform: scale(0); opacity: 0; } 40% { transform: scale(1.6); opacity: 1; filter: brightness(3) drop-shadow(0 0 14px var(--c)); } 70% { transform: scale(1); opacity: 0.8; } 100% { transform: scale(1.3); opacity: 0; } }

/* ─── CHAOS ──────────────────────────────────────────────────────── */
.chaos-glitch { animation: chaos-shake 0.5s ease-in-out infinite; }
.chaos-frac polyline { stroke-dasharray: 100; stroke-dashoffset: 100; animation: chaos-frac-draw 0.55s ease-out forwards; }
.chaos-frac polyline:nth-child(1) { animation-delay: 0.00s; }
.chaos-frac polyline:nth-child(2) { animation-delay: 0.06s; }
.chaos-frac polyline:nth-child(3) { animation-delay: 0.12s; }
.chaos-frac polyline:nth-child(4) { animation-delay: 0.18s; }
.chaos-frags .cfrag { transform-origin: 50% 50%; transform-box: fill-box; animation: chaos-frag 0.65s ease-out forwards; opacity: 0; }
.chaos-frags .cfrag.cf1 { animation-delay: 0.20s; }
.chaos-frags .cfrag.cf2 { animation-delay: 0.22s; }
.chaos-frags .cfrag.cf3 { animation-delay: 0.24s; }
.chaos-frags .cfrag.cf4 { animation-delay: 0.26s; }
.chaos-glitch-a { transform-origin: 50% 50%; transform-box: fill-box; animation: chaos-glitch-a 0.85s ease-out forwards; }
.chaos-glitch-b { transform-origin: 50% 50%; transform-box: fill-box; animation: chaos-glitch-b 0.85s ease-out forwards; }
.chaos-glitch-c { transform-origin: 50% 50%; transform-box: fill-box; animation: chaos-glitch-c 0.85s ease-out forwards; }
@keyframes chaos-shake     { 0%,100% { transform: translate(0,0); } 25% { transform: translate(-1px,1px); } 50% { transform: translate(1px,-1px); } 75% { transform: translate(-1px,-1px); } }
@keyframes chaos-frac-draw { 0% { stroke-dashoffset: 100; opacity: 0; } 30% { stroke-dashoffset: 0; opacity: 1; filter: brightness(2); } 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes chaos-frag      { 0% { transform: scale(0) rotate(0); opacity: 0; } 50% { transform: scale(1.3) rotate(45deg); opacity: 1; filter: brightness(2); } 100% { transform: scale(0.8) rotate(80deg); opacity: 0; } }
@keyframes chaos-glitch-a  { 0% { transform: scale(0.3) rotate(0); opacity: 0; } 35% { transform: scale(1.2) rotate(15deg); opacity: 1; } 100% { transform: scale(0.6) rotate(40deg); opacity: 0; } }
@keyframes chaos-glitch-b  { 0% { transform: scale(0.3) translateX(0) rotate(0); opacity: 0; } 35% { transform: scale(1.1) translateX(-2px) rotate(-10deg); opacity: 0.7; } 100% { transform: scale(0.6) translateX(-5px) rotate(-30deg); opacity: 0; } }
@keyframes chaos-glitch-c  { 0% { transform: scale(0.3) translateX(0) rotate(0); opacity: 0; } 35% { transform: scale(1.1) translateX(2px)  rotate(10deg);  opacity: 0.5; } 100% { transform: scale(0.6) translateX(5px)  rotate(30deg);  opacity: 0; } }

/* ════════════════════════════════════════════════════════════════════
   REVAMPED CSS for revamped SVGs (shadow, gravity, energy, wind, blood,
   void, poison, counter). Holy-beam-style cinematic motion: bloom
   backdrops that flash + dissipate, layered cores that pulse, secondary
   elements (tendrils, streaks, rays, drips, debris) animating with
   stagger so the burst reads as a charge → peak → dissipate cycle.
   ════════════════════════════════════════════════════════════════════ */

/* ─── SHADOW (revamp) ────────────────────────────────────────────── */
.sh-bloom { transform-origin: 50% 50%; animation: sh-bloom 0.85s ease-out forwards; opacity: 0; }
.sh-core  { transform-origin: 50% 50%; animation: sh-core  0.85s ease-out forwards; }
.sh-eye   { transform-origin: 50% 50%; transform-box: fill-box; animation: sh-eye 0.85s ease-out forwards; opacity: 0; }
.sh-tnd   { stroke-dasharray: 70; stroke-dashoffset: 70; animation: sh-tnd 0.55s ease-out forwards; }
.sh-tendrils .st1 { animation-delay: 0.15s; }
.sh-tendrils .st2 { animation-delay: 0.18s; }
.sh-tendrils .st3 { animation-delay: 0.21s; }
.sh-tendrils .st4 { animation-delay: 0.24s; }
.sh-tendrils .st5 { animation-delay: 0.27s; }
.sh-tendrils .st6 { animation-delay: 0.30s; }
.sh-drip  { transform-origin: center; transform-box: fill-box; animation: sh-drip 0.7s 0.35s ease-in forwards; opacity: 0; }
.sd2 { animation-delay: 0.42s; }
.sd3 { animation-delay: 0.48s; }
@keyframes sh-bloom { 0% { opacity: 0; transform: scale(0.3); } 25% { opacity: 0.6; transform: scale(1.4); } 100% { opacity: 0; transform: scale(2.4); } }
@keyframes sh-core  { 0% { transform: scale(0); opacity: 0; filter: brightness(3); } 30% { transform: scale(1.2); opacity: 1; filter: brightness(1.6) drop-shadow(0 0 14px var(--c)); } 70% { transform: scale(1); opacity: 0.9; } 100% { transform: scale(0.85); opacity: 0; } }
@keyframes sh-eye   { 0% { opacity: 0; } 30% { opacity: 1; filter: brightness(2.5) drop-shadow(0 0 5px var(--c)); } 100% { opacity: 0; } }
@keyframes sh-tnd   { 0% { stroke-dashoffset: 70; opacity: 0; } 40% { stroke-dashoffset: 0; opacity: 0.95; } 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes sh-drip  { 0% { transform: translateY(0) scale(0); opacity: 0; } 30% { transform: translateY(2px) scale(1.1); opacity: 0.9; } 100% { transform: translateY(16px) scale(0.5); opacity: 0; } }

/* ─── GRAVITY (revamp) ───────────────────────────────────────────── */
.gv-bloom { transform-origin: 50% 50%; animation: gv-bloom 0.9s ease-out forwards; opacity: 0; }
.gv-ring  { transform-origin: 50% 50%; }
.gv-r1    { animation: gv-implode 0.85s        ease-in forwards; }
.gv-r2    { animation: gv-implode 0.85s 0.08s  ease-in forwards; }
.gv-r3    { animation: gv-implode 0.85s 0.16s  ease-in forwards; }
.gv-st    { stroke-dasharray: 60; stroke-dashoffset: 60; animation: gv-streak 0.55s 0.10s ease-in forwards; }
.gv-streaks line:nth-of-type(2) { animation-delay: 0.14s; }
.gv-streaks line:nth-of-type(3) { animation-delay: 0.18s; }
.gv-streaks line:nth-of-type(4) { animation-delay: 0.22s; }
.gv-streaks line:nth-of-type(5) { animation-delay: 0.26s; }
.gv-streaks line:nth-of-type(6) { animation-delay: 0.30s; }
.gv-streaks line:nth-of-type(7) { animation-delay: 0.34s; }
.gv-streaks line:nth-of-type(8) { animation-delay: 0.38s; }
.gv-debris { transform-origin: center; transform-box: fill-box; animation: gv-suck 0.85s 0.10s ease-in forwards; }
.gd2 { animation-delay: 0.14s; }
.gd3 { animation-delay: 0.18s; }
.gd4 { animation-delay: 0.22s; }
.gd5 { animation-delay: 0.26s; }
.gd6 { animation-delay: 0.30s; }
.gv-core { transform-origin: 50% 50%; animation: gv-core 0.85s ease-out forwards; }
@keyframes gv-bloom   { 0% { opacity: 0; transform: scale(0.3); } 20% { opacity: 0.6; transform: scale(1.3); } 100% { opacity: 0; transform: scale(0.4); } }
@keyframes gv-implode { 0% { transform: scale(1.4); opacity: 0; } 30% { transform: scale(1); opacity: 1; filter: brightness(2); } 100% { transform: scale(0.2); opacity: 0; } }
@keyframes gv-streak  { 0% { stroke-dashoffset: 60; opacity: 0; } 50% { stroke-dashoffset: 0; opacity: 1; filter: brightness(2); } 100% { stroke-dashoffset: 0; opacity: 0; } }
.gd1 { --tx: 36px; --ty: 28px; }
.gd2 { --tx: -36px; --ty: 28px; }
.gd3 { --tx: 36px; --ty: -28px; }
.gd4 { --tx: -36px; --ty: -28px; }
.gd5 { --tx: 0px;  --ty: 42px; }
.gd6 { --tx: -42px; --ty: 0px; }
@keyframes gv-suck    { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { transform: translate(var(--tx, 0), var(--ty, 0)) scale(0); opacity: 0; } }
@keyframes gv-core    { 0% { transform: scale(0); opacity: 0; filter: brightness(1); } 35% { transform: scale(1.4); opacity: 1; filter: brightness(4) drop-shadow(0 0 20px var(--c)); } 100% { transform: scale(0.7); opacity: 0; } }

/* ─── ENERGY (revamp) ────────────────────────────────────────────── */
.en-bloom { transform-origin: 50% 50%; animation: sh-bloom 0.85s ease-out forwards; opacity: 0; }
.en-ring  { transform-origin: 50% 50%; }
.en-rA    { animation: en-spin-cw  0.95s linear forwards; }
.en-rB    { animation: en-spin-ccw 0.95s linear forwards; }
.en-fork  { stroke-dasharray: 80; stroke-dashoffset: 80; animation: en-fork 0.55s ease-out forwards; }
.ef1 { animation-delay: 0.10s; }
.ef2 { animation-delay: 0.14s; }
.ef3 { animation-delay: 0.18s; }
.ef4 { animation-delay: 0.22s; }
.ef5 { animation-delay: 0.26s; }
.ef6 { animation-delay: 0.30s; }
.en-core  { transform-origin: 50% 50%; animation: en-core-pulse 0.85s ease-out forwards; }
.en-spark { transform-origin: center; transform-box: fill-box; animation: spark-pop 0.5s 0.40s ease-out forwards; opacity: 0; }
.es2 { animation-delay: 0.44s; }
.es3 { animation-delay: 0.48s; }
.es4 { animation-delay: 0.52s; }
.es5 { animation-delay: 0.56s; }
.es6 { animation-delay: 0.60s; }
@keyframes en-spin-cw   { 0% { transform: rotate(0); opacity: 0; } 20% { opacity: 1; } 100% { transform: rotate(360deg); opacity: 0; } }
@keyframes en-spin-ccw  { 0% { transform: rotate(0); opacity: 0; } 20% { opacity: 1; } 100% { transform: rotate(-360deg); opacity: 0; } }
@keyframes en-fork      { 0% { stroke-dashoffset: 80; opacity: 0; } 35% { stroke-dashoffset: 0; opacity: 1; filter: brightness(2.5); } 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes en-core-pulse{ 0% { transform: scale(0); opacity: 0; } 30% { transform: scale(1.5); opacity: 1; filter: brightness(3) drop-shadow(0 0 20px var(--c)); } 60% { transform: scale(1.1); opacity: 0.9; } 100% { transform: scale(0.7); opacity: 0; } }

/* ─── WIND (revamp) ──────────────────────────────────────────────── */
.wn-bloom { transform-origin: 50% 50%; animation: sh-bloom 0.85s ease-out forwards; opacity: 0; }
.wn-wl    { stroke-dasharray: 110; stroke-dashoffset: 110; animation: wn-blow 0.55s ease-out forwards; }
.wl1 { animation-delay: 0.00s; }
.wl2 { animation-delay: 0.06s; }
.wl3 { animation-delay: 0.10s; }
.wl4 { animation-delay: 0.16s; }
.wl5 { animation-delay: 0.22s; }
.wn-vortex { transform-origin: 50% 50%; animation: wn-vortex 0.9s ease-out forwards; }
.wn-mote   { transform-origin: center; transform-box: fill-box; animation: wn-mote 0.6s 0.18s ease-out forwards; opacity: 0; }
.wm2 { animation-delay: 0.22s; }
.wm3 { animation-delay: 0.26s; }
.wm4 { animation-delay: 0.30s; }
.wm5 { animation-delay: 0.34s; }
@keyframes wn-blow   { 0% { stroke-dashoffset: 110; opacity: 0; } 35% { stroke-dashoffset: 0; opacity: 1; } 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes wn-vortex { 0% { transform: scale(0.3) rotate(0); opacity: 0; } 30% { transform: scale(1.1) rotate(180deg); opacity: 1; } 100% { transform: scale(0.9) rotate(540deg); opacity: 0; } }
@keyframes wn-mote   { 0% { transform: translateX(-30px) scale(0); opacity: 0; } 40% { transform: translateX(0) scale(1.3); opacity: 1; } 100% { transform: translateX(20px) scale(0.5); opacity: 0; } }

/* ─── BLOOD (revamp) ─────────────────────────────────────────────── */
.bl-bloom { transform-origin: 50% 50%; animation: sh-bloom 0.85s ease-out forwards; opacity: 0; }
.bl-splat { transform-origin: 50% 50%; animation: bl-splat 0.85s ease-out forwards; opacity: 0; }
.bl-core  { transform-origin: 50% 50%; animation: bl-core 0.85s ease-out forwards; }
.bl-d     { transform-origin: 50% 50%; transform-box: fill-box; animation: bl-spray 0.55s ease-out forwards; opacity: 0; }
.bd1 { animation-delay: 0.12s; }
.bd2 { animation-delay: 0.14s; }
.bd3 { animation-delay: 0.16s; }
.bd4 { animation-delay: 0.18s; }
.bd5 { animation-delay: 0.20s; }
.bd6 { animation-delay: 0.22s; }
.bd7 { animation-delay: 0.24s; }
.bd8 { animation-delay: 0.26s; }
.bl-dot { transform-origin: center; transform-box: fill-box; animation: bl-dot 0.5s 0.32s ease-out forwards; opacity: 0; }
@keyframes bl-splat { 0% { transform: scale(0.2); opacity: 0; } 30% { transform: scale(1.1); opacity: 0.85; } 100% { transform: scale(1.25); opacity: 0; } }
@keyframes bl-core  { 0% { transform: scale(0); opacity: 0; } 25% { transform: scale(1.3); opacity: 1; filter: brightness(2) drop-shadow(0 0 14px var(--c)); } 100% { transform: scale(0.9); opacity: 0; } }
@keyframes bl-spray { 0% { transform: translate(0,0) scale(0); opacity: 0; } 40% { transform: translate(0,0) scale(1.4); opacity: 1; filter: brightness(1.6); } 100% { transform: translate(0,0) scale(1) translateY(8px); opacity: 0; } }
@keyframes bl-dot   { 0% { transform: scale(0); opacity: 0; } 50% { transform: scale(1.8); opacity: 1; } 100% { transform: scale(0.6); opacity: 0; } }

/* ─── VOID (revamp) ──────────────────────────────────────────────── */
.vd-bloom { transform-origin: 50% 50%; animation: sh-bloom 0.95s ease-out forwards; opacity: 0; }
.vd-ring  { transform-origin: 50% 50%; }
.vr1 { animation: gv-implode 0.95s 0.00s ease-in forwards; }
.vr2 { animation: gv-implode 0.95s 0.08s ease-in forwards; }
.vr3 { animation: gv-implode 0.95s 0.16s ease-in forwards; }
.vr4 { animation: gv-implode 0.95s 0.24s ease-in forwards; }
.vd-cr    { stroke-dasharray: 110; stroke-dashoffset: 110; animation: vd-crack 0.5s ease-out forwards; }
.vd-cracks polyline:nth-child(1) { animation-delay: 0.15s; }
.vd-cracks polyline:nth-child(2) { animation-delay: 0.20s; }
.vd-cracks polyline:nth-child(3) { animation-delay: 0.25s; }
.vd-cracks polyline:nth-child(4) { animation-delay: 0.30s; }
.vd-tnd   { stroke-dasharray: 90; stroke-dashoffset: 90; animation: vd-tnd 0.55s 0.25s ease-out forwards; }
.vt2 { animation-delay: 0.28s; }
.vd-core  { transform-origin: 50% 50%; animation: en-core-pulse 0.95s ease-out forwards; }
.vd-deb   { transform-origin: center; transform-box: fill-box; }
.vd-deb.vd1 { --tx: 32px;  --ty: 28px; }
.vd-deb.vd2 { --tx: -32px; --ty: 28px; }
.vd-deb.vd3 { --tx: -32px; --ty: -28px; }
.vd-deb.vd4 { --tx: 32px;  --ty: -28px; }
.vd-deb { animation: gv-suck 0.95s 0.10s ease-in forwards; }
@keyframes vd-crack { 0% { stroke-dashoffset: 110; opacity: 0; } 30% { stroke-dashoffset: 0; opacity: 1; filter: brightness(2); } 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes vd-tnd   { 0% { stroke-dashoffset: 90; opacity: 0; } 35% { stroke-dashoffset: 0; opacity: 1; filter: brightness(1.8); } 100% { stroke-dashoffset: 0; opacity: 0; } }

/* ─── POISON (revamp) ────────────────────────────────────────────── */
.ps-bloom { transform-origin: 50% 50%; animation: sh-bloom 0.9s ease-out forwards; opacity: 0; }
.ps-cloud { transform-origin: 50% 50%; animation: ps-cloud 0.9s ease-out forwards; }
.ps-skull { transform-origin: 50% 50%; animation: ps-skull 0.9s ease-out forwards; }
.ps-bub   { transform-origin: 50% 50%; transform-box: fill-box; animation: ps-bubble 0.7s ease-out forwards; opacity: 0; }
.ps-bub.pb1 { animation-delay: 0.10s; }
.ps-bub.pb2 { animation-delay: 0.16s; }
.ps-bub.pb3 { animation-delay: 0.22s; }
.ps-bub.pb4 { animation-delay: 0.28s; }
.ps-drip  { transform-origin: center; transform-box: fill-box; animation: ps-drip 0.65s ease-in forwards; opacity: 0; }
.pd1 { animation-delay: 0.28s; }
.pd2 { animation-delay: 0.34s; }
.pd3 { animation-delay: 0.40s; }
.pd4 { animation-delay: 0.46s; }
@keyframes ps-cloud  { 0% { transform: scale(0.3); opacity: 0; } 30% { transform: scale(1.15); opacity: 0.95; filter: brightness(1.4); } 70% { transform: scale(1); opacity: 0.85; } 100% { transform: scale(1.1); opacity: 0; } }
@keyframes ps-skull  { 0% { transform: scale(0); opacity: 0; filter: brightness(0.5); } 35% { transform: scale(1.2); opacity: 1; filter: brightness(2); } 70% { transform: scale(1); opacity: 0.9; } 100% { transform: scale(0.9); opacity: 0; } }
@keyframes ps-bubble { 0% { transform: scale(0); opacity: 0; } 40% { transform: scale(1.4); opacity: 1; } 100% { transform: scale(0.7); opacity: 0; } }
@keyframes ps-drip   { 0% { transform: translateY(0) scale(0.6); opacity: 0; } 25% { transform: translateY(2px) scale(1.1); opacity: 1; } 100% { transform: translateY(14px) scale(0.5); opacity: 0; } }

/* ─── COUNTER (revamp) ───────────────────────────────────────────── */
.ct-bloom   { transform-origin: 50% 50%; animation: sh-bloom 0.85s ease-out forwards; opacity: 0; }
.ct-mirror  { transform-origin: 50% 50%; animation: ct-mirror 0.85s ease-out forwards; }
.ct-rebound { transform-origin: 50% 50%; animation: ct-rebound 0.85s ease-out forwards; }
.ct-ray     { stroke-dasharray: 80; stroke-dashoffset: 80; animation: ct-ray 0.45s 0.20s ease-out forwards; }
.ct-rebound .ct1 { animation-delay: 0.20s; }
.ct-rebound .ct2 { animation-delay: 0.22s; }
.ct-rebound .ct3 { animation-delay: 0.24s; }
.ct-rebound .ct4 { animation-delay: 0.26s; }
.ct-rebound .ct5 { animation-delay: 0.28s; }
.ct-rebound .ct6 { animation-delay: 0.30s; }
.ct-rebound .ct7 { animation-delay: 0.32s; }
.ct-rebound .ct8 { animation-delay: 0.34s; }
.ct-flash   { transform-origin: 50% 50%; animation: ct-flash 0.85s ease-out forwards; }
@keyframes ct-mirror { 0% { transform: scale(0); opacity: 0; filter: brightness(4); } 25% { transform: scale(1.15); opacity: 1; filter: brightness(2.5) drop-shadow(0 0 18px var(--c)); } 60% { transform: scale(1); opacity: 0.85; } 100% { transform: scale(0.95); opacity: 0; } }
@keyframes ct-rebound{ 0% { opacity: 1; } 100% { opacity: 0; } }
@keyframes ct-ray    { 0% { stroke-dashoffset: 80; opacity: 0; } 35% { stroke-dashoffset: 0; opacity: 1; filter: brightness(3); } 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes ct-flash  { 0% { transform: scale(0); opacity: 0; } 25% { transform: scale(1.5); opacity: 1; filter: brightness(5) drop-shadow(0 0 24px var(--c)); } 60% { transform: scale(1); opacity: 0.9; } 100% { transform: scale(0.7); opacity: 0; } }

/* ─── FIRE (4-band revamp) ─────────────────────────────────────────
   Visual identity: expansion, heat, eruption. Four distinct stories:
     small  (F–D)  → ember projectile + quick engulf
     medium (C–A)  → spiral orbit → directional detonation
     large  (S–SSS)→ falling meteor + layered shockwaves + flame column
     epic   (GOD)  → overhead sun → inward gather → collapse → solar eruption
   ─────────────────────────────────────────────────────────────── */

/* ── SMALL (F–D) ──────────────────────────────────────────────── */
.fi-s-streak { transform-origin: 50% 60%; animation: fi-s-streak 0.30s ease-out forwards; opacity: 0; }
.fi-s-burst  { transform-origin: 50% 60%; animation: fi-s-burst  0.55s 0.18s ease-out forwards; opacity: 0; }
.fi-s-tongue { transform-origin: 50% 60%; transform-box: fill-box; transform: rotate(var(--rot)) scaleY(0); opacity: 0;
               animation: fi-s-tongue 0.45s ease-out forwards; }
.fi-s-scorch { transform-origin: 50% 80%; animation: fi-s-scorch 0.70s 0.16s ease-out forwards; opacity: 0; }
.fi-s-emb    { transform-origin: center; transform-box: fill-box; animation: fi-s-emb 0.55s ease-out forwards; opacity: 0; }
@keyframes fi-s-streak { 0% { transform: translateX(-120%) scaleX(0.6); opacity: 0; } 60% { transform: translateX(0) scaleX(1.2); opacity: 1; filter: brightness(2.5); } 100% { transform: translateX(0) scaleX(1); opacity: 0; } }
@keyframes fi-s-burst  { 0% { transform: scale(0); opacity: 0; filter: brightness(4); } 30% { transform: scale(1.25); opacity: 1; filter: brightness(2.4) drop-shadow(0 0 12px var(--c)); } 70% { transform: scale(1); opacity: 0.85; } 100% { transform: scale(1.4); opacity: 0; } }
@keyframes fi-s-tongue { 0% { transform: rotate(var(--rot)) scaleY(0); opacity: 0; } 45% { transform: rotate(var(--rot)) scaleY(1.15); opacity: 1; filter: brightness(2); } 100% { transform: rotate(var(--rot)) scaleY(0.85); opacity: 0; } }
@keyframes fi-s-scorch { 0% { transform: scale(0); opacity: 0; } 40% { transform: scale(1.1); opacity: 0.7; } 100% { transform: scale(1.25); opacity: 0; } }
@keyframes fi-s-emb    { 0% { transform: translateY(0) scale(0); opacity: 0; } 30% { transform: translateY(-8px) scale(1.4); opacity: 1; filter: brightness(2.5); } 100% { transform: translateY(-26px) scale(0.4); opacity: 0; } }

/* ── MEDIUM (C–A) ─────────────────────────────────────────────── */
.fi-m-haze   { transform-origin: 50% 55%; animation: fi-m-haze 0.95s ease-out forwards; opacity: 0; }
.fi-m-orbit  { transform-origin: 50% 55%; animation: fi-m-orbit 0.50s ease-in forwards; }
.fi-m-petal  { transform-origin: 50% 55%; animation: fi-m-petal 0.55s ease-out forwards; animation-delay: var(--delay); opacity: 0; }
.fi-m-deton  { transform-origin: 50% 55%; animation: fi-m-deton 0.45s 0.42s ease-out forwards; opacity: 0; }
.fi-m-shock  { transform-origin: 50% 55%; animation: fi-m-shock 0.55s 0.42s ease-out forwards; }
.fi-m-tongue { transform-origin: 50% 55%; transform-box: fill-box; transform: rotate(var(--rot)) scaleY(0); opacity: 0; animation: fi-m-tongue 0.45s ease-out forwards; }
.fi-m-scorch { transform-origin: 50% 88%; animation: fi-m-scorch 0.85s 0.40s ease-out forwards; opacity: 0; }
.fi-m-emb    { transform-origin: center; transform-box: fill-box; animation: fi-m-emb 0.55s ease-out forwards; opacity: 0; }
@keyframes fi-m-haze   { 0% { transform: scale(0.5); opacity: 0; } 50% { transform: scale(1.15); opacity: 0.65; } 100% { transform: scale(1.35); opacity: 0; } }
@keyframes fi-m-orbit  { 0% { transform: rotate(0deg) scale(0.5); opacity: 0; } 60% { transform: rotate(180deg) scale(1.0); opacity: 1; } 100% { transform: rotate(280deg) scale(0.6); opacity: 0.7; } }
@keyframes fi-m-petal  { 0% { transform: scale(0.4); opacity: 0; filter: brightness(2); } 40% { transform: scale(1.2); opacity: 1; filter: brightness(1.8) drop-shadow(0 0 6px var(--c)); } 100% { transform: scale(0.4); opacity: 0; } }
@keyframes fi-m-deton  { 0% { transform: scale(0); opacity: 0; filter: brightness(5); } 30% { transform: scale(1.4); opacity: 1; filter: brightness(2.8) drop-shadow(0 0 22px var(--c)); } 100% { transform: scale(2.0); opacity: 0; } }
@keyframes fi-m-shock  { 0% { transform: scale(0.3); opacity: 0; } 30% { transform: scale(1.2); opacity: 1; } 100% { transform: scale(3.5); opacity: 0; } }
@keyframes fi-m-tongue { 0% { transform: rotate(var(--rot)) scaleY(0); opacity: 0; } 45% { transform: rotate(var(--rot)) scaleY(1.25); opacity: 1; filter: brightness(2.2); } 100% { transform: rotate(var(--rot)) scaleY(0.85); opacity: 0; } }
@keyframes fi-m-scorch { 0% { transform: scale(0); opacity: 0; } 35% { transform: scale(1.15); opacity: 0.75; } 100% { transform: scale(1.35); opacity: 0; } }
@keyframes fi-m-emb    { 0% { transform: translate(0,0) scale(0); opacity: 0; } 30% { transform: translate(calc(var(--dx) * 0.4), calc(var(--dy) * 0.4)) scale(1.4); opacity: 1; filter: brightness(2.5); } 100% { transform: translate(var(--dx), var(--dy)) scale(0.3); opacity: 0; } }

/* ── LARGE (S–SSS) ────────────────────────────────────────────── */
.fi-l-sky    { transform-origin: 50% -140%; animation: fi-l-sky 0.40s ease-out forwards; opacity: 0; }
.fi-l-trail  { stroke-dasharray: 220; stroke-dashoffset: 220; animation: fi-l-trail 0.30s 0.10s ease-in forwards; opacity: 0; }
.fi-l-meteor { transform-origin: 50% 60%; animation: fi-l-meteor 0.42s ease-in forwards; opacity: 0; }
.fi-l-shock  { transform-origin: 50% 62%; animation: fi-l-shock 0.65s ease-out forwards; }
.fi-l-s1 { animation-delay: 0.40s; }
.fi-l-s2 { animation-delay: 0.46s; }
.fi-l-s3 { animation-delay: 0.52s; }
.fi-l-pillar { transform-origin: 50% 100%; animation: fi-l-pillar 0.65s 0.42s ease-out forwards; opacity: 0; }
.fi-l-scorch { transform-origin: 50% 94%; animation: fi-l-scorch 0.85s 0.40s ease-out forwards; opacity: 0; }
.fi-l-emb    { transform-origin: center; transform-box: fill-box; animation: fi-l-emb 0.70s ease-out forwards; opacity: 0; }
@keyframes fi-l-sky    { 0% { transform: scale(0); opacity: 0; } 50% { transform: scale(1.1); opacity: 0.7; } 100% { transform: scale(1.3); opacity: 0; } }
@keyframes fi-l-trail  { 0% { stroke-dashoffset: 220; opacity: 0; } 30% { stroke-dashoffset: 0; opacity: 1; filter: brightness(3); } 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes fi-l-meteor { 0% { transform: translateY(-220%) scale(0.6); opacity: 0; filter: brightness(3); } 60% { transform: translateY(-30%) scale(1.1); opacity: 1; filter: brightness(2.5) drop-shadow(0 0 18px var(--c)); } 90% { transform: translateY(0) scale(1.2); opacity: 1; } 100% { transform: translateY(0) scale(0); opacity: 0; } }
@keyframes fi-l-shock  { 0% { transform: scale(0.3); opacity: 0; } 25% { transform: scale(1.2); opacity: 1; } 100% { transform: scale(5.0); opacity: 0; } }
@keyframes fi-l-pillar { 0% { transform: scaleY(0.1) scaleX(0.7); opacity: 0; filter: brightness(3); } 25% { transform: scaleY(1.2) scaleX(1.1); opacity: 1; filter: brightness(2.4) drop-shadow(0 0 20px var(--c)); } 70% { transform: scaleY(1.05) scaleX(1); opacity: 0.95; } 100% { transform: scaleY(0.9) scaleX(0.85) translateY(-18%); opacity: 0; } }
@keyframes fi-l-scorch { 0% { transform: scale(0); opacity: 0; } 30% { transform: scale(1.15); opacity: 0.8; } 100% { transform: scale(1.4); opacity: 0; } }
@keyframes fi-l-emb    { 0% { transform: translate(0,0) scale(0); opacity: 0; } 25% { transform: translate(calc(var(--dx) * 0.3), calc(var(--dy) * 0.3)) scale(1.5); opacity: 1; filter: brightness(2.8); } 100% { transform: translate(var(--dx), var(--dy)) scale(0.3); opacity: 0; } }

/* ── EPIC (GOD) ───────────────────────────────────────────────── */
.fi-g-darken   { animation: fi-g-darken 1.0s ease-out forwards; }
.fi-g-sun      { transform-origin: 50% -30%; animation: fi-g-sun 0.55s ease-out forwards; opacity: 0; }
.fi-g-flare    { transform-origin: 50% -30%; transform-box: fill-box; transform: rotate(var(--rot)) scaleY(0); opacity: 0; animation: fi-g-flare 0.45s ease-out forwards; }
.fi-g-stream   { stroke-dasharray: 320; stroke-dashoffset: 320; animation: fi-g-stream 0.35s ease-in forwards; }
.fi-g-collapse { transform-origin: 50% -30%; animation: fi-g-collapse 0.30s 0.50s ease-out forwards; opacity: 0; }
.fi-g-erupt    { transform-origin: 50% 50%; animation: fi-g-erupt 0.65s 0.58s ease-out forwards; }
.fi-g-e1 { animation-delay: 0.58s; }
.fi-g-e2 { animation-delay: 0.64s; }
.fi-g-e3 { animation-delay: 0.70s; }
.fi-g-inferno  { transform-origin: 50% 50%; animation: fi-g-inferno 0.45s 0.60s ease-out forwards; opacity: 0; }
.fi-g-column   { transform-origin: 50% 50%; transform-box: fill-box; transform: rotate(var(--rot)) scaleY(0); opacity: 0; animation: fi-g-column 0.55s ease-out forwards; }
.fi-g-scorch   { transform-origin: 50% 100%; animation: fi-g-scorch 0.55s 0.60s ease-out forwards; opacity: 0; }
.fi-g-emb      { transform-origin: center; transform-box: fill-box; animation: fi-g-emb 0.85s ease-out forwards; opacity: 0; }
@keyframes fi-g-darken   { 0% { opacity: 0; } 35% { opacity: 0.4; } 75% { opacity: 0.2; } 100% { opacity: 0; } }
@keyframes fi-g-sun      { 0% { transform: scale(0); opacity: 0; filter: brightness(4); } 50% { transform: scale(1.1); opacity: 1; filter: brightness(3) drop-shadow(0 0 36px var(--c)); } 100% { transform: scale(0.85); opacity: 0; filter: brightness(6); } }
@keyframes fi-g-flare    { 0% { transform: rotate(var(--rot)) scaleY(0); opacity: 0; } 50% { transform: rotate(var(--rot)) scaleY(1.25); opacity: 1; filter: brightness(2.5); } 100% { transform: rotate(var(--rot)) scaleY(0.6); opacity: 0; } }
@keyframes fi-g-stream   { 0% { stroke-dashoffset: 320; opacity: 0; } 50% { stroke-dashoffset: 0; opacity: 1; filter: brightness(2.5); } 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes fi-g-collapse { 0% { transform: scale(0.3); opacity: 0; } 40% { transform: scale(1.6); opacity: 1; filter: brightness(8) drop-shadow(0 0 60px #fff); } 100% { transform: scale(0); opacity: 0; } }
@keyframes fi-g-erupt    { 0% { transform: scale(0.2); opacity: 0; } 20% { transform: scale(1.5); opacity: 1; filter: brightness(3); } 100% { transform: scale(14); opacity: 0; } }
@keyframes fi-g-inferno  { 0% { transform: scale(0); opacity: 0; filter: brightness(6); } 30% { transform: scale(1.3); opacity: 1; filter: brightness(3) drop-shadow(0 0 60px var(--c)); } 100% { transform: scale(1.6); opacity: 0; } }
@keyframes fi-g-column   { 0% { transform: rotate(var(--rot)) scaleY(0); opacity: 0; filter: brightness(3); } 40% { transform: rotate(var(--rot)) scaleY(1.4); opacity: 1; filter: brightness(2.5) drop-shadow(0 0 24px var(--c)); } 100% { transform: rotate(var(--rot)) scaleY(1.0); opacity: 0; } }
@keyframes fi-g-scorch   { 0% { transform: scale(0); opacity: 0; } 35% { transform: scale(1.1); opacity: 0.85; } 100% { transform: scale(1.3); opacity: 0; } }
@keyframes fi-g-emb      { 0% { transform: translate(0,0) scale(0); opacity: 0; } 25% { transform: translate(calc(var(--dx) * 0.3), calc(var(--dy) * 0.3)) scale(1.6); opacity: 1; filter: brightness(3); } 100% { transform: translate(var(--dx), var(--dy)) scale(0.3); opacity: 0; } }

/* Camera-coupled cataclysm shake for GOD-tier fire only — paired with
   the global .fx-grade-god shake so the screen punches harder. */
.fire-band-epic { animation: fi-g-cataclysm 0.55s 0.55s cubic-bezier(0.36,0.07,0.19,0.97) both; }
@keyframes fi-g-cataclysm { 0%, 100% { transform: translate(0,0); } 15% { transform: translate(-3px, 2px); } 30% { transform: translate(3px, -3px); } 45% { transform: translate(-2px, -2px); } 60% { transform: translate(2px, 3px); } 75% { transform: translate(-3px, 1px); } 90% { transform: translate(2px, -1px); } }

/* ─── ICE (4-band revamp) ──────────────────────────────────────── */
/* SMALL (F–D) */
.ic-s-flake  { transform-origin: 50% 50%; animation: ic-s-flake 0.45s ease-out forwards; opacity: 0; }
.ic-s-burst  { transform-origin: 50% 50%; animation: ic-s-burst 0.55s 0.20s ease-out forwards; opacity: 0; }
.ic-s-ring   { transform-origin: 50% 50%; animation: ic-s-ring 0.50s 0.18s ease-out forwards; }
.ic-s-shard  { transform-origin: 50% 50%; transform-box: fill-box; transform: rotate(var(--rot)) scaleY(0); opacity: 0; animation: ic-s-shard 0.45s ease-out forwards; }
@keyframes ic-s-flake { 0% { transform: translateX(-100%) rotate(0deg) scale(0.5); opacity: 0; } 60% { transform: translateX(0) rotate(540deg) scale(1.2); opacity: 1; filter: brightness(2); } 100% { transform: translateX(0) rotate(720deg) scale(1); opacity: 0; } }
@keyframes ic-s-burst { 0% { transform: scale(0); opacity: 0; filter: brightness(4); } 35% { transform: scale(1.3); opacity: 1; filter: brightness(2.4) drop-shadow(0 0 12px var(--c)); } 100% { transform: scale(1.6); opacity: 0; } }
@keyframes ic-s-ring  { 0% { transform: scale(0.3); opacity: 0; } 30% { transform: scale(1.2); opacity: 1; } 100% { transform: scale(2.5); opacity: 0; } }
@keyframes ic-s-shard { 0% { transform: rotate(var(--rot)) scaleY(0); opacity: 0; } 45% { transform: rotate(var(--rot)) scaleY(1.3); opacity: 1; filter: brightness(2); } 100% { transform: rotate(var(--rot)) scaleY(0.8); opacity: 0; } }

/* MEDIUM (C–A) */
.ic-m-haze   { transform-origin: 50% 55%; animation: ic-m-haze 0.85s ease-out forwards; opacity: 0; }
.ic-m-flake  { transform-origin: var(--cx) var(--cy); animation: ic-m-flake 0.55s var(--delay) ease-out forwards; opacity: 0; }
.ic-m-spike  { transform-origin: 50% 92%; transform-box: fill-box; transform: scaleY(0); opacity: 0; animation: ic-m-spike 0.40s ease-out forwards; }
.ic-m-flash  { transform-origin: 50% 55%; animation: ic-m-flash 0.45s 0.32s ease-out forwards; opacity: 0; }
.ic-m-ring   { transform-origin: 50% 55%; animation: ic-m-ring 0.55s 0.32s ease-out forwards; }
@keyframes ic-m-haze  { 0% { transform: scale(0.5); opacity: 0; } 50% { transform: scale(1.15); opacity: 0.7; } 100% { transform: scale(1.4); opacity: 0; } }
@keyframes ic-m-flake { 0% { transform: rotate(0deg) scale(0.4); opacity: 0; } 50% { transform: rotate(360deg) scale(1.4); opacity: 1; filter: brightness(2); } 100% { transform: rotate(540deg) scale(0.8); opacity: 0; } }
@keyframes ic-m-spike { 0% { transform: scaleY(0); opacity: 0; } 50% { transform: scaleY(1.3); opacity: 1; filter: brightness(1.8); } 100% { transform: scaleY(1); opacity: 0; } }
@keyframes ic-m-flash { 0% { transform: scale(0); opacity: 0; filter: brightness(5); } 35% { transform: scale(1.4); opacity: 1; filter: brightness(3); } 100% { transform: scale(1.8); opacity: 0; } }
@keyframes ic-m-ring  { 0% { transform: scale(0.3); opacity: 0; } 30% { transform: scale(1.2); opacity: 1; } 100% { transform: scale(3.5); opacity: 0; } }

/* LARGE (S–SSS) — keeps existing animations + adds sigil + spike */
.ic-bloom    { transform-origin: 50% 50%; animation: sh-bloom 0.85s ease-out forwards; opacity: 0; }
.ic-l-sigil  { transform-origin: 50% 0%; animation: ic-l-sigil 0.55s ease-out forwards; opacity: 0; }
.ic-rays .ic-ry { stroke-dasharray: 50; stroke-dashoffset: 50; animation: ic-ray-grow 0.45s ease-out forwards; }
.ic-l-spike  { transform-origin: 50% 50%; transform-box: fill-box; transform: scale(0); opacity: 0; animation: ic-l-spike 0.50s ease-out forwards; }
.ic-core     { transform-origin: 50% 50%; animation: ic-core-pop 0.50s 0.20s ease-out forwards; opacity: 0; }
.ic-frost    { transform-origin: center; transform-box: fill-box; animation: ic-frost-rise 0.85s ease-out forwards; opacity: 0; }
.ic-frost:nth-child(2n) { animation-delay: 0.30s; }
.ic-frost:nth-child(3n) { animation-delay: 0.42s; }
@keyframes ic-l-sigil  { 0% { transform: translateY(-50%) scale(0.5); opacity: 0; } 50% { transform: translateY(0) scale(1); opacity: 1; filter: brightness(2) drop-shadow(0 0 16px var(--c)); } 100% { transform: translateY(10%) scale(1.1); opacity: 0; } }
@keyframes ic-ray-grow { 0% { stroke-dashoffset: 50; opacity: 0; } 40% { stroke-dashoffset: 0; opacity: 1; filter: brightness(2); } 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes ic-l-spike  { 0% { transform: scale(0); opacity: 0; } 50% { transform: scale(1.05); opacity: 1; filter: brightness(2); } 100% { transform: scale(1); opacity: 0; } }
@keyframes ic-core-pop { 0% { transform: scale(0) rotate(0deg); opacity: 0; filter: brightness(4); } 50% { transform: scale(1.3) rotate(45deg); opacity: 1; filter: brightness(2.5) drop-shadow(0 0 16px var(--c)); } 100% { transform: scale(1) rotate(90deg); opacity: 0; } }
@keyframes ic-frost-rise { 0% { transform: translateY(0) scale(0); opacity: 0; } 40% { transform: translateY(-6px) scale(1.4); opacity: 1; filter: brightness(2); } 100% { transform: translateY(-20px) scale(0.5); opacity: 0; } }

/* EPIC (GOD) */
.ic-g-pallor   { animation: ic-g-pallor 1.0s ease-out forwards; }
.ic-g-star     { transform-origin: 50% -30%; animation: ic-g-star 0.55s ease-out forwards; opacity: 0; }
.ic-g-ray      { transform-origin: 50% -40%; transform-box: fill-box; transform: rotate(var(--rot)); animation: ic-g-ray 0.45s ease-out forwards; }
.ic-g-collapse { transform-origin: 50% -30%; animation: ic-g-collapse 0.30s 0.50s ease-out forwards; opacity: 0; }
.ic-g-shock    { transform-origin: 50% 50%; animation: ic-g-shock 0.65s 0.55s ease-out forwards; }
.ic-g-s1 { animation-delay: 0.55s; }
.ic-g-s2 { animation-delay: 0.62s; }
.ic-g-s3 { animation-delay: 0.69s; }
.ic-g-spike    { transform-origin: 50% 50%; transform-box: fill-box; transform: scale(0); opacity: 0; animation: ic-g-spike 0.55s ease-out forwards; }
.ic-g-core     { transform-origin: 50% 50%; animation: ic-g-core 0.45s 0.55s ease-out forwards; opacity: 0; }
.ic-g-flake    { transform-origin: center; transform-box: fill-box; animation: ic-g-flake 0.85s ease-out forwards; opacity: 0; }
.ice-band-epic { animation: ic-g-quake 0.55s 0.55s cubic-bezier(0.36,0.07,0.19,0.97) both; }
@keyframes ic-g-pallor   { 0% { opacity: 0; } 35% { opacity: 0.3; } 100% { opacity: 0; } }
@keyframes ic-g-star     { 0% { transform: scale(0); opacity: 0; filter: brightness(4); } 50% { transform: scale(1.1); opacity: 1; filter: brightness(3) drop-shadow(0 0 36px var(--c)); } 100% { transform: scale(0.85); opacity: 0; filter: brightness(6); } }
@keyframes ic-g-ray      { 0% { transform: rotate(var(--rot)) scaleY(0); opacity: 0; } 50% { transform: rotate(var(--rot)) scaleY(1.25); opacity: 1; filter: brightness(2.5); } 100% { transform: rotate(var(--rot)) scaleY(0.6); opacity: 0; } }
@keyframes ic-g-collapse { 0% { transform: scale(0.3); opacity: 0; } 40% { transform: scale(1.6); opacity: 1; filter: brightness(8) drop-shadow(0 0 60px #fff); } 100% { transform: scale(0); opacity: 0; } }
@keyframes ic-g-shock    { 0% { transform: scale(0.2); opacity: 0; } 20% { transform: scale(1.5); opacity: 1; filter: brightness(3); } 100% { transform: scale(14); opacity: 0; } }
@keyframes ic-g-spike    { 0% { transform: scale(0); opacity: 0; } 40% { transform: scale(1.05); opacity: 1; filter: brightness(2.5) drop-shadow(0 0 20px var(--c)); } 100% { transform: scale(1); opacity: 0; } }
@keyframes ic-g-core     { 0% { transform: scale(0) rotate(0deg); opacity: 0; filter: brightness(5); } 40% { transform: scale(1.4) rotate(60deg); opacity: 1; filter: brightness(3); } 100% { transform: scale(1.6) rotate(180deg); opacity: 0; } }
@keyframes ic-g-flake    { 0% { transform: translate(0,0) scale(0); opacity: 0; } 25% { transform: translate(calc(var(--dx) * 0.3), calc(var(--dy) * 0.3)) scale(1.5); opacity: 1; filter: brightness(2.5); } 100% { transform: translate(var(--dx), var(--dy)) scale(0.4); opacity: 0; } }
@keyframes ic-g-quake    { 0%, 100% { transform: translate(0,0); } 20% { transform: translate(-2px, 1px); } 40% { transform: translate(2px, -2px); } 60% { transform: translate(-2px, -1px); } 80% { transform: translate(1px, 2px); } }

/* ─── LIGHTNING (4-band revamp) ────────────────────────────────── */
/* SMALL (F–D) */
.lit-s-sky        { transform-origin: 50% -120%; animation: lit-s-sky 0.30s ease-out forwards; opacity: 0; }
.lit-s-bolt-glow  { stroke-dasharray: 320; stroke-dashoffset: 320; animation: lit-s-bolt-glow 0.30s 0.05s ease-out forwards; }
.lit-s-bolt-main  { stroke-dasharray: 320; stroke-dashoffset: 320; animation: lit-s-bolt-main 0.30s 0.07s ease-out forwards; }
.lit-s-bolt-core  { stroke-dasharray: 320; stroke-dashoffset: 320; animation: lit-s-bolt-core 0.30s 0.09s ease-out forwards; }
.lit-s-shock      { transform-origin: 50% 72%; animation: lit-s-shock 0.45s 0.18s ease-out forwards; }
.lit-s-flash      { transform-origin: 50% 72%; animation: lit-s-flash 0.30s 0.18s ease-out forwards; }
.lit-s-spark      { transform-origin: center; transform-box: fill-box; animation: lit-s-spark 0.45s ease-out forwards; opacity: 0; }
@keyframes lit-s-sky       { 0% { transform: scale(0); opacity: 0; } 50% { transform: scale(1.1); opacity: 0.7; } 100% { transform: scale(1.3); opacity: 0; } }
@keyframes lit-s-bolt-glow { 0% { stroke-dashoffset: 320; opacity: 0; } 50% { stroke-dashoffset: 0; opacity: 1; } 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes lit-s-bolt-main { 0% { stroke-dashoffset: 320; opacity: 0; } 50% { stroke-dashoffset: 0; opacity: 1; filter: brightness(3); } 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes lit-s-bolt-core { 0% { stroke-dashoffset: 320; opacity: 0; } 50% { stroke-dashoffset: 0; opacity: 1; filter: brightness(4); } 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes lit-s-shock     { 0% { transform: scale(0.2); opacity: 0; } 35% { transform: scale(1.3); opacity: 1; } 100% { transform: scale(2.5); opacity: 0; } }
@keyframes lit-s-flash     { 0% { transform: scale(0); opacity: 0; filter: brightness(4); } 50% { transform: scale(1.4); opacity: 1; filter: brightness(2.5) drop-shadow(0 0 16px var(--c)); } 100% { transform: scale(0); opacity: 0; } }
@keyframes lit-s-spark     { 0% { transform: scale(0); opacity: 0; } 40% { transform: scale(1.5); opacity: 1; filter: brightness(2.5); } 100% { transform: scale(0.4); opacity: 0; } }

/* MEDIUM (C–A) — chain lightning */
.lit-m-chain     { stroke-dasharray: 80; stroke-dashoffset: 80; animation: lit-m-chain 0.45s ease-out forwards; }
.lit-m-ball      { transform-origin: 50% 50%; animation: lit-m-ball 0.55s 0.16s ease-out forwards; }
.lit-m-ball-core { transform-origin: 50% 50%; animation: lit-m-ball-core 0.55s 0.16s ease-out forwards; }
.lit-m-fork      { transform-origin: 50% 50%; transform-box: fill-box; transform: rotate(var(--rot)) scaleY(0); animation: lit-m-fork 0.40s ease-out forwards; }
.lit-m-haze      { transform-origin: 50% 50%; animation: lit-m-haze 0.85s ease-out forwards; opacity: 0; }
@keyframes lit-m-chain     { 0% { stroke-dashoffset: 80; opacity: 0; } 40% { stroke-dashoffset: 0; opacity: 1; filter: brightness(3); } 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes lit-m-ball      { 0% { transform: scale(0); opacity: 0; } 40% { transform: scale(1.3); opacity: 1; filter: brightness(3) drop-shadow(0 0 20px var(--c)); } 100% { transform: scale(0.8); opacity: 0; } }
@keyframes lit-m-ball-core { 0% { transform: scale(0); opacity: 0; } 40% { transform: scale(1.4); opacity: 1; filter: brightness(5); } 100% { transform: scale(0.7); opacity: 0; } }
@keyframes lit-m-fork      { 0% { transform: rotate(var(--rot)) scaleY(0); opacity: 0; } 50% { transform: rotate(var(--rot)) scaleY(1.4); opacity: 1; filter: brightness(2.5); } 100% { transform: rotate(var(--rot)) scaleY(0.8); opacity: 0; } }
@keyframes lit-m-haze      { 0% { transform: scale(0.5); opacity: 0; } 50% { transform: scale(1.2); opacity: 0.6; } 100% { transform: scale(1.4); opacity: 0; } }

/* LARGE (S–SSS) — three simultaneous strikes */
.lit-l-sky       { transform-origin: 50% -160%; animation: lit-l-sky 0.40s ease-out forwards; opacity: 0; }
.lit-l-bolt-glow { stroke-dasharray: 400; stroke-dashoffset: 400; animation: lit-l-bolt-glow 0.35s 0.10s ease-out forwards; }
.lit-l-bolt-main { stroke-dasharray: 400; stroke-dashoffset: 400; animation: lit-l-bolt-main 0.35s 0.12s ease-out forwards; }
.lit-l-bolt-core { stroke-dasharray: 400; stroke-dashoffset: 400; animation: lit-l-bolt-core 0.35s 0.14s ease-out forwards; }
.lit-l-b2-d { animation-delay: 0.08s; }
.lit-l-b3-d { animation-delay: 0.16s; }
.lit-l-shock-a   { transform-origin: 50% 76%; animation: lit-l-shock 0.55s 0.32s ease-out forwards; }
.lit-l-shock-b   { transform-origin: 50% 76%; animation: lit-l-shock 0.55s 0.36s ease-out forwards; }
.lit-l-spark     { transform-origin: center; transform-box: fill-box; animation: lit-l-spark 0.55s ease-out forwards; opacity: 0; }
@keyframes lit-l-sky       { 0% { transform: scale(0); opacity: 0; } 50% { transform: scale(1.15); opacity: 0.75; } 100% { transform: scale(1.3); opacity: 0; } }
@keyframes lit-l-bolt-glow { 0% { stroke-dashoffset: 400; opacity: 0; } 50% { stroke-dashoffset: 0; opacity: 1; } 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes lit-l-bolt-main { 0% { stroke-dashoffset: 400; opacity: 0; } 50% { stroke-dashoffset: 0; opacity: 1; filter: brightness(3); } 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes lit-l-bolt-core { 0% { stroke-dashoffset: 400; opacity: 0; } 50% { stroke-dashoffset: 0; opacity: 1; filter: brightness(5); } 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes lit-l-shock     { 0% { transform: scale(0.3); opacity: 0; } 25% { transform: scale(1.2); opacity: 1; } 100% { transform: scale(4); opacity: 0; } }
@keyframes lit-l-spark     { 0% { transform: translate(0,0) scale(0); opacity: 0; } 25% { transform: translate(calc(var(--dx) * 0.3), calc(var(--dy) * 0.3)) scale(1.5); opacity: 1; filter: brightness(2.5); } 100% { transform: translate(var(--dx), var(--dy)) scale(0.4); opacity: 0; } }

/* EPIC (GOD) — storm apocalypse */
.lit-g-strobe       { animation: lit-g-strobe 0.95s ease-out forwards; }
.lit-g-cloud        { transform-origin: 50% -100%; animation: lit-g-cloud 0.55s ease-out forwards; }
.lit-g-cloud-d      { transform-origin: 50% -100%; animation: lit-g-cloud 0.55s 0.04s ease-out forwards; }
.lit-g-strike-glow  { stroke-dasharray: 400; stroke-dashoffset: 400; animation: lit-g-strike-glow 0.30s ease-out forwards; }
.lit-g-strike-main  { stroke-dasharray: 400; stroke-dashoffset: 400; animation: lit-g-strike-main 0.30s ease-out forwards; }
.lit-g-charge       { transform-origin: 50% 50%; animation: lit-g-charge 0.85s 0.30s ease-out forwards; }
.lit-g-shock        { transform-origin: 50% 50%; animation: lit-g-shock 0.75s ease-out forwards; }
.lit-g-sh1 { animation-delay: 0.32s; }
.lit-g-sh2 { animation-delay: 0.40s; }
.lit-g-mote         { transform-origin: center; transform-box: fill-box; animation: lit-g-mote 0.75s ease-out forwards; opacity: 0; }
.lit-band-epic      { animation: lit-g-shake 0.55s 0.20s cubic-bezier(0.36,0.07,0.19,0.97) both; }
@keyframes lit-g-strobe      { 0% { opacity: 0; } 10% { opacity: 0.6; } 20% { opacity: 0; } 30% { opacity: 0.5; } 40% { opacity: 0; } 60% { opacity: 0.35; } 100% { opacity: 0; } }
@keyframes lit-g-cloud       { 0% { transform: scale(0.5); opacity: 0; } 50% { transform: scale(1.15); opacity: 0.85; } 100% { transform: scale(1.3); opacity: 0; } }
@keyframes lit-g-strike-glow { 0% { stroke-dashoffset: 400; opacity: 0; } 40% { stroke-dashoffset: 0; opacity: 0.9; } 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes lit-g-strike-main { 0% { stroke-dashoffset: 400; opacity: 0; } 40% { stroke-dashoffset: 0; opacity: 1; filter: brightness(5); } 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes lit-g-charge      { 0% { transform: scale(0.5); opacity: 0; } 40% { transform: scale(1.2); opacity: 0.7; filter: brightness(2); } 100% { transform: scale(1.4); opacity: 0; } }
@keyframes lit-g-shock       { 0% { transform: scale(0.2); opacity: 0; } 20% { transform: scale(1.5); opacity: 1; filter: brightness(3); } 100% { transform: scale(14); opacity: 0; } }
@keyframes lit-g-mote        { 0% { transform: translate(0,0) scale(0); opacity: 0; } 25% { transform: translate(calc(var(--dx) * 0.3), calc(var(--dy) * 0.3)) scale(1.5); opacity: 1; filter: brightness(3); } 100% { transform: translate(var(--dx), var(--dy)) scale(0.4); opacity: 0; } }
@keyframes lit-g-shake       { 0%, 100% { transform: translate(0,0); } 15% { transform: translate(-3px, 1px); } 30% { transform: translate(2px, -3px); } 45% { transform: translate(-2px, -2px); } 60% { transform: translate(3px, 2px); } 75% { transform: translate(-3px, 2px); } }

/* ─── WIND (4-band revamp) ─────────────────────────────────────── */
/* SMALL (F–D) — single blade */
.wn-s-blade-glow { stroke-dasharray: 200; stroke-dashoffset: 200; animation: wn-s-blade-glow 0.35s ease-out forwards; }
.wn-s-blade      { stroke-dasharray: 200; stroke-dashoffset: 200; animation: wn-s-blade 0.30s 0.04s ease-out forwards; }
.wn-s-blade-core { stroke-dasharray: 200; stroke-dashoffset: 200; animation: wn-s-blade 0.30s 0.07s ease-out forwards; }
.wn-s-slip       { animation: wn-s-slip 0.35s ease-out forwards; }
.wn-s-mote       { transform-origin: center; transform-box: fill-box; animation: wn-s-mote 0.35s ease-out forwards; opacity: 0; }
@keyframes wn-s-blade-glow { 0% { stroke-dashoffset: 200; opacity: 0; } 50% { stroke-dashoffset: 0; opacity: 1; } 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes wn-s-blade      { 0% { stroke-dashoffset: 200; opacity: 0; } 50% { stroke-dashoffset: 0; opacity: 1; filter: brightness(2); } 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes wn-s-slip       { 0% { transform: translateX(-30px); opacity: 0; } 60% { transform: translateX(0); opacity: 0.9; } 100% { transform: translateX(0); opacity: 0; } }
@keyframes wn-s-mote       { 0% { transform: translateX(-12px) scale(0); opacity: 0; } 40% { transform: translateX(0) scale(1.3); opacity: 1; } 100% { transform: translateX(8px) scale(0.6); opacity: 0; } }

/* MEDIUM (C–A) — spiral gusts */
.wn-m-haze { transform-origin: 50% 50%; animation: wn-m-haze 0.85s ease-out forwards; opacity: 0; }
.wn-m-arc  { transform-origin: 50% 50%; transform-box: fill-box; transform: rotate(var(--rot)) scale(0); opacity: 0; animation: wn-m-arc 0.55s ease-out forwards; }
.wn-m-cut  { animation: wn-m-cut 0.40s ease-out forwards; }
.wn-m-eye  { transform-origin: 50% 50%; animation: wn-m-eye 0.85s ease-in-out forwards; }
@keyframes wn-m-haze { 0% { transform: scale(0.5); opacity: 0; } 50% { transform: scale(1.1); opacity: 0.55; } 100% { transform: scale(1.3); opacity: 0; } }
@keyframes wn-m-arc  { 0% { transform: rotate(var(--rot)) scale(0); opacity: 0; } 40% { transform: rotate(calc(var(--rot) + 30deg)) scale(1.1); opacity: 1; filter: brightness(2); } 100% { transform: rotate(calc(var(--rot) + 60deg)) scale(1); opacity: 0; } }
@keyframes wn-m-cut  { 0% { transform: scale(0.3); opacity: 0; } 40% { transform: scale(1); opacity: 1; filter: brightness(2.5); } 100% { transform: scale(1); opacity: 0; } }
@keyframes wn-m-eye  { 0% { transform: rotate(0deg); opacity: 0; } 50% { transform: rotate(360deg); opacity: 1; } 100% { transform: rotate(720deg); opacity: 0; } }

/* LARGE (S–SSS) — colossal tornado */
.wn-l-funnel { transform-origin: 50% 90%; animation: wn-l-funnel 0.85s ease-out forwards; opacity: 0; }
.wn-l-debris { transform-origin: center; transform-box: fill-box; animation: wn-l-debris 0.75s ease-out forwards; opacity: 0; }
.wn-l-shock  { transform-origin: 50% 94%; animation: wn-l-shock 0.55s 0.20s ease-out forwards; }
.wn-l-dust   { transform-origin: 50% 94%; animation: wn-l-dust 0.85s ease-out forwards; opacity: 0; }
@keyframes wn-l-funnel { 0% { transform: scaleY(0.2) scaleX(0.5); opacity: 0; } 35% { transform: scaleY(1.05) scaleX(1.1); opacity: 0.95; filter: brightness(1.4) drop-shadow(0 0 20px var(--c)); } 80% { transform: scaleY(1) scaleX(1) rotate(8deg); opacity: 0.9; } 100% { transform: scaleY(0.95) scaleX(0.95) rotate(-6deg); opacity: 0; } }
@keyframes wn-l-debris { 0% { transform: translate(0,0) rotate(0deg) scale(0); opacity: 0; } 30% { transform: translate(calc(var(--dx) * 0.4), calc(var(--dy) * 0.4)) rotate(180deg) scale(1.4); opacity: 1; filter: brightness(2); } 100% { transform: translate(var(--dx), var(--dy)) rotate(540deg) scale(0.5); opacity: 0; } }
@keyframes wn-l-shock  { 0% { transform: scale(0.3); opacity: 0; } 35% { transform: scale(1.2); opacity: 1; } 100% { transform: scale(3); opacity: 0; } }
@keyframes wn-l-dust   { 0% { transform: scale(0); opacity: 0; } 40% { transform: scale(1.2); opacity: 0.85; } 100% { transform: scale(1.5); opacity: 0; } }

/* EPIC (GOD) — hurricane apocalypse */
.wn-g-warp    { animation: wn-g-warp 0.95s ease-out forwards; }
.wn-g-tornado { transform-origin: 50% 120%; animation: wn-g-tornado 0.95s ease-out forwards; opacity: 0; }
.wn-g-shock   { transform-origin: 50% 80%; animation: wn-g-shock 0.75s ease-out forwards; }
.wn-g-sh1 { animation-delay: 0.40s; }
.wn-g-sh2 { animation-delay: 0.55s; }
.wn-g-sh3 { animation-delay: 0.70s; }
.wn-g-debris  { transform-origin: center; transform-box: fill-box; animation: wn-g-debris 0.85s ease-out forwards; opacity: 0; }
.wn-g-slip    { stroke-dasharray: 600; stroke-dashoffset: 600; animation: wn-g-slip 0.55s ease-out forwards; }
.wn-band-epic { animation: wn-g-shake 0.55s 0.30s cubic-bezier(0.36,0.07,0.19,0.97) both; }
@keyframes wn-g-warp    { 0% { opacity: 0; } 40% { opacity: 0.4; } 100% { opacity: 0; } }
@keyframes wn-g-tornado { 0% { transform: scaleY(0.2) scaleX(0.4) rotate(0deg); opacity: 0; } 40% { transform: scaleY(1.05) scaleX(1.1) rotate(12deg); opacity: 0.9; filter: brightness(1.4) drop-shadow(0 0 28px var(--c)); } 80% { transform: scaleY(1) scaleX(1) rotate(-10deg); opacity: 0.95; } 100% { transform: scaleY(0.95) scaleX(0.95) rotate(20deg); opacity: 0; } }
@keyframes wn-g-shock   { 0% { transform: scale(0.2); opacity: 0; } 20% { transform: scale(1.5); opacity: 1; filter: brightness(2.5); } 100% { transform: scale(12); opacity: 0; } }
@keyframes wn-g-debris  { 0% { transform: translate(0,0) rotate(0deg) scale(0); opacity: 0; } 25% { transform: translate(calc(var(--dx) * 0.3), calc(var(--dy) * 0.3)) rotate(180deg) scale(1.5); opacity: 1; filter: brightness(2); } 100% { transform: translate(var(--dx), var(--dy)) rotate(720deg) scale(0.4); opacity: 0; } }
@keyframes wn-g-slip    { 0% { stroke-dashoffset: 600; opacity: 0; } 60% { stroke-dashoffset: 0; opacity: 0.9; } 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes wn-g-shake   { 0%, 100% { transform: translate(0,0); } 25% { transform: translate(-3px, 2px); } 50% { transform: translate(3px, -2px); } 75% { transform: translate(-2px, 3px); } }

/* ─── EARTH (4-band revamp) ────────────────────────────────────── */
/* SMALL (F–D) */
.er-s-ground { transform-origin: 50% 88%; animation: er-s-ground 0.30s ease-out forwards; opacity: 0; }
.er-s-crack  { stroke-dasharray: 60; stroke-dashoffset: 60; animation: er-s-crack 0.40s ease-out forwards; }
.er-s-spike  { transform-origin: center 88%; transform-box: fill-box; transform: scaleY(0); opacity: 0; animation: er-s-spike 0.40s ease-out forwards; }
.er-s-chip   { transform-origin: center; transform-box: fill-box; animation: er-s-chip 0.45s ease-out forwards; opacity: 0; }
@keyframes er-s-ground { 0% { transform: scaleX(0); opacity: 0; } 60% { transform: scaleX(1.1); opacity: 1; } 100% { transform: scaleX(1); opacity: 0.8; } }
@keyframes er-s-crack  { 0% { stroke-dashoffset: 60; opacity: 0; } 50% { stroke-dashoffset: 0; opacity: 1; } 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes er-s-spike  { 0% { transform: scaleY(0); opacity: 0; } 50% { transform: scaleY(1.2); opacity: 1; filter: brightness(1.5); } 100% { transform: scaleY(1); opacity: 0; } }
@keyframes er-s-chip   { 0% { transform: translateY(0) rotate(0deg); opacity: 0; } 40% { transform: translateY(-12px) rotate(90deg); opacity: 1; } 100% { transform: translateY(-24px) rotate(180deg); opacity: 0; } }

/* MEDIUM (C–A) — boulders + spike row */
.er-m-bloom    { transform-origin: 50% 88%; animation: sh-bloom 0.85s ease-out forwards; opacity: 0; }
.er-m-crack    { stroke-dasharray: 120; stroke-dashoffset: 120; animation: er-m-crack 0.45s ease-out forwards; }
.er-m-boulder  { transform-origin: var(--bx) 50%; animation: er-m-boulder 0.35s ease-in forwards; opacity: 0; }
.er-m-bdust    { transform-origin: 50% 88%; animation: er-m-bdust 0.45s ease-out forwards; }
.er-m-spike    { transform-origin: center 88%; transform-box: fill-box; transform: scaleY(0); opacity: 0; animation: er-m-spike 0.45s ease-out forwards; }
@keyframes er-m-crack   { 0% { stroke-dashoffset: 120; opacity: 0; } 50% { stroke-dashoffset: 0; opacity: 1; filter: brightness(1.5); } 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes er-m-boulder { 0% { transform: translateY(-220%) scale(0.6); opacity: 0; } 60% { transform: translateY(-30%) scale(1.1); opacity: 1; filter: brightness(1.4); } 100% { transform: translateY(50%) scale(1); opacity: 0; } }
@keyframes er-m-bdust   { 0% { transform: scale(0); opacity: 0; } 40% { transform: scale(1.3); opacity: 0.8; } 100% { transform: scale(1.6); opacity: 0; } }
@keyframes er-m-spike   { 0% { transform: scaleY(0); opacity: 0; } 50% { transform: scaleY(1.2); opacity: 1; filter: brightness(1.8) drop-shadow(0 0 8px var(--c)); } 100% { transform: scaleY(1); opacity: 0; } }

/* LARGE (S–SSS) — titanic pillars */
.er-l-bloom   { transform-origin: 50% 88%; animation: sh-bloom 0.85s ease-out forwards; opacity: 0; }
.er-l-crack   { stroke-dasharray: 200; stroke-dashoffset: 200; animation: er-l-crack 0.55s ease-out forwards; }
.er-l-pillar  { transform-origin: center 88%; transform-box: fill-box; transform: scaleY(0); opacity: 0; animation: er-l-pillar 0.55s ease-out forwards; }
.er-l-shock   { transform-origin: 50% 88%; animation: er-l-shock 0.65s 0.20s ease-out forwards; }
.er-l-boulder { transform-origin: center; transform-box: fill-box; animation: er-l-boulder 0.65s ease-out forwards; opacity: 0; }
.er-l-dustcol { transform-origin: 50% 88%; animation: er-l-dustcol 0.85s 0.20s ease-out forwards; }
@keyframes er-l-crack   { 0% { stroke-dashoffset: 200; opacity: 0; } 45% { stroke-dashoffset: 0; opacity: 1; filter: brightness(1.6); } 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes er-l-pillar  { 0% { transform: scaleY(0); opacity: 0; filter: brightness(2); } 50% { transform: scaleY(1.15); opacity: 1; filter: brightness(1.6) drop-shadow(0 0 16px var(--c)); } 100% { transform: scaleY(1); opacity: 0; } }
@keyframes er-l-shock   { 0% { transform: scale(0.3); opacity: 0; } 25% { transform: scale(1.2); opacity: 1; } 100% { transform: scale(4.5); opacity: 0; } }
@keyframes er-l-boulder { 0% { transform: translate(0,0) rotate(0deg) scale(0); opacity: 0; } 30% { transform: translate(calc(var(--dx) * 0.4), calc(var(--dy) * 0.4)) rotate(180deg) scale(1.3); opacity: 1; } 100% { transform: translate(var(--dx), var(--dy)) rotate(450deg) scale(0.5); opacity: 0; } }
@keyframes er-l-dustcol { 0% { transform: scale(0.3); opacity: 0; } 50% { transform: scale(1.2); opacity: 0.85; } 100% { transform: scale(1.5); opacity: 0; } }

/* EPIC (GOD) — mountain crash */
.er-g-darken   { animation: er-g-darken 0.95s ease-out forwards; }
.er-g-mountain { transform-origin: 50% 0%; animation: er-g-mountain 0.55s ease-in forwards; opacity: 0; }
.er-g-crack    { stroke-dasharray: 400; stroke-dashoffset: 400; animation: er-g-crack 0.55s ease-out forwards; }
.er-g-shock    { transform-origin: 50% 100%; animation: er-g-shock 0.75s ease-out forwards; }
.er-g-sh1 { animation-delay: 0.55s; }
.er-g-sh2 { animation-delay: 0.62s; }
.er-g-sh3 { animation-delay: 0.69s; }
.er-g-dust     { transform-origin: 50% 90%; animation: er-g-dust 0.95s 0.50s ease-out forwards; }
.er-g-rock     { transform-origin: center; transform-box: fill-box; animation: er-g-rock 0.85s ease-out forwards; opacity: 0; }
.er-band-epic  { animation: er-g-quake 0.55s 0.50s cubic-bezier(0.36,0.07,0.19,0.97) both; }
@keyframes er-g-darken   { 0% { opacity: 0; } 35% { opacity: 0.5; } 75% { opacity: 0.3; } 100% { opacity: 0; } }
@keyframes er-g-mountain { 0% { transform: translateY(-100%) scale(0.6); opacity: 0; } 70% { transform: translateY(20%) scale(1); opacity: 1; } 100% { transform: translateY(40%) scale(1.1); opacity: 0; } }
@keyframes er-g-crack    { 0% { stroke-dashoffset: 400; opacity: 0; } 50% { stroke-dashoffset: 0; opacity: 1; filter: brightness(1.6); } 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes er-g-shock    { 0% { transform: scale(0.2); opacity: 0; } 20% { transform: scale(1.5); opacity: 1; filter: brightness(2); } 100% { transform: scale(12); opacity: 0; } }
@keyframes er-g-dust     { 0% { transform: scale(0); opacity: 0; } 45% { transform: scale(1.2); opacity: 0.85; } 100% { transform: scale(1.5); opacity: 0; } }
@keyframes er-g-rock     { 0% { transform: translate(0,0) rotate(0deg) scale(0); opacity: 0; } 25% { transform: translate(calc(var(--dx) * 0.3), calc(var(--dy) * 0.3)) rotate(180deg) scale(1.4); opacity: 1; filter: brightness(1.6); } 100% { transform: translate(var(--dx), var(--dy)) rotate(720deg) scale(0.5); opacity: 0; } }
@keyframes er-g-quake    { 0%, 100% { transform: translate(0,0); } 12% { transform: translate(-5px, 3px); } 24% { transform: translate(5px, -4px); } 36% { transform: translate(-4px, -3px); } 48% { transform: translate(4px, 4px); } 60% { transform: translate(-5px, 2px); } 72% { transform: translate(3px, -2px); } 84% { transform: translate(-2px, 3px); } }

@media (prefers-reduced-motion: reduce) {
  .fire-band-epic, .ice-band-epic, .lit-band-epic, .wn-band-epic, .er-band-epic { animation: none; }
  .fi-g-darken, .ic-g-pallor, .lit-g-strobe, .er-g-darken, .wn-g-warp { animation: none; opacity: 0; }
}

/* ─── NATURE (revamp) ────────────────────────────────────────────── */
.nt-bloom         { transform-origin: 50% 50%; animation: sh-bloom 0.85s ease-out forwards; opacity: 0; }
.nt-vines .nt-vn  { stroke-dasharray: 60; stroke-dashoffset: 60; animation: nt-vine 0.5s ease-out forwards; }
.nt-vines .nv1 { animation-delay: 0.05s; }
.nt-vines .nv2 { animation-delay: 0.08s; }
.nt-vines .nv3 { animation-delay: 0.11s; }
.nt-vines .nv4 { animation-delay: 0.14s; }
.nt-vines .nv5 { animation-delay: 0.17s; }
.nt-vines .nv6 { animation-delay: 0.20s; }
.nt-vines .nv7 { animation-delay: 0.23s; }
.nt-vines .nv8 { animation-delay: 0.26s; }
.nt-ferns .nt-l { transform-origin: center; transform-box: fill-box; animation: nt-fern 0.55s ease-out forwards; opacity: 0; }
.nt-ferns .nl1 { animation-delay: 0.32s; }
.nt-ferns .nl2 { animation-delay: 0.34s; }
.nt-ferns .nl3 { animation-delay: 0.36s; }
.nt-ferns .nl4 { animation-delay: 0.38s; }
.nt-ferns .nl5 { animation-delay: 0.40s; }
.nt-ferns .nl6 { animation-delay: 0.42s; }
.nt-ferns .nl7 { animation-delay: 0.44s; }
.nt-ferns .nl8 { animation-delay: 0.46s; }
.nt-bloom-flower  { transform-origin: 50% 50%; animation: nt-flower 0.85s 0.15s ease-out forwards; }
.nt-pol           { transform-origin: center; transform-box: fill-box; animation: nt-pol 0.7s 0.45s ease-out forwards; opacity: 0; }
.nt-pol.p2 { animation-delay: 0.48s; }
.nt-pol.p3 { animation-delay: 0.50s; }
.nt-pol.p4 { animation-delay: 0.52s; }
.nt-pol.p5 { animation-delay: 0.54s; }
.nt-pol.p6 { animation-delay: 0.56s; }
@keyframes nt-vine    { 0% { stroke-dashoffset: 60; opacity: 0; } 50% { stroke-dashoffset: 0; opacity: 1; filter: brightness(1.6); } 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes nt-fern    { 0% { transform: scale(0) rotate(0); opacity: 0; } 50% { transform: scale(1.4) rotate(10deg); opacity: 1; filter: brightness(1.5); } 100% { transform: scale(1) rotate(20deg); opacity: 0; } }
@keyframes nt-flower  { 0% { transform: scale(0) rotate(-30deg); opacity: 0; filter: brightness(3); } 35% { transform: scale(1.3) rotate(6deg); opacity: 1; filter: brightness(2) drop-shadow(0 0 16px var(--c)); } 75% { transform: scale(1) rotate(0); opacity: 0.95; } 100% { transform: scale(0.9) rotate(8deg); opacity: 0; } }
@keyframes nt-pol     { 0% { transform: translateY(0) scale(0); opacity: 0; } 40% { transform: translateY(-6px) scale(1.5); opacity: 1; } 100% { transform: translateY(-18px) scale(0.5); opacity: 0; } }

/* ─── LIGHTNING (revamp — strikes from above) ────────────────────── */
.lit-sky          { transform-origin: 50% -180%; animation: lit-sky-flash 0.65s ease-out forwards; opacity: 0; }
.lit-ground-bloom { transform-origin: 50% 72%; animation: lit-ground-flash 0.7s 0.18s ease-out forwards; opacity: 0; }
.lit-bolt         { stroke-dasharray: 480; stroke-dashoffset: 480; }
.lit-bolt-glow    { animation: lit-strike 0.45s ease-out forwards; opacity: 0; filter: blur(2px); }
.lit-bolt-main    { animation: lit-strike 0.40s 0.02s ease-out forwards; opacity: 0; }
.lit-bolt-core    { animation: lit-strike 0.36s 0.04s ease-out forwards; opacity: 0; }
.lit-branch       { stroke-dasharray: 50; stroke-dashoffset: 50; animation: lit-branch 0.4s 0.15s ease-out forwards; }
.lb2 { animation-delay: 0.18s; }
.lb3 { animation-delay: 0.22s; }
.lb4 { animation-delay: 0.26s; }
.lit-shock        { transform-origin: 50% 72%; }
.lit-s1 { animation: lit-shock 0.65s 0.18s ease-out forwards; }
.lit-s2 { animation: lit-shock 0.75s 0.22s ease-out forwards; opacity: 0; }
.lit-spark        { transform-origin: center; transform-box: fill-box; animation: spark-pop 0.55s 0.22s ease-out forwards; opacity: 0; }
.ls2 { animation-delay: 0.24s; }
.ls3 { animation-delay: 0.26s; }
.ls4 { animation-delay: 0.28s; }
.ls5 { animation-delay: 0.30s; }
@keyframes lit-sky-flash   { 0% { opacity: 0; transform: scale(0.5); } 20% { opacity: 0.95; transform: scale(1.3); filter: brightness(3); } 100% { opacity: 0; transform: scale(1.6); } }
@keyframes lit-ground-flash{ 0% { opacity: 0; transform: scale(0.3); } 20% { opacity: 0.95; transform: scale(1.5); filter: brightness(3); } 100% { opacity: 0; transform: scale(1.8); } }
@keyframes lit-strike      { 0% { stroke-dashoffset: 480; opacity: 0; } 10% { opacity: 1; filter: brightness(4); } 35% { stroke-dashoffset: 0; opacity: 1; filter: brightness(2.5); } 60% { stroke-dashoffset: 0; opacity: 0.9; filter: brightness(1.5); } 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes lit-branch      { 0% { stroke-dashoffset: 50; opacity: 0; } 50% { stroke-dashoffset: 0; opacity: 0.85; } 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes lit-shock       { 0% { transform: scale(0.1); opacity: 1; } 100% { transform: scale(2.2); opacity: 0; } }

/* ─── FIRE (engulf revamp) ───────────────────────────────────────── */
.fi-bloom    { transform-origin: 50% 50%; animation: sh-bloom 0.95s ease-out forwards; opacity: 0; }
.fi-scorch   { transform-origin: 50% 92%; animation: fi-scorch 0.95s ease-out forwards; }
.fi-tongue-l { transform-origin: 22% 92%; animation: fi-tongue-side 0.95s 0.04s ease-out forwards; opacity: 0; }
.fi-tongue-r { transform-origin: 78% 92%; animation: fi-tongue-side 0.95s 0.04s ease-out forwards; opacity: 0; }
.fi-main     { transform-origin: 50% 92%; animation: fi-flame-main 0.95s 0.08s ease-out forwards; }
.fi-lick     { stroke-dasharray: 60; stroke-dashoffset: 60; animation: fi-lick 0.6s ease-out forwards; }
.fl1 { animation-delay: 0.22s; }
.fl2 { animation-delay: 0.24s; }
.fl3 { animation-delay: 0.30s; }
.fl4 { animation-delay: 0.32s; }
.fi-emb      { transform-origin: center; transform-box: fill-box; animation: fi-ember-rise 0.95s ease-out forwards; opacity: 0; }
.fi-emb.fe1  { animation-delay: 0.14s; }
.fi-emb.fe2  { animation-delay: 0.18s; }
.fi-emb.fe3  { animation-delay: 0.22s; }
.fi-emb.fe4  { animation-delay: 0.26s; }
.fi-emb.fe5  { animation-delay: 0.30s; }
.fi-emb.fe6  { animation-delay: 0.34s; }
.fi-emb.fe7  { animation-delay: 0.38s; }
.fi-emb.fe8  { animation-delay: 0.42s; }
.fi-emb.fe9  { animation-delay: 0.16s; }
.fi-emb.fe10 { animation-delay: 0.20s; }
@keyframes fi-tongue-side { 0% { transform: scaleY(0.2) scaleX(0.6); opacity: 0; } 30% { transform: scaleY(1.1) scaleX(1.05); opacity: 0.95; filter: brightness(1.7); } 70% { transform: scaleY(1) scaleX(1); opacity: 0.85; } 100% { transform: scaleY(0.85) scaleX(0.85) translateY(-10px); opacity: 0; } }
@keyframes fi-lick        { 0% { stroke-dashoffset: 60; opacity: 0; } 45% { stroke-dashoffset: 0; opacity: 0.95; filter: brightness(2); } 100% { stroke-dashoffset: 0; opacity: 0; } }

/* ─── WATER (wave revamp) ────────────────────────────────────────── */
.wt-bloom { transform-origin: 50% 60%; animation: sh-bloom 0.85s ease-out forwards; opacity: 0; }
.wt-wave  { animation: wt-wave 0.85s ease-out forwards; opacity: 0; }
.wt-drop  { transform-origin: center; transform-box: fill-box; animation: wt-drop 0.6s ease-out forwards; opacity: 0; }
.wd1 { animation-delay: 0.30s; }
.wd2 { animation-delay: 0.32s; }
.wd3 { animation-delay: 0.34s; }
.wd4 { animation-delay: 0.36s; }
.wd5 { animation-delay: 0.38s; }
.wt-foam { transform-origin: center; transform-box: fill-box; animation: wt-foam 0.5s 0.28s ease-out forwards; opacity: 0; }
.wt-rip   { transform-origin: 50% 86%; }
.wt-rip.wr1 { animation: wt-rip 0.7s 0.32s ease-out forwards; }
.wt-rip.wr2 { animation: wt-rip 0.8s 0.36s ease-out forwards; opacity: 0; }
@keyframes wt-wave { 0% { transform: scaleX(0.3) scaleY(0.4); opacity: 0; } 30% { transform: scaleX(1.05) scaleY(1); opacity: 1; filter: brightness(1.4); } 75% { transform: scaleX(1) scaleY(1); opacity: 0.95; } 100% { transform: scaleX(1.1) scaleY(0.8); opacity: 0; } }
@keyframes wt-drop { 0% { transform: translateY(8px) scale(0); opacity: 0; } 40% { transform: translateY(0) scale(1.4); opacity: 1; } 100% { transform: translateY(-18px) scale(0.5); opacity: 0; } }
@keyframes wt-foam { 0% { transform: scale(0); opacity: 0; } 40% { transform: scale(2); opacity: 1; } 100% { transform: scale(0.4); opacity: 0; } }
@keyframes wt-rip  { 0% { transform: scale(0.2); opacity: 1; } 100% { transform: scale(1.6); opacity: 0; } }

/* ─── COMBO (revamp) ─────────────────────────────────────────────── */
.cb-bloom    { transform-origin: 50% 50%; animation: sh-bloom 0.85s ease-out forwards; opacity: 0; }
.cb-s        { stroke-dasharray: 50; stroke-dashoffset: 50; animation: cb-strike 0.32s ease-out forwards; }
.cb-strikes .s1 { animation-delay: 0.00s; }
.cb-strikes .s2 { animation-delay: 0.06s; }
.cb-strikes .s3 { animation-delay: 0.12s; }
.cb-strikes .s4 { animation-delay: 0.18s; }
.cb-strikes .s5 { animation-delay: 0.24s; }
.cb-strikes .s6 { animation-delay: 0.30s; }
.cb-finish   { stroke-dasharray: 110; stroke-dashoffset: 110; animation: cb-finish 0.4s ease-out forwards; }
.cb-f1 { animation-delay: 0.40s; }
.cb-f2 { animation-delay: 0.44s; }
.cb-impact   { transform-origin: 50% 50%; animation: cb-impact 0.5s 0.42s ease-out forwards; }
.cb-spark    { transform-origin: center; transform-box: fill-box; animation: spark-pop 0.4s ease-out forwards; opacity: 0; }
.cb-spark.sp1 { animation-delay: 0.08s; }
.cb-spark.sp2 { animation-delay: 0.14s; }
.cb-spark.sp3 { animation-delay: 0.20s; }
.cb-spark.sp4 { animation-delay: 0.26s; }
.cb-spark.sp5 { animation-delay: 0.32s; }
.cb-spark.sp6 { animation-delay: 0.38s; }
@keyframes cb-strike { 0% { stroke-dashoffset: 50; opacity: 0; } 40% { stroke-dashoffset: 0; opacity: 1; filter: brightness(2); } 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes cb-finish { 0% { stroke-dashoffset: 110; opacity: 0; } 30% { stroke-dashoffset: 0; opacity: 1; filter: brightness(3); } 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes cb-impact { 0% { transform: scale(0); opacity: 0; } 30% { transform: scale(1.6); opacity: 1; filter: brightness(4) drop-shadow(0 0 20px var(--c)); } 100% { transform: scale(0.8); opacity: 0; } }

/* ─── EARTH (revamp) ─────────────────────────────────────────────── */
.er-bloom { transform-origin: 50% 86%; animation: sh-bloom 0.9s ease-out forwards; opacity: 0; }
.er-cr    { stroke-dasharray: 90; stroke-dashoffset: 90; animation: er-crack 0.5s 0.06s ease-out forwards; }
.er-cracks polyline:nth-child(1) { animation-delay: 0.04s; }
.er-cracks polyline:nth-child(2) { animation-delay: 0.08s; }
.er-cracks polyline:nth-child(3) { animation-delay: 0.12s; }
.er-cracks polyline:nth-child(4) { animation-delay: 0.16s; }
.er-sp    { transform-origin: 50% 88%; animation: er-spike 0.55s ease-out forwards; opacity: 0; }
.er-spikes .ep1 { animation-delay: 0.18s; }
.er-spikes .ep2 { animation-delay: 0.22s; }
.er-spikes .ep3 { animation-delay: 0.24s; }
.er-spikes .ep4 { animation-delay: 0.28s; }
.er-spikes .ep5 { animation-delay: 0.30s; }
.er-rk    { transform-origin: center; transform-box: fill-box; animation: er-rock 0.6s 0.22s ease-out forwards; opacity: 0; }
.rk2 { animation-delay: 0.26s; }
.rk3 { animation-delay: 0.30s; }
.rk4 { animation-delay: 0.34s; }
.rk5 { animation-delay: 0.20s; }
.er-dust  { transform-origin: center; transform-box: fill-box; animation: er-dust 0.7s 0.30s ease-out forwards; opacity: 0; }
.ed2 { animation-delay: 0.32s; }
.ed3 { animation-delay: 0.36s; }
.ed4 { animation-delay: 0.34s; }
.ed5 { animation-delay: 0.38s; }
@keyframes er-crack { 0% { stroke-dashoffset: 90; opacity: 0; } 30% { stroke-dashoffset: 0; opacity: 1; filter: brightness(2); } 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes er-spike { 0% { transform: translateY(20px) scaleY(0.2); opacity: 0; } 35% { transform: translateY(0) scaleY(1.1); opacity: 1; filter: brightness(1.6); } 70% { transform: translateY(0) scaleY(1); opacity: 0.95; } 100% { transform: translateY(0) scaleY(0.9); opacity: 0; } }
@keyframes er-rock  { 0% { transform: translateY(20px) scale(0); opacity: 0; } 40% { transform: translateY(0) scale(1.3); opacity: 1; } 100% { transform: translateY(-12px) scale(0.6); opacity: 0; } }
@keyframes er-dust  { 0% { transform: translateY(6px) scale(0); opacity: 0; } 40% { transform: translateY(-4px) scale(1.4); opacity: 0.8; } 100% { transform: translateY(-20px) scale(0.5); opacity: 0; } }

/* ─── BERSERKER (revamp) ─────────────────────────────────────────── */
.bk-bloom  { transform-origin: 50% 50%; animation: bk-bloom 0.9s ease-out forwards; opacity: 0; }
.bk-ring   { transform-origin: 50% 50%; animation: bk-ring 0.9s ease-out forwards; }
.bk-spikes { transform-origin: 50% 50%; animation: bk-spikes 0.85s ease-out forwards; }
.bk-sp     { transform-origin: 50% 50%; transform-box: fill-box; animation: bk-spike 0.6s ease-out forwards; opacity: 0; }
.bk-spikes .bsp1 { animation-delay: 0.04s; }
.bk-spikes .bsp2 { animation-delay: 0.07s; }
.bk-spikes .bsp3 { animation-delay: 0.10s; }
.bk-spikes .bsp4 { animation-delay: 0.13s; }
.bk-spikes .bsp5 { animation-delay: 0.16s; }
.bk-spikes .bsp6 { animation-delay: 0.19s; }
.bk-spikes .bsp7 { animation-delay: 0.22s; }
.bk-spikes .bsp8 { animation-delay: 0.25s; }
.bk-core   { transform-origin: 50% 50%; animation: bk-core 0.85s ease-out forwards; }
.bk-arc    { stroke-dasharray: 50; stroke-dashoffset: 50; animation: bk-arc 0.45s ease-out forwards; }
.bka1 { animation-delay: 0.20s; }
.bka2 { animation-delay: 0.22s; }
.bka3 { animation-delay: 0.24s; }
.bka4 { animation-delay: 0.26s; }
.bk-mote   { transform-origin: center; transform-box: fill-box; animation: spark-pop 0.55s 0.28s ease-out forwards; opacity: 0; }
.bm2 { animation-delay: 0.30s; }
.bm3 { animation-delay: 0.32s; }
.bm4 { animation-delay: 0.34s; }
@keyframes bk-bloom  { 0% { opacity: 0; transform: scale(0.3); } 20% { opacity: 0.85; transform: scale(1.3); filter: brightness(3); } 60% { opacity: 0.45; transform: scale(1.1); } 100% { opacity: 0; transform: scale(2.0); } }
@keyframes bk-ring   { 0% { transform: scale(0.4) rotate(-10deg); opacity: 0; } 30% { transform: scale(1.15) rotate(8deg); opacity: 1; filter: brightness(2); } 70% { transform: scale(1) rotate(-4deg); opacity: 0.7; } 100% { transform: scale(1.2) rotate(0); opacity: 0; } }
@keyframes bk-spikes { 0%,100% { transform: translate(0,0); } 30%,50%,70% { transform: translate(-1px,1px); } 40%,60% { transform: translate(1px,-1px); } }
@keyframes bk-spike  { 0% { transform: scale(0); opacity: 0; } 35% { transform: scale(1.2); opacity: 1; filter: brightness(2.5); } 100% { transform: scale(0.9); opacity: 0; } }
@keyframes bk-core   { 0% { transform: scale(0); opacity: 0; filter: brightness(1); } 30% { transform: scale(1.4); opacity: 1; filter: brightness(3.5) drop-shadow(0 0 22px var(--c)); } 70% { transform: scale(1.1); opacity: 0.95; } 100% { transform: scale(0.8); opacity: 0; } }
@keyframes bk-arc    { 0% { stroke-dashoffset: 50; opacity: 0; } 40% { stroke-dashoffset: 0; opacity: 0.9; } 100% { stroke-dashoffset: 0; opacity: 0; } }

/* ─── SHIELD (revamp) ────────────────────────────────────────────── */
.sd-bloom     { transform-origin: 50% 50%; animation: sh-bloom 0.85s ease-out forwards; opacity: 0; }
.sd-hex-outer { transform-origin: 50% 50%; animation: sd-hex-outer 0.85s ease-out forwards; }
.sd-hex-mid   { transform-origin: 50% 50%; animation: sd-hex-mid   0.85s ease-out forwards; }
.sd-hex-inner { transform-origin: 50% 50%; animation: sd-hex-inner 0.85s ease-out forwards; }
.sd-core      { transform-origin: 50% 50%; transform-box: fill-box; animation: sd-core 0.85s ease-out forwards; }
.sd-ring      { transform-origin: 50% 50%; opacity: 0; }
.sdr1 { animation: sd-ring 0.65s ease-out forwards; }
.sdr2 { animation: sd-ring 0.75s 0.08s ease-out forwards; }
.sdr3 { animation: sd-ring 0.85s 0.16s ease-out forwards; }
.sd-spark     { transform-origin: center; transform-box: fill-box; animation: spark-pop 0.55s 0.18s ease-out forwards; opacity: 0; }
.ss2 { animation-delay: 0.20s; }
.ss3 { animation-delay: 0.22s; }
.ss4 { animation-delay: 0.24s; }
.ss5 { animation-delay: 0.26s; }
.ss6 { animation-delay: 0.28s; }
@keyframes sd-hex-outer { 0% { transform: scale(0.3) rotate(0); opacity: 0; } 25% { transform: scale(1.15) rotate(15deg); opacity: 1; filter: brightness(2.5); } 65% { transform: scale(1) rotate(8deg); opacity: 0.95; } 100% { transform: scale(0.95) rotate(0); opacity: 0; } }
@keyframes sd-hex-mid   { 0% { transform: scale(0.4) rotate(0); opacity: 0; } 30% { transform: scale(1.1) rotate(-15deg); opacity: 1; } 70% { transform: scale(1) rotate(-8deg); opacity: 0.85; } 100% { transform: scale(0.95) rotate(0); opacity: 0; } }
@keyframes sd-hex-inner { 0% { transform: scale(0.4) rotate(0); opacity: 0; } 30% { transform: scale(1.2) rotate(10deg); opacity: 1; filter: brightness(2) drop-shadow(0 0 14px var(--c)); } 100% { transform: scale(0.9) rotate(0); opacity: 0; } }
@keyframes sd-core      { 0% { transform: scale(0); opacity: 0; } 30% { transform: scale(1.6); opacity: 1; filter: brightness(4) drop-shadow(0 0 18px var(--c)); } 100% { transform: scale(0.7); opacity: 0; } }
@keyframes sd-ring      { 0% { transform: scale(0.1); opacity: 1; } 100% { transform: scale(1.8); opacity: 0; } }

/* ─── HOLY HEAL MODE (revamp) ────────────────────────────────────── */
.hh-bloom     { transform-origin: 50% 50%; animation: sh-bloom 0.95s ease-out forwards; opacity: 0; }
.hh-rune-ring { transform-origin: 50% 50%; animation: hh-rune 1.0s ease-out forwards; }
.hh-rays      { transform-origin: 50% 50%; animation: hh-rays 0.9s ease-out forwards; }
.hh-core      { transform-origin: 50% 50%; animation: hh-core 0.9s ease-out forwards; }
.hh-mote      { transform-origin: center; transform-box: fill-box; animation: hh-mote-rise 1.0s ease-out forwards; opacity: 0; }
.hh-mote.hm1 { animation-delay: 0.12s; }
.hh-mote.hm2 { animation-delay: 0.16s; }
.hh-mote.hm3 { animation-delay: 0.20s; }
.hh-mote.hm4 { animation-delay: 0.24s; }
.hh-mote.hm5 { animation-delay: 0.28s; }
.hh-mote.hm6 { animation-delay: 0.32s; }
.hh-mote.hm7 { animation-delay: 0.36s; }
.hh-sparkle   { transform-origin: center; transform-box: fill-box; animation: spark-pop 0.5s 0.30s ease-out forwards; opacity: 0; }
.hs2 { animation-delay: 0.34s; }
.hs3 { animation-delay: 0.38s; }
.hs4 { animation-delay: 0.42s; }
@keyframes hh-rune     { 0% { transform: scale(0.3) rotate(0); opacity: 0; } 25% { transform: scale(1.2) rotate(60deg); opacity: 1; filter: brightness(2.5); } 100% { transform: scale(1.6) rotate(180deg); opacity: 0; } }
@keyframes hh-rays     { 0% { transform: scale(0); opacity: 0; } 25% { transform: scale(1.2); opacity: 1; filter: brightness(2.5) drop-shadow(0 0 18px var(--c)); } 70% { transform: scale(1); opacity: 0.9; } 100% { transform: scale(0.9); opacity: 0; } }
@keyframes hh-core     { 0% { transform: scale(0); opacity: 0; filter: brightness(1); } 30% { transform: scale(1.5); opacity: 1; filter: brightness(4.5) drop-shadow(0 0 24px var(--c)); } 70% { transform: scale(1.1); opacity: 0.95; } 100% { transform: scale(0.8); opacity: 0; } }
@keyframes hh-mote-rise{ 0% { transform: translateY(8px) scale(0); opacity: 0; } 30% { transform: translateY(0) scale(1.4); opacity: 1; filter: brightness(2); } 100% { transform: translateY(-30px) scale(0.5); opacity: 0; } }

/* ─── ICE (revamp) ───────────────────────────────────────────────── */
.ic-bloom  { transform-origin: 50% 50%; animation: sh-bloom 0.85s ease-out forwards; opacity: 0; }
.ic-rays   { transform-origin: 50% 50%; animation: ic-rays 0.85s ease-out forwards; }
.ic-shards { transform-origin: 50% 50%; animation: ic-shards 0.85s ease-out forwards; }
.ic-sh     { transform-origin: 50% 50%; transform-box: fill-box; animation: ic-shard 0.55s ease-out forwards; opacity: 0; }
.ic-shards .ish1 { animation-delay: 0.08s; }
.ic-shards .ish2 { animation-delay: 0.11s; }
.ic-shards .ish3 { animation-delay: 0.14s; }
.ic-shards .ish4 { animation-delay: 0.17s; }
.ic-shards .ish5 { animation-delay: 0.20s; }
.ic-shards .ish6 { animation-delay: 0.23s; }
.ic-core   { transform-origin: 50% 50%; animation: ic-core 0.85s ease-out forwards; }
.ic-frost  { transform-origin: center; transform-box: fill-box; animation: ic-frost 0.7s ease-out forwards; opacity: 0; }
.fc2 { animation-delay: 0.22s; }
.fc3 { animation-delay: 0.24s; }
.fc4 { animation-delay: 0.26s; }
.fc5 { animation-delay: 0.28s; }
.fc6 { animation-delay: 0.30s; }
.fc7 { animation-delay: 0.32s; }
.fc8 { animation-delay: 0.34s; }
@keyframes ic-rays   { 0% { transform: scale(0); opacity: 0; } 25% { transform: scale(1.2); opacity: 1; filter: brightness(2.5); } 70% { transform: scale(1); opacity: 0.9; } 100% { transform: scale(0.9); opacity: 0; } }
@keyframes ic-shards { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }
@keyframes ic-shard  { 0% { transform: scale(0); opacity: 0; } 40% { transform: scale(1.15); opacity: 1; filter: brightness(2); } 100% { transform: scale(0.95); opacity: 0; } }
@keyframes ic-core   { 0% { transform: scale(0) rotate(-45deg); opacity: 0; } 30% { transform: scale(1.4) rotate(20deg); opacity: 1; filter: brightness(3) drop-shadow(0 0 18px var(--c)); } 100% { transform: scale(0.9) rotate(0); opacity: 0; } }
@keyframes ic-frost  { 0% { transform: scale(0); opacity: 0; } 45% { transform: scale(1.5); opacity: 1; } 100% { transform: scale(0.5); opacity: 0; } }

/* ─── COSMIC (revamp) ────────────────────────────────────────────── */
.cs-bloom  { transform-origin: 50% 50%; animation: sh-bloom 0.95s ease-out forwards; opacity: 0; }
.cs-spiral { transform-origin: 50% 50%; animation: cs-spiral 1.1s ease-out forwards; }
.cs-comets { transform-origin: 50% 50%; animation: cs-comets 0.85s ease-out forwards; }
.cs-ct     { stroke-dasharray: 70; stroke-dashoffset: 70; animation: cs-comet 0.6s 0.10s ease-out forwards; }
.cs-comets line:nth-child(2) { animation-delay: 0.13s; }
.cs-comets line:nth-child(3) { animation-delay: 0.16s; }
.cs-comets line:nth-child(4) { animation-delay: 0.19s; }
.cs-core   { transform-origin: 50% 50%; animation: cs-core 0.9s ease-out forwards; }
.cs-star   { transform-origin: center; transform-box: fill-box; animation: cs-twinkle 0.7s ease-out forwards; opacity: 0; }
.cs-stars .csA { animation-delay: 0.10s; }
.cs-stars .csB { animation-delay: 0.14s; }
.cs-stars .csC { animation-delay: 0.18s; }
.cs-stars .csD { animation-delay: 0.22s; }
.cs-dot    { transform-origin: center; transform-box: fill-box; animation: spark-pop 0.5s 0.26s ease-out forwards; opacity: 0; }
.cs-dust   { transform-origin: center; transform-box: fill-box; animation: cs-twinkle 0.55s 0.30s ease-out forwards; opacity: 0; }
@keyframes cs-spiral  { 0% { transform: scale(0.3) rotate(0); opacity: 0; } 35% { transform: scale(1.25) rotate(-60deg); opacity: 1; filter: brightness(2); } 100% { transform: scale(1.4) rotate(-180deg); opacity: 0; } }
@keyframes cs-comets  { 0%,100% { opacity: 1; } }
@keyframes cs-comet   { 0% { stroke-dashoffset: 70; opacity: 0; } 50% { stroke-dashoffset: 0; opacity: 1; filter: brightness(2); } 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes cs-core    { 0% { transform: scale(0); opacity: 0; filter: brightness(1); } 30% { transform: scale(1.6); opacity: 1; filter: brightness(5) drop-shadow(0 0 28px var(--c)); } 70% { transform: scale(1.2); opacity: 0.95; } 100% { transform: scale(0.8); opacity: 0; } }
@keyframes cs-twinkle { 0% { transform: scale(0) rotate(0); opacity: 0; } 50% { transform: scale(1.5) rotate(45deg); opacity: 1; filter: brightness(2.5); } 100% { transform: scale(0.6) rotate(90deg); opacity: 0; } }

/* ─── Bloom backdrops for the 5 remaining new types ──────────────── */
/* All reuse the shared sh-bloom keyframe defined in the shadow block. */
.met-bloom,
.soul-bloom,
.snd-bloom,
.chaos-bloom,
.arc-bloom {
  transform-origin: 50% 50%;
  animation: sh-bloom 0.85s ease-out forwards;
  opacity: 0;
}
</style>
