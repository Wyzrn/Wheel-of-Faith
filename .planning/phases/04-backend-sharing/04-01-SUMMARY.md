---
phase: 04-backend-sharing
plan: "01"
subsystem: api
tags: [fastify, mongoose, mongodb, nanoid, rate-limit, cors, vitest, mongodb-memory-server, typescript, esm]

requires:
  - phase: 02-game-loop
    provides: SessionState.startedAt — the ISO timestamp POSTed as session_started_at

provides:
  - Fastify 5 backend in server/ with POST /api/characters (201/400/422/429) and GET /api/characters/:shareId (200/404)
  - Mongoose Character model with shareId uniqueness, soft-delete pre-find hook, spins as Mixed blob
  - nanoid(10) share IDs returned from POST response
  - MongoDB soft-delete — GET for deleted character returns 404 transparently
  - Full backend test suite (14 tests) using mongodb-memory-server (no real mongod needed in CI)
  - Root concurrently dev script boots both Vite (web) and Fastify (api) with a single npm run dev

affects: [04-02-frontend-integration, 05-gallery, 06-content-polish]

tech-stack:
  added:
    - fastify@5.8.5
    - "@fastify/cors@11.2.0"
    - "@fastify/rate-limit@10.3.0"
    - mongoose@9.6.2
    - nanoid@5.1.11
    - fastify-plugin@5.1.0
    - dotenv@^16
    - tsx@^4 (server devDep)
    - mongodb-memory-server@^10 (server devDep)
    - concurrently@^9 (root devDep)
  patterns:
    - TDD RED/GREEN: write failing tests first, then implement
    - Fastify createApp() factory (not module-level listen) for testability via inject()
    - fastify-plugin wrapper on mongoose connector to cross plugin scope boundary
    - pre(/^find/) Mongoose hook for unconditional soft-delete filtering
    - Schema.Types.Mixed for heterogeneous spins blob with denormalized query fields

key-files:
  created:
    - server/package.json
    - server/tsconfig.json
    - server/.env.example
    - server/.gitignore
    - server/vitest.config.server.ts
    - server/src/app.ts
    - server/src/index.ts
    - server/src/plugins/mongoose.ts
    - server/src/models/Character.ts
    - server/src/routes/characters.ts
    - server/__tests__/character-model.test.ts
    - server/__tests__/characters.test.ts
  modified:
    - package.json (added concurrently devDep, dev:server script, updated dev script)

key-decisions:
  - "server/ is a separate npm package (type: module, ESM-only) — not a workspace — keeps it simple for Phase 4"
  - "spins stored as Schema.Types.Mixed blob; race/archetype/overall_score/overall_tier denormalized for future gallery queries"
  - "pre(/^find/) soft-delete hook is unconditional (no includeSoftDeleted toggle) — acceptable for Phase 4 MVP; revisit for Phase 6 admin"
  - "Rate-limit test uses same app instance with unique IP rather than second app instance — mongoose is a singleton, two createApp() calls on different URIs throw openUri conflict"
  - "vitest.config.server.ts sets passWithNoTests: true so scaffold phase exits 0 with empty test suite"
  - "tsconfig.json omits rootDir to allow __tests__/ and vitest config in the TS program alongside src/"

requirements-completed: [BACK-01, BACK-02, BACK-03, BACK-04]

duration: 4min
completed: "2026-05-17"
---

# Phase 4 Plan 01: Fastify Backend Summary

**Fastify 5 + Mongoose 9 backend with POST/GET characters API, nanoid(10) share IDs, 90s session guard, per-IP rate limiting, and soft-delete — all verified by 14 tests using mongodb-memory-server**

## Performance

- **Duration:** ~4 minutes
- **Started:** 2026-05-17T02:44:01Z
- **Completed:** 2026-05-17T02:48:54Z
- **Tasks:** 3
- **Files modified:** 13 (12 created, 1 modified)

## Accomplishments

