<script lang="ts">
  interface Props {
    type: string
    color?: string
    size?: number
    direction?: 'ltr' | 'rtl' | 'center'
  }
  let { type, color = '#ffffff', size = 100, direction = 'center' }: Props = $props()

  const swirlTypes = new Set(['void', 'psychic', 'time', 'shadow', 'gravity', 'cursed'])
  const crashTypes = new Set(['crit', 'berserker', 'earth', 'slash'])

  let flyClass = $derived(
    direction === 'center' ? '' :
    swirlTypes.has(type) ? `fx-${direction}-swirl` :
    crashTypes.has(type) ? `fx-${direction}-crash` :
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
      p(K+'circle_05.png',  50, 50,   0,   0,   0, 1.5, 0.00, 36),
      p(K+'window_01.png',  50, 50,  22, -20,  20, 1.2, 0.06, 28),
      p(K+'window_02.png',  50, 50, -20,  22, -15, 1.0, 0.10, 26),
      p(K+'light_03.png',   50, 50,  18, -25,  30, 0.8, 0.14, 22),
      p(K+'circle_01.png',  50, 50, -25,  18, -25, 0.7, 0.18, 20),
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
      p(K+'trace_04.png',   50, 50,  35,  -5,  10, 1.2, 0.00, 24),
      p(K+'trace_06.png',   50, 50,  30, -10, -12, 1.0, 0.06, 22),
      p(K+'circle_03.png',  50, 50,  28,  12,  15, 0.8, 0.10, 18),
      p(K+'smoke_02.png',   50, 50, -10,   8, -10, 0.6, 0.14, 16),
    ],
  }

  const GENERIC_PARTICLES: Sprite[] = [
    p(K+'spark_01.png',   50, 50,  22, -18,  30, 1.2, 0.00, 22),
    p(K+'circle_01.png',  50, 50, -20,  20, -25, 1.0, 0.06, 20),
    p(K+'star_01.png',    50, 50,  18,  22,  15, 0.9, 0.10, 18),
    p(K+'smoke_02.png',   50, 50, -22, -15, -20, 0.7, 0.14, 16),
    p(CI+'impact_4.png',  50, 50,   0,   0,   0, 1.3, 0.18, 30),
  ]

  let particleSprites = $derived(PARTICLES[type] ?? GENERIC_PARTICLES)
</script>

