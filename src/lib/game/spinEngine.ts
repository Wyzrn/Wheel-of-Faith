export type { SpinStatus } from '../session/types'
import type { SpinStatus } from '../session/types'

const VALID_TRANSITIONS: Record<SpinStatus, SpinStatus[]> = {
  IDLE: ['SPINNING'],
  SPINNING: ['LANDED'],
  LANDED: ['REVEALED'],
  REVEALED: ['IDLE'],
}

export function isValidTransition(from: SpinStatus, to: SpinStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}
