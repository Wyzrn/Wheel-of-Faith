// elements.ts — Element and item grade definitions for Wheel of Fate.
// Defines display colors for all 22 elements and 8 item grades.
// Used by CharacterCard, TierBadge, and battle calculations.

import type { ElementType, ItemGrade } from './types'

export const ELEMENT_COLORS: Record<ElementType, string> = {
  Fire:        '#ff4500',
  Ice:         '#00d4ff',
  Lightning:   '#ffd700',
  Earth:       '#a16207',
  Wind:        '#7dd3fc',
  Shadow:      '#7c3aed',
  Light:       '#fef08a',
  Arcane:      '#c026d3',
  Nature:      '#22c55e',
  Void:        '#6b21a8',
  Cosmic:      '#1e40af',
  Blood:       '#dc2626',
  Metal:       '#94a3b8',
  Soul:        '#e879f9',
  Poison:      '#84cc16',
  Time:        '#f59e0b',
  Water:       '#0ea5e9',
  Sound:       '#06b6d4',
  Gravity:     '#78716c',
  Psychic:     '#ec4899',
  Chaos:       '#f97316',
  Neutral:     '#6b7280',
}

export const ELEMENT_ICONS: Record<ElementType, string> = {
  Fire:        '🔥',
  Ice:         '❄️',
  Lightning:   '⚡',
  Earth:       '🪨',
  Wind:        '🌪️',
  Shadow:      '🌑',
  Light:       '✨',
  Arcane:      '🔮',
  Nature:      '🌿',
  Void:        '🕳️',
  Cosmic:      '🌌',
  Blood:       '🩸',
  Metal:       '⚙️',
  Soul:        '👻',
  Poison:      '☠️',
  Time:        '⏳',
  Water:       '💧',
  Sound:       '🔊',
  Gravity:     '🌀',
  Psychic:     '🧠',
  Chaos:       '🌊',
  Neutral:     '⚪',
}

// Item grade display config
export interface GradeInfo {
  label: string   // display name
  color: string   // hex color
  glow: string    // CSS box-shadow glow color
  battleBonus: number  // flat bonus added to attack/defense in battle calculations
}

export const ITEM_GRADE_INFO: Record<ItemGrade, GradeInfo> = {
  F:   { label: 'Common',     color: '#9ca3af', glow: '#9ca3af44', battleBonus: 0   },
  D:   { label: 'Uncommon',   color: '#22c55e', glow: '#22c55e44', battleBonus: 3   },
  C:   { label: 'Rare',       color: '#3b82f6', glow: '#3b82f644', battleBonus: 7   },
  B:   { label: 'Epic',       color: '#8b5cf6', glow: '#8b5cf644', battleBonus: 14  },
  A:   { label: 'Legendary',  color: '#f59e0b', glow: '#f59e0b44', battleBonus: 24  },
  S:   { label: 'Mythic',     color: '#ef4444', glow: '#ef444444', battleBonus: 36  },
  SS:  { label: 'Divine',     color: '#fbbf24', glow: '#fbbf2455', battleBonus: 52  },
  SSS: { label: 'Primordial', color: '#ffffff', glow: '#ffffff55', battleBonus: 70  },
}

// Grade ordering for comparisons (lowest → highest)
export const GRADE_ORDER: ItemGrade[] = ['F', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS']

export function highestGrade(grades: (ItemGrade | undefined)[]): ItemGrade {
  const defined = grades.filter((g): g is ItemGrade => g !== undefined)
  if (defined.length === 0) return 'F'
  return defined.reduce((best, g) =>
    GRADE_ORDER.indexOf(g) > GRADE_ORDER.indexOf(best) ? g : best
  )
}

export function gradeCompare(a: ItemGrade, b: ItemGrade): number {
  return GRADE_ORDER.indexOf(a) - GRADE_ORDER.indexOf(b)
}
