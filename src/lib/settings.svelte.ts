// settings.svelte.ts — Persistent game settings using Svelte 5 class runes.
import { browser } from '$app/environment'

const STORAGE_KEY = 'wof_settings'

class SettingsStore {
  soundEnabled    = $state(true)
  effectsEnabled  = $state(true)
  spinSpeed       = $state(1.0)   // spin wheel speed multiplier
  // Battle pacing model (S5 rework):
  //  • autoBattle:      whether new battles start in auto mode (vs manual).
  //                     Players can flip per-battle via the in-arena switch.
  //  • autoBattleSpeed: 0.7 = relaxed · 1.0 = normal · 1.6 = fast.
  //                     Only meaningful while a battle is auto-playing.
  //  Instant playback is no longer free — it requires the `instant_battle`
  //  gamepass (5,000 shards) and is surfaced as a Skip button in the arena.
  autoBattle      = $state(true)
  autoBattleSpeed = $state(1.0)
  autoContinueMs  = $state(0)     // auto-fire Continue after spin reveal (0 = off)
  // Force-high-quality override. When true, perf scaling is bypassed and
  // every device renders at full fidelity regardless of detected tier.
  // Useful on flagship phones that the heuristic mis-buckets as 'low'
  // (any touch device defaults to low). null = auto (default).
  highQualityOverride: 'auto' | 'high' = $state('auto')

  // Backward-compat shim: existing views still read settings.battleSpeed
  // as a single numeric multiplier. Resolves to the auto speed when auto is
  // on, or 1.0 (normal pacing) when the player is steering manually.
  get battleSpeed(): number {
    return this.autoBattle ? this.autoBattleSpeed : 1.0
  }
  set battleSpeed(v: number) {
    // Legacy callers that still assign battleSpeed get migrated on the fly:
    // 99 (the old free "Instant") now flips auto on at top speed; other
    // values just update autoBattleSpeed.
    if (v >= 99) { this.autoBattle = true; this.autoBattleSpeed = 1.6 }
    else         { this.autoBattleSpeed = v }
  }

  constructor() {
    if (!browser) return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const s = JSON.parse(raw)
      if (typeof s.soundEnabled    === 'boolean') this.soundEnabled    = s.soundEnabled
      if (typeof s.effectsEnabled  === 'boolean') this.effectsEnabled  = s.effectsEnabled
      if (typeof s.spinSpeed       === 'number')  this.spinSpeed       = s.spinSpeed
      if (typeof s.autoBattle      === 'boolean') this.autoBattle      = s.autoBattle
      if (typeof s.autoBattleSpeed === 'number')  this.autoBattleSpeed = s.autoBattleSpeed
      if (typeof s.autoContinueMs  === 'number')  this.autoContinueMs  = s.autoContinueMs
      if (s.highQualityOverride === 'auto' || s.highQualityOverride === 'high') this.highQualityOverride = s.highQualityOverride
      // Migrate the old battleSpeed field (single slider, 99 = instant).
      if (s.autoBattleSpeed === undefined && typeof s.battleSpeed === 'number') {
        if (s.battleSpeed >= 99) { this.autoBattle = true; this.autoBattleSpeed = 1.6 }
        else                     { this.autoBattleSpeed = s.battleSpeed }
      }
    } catch { /* ignore corrupt storage */ }
  }

  save() {
    if (!browser) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      soundEnabled:    this.soundEnabled,
      effectsEnabled:  this.effectsEnabled,
      spinSpeed:       this.spinSpeed,
      autoBattle:      this.autoBattle,
      autoBattleSpeed: this.autoBattleSpeed,
      autoContinueMs:  this.autoContinueMs,
      highQualityOverride: this.highQualityOverride,
    }))
  }
}

export const settings = new SettingsStore()
