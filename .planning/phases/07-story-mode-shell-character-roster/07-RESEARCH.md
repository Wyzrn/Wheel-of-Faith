# Phase 7: Story Mode Shell + Character Roster - Research

**Researched:** 2026-05-18
**Domain:** SvelteKit routing isolation, localStorage namespacing, auto-naming, roster UI, sell mechanic
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ROST-01 | After completing a character, player can add it to a persistent roster; auto-generated fantasy name (adjective + fantasy-noun, seeded from stats), permanent and never editable | Seeding pattern documented; name generation module design specified |
| ROST-02 | Roster persists to backend and localStorage; max 50 slots; full-page roster UI sortable by overall tier, race, or archetype | `story_roster` localStorage schema defined; 50-cap enforcement pattern documented |
| ROST-03 | Clicking any roster card expands to the full character sheet with all stats, powers, weapons, weaknesses | CharacterCard component reuse boundary defined |
| ROST-04 | Player can sell any roster character for Fate Shards; sell price from overall tier bracket; confirmation dialog; irreversible | Shard value table (ECON-04) and confirmation pattern documented |
</phase_requirements>

---

## Summary

Phase 7 creates Story Mode as a completely isolated SvelteKit route at `/story`. The isolation rule is absolute: `src/routes/story/+page.svelte` must not import `$lib/session/store`, must not read `wof_session` from localStorage, and must not call any backend endpoint that touches the `characters` collection. Everything Story Mode needs lives under its own `story_*` localStorage keys and will eventually write to a separate `story_characters` MongoDB collection.

The spin loop inside Story Mode is a constrained copy of the main game's loop — same content modules (`$lib/content/*`, `$lib/game/spinQueue`, `$lib/game/scoreTier`, `$lib/game/geometry`), new orchestration. Phase 7 does not implement tier gating (that is Phase 8); Phase 7 runs an unconstrained full spin loop scoped entirely within Story Mode's own Svelte state. The key difference from the main game is that on session completion the character is auto-named and written to the roster rather than prompting the user to name it and offering a share link.

