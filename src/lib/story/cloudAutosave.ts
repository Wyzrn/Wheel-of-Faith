/**
 * Cloud autosave for Ascension slots.
 *
 * Fires at safe checkpoints (crystal open, stat-point apply, spin use,
 * sell/dismantle, battle end, endless end) — see callers in
 * routes/story/+page.svelte and the battle/endless views.
 *
 * Semantics:
 *  • Debounced ~800ms — back-to-back state mutations coalesce into one POST.
 *  • Silent — never alerts on success, never blocks the UI thread; failures
 *    surface only via console.warn so we don't interrupt gameplay.
 *  • Skipped when not logged in — local autosave (the global $effect in
 *    routes/story/+page.svelte) is the source of truth for guest sessions.
 *  • Uses one server row per (userId, slotId) via the upsert endpoint
 *    POST /story-slots/autosave (see server/src/routes/storySlots.ts).
 */
import { apiUrl } from '$lib/api'
import type { StorySaveSlot } from './saveSlots'

interface PendingSave { slot: StorySaveSlot; timer: ReturnType<typeof setTimeout> }

const DEBOUNCE_MS = 800

// One pending save per slotId so save A on slot 1 doesn't cancel save B on
// slot 2. In practice the user is in one slot at a time, but the keyed map
// keeps the helper correct under slot-switching too.
const pending = new Map<number, PendingSave>()

export function cloudAutosave(slot: StorySaveSlot, opts: { loggedIn: boolean }): void {
  if (!opts.loggedIn) return
  if (typeof fetch === 'undefined') return

  const existing = pending.get(slot.id)
  if (existing) clearTimeout(existing.timer)

  const timer = setTimeout(() => {
    pending.delete(slot.id)
    void postAutosave(slot)
  }, DEBOUNCE_MS)

  pending.set(slot.id, { slot, timer })
}

async function postAutosave(slot: StorySaveSlot): Promise<void> {
  try {
    const res = await fetch(apiUrl('/api/story-slots/autosave'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ slotData: slot }),
    })
    // 401 → user logged out mid-session; just give up silently.
    if (!res.ok && res.status !== 401) {
      console.warn(`[cloudAutosave] HTTP ${res.status} for slot ${slot.id}`)
    }
  } catch (err) {
    console.warn('[cloudAutosave] network failure', err)
  }
}

/** Flush any pending save immediately — call on page unload so the last
 *  mutation isn't lost when the user closes the tab. */
export function flushCloudAutosaves(): void {
  if (typeof navigator === 'undefined') return
  for (const [slotId, entry] of pending) {
    clearTimeout(entry.timer)
    pending.delete(slotId)
    // sendBeacon is the only reliable way to fire on unload — regular fetch
    // gets cancelled by some browsers. Cookies still ride along.
    try {
      const body = new Blob([JSON.stringify({ slotData: entry.slot })], { type: 'application/json' })
      navigator.sendBeacon(apiUrl('/api/story-slots/autosave'), body)
    } catch {
      // Beacon may be unavailable (Safari private mode etc.) — accept the loss.
    }
  }
}
