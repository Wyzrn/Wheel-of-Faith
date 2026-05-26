// Global toast notifications. Anything in the app can call toast.show(),
// toast.success(), toast.error() — a Toaster component mounted at root layout
// renders them. State is a small reactive queue with auto-dismiss timers.
//
// Why a new utility: every page used to roll its own inline error/success
// banner with bespoke styling and short-lived state. Centralising means one
// visual language and one place to tune (animation, position, theme).

export type ToastKind = 'success' | 'error' | 'info' | 'reward'

export interface ToastEntry {
  id: number
  kind: ToastKind
  message: string
  // Optional secondary line — useful for "+50 shards" kind of detail.
  detail?: string
  // ms; 0 = sticky (caller must dismiss).
  duration: number
}

let _next = $state(0)
let _queue = $state<ToastEntry[]>([])
const MAX_VISIBLE = 4

function push(entry: Omit<ToastEntry, 'id'>): number {
  const id = ++_next
  _queue.push({ id, ...entry })
  // Cap the visible queue so a runaway loop can't fill the screen.
  if (_queue.length > MAX_VISIBLE) _queue = _queue.slice(-MAX_VISIBLE)
  if (entry.duration > 0) {
    setTimeout(() => dismiss(id), entry.duration)
  }
  return id
}

function dismiss(id: number): void {
  _queue = _queue.filter(t => t.id !== id)
}

export const toast = {
  get queue() { return _queue },

  show(message: string, kind: ToastKind = 'info', opts: { detail?: string; duration?: number } = {}): number {
    return push({ message, kind, detail: opts.detail, duration: opts.duration ?? 3000 })
  },
  success(message: string, opts: { detail?: string; duration?: number } = {}): number {
    return push({ message, kind: 'success', detail: opts.detail, duration: opts.duration ?? 2800 })
  },
  error(message: string, opts: { detail?: string; duration?: number } = {}): number {
    return push({ message, kind: 'error', detail: opts.detail, duration: opts.duration ?? 4000 })
  },
  reward(message: string, detail?: string, opts: { duration?: number } = {}): number {
    return push({ message, kind: 'reward', detail, duration: opts.duration ?? 3500 })
  },
  dismiss,
}
