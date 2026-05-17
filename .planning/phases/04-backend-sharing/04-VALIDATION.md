---
phase: 4
slug: backend-sharing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-16
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.6 |
| **Config file** | `vitest.config.ts` (frontend) + `server/vitest.config.server.ts` (backend, Wave 0) |
| **Quick run command** | `npx vitest run src/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| character schema validation | 01 | 1 | BACK-01 | — | `spins` Mixed field accepts array; required fields enforced | unit | `npx vitest run --config server/vitest.config.server.ts` | ❌ W0 | ⬜ pending |
| nanoid ID generation | 01 | 1 | BACK-02 | — | Generated ID is 10 chars, URL-safe | unit | `npx vitest run --config server/vitest.config.server.ts` | ❌ W0 | ⬜ pending |
| GET /api/characters/:shareId | 01 | 1 | BACK-02 | — | Returns character doc for valid shareId | integration (inject) | `npx vitest run --config server/vitest.config.server.ts` | ❌ W0 | ⬜ pending |
| POST 90s session validation | 01 | 1 | BACK-04 | — | Returns 422 when session < 90s | integration (inject) | `npx vitest run --config server/vitest.config.server.ts` | ❌ W0 | ⬜ pending |
| POST rate limiting | 01 | 1 | BACK-04 | — | Returns 429 after 5 POSTs within 10 min window | integration (inject) | `npx vitest run --config server/vitest.config.server.ts` | ❌ W0 | ⬜ pending |
| soft-delete 404 | 01 | 1 | BACK-03 | — | GET returns 404 for deleted_at != null doc | integration (inject) | `npx vitest run --config server/vitest.config.server.ts` | ❌ W0 | ⬜ pending |
| Save & Share button | 02 | 2 | CARD-02 | — | Button triggers POST, displays share URL | manual | — | manual only | ⬜ pending |
| Share page SSR | 02 | 2 | BACK-02 | — | `/character/[id]` renders CharacterCard with loaded data | manual | — | manual only | ⬜ pending |
| Styled 404 page | 02 | 2 | BACK-03 | — | Missing/deleted share ID shows "fate lost to multiverse" | manual | — | manual only | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/vitest.config.server.ts` — Vitest config with `environment: 'node'` for backend tests
- [ ] `server/__tests__/characters.test.ts` — Fastify inject-based route tests (session validation, rate limit, GET)
- [ ] `server/__tests__/character-model.test.ts` — Mongoose schema unit tests (with `mongodb-memory-server`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Save & Share button → URL display | CARD-02 | Browser UI interaction required | Complete a full 23-spin session, click Save & Share, verify URL appears in card |
| Share URL opens correct card | BACK-02 | Cross-device SSR verification | Open shared URL in new tab/incognito, verify same CharacterCard renders |
| Styled 404 page renders | BACK-03 | SvelteKit error page UI | Navigate to `/character/doesnotexist`, verify "fate lost to multiverse" message |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
