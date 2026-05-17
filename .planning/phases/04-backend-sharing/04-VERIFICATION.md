---
phase: 04-backend-sharing
verified: 2026-05-16T23:08:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Save & Share flow — end to end"
    expected: "Complete a 23-spin session, wait until the button enables (90s), click Save & Share, receive a copyable URL within 1 second, open that URL in a private/incognito window on the same or a different device and see the identical character card rendered"
    why_human: "Requires a running MongoDB instance, a live session through the full game loop, and a second browser context — cannot be replicated by grep or inject() tests"
  - test: "Styled 404 page — browser navigation"
    expected: "Visit /character/doesnotexist in a browser; the SvelteKit +error.svelte is shown with the Cinzel headline and 'Return to the Wheel' link — NOT the default SvelteKit 404 skeleton"
    why_human: "SvelteKit error boundary routing to +error.svelte vs. default 404 requires a live dev server; verifiable only in browser"
  - test: "90s guard — button disables and enables in real-time"
    expected: "Immediately after completing the last spin, the Save & Share button is greyed out with inline text 'Session too brief — fate needs at least 90 seconds to settle.' After 90 seconds elapse the button becomes active without any page interaction"
    why_human: "Requires real elapsed clock time and a running browser session; the $derived(sessionAgeSec) tick interval cannot be exercised in unit tests"
  - test: "Rate-limit UX — 6th save attempt shows clear message"
    expected: "Clicking Save & Share 6 times in rapid succession (after the first 5 succeed) shows 'Too many saves from this device. Try again in a few minutes.' as red inline text below the button"
    why_human: "Requires actual browser interaction against a live backend to trigger the 429 path through the Svelte error-branch UI"
---

# Phase 4: Backend + Sharing Verification Report

**Phase Goal:** User can save their completed character to the backend and share it via a unique URL that loads the full character card for anyone who clicks it.
**Verified:** 2026-05-16T23:08:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User clicks "Save & Share" on the character card and receives a unique URL within one second; opening that URL on a different device shows the identical character card | VERIFIED (code) / human needed (UX) | `CharacterCard.svelte` lines 101-138: `handleSaveAndShare()` POSTs to `/api/characters`, receives `{ shareId, url }`, constructs full URL. `+page.svelte:931` passes `startedAt`. `+page.svelte` (character/[id]) renders the same `<CharacterCard>` component with SSR data from `+page.server.ts`. |
| 2 | A character URL that has never existed returns a styled "This fate has been lost to the multiverse" page — not a blank screen or generic 404 | VERIFIED (code) / human needed (browser routing) | `+page.server.ts:12-14` throws `error(404, { message: 'This fate has been lost to the multiverse.' })`. `+error.svelte` renders `$page.error?.message` in Cinzel headline with gold color `#ffdf96`, JetBrains Mono subtext, and 'Return to the Wheel' link. |
| 3 | Submitting a character with a session shorter than 90 seconds is rejected by the API — the Save button either remains disabled or shows an error | VERIFIED | `characters.ts:44-51` computes `sessionSeconds` and returns 422. `CharacterCard.svelte:93,99` derives `canSave` (disabled when < 90s), line 362 shows inline reason text. Backend 422 path at line 125 sets error message. All confirmed by passing test `'returns 422 with error "Session too short"'`. |
| 4 | Repeatedly saving from the same IP within a short window is rate-limited — subsequent attempts receive a clear error response | VERIFIED | `characters.ts:9-14` sets `config.rateLimit = { max: 5, timeWindow: '10 minutes' }`. `app.ts:10` sets `trustProxy: true`. `CharacterCard.svelte:123-124` branches on `res.status === 429` with message 'Too many saves from this device. Try again in a few minutes.' Confirmed by passing test `'returns 429 on the 6th POST from the same IP within 10 minutes'`. |