<div class="fx-root {flyClass}" style="width:{size}px;height:{size}px;--c:{color};">

  {#if type === 'slash'}
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <ellipse cx="50" cy="38" rx="34" ry="22" fill="var(--c)" opacity="0.13" style="filter:blur(10px)"/>
      <line class="sl-echo sl-e1" x1="70" y1="15" x2="26" y2="59" stroke="var(--c)" stroke-width="3" stroke-linecap="round" opacity="0.25"/>
      <line class="sl-echo sl-e2" x1="78" y1="25" x2="34" y2="69" stroke="var(--c)" stroke-width="2" stroke-linecap="round" opacity="0.18"/>
      <line class="sl sl1" x1="72" y1="18" x2="28" y2="62" stroke="var(--c)" stroke-width="4" stroke-linecap="round"/>
      <line class="sl sl2" x1="80" y1="28" x2="36" y2="72" stroke="var(--c)" stroke-width="3.5" stroke-linecap="round"/>
      <line class="sl sl3" x1="64" y1="12" x2="20" y2="56" stroke="var(--c)" stroke-width="2" stroke-linecap="round"/>
      <circle class="sp sp1" cx="72" cy="18" r="3.5" fill="var(--c)"/>
      <circle class="sp sp2" cx="28" cy="62" r="3"   fill="var(--c)"/>
      <circle class="sp sp3" cx="80" cy="28" r="2.5" fill="var(--c)"/>
      <circle class="sp sp4" cx="64" cy="12" r="2"   fill="var(--c)"/>
      <circle class="sp sp5" cx="20" cy="56" r="2"   fill="var(--c)" opacity="0.7"/>
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
      <circle cx="50" cy="50" r="42" fill="var(--c)" opacity="0.11" style="filter:blur(10px)"/>
      <g class="shld-g">
        <polygon class="hex" points="50,14 80,32 80,68 50,86 20,68 20,32" stroke="var(--c)" stroke-width="3.5" fill="none"/>
        <polygon points="50,26 68,36 68,64 50,74 32,64 32,36" stroke="var(--c)" stroke-width="1.5" fill="none" opacity="0.45"/>
        <line x1="50" y1="36" x2="50" y2="64" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round" opacity="0.65"/>
        <line x1="36" y1="50" x2="64" y2="50" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round" opacity="0.65"/>
      </g>
      <circle class="shield-ripple sr1" cx="50" cy="50" r="44" stroke="var(--c)" stroke-width="1.5" fill="none" opacity="0.3"/>
      <circle class="shield-ripple sr2" cx="50" cy="50" r="44" stroke="var(--c)" stroke-width="1"   fill="none" opacity="0.2"/>
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
      <g class="dodge-g">
        <ellipse class="dg dg3" cx="50" cy="50" rx="28" ry="44" stroke="var(--c)" stroke-width="1"   fill="none" opacity="0.15"/>
        <ellipse class="dg dg2" cx="50" cy="50" rx="22" ry="38" stroke="var(--c)" stroke-width="1.5" fill="none" opacity="0.32"/>
        <ellipse class="dg dg1" cx="50" cy="50" rx="16" ry="32" stroke="var(--c)" stroke-width="2"   fill="none" opacity="0.55"/>
        <line class="dash dl1" x1="6"  y1="34" x2="34" y2="34" stroke="var(--c)" stroke-width="1.5" stroke-linecap="round"/>
        <line class="dash dl2" x1="4"  y1="50" x2="28" y2="50" stroke="var(--c)" stroke-width="2"   stroke-linecap="round"/>
        <line class="dash dl3" x1="8"  y1="66" x2="34" y2="66" stroke="var(--c)" stroke-width="1.5" stroke-linecap="round"/>
        <line class="dash dl4" x1="10" y1="42" x2="30" y2="42" stroke="var(--c)" stroke-width="1"   stroke-linecap="round" opacity="0.55"/>
        <line class="dash dl5" x1="12" y1="58" x2="32" y2="58" stroke="var(--c)" stroke-width="1"   stroke-linecap="round" opacity="0.55"/>
        <path class="swoosh sw1" d="M18 24 Q50 14 82 28" stroke="var(--c)" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.45"/>
        <path class="swoosh sw2" d="M18 76 Q50 86 82 72" stroke="var(--c)" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.45"/>
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
}
.fx-svg { width: 100%; height: 100%; }

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
  0%   { transform: translate(0,0)       scale(0.5);  opacity: 0;   filter: drop-shadow(0 0 6px var(--c)); }
  8%   { transform: translate(2vw,-6px)  scale(1.1);  opacity: 1;   filter: drop-shadow(0 0 14px var(--c)); }
  45%  { transform: translate(28vw,-32px) scale(1.05); opacity: 1;   filter: drop-shadow(0 0 18px var(--c)); }
  70%  { transform: translate(55vw,-6px)  scale(1.05); opacity: 1;   filter: drop-shadow(0 0 14px var(--c)); }
  82%  { transform: translate(60vw,0px)   scale(1.55); opacity: 1;   filter: brightness(3.2) drop-shadow(0 0 32px var(--c)); }
  100% { transform: translate(60vw,0px)   scale(0.3);  opacity: 0;   filter: brightness(1); }
}
@keyframes fly-rtl-arc {
  0%   { transform: translate(0,0)        scale(0.5);  opacity: 0;   filter: drop-shadow(0 0 6px var(--c)); }
  8%   { transform: translate(-2vw,-6px)  scale(1.1);  opacity: 1;   filter: drop-shadow(0 0 14px var(--c)); }
  45%  { transform: translate(-28vw,-32px) scale(1.05); opacity: 1;   filter: drop-shadow(0 0 18px var(--c)); }
  70%  { transform: translate(-55vw,-6px)  scale(1.05); opacity: 1;   filter: drop-shadow(0 0 14px var(--c)); }
  82%  { transform: translate(-60vw,0px)   scale(1.55); opacity: 1;   filter: brightness(3.2) drop-shadow(0 0 32px var(--c)); }
  100% { transform: translate(-60vw,0px)   scale(0.3);  opacity: 0;   filter: brightness(1); }
}

