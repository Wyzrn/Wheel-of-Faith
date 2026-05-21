/**
 * Module-level store for offline (vs Bot) rivals state.
 * Persists across SvelteKit SPA navigation because it's module-level.
 * The rivals page sets active before navigating to spin;
 * the main game detects active and stores results after the spin completes.
 */

import type { SpinResult } from '$lib/session/types'

let _active = false
let _results: SpinResult[] | null = null
let _name: string | null = null

export function startOfflineRivals(): void {
  _active = true
  _results = null
  _name = null
}

export function isOfflineRivalsActive(): boolean { return _active }

export function setOfflineRivalsResult(results: SpinResult[], name: string): void {
  _results = results
  _name = name
  _active = false
}

export function getOfflineRivalsResult(): { results: SpinResult[]; name: string } | null {
  return (_results !== null && _name !== null) ? { results: _results, name: _name } : null
}

export function clearOfflineRivals(): void {
  _active = false
  _results = null
  _name = null
}