**Score:** 4/4 truths verified (automated code evidence complete; 4 human tests needed to confirm browser-facing behavior)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/package.json` | ESM package with `"type": "module"`, all required deps | VERIFIED | `"type": "module"` present; fastify@5.8.5, mongoose@9.6.2, nanoid@5.1.11, @fastify/cors@11.2.0, @fastify/rate-limit@10.3.0, fastify-plugin@5.1.0, dotenv@^16 all present |
| `server/src/app.ts` | `createApp()` factory with trustProxy, cors, rate-limit, mongoose, characterRoutes | VERIFIED | All 4 registrations present; trustProxy:true; global:false on rate-limit; prefix '/api' on routes |
| `server/src/index.ts` | Process entry point, PORT 3001, host 0.0.0.0, try/catch | VERIFIED | Listens on `process.env.PORT ?? 3001`, host `'0.0.0.0'`, wrapped in try/catch |
| `server/src/plugins/mongoose.ts` | fp-wrapped plugin, MONGODB_URI env, onClose disconnect | VERIFIED | Uses `fp()`, reads `process.env.MONGODB_URI`, `fastify.addHook('onClose', ...)` with `mongoose.disconnect()` |
| `server/src/models/Character.ts` | ICharacter interface, all fields, pre(/^find/) soft-delete hook | VERIFIED | All 10 fields with correct types/defaults; `CharacterSchema.pre(/^find/, ...)` adds `{ deleted_at: null }` filter |
| `server/src/routes/characters.ts` | POST with rate-limit config, 90s guard, nanoid(10); GET with 404 | VERIFIED | Both routes implemented exactly per spec; `nanoid(10)` call at line 53; rate limit config at lines 9-14; 90s guard at lines 44-51 |
| `server/vitest.config.server.ts` | environment:'node', testTimeout:30000, include pattern | VERIFIED | All three settings present |
| `server/__tests__/character-model.test.ts` | 6 model tests with mongodb-memory-server | VERIFIED | 6 test cases; all pass |
| `server/__tests__/characters.test.ts` | 8 route integration tests | VERIFIED | 8 test cases covering 201, 422, 400×2, 429, 200, 404×2; all pass |
| `vite.config.ts` | `/api` proxy to localhost:3001 | VERIFIED | `server.proxy['/api']` with target and changeOrigin; tailwindcss() plugin order preserved |
| `src/components/CharacterCard.svelte` | startedAt prop, Save & Share button, all states, error handling | VERIFIED | Props at line 7; handleSaveAndShare() at 101; all 5 states (default, disabled, saving, success+copy, error with 3 branches) present |
| `src/routes/+page.svelte` | Passes startedAt={currentSession.startedAt} to CharacterCard | VERIFIED | Line 931: `startedAt={currentSession.startedAt}` |
| `src/routes/character/[id]/+page.server.ts` | SSR load via API_URL env, throws error(404,...) | VERIFIED | Line 8: `process.env.API_URL ?? 'http://localhost:3001'`; line 12-14: error(404,...) |
| `src/routes/character/[id]/+page.svelte` | Renders CharacterCard with character data | VERIFIED | Passes `results={data.character.spins}`, `name`, `startedAt`, `onNewCharacter={() => goto('/')}` |
| `src/routes/character/[id]/+error.svelte` | Styled 404 with "This fate has been lost to the multiverse." | VERIFIED | Cinzel headline, #ffdf96 color, JetBrains Mono subtext, 'Return to the Wheel' link with gold border styling |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `server/src/index.ts` | `server/src/app.ts` | `import { createApp }` | WIRED | Line 1: `import { createApp } from './app.js'` |
| `server/src/app.ts` | `server/src/plugins/mongoose.ts` | `app.register(mongoosePlugin)` | WIRED | Line 21: `await app.register(mongoosePlugin)` |
| `server/src/app.ts` | `server/src/routes/characters.ts` | `app.register(characterRoutes, { prefix: '/api' })` | WIRED | Line 22: `await app.register(characterRoutes, { prefix: '/api' })` |
| `server/src/routes/characters.ts` | `server/src/models/Character.ts` | `Character.create / Character.findOne` | WIRED | Lines 55 and 76 |
| `server/src/routes/characters.ts` | nanoid | `nanoid(10)` | WIRED | Line 1 ESM import; line 53: `nanoid(10)` |
| `server/src/models/Character.ts` | soft-delete pre-find hook | `CharacterSchema.pre(/^find/, ...)` | WIRED | Lines 36-38 |
| `src/components/CharacterCard.svelte` | `/api/characters` | `fetch('/api/characters', { method: 'POST', ... })` | WIRED | Line 105 |
| `src/routes/character/[id]/+page.server.ts` | Fastify GET endpoint | `fetch(\`${apiUrl}/api/characters/${params.id}\`)` | WIRED | Line 10; uses API_URL not Vite proxy |
| `src/routes/character/[id]/+page.server.ts` | `+error.svelte` | `error(404, { message: '...' })` | WIRED | Lines 12-14 |
| `src/routes/character/[id]/+page.svelte` | `CharacterCard.svelte` | `<CharacterCard results={...} ...>` | WIRED | Lines 11-16 |
| `src/routes/+page.svelte` | `CharacterCard.svelte` | `startedAt={currentSession.startedAt}` | WIRED | Line 931 |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend test suite (14 tests: 6 model + 8 route) | `npm --prefix server run test` | 14 passed (2 files) in 4.30s | PASS |
| nanoid(10) format check | `shareId.toMatch(/^[A-Za-z0-9_-]{10}$/)` asserted in test | passes | PASS |
| 201 response shape `{ shareId, url }` | Route test asserts `body.url === '/character/${body.shareId}'` | passes | PASS |
| 422 on < 90s session | Route test with 89s-old timestamp | passes | PASS |
| 429 on 6th POST from same IP | Route test loops 6 POSTs; last is 429 | passes | PASS |
| Soft-deleted doc returns 404 | Route test + model test both confirm null/404 | passes | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BACK-01 | 04-01 | Character persisted with race, archetype, score, tier, spins as Mixed blob | SATISFIED | Character.ts model + Character.create() call in route |
| BACK-02 | 04-01, 04-02 | nanoid(10) shareId returned; GET /api/characters/:shareId returns saved doc; /character/[id] renders the card | SATISFIED | nanoid(10) at characters.ts:53; GET route at line 74; +page.svelte renders CharacterCard with SSR data |
| BACK-03 | 04-01, 04-02 | Soft-deleted or missing character returns 404; styled error page shown | SATISFIED | pre-find hook in Character.ts; +page.server.ts throws error(404); +error.svelte renders styled message |
| BACK-04 | 04-01 | POST < 90s returns 422; POST > 5/10min returns 429 | SATISFIED | Both guards in characters.ts; confirmed by passing tests |
| CARD-02 | 04-02 | Save & Share button on character card, persists character, surfaces copyable URL | SATISFIED | handleSaveAndShare() in CharacterCard.svelte; all button states implemented |

---

### Anti-Patterns Found

No TBD, FIXME, or XXX markers found in any Phase 4 files. No stub patterns (empty return [], return {}, console.log-only handlers) detected. The CharacterCard handleCopy() has a silent clipboard catch-block — this is an intentional T-04-14 mitigation (URL pill text is user-selectable as fallback), documented in a code comment.

---

### Human Verification Required

#### 1. Save & Share — Full End-to-End Flow

**Test:** With `npm run dev` running (both Vite and Fastify via concurrently), and a live local MongoDB on port 27017 (or MONGODB_URI set), complete the full 23-spin session, wait for the Save & Share button to enable, click it, verify a share URL appears within 1 second with a Copy button; open the URL in an incognito window and confirm the identical character card renders.
**Expected:** The character card on the share URL is pixel-identical to the one in the original session. The URL format is `http://localhost:5173/character/<10-char-nanoid>`.
**Why human:** Requires running MongoDB, completing a live session, and a second browser context. The SSR path (API_URL -> Fastify -> MongoDB -> SvelteKit render) cannot be exercised without all three services running.

#### 2. Styled 404 Page — Browser Routing

**Test:** With dev server running, navigate to `/character/doesnotexist` in a browser.
**Expected:** The dark-gradient page with Cinzel headline "This fate has been lost to the multiverse." appears — NOT the default SvelteKit 404 skeleton. The 'Return to the Wheel' link navigates back to `/`.
**Why human:** SvelteKit's error boundary routing (`+error.svelte` activation on `error(404, ...)`) requires a live dev server; cannot verify route resolution with grep.

#### 3. 90s Guard — Real-Time Button Enable

**Test:** Immediately after the last spin resolves, inspect the Save & Share button state.
**Expected:** Button is disabled with visible inline text "Session too brief — fate needs at least 90 seconds to settle." The button enables itself after 90 seconds without any click or reload.
**Why human:** The `setInterval(() => now = Date.now(), 1000)` / `$derived(canSave)` reactive chain requires real clock time and browser rendering.

#### 4. Rate-Limit UX — Error Message on 6th Attempt

**Test:** Click Save & Share 6 times in under 10 minutes (the first 5 produce share URLs; wait for each to complete before clicking again to avoid the in-flight disable).
**Expected:** The 6th attempt shows red inline text "Too many saves from this device. Try again in a few minutes." (no silent failure, no browser alert).
**Why human:** Requires browser-level interaction against a live backend to reach the 429 code path through the Svelte UI error branch.

---

### Gaps Summary

No gaps found. All 4 success criteria are implemented correctly in code. The 4 human verification items above are standard UX/integration checks that cannot be automated — they require a running database and browser session but the underlying code is complete and correct.

The backend test suite passes all 14 tests in a live run. Every artifact exists and is substantive. All key links are wired. No stub implementations detected.

---

_Verified: 2026-05-16T23:08:00Z_
_Verifier: Claude (gsd-verifier)_
