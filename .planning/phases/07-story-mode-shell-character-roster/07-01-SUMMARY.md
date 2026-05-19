---
phase: "07"
plan: "01"
subsystem: "story-mode-data-layer"
tags:
  - svelte
  - localStorage
  - prng
  - story-mode
  - vitest

dependency_graph:
  requires: []
  provides:
    - "src/lib/story/types.ts — StoryRosterEntry, StoryState interfaces"
    - "src/lib/story/naming.ts — generateCharacterName(overallScore, raceLabel)"
    - "src/lib/story/shards.ts — getShardValue(tier) for all 46 TierGrade values"
    - "src/lib/story/store.ts — localStorage CRUD with 50-slot cap enforcement"
  affects:
    - "Plans 07-02 and 07-03 (UI and spin loop consume these types + functions)"

tech_stack:
  added: []
  patterns:
    - "mulberry32 seeded PRNG for deterministic character name generation"
    - "Isolated localStorage namespace (story_roster, story_shards) — no wof_* key access"
    - "Null-return cap enforcement in addToRoster() (returns null when at 50 limit)"

key_files:
  created:
    - src/lib/story/types.ts
    - src/lib/story/naming.ts
    - src/lib/story/shards.ts
    - src/lib/story/store.ts
    - src/lib/story/naming.test.ts
    - src/lib/story/shards.test.ts
    - src/lib/story/store.test.ts
  modified: []

decisions:
  - "ADJECTIVES and NOUNS arrays each have 80 entries (6,400 unique combinations vs. 1,600 minimum) — extra entries cost nothing and improve name variety significantly"
  - "God grade omitted from shards.test.ts ALL_TIER_GRADES — the actual TierGrade union in scoreTier.ts ends at Absolute+, not God; CLAUDE.md mentions 28 original grades but codebase diverged to 46 in Phase 2"
  - "Store comment-only reference to wof_* keys is acceptable — the comment is a correctness guard for future maintainers, not a runtime access"

metrics:
  duration: "5m"
  completed_date: "2026-05-18"
  tasks_completed: 2
  tests_passing: 42
  files_created: 7
---

# Phase 7 Plan 01: Story Mode Data Foundation Summary

**One-liner:** Pure TypeScript data layer for Story Mode — deterministic mulberry32 auto-naming, isolated localStorage CRUD with 50-slot cap, and full 46-grade shard value lookup table, backed by 42 Vitest tests.

## Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/story/types.ts` | 35 | `StoryRosterEntry` and `StoryState` interfaces — interface-only, no runtime code |
| `src/lib/story/naming.ts` | 72 | `generateCharacterName()` via mulberry32 PRNG, 80 adjectives × 80 nouns |
| `src/lib/story/shards.ts` | 62 | `getShardValue()` for all 46 TierGrade values (F-:20 → Absolute+:2000) |
| `src/lib/story/store.ts` | 72 | localStorage CRUD: `loadRoster`, `saveRoster`, `loadShards`, `saveShards`, `addToRoster` |
| `src/lib/story/naming.test.ts` | 58 | 6 tests: determinism, format, variability, Math.random poison |
| `src/lib/story/shards.test.ts` | 115 | 21 tests: all-46-grades, boundary values, monotonic bracket assertions |
| `src/lib/story/store.test.ts` | 194 | 15 tests: round-trips, empty/corrupt returns, cap at exactly 50, wof_* isolation |

**Total:** 7 files, 608 lines

## Test Counts

| Test File | Tests |
|-----------|-------|
| naming.test.ts | 6 |
| shards.test.ts | 21 |
| store.test.ts | 15 |
| **Total** | **42** |

All 42 tests pass. Vitest exit code 0.

## Combination Count

ADJECTIVES.length × NOUNS.length = **80 × 80 = 6,400 unique name combinations**

(Minimum required was 40 × 40 = 1,600. Expanded to 80 × 80 for better variety at no cost.)

## Shard Value Coverage

All 46 TierGrade union members verified in tests:

| Bracket | Range | Verified values |
|---------|-------|-----------------|
| F–D (F-, F, F+, E-, E, E+, D-, D, D+) | 20 → 55 | F-=20, D+=55 |
| C–B (C-, C, C+, B-, B, B+) | 70 → 130 | C-=70, B+=130 |
| A–S (A-, A, A+, S-, S, S+) | 160 → 320 | A-=160, S+=320 |
| SS base (SS-, SS) | 500 | SS-=500, SS=500 |
| SS+ and above (23 tiers) | 600 → 2000 | SS+=600, Absolute+=2000 |

No grade hits the fallback path (all return > 20 for grades above F-).

## localStorage Isolation Confirmation

No file in `src/lib/story/` imports from `$lib/session/store` or `$lib/spinHistory`.
No `wof_*` localStorage key is read or written by any implementation function.
Story Mode uses exclusively:
- `story_roster` (roster CRUD)
- `story_shards` (shard balance)

Verified by:
1. `grep -rE "(wof_session|wof_spin_history|\$lib/session/store)" src/lib/story/*.ts` — returns only a comment line in store.ts (documentation reminder)
2. store.test.ts key-isolation test suite (4 tests) — all pass

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1: types.ts | d84045f | feat(07-01): Story Mode types module — StoryRosterEntry and StoryState interfaces |
| Task 2: all six files | 7d638b6 | feat(07-01): naming, shards, store modules with full Vitest coverage (42 tests) |

## Deviations from Plan

### Auto-fixed Issues

None.

### Plan Spec Deviations

**1. [Informational] God grade omitted from shards.test.ts boundary assertions**

- **Found during:** Task 2 implementation
- **Issue:** The plan's `shards.test.ts` behavior block mentions `God === 2000` as an explicit assert. However, reading `src/lib/game/scoreTier.ts` reveals the actual `TierGrade` union ends at `Absolute+` — there is no `God` grade in the current codebase. The CLAUDE.md mentions `God` as part of the original 28-grade tier system, but Phase 2 extended this to 46 grades ending at `Absolute+`.
- **Resolution:** Omitted `God` from the ALL_TIER_GRADES array and boundary asserts. Added `Absolute+ === 2000` instead, which satisfies the same intent. Using `God` would be a TypeScript error since it is not a valid TierGrade member.
- **Files affected:** src/lib/story/shards.test.ts

**2. [Informational] ADJECTIVES and NOUNS arrays expanded to 80 entries each**

- **Found during:** Task 2 implementation
- **Plan spec:** "≥ 40 entries each (target: ≥ 1,600 unique combinations)"
- **Actual:** 80 entries each (6,400 unique combinations)
- **Rationale:** Expanded during content authoring at no additional cost. Improves name variety and satisfies the variability test (≥15 distinct names from 20 inputs) with wider margin.

## Known Stubs

None. All functions are fully implemented with no hardcoded empty values or placeholder returns.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All new files are pure TypeScript modules with localStorage access only.

## Self-Check

Files created:

- [x] src/lib/story/types.ts — FOUND
- [x] src/lib/story/naming.ts — FOUND
- [x] src/lib/story/shards.ts — FOUND
- [x] src/lib/story/store.ts — FOUND
- [x] src/lib/story/naming.test.ts — FOUND
- [x] src/lib/story/shards.test.ts — FOUND
- [x] src/lib/story/store.test.ts — FOUND

Commits verified:

- [x] d84045f — FOUND (feat(07-01): Story Mode types module)
- [x] 7d638b6 — FOUND (feat(07-01): naming, shards, store modules with full Vitest coverage)

Vitest: 42/42 passing

tsc: exit 0 (clean after npx svelte-kit sync)

## Self-Check: PASSED
