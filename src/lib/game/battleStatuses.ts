// Client-side status effect derivation from the battle log. The battle engine
// doesn't currently expose persistent per-character status state to the UI —
// it just produces lines like "X is poisoned". This helper scans the recent
// log and tracks active statuses per character so the UI can show chip rows
// under each portrait.
//
// MVP scope: name + keyword pattern matching. Not perfect (a character name
// that contains a status keyword could false-match) but the visual is the
// payoff; underlying battle truth still drives damage calculations.

export type StatusKind = 'buff' | 'poison' | 'burn' | 'freeze' | 'stun' | 'bleed' | 'shield' | 'rage' | 'curse'

export interface StatusBadge {
  kind: StatusKind
  label: string
  icon: string
  color: string
  description: string
}

const STATUS_META: Record<StatusKind, Omit<StatusBadge, 'kind'>> = {
  buff:   { label: 'Empowered', icon: 'trending_up',           color: '#a78bfa', description: '+25% damage for 2 rounds.' },
  poison: { label: 'Poisoned',  icon: 'science',               color: '#84cc16', description: 'Loses HP at the start of each round.' },
  burn:   { label: 'Burning',   icon: 'local_fire_department', color: '#f97316', description: 'Takes fire damage over time.' },
  freeze: { label: 'Frozen',    icon: 'ac_unit',               color: '#7dd3fc', description: 'Movement slowed — initiative reduced this round.' },
  stun:   { label: 'Stunned',   icon: 'flash_off',             color: '#fbbf24', description: 'Skips next turn.' },
  bleed:  { label: 'Bleeding',  icon: 'water_drop',            color: '#dc2626', description: 'Loses HP from open wounds each round.' },
  shield: { label: 'Shielded',  icon: 'shield',                color: '#93c5fd', description: 'Damage reduced for the next attack.' },
  rage:   { label: 'Berserk',   icon: 'whatshot',              color: '#ef4444', description: 'Hits harder but takes more damage.' },
  curse:  { label: 'Cursed',    icon: 'auto_fix_off',          color: '#7c3aed', description: 'Critical chance reduced; debuffs land harder.' },
}

// Status keyword patterns. Each maps to one StatusKind. Order matters — first
// match wins so we don't mis-classify "burning rage" as 'burn'.
const PATTERNS: { re: RegExp; kind: StatusKind }[] = [
  { re: /berserk|frenzy/i,                kind: 'rage' },
  { re: /barrier|defensive stance|shield/i, kind: 'shield' },
  { re: /poison|toxin|venom/i,            kind: 'poison' },
  { re: /bleed|hemorr|wound/i,            kind: 'bleed' },
  { re: /burn|ignite|flame|inferno/i,     kind: 'burn' },
  { re: /freeze|froze|frost/i,            kind: 'freeze' },
  { re: /stun|paralyze|paralyz/i,         kind: 'stun' },
  { re: /curse|hex/i,                     kind: 'curse' },
  { re: /empower|inspire|buff|enrage/i,   kind: 'buff' },
]

// Look at the last N log lines and produce a Map<characterName, StatusBadge[]>.
// Recency window controls the "decay" — older statuses fall off naturally.
const RECENT_WINDOW = 6  // last 6 log lines decide active statuses

export function deriveStatusBadges(
  logLines: string[],
  characterNames: string[],
): Map<string, StatusBadge[]> {
  const result = new Map<string, StatusBadge[]>()
  if (logLines.length === 0 || characterNames.length === 0) return result
  const recent = logLines.slice(-RECENT_WINDOW)
  for (const name of characterNames) {
    const found = new Set<StatusKind>()
    for (const line of recent) {
      // Character name must appear in the line, else not relevant. We require
      // a non-letter boundary so "Aria" doesn't match "Ariane".
      const nameRe = new RegExp(`(^|\\W)${escapeRegex(name)}(\\W|$)`)
      if (!nameRe.test(line)) continue
      for (const { re, kind } of PATTERNS) {
        if (re.test(line)) found.add(kind)
      }
    }
    if (found.size > 0) {
      const badges: StatusBadge[] = []
      for (const kind of found) {
        badges.push({ kind, ...STATUS_META[kind] })
      }
      result.set(name, badges)
    }
  }
  return result
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
