---
phase: "07"
plan: "03"
subsystem: "story-mode-spin-loop"
tags:
  - svelte
  - sveltekit
  - spin-loop
  - story-mode
  - vitest

dependency_graph:
  requires:
    - "07-01 (src/lib/story/types.ts, naming.ts, store.ts)"
    - "07-02 (src/routes/story/+page.svelte shell, RosterCard, SellConfirmModal)"
    - "src/components/SpinWheel.svelte (Phase 1)"
    - "src/lib/game/spinQueue.ts (Phase 2)"
    - "src/lib/game/scoreTier.ts (Phase 2)"
  provides:
    - "src/lib/story/storySession.ts — story session CRUD + buildRosterEntryFromResults"
    - "src/components/story/StorySpinView.svelte — full Story Mode spin loop"
    - "src/routes/story/+page.svelte — spin view wired, roster cap alert added"
  affects:
    - "Phase 8+ (redemption spin, tier gating, race-pool branching can extend StorySpinView)"

tech_stack:
  added: []
  patterns:
    - "Story session isolated in story_session localStorage key — no wof_* key access"
    - "$state.snapshot() before saveStorySession and buildRosterEntryFromResults (Svelte 5 proxy guard)"
    - "Race abilities pool lookup for racialAbility spins — race.abilities ?? GENERAL_ABILITY_POOL"
    - "Result-before-animation preserved through SpinWheel.onSpinComplete callback contract"
    - "localStorage after every spin via saveStorySession in handleSpinComplete"
    - "buildRosterEntryFromResults: pure function, no side effects, deterministic name via existing mulberry32 PRNG"

key_files:
  created:
    - src/lib/story/storySession.ts
    - src/lib/story/storySession.test.ts
    - src/components/story/StorySpinView.svelte
  modified:
    - src/routes/story/+page.svelte

decisions:
  - "buildRosterEntryFromResults converts SpinResult[] to Record<string,number> stat scores before calling computeOverallScore — matches the function's expected signature (not SpinResult[])"
  - "redemptionSpin filtered from queue via buildInitialQueue().filter(def => def.category !== 'redemptionSpin') — deferred to Phase 8"
  - "No raceSubType/raceClass/raceTransformation queue splicing in Story Mode Phase 7 — dynamic queue mutations are main-game feature; Phase 7 runs base queue only"
  - "No archetypeAbility pool customization in Phase 7 — uses GENERAL_ABILITY_POOL (same as main game default)"
  - "STAT_CATEGORIES in storySession.ts and StorySpinView.svelte matches STAT_WEIGHTS keys in scoreTier.ts (does NOT include armorStrength — not a scored stat)"
  - "StorySpinView derives currentSegments as a function (not $derived expression) to avoid reactive dependency issues with array return types"
  - "$state.snapshot() called before saveStorySession and before buildRosterEntryFromResults per Svelte 5 proxy serialization safety"

metrics:
  duration: "15m"
  completed_date: "2026-05-18"
  tasks_completed: 2
  tests_passing: 59
  files_created: 3
  files_modified: 1
---

# Phase 7 Plan 03: Story Mode Spin Loop Summary

**One-liner:** End-to-end Story Mode spin loop — storySession CRUD module with buildRosterEntryFromResults, StorySpinView wrapping SpinWheel with full queue orchestration and mid-session resume, wired into /story page with roster cap enforcement and persistent character storage, backed by 59 Vitest tests across 4 test files.

## Files Created / Modified

| File | Lines | Status | Purpose |
|------|-------|--------|---------|
| `src/lib/story/storySession.ts` | 116 | Created | STORY_SESSION_KEY, StorySessionState interface, createStorySession (filters redemptionSpin), loadStorySession, saveStorySession, clearStorySession, buildRosterEntryFromResults |
| `src/lib/story/storySession.test.ts` | 185 | Created | 17 Vitest tests — localStorage mock, CRUD round-trip, wof_* isolation, buildRosterEntryFromResults determinism + deep-copy |
| `src/components/story/StorySpinView.svelte` | 255 | Created | Story Mode spin loop — SpinWheel + queue orchestration, resume prompt, $state.snapshot guards, onSessionComplete + onCancel props |
| `src/routes/story/+page.svelte` | 349 | Modified | Replaced "Coming in Plan 03." stub with `<StorySpinView>`, added handleStoryComplete + rosterCapAlert banner |

**Total new lines:** 905 (including modified file)

## Test Coverage

| Test File | Tests | Status |
|-----------|-------|--------|
| naming.test.ts (Plan 01) | 6 | Passing |
| shards.test.ts (Plan 01) | 21 | Passing |
| store.test.ts (Plan 01) | 15 | Passing |
| storySession.test.ts (Plan 03) | 17 | Passing |
| **Total** | **59** | **All passing** |

## Documented Simplifications vs. Main-Game Spin Loop

These are intentional Phase 7 scope decisions, not bugs:

| Feature | Main Game | Story Mode Phase 7 | Future Phase |
|---------|-----------|-------------------|--------------|
| Redemption Spin | Full probability-wheel + outcome wheel | Filtered from queue (`category !== 'redemptionSpin'`) | Phase 8+ |
| Race subType/class/transformation queue splicing | Dynamic splice after race lands | Not implemented — base queue runs as-is | Phase 8 |
| Race-specific power pool override (`useRacialPowerPool`) | Supported | Not implemented | Phase 8 |
| Archetype custom ability pool | `archetypeAbility` draws from archetype.abilityPool | Uses GENERAL_ABILITY_POOL (same default as main game fallback) | Phase 8 |
| Wildcard stat events | 5% stat wildcard + 20% item wildcard | Not implemented | Phase 8 |
| Pending stat bonuses (backstory/title/race triggers) | Full system | Not implemented | Phase 8 |

