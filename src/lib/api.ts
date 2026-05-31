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

/** WebSocket URL for a server-relative path. Uses VITE_API_URL when set
 *  (rewritten to ws/wss), else derives from window.location. */
export function wsUrl(path: string): string {
  const p = path.startsWith('/') ? path : '/' + path
  if (API_BASE) return API_BASE.replace(/^http/, 'ws') + p
  if (typeof window === 'undefined') return p
  return `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}${p}`
}
