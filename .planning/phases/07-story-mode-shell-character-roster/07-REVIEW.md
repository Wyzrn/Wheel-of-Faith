---
phase: 07-story-mode-shell-character-roster
reviewed: 2026-05-18T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - src/components/story/RosterCard.svelte
  - src/components/story/SellConfirmModal.svelte
  - src/components/story/StorySpinView.svelte
  - src/lib/story/naming.ts
  - src/lib/story/shards.ts
  - src/lib/story/store.ts
  - src/lib/story/storySession.ts
  - src/lib/story/types.ts
  - src/routes/story/+page.svelte
  - src/lib/story/naming.test.ts
  - src/lib/story/shards.test.ts
  - src/lib/story/store.test.ts
  - src/lib/story/storySession.test.ts
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-05-18T00:00:00Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

The Story Mode shell implementation is structurally sound — isolation from the main-game `wof_*` namespace is correctly enforced, the shard value table covers all 46 `TierGrade` values, localStorage round-trips are guarded against corruption, and the `scoreTier()` rule from CLAUDE.md is respected throughout. The test suites are well-structured.

One BLOCKER is present: `StorySpinView.svelte` initializes `showResumePrompt` to `false` unconditionally, so the `SpinWheel` component mounts and may begin GSAP initialization during a resumable session, before the resume modal appears one tick later. Four warnings cover: biased/duplicate name entries in `naming.ts`, cross-list word overlap producing nonsense names, a silently divergent `STAT_CATEGORIES` copy between two files, and missing runtime validation on deserialized localStorage data.

---

## Critical Issues

### CR-01: SpinWheel mounts briefly before resume modal appears in StorySpinView

**File:** `src/components/story/StorySpinView.svelte:32-48`

**Issue:** `showResumePrompt` is hard-coded to `false` at line 36, but the existing session is already loaded into `session`, `results`, `queue`, and `currentIndex` at lines 32–35. The render condition at line 176 (`{#if currentDef && !showResumePrompt}`) therefore shows the `SpinWheel` on the first frame. `onMount` fires one tick later and sets `showResumePrompt = true`, hiding the wheel. During that first tick, `SpinWheel` mounts with mid-session segments — its `onMount` hook (GSAP initialization, event listeners) executes against the wrong spin state. This is observable as a flash and can cause the wheel to partially animate or register duplicate handlers.

The root cause is splitting what should be a single synchronous read into an eager read (lines 32–35) and a lazy check (onMount, lines 41–48), with `showResumePrompt` not initialized from the eager read.

**Fix:**
```typescript
// Replace lines 32-48 with a single synchronous initialization block:
const _initialSession = loadStorySession()
const _hasResumable = _initialSession !== null && _initialSession.completedSpins.length > 0

let session     = $state<StorySessionState>(_initialSession ?? createStorySession())
let results     = $state<SpinResult[]>(session.completedSpins ?? [])
let queue       = $state<SpinDefinition[]>(session.spinQueue)
let currentIndex = $state(session.currentSpinIndex ?? 0)
let showResumePrompt = $state(_hasResumable)
let showModeIndicator = $state(true)

// onMount only needs the indicator timer now:
onMount(() => {
  setTimeout(() => { showModeIndicator = false }, 2000)
})
```

This eliminates the second `loadStorySession()` call, the flash, and the risk of premature `SpinWheel` mount.

---

## Warnings

### WR-01: Duplicate adjectives bias name generation in naming.ts

**File:** `src/lib/story/naming.ts:26-41`

**Issue:** The `ADJECTIVES` array contains 80 entries but only 72 unique values. The following words appear more than once: `Gilded` (4 times), `Hollow` (3 times), `Cursed` (2 times), `Forsaken` (2 times), `Sovereign` (2 times). Because `generateCharacterName` picks uniformly from the array by index, `Gilded` is 4× more likely to appear as the adjective component than any unique entry. This skews the name distribution in a way that is invisible from the output but violates the intent of a uniform random draw over the pool.

**Fix:** Deduplicate the `ADJECTIVES` array. Remove the four redundant `Gilded` entries (keeping one), the two extra `Hollow`, `Cursed`, `Forsaken`, and `Sovereign` entries. Consider also deduplicating `NOUNS` (`Harbinger` appears twice, at lines 46 and 55).

---

### WR-02: Cross-list word overlap allows tautological names in naming.ts

**File:** `src/lib/story/naming.ts:25-59`

**Issue:** Four words appear in **both** `ADJECTIVES` and `NOUNS`: `Forsaken`, `Phantom`, `Sovereign`, `Abyssal`. Because the adjective and noun are drawn from independent random picks, these combinations can occur: `"Forsaken Forsaken"`, `"Phantom Phantom"`, `"Sovereign Sovereign"`, `"Abyssal Abyssal"`. These look like rendering bugs to players and undermine the quality of auto-generated names.