/* ─── SWIRL: spiral corkscrew path ───────────────────────────────── */
.fx-ltr-swirl { animation: fly-ltr-swirl 0.75s ease-in-out forwards; }
.fx-rtl-swirl { animation: fly-rtl-swirl 0.75s ease-in-out forwards; }

@keyframes fly-ltr-swirl {
  0%   { transform: translate(0,0)       rotate(0deg)    scale(0.5); opacity: 0; filter: drop-shadow(0 0 6px var(--c)); }
  12%  { transform: translate(7vw,-18px)  rotate(60deg)  scale(1.1); opacity: 1; filter: drop-shadow(0 0 14px var(--c)); }
  30%  { transform: translate(18vw,16px)  rotate(140deg) scale(1.0); opacity: 1; filter: drop-shadow(0 0 16px var(--c)); }
  50%  { transform: translate(32vw,-20px) rotate(230deg) scale(1.05); opacity: 1; }
  68%  { transform: translate(47vw,12px)  rotate(310deg) scale(1.0); opacity: 1; }
  80%  { transform: translate(60vw,0px)   rotate(360deg) scale(1.6); opacity: 1; filter: brightness(3.2) drop-shadow(0 0 32px var(--c)); }
  100% { transform: translate(60vw,0px)   rotate(380deg) scale(0.3); opacity: 0; }
}
@keyframes fly-rtl-swirl {
  0%   { transform: translate(0,0)        rotate(0deg)    scale(0.5); opacity: 0; filter: drop-shadow(0 0 6px var(--c)); }
  12%  { transform: translate(-7vw,-18px)  rotate(-60deg)  scale(1.1); opacity: 1; filter: drop-shadow(0 0 14px var(--c)); }
  30%  { transform: translate(-18vw,16px)  rotate(-140deg) scale(1.0); opacity: 1; filter: drop-shadow(0 0 16px var(--c)); }
  50%  { transform: translate(-32vw,-20px) rotate(-230deg) scale(1.05); opacity: 1; }
  68%  { transform: translate(-47vw,12px)  rotate(-310deg) scale(1.0); opacity: 1; }
  80%  { transform: translate(-60vw,0px)   rotate(-360deg) scale(1.6); opacity: 1; filter: brightness(3.2) drop-shadow(0 0 32px var(--c)); }
  100% { transform: translate(-60vw,0px)   rotate(-380deg) scale(0.3); opacity: 0; }
}

/* ─── CRASH: fast, straight, slams into target ────────────────────── */
.fx-ltr-crash { animation: fly-ltr-crash 0.75s cubic-bezier(0.1, 0.7, 0.25, 1) forwards; }
.fx-rtl-crash { animation: fly-rtl-crash 0.75s cubic-bezier(0.1, 0.7, 0.25, 1) forwards; }

@keyframes fly-ltr-crash {
  0%   { transform: translate(0,0)    scale(0.4); opacity: 0; filter: drop-shadow(0 0 4px var(--c)); }
  5%   { transform: translate(1vw,0)  scale(1.5); opacity: 1; filter: brightness(4) drop-shadow(0 0 24px var(--c)); }
  68%  { transform: translate(57vw,0) scale(1.3); opacity: 1; filter: brightness(2.5) drop-shadow(0 0 20px var(--c)); }
  82%  { transform: translate(60vw,0) scale(2.2); opacity: 1; filter: brightness(5.5) drop-shadow(0 0 50px var(--c)); }
  100% { transform: translate(60vw,0) scale(0.2); opacity: 0; filter: brightness(1); }
}
@keyframes fly-rtl-crash {
  0%   { transform: translate(0,0)     scale(0.4); opacity: 0; filter: drop-shadow(0 0 4px var(--c)); }
  5%   { transform: translate(-1vw,0)  scale(1.5); opacity: 1; filter: brightness(4) drop-shadow(0 0 24px var(--c)); }
  68%  { transform: translate(-57vw,0) scale(1.3); opacity: 1; filter: brightness(2.5) drop-shadow(0 0 20px var(--c)); }
  82%  { transform: translate(-60vw,0) scale(2.2); opacity: 1; filter: brightness(5.5) drop-shadow(0 0 50px var(--c)); }
  100% { transform: translate(-60vw,0) scale(0.2); opacity: 0; filter: brightness(1); }
}

