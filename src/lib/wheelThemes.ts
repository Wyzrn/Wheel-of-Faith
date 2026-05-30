// Cosmetic wheel skin registry. Each theme maps directly to its gamepass id
// (except 'default'). The SpinWheel reads the active theme and renders rim,
// spike crown, and inner aura with theme colors. Higher-priced themes pull in
// extra layers (rotating star field for Cosmic, ember sparks for Hellfire,
// reality tear for Void).

import type { GamepassId } from './shop/gamepasses'

export type WheelThemeId =
  | 'default'
  | 'cursed_wheel'
  | 'glowing_wheel'
  | 'nature_wheel'
  | 'guilded_wheel'
  | 'aquatic_wheel'
  | 'holy_wheel'
  | 'arcane_wheel'
  | 'hellfire_wheel'
  | 'cosmic_wheel'
  | 'void_wheel'

export interface WheelTheme {
  id: WheelThemeId
  /** Display name shown in the shop / picker. */
  name: string
  /** Mapped gamepass id required to use this skin (null = default, always free). */
  gamepass: GamepassId | null
  /** Inner-glow radial-gradient stops (center → edge). */
  innerStops: [string, string, string, string]
  /** Spike-crown radial-gradient stops (center → edge), null = no spikes. */
  spikeStops: [string, string, string] | null
  /** Outer rim ring stroke color. */
  rimStroke: string
  /** Inner rim accent ring stroke color. */
  rimAccent: string
  /** Drop-shadow filter glow color (used by the wheel-box drop-shadow). */
  glow: string
  /** CSS class added to .lc-root / wheel for theme-specific extras. */
  cssClass: string
  /** Optional: long spike crown rotation duration (s). */
  spikeSpinS?: number
  /** Optional: inner aura pulse duration (s). */
  innerPulseS?: number
}

const T = (t: WheelTheme) => t

