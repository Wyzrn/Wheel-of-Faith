// tierColor.ts — Maps TierGrade values to CSS variable strings for tier badge styling.
// Full 28-entry map verbatim from UI-SPEC.md lines 141–169.
// No default export.

import type { TierGrade } from './scoreTier'

// Maps every TierGrade to its corresponding CSS custom property reference.
// CSS variables are defined in src/app.css under @layer base :root.
// Fallback 'var(--tier-f-minus)' is a safety valve for exhaustiveness checking.
export function tierToCssVar(grade: TierGrade): string {
  const map: Record<TierGrade, string> = {
    'F-':   'var(--tier-f-minus)',
    'F':    'var(--tier-f)',
    'F+':   'var(--tier-f-plus)',
    'E-':   'var(--tier-e-minus)',
    'E':    'var(--tier-e)',
    'E+':   'var(--tier-e-plus)',
    'D-':   'var(--tier-d-minus)',
    'D':    'var(--tier-d)',
    'D+':   'var(--tier-d-plus)',
    'C-':   'var(--tier-c-minus)',
    'C':    'var(--tier-c)',
    'C+':   'var(--tier-c-plus)',
    'B-':   'var(--tier-b-minus)',
    'B':    'var(--tier-b)',
    'B+':   'var(--tier-b-plus)',
    'A-':   'var(--tier-a-minus)',
    'A':    'var(--tier-a)',
    'A+':   'var(--tier-a-plus)',
    'S-':   'var(--tier-s-minus)',
    'S':    'var(--tier-s)',
    'S+':   'var(--tier-s-plus)',
    'SS-':  'var(--tier-ss-minus)',
    'SS':   'var(--tier-ss)',
    'SS+':  'var(--tier-ss-plus)',
    'SSS-': 'var(--tier-sss-minus)',
    'SSS':  'var(--tier-sss)',
    'SSS+': 'var(--tier-sss-plus)',
    'God':  'var(--tier-god)',
  }
  return map[grade] ?? 'var(--tier-f-minus)'
}
