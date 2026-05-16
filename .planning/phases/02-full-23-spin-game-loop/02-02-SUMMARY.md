---
phase: 02-full-23-spin-game-loop
plan: "02"
subsystem: content
tags: [svelte, typescript, content-data, game-content, races, powers, weapons, weaknesses]

# Dependency graph
requires:
  - phase: 02-full-23-spin-game-loop
    plan: "01"
    provides: "Race, Archetype, SimpleItem, Weakness, FlavorLabel type interfaces in src/lib/content/types.ts"
provides:
  - "40 Race entries with rarity weights, abilitySpinCount, weaknessProbabilityModifier in races.ts"
  - "17 Archetype entries with abilitySpinCount in archetypes.ts"
  - "1,006 powers (509 epic + 497 absurd) in powers.ts via powers-epic.ts and powers-absurd.ts"
  - "525 weapons (legendary to absurd) in weapons.ts"
  - "552 weaknesses (51 severe: true, 501 severe: false) in weaknesses.ts"
  - "40 backstory entries in backstories.ts"
  - "113 title entries (52 epic + 61 absurd) in titles.ts"
  - "33 enchantment entries in enchantments.ts"
affects: [02-03, 02-04, 02-05, spinQueue, getSegmentsForCategory, game-loop-orchestrator, gallery]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-file const-array pattern: one import line, typed const export, no functions, no default export"
    - "Powers split-file pattern: powers-epic.ts + powers-absurd.ts merged in powers.ts for maintainability"
    - "TDD for content: structural behavior tests validate length, type shape, and rarity invariants before implementation"

key-files:
  created:
    - src/lib/content/races.ts
    - src/lib/content/archetypes.ts
    - src/lib/content/powers.ts
    - src/lib/content/powers-epic.ts
    - src/lib/content/powers-absurd.ts
    - src/lib/content/weapons.ts
    - src/lib/content/weaknesses.ts
    - src/lib/content/backstories.ts
    - src/lib/content/titles.ts
    - src/lib/content/enchantments.ts
    - src/lib/content/races.test.ts
  modified: []

key-decisions:
  - "Powers split into powers-epic.ts and powers-absurd.ts to stay under 800-line limit and allow independent tonal editing"
  - "Equal weight (1) for all powers, weapons, backstories, titles, enchantments — all entries equally drawable"
  - "Race weights drive rarity: Common 30-38, Uncommon 12-20, Rare 4-9, Legendary 1"
  - "weaknessProbabilityModifier reflects lore feel: Vampire 1.8, Celestial 0.4, Human 1.0, Goblin 1.3"
  - "TDD applied to Task 1 (races + archetypes): 15 structural tests catch rarity invariants and type correctness"

patterns-established:
  - "Content file pattern: `import type { X } from './types'` + `export const items: X[] = [...]` — no default export, no functions"
  - "Rarity via weight: weightedRandom normalizes; total 400-600 for races gives correct distribution"
  - "Split-file re-export pattern: large pools split by tonal category, merged in index file"
  - "Severe boolean on Weakness type: enables race-modulated drawing for high-modifier races"

requirements-completed: [CORE-02, CORE-03]

# Metrics
duration: 12min
completed: 2026-05-16
---

# Phase 02 Plan 02: Content Data Modules Summary

**8 TypeScript content modules providing 2,329 total entries: 40 races with rarity weights, 17 archetypes, 1,006 powers (epic/absurd split), 525 weapons, 552 weaknesses with severe flags, 40 backstories, 113 titles, and 33 enchantments**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-16T04:17:15Z
- **Completed:** 2026-05-16T04:29:18Z
- **Tasks:** 3
- **Files modified:** 11 (10 content + 1 test)

## Accomplishments
- Complete content foundation for all non-stat spin categories, enabling spinQueue.ts getSegmentsForCategory to return real wheel segments
- Race rarity distribution correctly implemented: 8 Common (30-38), 15 Uncommon (12-20), 8 Rare (4-9), 6 Legendary (1) — total weight ~498
- Powers pool exceeds 1,000 entries (1,006) split across epic and absurd sub-files; weapons hit 525; weaknesses hit 552 with correct severe classification
- TDD applied to Task 1: 15 structural unit tests committed (RED) before implementation (GREEN), all pass in final state

## Task Commits

Each task was committed atomically:

1. **Task 1 (TDD RED): races + archetypes tests** - `a22d316` (test)
2. **Task 1 (TDD GREEN): races.ts (40) and archetypes.ts (17)** - `b00f630` (feat)
3. **Task 2: powers (1006), weapons (525), weaknesses (552)** - `9aa17f7` (feat)
4. **Task 3: backstories (40), titles (113), enchantments (33)** - `a159669` (feat)

## Files Created/Modified
- `src/lib/content/races.ts` — 40 Race entries across Common/Uncommon/Rare/Legendary tiers
- `src/lib/content/archetypes.ts` — 17 Archetype entries, abilitySpinCount 1-4
- `src/lib/content/powers.ts` — Merge file re-exporting epicPowers + absurdPowers (1,006 total)
- `src/lib/content/powers-epic.ts` — 509 serious/epic power entries
- `src/lib/content/powers-absurd.ts` — 497 absurd/comedic power entries
- `src/lib/content/weapons.ts` — 525 weapon entries (legendary to absurd)
- `src/lib/content/weaknesses.ts` — 552 Weakness entries (51 severe: true, 501 severe: false)
- `src/lib/content/backstories.ts` — 40 backstory entries
- `src/lib/content/titles.ts` — 113 title entries (52+ epic, 61 absurd)
- `src/lib/content/enchantments.ts` — 33 enchantment entries
- `src/lib/content/races.test.ts` — 15 structural unit tests for races and archetypes

## Decisions Made
- Chose split-file pattern for powers (epic vs absurd) to stay under 800-line guidance and make each tonal half independently editable
- Used equal weight (1) for all non-race entries — rarity comes from the draw pool size, not individual weights, for these categories
- Added Human entry with weight 38 specifically to satisfy Common-race invariant test
- Severe weaknesses (51 entries) cover classical fantasy/horror debilitations; absurd pool (501) covers social, digital, and corporate afflictions

## Deviations from Plan

None — plan executed exactly as written. Entry counts exceed minimums on all files. svelte-check: 0 errors. vitest: 61/61 tests pass.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required. All content is static TypeScript arrays bundled client-side.

## Known Stubs
None — all content arrays are fully populated with real entries. No placeholder text or empty values.

## Next Phase Readiness
- All content arrays ready for consumption by spinQueue.ts `getSegmentsForCategory` (Plan 02-03/02-04)
- races and archetypes arrays wire directly into the variable-count spin queue logic
- powers, weapons, weaknesses arrays power the stat-agnostic spin categories
- FlavorLabel content for stat wheels (Strength, Speed, etc.) is authored in Plan 02-03

---
*Phase: 02-full-23-spin-game-loop*
*Completed: 2026-05-16*