- Standalone Fastify 5 server in `server/` as an ESM TypeScript package running on port 3001
- POST /api/characters: validates body schema, enforces 90s session minimum, rate-limits at 5 req/10min per IP, persists to MongoDB, returns nanoid(10) shareId
- GET /api/characters/:shareId: transparent soft-delete via Mongoose pre-find hook (deleted chars return 404)
- 14 tests green: 6 model unit tests + 8 route integration tests via Fastify inject() — no real mongod needed
- Root `npm run dev` now boots both Vite frontend and Fastify backend in parallel via concurrently

## API Contract (Wave 2 consumes this)

### POST /api/characters

**Request body:**
```json
{
  "name": "string (required, maxLength 40)",
  "race": "string (required)",
  "archetype": "string (required)",
  "overall_score": "number (required, 0-100)",
  "overall_tier": "string (required)",
  "spins": "array (required, heterogeneous SpinResult[])",
  "session_started_at": "string (required, ISO 8601 date-time)",
  "share_in_gallery": "boolean (optional, default false)"
}
```

**Responses:**
- `201` → `{ "shareId": "xK3mP9qR2v", "url": "/character/xK3mP9qR2v" }`
- `400` → Fastify Ajv validation error (missing required field or maxLength exceeded)
- `422` → `{ "error": "Session too short", "message": "Minimum session length is 90 seconds (got Xs)" }`
- `429` → `{ "statusCode": 429, "error": "Too Many Requests", "message": "Rate limit exceeded, retry in 10 minutes" }` (after 5 requests from same IP in 10 min window)

### GET /api/characters/:shareId

**Responses:**
- `200` → lean Character document (full object including all fields)
- `404` → `{ "error": "Character not found" }` (unknown shareId OR soft-deleted character)

## Environment Variables

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | `3001` | Fastify listen port |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/wheel-of-fate` | Local mongod or Atlas URI |
| `FRONTEND_URL` | `http://localhost:5173` | CORS allow-origin |
| `NODE_ENV` | `development` | Controls mongoose autoIndex |

Copy `server/.env.example` to `server/.env` and fill in values for local development.

## Dev Workflow

```bash
# Boot both frontend (Vite port 5173) and backend (Fastify port 3001):
npm run dev

# Or run individually:
npm run dev:server    # Fastify only
npm run dev           # was: vite dev; now: concurrently both
```

## Test Suite

```bash
# Run backend tests (from repo root):
cd server && npx vitest run --config vitest.config.server.ts

# Or via package script:
cd server && npm test
```

**Test quirk:** `mongodb-memory-server` downloads a MongoDB binary (~150 MB) on first run to `~/.cache/mongodb-binaries/`. Subsequent runs use the cache and are fast (~1–2s). This download happens automatically — no manual setup required. CI environments should cache `~/.cache/mongodb-binaries/` to avoid re-downloading on every run.

## Task Commits

Each task committed atomically:

1. **Task 1: Scaffold server/ package** - `b86dcb7` (chore)
2. **Task 2 RED: Failing model tests** - `390239e` (test)
3. **Task 2 GREEN: Character model** - `ffe1893` (feat)
4. **Task 3 RED: Failing route tests** - `7b75b32` (test)
5. **Task 3 GREEN: Fastify app + routes** - `78fe7d8` (feat)

## Files Created/Modified

- `server/package.json` — ESM Node package: Fastify 5, Mongoose 9, nanoid 5, tsx, vitest, mongodb-memory-server
- `server/tsconfig.json` — ESNext/Bundler/ES2022/strict, includes __tests__/ and vitest config
- `server/.env.example` — PORT, MONGODB_URI, FRONTEND_URL, NODE_ENV defaults
- `server/.gitignore` — node_modules, dist, .env
- `server/vitest.config.server.ts` — node environment, 30s timeout, passWithNoTests
- `server/src/app.ts` — createApp() factory: trustProxy, cors, rate-limit, mongoosePlugin, characterRoutes
- `server/src/index.ts` — entry: createApp() then listen on PORT:0.0.0.0
- `server/src/plugins/mongoose.ts` — fp() wrapped mongoose.connect + onClose disconnect
- `server/src/models/Character.ts` — ICharacter interface, CharacterSchema, pre(/^find/) soft-delete hook
- `server/src/routes/characters.ts` — POST with rate-limit + 90s guard + nanoid; GET with 404
- `server/__tests__/character-model.test.ts` — 6 model tests with mongodb-memory-server
- `server/__tests__/characters.test.ts` — 8 route integration tests via inject()
- `package.json` (root) — added concurrently devDep, dev:server script, updated dev script

