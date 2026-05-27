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

  let isRtl = $derived(direction === 'rtl')

  const noFlyTypes  = new Set(['dodge', 'shield'])
  const swirlTypes  = new Set(['void', 'psychic', 'time', 'shadow', 'gravity', 'cursed', 'arcane', 'cosmic', 'soul', 'chaos'])
  const crashTypes  = new Set(['crit', 'berserker', 'earth', 'slash', 'metal'])

  let flyClass = $derived(
    attackType === 'aoe'    ? 'fx-aoe-burst' :
    attackType === 'heal'   ? 'fx-heal-rise' :
    attackType === 'buff'   ? 'fx-buff-pulse' :
    attackType === 'debuff' ? 'fx-debuff-spread' :
    attackType === 'summon' ? 'fx-summon-portal' :
    direction === 'center' ? '' :
    noFlyTypes.has(type)   ? '' :
    swirlTypes.has(type)   ? `fx-${direction}-swirl` :
    crashTypes.has(type)   ? `fx-${direction}-crash` :
    `fx-${direction}-arc`
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
    <!-- Fire — ENGULFS the target. Three flame tongues stacked across the
         target's card (left, center, right), each rising tall above the
         card to consume them. Scorch pool spreads at the ground, embers
         rise from the whole burning area. Drawn TALLER than the viewBox
         so it visibly wraps the target. -->
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <!-- Wrapping bloom — covers a wider area than the cards (it's
           engulfing them, not exploding next to them) -->
      <ellipse cx="50" cy="55" rx="62" ry="48" fill="var(--c)" opacity="0.34"
               class="fi-bloom" style="filter:blur(22px)"/>
      <ellipse cx="50" cy="60" rx="48" ry="42" fill="var(--c)" opacity="0.24"
               style="filter:blur(12px)"/>
      <!-- Scorch pool spreading at the ground (extends past target width) -->
      <ellipse class="fi-scorch" cx="50" cy="92" rx="38" ry="9" fill="var(--c)" opacity="0.65"/>
      <!-- LEFT flame tongue — wraps the left side of the target -->
      <g class="fi-tongue-l">
        <path d="M22 96 C14 70 10 50 22 24 C18 42 30 36 30 14 C34 30 42 24 36 4 C48 22 50 50 42 70 C46 58 44 50 36 50 C44 64 34 86 22 96Z"
              fill="var(--c)" opacity="0.85"/>
      </g>
      <!-- RIGHT flame tongue -->
      <g class="fi-tongue-r">
        <path d="M78 96 C86 70 90 50 78 24 C82 42 70 36 70 14 C66 30 58 24 64 4 C52 22 50 50 58 70 C54 58 56 50 64 50 C56 64 66 86 78 96Z"
              fill="var(--c)" opacity="0.85"/>
      </g>
      <!-- CENTER flame body — tallest, most prominent -->
      <g class="fi-main">
        <path d="M50 96 C36 70 28 50 40 22 C36 42 50 36 46 6 C50 22 58 16 52 -8 C66 14 76 50 66 74 C72 60 76 50 66 46 C76 62 70 86 50 96Z"
              fill="var(--c)"/>
        <!-- Hot core inside the central flame -->
        <ellipse cx="50" cy="70" rx="7" ry="18" fill="white" opacity="0.55"/>
        <ellipse cx="50" cy="78" rx="3.5" ry="8" fill="white" opacity="0.9"/>
      </g>
      <!-- Crackling licks reaching outward + upward -->
      <path class="fi-lick fl1" d="M22 50 Q12 36 6 18"  stroke="var(--c)" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.8"/>
      <path class="fi-lick fl2" d="M78 50 Q88 36 94 18" stroke="var(--c)" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.8"/>
      <path class="fi-lick fl3" d="M40 18 Q34 6 28 -8"  stroke="var(--c)" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.7"/>
      <path class="fi-lick fl4" d="M60 18 Q66 6 72 -8"  stroke="var(--c)" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.7"/>
      <!-- Rising embers — spread across the whole burning area -->
      <circle class="fi-emb fe1" cx="34" cy="62" r="2.4" fill="var(--c)"/>
      <circle class="fi-emb fe2" cx="50" cy="50" r="2.2" fill="var(--c)"/>
      <circle class="fi-emb fe3" cx="66" cy="58" r="2.4" fill="var(--c)"/>
      <circle class="fi-emb fe4" cx="42" cy="36" r="1.9" fill="var(--c)" opacity="0.9"/>
      <circle class="fi-emb fe5" cx="58" cy="32" r="1.9" fill="var(--c)" opacity="0.9"/>
      <circle class="fi-emb fe6" cx="38" cy="22" r="1.6" fill="var(--c)" opacity="0.8"/>
      <circle class="fi-emb fe7" cx="62" cy="20" r="1.6" fill="var(--c)" opacity="0.8"/>
      <circle class="fi-emb fe8" cx="50" cy="12" r="1.5" fill="var(--c)" opacity="0.7"/>
      <circle class="fi-emb fe9" cx="26" cy="78" r="1.8" fill="var(--c)" opacity="0.8"/>
      <circle class="fi-emb fe10" cx="74" cy="78" r="1.8" fill="var(--c)" opacity="0.8"/>
    </svg>

  {:else if type === 'lightning'}
    <!-- Lightning — strikes from the SKY. The bolt zigzags down from way
         above the viewBox to slam into the target's ground level (y=70).
         Sky bloom at the bolt's origin, ground shock ring at impact,
         scorch sparks around the strike. Drawn with three layered widths
         (glow / main / hot core) like the holy beam. -->
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <!-- Sky bloom — the cloud/halo at the bolt's origin -->
      <ellipse cx="50" cy="-180" rx="48" ry="22" fill="var(--c)" opacity="0.55"
               class="lit-sky" style="filter:blur(20px)"/>
      <!-- Ground impact bloom -->
      <ellipse cx="50" cy="72" rx="38" ry="14" fill="var(--c)" opacity="0.45"
               class="lit-ground-bloom" style="filter:blur(12px)"/>
      <!-- Three layered zigzag bolts (glow → main → hot core).
           The bolt extends from y=-200 (high above viewBox) to y=70
           (slightly below center, the ground level of the target). -->
      <polyline class="lit-bolt lit-bolt-glow"
        points="48,-200 56,-160 42,-110 60,-70 38,-30 56,0 44,30 56,55 50,72"
        stroke="var(--c)" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.30"/>
      <polyline class="lit-bolt lit-bolt-main"
        points="48,-200 56,-160 42,-110 60,-70 38,-30 56,0 44,30 56,55 50,72"
        stroke="var(--c)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <polyline class="lit-bolt lit-bolt-core"
        points="48,-200 56,-160 42,-110 60,-70 38,-30 56,0 44,30 56,55 50,72"
        stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.9"/>
      <!-- Branch forks splitting off the main bolt -->
      <polyline class="lit-branch lb1" points="42,-110 26,-90 32,-72"
        stroke="var(--c)" stroke-width="1.6" fill="none" stroke-linecap="round" opacity="0.65"/>
      <polyline class="lit-branch lb2" points="60,-70 76,-58 68,-38"
        stroke="var(--c)" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.6"/>
      <polyline class="lit-branch lb3" points="56,0 70,6 64,22"
        stroke="var(--c)" stroke-width="1.3" fill="none" stroke-linecap="round" opacity="0.55"/>
      <polyline class="lit-branch lb4" points="44,30 32,40 38,52"
        stroke="var(--c)" stroke-width="1.2" fill="none" stroke-linecap="round" opacity="0.5"/>
      <!-- Ground shock rings spreading outward from the strike -->
      <ellipse class="lit-shock lit-s1" cx="50" cy="72" rx="22" ry="6"
               stroke="var(--c)" stroke-width="3" fill="none"/>
      <ellipse class="lit-shock lit-s2" cx="50" cy="72" rx="32" ry="9"
               stroke="var(--c)" stroke-width="2" fill="none" opacity="0.65"/>
      <!-- Scorch sparks at impact -->
      <circle class="lit-spark ls1" cx="34" cy="74" r="2.5" fill="var(--c)"/>
      <circle class="lit-spark ls2" cx="66" cy="74" r="2.5" fill="var(--c)"/>
      <circle class="lit-spark ls3" cx="42" cy="64" r="2"   fill="var(--c)"/>
      <circle class="lit-spark ls4" cx="58" cy="64" r="2"   fill="var(--c)"/>
      <circle class="lit-spark ls5" cx="50" cy="58" r="2.2" fill="var(--c)"/>
    </svg>

  {:else if type === 'ice'}
    <svg viewBox="0 0 100 100" class="fx-svg ice-g" overflow="visible">
      <circle cx="50" cy="50" r="40" fill="var(--c)" opacity="0.10" style="filter:blur(10px)"/>
      <polygon class="ice-shard is1" points="50,4 53,16 50,20 47,16" fill="var(--c)" opacity="0.7"/>
      <polygon class="ice-shard is2" points="96,50 84,53 80,50 84,47" fill="var(--c)" opacity="0.7"/>
      <polygon class="ice-shard is3" points="50,96 47,84 50,80 53,84" fill="var(--c)" opacity="0.65"/>
      <polygon class="ice-shard is4" points="4,50 16,47 20,50 16,53"  fill="var(--c)" opacity="0.65"/>
      <polygon class="ice-shard is5" points="14,14 22,24 18,28 10,20" fill="var(--c)" opacity="0.5"/>
      <polygon class="ice-shard is6" points="86,14 90,24 86,28 78,20" fill="var(--c)" opacity="0.5"/>
      <line x1="50" y1="12" x2="50" y2="88" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="12" y1="50" x2="88" y2="50" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="22" y1="22" x2="78" y2="78" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="78" y1="22" x2="22" y2="78" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="50" y1="12" x2="43" y2="22" stroke="var(--c)" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="50" y1="12" x2="57" y2="22" stroke="var(--c)" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="50" y1="88" x2="43" y2="78" stroke="var(--c)" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="50" y1="88" x2="57" y2="78" stroke="var(--c)" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="12" y1="50" x2="22" y2="43" stroke="var(--c)" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="12" y1="50" x2="22" y2="57" stroke="var(--c)" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="88" y1="50" x2="78" y2="43" stroke="var(--c)" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="88" y1="50" x2="78" y2="57" stroke="var(--c)" stroke-width="1.8" stroke-linecap="round"/>
      <circle cx="50" cy="50" r="6" fill="var(--c)"/>
      <circle class="frost fc1" cx="30" cy="30" r="2"   fill="var(--c)" opacity="0.6"/>
      <circle class="frost fc2" cx="70" cy="30" r="1.5" fill="var(--c)" opacity="0.5"/>
      <circle class="frost fc3" cx="30" cy="70" r="1.5" fill="var(--c)" opacity="0.5"/>
      <circle class="frost fc4" cx="70" cy="70" r="2"   fill="var(--c)" opacity="0.6"/>
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
    <!-- Wind — howling vortex with 5 swept-curve airstreams + spiraling
         vortex eye + flying debris swept along + leading slipstream lines. -->
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <ellipse cx="50" cy="50" rx="46" ry="36" fill="var(--c)" opacity="0.20" class="wn-bloom" style="filter:blur(14px)"/>
      <!-- 5 staggered horizontal wind streaks -->
      <g class="wn-streaks">
        <path class="wn-wl wl1" d="M4 30 Q28 20 56 30 Q80 38 96 30"  stroke="var(--c)" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <path class="wn-wl wl2" d="M0 42 Q24 32 52 42 Q80 52 100 42" stroke="var(--c)" stroke-width="3"   fill="none" stroke-linecap="round" opacity="0.85"/>
        <path class="wn-wl wl3" d="M6 54 Q28 44 56 54 Q82 64 96 54"  stroke="var(--c)" stroke-width="3"   fill="none" stroke-linecap="round" opacity="0.85"/>
        <path class="wn-wl wl4" d="M4 66 Q26 56 54 66 Q78 76 94 66"  stroke="var(--c)" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.65"/>
        <path class="wn-wl wl5" d="M8 78 Q30 68 58 78 Q80 86 90 78"  stroke="var(--c)" stroke-width="2"   fill="none" stroke-linecap="round" opacity="0.55"/>
      </g>
      <!-- Spiraling vortex eye -->
      <g class="wn-vortex">
        <path d="M50 50 Q56 42 50 32 Q40 26 38 40 Q36 56 56 60 Q72 62 70 48"
              stroke="var(--c)" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.9"/>
        <circle cx="50" cy="50" r="6" fill="var(--c)" opacity="0.9"/>
        <circle cx="50" cy="50" r="2" fill="white" opacity="0.85"/>
      </g>
      <!-- Wind-borne debris (small motes flying horizontally) -->
      <circle class="wn-mote wm1" cx="90" cy="32" r="2"   fill="var(--c)"/>
      <circle class="wn-mote wm2" cx="94" cy="44" r="1.6" fill="var(--c)" opacity="0.85"/>
      <circle class="wn-mote wm3" cx="88" cy="56" r="2"   fill="var(--c)" opacity="0.9"/>
      <circle class="wn-mote wm4" cx="92" cy="68" r="1.6" fill="var(--c)" opacity="0.85"/>
      <circle class="wn-mote wm5" cx="86" cy="80" r="1.4" fill="var(--c)" opacity="0.7"/>
    </svg>

  {:else if type === 'earth'}
    <!-- Earth — seismic upheaval. Stone spikes thrust from below, ground
         cracks fracture outward, dust cloud rises, boulders fly. Heavy
         silhouette to read as crushing weight. -->
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <ellipse cx="50" cy="86" rx="50" ry="18" fill="var(--c)" opacity="0.28" class="er-bloom" style="filter:blur(14px)"/>
      <!-- Ground line + cracks fracturing outward -->
      <line x1="2"  y1="88" x2="98" y2="88" stroke="var(--c)" stroke-width="3" stroke-linecap="round"/>
      <g class="er-cracks">
        <polyline class="er-cr cc1" points="50,88 38,82 42,72 28,62 32,50"
                  stroke="var(--c)" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.8"/>
        <polyline class="er-cr cc2" points="50,88 62,82 58,72 72,62 68,50"
                  stroke="var(--c)" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.8"/>
        <polyline class="er-cr cc3" points="50,88 44,80 32,82 18,86"
                  stroke="var(--c)" stroke-width="1.6" fill="none" stroke-linecap="round" opacity="0.65"/>
        <polyline class="er-cr cc4" points="50,88 56,80 68,82 82,86"
                  stroke="var(--c)" stroke-width="1.6" fill="none" stroke-linecap="round" opacity="0.65"/>
      </g>
      <!-- Stone spikes thrusting up from the ground -->
      <g class="er-spikes">
        <polygon class="er-sp ep1" points="50,88 42,38 58,38" fill="var(--c)"/>
        <polygon class="er-sp ep2" points="28,88 22,56 34,56" fill="var(--c)" opacity="0.92"/>
        <polygon class="er-sp ep3" points="72,88 66,56 78,56" fill="var(--c)" opacity="0.92"/>
        <polygon class="er-sp ep4" points="14,88 10,68 20,68" fill="var(--c)" opacity="0.85"/>
        <polygon class="er-sp ep5" points="86,88 80,68 90,68" fill="var(--c)" opacity="0.85"/>
        <!-- Spike highlights -->
        <polygon points="50,88 47,46 53,46" fill="white" opacity="0.18"/>
        <polygon points="28,88 26,60 30,60" fill="white" opacity="0.18"/>
        <polygon points="72,88 70,60 74,60" fill="white" opacity="0.18"/>
      </g>
      <!-- Flying boulders + rock chips -->
      <g class="er-chips">
        <polygon class="er-rk rk1" points="32,32 38,30 40,36 36,38" fill="var(--c)"/>
        <polygon class="er-rk rk2" points="62,28 70,32 68,38 60,34" fill="var(--c)"/>
        <polygon class="er-rk rk3" points="20,40 28,38 30,46 22,46" fill="var(--c)" opacity="0.85"/>
        <polygon class="er-rk rk4" points="74,40 82,42 80,50 72,46" fill="var(--c)" opacity="0.85"/>
        <polygon class="er-rk rk5" points="48,18 56,20 54,28 46,24" fill="var(--c)" opacity="0.9"/>
      </g>
      <!-- Dust motes rising from impact -->
      <circle class="er-dust ed1" cx="38" cy="78" r="1.8" fill="var(--c)" opacity="0.65"/>
      <circle class="er-dust ed2" cx="62" cy="78" r="1.8" fill="var(--c)" opacity="0.65"/>
      <circle class="er-dust ed3" cx="50" cy="74" r="1.5" fill="var(--c)" opacity="0.55"/>
      <circle class="er-dust ed4" cx="26" cy="76" r="1.5" fill="var(--c)" opacity="0.55"/>
      <circle class="er-dust ed5" cx="74" cy="76" r="1.5" fill="var(--c)" opacity="0.55"/>
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
    <!-- Arcane — counter-rotating sigil rings, runic glyphs, mystic core -->
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <circle cx="50" cy="50" r="42" fill="var(--c)" opacity="0.16" style="filter:blur(14px)"/>
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
    <!-- Cosmic — galactic spiral, nebula glow, star points -->
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <circle cx="50" cy="50" r="46" fill="var(--c)" opacity="0.18" style="filter:blur(16px)"/>
      <!-- Galactic spiral arms -->
      <g class="cos-spiral">
        <path d="M50 50 Q40 30 20 28 Q12 38 16 52 Q26 64 50 50" stroke="var(--c)" stroke-width="2" fill="none" opacity="0.7"/>
        <path d="M50 50 Q60 70 80 72 Q88 62 84 48 Q74 36 50 50" stroke="var(--c)" stroke-width="2" fill="none" opacity="0.7"/>
        <path d="M50 50 Q34 44 28 18" stroke="var(--c)" stroke-width="1.4" fill="none" opacity="0.5"/>
        <path d="M50 50 Q66 56 72 82" stroke="var(--c)" stroke-width="1.4" fill="none" opacity="0.5"/>
      </g>
      <!-- Nebula core -->
      <g class="cos-core">
        <circle cx="50" cy="50" r="14" fill="var(--c)" opacity="0.65" style="filter:blur(3px)"/>
        <circle cx="50" cy="50" r="9"  fill="var(--c)"/>
        <circle cx="50" cy="50" r="4"  fill="white" opacity="0.95"/>
      </g>
      <!-- Star points -->
      <g class="cos-stars">
        <polygon class="cstar cs1" points="22,14 24,20 30,20 25,24 27,30 22,26 17,30 19,24 14,20 20,20" fill="var(--c)"/>
        <polygon class="cstar cs2" points="78,12 80,18 86,18 81,22 83,28 78,24 73,28 75,22 70,18 76,18" fill="var(--c)" opacity="0.9"/>
        <polygon class="cstar cs3" points="80,82 82,88 88,88 83,92 85,98 80,94 75,98 77,92 72,88 78,88" fill="var(--c)" opacity="0.85"/>
        <polygon class="cstar cs4" points="20,84 22,90 28,90 23,94 25,100 20,96 15,100 17,94 12,90 18,90" fill="var(--c)" opacity="0.85"/>
        <circle class="cstar-dot" cx="90" cy="50" r="1.8" fill="var(--c)" opacity="0.9"/>
        <circle class="cstar-dot" cx="10" cy="50" r="1.8" fill="var(--c)" opacity="0.9"/>
        <circle class="cstar-dot" cx="50" cy="6"  r="1.5" fill="var(--c)" opacity="0.8"/>
        <circle class="cstar-dot" cx="50" cy="94" r="1.5" fill="var(--c)" opacity="0.8"/>
      </g>
    </svg>

  {:else if type === 'metal'}
    <!-- Metal — razor-shard storm with hard impact crack -->
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <ellipse cx="50" cy="50" rx="38" ry="30" fill="var(--c)" opacity="0.14" style="filter:blur(10px)"/>
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
    <!-- Soul — wispy ghost form, skull silhouette, ethereal threads -->
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <ellipse cx="50" cy="48" rx="32" ry="38" fill="var(--c)" opacity="0.20" style="filter:blur(14px)"/>
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
    <!-- Sound — concentric sonic ripples expanding outward + cone -->
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <circle cx="50" cy="50" r="44" fill="var(--c)" opacity="0.10" style="filter:blur(10px)"/>
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
    <!-- Chaos — fractured reality glitch, jagged shards, color-shift -->
    <svg viewBox="0 0 100 100" class="fx-svg chaos-glitch" overflow="visible">
      <circle cx="50" cy="50" r="42" fill="var(--c)" opacity="0.16" style="filter:blur(12px)"/>
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

/* ─── FIRE (revamp) ──────────────────────────────────────────────── */
.fi-bloom    { transform-origin: 50% 50%; animation: sh-bloom 0.85s ease-out forwards; opacity: 0; }
.fi-scorch   { transform-origin: 50% 88%; animation: fi-scorch 0.85s ease-out forwards; }
.fi-echo-bg  { transform-origin: 50% 90%; animation: fi-flame 0.95s ease-out forwards; opacity: 0; }
.fi-echo-mid { transform-origin: 50% 90%; animation: fi-flame 0.85s 0.06s ease-out forwards; opacity: 0; }
.fi-main     { transform-origin: 50% 90%; animation: fi-flame-main 0.85s 0.10s ease-out forwards; }
.fi-tongue   { stroke-dasharray: 50; stroke-dashoffset: 50; animation: fi-tongue 0.55s ease-out forwards; }
.ft1 { animation-delay: 0.20s; }
.ft2 { animation-delay: 0.22s; }
.ft3 { animation-delay: 0.28s; }
.ft4 { animation-delay: 0.30s; }
.fi-emb      { transform-origin: center; transform-box: fill-box; animation: fi-ember-rise 0.85s ease-out forwards; opacity: 0; }
.fi-emb.fe1 { animation-delay: 0.15s; }
.fi-emb.fe2 { animation-delay: 0.18s; }
.fi-emb.fe3 { animation-delay: 0.22s; }
.fi-emb.fe4 { animation-delay: 0.26s; }
.fi-emb.fe5 { animation-delay: 0.30s; }
.fi-emb.fe6 { animation-delay: 0.34s; }
.fi-emb.fe7 { animation-delay: 0.38s; }
.fi-emb.fe8 { animation-delay: 0.42s; }
@keyframes fi-scorch   { 0% { transform: scale(0); opacity: 0; } 30% { transform: scale(1.1); opacity: 0.85; } 100% { transform: scale(1.2); opacity: 0; } }
@keyframes fi-flame    { 0% { transform: scaleY(0.2)  scaleX(0.6) translateY(20px); opacity: 0; } 35% { transform: scaleY(1.1) scaleX(1.05) translateY(0); opacity: 0.85; filter: brightness(1.6); } 100% { transform: scaleY(0.9) scaleX(0.85) translateY(-12px); opacity: 0; } }
@keyframes fi-flame-main{ 0% { transform: scaleY(0.2)  scaleX(0.6); opacity: 0; filter: brightness(3); } 25% { transform: scaleY(1.2) scaleX(1.05); opacity: 1; filter: brightness(2.2) drop-shadow(0 0 16px var(--c)); } 65% { transform: scaleY(1.05) scaleX(1); opacity: 1; filter: brightness(1.5); } 100% { transform: scaleY(0.85) scaleX(0.85) translateY(-14px); opacity: 0; } }
@keyframes fi-tongue   { 0% { stroke-dashoffset: 50; opacity: 0; } 40% { stroke-dashoffset: 0; opacity: 1; filter: brightness(2); } 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes fi-ember-rise{ 0% { transform: translateY(0) scale(0); opacity: 0; } 30% { transform: translateY(-6px) scale(1.3); opacity: 1; filter: brightness(2.5); } 100% { transform: translateY(-32px) scale(0.4); opacity: 0; } }

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
</style>