/* ─── SLASH ──────────────────────────────────────────────────────── */
.sl { stroke-dasharray: 70; stroke-dashoffset: 70; }
.sl1 { animation: slash-draw 0.65s ease-out forwards; }
.sl2 { animation: slash-draw 0.65s 0.06s ease-out forwards; }
.sl3 { animation: slash-draw 0.65s 0.13s ease-out forwards; }
@keyframes slash-draw {
  0%   { stroke-dashoffset: 70; opacity: 0; }
  30%  { stroke-dashoffset: 0;  opacity: 0.95; }
  70%  { stroke-dashoffset: 0;  opacity: 0.85; }
  100% { stroke-dashoffset: 0;  opacity: 0; }
}
.sl-echo { stroke-dasharray: 70; stroke-dashoffset: 70; animation: slash-draw 0.65s -0.10s ease-out forwards; }
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
.shld-g { transform-origin: 50% 50%; animation: shield-form 0.82s ease-out forwards; }
.hex { stroke-dasharray: 320; stroke-dashoffset: 320; animation: hex-draw 0.5s ease-out forwards; }
@keyframes shield-form {
  0%   { transform: scale(0.2); opacity: 0; }
  45%  { transform: scale(1.1); opacity: 1; }
  75%  { transform: scale(1.0); opacity: 1; }
  100% { transform: scale(1.05); opacity: 0; }
}
@keyframes hex-draw { to { stroke-dashoffset: 0; } }
.shield-ripple { transform-origin: 50% 50%; }
.sr1 { animation: ring-expand 0.7s 0.25s ease-out forwards; opacity: 0; }
.sr2 { animation: ring-expand 0.7s 0.38s ease-out forwards; opacity: 0; }

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
.dodge-g { transform-origin: 50% 50%; animation: dodge-blur 0.75s ease-out forwards; }
@keyframes dodge-blur {
  0%   { transform: scale(0.5) translateX(0);   opacity: 0; }
  20%  { transform: scale(1.2) translateX(8px);  opacity: 1; }
  50%  { transform: scale(1.0) translateX(-4px); opacity: 0.8; }
  100% { transform: scale(0.8) translateX(12px); opacity: 0; }
}
.dg { transform-origin: 50% 50%; }
.dg1 { animation: dg-pop 0.55s ease-out forwards; }
.dg2 { animation: dg-pop 0.6s 0.06s ease-out forwards; opacity: 0; }
.dg3 { animation: dg-pop 0.65s 0.12s ease-out forwards; opacity: 0; }
@keyframes dg-pop {
  0%   { transform: scaleX(0.3) scaleY(0.6); opacity: 0; }
  35%  { transform: scaleX(1.1) scaleY(1.05); opacity: 1; }
  70%  { transform: scaleX(1.0) scaleY(1.0);  opacity: 0.7; }
  100% { transform: scaleX(1.3) scaleY(0.8);  opacity: 0; }
}
.dash { stroke-dasharray: 30; stroke-dashoffset: 30; }
.dl1 { animation: wind-draw 0.3s 0.10s ease-out forwards, bolt-fade 0.3s 0.35s forwards; }
.dl2 { animation: wind-draw 0.3s 0.14s ease-out forwards, bolt-fade 0.3s 0.40s forwards; }
.dl3 { animation: wind-draw 0.3s 0.18s ease-out forwards, bolt-fade 0.3s 0.45s forwards; }
.dl4 { animation: wind-draw 0.25s 0.22s ease-out forwards, bolt-fade 0.25s 0.44s forwards; }
.dl5 { animation: wind-draw 0.25s 0.26s ease-out forwards, bolt-fade 0.25s 0.48s forwards; }
.swoosh { stroke-dasharray: 80; stroke-dashoffset: 80; }
.sw1 { animation: wind-draw 0.4s 0.08s ease-out forwards, bolt-fade 0.35s 0.42s forwards; }
.sw2 { animation: wind-draw 0.4s 0.12s ease-out forwards, bolt-fade 0.35s 0.46s forwards; }

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
</style>