## Decisions Made

- Separate `server/` npm package (not a workspace) — simplest approach for Phase 4; avoids shared tsconfig complexity
- `passWithNoTests: true` in vitest config — scaffold phase needs to exit 0 with empty test suite
- `tsconfig.json` omits `rootDir` — needed to include `__tests__/` and `vitest.config.server.ts` in TS program alongside `src/`
- Rate-limit test uses the shared app with a unique IP (`10.0.0.99`) — creating a second app instance fails because `mongoose.connect()` cannot be called twice on the same singleton with different URIs

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed rate-limit test: second createApp() conflicts with mongoose singleton**
- **Found during:** Task 3 (route integration tests)
- **Issue:** Plan suggested using a fresh app instance for the rate-limit test to get a clean counter. `mongoose.connect()` is a singleton — calling it a second time with a different URI throws `openUri()` on active connection error
- **Fix:** Rewrote the rate-limit test to use the shared `app` with a unique IP (`10.0.0.99`) not used in other tests. Rate-limit counter is isolated by IP, so a fresh IP gives a clean counter without needing a new app
- **Files modified:** `server/__tests__/characters.test.ts`
- **Verification:** 429 returned on 6th request from same IP, all 8 route tests pass
- **Committed in:** `78fe7d8` (Task 3 GREEN commit)

**2. [Rule 2 - Missing Critical] Added `passWithNoTests: true` to vitest config**
- **Found during:** Task 1 (scaffold verification)
- **Issue:** `vitest run` exits code 1 when no test files are found. The plan requires `exit 0` for the scaffold phase before tests are written
- **Fix:** Added `passWithNoTests: true` to `vitest.config.server.ts`
- **Files modified:** `server/vitest.config.server.ts`
- **Verification:** `npx vitest run --config vitest.config.server.ts` exits 0 with "No test files found"
- **Committed in:** `b86dcb7` (Task 1 commit)

**3. [Rule 1 - Bug] Fixed TypeScript pre-find hook typing**
- **Found during:** Task 2 (TypeScript check `npx tsc --noEmit`)
- **Issue:** Mongoose 9 types don't infer `this.where()` in `pre(/^find/)` hook — TypeScript error TS2551
- **Fix:** Typed `this` explicitly as `Query<any, any>` in the pre-find callback
- **Files modified:** `server/src/models/Character.ts`
- **Verification:** `npx tsc --noEmit` reports zero errors
- **Committed in:** `ffe1893` (Task 2 GREEN commit)

---

**Total deviations:** 3 auto-fixed (2 Rule 1 bugs, 1 Rule 2 missing critical)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered

- None beyond the auto-fixed deviations above.

## Known Stubs

None — all routes are fully wired with real MongoDB operations.

## Threat Surface

All threats in the plan's threat model are implemented:
- T-04-01: `trustProxy: true` in createApp()
- T-04-02: Fastify Ajv JSON schema on POST body
- T-04-03: Mixed field — no query operators executed on spins
- T-04-05: maxLength: 40 on name
- T-04-07: @fastify/rate-limit per-route (5/10min)
- T-04-09: pre(/^find/) hook returns 404 for deleted docs

## Next Phase Readiness

Wave 2 (04-02) can now integrate the frontend:
- API URL: `http://localhost:3001` (or via Vite proxy at `/api`)
- POST body contract documented above
- 201 response shape: `{ shareId: string, url: string }`
- `npm run dev` starts both processes — no manual server startup needed

---
*Phase: 04-backend-sharing*
*Completed: 2026-05-17*
