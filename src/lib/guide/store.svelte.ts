// Reactive store for the in-game NPC guide. Lives at layout scope so the
// guide persists across route changes and any component can summon Quill.
//
// State: which scene is active, which line is currently displayed.
// Persistence: which scene ids have been "seen" (set in localStorage so
// auto-fire scenes don't re-fire on every visit). The player can always
// re-summon a seen scene manually via the help portrait.

import { SCENES, type GuideScene } from './scenes'

const SEEN_KEY = 'wof_guide_seen_v1'

function loadSeen(): Set<string> {
  if (typeof localStorage === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? new Set(arr) : new Set()
  } catch {
    return new Set()
  }
}

function saveSeen(seen: Set<string>) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(seen)))
  } catch { /* quota/private-mode — silently ignore */ }
}

// Reactive guide store. Exposed via a single `guide` object so callers can
// just `import { guide }` and read/write properties.
function createGuide() {
  let activeSceneId = $state<string | null>(null)
  let lineIndex = $state(0)
  const seen = $state(loadSeen())

  function activeScene(): GuideScene | null {
    return activeSceneId ? SCENES[activeSceneId] ?? null : null
  }

  // Open a scene by id. Resets line index. If `force` is false (default) and
  // the scene has been seen, this is a no-op — useful for the
  // first-visit-on-route triggers where you only want to auto-fire once.
  function open(sceneId: string, force = false) {
    if (!SCENES[sceneId]) return
    if (!force && seen.has(sceneId)) return
    activeSceneId = sceneId
    lineIndex = 0
  }

  // Advance to the next line, or close if we're at the end (and no choices).
  function next() {
    const scene = activeScene()
    if (!scene) return
    if (lineIndex < scene.lines.length - 1) {
      lineIndex++
    } else if (!scene.choices || scene.choices.length === 0) {
      close()
    }
    // If we're at the last line and there ARE choices, leave the scene open
    // so the player can see the choice buttons. They'll dismiss / navigate
    // via the choice actions.
  }

  function close() {
    if (activeSceneId) {
      seen.add(activeSceneId)
      saveSeen(seen)
    }
    activeSceneId = null
    lineIndex = 0
  }

  // For tests / debug: clear all seen flags so scenes will auto-fire again.
  function resetSeen() {
    seen.clear()
    saveSeen(seen)
  }

  return {
    get activeSceneId() { return activeSceneId },
    get lineIndex() { return lineIndex },
    get scene() { return activeScene() },
    get atLastLine() {
      const s = activeScene()
      return s ? lineIndex >= s.lines.length - 1 : false
    },
    hasSeen(sceneId: string) { return seen.has(sceneId) },
    open,
    next,
    close,
    resetSeen,
  }
}

export const guide = createGuide()
