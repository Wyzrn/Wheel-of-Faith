// settings.svelte.ts — Persistent game settings using Svelte 5 class runes.
import { browser } from '$app/environment'

const STORAGE_KEY = 'wof_settings'

class SettingsStore {
  soundEnabled   = $state(true)
  effectsEnabled = $state(true)
  spinSpeed      = $state(1.0)   // spin wheel speed multiplier
  battleSpeed    = $state(1.0)   // 0.4=slow, 0.7=relaxed, 1.0=normal, 2.2=fast, 99=instant

  constructor() {
    if (!browser) return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const s = JSON.parse(raw)
      if (typeof s.soundEnabled   === 'boolean') this.soundEnabled   = s.soundEnabled
      if (typeof s.effectsEnabled === 'boolean') this.effectsEnabled = s.effectsEnabled
      if (typeof s.spinSpeed      === 'number')  this.spinSpeed      = s.spinSpeed
      if (typeof s.battleSpeed    === 'number')  this.battleSpeed    = s.battleSpeed
    } catch { /* ignore corrupt storage */ }
  }

  save() {
    if (!browser) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      soundEnabled:   this.soundEnabled,
      effectsEnabled: this.effectsEnabled,
      spinSpeed:      this.spinSpeed,
      battleSpeed:    this.battleSpeed,
    }))
  }
}

export const settings = new SettingsStore()
