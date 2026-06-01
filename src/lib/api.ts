// Backend URL resolution.
//
// Heroku build:    VITE_API_URL is unset → API_BASE is '' → fetches go to
//                  same-origin '/api/…' (the SvelteKit + Fastify combo).
// itch.io build:   VITE_API_URL is set to the Heroku https URL at build time
//                  (e.g. https://wheel-of-fate-f7b596f2e07d.herokuapp.com) →
//                  API_BASE is that absolute origin → fetches go cross-origin.
//
// Every server-bound request in the app should funnel through apiUrl() so a
// single build-time env var flips the whole codebase between same-origin
// (Heroku) and cross-origin (itch.io) modes.
//
// WebSocket URLs use wsUrl() which converts the same base to ws:// or wss://.

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

/** Resolve a server-relative path to an absolute or same-origin URL.
 *  Always pass paths starting with '/api/…'. */
export function apiUrl(path: string): string {
  return API_BASE + (path.startsWith('/') ? path : '/' + path)
}

/** Canonical user-facing base for shareable URLs. On the Heroku build the
 *  game is served from the origin root, so window.location.origin is the
 *  right host. On the itch build the origin is a random hash subdomain on
 *  html-classic.itch.zone — useless to share — so we route shares back to
 *  the Heroku app (where /character/:shareId actually resolves). */
export function shareBase(): string {
  if (API_BASE) return API_BASE   // itch build — VITE_API_URL points to Heroku
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

/** WebSocket URL for a server-relative path. Uses VITE_API_URL when set
 *  (rewritten to ws/wss), else derives from window.location. */
export function wsUrl(path: string): string {
  const p = path.startsWith('/') ? path : '/' + path
  if (API_BASE) return API_BASE.replace(/^http/, 'ws') + p
  if (typeof window === 'undefined') return p
  return `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}${p}`
}

// ─── Static asset paths (separate concern from API URLs) ──────────────────
// On Heroku the game is hosted at the origin root, so `/fx/k/spark.png`
// resolves correctly. On itch.io the game lives at a randomized subpath
// (html-classic.itch.zone/html/<id>/<hash>/…), so a literal `/fx/k/…`
// resolves to the root of html-classic.itch.zone where nothing exists → 403.
// asset() prepends the current document's subpath so root-relative paths
// resolve to the game's hosted root in both cases. Computed once on first
// call from document.baseURI which itch sets correctly via the iframe URL.

let _assetBase: string | null = null
function computeAssetBase(): string {
  if (typeof document === 'undefined') return ''
  try {
    // baseURI ends at the document URL; new URL('.', baseURI) yields its
    // dirname with trailing slash. Strip the slash so we can concatenate
    // with paths that themselves start with '/'.
    return new URL('.', document.baseURI).pathname.replace(/\/$/, '')
  } catch { return '' }
}

/** Resolve a root-relative static asset URL (e.g. `/fx/k/spark_01.png`)
 *  to a path that works at the game's actual hosted location.
 *  Same-origin pass-through on Heroku; subpath-prefixed on itch.io. */
export function asset(path: string): string {
  if (_assetBase === null) _assetBase = computeAssetBase()
  return _assetBase + (path.startsWith('/') ? path : '/' + path)
}
