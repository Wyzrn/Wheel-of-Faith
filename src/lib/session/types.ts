export type SpinStatus = 'IDLE' | 'SPINNING' | 'LANDED' | 'REVEALED'

export interface WeightedSegment {
  label: string
  weight: number
  color?: string
}

export interface SpinResult {
  step: number
  category: string
  resultLabel: string
  resultIndex: number
  timestamp: string
}

export interface SessionState {
  sessionId: string
  startedAt: string
  completedSpins: SpinResult[]
}
