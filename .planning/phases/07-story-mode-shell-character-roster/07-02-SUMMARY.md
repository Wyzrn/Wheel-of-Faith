---
phase: "07"
plan: "02"
subsystem: "story-mode-shell"
tags:
  - svelte
  - sveltekit
  - story-mode
  - ui
  - roster

dependency_graph:
  requires:
    - "07-01 (src/lib/story/types.ts, store.ts, shards.ts)"
    - "src/components/CharacterCard.svelte (readonly prop)"
    - "src/components/TierBadge.svelte (inline variant)"
  provides:
    - "src/routes/story/+page.svelte — view state machine (entry | spin stub | roster | expanded | sell)"
    - "src/components/story/RosterCard.svelte — compact roster card with TierBadge + sell button"
    - "src/components/story/SellConfirmModal.svelte — atomic sell confirmation dialog"
  affects:
    - "Plan 07-03 (spin view stub replaced with real spin loop)"

tech_stack:
  added: []
  patterns:
    - "Svelte 5 runes ($state, $derived, $effect) — no Svelte stores"
    - "$state.snapshot(roster) before saveRoster() to avoid Proxy serialization issues"
    - "Atomic sell handler — four state mutations in one synchronous function"
    - "stopPropagation on sell button so card expand and sell are independent interactions"
    - "Tab focus trap in SellConfirmModal between Keep Character and Confirm Sell"
    - "View state machine on single route (no navigation, no view transitions)"

key_files:
  created:
    - src/routes/story/+page.svelte
    - src/components/story/RosterCard.svelte
    - src/components/story/SellConfirmModal.svelte
  modified: []

decisions:
  - "Spin view is a labeled stub ('Coming in Plan 03.') — Plan 03 replaces with real spin loop"
  - "No src/routes/story/+layout.js created — root layout ssr=false is inherited per plan spec"
  - "RosterCard hover/focus styles applied via inline onmouseenter/onmouseleave/onfocus/onblur handlers rather than CSS classes since the card needs dynamic border-color values from CSS variables"
  - "View logic for expanded overlay kept in same page component (not a separate overlay component) per plan spec"

metrics:
  duration: "15m"
  completed_date: "2026-05-18"
  tasks_completed: 2
  files_created: 3
---

# Phase 7 Plan 02: Story Mode Shell + Character Roster Summary

**One-liner:** SvelteKit `/story` route with a four-state view machine (entry/spin-stub/roster/expanded), plus RosterCard and SellConfirmModal components wired to the Plan 01 data layer for a fully functional roster with sort, expand, and atomic sell.

## Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `src/routes/story/+page.svelte` | 322 | Story Mode root — view state machine, entry screen, roster grid, expanded overlay, sell dialog |
| `src/components/story/RosterCard.svelte` | 75 | Compact roster card with TierBadge, name/race/archetype, Sell Character button |
| `src/components/story/SellConfirmModal.svelte` | 129 | Confirmation dialog showing shard value, with Tab trap and Escape key handler |

**Total:** 3 files, 526 lines

## View State Machine Transitions

```
entry
  → spin (stub — "Coming in Plan 03.")  → entry (Back button)
  → roster (View Roster link)
       → expanded (click RosterCard anywhere except sell)  → roster (close button / backdrop)
       sellTarget set (click Sell Character button)
         → SellConfirmModal overlay (rendered regardless of current view)
           → sellTarget=null (Keep Character / Escape / backdrop)
           → confirmSell() (Confirm Sell) — atomic: roster filter + shards++ + sellTarget=null
```

## Confirmed Isolation

Grep output — no main-game store imports in any story file:

```
grep -rE "(\$lib/session/store|\$lib/spinHistory|wof_session|wof_spin_history)" \
  src/routes/story/ src/components/story/
(no output — 0 matches)
```

Story Mode uses exclusively: `story_roster` and `story_shards` localStorage keys.

## Manual Test Trace (documented for /gsd-verify-work)

1. Open DevTools → Application → Local Storage
2. Run: `localStorage.setItem('story_roster', JSON.stringify([{id:'t1',name:'Test Hero',race:'Human',archetype:'Knight',overallScore:50,overallTier:'C',spins:[],createdAt:'2026-05-18T00:00:00Z',sessionStartedAt:'2026-05-18T00:00:00Z'}]))`
3. Navigate to `/story` → Entry screen shows "1 / 50 characters" and "View Roster" link
4. Click "View Roster" → Roster grid shows one card with "Test Hero", "Human", "Knight", TierBadge "C"
5. Click anywhere on the card (except Sell) → expanded overlay opens with CharacterCard readonly
6. Click × or backdrop → returns to roster view
7. Click "Sell Character" on card → SellConfirmModal appears with shard value from getShardValue('C')
8. Click "Confirm Sell" → card removed from roster, shard balance increments, modal closes
9. Reload page → shards balance persists; roster is empty

## Deferred Items

| Item | Reason |
|------|--------|
| Spin view stub (`view === 'spin'`) | Plan 03 replaces with real Story Mode spin loop using SpinWheel.svelte |
| Backend writes (`story_characters` collection) | Phase 8+ per 07-RESEARCH.md Assumption A2 |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1: RosterCard + SellConfirmModal | ab6bcc8 | feat(07-02): RosterCard and SellConfirmModal components |
| Task 2: /story route | 0097b07 | feat(07-02): /story route — entry/roster/expanded/sell view state machine |

## Deviations from Plan

### Auto-fixed Issues

None.

### Pre-existing Issues (out of scope)

**1. [Pre-existing] TierBadge.svelte + +page.svelte "God" type error**

- **Found during:** Task 1 svelte-check run
- **Issue:** `TierBadge.svelte:14` and `src/routes/+page.svelte:1201/1209` have TypeScript errors related to `'God'` not being a valid `TierGrade` member (codebase extended to 46 grades ending at `Absolute+`).
- **Status:** Pre-existing, out of scope for this plan. No new errors were introduced. These errors existed before Plan 02 started (3 errors both before and after Task 1 and Task 2).
- **Action:** Logged here; not fixed (out of scope boundary per deviation rules).

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| Spin view stub | src/routes/story/+page.svelte | ~104 | Placeholder panel — Plan 03 replaces with real spin loop. Clearly labeled "Coming in Plan 03." |

The spin stub is an intentional and documented placeholder per the plan spec. It does not prevent Plan 02's goal (roster CRUD + sell flow) from being achieved.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All new files operate exclusively on localStorage keys `story_roster` and `story_shards`.

## Self-Check: PASSED

Files verified:

- [x] src/routes/story/+page.svelte — FOUND
- [x] src/components/story/RosterCard.svelte — FOUND
- [x] src/components/story/SellConfirmModal.svelte — FOUND

Commits verified:

- [x] ab6bcc8 — FOUND (feat(07-02): RosterCard and SellConfirmModal components)
- [x] 0097b07 — FOUND (feat(07-02): /story route — entry/roster/expanded/sell view state machine)

svelte-check: 3 pre-existing errors (not in story files), 0 new errors
tsc --noEmit: exit 0
