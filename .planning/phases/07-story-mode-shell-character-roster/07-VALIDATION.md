---
phase: 7
slug: story-mode-shell-character-roster
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-18
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.6 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run src/lib/story/` |
| **Full suite command** | `npx vitest run src/` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/lib/story/ --reporter=verbose`
- **After every plan wave:** Run `npx vitest run src/`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | ROST-01 | — | N/A | unit | `npx vitest run src/lib/story/naming.test.ts -x` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 1 | ROST-01 | — | N/A | unit | `npx vitest run src/lib/story/naming.test.ts -x` | ❌ W0 | ⬜ pending |
| 07-01-03 | 01 | 1 | ROST-02 | — | N/A | unit | `npx vitest run src/lib/story/store.test.ts -x` | ❌ W0 | ⬜ pending |
| 07-01-04 | 01 | 1 | ROST-02 | — | N/A | unit | `npx vitest run src/lib/story/store.test.ts -x` | ❌ W0 | ⬜ pending |
| 07-01-05 | 01 | 1 | ROST-04 | — | N/A | unit | `npx vitest run src/lib/story/shards.test.ts -x` | ❌ W0 | ⬜ pending |
| 07-01-06 | 01 | 1 | ROST-04 | — | N/A | unit | `npx vitest run src/lib/story/shards.test.ts -x` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 2 | ROST-02 | — | N/A | manual | Visual: /story route loads without main-game state | N/A | ⬜ pending |
| 07-02-02 | 02 | 2 | ROST-02 | — | N/A | manual | Visual: roster persists after reload | N/A | ⬜ pending |
| 07-03-01 | 03 | 3 | ROST-03 | — | N/A | manual | Visual: CharacterCard renders readonly in roster | N/A | ⬜ pending |
| 07-03-02 | 03 | 3 | ROST-04 | — | N/A | manual | Visual: sell confirmation + shard credit | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/story/types.ts` — shared `StoryRosterEntry` interface (needed by all tests)
- [ ] `src/lib/story/naming.ts` — `generateCharacterName()` implementation
- [ ] `src/lib/story/naming.test.ts` — covers ROST-01 determinism (same inputs → same name; different inputs → different name)
- [ ] `src/lib/story/store.ts` — `addToRoster()`, `loadRoster()`, `saveRoster()`, `loadShards()`, `saveShards()`
- [ ] `src/lib/story/store.test.ts` — covers ROST-02 localStorage CRUD + 50-cap enforcement
- [ ] `src/lib/story/shards.ts` — `getShardValue()` implementation
- [ ] `src/lib/story/shards.test.ts` — covers ROST-04 all tier brackets (F- → Absolute)

*Existing vitest infrastructure covers all phase requirements — no new framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `/story` entry screen shows no main-game state | ROST-01 | Requires browser localStorage inspection | Open `/story`; check DevTools → Application → localStorage; verify no `wof_*` keys are read |
| Story Mode spin completes, character added to roster | ROST-02 | Full spin session is interactive | Spin all 23 wheels in Story Mode; verify character appears in roster after completion |
| Roster card expands to full sheet | ROST-03 | Component interaction | Click a roster card; verify CharacterCard renders with all stats, powers, weaknesses |
| Sell flow credits shards + removes character | ROST-04 | State mutation visible in UI | Click sell on a roster character; confirm dialog; verify shard balance increases and character is gone |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
