---
phase: 2
slug: full-23-spin-game-loop
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-15
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.6 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/lib/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/lib/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| scoreTier impl | 02-01 | 1 | CORE-04, REDEM-01 | — | N/A | unit | `npx vitest run src/lib/game/scoreTier.test.ts` | ❌ W0 | ⬜ pending |
| spinQueue impl | 02-01 | 1 | CORE-02, CORE-03 | — | N/A | unit | `npx vitest run src/lib/game/spinQueue.test.ts` | ❌ W0 | ⬜ pending |
| session extension | 02-01 | 1 | CORE-05, CARD-01 | — | N/A | unit | `npx vitest run src/lib/session/store.test.ts` | ✅ (extend) | ⬜ pending |
| content types | 02-02 | 1 | CORE-04, CONT-01 | — | N/A | unit | `npx vitest run src/lib/` | ❌ W0 | ⬜ pending |
| race content | 02-02 | 2 | CONT-01 | — | N/A | unit | `npx vitest run src/lib/` | ❌ W0 | ⬜ pending |
| stat labels | 02-03 | 2 | CORE-04 | — | N/A | unit | `npx vitest run src/lib/` | ❌ W0 | ⬜ pending |
| game loop | 02-04 | 3 | CORE-02, CORE-03 | — | N/A | manual | Browser: spin Race → verify ability count spliced | N/A | ⬜ pending |
| character card | 02-05 | 3 | CARD-01, REDEM-01 | — | N/A | manual | Browser: complete 23+ spins → verify card shows all results + tier badges | N/A | ⬜ pending |
| replay | 02-05 | 3 | CORE-02 | — | N/A | manual | Browser: click "New Character" → verify clean state reset without page reload | N/A | ⬜ pending |
| resume | 02-04 | 3 | CORE-05 | — | N/A | manual | Browser: spin 3+ times → reload page → verify resume prompt + correct state | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/game/scoreTier.ts` — implementation of scoreTier() + gradeToScore() + computeOverallScore() (REQ CORE-04, REDEM-01)
- [ ] `src/lib/game/scoreTier.test.ts` — unit tests: all 28 grade boundaries, scoreTier(1)='F-', scoreTier(100)='God', no gaps in 1–100, computeOverallScore range
- [ ] `src/lib/game/spinQueue.ts` — SpinDefinition type, buildInitialQueue(), getSegmentsForCategory() (REQ CORE-02, CORE-03)
- [ ] `src/lib/game/spinQueue.test.ts` — unit tests: initial queue has 22 entries in correct order, splice inserts at correct index for 1–4 ability counts, splice of 0 is no-op
- [ ] `src/lib/content/types.ts` — FlavorLabel, Race, Archetype, SimpleItem, Weakness types (no test needed — type-only file)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Spin through all 23+ categories in correct order, no skip | CORE-02 | Game loop state machine; not unit-testable in jsdom | Play from Race to Title; verify queue advances in declared order |
| Variable racial ability spins (1–4) appear after Race | CORE-03 | Requires live GSAP animation in browser | Spin Race; count ability spin slots that appear; repeat 5x with different races |
| Announcement ("Your race grants N ability spins!") shows briefly | D-12 | Visual UI behavior | After Race lands, verify announcement text appears before Next Spin button is active |
| Growing results list updates after each spin | D-03 | Visual DOM behavior | Spin 5 categories; verify list grows with each result |
| Character card shows all stats with tier badges and numeric scores | CARD-01, D-04, D-05 | Full-session visual inspection | Complete a full session; verify every stat row has grade badge + score + label |
| Overall tier badge shows letter grade + score (D-05) | REDEM-01, D-05 | Visual UI element | On character card, verify hero badge shows both grade string and numeric value |
| "New Character" resets without page reload | D-06 | SPA state reset | Click "New Character"; verify wheels reset, history clears, spin 1 is active |
| Resume from reload restores correct spin position | CORE-05 | localStorage + mount logic | Spin 5+ times; reload; verify resume prompt; accept; verify next spin is correct |
| All 28 tier grades visibly reachable on stat wheels | CORE-04 SC5 | Probabilistic — not unit-testable deterministically | Spin Strength 50+ times; verify F- through God labels all appear at least occasionally |
| Race rarity distribution matches CONT-01 targets | CONT-01 | Statistical — requires many spins | Spin Race 100 times; verify ~2% Legendary, ~35% Common appearance rates |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