Auto-naming uses a deterministic seeded PRNG (mulberry32 seeded from the character's overall score + a hash of the race label). This approach is reproducible, zero-dependency, and produces consistent names for a given character. The roster data schema for localStorage is a flat JSON array of `StoryRosterEntry` objects under `story_roster`, capped at 50 entries. The sell mechanic reads the overall tier, looks up the shard value table from ECON-04, shows a confirmation modal, and removes the entry from the roster array. The Fate Shard balance lives under `story_shards`.

**Primary recommendation:** Build Story Mode as a self-contained Svelte island — its own route, its own localStorage module (`$lib/story/store.ts`), its own type definitions — reusing only pure utility and content modules that carry no main-game state.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Story Mode entry screen / routing | Frontend (SvelteKit route) | — | New route `src/routes/story/+page.svelte`; ssr=false (inherits root layout) |
| Story Mode spin loop orchestration | Frontend (Svelte state) | — | Same pattern as main +page.svelte but scoped to story state; no backend during spin |
| Auto-naming (adjective + noun seeded from stats) | Frontend (pure function) | — | Deterministic seeded RNG; runs client-side at session completion |
| Roster persistence (localStorage) | Frontend (localStorage) | — | `story_roster` key; serialized `StoryRosterEntry[]`; max 50 |
| Roster persistence (backend, Phase 7 scope) | DEFERRED to Phase 8+ | — | `story_characters` collection defined in schema but writes are deferred; Phase 7 is localStorage-only |
| Roster card grid + sort | Frontend (Svelte state) | — | `$state` sort key; `$derived` sorted array; compact card components |
| Character sheet expand (roster card click) | Frontend (Svelte overlay/drawer) | — | Reuses `CharacterCard` component with `readonly=true`; no navigation required |
| Sell mechanic + confirmation dialog | Frontend (Svelte state) | — | Confirmation modal state; writes to `story_roster` and `story_shards` atomically |
| Fate Shard balance | Frontend (localStorage) | — | `story_shards` key; integer; read/written by sell mechanic |
| Shard value lookup (tier bracket) | Frontend (pure function) | — | `getShardValue(overallTier)` pure function in `$lib/story/shards.ts` |

---

## Standard Stack

### Core (verified against project's installed packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Svelte 5 | 5.55.2 | Reactivity runes (`$state`, `$derived`, `$effect`), component model | [VERIFIED: package.json] Already installed, project-wide standard |
| SvelteKit 2 | 2.57.0 (adapter-node) | File-based routing; `src/routes/story/+page.svelte` | [VERIFIED: package.json] Main game already uses this router |
| Tailwind CSS 4 | 4.3.0 | Utility styling — roster cards, entry screen, modals | [VERIFIED: package.json] Project standard |
| TypeScript | 6.0.2 | Type safety across all new modules | [VERIFIED: package.json] Project-wide |
| Vitest | 4.1.6 | Unit tests for pure functions (name gen, shard value lookup, roster store) | [VERIFIED: package.json] Existing test infrastructure |

### Supporting (no new installs needed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| GSAP 3.15.0 | 3.15.0 | `power4.out` wheel animation inside Story Mode spin loop | Mandatory per CLAUDE.md rule 5 |
| nanoid | 5.1.11 | Generating `storySessionId` UUIDs for roster entries | [VERIFIED: server/package.json] Already available server-side |
| `crypto.randomUUID()` | Browser API | Client-side session ID generation (same pattern as main game's `createSession()`) | [VERIFIED: src/lib/session/store.ts] Existing pattern |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Mulberry32 seeded PRNG (inline ~10 lines) | `seedrandom` npm package | `seedrandom` adds a dependency for a trivial problem; mulberry32 is idiomatic, zero-dependency, fast |
| localStorage JSON array for roster | IndexedDB | IndexedDB is async and complex for 50-item roster; JSON array in localStorage is simpler and consistent with how the main game stores session state |
| Svelte overlay/drawer for expanded card | Separate `/story/character/[id]` route | Route approach requires sharing state across navigation or re-fetching; overlay keeps roster state alive and avoids back-button complexity |

---

## Architecture Patterns

### System Architecture Diagram

```
Player navigates to /story
         |
         v
src/routes/story/+page.svelte
  [Story Mode entry screen]
         |
   Player clicks "New Character"
         |
         v
  [Story Mode spin loop]
  (Svelte $state — mirrors +page.svelte
   spin orchestration but uses its own
   session state; reads content modules
   from $lib/content/* and $lib/game/*)
         |
  All spins complete
         |
         v
  [Auto-name generation]
  ($lib/story/naming.ts)
  seeded PRNG from overallScore + race hash
         |
         v
  [Add to roster]
  ($lib/story/store.ts → localStorage story_roster)
         |
         v
  [Roster view]
  compact RosterCard grid, sortable by tier/race/archetype
         |
   Player clicks card
         |
         v
  [Expanded sheet overlay]
  <CharacterCard results={...} readonly={true} />
         |
   Player clicks "Sell"
         |
         v
  [Confirmation modal]
  shows shard value (getShardValue(overallTier))
         |
   Confirmed
         |
         v
  [story_roster entry removed]
  [story_shards += value]
  [localStorage updated]
```

### Recommended Project Structure

```
src/
├── routes/
│   └── story/
│       └── +page.svelte           # Story Mode root; all view states live here
├── components/
│   ├── story/
│   │   ├── StoryEntryScreen.svelte  # Entry screen (title, "New Character" / "Roster" buttons)
│   │   ├── RosterCard.svelte        # Compact card: name, race, archetype, tier badge, sell button
│   │   └── SellConfirmModal.svelte  # Confirmation dialog with shard value
│   └── CharacterCard.svelte         # REUSED (readonly=true); not modified
└── lib/
    └── story/
        ├── store.ts                 # localStorage CRUD for story_roster + story_shards
        ├── types.ts                 # StoryRosterEntry, StoryState interfaces
        ├── naming.ts                # generateCharacterName(overallScore, raceLabel) → string
        └── shards.ts                # getShardValue(overallTier: TierGrade) → number
```

### Pattern 1: Isolated Story Mode localStorage Module

**What:** All Story Mode state reads/writes go through `$lib/story/store.ts`. This module uses its own key constants and never touches `wof_session` or `wof_spin_history`.

**When to use:** Any time Story Mode needs to persist or read state.

**Example:**
```typescript
// src/lib/story/store.ts
// Source: mirrors existing pattern in src/lib/session/store.ts [VERIFIED]

const ROSTER_KEY = 'story_roster'
const SHARDS_KEY = 'story_shards'

export function loadRoster(): StoryRosterEntry[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(ROSTER_KEY)
    if (!raw) return []
    return JSON.parse(raw) as StoryRosterEntry[]
  } catch {
    return []
  }
}

export function saveRoster(roster: StoryRosterEntry[]): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(ROSTER_KEY, JSON.stringify(roster))
}

export function loadShards(): number {
  if (typeof localStorage === 'undefined') return 0
  return parseInt(localStorage.getItem(SHARDS_KEY) ?? '0', 10)
}

export function saveShards(amount: number): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(SHARDS_KEY, String(amount))
}
```

### Pattern 2: Deterministic Auto-Naming (Seeded PRNG)

**What:** Character name = `adjective + ' ' + fantasyNoun`, generated from a seeded PRNG. Seed is derived from `overallScore * 31 + hashStr(raceLabel)` so the same character always produces the same name. Name is generated once at session completion and stored in the roster entry — never re-derived.

**When to use:** When a Story Mode spin session completes and the character is being added to the roster.

**Example:**
```typescript
// src/lib/story/naming.ts
// Source: mulberry32 algorithm — public domain [ASSUMED — no official spec URL]

function mulberry32(seed: number): () => number {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

const ADJECTIVES = [
  'Crimson', 'Void', 'Iron', 'Shattered', 'Eternal', 'Cursed', 'Golden', 'Silent',
  'Blazing', 'Ancient', 'Fallen', 'Raging', 'Hollow', 'Gilded', 'Wretched',
  'Undying', 'Forsaken', 'Radiant', 'Obsidian', 'Exiled',
  // ... 80+ total for variety
]

const NOUNS = [
  'Reaper', 'Sovereign', 'Wraith', 'Colossus', 'Arbiter', 'Specter', 'Titan',
  'Champion', 'Revenant', 'Oracle', 'Warden', 'Phantom', 'Hierarch', 'Nemesis',
  'Bastion', 'Harbinger', 'Sentinel', 'Vanguard', 'Pariah', 'Justicar',
  // ... 80+ total
]

export function generateCharacterName(overallScore: number, raceLabel: string): string {
  const seed = (overallScore * 31 + hashStr(raceLabel)) | 0
  const rand = mulberry32(seed)
  const adj  = ADJECTIVES[Math.floor(rand() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(rand() * NOUNS.length)]
  return `${adj} ${noun}`
}
```

### Pattern 3: StoryRosterEntry Schema (localStorage)

**What:** Each character stored in `story_roster` is a `StoryRosterEntry` — a snapshot of all spin results plus denormalized fields for sorting and display.

**When to use:** When serializing a completed Story Mode character to the roster.

```typescript
// src/lib/story/types.ts
import type { SpinResult } from '$lib/session/types'
import type { TierGrade } from '$lib/game/scoreTier'

export interface StoryRosterEntry {
  id: string              // crypto.randomUUID() — unique within roster
  name: string            // auto-generated, permanent (adjective + noun)
  race: string            // denormalized from spin results for sort/filter
  archetype: string       // denormalized from spin results for sort/filter
  overallScore: number    // computed at session end via computeOverallScore()
  overallTier: TierGrade  // computed via scoreTier(overallScore)
  spins: SpinResult[]     // full spin result array — used by CharacterCard
  createdAt: string       // ISO timestamp
}

export interface StoryState {
  roster: StoryRosterEntry[]
  shards: number
}
```

### Pattern 4: Shard Value Lookup

**What:** A pure function mapping overall tier to Fate Shard sell value. Implements the ECON-04 pricing table from REQUIREMENTS.md.

**When to use:** In `SellConfirmModal` to display the value, and in the sell confirmation handler.

```typescript
// src/lib/story/shards.ts
// Source: ECON-04 from REQUIREMENTS.md [VERIFIED]

import type { TierGrade } from '$lib/game/scoreTier'
import { TIER_THRESHOLDS } from '$lib/game/scoreTier'

// Tier bracket index above SS (0 = SS+, 1 = SSS-, 2 = SSS, 3 = SSS+, ...)
const TIERS_ABOVE_SS: TierGrade[] = ['SS+', 'SSS-', 'SSS', 'SSS+', 'Z-', 'Z', 'Z+', 'ZZ-', 'ZZ', 'ZZ+', 'ZZZ-', 'ZZZ', 'ZZZ+', 'Celestial-', 'Celestial', 'Celestial+', 'Godly-', 'Godly', 'Primordial', 'Primordial+', 'Absolute-', 'Absolute', 'Absolute+']

export function getShardValue(tier: TierGrade): number {
  // F–D: 20–55 (interpolated by tier index within bracket)
  const fdTiers: TierGrade[] = ['F-','F','F+','E-','E','E+','D-','D','D+']
  if (fdTiers.includes(tier)) {
    const idx = fdTiers.indexOf(tier)
    return 20 + Math.round((idx / (fdTiers.length - 1)) * 35)
  }
  // C–B: 70–130
  const cbTiers: TierGrade[] = ['C-','C','C+','B-','B','B+']
  if (cbTiers.includes(tier)) {
    const idx = cbTiers.indexOf(tier)
    return 70 + Math.round((idx / (cbTiers.length - 1)) * 60)
  }
  // A–S: 160–320
  const asTiers: TierGrade[] = ['A-','A','A+','S-','S','S+']
  if (asTiers.includes(tier)) {
    const idx = asTiers.indexOf(tier)
    return 160 + Math.round((idx / (asTiers.length - 1)) * 160)
  }
  // SS base (not SS+): 500
  if (tier === 'SS-' || tier === 'SS') return 500
  // God: 2,000
  if (tier === 'Absolute+' || tier === 'Absolute' || tier === 'Absolute-') return 2000
  // SS+: 500 base + 100 per tier above SS
  const aboveIdx = TIERS_ABOVE_SS.indexOf(tier)
  if (aboveIdx >= 0) return 500 + (aboveIdx + 1) * 100
  return 20 // fallback
}
```

### Pattern 5: Svelte 5 Rune Pattern (consistent with existing codebase)

**What:** Story Mode uses `$state` for mutable local state, `$derived` for computed views, `$effect` for side effects (localStorage writes). No stores — same pattern as `+page.svelte`.

**When to use:** Throughout `+page.svelte` (story) and all story components.

```typescript
// src/routes/story/+page.svelte — view state sketch
// Source: mirrors existing +page.svelte pattern [VERIFIED: src/routes/+page.svelte]

let view = $state<'entry' | 'spin' | 'roster' | 'expanded'>('entry')
let roster = $state<StoryRosterEntry[]>([])
let shards = $state(0)
let sortBy = $state<'tier' | 'race' | 'archetype'>('tier')
let expandedId = $state<string | null>(null)
let sellTarget = $state<StoryRosterEntry | null>(null)

// Sorted roster for display — $derived updates automatically
let sortedRoster = $derived([...roster].sort((a, b) => {
  if (sortBy === 'tier') return b.overallScore - a.overallScore
  if (sortBy === 'race') return a.race.localeCompare(b.race)
  return a.archetype.localeCompare(b.archetype)
}))

// Persist on change — $effect is the correct Svelte 5 pattern
$effect(() => {
  saveRoster(roster)
})

$effect(() => {
  saveShards(shards)
})
```

### Pattern 6: Story Mode Spin Loop — Isolation Approach

**What:** The Story Mode spin loop in `+page.svelte` (story) is a NEW Svelte state machine — it does NOT import from `$lib/session/store`. It owns its own `storySession` state variable and calls `buildInitialQueue()` / `getSegmentsForCategory()` / `weightedRandom()` directly. When the session completes, it calls `generateCharacterName()` and adds the entry to the local `roster` state.

**Reusable (import freely):**
- `$lib/game/spinQueue` — `buildInitialQueue`, `getSegmentsForCategory`
- `$lib/game/scoreTier` — `computeOverallScore`, `scoreTier`
- `$lib/game/random` — `weightedRandom`
- `$lib/game/geometry` — `slicePath`, `weightedSegmentAngles`
- `$lib/game/redemption` — `redemptionProbability`
- `$lib/content/*` — all content modules
- `src/components/SpinWheel.svelte` — wheel animation component
- `src/components/CharacterCard.svelte` — with `readonly=true`
- `src/components/TierBadge.svelte` — tier badge display

**DO NOT import in Story Mode:**
- `$lib/session/store` — reads/writes `wof_session`
- `$lib/spinHistory` — reads/writes `wof_spin_history`
- Any direct reference to `wof_*` localStorage keys

### Pattern 7: Confirm-Before-Sell Modal

**What:** Selling is a two-step action — clicking "Sell" sets `sellTarget` state, which renders `SellConfirmModal`. Confirming calls `handleSell()`, which atomically removes from roster and credits shards.

```typescript
// Atomic sell operation — no partial state
function handleSell(entry: StoryRosterEntry): void {
  const value = getShardValue(entry.overallTier)
  roster = roster.filter(r => r.id !== entry.id)
  shards += value
  sellTarget = null  // close modal
}
```

### Anti-Patterns to Avoid

- **Importing `$lib/session/store` in Story Mode:** Breaks isolation; `wof_session` state would bleed. Use `$lib/story/store.ts` exclusively.
- **Using the main game's `SessionAccumulator` or session state:** Story Mode owns its own Svelte reactive variables for the spin loop — not a shared accumulator.
- **Re-deriving tier from stored score at display time:** Store `overallTier: TierGrade` in the roster entry. Do not call `scoreTier()` reactively on stored score in the roster view — it was computed once at session end.
- **Navigating to `/character/[id]` for expanded roster view:** This route hits the main backend `characters` collection. Story Mode expansion is an in-page overlay using `CharacterCard` with `readonly=true`.
- **Using `crypto.randomUUID()` as the name seed:** UUIDs are not deterministic per character stats. The name must be seeded from stats so it is reproducible (e.g., for tests). A roster entry's `id` field is a random UUID; the `name` is seeded deterministically.
- **Allowing roster over 50 entries without enforcement:** Cap must be enforced at write time in `addToRoster()`, not at display time.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Wheel animation in Story Mode | Custom CSS animation | `SpinWheel.svelte` + GSAP | CLAUDE.md rule 5: `power4.out` only; existing component is validated |
| Tier display | Custom tier badge markup | `TierBadge.svelte` | Already handles all 46 grades incl. legacy normalization |
| Character sheet in roster expand | New sheet component | `CharacterCard` with `readonly=true` | Pixel-identical to share view; avoids stat display drift |
| Overall score computation | Custom weighted average | `computeOverallScore()` from scoreTier.ts | CLAUDE.md rule 4: `scoreTier()` is single source of truth |
| Weighted random pick | Custom RNG | `weightedRandom()` from random.ts | Existing tested implementation |
| Spin queue building | Custom queue array | `buildInitialQueue()` + `getSegmentsForCategory()` | Existing validated implementations with all category wiring |
| Sort comparator | Inline sort logic | $derived sorted array (one expression) | Svelte 5 reactivity handles updates automatically |

**Key insight:** The main game is a reference implementation for the spin loop and character display. Reuse every pure utility; isolate only the state management layer.

---

## Common Pitfalls

### Pitfall 1: State Bleeding — Reading wof_session from Story Mode

**What goes wrong:** If a developer imports `loadSession()` from `$lib/session/store` inside the story route (e.g., to "restore" from a crash), they inadvertently read main-game session state. Story Mode then renders a character mid-way through a main game session.

**Why it happens:** The session restoration pattern in the main game looks useful to copy. The isolation boundary is not enforced by TypeScript.

**How to avoid:** `$lib/story/store.ts` is the ONLY localStorage module that Story Mode touches. No import of `$lib/session/store` anywhere in `src/routes/story/` or `src/components/story/`.

**Warning signs:** Any `import` of `wof_session`, `loadSession`, `saveSession`, or `clearSession` in story-scoped files.

---

### Pitfall 2: Auto-Name Non-Determinism

**What goes wrong:** Using `Math.random()` or `crypto.randomUUID()` for name generation means the same character always gets a different name. Testing becomes impossible; users notice inconsistency if the page reloads before the name is stored.

**Why it happens:** It's tempting to just pick a random name at display time. The requirement says "permanent and never editable" — this only makes sense if the name is generated once and stored.

**How to avoid:** Generate name immediately at session completion, store it in the `StoryRosterEntry` before any other state change. Use mulberry32 seeded from `(overallScore * 31 + hashStr(raceLabel)) | 0`.

**Warning signs:** `Math.random()` calls inside `generateCharacterName()`.

---

### Pitfall 3: CharacterCard Compatibility — Missing Props

**What goes wrong:** `CharacterCard` requires `startedAt: string` (ISO timestamp) as a required prop. Story Mode sessions need to capture `startedAt` at session creation and carry it through to the `StoryRosterEntry`. Failing to pass it renders the card broken.

**Why it happens:** The `startedAt` requirement was added as a Phase 4 decision (see STATE.md: "CharacterCard requires startedAt: string prop"). Story Mode creates its own session and must track `startedAt` from when the spin session begins.

**How to avoid:** `StoryRosterEntry` must include `sessionStartedAt: string` (set to `new Date().toISOString()` when the story spin session starts). Pass it as the `startedAt` prop when rendering `CharacterCard`.

**Warning signs:** TypeScript error "Property 'startedAt' is missing" when mounting `CharacterCard`.

---

### Pitfall 4: Roster Cap Not Enforced at Write Time

**What goes wrong:** If `addToRoster()` does not enforce the 50-slot cap, the roster silently grows beyond the spec. localStorage stores up to ~5MB, so this won't crash, but it breaks ROST-02 and makes the Phase 12 shop spin flow incorrect.

**Why it happens:** Developers enforce the cap in the display/sort logic but forget the write path.

**How to avoid:** `addToRoster()` in `$lib/story/store.ts` checks `roster.length < 50` before pushing; throws or returns `false` if at cap. The UI disables "New Character" when at 50 — must sell before generating more.

---

### Pitfall 5: SvelteKit SSR — Story Route Inherits Root Layout

**What goes wrong:** The root `+layout.js` exports `ssr = false`. This means `/story` inherits CSR-only by default — which is correct for Story Mode (it needs localStorage). However, if anyone adds a `+layout.js` to `src/routes/story/` that inadvertently re-enables SSR, all localStorage calls will fail server-side.

**Why it happens:** SSR override is a per-route option; copying the `+layout.js` pattern from the `/character/[id]` route (which enables SSR) into Story Mode would break it.

**How to avoid:** Do NOT add a `+layout.js` to `src/routes/story/`. The inherited `ssr = false` from the root layout is correct and sufficient.

**Warning signs:** `ReferenceError: localStorage is not defined` in server logs.

---

### Pitfall 6: Sell Value Edge Cases at Tier Boundaries

**What goes wrong:** The ECON-04 pricing table has distinct brackets. If `getShardValue()` is implemented with simple tier index arithmetic without handling the extended tiers (Z, ZZ, ZZZ, Celestial, Godly, Primordial, Absolute), those tiers either crash or return 20 (fallback).

**Why it happens:** The main game now has 46 grades (not 28 as originally specced). The ECON-04 table was written when the tier system was smaller; "SS+" in the table now refers to SS+ and everything above it up to Absolute+.

**How to avoid:** The shard value function must handle the full 46-grade `TierGrade` union. Tiers above SS (SS+, SSS-, SSS, SSS+, Z*, ZZ*, ZZZ*, Celestial*, Godly*, Primordial, Absolute*) all use the `500 + 100 × stepsAboveSS` formula, with Absolute tier capping at 2000.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Mulberry32 is public domain and commonly used for browser seeded PRNGs | Pattern 2 (Auto-Naming) | Low — can swap algorithm without changing interface |
| A2 | Phase 7 defers backend writes to Phase 8+ (localhost-only roster) | Architectural Responsibility Map | Medium — if backend writes are needed in Phase 7, the `story_characters` Mongoose model must be created now |
| A3 | ECON-04 sell prices apply to extended tiers (Z, ZZ, ZZZ, Celestial, Godly, Primordial, Absolute) under the "SS+ = 500 + 100 per tier above SS" formula | Pattern 4 (Shards) | Low — only affects edge-case characters at very high tiers |
| A4 | `CharacterCard` with `readonly=true` renders without needing `onNewCharacter` or `onBackToMenu` callbacks | Pattern 6 / ROST-03 | Medium — CharacterCard's prop signature should be verified before integration; `onNewCharacter` is required in current signature |

---

## Open Questions (RESOLVED)

1. **Backend writes in Phase 7 or Phase 8?**
   - RESOLVED: Phase 7 is localStorage-only. Backend writes deferred to Phase 8+. Matches the Phase 1/2 frontend-first pattern. (07-02, 07-03 objectives; Assumption A2)

2. **CharacterCard `onNewCharacter` prop — required or optional in readonly mode?**
   - RESOLVED: Pass `onNewCharacter={() => {}}` as a no-op in the readonly Story Mode overlay. CharacterCard is not modified. (07-02 Task 2 action)

3. **Name adjective/noun word list size — minimum for quality?**
   - RESOLVED: 40 adjectives + 40 nouns (1,600 unique combos) is the Phase 7 target. (07-01 Task 2 behavior)

---

## Environment Availability

Step 2.6: SKIPPED — Phase 7 has no external dependencies beyond the project's own installed packages. No external services, CLIs, or runtimes beyond Node 20 and the running Fastify/MongoDB server are required for Phase 7 (backend deferred).

---

## Code Examples

### Loading and initializing Story Mode state on mount

```typescript
// src/routes/story/+page.svelte — onMount pattern
// Source: mirrors src/routes/+page.svelte onMount [VERIFIED]

import { onMount } from 'svelte'
import { loadRoster, loadShards } from '$lib/story/store'

onMount(() => {
  roster = loadRoster()
  shards = loadShards()
})
```

### Adding a character to the roster (cap enforcement)

```typescript
// src/lib/story/store.ts
export const MAX_ROSTER_SIZE = 50

export function addToRoster(
  roster: StoryRosterEntry[],
  entry: StoryRosterEntry
): StoryRosterEntry[] | null {
  if (roster.length >= MAX_ROSTER_SIZE) return null  // at cap — reject
  const updated = [entry, ...roster]
  saveRoster(updated)
  return updated
}
```

### Sell confirmation flow (Svelte 5 runes)

```svelte
<!-- SellConfirmModal.svelte snippet -->
<script lang="ts">
  import { getShardValue } from '$lib/story/shards'
  import type { StoryRosterEntry } from '$lib/story/types'

  let { entry, onConfirm, onCancel }: {
    entry: StoryRosterEntry
    onConfirm: () => void
    onCancel: () => void
  } = $props()

  let value = $derived(getShardValue(entry.overallTier))
</script>

<div class="modal-overlay">
  <div class="modal">
    <p>Sell <strong>{entry.name}</strong>?</p>
    <p>This action is irreversible.</p>
    <p>You will receive <strong>{value} Fate Shards</strong>.</p>
    <button onclick={onCancel}>Cancel</button>
    <button onclick={onConfirm}>Confirm Sell</button>
  </div>
</div>
```

### Expanded roster card overlay

```svelte
<!-- +page.svelte (story) — expanded card pattern -->
{#if expandedId !== null}
  {@const entry = roster.find(r => r.id === expandedId)}
  {#if entry}
    <div class="overlay" onclick={() => expandedId = null}>
      <div onclick={(e) => e.stopPropagation()}>
        <CharacterCard
          results={entry.spins}
          name={entry.name}
          startedAt={entry.sessionStartedAt}
          readonly={true}
          onNewCharacter={() => {}}
        />
      </div>
    </div>
  {/if}
{/if}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 28-grade tier system (F- → God) | 46-grade system (F- → Absolute+) | Phase 2 completion (ea5ab48) | `getShardValue()` must handle all 46 grades in `TierGrade` union |
| `onNewCharacter` always required on CharacterCard | Same (still required) | No change | Story Mode must pass a callback or make it optional |
| Single main-game session key (`wof_session`) | Will add `story_roster`, `story_shards` | Phase 7 (this phase) | New namespace; existing code unaffected |

**Deprecated/outdated:**
- "28 grades: F- through God" in PROJECT.md — codebase now has 46 grades. REQUIREMENTS.md CORE-04 still references the original 28 grades; the implementation diverged during Phase 2 (STATE.md decisions). The sell value function must be written against the 46-grade reality in `scoreTier.ts`.

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: src/lib/session/store.ts] — localStorage pattern for the Story Mode store module
- [VERIFIED: src/lib/session/types.ts] — `SpinResult`, `SessionState` types; Story Mode types mirror these
- [VERIFIED: src/lib/game/scoreTier.ts] — Full 46-grade `TierGrade` union; `computeOverallScore`, `scoreTier` functions
- [VERIFIED: src/lib/game/spinQueue.ts] — `buildInitialQueue`, `getSegmentsForCategory` — freely reusable
- [VERIFIED: src/lib/game/random.ts] — `weightedRandom` — freely reusable
- [VERIFIED: src/components/CharacterCard.svelte] — Props: `results`, `name`, `startedAt` (required), `readonly`, `onNewCharacter`
- [VERIFIED: src/routes/+layout.js] — `ssr = false` inherited by all routes including `/story`
- [VERIFIED: package.json] — Svelte 5.55.2, SvelteKit 2.57.0, Tailwind CSS 4.3.0, Vitest 4.1.6
- [VERIFIED: .planning/REQUIREMENTS.md] — ROST-01 through ROST-04, ECON-04 shard pricing table
- [VERIFIED: .planning/ROADMAP.md] — Phase 7 architecture notes, isolation rule, success criteria
- [VERIFIED: .planning/STATE.md] — Key decisions including "CharacterCard requires startedAt: string prop"

### Secondary (MEDIUM confidence)
- [VERIFIED: src/lib/spinHistory.ts] — Pattern for how existing localStorage utility modules are structured in this project
- [VERIFIED: server/src/models/character.ts] — Mongoose schema for main game `characters`; `story_characters` will mirror this structure

### Tertiary (LOW confidence)
- [ASSUMED] Mulberry32 seeded PRNG as the standard choice for browser-side deterministic name generation — widely referenced in game dev communities but no official spec page

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.6 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run src/lib/story/` |
| Full suite command | `npx vitest run src/` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ROST-01 | `generateCharacterName()` returns deterministic name for same inputs | unit | `npx vitest run src/lib/story/naming.test.ts -x` | ❌ Wave 0 |
| ROST-01 | `generateCharacterName()` returns different names for different inputs | unit | `npx vitest run src/lib/story/naming.test.ts -x` | ❌ Wave 0 |
| ROST-02 | `addToRoster()` enforces 50-slot cap and returns null when full | unit | `npx vitest run src/lib/story/store.test.ts -x` | ❌ Wave 0 |
| ROST-02 | `loadRoster()` returns [] for empty/missing localStorage | unit | `npx vitest run src/lib/story/store.test.ts -x` | ❌ Wave 0 |
| ROST-02 | `saveRoster()` + `loadRoster()` round-trips roster data | unit | `npx vitest run src/lib/story/store.test.ts -x` | ❌ Wave 0 |
| ROST-02 | `loadShards()` returns 0 when key absent | unit | `npx vitest run src/lib/story/store.test.ts -x` | ❌ Wave 0 |
| ROST-04 | `getShardValue()` returns correct value for F- (20) | unit | `npx vitest run src/lib/story/shards.test.ts -x` | ❌ Wave 0 |
| ROST-04 | `getShardValue()` returns correct value for SS bracket (500) | unit | `npx vitest run src/lib/story/shards.test.ts -x` | ❌ Wave 0 |
| ROST-04 | `getShardValue()` returns correct value for Absolute+ (2000) | unit | `npx vitest run src/lib/story/shards.test.ts -x` | ❌ Wave 0 |
| ROST-04 | `getShardValue()` handles all 46 TierGrade values without fallback | unit | `npx vitest run src/lib/story/shards.test.ts -x` | ❌ Wave 0 |
| ROST-03 | CharacterCard renders with readonly=true and story SpinResult[] | manual | Visual inspection in browser | N/A — component exists |

### Sampling Rate

- **Per task commit:** `npx vitest run src/lib/story/ --reporter=verbose`
- **Per wave merge:** `npx vitest run src/`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/lib/story/naming.test.ts` — covers ROST-01 determinism
- [ ] `src/lib/story/store.test.ts` — covers ROST-02 localStorage CRUD + 50-cap enforcement
- [ ] `src/lib/story/shards.test.ts` — covers ROST-04 all tier brackets
- [ ] `src/lib/story/types.ts` — shared `StoryRosterEntry` interface (no test, but needed by all above)
- [ ] `src/lib/story/naming.ts` — implementation under test
- [ ] `src/lib/story/store.ts` — implementation under test
- [ ] `src/lib/story/shards.ts` — implementation under test

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 7 |
|-----------|------------------|
| GSAP `power4.out` only — no CSS ease | Story Mode spin loop must pass GSAP tween with `power4.out` ease; `SpinWheel.svelte` already enforces this |
| `scoreTier()` is single source of truth | `overallTier` in `StoryRosterEntry` must be computed via `scoreTier(computeOverallScore(...))` at session end, never stored redundantly |
| Result before animation | Story Mode spin loop must determine weighted-random outcome first, compute landing angle, then run GSAP tween |
| localStorage after every spin | Story Mode must serialize `storySession.completedSpins` after each completed spin for mid-session resume (same as CORE-05) |
| Single POST at session end | Story Mode accumulates all spins in local state; if/when backend writes are added (Phase 8+), a single write at session completion |
| TypeScript | All new files in `src/lib/story/` are `.ts`; no `.js` files |
| npm (not pnpm/yarn) | All install commands use `npm install` |

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified against package.json
- Architecture patterns: HIGH — derived from reading existing codebase source files directly
- Sell value / shard pricing: HIGH — read directly from REQUIREMENTS.md ECON-04
- Auto-naming (mulberry32): MEDIUM — algorithm is correct (public domain math), name lists are ASSUMED (content authored in Phase 7)
- Backend deferral decision: MEDIUM — inferred from ROADMAP.md phrasing; not explicitly stated as "Phase 7 is localStorage-only"

**Research date:** 2026-05-18
**Valid until:** 2026-06-17 (30 days — stable ecosystem, slow-moving project deps)
