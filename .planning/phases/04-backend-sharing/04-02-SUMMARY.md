---
phase: 04-backend-sharing
plan: "02"
subsystem: frontend
tags: [svelte, sveltekit, vite-proxy, ssr, share-page, character-card, typescript, fastify]

requires:
  - phase: 04-backend-sharing
    plan: "01"
    provides: "POST /api/characters (201/422/429), GET /api/characters/:shareId (200/404)"

provides:
  - "Save & Share button on CharacterCard with 90s guard, 429/422 error handling, URL pill + Copy"
  - "/character/[id] route: SSR load function fetches from Fastify directly via API_URL"
  - "Styled 404 page at /character/[id]/+error.svelte (Cinzel headline, JetBrains Mono subtext)"
  - "Vite proxy /api -> http://localhost:3001 for browser fetch calls"
  - "startedAt: string prop on CharacterCard (required) — Phase 5 gallery consumers must pass it"
  - "canSave = sessionAgeSec >= 90 && sessionAgeSec < 86400 — hides Save on share views > 24h"

affects: [05-gallery, 06-content-polish]

tech-stack:
  added:
    - "@types/node (devDep) — needed for process.env in +page.server.ts"
  patterns:
    - "Vite proxy (browser-only): server.proxy '/api' -> http://localhost:3001 in vite.config.ts"
    - "SSR load via process.env.API_URL (NOT Vite proxy — RESEARCH.md Pitfall 1)"
    - "Per-route ssr=true override in +layout.js to enable SSR for the share route"
    - "setInterval tick (1s) in onMount drives real-time canSave $derived without page interaction"
    - "navigator.clipboard.writeText with try/catch fallback (T-04-14 mitigation)"
    - "Svelte 5 $state/$derived for reactive save flow state"

