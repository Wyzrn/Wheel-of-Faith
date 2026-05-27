// tierColor.ts — Maps TierGrade values to CSS variable strings for tier badge styling.
// No default export.

import type { TierGrade } from './scoreTier'

// Maps every TierGrade to its corresponding CSS custom property reference.
// CSS variables are defined in src/app.css under :root. Each tier resolves to
// a solid color suitable for chips, text, and segment fills.
export function tierToCssVar(grade: TierGrade): string {
  const map: Record<TierGrade, string> = {
    'F-':            'var(--tier-f-minus)',
    'F':             'var(--tier-f)',
    'F+':            'var(--tier-f-plus)',
    'E-':            'var(--tier-e-minus)',
    'E':             'var(--tier-e)',
    'E+':            'var(--tier-e-plus)',
    'D-':            'var(--tier-d-minus)',
    'D':             'var(--tier-d)',
    'D+':            'var(--tier-d-plus)',
    'C-':            'var(--tier-c-minus)',
    'C':             'var(--tier-c)',
    'C+':            'var(--tier-c-plus)',
    'B-':            'var(--tier-b-minus)',
    'B':             'var(--tier-b)',
    'B+':            'var(--tier-b-plus)',
    'A-':            'var(--tier-a-minus)',
    'A':             'var(--tier-a)',
    'A+':            'var(--tier-a-plus)',
    'S-':            'var(--tier-s-minus)',
    'S':             'var(--tier-s)',
    'S+':            'var(--tier-s-plus)',
    'SS-':           'var(--tier-ss-minus)',
    'SS':            'var(--tier-ss)',
    'SS+':           'var(--tier-ss-plus)',
    'SSS-':          'var(--tier-sss-minus)',
    'SSS':           'var(--tier-sss)',
    'SSS+':          'var(--tier-sss-plus)',
    'Z-':            'var(--tier-z-minus)',
    'Z':             'var(--tier-z)',
    'Z+':            'var(--tier-z-plus)',
    'ZZ-':           'var(--tier-zz-minus)',
    'ZZ':            'var(--tier-zz)',
    'ZZ+':           'var(--tier-zz-plus)',
    'ZZZ-':          'var(--tier-zzz-minus)',
    'ZZZ':           'var(--tier-zzz)',
    'ZZZ+':          'var(--tier-zzz-plus)',
    'Cosmic-':       'var(--tier-cosmic-minus)',
    'Cosmic':        'var(--tier-cosmic)',
    'Cosmic+':       'var(--tier-cosmic-plus)',
    'Immortal-':     'var(--tier-immortal-minus)',
    'Immortal':      'var(--tier-immortal)',
    'Immortal+':     'var(--tier-immortal-plus)',
    'Celestial-':    'var(--tier-celestial-minus)',
    'Celestial':     'var(--tier-celestial)',
    'Celestial+':    'var(--tier-celestial-plus)',
    'Godly-':        'var(--tier-godly-minus)',
    'Godly':         'var(--tier-godly)',
    'Godly+':        'var(--tier-godly-plus)',
    'Primordial-':   'var(--tier-primordial-minus)',
    'Primordial':    'var(--tier-primordial)',
    'Primordial+':   'var(--tier-primordial-plus)',
    'Absolute-':     'var(--tier-absolute-minus)',
    'Absolute':      'var(--tier-absolute)',
    'Absolute+':     'var(--tier-absolute-plus)',
    'Transcendent-': 'var(--tier-transcendent-minus)',
    'Transcendent':  'var(--tier-transcendent)',
    'Transcendent+': 'var(--tier-transcendent-plus)',
    'Infinite-':     'var(--tier-infinite-minus)',
    'Infinite':      'var(--tier-infinite)',
    'Infinite+':     'var(--tier-infinite-plus)',
  }
  return map[grade] ?? 'var(--tier-f-minus)'
}

// True for tiers that should render a gradient instead of a solid color.
// Cosmic and above get gradient text + gradient wheel slice per the design spec.
const GRADIENT_TIERS = new Set<string>([
  'Cosmic', 'Immortal', 'Celestial', 'Godly',
  'Primordial', 'Absolute', 'Transcendent', 'Infinite',
])
export function tierHasGradient(grade: TierGrade | string): boolean {
  // Strip ±, then check the base name.
  const base = String(grade).replace(/[-+]$/, '')
  return GRADIENT_TIERS.has(base)
}

// Returns a CSS gradient string for the given grade, or null if the tier uses
// a solid color. Use this for the wheel-segment fill on Cosmic+ tiers and for
// tier-name text fills on character cards / spin reveals.
export function tierToGradient(grade: TierGrade | string): string | null {
  const base = String(grade).replace(/[-+]$/, '').toLowerCase()
  if (!GRADIENT_TIERS.has(base[0].toUpperCase() + base.slice(1))) return null
  return `var(--tier-${base}-grad)`
}

// Returns a label suitable for rendering "Infinite+N" overflow grades. For
// finite TierGrade values, returns the grade unchanged. For overflow strings
// ("Infinite+12") returns them verbatim.
export function tierDisplayLabel(grade: TierGrade | string): string {
  return String(grade)
}