The plan objective explicitly scopes these as Phase 8+ extensions.

## Isolation Confirmation

Grep result — no main-game store imports in any story file:

```
grep -rE "(lib/session/store|lib/spinHistory|wof_session|wof_spin_history)" \
  src/lib/story/ src/components/story/ src/routes/story/
(no output — 0 matches)
```

Story Mode uses exclusively: `story_session` (in-progress spin session), `story_roster`, and `story_shards` localStorage keys.

## Manual Test Trace (documented for /gsd-verify-work)

1. Navigate to `/story` → Entry screen shows "0 / 50 characters" and "Enter Story Mode" button
2. Click "Enter Story Mode" → StorySpinView mounts, SpinWheel renders with correct segments
3. Complete each spin in queue — after each, localStorage shows `story_session` updated with completedSpins
4. After final spin: `story_session` is cleared, `story_roster` is updated with new character entry
5. View returns to roster grid — new auto-named character appears at the top (most-recent-first)
6. Reload page → character still present (loadRoster() returns it)
7. Click anywhere on the RosterCard (except Sell) → CharacterCard readonly overlay opens
8. Click × → returns to roster view
9. Click "Sell Character" → SellConfirmModal appears with shard value
10. "Confirm Sell" → card removed, shard balance increments
11. Mid-session resume: reload during spin session → "Resume Story Session?" modal appears with spins-done count; Resume keeps state, Start Over clears and restarts

## Deferred Items

| Item | Reason | Target Phase |
|------|--------|-------------|
| Redemption spin in Story Mode | Plan scope explicitly defers | Phase 8+ |
| Race subType/class/transformation splicing | Dynamic queue mutation — Phase 7 runs base queue | Phase 8 |
| Race-specific power pool for bonus power spins | useRacialPowerPool flag not implemented | Phase 8 |
| Archetype-specific ability pool | Uses GENERAL_ABILITY_POOL fallback | Phase 8 |
| Wildcard stat events | Not in Phase 7 scope | Phase 8 |
| Backend write for Story Mode characters | Phase 8+ per 07-RESEARCH.md Assumption A2 | Phase 8+ |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1: storySession module + tests | 5de0c1d | feat(07-03): Story session module + buildRosterEntryFromResults + unit tests |
| Task 2: StorySpinView + page update | ed84738 | feat(07-03): StorySpinView component + wire spin loop into /story page |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] buildRosterEntryFromResults signature adaptation**

- **Found during:** Task 1 implementation
- **Issue:** The plan's `<action>` block states "import `computeOverallScore`" and shows `buildRosterEntryFromResults({ results: SpinResult[] })`. However, `computeOverallScore` actually takes `Record<string, number>` (stat category → score map), not `SpinResult[]`. The function signature in `scoreTier.ts` is: `computeOverallScore(statResults: Record<string, number>): number`.
- **Fix:** Added a stat scores extraction step inside `buildRosterEntryFromResults` that converts `SpinResult[]` to the required `Record<string, number>` by filtering for categories in `STAT_CATEGORIES` and mapping `r.score`. This matches how the main `+page.svelte` calls `computeOverallScore` (lines 496-501).
- **Files modified:** src/lib/story/storySession.ts

**2. [Rule 2 - Missing Critical Functionality] svelte-kit sync required for worktree tests**

- **Found during:** Task 1 verification
- **Issue:** The worktree lacked the `.svelte-kit/tsconfig.json` generated file, causing vitest to fail with `Could not resolve 'node:module'`. This is a worktree isolation side effect — `.svelte-kit/` is gitignored and not present in fresh worktrees.
- **Fix:** Ran `npx svelte-kit sync` in the worktree once to generate the required `.svelte-kit/` directory. No code change required.

### Pre-existing Issues (out of scope)

**1. [Pre-existing] TierBadge.svelte + +page.svelte "God" type error**

Same 3 pre-existing errors documented in Plan 02 SUMMARY. No new errors introduced by Plan 03.

## Known Stubs

None. All spin loop functionality is implemented. The racialAbility falls back to `GENERAL_ABILITY_POOL` when a race has no `abilities` array — this is the same default used by the main game and is intentional for Phase 7.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All new code operates exclusively on localStorage keys `story_session`, `story_roster`, and `story_shards`.

## Self-Check

Files created:

- [x] src/lib/story/storySession.ts — FOUND (116 lines)
- [x] src/lib/story/storySession.test.ts — FOUND (185 lines)
- [x] src/components/story/StorySpinView.svelte — FOUND (255 lines)
- [x] src/routes/story/+page.svelte — FOUND (modified, 349 lines)

Commits verified:

- [x] 5de0c1d — FOUND (feat(07-03): Story session module)
- [x] ed84738 — FOUND (feat(07-03): StorySpinView component + wire)

Vitest: 59/59 passing
tsc --noEmit: exit 0 (clean)
svelte-check: 3 pre-existing errors (not in story files), 0 new errors

Isolation: `grep -rE "(lib/session/store|lib/spinHistory|wof_session|wof_spin_history)" src/lib/story/ src/components/story/ src/routes/story/` returns no output.

## Self-Check: PASSED