key-files:
  created:
    - vite.config.ts (modified — added server.proxy block)
    - .env.example (documents API_URL=http://localhost:3001, no VITE_ prefix)
    - src/routes/character/[id]/+page.server.ts
    - src/routes/character/[id]/+page.svelte
    - src/routes/character/[id]/+error.svelte
    - src/routes/character/[id]/+layout.js
  modified:
    - src/components/CharacterCard.svelte (new startedAt prop + Save & Share button)
    - src/routes/+page.svelte (added startedAt={currentSession.startedAt} to CharacterCard)
    - package.json (added @types/node devDep)

key-decisions:
  - "SSR enabled per-route via +layout.js override — root layout has ssr=false for the game loop; share route needs SSR for the +page.server.ts load function to run"
  - "canSave hides Save button after 24h — share view visitors would re-save the same character; rough proxy for archived view per RESEARCH.md Assumption A4"
  - "startedAt passed as prop (not session store / context) — simplest threading approach, matches RESEARCH.md A4"
  - "displayName used in POST body (not raw name prop) — ensures 'The Unnamed' fallback is saved"
  - "@types/node installed in root package — process.env usage in +page.server.ts requires Node types"

requirements-completed: [CARD-02, BACK-02, BACK-03]

duration: 6min
completed: "2026-05-17"
---

# Phase 4 Plan 02: Frontend Integration Summary

**Save & Share button on CharacterCard with POST /api/characters, 90s guard, URL pill + Copy; /character/[id] SSR share route with styled 404; Vite proxy for browser fetch calls**

## Performance

- **Duration:** ~6 minutes
- **Started:** 2026-05-17T02:52:42Z
- **Completed:** 2026-05-17T02:58:04Z
- **Tasks:** 2
- **Files modified:** 8 (5 created, 3 modified)

## Accomplishments

- Vite proxy `/api` → `http://localhost:3001` wired in `vite.config.ts` (browser-only)
- `.env.example` documents `API_URL=http://localhost:3001` (no `VITE_` prefix — SSR only)
- `/character/[id]` route: `+page.server.ts` load fetches Fastify directly via `process.env.API_URL` (Pitfall 1 compliant); `+page.svelte` renders `CharacterCard` pixel-identical to the live session view
- Styled 404 page: full-bleed `#07070d` background, Cinzel headline, JetBrains Mono subtext, gold "Return to the Wheel" link
- `CharacterCard` now accepts required `startedAt: string` prop (ISO timestamp)
- Save & Share button: all states working — default, disabled (< 90s), saving, success (URL pill + Copy/Copied!), error (422/429/generic)
- `canSave = sessionAgeSec >= 90 && sessionAgeSec < 86400` — real-time via 1s interval in `onMount`
- Zero TypeScript errors, zero Svelte warnings (`npm run check` clean)

## API Contract Consumed

- POST `/api/characters` → 201 `{ shareId, url }` / 422 `{ error, message }` / 429 `{ statusCode, error, message }`
- GET `/api/characters/:shareId` → 200 (lean doc) / 404 `{ error }`

## Key Architectural Notes for Future Plans

### startedAt Prop on CharacterCard (Phase 5 / gallery consumers)

`CharacterCard` now requires `startedAt: string`. Every consumer must pass it:
- `src/routes/+page.svelte` → passes `startedAt={currentSession.startedAt}`
- `src/routes/character/[id]/+page.svelte` → passes `startedAt={data.character.session_started_at}`
- Any future gallery detail page rendering `CharacterCard` must pass the character's `session_started_at` from the MongoDB document

### /character/[id] as Canonical Share View

The `/character/[id]` route is the canonical URL for sharing characters. Phase 5 gallery cards should link here (`/character/${shareId}`). The route uses SSR (overriding the root `ssr=false`) to fetch character data server-side before render — this means no client-side fetch flicker and correct metadata for social sharing.

### 24-Hour Save Button Auto-Hide (Assumption A4)

`canSave` hides the Save button when `sessionAgeSec >= 86400` (24 hours). This means:
- On a share URL visited > 24h after the original session, the Save button is invisible
- On a fresh session that the user hasn't navigated away from, the Save button is visible after 90s and hidden after 24h (a session lasting > 24h is pathological)
- Phase 5 may need to revisit if gallery deep-links create different UX expectations (e.g., a "Save my copy" feature where a viewer of someone else's card wants to re-save)

### Vite Proxy vs API_URL Distinction (RESEARCH.md Pitfall 1)

Critical for any future SSR plan:
- **Browser fetch calls** (e.g., `fetch('/api/characters', ...)` in `CharacterCard.svelte`) → go through Vite proxy in dev
- **SvelteKit load functions** (`+page.server.ts`) run in Node.js → MUST use `process.env.API_URL ?? 'http://localhost:3001'` directly; the Vite proxy is browser-only and does NOT help SSR
- The root `+layout.js` has `ssr = false` — any new route that needs a `+page.server.ts` load function must create its own `+layout.js` with `ssr = true` (see `src/routes/character/[id]/+layout.js`)

## Task Commits

1. **Task 1: Vite proxy + share route + styled 404** - `eba1fd9` (feat)
2. **Task 2: CharacterCard Save & Share + startedAt** - `41780ae` (feat)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added +layout.js to enable SSR for share route**
- **Found during:** Task 1 (after creating +page.server.ts)
- **Issue:** Root `+layout.js` has `ssr = false` for the whole app (game loop doesn't need SSR). Without overriding this, the `+page.server.ts` load function is skipped and the share page would have no character data
- **Fix:** Created `src/routes/character/[id]/+layout.js` with `ssr = true` to enable SSR for this route only
- **Files modified:** `src/routes/character/[id]/+layout.js`
- **Verification:** `npm run check` 0 errors; TypeScript check 0 errors
- **Committed in:** `eba1fd9` (Task 1 commit)

**2. [Rule 3 - Blocking] Installed @types/node for process.env TypeScript support**
- **Found during:** Task 1 (TypeScript check)
- **Issue:** `npx tsc --noEmit` reported `Cannot find type definition file for 'node'` — the SvelteKit generated tsconfig includes `"types": ["node"]` but `@types/node` wasn't in root devDependencies
- **Fix:** `npm install --save-dev @types/node`
- **Files modified:** `package.json`, `package-lock.json`
- **Verification:** `npx tsc --noEmit` exits 0 after install
- **Committed in:** `eba1fd9` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 2 missing critical, 1 Rule 3 blocking)
**Impact on plan:** Both fixes essential for correctness. No scope creep.

## Pre-existing Test Failures (Out of Scope)

4 tests in `src/lib/content/races.test.ts` were already failing before this plan started due to pre-existing modifications in `src/lib/content/archetypes.ts` and `src/lib/content/races.ts` (both shown as `M` in git status at plan start). These are not caused by Plan 04-02 changes and are deferred to whoever resolves those content file modifications.

## Known Stubs

None — Save & Share is fully wired to the real Fastify backend from Plan 04-01.

## Threat Surface

All threats from the plan's threat model are implemented:
- T-04-10: `API_URL` uses no `VITE_` prefix — server-only, not bundled to client
- T-04-11: Svelte templates auto-escape `{character.name}` — no `{@html}` used
- T-04-12: `saving` state disables button during in-flight fetch; backend rate limit is authoritative
- T-04-13: Frontend disables at < 90s; backend re-validates (anti-spam per RESEARCH.md Pitfall 5)
- T-04-14: `navigator.clipboard.writeText` wrapped in try/catch; URL pill has `user-select: text`
- T-04-15: `error(500, { message: 'Failed to load character.' })` — no stack trace leaked

## Next Phase Readiness

Phase 5 (Gallery) can now:
- Link gallery cards to `/character/${shareId}` — route exists and renders CharacterCard via SSR
- Call POST `/api/characters` with `share_in_gallery: true` — backend already stores this field
- Render the same `CharacterCard` component (CARD-03 adds gallery toggle, out of scope here)
- `CharacterCard` requires `startedAt: string` — gallery fetch response includes `session_started_at`

---
*Phase: 04-backend-sharing*
*Completed: 2026-05-17*
