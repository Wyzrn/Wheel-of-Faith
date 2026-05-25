// Performance tier detection — measured once on first call, then cached.
// Used by SpinWheel/AttackFX/Battle screens to scale particle counts, DPR,
// and effect density down on lower-end devices. SSR-safe (returns 'mid' on server).

export type PerfTier = 'low' | 'mid' | 'high'

let cached: PerfTier | null = null

export function getPerfTier(): PerfTier {
  if (cached) return cached
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    cached = 'mid'
    return cached
  }
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } }
  const mem = nav.deviceMemory ?? 4               // GB; unsupported on iOS Safari → assume mid
  const cores = nav.hardwareConcurrency ?? 4
  const saveData = !!nav.connection?.saveData
  const isCoarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

  if (reducedMotion || saveData) { cached = 'low'; return cached }
  if (mem <= 2 || cores <= 2) { cached = 'low'; return cached }
  if (mem <= 4 && isCoarsePointer) { cached = 'mid'; return cached }
  if (cores >= 8 && mem >= 8) { cached = 'high'; return cached }
  cached = 'mid'
  return cached
}

// Particle/effect budget multiplier — pass through to spawn loops.
export function effectsMultiplier(): number {
  const t = getPerfTier()
  return t === 'low' ? 0.4 : t === 'mid' ? 0.75 : 1.0
}

// Capped DPR — high-DPI displays on weak GPUs murder fillrate. Clamp to 1.5 on
// low/mid tier so particle canvas/shadow rendering stays in the GPU's budget.
export function effectiveDpr(): number {
  if (typeof window === 'undefined') return 1
  const dpr = window.devicePixelRatio || 1
  const t = getPerfTier()
  if (t === 'low') return Math.min(dpr, 1)
  if (t === 'mid') return Math.min(dpr, 1.5)
  return Math.min(dpr, 2)
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}