export const WHEEL_THEMES: Record<WheelThemeId, WheelTheme> = {
  default: T({
    id: 'default', name: 'Default', gamepass: null,
    innerStops: ['rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)'],
    spikeStops: null,
    rimStroke: '#f0c040', rimAccent: '#ffdf96', glow: 'rgba(240,192,82,0.34)',
    cssClass: '',
  }),
  glowing_wheel: T({
    id: 'glowing_wheel', name: 'Glowing', gamepass: 'glowing_wheel',
    innerStops: ['rgba(90,214,239,0)', 'rgba(90,214,239,0.18)', 'rgba(56,189,248,0.42)', 'rgba(14,78,138,0.58)'],
    spikeStops: null,
    rimStroke: '#5ad6ef', rimAccent: '#bae6fd', glow: 'rgba(90,214,239,0.55)',
    cssClass: 'wt-glowing', innerPulseS: 2.0,
  }),
  nature_wheel: T({
    id: 'nature_wheel', name: 'Nature', gamepass: 'nature_wheel',
    innerStops: ['rgba(34,197,94,0)', 'rgba(34,197,94,0.18)', 'rgba(22,163,74,0.45)', 'rgba(20,83,45,0.6)'],
    spikeStops: null,
    rimStroke: '#22c55e', rimAccent: '#bbf7d0', glow: 'rgba(34,197,94,0.45)',
    cssClass: 'wt-nature', innerPulseS: 3.0,
  }),
  guilded_wheel: T({
    id: 'guilded_wheel', name: 'Guilded', gamepass: 'guilded_wheel',
    innerStops: ['rgba(255,236,170,0)', 'rgba(240,192,64,0.22)', 'rgba(217,148,38,0.55)', 'rgba(122,78,16,0.7)'],
    spikeStops: null,
    rimStroke: '#fbbf24', rimAccent: '#fef3c7', glow: 'rgba(251,191,36,0.6)',
    cssClass: 'wt-guilded', innerPulseS: 2.4,
  }),
  aquatic_wheel: T({
    id: 'aquatic_wheel', name: 'Aquatic', gamepass: 'aquatic_wheel',
    innerStops: ['rgba(56,189,248,0)', 'rgba(56,189,248,0.22)', 'rgba(14,116,144,0.5)', 'rgba(8,47,73,0.7)'],
    spikeStops: null,
    rimStroke: '#38bdf8', rimAccent: '#bae6fd', glow: 'rgba(56,189,248,0.55)',
    cssClass: 'wt-aquatic', innerPulseS: 3.6,
  }),
  cursed_wheel: T({
    id: 'cursed_wheel', name: 'Cursed', gamepass: 'cursed_wheel',
    innerStops: ['rgba(168,85,247,0)', 'rgba(168,85,247,0.2)', 'rgba(124,58,237,0.5)', 'rgba(59,16,102,0.65)'],
    spikeStops: ['#3b1066', '#7c3aed', '#c084fc'],
    rimStroke: '#a855f7', rimAccent: '#e9d5ff', glow: 'rgba(139,92,246,0.55)',
    cssClass: 'wt-cursed', spikeSpinS: 20, innerPulseS: 2.4,
  }),
  holy_wheel: T({
    id: 'holy_wheel', name: 'Holy', gamepass: 'holy_wheel',
    innerStops: ['rgba(255,253,235,0)', 'rgba(254,243,199,0.35)', 'rgba(250,204,21,0.55)', 'rgba(217,176,38,0.7)'],
    spikeStops: null,
    rimStroke: '#fde68a', rimAccent: '#fffbeb', glow: 'rgba(253,224,71,0.65)',
    cssClass: 'wt-holy', innerPulseS: 2.0,
  }),
  arcane_wheel: T({
    id: 'arcane_wheel', name: 'Arcane', gamepass: 'arcane_wheel',
    innerStops: ['rgba(99,102,241,0)', 'rgba(99,102,241,0.22)', 'rgba(124,58,237,0.5)', 'rgba(30,27,75,0.7)'],
    spikeStops: null,
    rimStroke: '#818cf8', rimAccent: '#c7d2fe', glow: 'rgba(129,140,248,0.6)',
    cssClass: 'wt-arcane', innerPulseS: 2.6,
  }),
  hellfire_wheel: T({
    id: 'hellfire_wheel', name: 'Hellfire', gamepass: 'hellfire_wheel',
    innerStops: ['rgba(254,215,170,0)', 'rgba(251,146,60,0.28)', 'rgba(220,38,38,0.6)', 'rgba(91,17,17,0.8)'],
    spikeStops: ['#7f1d1d', '#dc2626', '#fb923c'],
    rimStroke: '#ef4444', rimAccent: '#fca5a5', glow: 'rgba(239,68,68,0.7)',
    cssClass: 'wt-hellfire', spikeSpinS: 16, innerPulseS: 1.6,
  }),
  cosmic_wheel: T({
    id: 'cosmic_wheel', name: 'Cosmic', gamepass: 'cosmic_wheel',
    // Deep-space palette: midnight indigo bleeding into rich violet, with
    // a starlit fringe. No magenta — the wheel should read as a window
    // into outer space rather than a galaxy filter.
    innerStops: ['rgba(30,27,75,0)', 'rgba(49,46,129,0.32)', 'rgba(76,29,149,0.48)', 'rgba(15,15,35,0.85)'],
    spikeStops: null,
    rimStroke: '#6366f1', rimAccent: '#a5b4fc', glow: 'rgba(99,102,241,0.65)',
    cssClass: 'wt-cosmic', innerPulseS: 6.0,
  }),
  void_wheel: T({
    id: 'void_wheel', name: 'Void', gamepass: 'void_wheel',
    // Black-hole scheme. The inner aura is opaque pitch black at the core
    // and falls to fully transparent at the rim so it reads as a singularity
    // sitting at the wheel's center. The CSS overrides add an event horizon
    // ring, accretion-disk glow, and inward spiral animation.
    innerStops: ['rgba(0,0,0,1)', 'rgba(0,0,0,0.95)', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0)'],
    spikeStops: null,
    rimStroke: '#0a0a12', rimAccent: '#2a2a35', glow: 'rgba(0,0,0,0.98)',
    cssClass: 'wt-void', innerPulseS: 4.0,
  }),
}

export const ALL_COSMETIC_THEMES: WheelThemeId[] = [
  'glowing_wheel', 'nature_wheel', 'guilded_wheel', 'aquatic_wheel',
  'cursed_wheel', 'holy_wheel', 'arcane_wheel',
  'hellfire_wheel', 'cosmic_wheel', 'void_wheel',
]

/** Resolves which theme to render: the active selection if the player owns
 *  its gamepass, else the default theme. */
export function resolveActiveTheme(
  active: WheelThemeId | undefined,
  ownedGamepasses: readonly string[] | undefined,
): WheelTheme {
  if (!active || active === 'default') return WHEEL_THEMES.default
  const theme = WHEEL_THEMES[active]
  if (!theme || !theme.gamepass) return WHEEL_THEMES.default
  if (!ownedGamepasses?.includes(theme.gamepass)) return WHEEL_THEMES.default
  return theme
}
