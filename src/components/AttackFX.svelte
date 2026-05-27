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

  // Shockwave count: 0 for < S, 1 for S, 2 for SSS, 3 for God
  let shockwaveCount = $derived(gradeIdx >= 6 ? Math.min(3, gradeIdx - 5) : 0)

  // Per-grade slash intensity for weapon attacks. The slash SVG renders this
  // many primary blade lines (plus matching echoes + sparks) so an F-grade
  // weapon shows a single muted swipe and a God-tier weapon erupts into a
  // screen-filling 8-line crosscut.
  //   F (0) → 1 slash · E (1) → 1 · D (2) → 2 · C (3) → 3 · B (4) → 3 ·
  //   A (5) → 4 · S (6) → 5 · SS (7) → 6 · SSS (8) → 7 · God (9) → 8
  const _SLASH_COUNTS = [1, 1, 2, 3, 3, 4, 5, 6, 7, 8]
  let slashCount = $derived(_SLASH_COUNTS[gradeIdx] ?? 3)

  // Procedurally-laid slash lines. Each entry is one diagonal cut across
  // the 100×100 viewBox with a small angle jitter so the bundle reads as a
  // multi-strike combo rather than a perfect fan.
  interface SlashLine { x1: number; y1: number; x2: number; y2: number; w: number; delay: number }
  let slashLines = $derived.by<SlashLine[]>(() => {
    const lines: SlashLine[] = []
    const n = slashCount
    // Spread the bundle across an arc — first slash at the canonical
    // top-right→bottom-left diagonal, others fanned around it.
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : (i - (n - 1) / 2) / Math.max(1, n - 1)  // -0.5 … +0.5
      const xOff = t * 18    // shifts the line left/right
      const yOff = t * 14    // shifts vertically
      const widthShift = t * 6
      const x1 = 72 + xOff + widthShift
      const y1 = 18 + yOff - widthShift
      const x2 = 28 + xOff - widthShift
      const y2 = 62 + yOff + widthShift
      // Top-most line is the thickest, trailing ones taper down.
      const w = Math.max(1.6, 4.2 - i * 0.4)
      const delay = i * 0.045
      lines.push({ x1, y1, x2, y2, w, delay })
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
  const K  = '/fx/k/'
  const CI = '/fx/c/'
  const CF = '/fx/c/'
  const CS = '/fx/c/'

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
  {#if shockwaveCount >= 1}
    <div class="fx-shockwave sw1" style="border-color:{color}66;"></div>
  {/if}
  {#if shockwaveCount >= 2}
    <div class="fx-shockwave sw2" style="border-color:{color}44;animation-delay:0.08s;"></div>
  {/if}
  {#if shockwaveCount >= 3}
    <div class="fx-shockwave sw3" style="border-color:{color}33;animation-delay:0.16s;"></div>
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
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <ellipse cx="50" cy="60" rx="32" ry="30" fill="var(--c)" opacity="0.20" style="filter:blur(14px)"/>
      <g class="fire-echo fe1">
        <path d="M50 88 C38 72 32 60 40 44 C36 57 46 50 44 32 C50 45 60 37 54 24 C66 38 70 58 64 70 C70 58 72 48 64 44 C72 56 68 74 50 88Z" fill="var(--c)" opacity="0.28"/>
      </g>
      <g class="fire-echo fe2">
        <path d="M50 88 C38 72 32 60 40 44 C36 57 46 50 44 32 C50 45 60 37 54 24 C66 38 70 58 64 70 C70 58 72 48 64 44 C72 56 68 74 50 88Z" fill="var(--c)" opacity="0.52"/>
      </g>
      <g class="fire-g">
        <path d="M50 88 C38 72 32 60 40 44 C36 57 46 50 44 32 C50 45 60 37 54 24 C66 38 70 58 64 70 C70 58 72 48 64 44 C72 56 68 74 50 88Z" fill="var(--c)"/>
        <ellipse cx="50" cy="88" rx="14" ry="5" fill="var(--c)" opacity="0.45"/>
      </g>
      <circle class="emb emb1" cx="42" cy="58" r="2.5" fill="var(--c)"/>
      <circle class="emb emb2" cx="61" cy="50" r="2"   fill="var(--c)"/>
      <circle class="emb emb3" cx="50" cy="36" r="1.8" fill="var(--c)"/>
      <circle class="emb emb4" cx="44" cy="70" r="2"   fill="var(--c)" opacity="0.8"/>
      <circle class="emb emb5" cx="58" cy="40" r="1.5" fill="var(--c)" opacity="0.7"/>
      <circle class="emb emb6" cx="37" cy="74" r="1.5" fill="var(--c)" opacity="0.55"/>
    </svg>

  {:else if type === 'lightning'}
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <ellipse cx="50" cy="50" rx="24" ry="46" fill="var(--c)" opacity="0.14" style="filter:blur(12px)"/>
      <polyline class="bolt-glow" pathLength="100" points="62,8 46,44 56,44 38,92" stroke="var(--c)" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.16"/>
      <polyline class="branch br1" points="52,34 65,52 54,52" stroke="var(--c)" stroke-width="1.8" fill="none" stroke-linecap="round" opacity="0.55"/>
      <polyline class="branch br2" points="47,58 35,74 45,74" stroke="var(--c)" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.45"/>
      <polyline class="branch br3" points="55,22 70,30" stroke="var(--c)" stroke-width="1.2" fill="none" stroke-linecap="round" opacity="0.35"/>
      <polyline class="bolt" pathLength="100" points="62,8 46,44 56,44 38,92" stroke="var(--c)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <circle class="bolt-spark bsp" cx="38" cy="92" r="4" fill="var(--c)"/>
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
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <circle cx="50" cy="50" r="38" fill="var(--c)" opacity="0.18" style="filter:blur(14px)"/>
      <g class="shadow-g">
        <circle cx="50" cy="50" r="16" fill="var(--c)" opacity="0.85"/>
        <path d="M50 34 Q36 22 28 30 Q38 36 50 50" fill="var(--c)" opacity="0.7"/>
        <path d="M66 36 Q78 24 72 16 Q64 30 50 50" fill="var(--c)" opacity="0.7"/>
        <path d="M66 64 Q78 76 70 84 Q60 70 50 50" fill="var(--c)" opacity="0.65"/>
        <path d="M34 64 Q18 70 16 82 Q28 70 50 50" fill="var(--c)" opacity="0.65"/>
        <path class="tendril t1" d="M50 50 Q30 35 20 20" stroke="var(--c)" stroke-width="1.5" fill="none" opacity="0.4" stroke-linecap="round"/>
        <path class="tendril t2" d="M50 50 Q70 35 82 18" stroke="var(--c)" stroke-width="1.5" fill="none" opacity="0.4" stroke-linecap="round"/>
        <path class="tendril t3" d="M50 50 Q68 68 80 82" stroke="var(--c)" stroke-width="1.2" fill="none" opacity="0.35" stroke-linecap="round"/>
        <path class="tendril t4" d="M50 50 Q32 68 20 80" stroke="var(--c)" stroke-width="1.2" fill="none" opacity="0.35" stroke-linecap="round"/>
      </g>
    </svg>

  {:else if type === 'holy'}
    {#if direction === 'center'}
      <!-- Heal mode: radiant cross burst -->
      <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
        <circle cx="50" cy="50" r="40" fill="var(--c)" opacity="0.18" style="filter:blur(16px)"/>
        <g class="holy-g">
          <circle cx="50" cy="50" r="9" fill="var(--c)"/>
          <line x1="50" y1="39" x2="50" y2="13" stroke="var(--c)" stroke-width="3.5" stroke-linecap="round"/>
          <line x1="50" y1="61" x2="50" y2="87" stroke="var(--c)" stroke-width="3.5" stroke-linecap="round"/>
          <line x1="39" y1="50" x2="13" y2="50" stroke="var(--c)" stroke-width="3.5" stroke-linecap="round"/>
          <line x1="61" y1="50" x2="87" y2="50" stroke="var(--c)" stroke-width="3.5" stroke-linecap="round"/>
          <line x1="41" y1="41" x2="22" y2="22" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="59" y1="59" x2="78" y2="78" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="59" y1="41" x2="78" y2="22" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="41" y1="59" x2="22" y2="78" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round"/>
          <circle class="holy-mote hm1" cx="50" cy="13" r="2.5" fill="var(--c)"/>
          <circle class="holy-mote hm2" cx="87" cy="50" r="2"   fill="var(--c)"/>
          <circle class="holy-mote hm3" cx="50" cy="87" r="2.5" fill="var(--c)"/>
          <circle class="holy-mote hm4" cx="13" cy="50" r="2"   fill="var(--c)"/>
        </g>
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
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <circle cx="50" cy="50" r="40" fill="var(--c)" opacity="0.10" style="filter:blur(10px)"/>
      <circle cx="50" cy="50" r="37" stroke="var(--c)" stroke-width="2.5" fill="none" class="tr tr1"/>
      <circle cx="50" cy="50" r="27" stroke="var(--c)" stroke-width="1.8" fill="none" class="tr tr2" opacity="0.75"/>
      <circle cx="50" cy="50" r="16" stroke="var(--c)" stroke-width="1.2" fill="none" class="tr tr3" opacity="0.55"/>
      <line x1="50" y1="50" x2="50" y2="20" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round" class="th th1"/>
      <line x1="50" y1="50" x2="72" y2="50" stroke="var(--c)" stroke-width="2" stroke-linecap="round" class="th th2"/>
      <circle cx="50" cy="50" r="3.5" fill="var(--c)"/>
      <circle class="time-spark ts1" cx="50" cy="13" r="2" fill="var(--c)" opacity="0.7"/>
      <circle class="time-spark ts2" cx="87" cy="50" r="1.8" fill="var(--c)" opacity="0.6"/>
    </svg>

  {:else if type === 'psychic'}
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <circle cx="50" cy="50" r="42" fill="var(--c)" opacity="0.12" style="filter:blur(12px)"/>
      <circle cx="50" cy="50" r="10" stroke="var(--c)" stroke-width="2.5" fill="none" class="pr pr1"/>
      <circle cx="50" cy="50" r="24" stroke="var(--c)" stroke-width="2"   fill="none" class="pr pr2" opacity="0.8"/>
      <circle cx="50" cy="50" r="38" stroke="var(--c)" stroke-width="1.5" fill="none" class="pr pr3" opacity="0.5"/>
      <circle cx="50" cy="50" r="5" fill="var(--c)" class="pr-core"/>
      <line class="psy-wave pw1" x1="28" y1="28" x2="72" y2="72" stroke="var(--c)" stroke-width="1" opacity="0.3" stroke-linecap="round"/>
      <line class="psy-wave pw2" x1="72" y1="28" x2="28" y2="72" stroke="var(--c)" stroke-width="1" opacity="0.3" stroke-linecap="round"/>
    </svg>

  {:else if type === 'poison'}
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <circle cx="50" cy="50" r="36" fill="var(--c)" opacity="0.13" style="filter:blur(10px)"/>
      <circle cx="50" cy="44" r="11" fill="var(--c)" class="pb pb1"/>
      <circle cx="34" cy="52" r="7.5" fill="var(--c)" class="pb pb2" opacity="0.85"/>
      <circle cx="66" cy="48" r="8.5" fill="var(--c)" class="pb pb3" opacity="0.9"/>
      <circle cx="44" cy="66" r="6"   fill="var(--c)" class="pb pb4" opacity="0.75"/>
      <circle cx="62" cy="66" r="5"   fill="var(--c)" class="pb pb5" opacity="0.65"/>
      <circle cx="50" cy="28" r="6"   fill="var(--c)" class="pb pb6" opacity="0.8"/>
      <circle cx="46" cy="42" r="2" fill="white" opacity="0.65"/>
      <circle cx="54" cy="42" r="2" fill="white" opacity="0.65"/>
      <path d="M46 48 Q50 51 54 48" stroke="white" stroke-width="1.2" fill="none" opacity="0.65"/>
      <circle class="drip dr1" cx="44" cy="75" r="1.5" fill="var(--c)" opacity="0.7"/>
      <circle class="drip dr2" cx="56" cy="78" r="1.2" fill="var(--c)" opacity="0.6"/>
    </svg>

  {:else if type === 'gravity'}
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <circle cx="50" cy="50" r="40" fill="var(--c)" opacity="0.13" style="filter:blur(12px)"/>
      <g class="grav-g">
        <line x1="16" y1="50" x2="42" y2="50" stroke="var(--c)" stroke-width="3" stroke-linecap="round"/>
        <path d="M42 50 L36 44 M42 50 L36 56" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round" fill="none"/>
        <line x1="84" y1="50" x2="58" y2="50" stroke="var(--c)" stroke-width="3" stroke-linecap="round"/>
        <path d="M58 50 L64 44 M58 50 L64 56" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round" fill="none"/>
        <line x1="50" y1="16" x2="50" y2="42" stroke="var(--c)" stroke-width="3" stroke-linecap="round"/>
        <path d="M50 42 L44 36 M50 42 L56 36" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round" fill="none"/>
        <line x1="50" y1="84" x2="50" y2="58" stroke="var(--c)" stroke-width="3" stroke-linecap="round"/>
        <path d="M50 58 L44 64 M50 58 L56 64" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round" fill="none"/>
        <circle cx="50" cy="50" r="8" fill="var(--c)"/>
        <circle class="debris db1" cx="20" cy="20" r="2"   fill="var(--c)" opacity="0.6"/>
        <circle class="debris db2" cx="80" cy="20" r="1.8" fill="var(--c)" opacity="0.55"/>
        <circle class="debris db3" cx="20" cy="80" r="1.5" fill="var(--c)" opacity="0.5"/>
        <circle class="debris db4" cx="80" cy="80" r="2"   fill="var(--c)" opacity="0.6"/>
      </g>
    </svg>

  {:else if type === 'combo'}
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <ellipse cx="50" cy="50" rx="44" ry="40" fill="var(--c)" opacity="0.10" style="filter:blur(10px)"/>
      <g class="cmb cmb1">
        <line x1="22" y1="22" x2="30" y2="30" stroke="var(--c)" stroke-width="4" stroke-linecap="round"/>
        <line x1="30" y1="22" x2="22" y2="30" stroke="var(--c)" stroke-width="4" stroke-linecap="round"/>
        <circle cx="26" cy="26" r="3" fill="var(--c)" opacity="0.4"/>
      </g>
      <g class="cmb cmb2">
        <line x1="40" y1="36" x2="48" y2="44" stroke="var(--c)" stroke-width="4" stroke-linecap="round"/>
        <line x1="48" y1="36" x2="40" y2="44" stroke="var(--c)" stroke-width="4" stroke-linecap="round"/>
        <circle cx="44" cy="40" r="3" fill="var(--c)" opacity="0.4"/>
      </g>
      <g class="cmb cmb3">
        <line x1="56" y1="50" x2="64" y2="58" stroke="var(--c)" stroke-width="4" stroke-linecap="round"/>
        <line x1="64" y1="50" x2="56" y2="58" stroke="var(--c)" stroke-width="4" stroke-linecap="round"/>
        <circle cx="60" cy="54" r="3" fill="var(--c)" opacity="0.4"/>
      </g>
      <g class="cmb cmb4">
        <line x1="66" y1="26" x2="74" y2="34" stroke="var(--c)" stroke-width="3.5" stroke-linecap="round"/>
        <line x1="74" y1="26" x2="66" y2="34" stroke="var(--c)" stroke-width="3.5" stroke-linecap="round"/>
      </g>
      <g class="cmb cmb5">
        <line x1="46" y1="64" x2="54" y2="72" stroke="var(--c)" stroke-width="3.5" stroke-linecap="round"/>
        <line x1="54" y1="64" x2="46" y2="72" stroke="var(--c)" stroke-width="3.5" stroke-linecap="round"/>
      </g>
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
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <!-- Bloom glow -->
      <circle cx="50" cy="50" r="52" fill="var(--c)" opacity="0.30" class="shld-bloom" style="filter:blur(22px)"/>
      <!-- Shield body -->
      <g class="shld-body">
        <polygon class="shld-hex" points="50,8 88,29 88,71 50,92 12,71 12,29" stroke="var(--c)" stroke-width="4" fill="var(--c)" fill-opacity="0.18"/>
        <polygon points="50,20 76,35 76,65 50,80 24,65 24,35" stroke="var(--c)" stroke-width="2" fill="none" opacity="0.6"/>
        <polygon points="50,30 66,40 66,60 50,70 34,60 34,40" stroke="var(--c)" stroke-width="1" fill="var(--c)" fill-opacity="0.10" opacity="0.45"/>
        <line x1="50" y1="26" x2="50" y2="74" stroke="var(--c)" stroke-width="3.5" stroke-linecap="round" opacity="0.85"/>
        <line x1="26" y1="50" x2="74" y2="50" stroke="var(--c)" stroke-width="3.5" stroke-linecap="round" opacity="0.85"/>
        <circle cx="50" cy="50" r="7" fill="white" opacity="0.85" class="shld-core"/>
      </g>
      <!-- Three expanding block-impact rings -->
      <circle class="blk-ring bkr1" cx="50" cy="50" r="46" stroke="var(--c)" stroke-width="5" fill="none"/>
      <circle class="blk-ring bkr2" cx="50" cy="50" r="46" stroke="var(--c)" stroke-width="3" fill="none"/>
      <circle class="blk-ring bkr3" cx="50" cy="50" r="46" stroke="var(--c)" stroke-width="2" fill="none"/>
      <!-- Hex-vertex sparks -->
      <circle class="blk-spark bks1" cx="50" cy="8"  r="4"   fill="var(--c)"/>
      <circle class="blk-spark bks2" cx="88" cy="29" r="3.5" fill="var(--c)"/>
      <circle class="blk-spark bks3" cx="88" cy="71" r="3.5" fill="var(--c)"/>
      <circle class="blk-spark bks4" cx="50" cy="92" r="4"   fill="var(--c)"/>
      <circle class="blk-spark bks5" cx="12" cy="71" r="3.5" fill="var(--c)"/>
      <circle class="blk-spark bks6" cx="12" cy="29" r="3.5" fill="var(--c)"/>
    </svg>

  {:else if type === 'berserker'}
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <circle cx="50" cy="50" r="44" fill="var(--c)" opacity="0.22" style="filter:blur(16px)"/>
      <g class="bsrk-g">
        <circle cx="50" cy="50" r="13" fill="var(--c)"/>
        <line x1="50" y1="37" x2="50" y2="10" stroke="var(--c)" stroke-width="7" stroke-linecap="round"/>
        <line x1="50" y1="63" x2="50" y2="90" stroke="var(--c)" stroke-width="7" stroke-linecap="round"/>
        <line x1="37" y1="50" x2="10" y2="50" stroke="var(--c)" stroke-width="7" stroke-linecap="round"/>
        <line x1="63" y1="50" x2="90" y2="50" stroke="var(--c)" stroke-width="7" stroke-linecap="round"/>
        <line x1="41" y1="41" x2="22" y2="22" stroke="var(--c)" stroke-width="6" stroke-linecap="round"/>
        <line x1="59" y1="59" x2="78" y2="78" stroke="var(--c)" stroke-width="6" stroke-linecap="round"/>
        <line x1="59" y1="41" x2="78" y2="22" stroke="var(--c)" stroke-width="6" stroke-linecap="round"/>
        <line x1="41" y1="59" x2="22" y2="78" stroke="var(--c)" stroke-width="6" stroke-linecap="round"/>
      </g>
      <circle class="rage-mote rm1" cx="50" cy="6"  r="3"   fill="var(--c)" opacity="0.7"/>
      <circle class="rage-mote rm2" cx="94" cy="50" r="2.5" fill="var(--c)" opacity="0.6"/>
      <circle class="rage-mote rm3" cx="50" cy="94" r="3"   fill="var(--c)" opacity="0.7"/>
      <circle class="rage-mote rm4" cx="6"  cy="50" r="2.5" fill="var(--c)" opacity="0.6"/>
    </svg>

  {:else if type === 'wind'}
    <svg viewBox="0 0 100 100" class="fx-svg wind-g" overflow="visible">
      <ellipse cx="55" cy="50" rx="38" ry="28" fill="var(--c)" opacity="0.10" style="filter:blur(10px)"/>
      <path class="wl wl1" d="M16 38 Q36 26 56 38 Q76 50 88 38" stroke="var(--c)" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <path class="wl wl2" d="M10 53 Q32 40 54 53 Q76 66 90 53" stroke="var(--c)" stroke-width="3"   fill="none" stroke-linecap="round" opacity="0.8"/>
      <path class="wl wl3" d="M18 67 Q40 56 60 67 Q76 76 84 67" stroke="var(--c)" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.6"/>
      <circle class="wind-mote wm1" cx="88" cy="38" r="2"   fill="var(--c)" opacity="0.6"/>
      <circle class="wind-mote wm2" cx="90" cy="53" r="1.8" fill="var(--c)" opacity="0.5"/>
      <circle class="wind-mote wm3" cx="84" cy="67" r="1.5" fill="var(--c)" opacity="0.4"/>
    </svg>

  {:else if type === 'earth'}
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <ellipse cx="50" cy="88" rx="44" ry="12" fill="var(--c)" opacity="0.16" style="filter:blur(8px)"/>
      <g class="erth-g">
        <polygon class="es es2" points="50,88 43,44 57,44" fill="var(--c)"/>
        <polygon class="es es1" points="30,88 24,60 36,60" fill="var(--c)"/>
        <polygon class="es es3" points="70,88 64,60 76,60" fill="var(--c)"/>
        <polygon class="es es4" points="18,88 14,72 22,72" fill="var(--c)" opacity="0.7"/>
        <polygon class="es es5" points="82,88 78,70 86,70" fill="var(--c)" opacity="0.7"/>
        <line x1="8" y1="88" x2="92" y2="88" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round"/>
      </g>
      <circle class="rock-chip rc1" cx="35" cy="42" r="2"   fill="var(--c)" opacity="0.6"/>
      <circle class="rock-chip rc2" cx="65" cy="38" r="1.8" fill="var(--c)" opacity="0.55"/>
      <circle class="rock-chip rc3" cx="50" cy="36" r="1.5" fill="var(--c)" opacity="0.5"/>
      <circle class="rock-chip rc4" cx="22" cy="58" r="1.5" fill="var(--c)" opacity="0.45"/>
    </svg>

  {:else if type === 'blood'}
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <circle cx="50" cy="50" r="36" fill="var(--c)" opacity="0.18" style="filter:blur(12px)"/>
      <g class="bld-g">
        <circle cx="50" cy="50" r="12" fill="var(--c)"/>
        <ellipse cx="50" cy="27" rx="4.5" ry="7"   fill="var(--c)" class="bd bd1"/>
        <ellipse cx="68" cy="34" rx="4"   ry="6"   fill="var(--c)" class="bd bd2" transform="rotate(40 68 34)"/>
        <ellipse cx="78" cy="54" rx="3.5" ry="6"   fill="var(--c)" class="bd bd3" transform="rotate(85 78 54)"/>
        <ellipse cx="66" cy="72" rx="3.5" ry="5.5" fill="var(--c)" class="bd bd4" transform="rotate(130 66 72)"/>
        <ellipse cx="34" cy="72" rx="3.5" ry="5.5" fill="var(--c)" class="bd bd5" transform="rotate(-130 34 72)"/>
        <ellipse cx="22" cy="54" rx="3.5" ry="6"   fill="var(--c)" class="bd bd6" transform="rotate(-85 22 54)"/>
        <ellipse cx="32" cy="34" rx="4"   ry="6"   fill="var(--c)" class="bd bd7" transform="rotate(-40 32 34)"/>
      </g>
    </svg>

  {:else if type === 'void'}
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <circle cx="50" cy="50" r="42" fill="var(--c)" opacity="0.16" style="filter:blur(14px)"/>
      <g class="void-g">
        <circle cx="50" cy="50" r="38" stroke="var(--c)" stroke-width="2"   fill="none" opacity="0.4" class="vr vr3"/>
        <circle cx="50" cy="50" r="28" stroke="var(--c)" stroke-width="2.5" fill="none" opacity="0.65" class="vr vr2"/>
        <circle cx="50" cy="50" r="17" stroke="var(--c)" stroke-width="3"   fill="none" opacity="0.85" class="vr vr1"/>
        <circle cx="50" cy="50" r="9"  fill="var(--c)" class="void-core"/>
        <circle class="void-debris vd1" cx="20" cy="20" r="2"   fill="var(--c)" opacity="0.55"/>
        <circle class="void-debris vd2" cx="80" cy="18" r="1.8" fill="var(--c)" opacity="0.5"/>
        <circle class="void-debris vd3" cx="82" cy="80" r="2"   fill="var(--c)" opacity="0.55"/>
        <circle class="void-debris vd4" cx="18" cy="78" r="1.5" fill="var(--c)" opacity="0.45"/>
        <circle class="void-debris vd5" cx="50" cy="8"  r="1.8" fill="var(--c)" opacity="0.5"/>
        <circle class="void-debris vd6" cx="92" cy="50" r="1.5" fill="var(--c)" opacity="0.45"/>
      </g>
    </svg>

  {:else if type === 'energy'}
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <circle cx="50" cy="50" r="44" fill="var(--c)" opacity="0.16" style="filter:blur(14px)"/>
      <g class="enrg-g">
        <line x1="50" y1="50" x2="50" y2="6"  stroke="var(--c)" stroke-width="2" opacity="0.6" class="eb"/>
        <line x1="50" y1="50" x2="50" y2="94" stroke="var(--c)" stroke-width="2" opacity="0.6" class="eb"/>
        <line x1="50" y1="50" x2="6"  y2="50" stroke="var(--c)" stroke-width="2" opacity="0.6" class="eb"/>
        <line x1="50" y1="50" x2="94" y2="50" stroke="var(--c)" stroke-width="2" opacity="0.6" class="eb"/>
        <circle cx="50" cy="50" r="27" stroke="var(--c)" stroke-width="2"   fill="none" class="er er1" opacity="0.7"/>
        <circle cx="50" cy="50" r="39" stroke="var(--c)" stroke-width="1.5" fill="none" class="er er2" opacity="0.5"/>
        <circle cx="50" cy="50" r="13" fill="var(--c)" class="enrg-core" opacity="0.95"/>
        <circle class="enrg-mote em1" cx="50" cy="6"  r="2.5" fill="var(--c)" opacity="0.7"/>
        <circle class="enrg-mote em2" cx="94" cy="50" r="2"   fill="var(--c)" opacity="0.6"/>
        <circle class="enrg-mote em3" cx="50" cy="94" r="2.5" fill="var(--c)" opacity="0.7"/>
        <circle class="enrg-mote em4" cx="6"  cy="50" r="2"   fill="var(--c)" opacity="0.6"/>
      </g>
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
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <circle cx="50" cy="50" r="40" fill="var(--c)" opacity="0.22" style="filter:blur(14px)"/>
      <g class="counter-g">
        <circle class="counter-ring cr2" cx="50" cy="50" r="42" stroke="var(--c)" stroke-width="1.5" fill="none" opacity="0.35"/>
        <circle class="counter-ring cr1" cx="50" cy="50" r="26" stroke="var(--c)" stroke-width="2.5" fill="none" opacity="0.65"/>
        <line class="ct ct1" x1="50" y1="50" x2="14" y2="14" stroke="var(--c)" stroke-width="3"   stroke-linecap="round"/>
        <line class="ct ct2" x1="50" y1="50" x2="86" y2="14" stroke="var(--c)" stroke-width="3"   stroke-linecap="round"/>
        <line class="ct ct3" x1="50" y1="50" x2="14" y2="86" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round"/>
        <line class="ct ct4" x1="50" y1="50" x2="86" y2="86" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round"/>
        <line class="ct ct5" x1="50" y1="50" x2="50" y2="8"  stroke="var(--c)" stroke-width="3"   stroke-linecap="round"/>
        <line class="ct ct6" x1="50" y1="50" x2="50" y2="92" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round"/>
        <line class="ct ct7" x1="50" y1="50" x2="8"  y2="50" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round"/>
        <line class="ct ct8" x1="50" y1="50" x2="92" y2="50" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="50" cy="50" r="10" fill="var(--c)" class="counter-core"/>
        <circle cx="50" cy="50" r="5"  fill="white"    opacity="0.9" class="counter-inner"/>
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
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <!-- Glow aura -->
      <ellipse cx="50" cy="60" rx="30" ry="34" fill="var(--c)" opacity="0.22" class="water-glow" style="filter:blur(14px)"/>
      <!-- Trail ghost droplets — offset in the wake direction -->
      <g class="water-trail wtr3" transform="translate({isRtl ? 36 : -36}, 0)">
        <ellipse cx="50" cy="59" rx="8"  ry="12" fill="var(--c)" opacity="0.22"/>
      </g>
      <g class="water-trail wtr2" transform="translate({isRtl ? 22 : -22}, 0)">
        <ellipse cx="50" cy="58" rx="10" ry="15" fill="var(--c)" opacity="0.38"/>
      </g>
      <g class="water-trail wtr1" transform="translate({isRtl ? 11 : -11}, 0)">
        <ellipse cx="50" cy="57" rx="12" ry="18" fill="var(--c)" opacity="0.55"/>
      </g>
      <!-- Main water droplet -->
      <g class="water-main">
        <path d="M50 20 C34 36 26 52 26 64 C26 77 37 85 50 85 C63 85 74 77 74 64 C74 52 66 36 50 20Z" fill="var(--c)"/>
        <ellipse cx="42" cy="55" rx="7" ry="11" fill="white" opacity="0.20" transform="rotate(-18 42 55)"/>
        <circle cx="50" cy="25" r="4.5" fill="white" opacity="0.58"/>
        <ellipse cx="38" cy="45" rx="5" ry="8" fill="white" opacity="0.12"/>
      </g>
      <!-- Splash rings (appear near end of arc travel) -->
      <ellipse class="water-ripple wr1" cx="50" cy="80" rx="13" ry="5" stroke="var(--c)" stroke-width="2" fill="none"/>
      <ellipse class="water-ripple wr2" cx="50" cy="80" rx="24" ry="10" stroke="var(--c)" stroke-width="1.5" fill="none"/>
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
    <!-- Nature — spiraling vines, blooming flowers, leaf burst -->
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <ellipse cx="50" cy="55" rx="38" ry="34" fill="var(--c)" opacity="0.16" style="filter:blur(12px)"/>
      <!-- Spiral vines from center outward -->
      <g class="nat-vines">
        <path d="M50 50 Q40 35 32 22 Q26 14 20 10" stroke="var(--c)" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.85"/>
        <path d="M50 50 Q60 35 68 22 Q74 14 82 10" stroke="var(--c)" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.85"/>
        <path d="M50 50 Q40 65 32 78 Q26 86 18 90" stroke="var(--c)" stroke-width="2"   fill="none" stroke-linecap="round" opacity="0.75"/>
        <path d="M50 50 Q60 65 68 78 Q74 86 84 90" stroke="var(--c)" stroke-width="2"   fill="none" stroke-linecap="round" opacity="0.75"/>
        <path d="M50 50 Q30 50 14 48" stroke="var(--c)" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.7"/>
        <path d="M50 50 Q70 50 88 52" stroke="var(--c)" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.7"/>
      </g>
      <!-- Leaves along vines -->
      <g class="nat-leaves">
        <ellipse class="leaf l1" cx="28" cy="20" rx="4" ry="2.5" fill="var(--c)" transform="rotate(-30 28 20)"/>
        <ellipse class="leaf l2" cx="72" cy="20" rx="4" ry="2.5" fill="var(--c)" transform="rotate(30 72 20)"/>
        <ellipse class="leaf l3" cx="26" cy="82" rx="4" ry="2.5" fill="var(--c)" opacity="0.85" transform="rotate(40 26 82)"/>
        <ellipse class="leaf l4" cx="74" cy="82" rx="4" ry="2.5" fill="var(--c)" opacity="0.85" transform="rotate(-40 74 82)"/>
      </g>
      <!-- Bloom center -->
      <g class="nat-bloom">
        <circle cx="50" cy="50" r="10" fill="var(--c)"/>
        <ellipse cx="50" cy="42" rx="4" ry="6"   fill="var(--c)" opacity="0.95"/>
        <ellipse cx="58" cy="50" rx="6" ry="4"   fill="var(--c)" opacity="0.9"/>
        <ellipse cx="50" cy="58" rx="4" ry="6"   fill="var(--c)" opacity="0.9"/>
        <ellipse cx="42" cy="50" rx="6" ry="4"   fill="var(--c)" opacity="0.95"/>
        <circle cx="50" cy="50" r="3" fill="white" opacity="0.85"/>
      </g>
      <!-- Pollen motes -->
      <circle class="pollen p1" cx="34" cy="40" r="1.4" fill="var(--c)" opacity="0.7"/>
      <circle class="pollen p2" cx="66" cy="40" r="1.4" fill="var(--c)" opacity="0.7"/>
      <circle class="pollen p3" cx="34" cy="60" r="1.2" fill="var(--c)" opacity="0.6"/>
      <circle class="pollen p4" cx="66" cy="60" r="1.2" fill="var(--c)" opacity="0.6"/>
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
.tr { transform-origin: 50% 50%; }
.tr1 { animation: ring-expand 0.82s ease-out forwards; }
.tr2 { animation: ring-expand 0.82s 0.07s ease-out forwards; }
.tr3 { animation: ring-expand 0.82s 0.14s ease-out forwards; }
.th { transform-origin: 50% 50%; }
.th1 { animation: clock-spin 0.82s linear forwards; }
.th2 { animation: clock-spin 0.55s linear forwards; }
@keyframes ring-expand {
  0%   { transform: scale(0.2); opacity: 0; }
  40%  { transform: scale(1.05); opacity: 1; }
  100% { transform: scale(1.3); opacity: 0; }
}
@keyframes clock-spin {
  0%   { transform: rotate(0deg); opacity: 1; }
  100% { transform: rotate(720deg); opacity: 0; }
}
.time-spark { transform-origin: center; transform-box: fill-box; animation: spark-pop 0.5s 0.22s ease-out forwards; opacity: 0; }

/* ─── PSYCHIC ────────────────────────────────────────────────────── */
.pr { transform-origin: 50% 50%; }
.pr1 { animation: ripple 0.72s ease-out forwards; }
.pr2 { animation: ripple 0.72s 0.11s ease-out forwards; }
.pr3 { animation: ripple 0.72s 0.22s ease-out forwards; }
.pr-core { transform-origin: 50% 50%; animation: core-pulse 0.72s ease-out forwards; }
@keyframes ripple {
  0%   { transform: scale(0.1); opacity: 0; }
  30%  { transform: scale(1.05); opacity: 1; }
  100% { transform: scale(1.45); opacity: 0; }
}
@keyframes core-pulse {
  0%   { transform: scale(0); opacity: 0; }
  40%  { transform: scale(1.6); opacity: 1; }
  100% { transform: scale(1.0); opacity: 0; }
}
.psy-wave { stroke-dasharray: 80; stroke-dashoffset: 80; }
.pw1 { animation: branch-draw 0.6s 0.10s ease-out forwards, bolt-fade 0.4s 0.60s forwards; }
.pw2 { animation: branch-draw 0.6s 0.18s ease-out forwards, bolt-fade 0.4s 0.65s forwards; }

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
  animation: fx-shockwave-expand 0.55s ease-out forwards;
  pointer-events: none;
}
@keyframes fx-shockwave-expand {
  0%   { width: 0; height: 0; opacity: 1; }
  100% { width: 160px; height: 160px; opacity: 0; }
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
</style>