**Fix:** Remove cross-list duplicates from one of the two arrays. Specifically, remove `Phantom` and `Abyssal` from `ADJECTIVES` (they read more naturally as nouns), and remove `Forsaken` and `Sovereign` from `NOUNS` (they read more naturally as adjectives). Add replacement entries if pool size needs to be maintained.

---

### WR-03: STAT_CATEGORIES is copy-pasted across two files — silent divergence risk

**File:** `src/components/story/StorySpinView.svelte:19-23` and `src/lib/story/storySession.ts:24-28`

**Issue:** The `STAT_CATEGORIES` constant (the set of stat names used to identify spin results that carry tier/score data) is defined identically in both files. If a new stat is added to `STAT_WEIGHTS` in `scoreTier.ts` and the developer updates one copy of `STAT_CATEGORIES` but not the other, `StorySpinView.svelte` will fail to embed the new stat's `tier` and `score` into the `SpinResult`, and `storySession.ts` will fail to include it in `statScores` for `computeOverallScore`. Both failures are **silent** — no error is thrown, the overall score is just wrong. CLAUDE.md rule 4 designates `scoreTier()` as the single source of truth; a single exported `STAT_CATEGORIES` constant should be its companion.

**Fix:** Export `STAT_CATEGORIES` from `storySession.ts` (or a new shared module) and import it in `StorySpinView.svelte`:

```typescript
// storySession.ts — make it an export
export const STAT_CATEGORIES = new Set([
  'strength', 'speed', 'agility', 'durability', 'iq',
  'charisma', 'fightingSkill', 'potential', 'energyLevel',
  'powerMastery', 'weaponMastery',
])
```

```typescript
// StorySpinView.svelte — import instead of redeclare
import { STAT_CATEGORIES } from '$lib/story/storySession'
```

---

### WR-04: No runtime shape validation on localStorage deserialization

**File:** `src/lib/story/store.ts:22-26` and `src/lib/story/storySession.ts:50-57`

**Issue:** Both `loadRoster()` and `loadStorySession()` perform `JSON.parse(raw) as T` with no runtime validation of the parsed object's shape. TypeScript's `as` cast is erased at runtime; it provides no safety. If a player has data from an older schema version (e.g., a `StoryRosterEntry` written before `sessionStartedAt` was added to the type, or a `StorySessionState` written before `currentSpinIndex` existed), downstream code receives `undefined` for missing fields. Concrete consequences: `roster.find(r => r.id === ...)` returns an entry with `id: undefined`; `buildRosterEntryFromResults` receives `results` with missing `score` fields; `CharacterCard` receives `startedAt: undefined`.

**Fix:** At minimum, add a guard that checks the top-level shape and resets to a safe default if invalid:

```typescript
// store.ts — loadRoster
export function loadRoster(): StoryRosterEntry[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(ROSTER_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []  // add this guard
    return parsed as StoryRosterEntry[]
  } catch {
    return []
  }
}
```

```typescript
// storySession.ts — loadStorySession
export function loadStorySession(): StorySessionState | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORY_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Guard: must have the fields StorySpinView relies on
    if (
      typeof parsed !== 'object' || parsed === null ||
      !Array.isArray(parsed.completedSpins) ||
      !Array.isArray(parsed.spinQueue) ||
      typeof parsed.currentSpinIndex !== 'number'
    ) return null
    return parsed as StorySessionState
  } catch {
    return null
  }
}
```

---

## Info

### IN-01: loadStorySession() called twice in StorySpinView — redundant read

**File:** `src/components/story/StorySpinView.svelte:32,42`

**Issue:** `loadStorySession()` is called once at component initialization (line 32) to populate `session`, and again inside `onMount` (line 42) to decide whether to show the resume prompt. The second call is redundant — the result of the first call already contains the information needed. If localStorage is written between the two calls (unlikely but possible in a multi-tab scenario), the two calls could return different data, putting `session` state and `showResumePrompt` out of sync.

**Fix:** Addressed by the fix for CR-01: store the first result in a local variable and derive `showResumePrompt` from it synchronously, eliminating the need for `onMount`-based detection entirely.

---

### IN-02: Unreachable fallback return in getShardValue

**File:** `src/lib/story/shards.ts:61`

**Issue:** The final `return 20` at line 61 is dead code. The function's parameter is typed as `TierGrade`, and the preceding branches handle all 46 members of that union exhaustively (9 F–D + 6 C–B + 6 A–S + 2 SS base + 23 above-SS = 46). TypeScript's type system prevents any valid `TierGrade` from reaching this line. The comment "should never be reached for a valid TierGrade" confirms this.

**Fix:** Replace the fallback with an exhaustiveness check to make the dead code explicit and catch future `TierGrade` additions:

```typescript
// At end of getShardValue, replace `return 20` with:
const _exhaustive: never = tier
throw new Error(`Unhandled TierGrade: ${_exhaustive}`)
```

Alternatively, if a silent fallback is preferred for resilience, document it explicitly. The current silent `return 20` is misleading because it implies `F-` value for unknown tiers without surfacing the gap.

---

_Reviewed: 2026-05-18T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
