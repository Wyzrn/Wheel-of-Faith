# Phase 2: Full 23-Spin Game Loop - Research

**Researched:** 2026-05-15
**Domain:** Svelte 5 reactive state, spin queue sequencing, flavor-label data modeling, scoreTier mapping, character card rendering
**Confidence:** HIGH

---

## Summary

Phase 2 converts the single-wheel animation proof-of-concept from Phase 1 into a complete browser-only game loop. The core engineering challenge is not the animation — that is locked and proven — but four orthogonal problems that must integrate without friction: (1) a dynamically expanding spin queue driven by race and archetype results, (2) a data model where every stat-wheel segment embeds its own tier grade and numeric score, (3) a `scoreTier()` function that maps a numeric score to one of 28 grade strings and serves as the single source of truth, and (4) a content authoring strategy for ~6,000 stat flavor labels plus 2,000+ items across powers, weapons, weaknesses, races, and archetypes.

The spin queue is the most architecturally sensitive piece. It starts with 23 fixed slots, but two of those slots expand into 1–4 ability spins each after Race and Archetype land. The queue is a `$state([])` array in `+page.svelte`; Svelte 5's deep reactive proxy makes in-place `.splice()` calls reactive without any re-assignment. Queue state plus all accumulated results must be serialized to localStorage after every resolved spin using `$state.snapshot()` to strip the proxy wrapper before `JSON.stringify`.

The content volume decision (D-07, D-08, D-09) means Phase 2 is also a content authoring phase. The recommended file strategy is one TypeScript module per category (`src/lib/content/races.ts`, `powers.ts`, etc.) exporting a typed constant array. Static imports are tree-shaken at build time; no lazy-loading is needed for a client-only SPA of this scale. Stat-wheel flavor labels are the exception: 11 stat files × ~560 labels each benefit from a shared `FlavorLabel` type and a per-stat file (`strength-labels.ts`, etc.) for maintainability.

**Primary recommendation:** Implement the spin queue as a `$state` array of `SpinDefinition` objects, where each definition carries its category type, display name, and a function reference or key for resolving the segments array. Queue expansion happens inline in the `onSpinComplete` handler via `.splice()`. Use `$state.snapshot()` before every `saveSession()` call.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Inter-spin Flow**
- D-01: After a spin lands (REVEALED state), a "Next Spin" button advances to the next spin. User controls pacing — no auto-advance. This preserves the tension of each spin as a moment.
- D-02: Before each spin, the category name is shown (e.g., "Next: Strength"). Gives the user orientation and builds anticipation.
- D-03: Results accumulate as a growing list alongside the wheel throughout the session. As each spin resolves, the result joins a visible history panel. User sees their character building in real time.

**Character Card Scope**
- D-04: Character card is functional + styled — a real designed character sheet, not a debug dump. Each stat shows its tier badge (letter grade e.g. B+, S, God), a numeric score, and the result label.
- D-05: The overall tier badge shows both the computed letter grade (from `scoreTier()`) AND the numeric score (0–100). Grade badge is the hero element; numeric score shown beneath it.
- D-06: A "New Character" button on the card resets all state and starts spin 1 fresh — no page refresh required. Session store is cleared, queue is reset.

**Phase 2 Content Depth**
- D-07: Full ~560 flavor labels per stat wheel written in Phase 2 (not Phase 6). All 11 stat wheels (Strength, Speed, Agility, Durability, IQ, Charisma, Fighting Skill, Power Mastery, Weapon Mastery, Potential, Energy Level) get approximately 20 unique labels per tier × 28 tiers each. This is ~6,000+ stat labels total.
- D-08: Full real content for all other spin categories written in Phase 2: 35+ races with rarity weighting and ability spin counts, 15+ archetypes, 1,000+ powers (epic → absurd), 500+ weapons (legendary → pineapple), 500+ weaknesses (classic → testicular torsion), 17+ backstories, 52+ titles, 15+ enchantments.
- D-09: This decision folds Phase 6 content work into Phase 2. Phase 6 is updated to "Polish only" — mobile responsiveness, performance, UI refinement.

**Spin Queue Architecture**
- D-10: The spin queue is a reactive array built dynamically at runtime. The array starts with all fixed categories. When Race lands, `abilitySpinCount` from the race result splices N racial ability spin definitions into the array immediately after the Race entry. When Archetype lands, M archetype ability spin definitions are spliced in after it. A `currentSpinIndex` tracks progress.
- D-11: Game loop state (`spinQueue` array, `currentSpinIndex`, accumulated results) lives as `$state` in `+page.svelte` and is serialized to localStorage after every completed spin. Resume logic restores queue + index from localStorage on mount, consistent with Phase 1's `wof_session` pattern.
- D-12: When the queue expands after Race or Archetype lands, a brief announcement is shown: e.g., "Your race grants 3 ability spins!" This gives the user a sense of consequence from their result before clicking Next Spin.

### Claude's Discretion
- Exact visual layout of the growing results list (sidebar vs below-wheel vs collapsible panel)
- Exact tier color coding for badges (e.g., gold for S+, red for God)
- Animation/transition between spins (if any)
- Whether the results list scrolls or uses a fixed-height panel
- File structure for the large content datasets (separate JSON files per category, or a single content module)
- scoreTier() mapping: exact numeric ranges for each of the 28 grades

### Deferred Ideas (OUT OF SCOPE)
- Open Graph / social card metadata on character card pages — explicitly Phase 6 (v2) per ROADMAP.md
- "The Bargain" interactive timer (10s auto-select) — Phase 3 (Redemption Spin)
- Sound design / audio reveal cues — v2 per ROADMAP.md
- Gallery opt-in toggle on character card — Phase 5
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CORE-02 | User completes 23 spin categories in fixed order: Race → Racial Ability Spin(s) → Archetype → Archetype Ability Spin(s) → Backstory → Height → Strength → Speed → Agility → Durability → IQ → Charisma → Fighting Skill → Power(s) → Power Mastery → Weapon(s) → Weapon Mastery → Weapon Enchantment → Potential → Energy Level → Weakness(s) → Redemption Spin → Title | SpinDefinition queue model + currentSpinIndex pointer |
| CORE-03 | Number of racial ability spins is determined by the race result (1–4); number of archetype ability spins is determined by archetype result (1–4) — queue built dynamically after each variable-count result lands | Queue splice pattern in onSpinComplete handler |
| CORE-04 | 28-grade tier system; each stat wheel shows flavor labels as segments; landing on a label determines tier grade and numeric score from that label's embedded data | FlavorLabel type with embedded tier + score; scoreTier() maps score → grade string |
| REDEM-01 | Overall character score computed from all stat spins using `scoreTier()`; tier grade always derived from label's embedded tier data, never stored independently; 28-grade scale maps to 0–100 numeric score | scoreTier() design + 28-grade numeric mapping |
| CARD-01 | After all spins complete, user sees a full styled character sheet displaying all 23 spin results, computed tier/score for each stat, and overall character tier badge | CharacterCard component consuming accumulated results |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Spin queue management | Browser (Svelte state) | — | Queue is runtime-derived, browser-only, no server needed |
| Weighted random result selection | Browser (game logic) | — | Already in `weightedRandom()` in `$lib/game/random.ts` |
| Queue expansion (ability splicing) | Browser (onSpinComplete handler) | — | Triggered by spin result, immediate and synchronous |
| Flavor label resolution | Browser (content module import) | — | Static TS modules bundled at build; no API needed |
| scoreTier() computation | Browser ($lib/game/scoreTier.ts) | — | Pure function, no I/O, must be importable by card and game loop |
| Overall score aggregation | Browser (page-level logic) | — | Weighted average of stat numeric scores, computed at session end |
| Character card display | Browser (CharacterCard.svelte) | — | Reads from accumulated results array, no backend |
| localStorage persistence | Browser (session store) | — | Already established; Phase 2 extends the payload shape |
| Announcement (D-12) | Browser (page-level UI state) | — | Simple conditional render between REVEALED and Next Spin |
| Content data (races, powers, etc.) | Browser (static TS module imports) | — | Bundled with frontend; no lazy-load needed at this SPA scale |

---

## Standard Stack

### Core (all inherited from Phase 1 — do not reinstall)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| svelte | 5.55.7 | Reactive UI, `$state` runes | Already installed; `$state` deep proxy handles array mutation |
| @sveltejs/kit | 2.60.1 | SPA routing, file-based structure | Already installed; SPA mode active |
| gsap | 3.15.0 | Wheel animation | Already installed; locked — do not change ease or svgOrigin |
| tailwindcss | 4.3.0 | Utility CSS for card + badges | Already installed; v4 @theme blocks for custom tier colors |
| vitest | 4.1.6 | Unit tests for scoreTier(), queue logic | Already installed; jsdom environment active |

### No New Packages Required

Phase 2 installs nothing new. All capabilities are covered by the Phase 1 stack:
- Weighted random: existing `weightedRandom()` in `$lib/game/random.ts`
- Session persistence: existing `saveSession/loadSession/clearSession` in `$lib/session/store.ts`
- Content data: plain TypeScript constant arrays — no external library

**Installation:** None — all packages already present.

---

## Architecture Patterns

### System Architecture Diagram

```
User interaction
  │
  ▼
+page.svelte  ←── $state: spinQueue[], currentSpinIndex, results[]
  │                $state: sessionState, showAnnouncement
  │
  ├── SpinWheel.svelte (reused as-is)
  │     │  receives: segments = spinQueue[currentSpinIndex].segments
  │     │  emits:    onSpinComplete(resultIndex, resultLabel)
  │     ▼
  │   weightedRandom() → targetAngle → GSAP tween → onComplete
  │
  ├── onSpinComplete handler (inside +page.svelte)
  │     │  1. Build SpinResult from resultIndex + label
  │     │  2. If category == 'race': splice N racialAbility entries into queue
  │     │  3. If category == 'archetype': splice M archetypeAbility entries into queue
  │     │  4. Append result to results[]
  │     │  5. If REDEM-01 stat: derive tier + score from label's embedded data
  │     │  6. If category == 'race'|'archetype': set showAnnouncement = true
  │     │  7. saveSession($state.snapshot({ spinQueue, currentSpinIndex, results }))
  │
  ├── "Next Spin" button  ←── shown when REVEALED, hidden during announcement
  │     │  advances currentSpinIndex
  │     │  if currentSpinIndex >= spinQueue.length: show CharacterCard
  │
  ├── CharacterCard.svelte
  │     │  receives: results[]
  │     │  computes: overallScore = weightedAverage(statResults)
  │     │  computes: overallTier  = scoreTier(overallScore)  [from $lib/game/scoreTier.ts]
  │     │  renders:  per-stat tier badge (grade + numeric score)
  │     │  renders:  overall tier badge (hero element)
  │     │  renders:  "New Character" button → clearSession() + reset all $state
  │
  └── Content modules (static imports, bundled)
        src/lib/content/
          races.ts, archetypes.ts, powers.ts, weapons.ts
          weaknesses.ts, backstories.ts, titles.ts, enchantments.ts
          strength-labels.ts, speed-labels.ts, ... (11 stat files)
```

### Recommended Project Structure

```
src/
├── components/
│   ├── SpinWheel.svelte           — reused as-is from Phase 1
│   ├── CharacterCard.svelte       — new: full styled character sheet
│   └── TierBadge.svelte           — new: reusable grade badge (B+, God, etc.)
├── lib/
│   ├── game/
│   │   ├── geometry.ts            — unchanged
│   │   ├── random.ts              — unchanged
│   │   ├── spinEngine.ts          — unchanged
│   │   ├── scoreTier.ts           — new: 28-grade mapping + score range logic
│   │   ├── scoreTier.test.ts      — new: unit tests for all 28 grade boundaries
│   │   ├── spinQueue.ts           — new: SpinDefinition type + buildInitialQueue()
│   │   └── spinQueue.test.ts      — new: queue splice logic tests
│   ├── session/
│   │   ├── types.ts               — extended: new types for Phase 2 (see below)
│   │   ├── store.ts               — unchanged (saveSession/loadSession take any shape)
│   │   └── store.test.ts          — unchanged
│   └── content/
│       ├── types.ts               — new: FlavorLabel, Race, Archetype, Power, etc.
│       ├── races.ts               — new: 35+ race definitions
│       ├── archetypes.ts          — new: 15+ archetype definitions
│       ├── powers.ts              — new: 1,000+ power entries
│       ├── weapons.ts             — new: 500+ weapon entries
│       ├── weaknesses.ts          — new: 500+ weakness entries (with severity flag)
│       ├── backstories.ts         — new: 17+ backstory entries
│       ├── titles.ts              — new: 52+ title entries
│       ├── enchantments.ts        — new: 15+ enchantment entries
│       ├── strength-labels.ts     — new: ~560 strength flavor labels
│       ├── speed-labels.ts        — new: ~560 speed flavor labels
│       ├── agility-labels.ts      — new
│       ├── durability-labels.ts   — new
│       ├── iq-labels.ts           — new
│       ├── charisma-labels.ts     — new
│       ├── fighting-skill-labels.ts — new
│       ├── potential-labels.ts    — new
│       ├── energy-level-labels.ts — new
│       ├── power-mastery-labels.ts — new
│       └── weapon-mastery-labels.ts — new
└── routes/
    └── +page.svelte               — extended: full 23-spin orchestrator
```

### Pattern 1: SpinDefinition — Spin Queue Entry Type

Every entry in the reactive queue is a `SpinDefinition`. The type carries enough information for `+page.svelte` to know what to show and what segments to pass to `SpinWheel`.

```typescript
// Source: $lib/game/spinQueue.ts (new file)

export type SpinCategory =
  | 'race' | 'racialAbility' | 'archetype' | 'archetypeAbility'
  | 'backstory' | 'height' | 'strength' | 'speed' | 'agility'
  | 'durability' | 'iq' | 'charisma' | 'fightingSkill'
  | 'power' | 'powerMastery' | 'weapon' | 'weaponMastery'
  | 'weaponEnchantment' | 'potential' | 'energyLevel'
  | 'weakness' | 'redemptionSpin' | 'title'

export interface SpinDefinition {
  category: SpinCategory
  displayName: string    // shown in D-02 "Next: Strength" header
  // segments resolved at render time from content modules based on category
  // OR passed directly for variable-pool categories (powers, weapons, weaknesses)
}

// The queue starts with exactly these entries.
// Race and Archetype entries will be spliced in after they land.
export function buildInitialQueue(): SpinDefinition[] {
  return [
    { category: 'race',             displayName: 'Race' },
    // racialAbility slots spliced here after Race lands
    { category: 'archetype',        displayName: 'Archetype' },
    // archetypeAbility slots spliced here after Archetype lands
    { category: 'backstory',        displayName: 'Backstory' },
    { category: 'height',           displayName: 'Height' },
    { category: 'strength',         displayName: 'Strength' },
    { category: 'speed',            displayName: 'Speed' },
    { category: 'agility',          displayName: 'Agility' },
    { category: 'durability',       displayName: 'Durability' },
    { category: 'iq',               displayName: 'IQ' },
    { category: 'charisma',         displayName: 'Charisma' },
    { category: 'fightingSkill',    displayName: 'Fighting Skill' },
    { category: 'power',            displayName: 'Power' },
    { category: 'powerMastery',     displayName: 'Power Mastery' },
    { category: 'weapon',           displayName: 'Weapon' },
    { category: 'weaponMastery',    displayName: 'Weapon Mastery' },
    { category: 'weaponEnchantment', displayName: 'Weapon Enchantment' },
    { category: 'potential',        displayName: 'Potential' },
    { category: 'energyLevel',      displayName: 'Energy Level' },
    { category: 'weakness',         displayName: 'Weakness' },
    { category: 'redemptionSpin',   displayName: 'Redemption Spin' },
    { category: 'title',            displayName: 'Title' },
  ]
}
```

**Note on "23 spins":** The initial queue has 22 entries (Race through Title, no ability slots yet). After Race lands and splices N ability entries, and after Archetype lands and splices M ability entries, the total becomes 22 + N + M. With N and M each 1–4, the final queue length ranges from 24 to 30 total entries — the "23 categories" refers to the fixed category types, not the final count. The planner should be aware that success criterion 1 says "spin through Race, then the correct number of Racial Ability spins" — the queue length is variable, not hardcoded to 23. [ASSUMED — the ROADMAP says "23 spin categories" but the queue dynamically grows; the fixed spin types number 22 before ability expansion]

### Pattern 2: FlavorLabel — Embedded Tier Data in Stat Segments

Stat wheel segments are not plain `WeightedSegment` objects — they embed their tier grade and numeric score. The wheel still receives `WeightedSegment[]` (which `SpinWheel.svelte` accepts), but stat categories build that array from a richer `FlavorLabel[]`.

```typescript
// Source: $lib/content/types.ts (new file)

// The WeightedSegment contract from Phase 1 (DO NOT CHANGE):
// { label: string, weight: number, color?: string }

// Extended type for stat flavor labels — superset of WeightedSegment
export interface FlavorLabel {
  label: string           // e.g., "Wet Noodle Arm" — shown on the wheel and in results
  weight: number          // for weightedRandom(); each tier gets equal total weight
  color?: string          // optional override; falls back to tier-keyed palette
  tier: TierGrade         // e.g., 'F-' | 'B+' | 'God' — embedded, never computed post-hoc
  score: number           // numeric value 1–100 derived from tier (see scoreTier section)
}

// When building segments for a stat wheel:
// import { strengthLabels } from '$lib/content/strength-labels'
// const segments: WeightedSegment[] = strengthLabels  // FlavorLabel satisfies WeightedSegment
// After spin: const label = strengthLabels[resultIndex]  → label.tier and label.score are ready
```

**Key constraint (CORE-04):** The `label.tier` and `label.score` are baked into the data at authoring time. `onSpinComplete` reads them directly from the label object — it never calls `scoreTier(label.score)` in reverse to re-derive the grade. `scoreTier()` is used only for the overall character score aggregation.

### Pattern 3: scoreTier() — 28-Grade Mapping

The 28 grades divide the 1–100 numeric range. The mapping below gives each grade a 3–4 point range, with the extremes (F- at 1–3, God at exactly 100) and a wider range for mid-tier grades to make the distribution feel natural.

```typescript
// Source: $lib/game/scoreTier.ts (new file)
// [VERIFIED: grade list from CLAUDE.md + REQUIREMENTS.md CORE-04]
// Numeric ranges are Claude's discretion per CONTEXT.md

export type TierGrade =
  | 'F-' | 'F' | 'F+'
  | 'E-' | 'E' | 'E+'
  | 'D-' | 'D' | 'D+'
  | 'C-' | 'C' | 'C+'
  | 'B-' | 'B' | 'B+'
  | 'A-' | 'A' | 'A+'
  | 'S-' | 'S' | 'S+'
  | 'SS-' | 'SS' | 'SS+'
  | 'SSS-' | 'SSS' | 'SSS+'
  | 'God'

// 28 tiers across 1–100, approximately 3–4 points each.
// Ranges chosen so the center of each grade's range is a clean number.
// REDEM-01: F- = ~1–3, God = 100.
const TIER_THRESHOLDS: Array<{ min: number; max: number; grade: TierGrade }> = [
  { min:  1,  max:  3,  grade: 'F-'  },
  { min:  4,  max:  6,  grade: 'F'   },
  { min:  7,  max:  9,  grade: 'F+'  },
  { min: 10,  max: 12,  grade: 'E-'  },
  { min: 13,  max: 15,  grade: 'E'   },
  { min: 16,  max: 18,  grade: 'E+'  },
  { min: 19,  max: 21,  grade: 'D-'  },
  { min: 22,  max: 24,  grade: 'D'   },
  { min: 25,  max: 27,  grade: 'D+'  },
  { min: 28,  max: 31,  grade: 'C-'  },
  { min: 32,  max: 35,  grade: 'C'   },
  { min: 36,  max: 39,  grade: 'C+'  },
  { min: 40,  max: 44,  grade: 'B-'  },
  { min: 45,  max: 49,  grade: 'B'   },
  { min: 50,  max: 54,  grade: 'B+'  },
  { min: 55,  max: 59,  grade: 'A-'  },
  { min: 60,  max: 64,  grade: 'A'   },
  { min: 65,  max: 69,  grade: 'A+'  },
  { min: 70,  max: 74,  grade: 'S-'  },
  { min: 75,  max: 78,  grade: 'S'   },
  { min: 79,  max: 82,  grade: 'S+'  },
  { min: 83,  max: 86,  grade: 'SS-' },
  { min: 87,  max: 89,  grade: 'SS'  },
  { min: 90,  max: 92,  grade: 'SS+' },
  { min: 93,  max: 95,  grade: 'SSS-'},
  { min: 96,  max: 97,  grade: 'SSS' },
  { min: 98,  max: 99,  grade: 'SSS+'},
  { min: 100, max: 100, grade: 'God' },
]

export function scoreTier(score: number): TierGrade {
  const clamped = Math.max(1, Math.min(100, score))
  for (const t of TIER_THRESHOLDS) {
    if (clamped >= t.min && clamped <= t.max) return t.grade
  }
  return 'F-'  // unreachable but satisfies TypeScript
}

// Convenience: get the numeric score for a given grade (midpoint of its range).
// Used when authoring FlavorLabel entries — author specifies grade, gets canonical score.
export function gradeToScore(grade: TierGrade): number {
  const entry = TIER_THRESHOLDS.find(t => t.grade === grade)
  if (!entry) return 1
  return Math.round((entry.min + entry.max) / 2)
}
```

**Range notes (Claude's discretion, per CONTEXT.md):**
- F- through F+ occupy 1–9: the bottom 9 points, 3 per grade
- E- through E+ occupy 10–18: next 9 points
- D- through D+ occupy 19–27
- C- through C+ are wider (28–39) because C-range characters should be common in playthroughs
- B- through B+ are wider (40–54) — the modal outcome for a balanced character
- A- through A+ compress slightly (55–69)
- S tiers (70–82), SS tiers (83–92), SSS tiers (93–99) compress further as rarity increases
- God is exactly 100 — a single point, reachable only from a God-tier label

### Pattern 4: Svelte 5 Reactive Queue Splice

In Svelte 5, `$state([])` wraps the array in a deep reactive proxy. All standard array mutation methods — `.push()`, `.splice()`, index assignment — trigger reactivity without reassignment. [VERIFIED: sveltejs/svelte docs, $state.md]

```typescript
// Source: pattern derived from Svelte 5 $state documentation
// In +page.svelte:

let spinQueue = $state<SpinDefinition[]>(buildInitialQueue())
let currentSpinIndex = $state(0)
let results = $state<SpinResult[]>([])
let showAnnouncement = $state<string | null>(null)

function onSpinComplete(resultIndex: number, resultLabel: string) {
  const currentDef = spinQueue[currentSpinIndex]

  // --- Queue expansion (D-10) ---
  if (currentDef.category === 'race') {
    const race = races.find(r => r.label === resultLabel)
    const count = race?.abilitySpinCount ?? 1
    const abilitySlots: SpinDefinition[] = Array.from({ length: count }, (_, i) => ({
      category: 'racialAbility' as const,
      displayName: `Racial Ability ${i + 1}`,
    }))
    // Insert after current index (index 0 = Race)
    spinQueue.splice(currentSpinIndex + 1, 0, ...abilitySlots)
    showAnnouncement = `Your race grants ${count} ability spin${count > 1 ? 's' : ''}!`
  }

  if (currentDef.category === 'archetype') {
    const archetype = archetypes.find(a => a.label === resultLabel)
    const count = archetype?.abilitySpinCount ?? 1
    const abilitySlots: SpinDefinition[] = Array.from({ length: count }, (_, i) => ({
      category: 'archetypeAbility' as const,
      displayName: `Archetype Ability ${i + 1}`,
    }))
    spinQueue.splice(currentSpinIndex + 1, 0, ...abilitySlots)
    showAnnouncement = `Your archetype grants ${count} ability spin${count > 1 ? 's' : ''}!`
  }

  // --- Record result ---
  const spinResult = buildSpinResult(currentDef, resultIndex, resultLabel)
  results.push(spinResult)

  // --- Persist to localStorage (ALWAYS after every spin) ---
  // $state.snapshot() strips the Proxy wrapper before JSON.stringify [VERIFIED: Svelte 5 docs]
  saveSession({
    ...currentSession,
    completedSpins: $state.snapshot(results),
    spinQueue: $state.snapshot(spinQueue),
    currentSpinIndex,
  })
}

function handleNextSpin() {
  showAnnouncement = null
  currentSpinIndex++
}
```

**Critical:** `$state.snapshot()` MUST be called before passing reactive state to `saveSession()`. Without it, `JSON.stringify()` receives a Proxy object which may not serialize correctly across all environments. [VERIFIED: Svelte 5 $state.snapshot docs]

### Pattern 5: Segments Resolution at Render Time

`SpinWheel` receives `segments` as a prop. For each spin, `+page.svelte` derives the segments array from the current spin definition. Use a `$derived` value:

```typescript
// In +page.svelte
import { getSegmentsForCategory } from '$lib/game/spinQueue'

let currentSegments = $derived(
  getSegmentsForCategory(spinQueue[currentSpinIndex]?.category)
)
```

`getSegmentsForCategory` is a pure function in `$lib/game/spinQueue.ts` that switches on category and returns the appropriate `WeightedSegment[]` — importing from the content modules.

For stat wheels, it returns the full `FlavorLabel[]` cast to `WeightedSegment[]` (they are structurally compatible). For non-stat wheels (races, powers, weapons, etc.), it returns the content array directly.

### Pattern 6: Content Data Types

```typescript
// Source: $lib/content/types.ts (new file)

export interface Race {
  label: string           // display name e.g. "Celestial"
  weight: number          // for weightedRandom(); determines rarity
  abilitySpinCount: number // 1–4; drives queue splice
  weaknessProbabilityModifier: number // multiplier on baseline weakness draw probability (0.5–2.0)
  description?: string    // optional flavor text for character card
}

export interface Archetype {
  label: string
  weight: number
  abilitySpinCount: number // 1–4
  description?: string
}

export interface SimpleItem {
  label: string
  weight: number          // for rarity variation within pool
  description?: string
}

// Used for powers, weapons, weaknesses, backstories, titles, enchantments
// SimpleItem is the minimal type; severity partitioning for weaknesses uses an extension:

export interface Weakness extends SimpleItem {
  severe: boolean         // true = drawn preferentially for high-modifier races (CONT-05)
}

// Flavor labels for stat wheels — superset of WeightedSegment
export interface FlavorLabel {
  label: string
  weight: number
  color?: string
  tier: TierGrade         // from scoreTier.ts
  score: number           // numeric 1–100, canonical for this label's tier
}
```

### Pattern 7: Race Content Structure

```typescript
// Source: $lib/content/races.ts (structure — content authored separately)
// [VERIFIED: CONT-01, SUMMARY.md rarity weights]

import type { Race } from './types'

export const races: Race[] = [
  // Common ~35% of total weight
  { label: 'Human',      weight: 35, abilitySpinCount: 1, weaknessProbabilityModifier: 1.0 },
  { label: 'Orc',        weight: 20, abilitySpinCount: 2, weaknessProbabilityModifier: 0.8 },
  // ... more common races

  // Uncommon ~45% total
  { label: 'Elf',        weight: 15, abilitySpinCount: 2, weaknessProbabilityModifier: 1.2 },
  // ...

  // Rare ~18% total
  { label: 'Dragon',     weight: 8,  abilitySpinCount: 3, weaknessProbabilityModifier: 0.6 },
  // ...

  // Legendary ~2% total
  { label: 'Celestial',  weight: 1,  abilitySpinCount: 4, weaknessProbabilityModifier: 0.4 },
  // ...
]
// Total weight ~100; weightedRandom normalizes. CONT-01 verifies distribution in 100 playthroughs.
```

**Rarity mechanics:** Common races have higher weights, producing ~35% appearance rate. Legendary races with weight 1 against a total weight pool of ~100 produce ~1–2% appearance rate. `weightedRandom()` already handles normalization — no manual probability math needed. [VERIFIED: existing `weightedRandom()` implementation in `$lib/game/random.ts`]

### Pattern 8: Weakness Spin — Variable Count Decision

The CONTEXT.md flags weakness count as an open question (from STATE.md). CONT-05 specifies "0 vs 1 vs 2 vs 3 weaknesses" and "likelihood of drawing from severe pool" as race-modifiable. The most coherent model:

- Weakness count is variable: 0, 1, 2, or 3 spins, determined by the race's `weaknessProbabilityModifier`
- Baseline probabilities: [0 weaknesses: 10%, 1: 45%, 2: 35%, 3: 10%]
- The modifier scales the probability distribution (higher modifier = higher chance of 2–3 weaknesses)
- Queue splicing for weaknesses follows the same pattern as racial/archetype ability splicing: after the Weakness slot (position fixed in queue), the resolved count determines how many additional weakness spins to splice

This design means the Weakness slot in the initial queue is a sentinel that, when processed, immediately splices 0–3 actual weakness spin definitions and advances. [ASSUMED — exact count probabilities and modifier formula are design choices not specified in requirements; the 0–3 count range is confirmed by CONT-05]

### Pattern 9: Overall Score Aggregation

The 11 stat wheels contribute to the overall character score. A weighted average is used — stats that are central to combat identity (Strength, Speed, Fighting Skill) carry more weight than support stats (Charisma, Energy Level).

```typescript
// Source: $lib/game/scoreTier.ts

// Category weights for overall score (must sum to 1.0)
// [ASSUMED — exact weights are Claude's discretion; this distribution is recommended]
const STAT_WEIGHTS: Record<string, number> = {
  strength:      0.10,
  speed:         0.10,
  agility:       0.10,
  durability:    0.10,
  iq:            0.08,
  charisma:      0.07,
  fightingSkill: 0.12,
  potential:     0.10,
  energyLevel:   0.08,
  powerMastery:  0.08,
  weaponMastery: 0.07,
}
// Total: 1.00

export function computeOverallScore(statResults: Record<string, number>): number {
  let weighted = 0
  for (const [stat, weight] of Object.entries(STAT_WEIGHTS)) {
    weighted += (statResults[stat] ?? 0) * weight
  }
  return Math.round(Math.max(1, Math.min(100, weighted)))
}
```

Non-stat spins (Race, Archetype, Powers, Weapons, etc.) do not contribute numeric scores to the overall aggregation in Phase 2. Phase 3 (Redemption Spin) mutates this score. [ASSUMED — the exact contribution rule for non-stat categories is not specified in requirements; excluding them from aggregation is the simplest correct interpretation of REDEM-01]

### Pattern 10: SessionState Extension for Phase 2

The existing `SessionState` type stores only `completedSpins`. Phase 2 must also persist `spinQueue` and `currentSpinIndex` for mid-session resume. The extension avoids breaking Phase 1's type:

```typescript
// Source: $lib/session/types.ts (extended — preserve existing fields)

// Existing (do not change):
export interface SpinResult {
  step: number
  category: string
  resultLabel: string
  resultIndex: number
  timestamp: string
}

// Extended for Phase 2:
export interface SpinResult {
  step: number
  category: string          // SpinCategory string
  resultLabel: string
  resultIndex: number
  timestamp: string
  tier?: TierGrade          // populated for stat spins; undefined for non-stat
  score?: number            // populated for stat spins; undefined for non-stat
}

export interface SessionState {
  sessionId: string
  startedAt: string
  completedSpins: SpinResult[]
  // Phase 2 additions:
  spinQueue?: SpinDefinition[]    // serialized queue for resume
  currentSpinIndex?: number       // resume pointer
}
```

The `?` optional fields mean existing Phase 1 sessions (without queue data) deserialize without error — `loadSession()` returns them as-is, and the resume logic detects `spinQueue == null` and rebuilds from scratch.

### Anti-Patterns to Avoid

- **Reading tier from spin animation position:** `onComplete` must use `FlavorLabel[resultIndex].tier`, never derive it from the wheel's visual state. [VERIFIED: CLAUDE.md rule 4]
- **Storing tier grade independently of the label:** The `FlavorLabel` type embeds `.tier`; the character card reads it directly. `scoreTier()` is only called on the aggregated numeric overall score.
- **Reassigning the queue array to trigger reactivity:** In Svelte 5 `$state`, `.splice()` is reactive. Do not do `spinQueue = [...spinQueue]` — it works but is unnecessary and creates a new proxy.
- **JSON.stringify on a Svelte proxy:** Always call `$state.snapshot(value)` before `JSON.stringify` or `saveSession()`. [VERIFIED: Svelte 5 docs]
- **Building the full queue before Race lands:** The ability slot count is unknown until Race resolves. `buildInitialQueue()` omits ability slots; they are spliced in at runtime.
- **CSS ease for anything:** `GSAP power4.out` is the only easing. [VERIFIED: CLAUDE.md rule 5]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Weighted random selection | Custom probability loop | `weightedRandom()` in `$lib/game/random.ts` | Already tested; handles edge cases |
| Session persistence | Manual `localStorage` calls | `saveSession/loadSession` in `$lib/session/store.ts` | Already guards `typeof localStorage === 'undefined'` |
| Tier grade lookup | String comparison / switch | `scoreTier()` in `$lib/game/scoreTier.ts` | Single source of truth per CLAUDE.md rule 4 |
| Content data fetching | API endpoint for content | Static TS imports bundled by Vite | No server needed; SPA mode; tree-shaken |
| Reactive queue state | Custom event system | `$state([])` + `.splice()` | Svelte 5 deep proxy makes mutations reactive |
| UUID generation | `Math.random().toString(36)` | `crypto.randomUUID()` | Already used in `createSession()`; no extra dep |

**Key insight:** The game loop has no novel algorithmic problems. Every capability needed in Phase 2 is either already implemented in `$lib/` or covered by the Svelte 5 reactivity model.

---

## Common Pitfalls

### Pitfall 1: Queue Index Drift After Splice

**What goes wrong:** After splicing N ability entries into `spinQueue`, `currentSpinIndex` still points to the Race entry (index 0). If the handler increments it by 1, it correctly points to the first ability spin. But if the code advances the index BEFORE splicing, the new ability slots land at the wrong position.

**Why it happens:** Splice is index-sensitive. If you splice at `currentSpinIndex + 1` when `currentSpinIndex` is 0, the first ability slot is at index 1. If you then set `currentSpinIndex = 1`, Next Spin correctly advances to it.

**How to avoid:** Always splice first, then advance `currentSpinIndex` in `handleNextSpin()`. The `onSpinComplete` handler splices and sets `showAnnouncement`; it does NOT increment `currentSpinIndex`. The Next Spin button dismisses the announcement and increments the index.

**Warning signs:** Player clicks Next Spin and skips an ability slot, or ability slot appears twice.

### Pitfall 2: $state Proxy in JSON.stringify

**What goes wrong:** `JSON.stringify($state_proxy_value)` may produce `{}` or throw in some environments because the Proxy's internal slots are not own enumerable properties.

**Why it happens:** Svelte 5 `$state` wraps objects in Proxy. `JSON.stringify` calls `.toJSON()` if present, or iterates own keys — behavior depends on Proxy handler implementation.

**How to avoid:** Always call `$state.snapshot(value)` before any `JSON.stringify` or `saveSession()` call. `$state.snapshot` produces a plain object. [VERIFIED: Svelte 5 docs]

**Warning signs:** `localStorage` stores `{}` or an empty array; session fails to restore on reload.

### Pitfall 3: FlavorLabel Color Collision at 560 Labels Per Stat

**What goes wrong:** If each of 560 FlavorLabel entries has a unique `color`, the wheel displays 560 distinct colors that may look chaotic. If no `color` is specified, `SpinWheel.svelte` falls back to `COLORS[i % COLORS.length]` — an 8-color palette cycling every 8 segments, which will be inconsistent with tier.

**Why it happens:** The Phase 1 `SpinWheel.svelte` assigns colors per-index, not per-tier.

**How to avoid:** Define a tier-keyed color palette (one color per tier grade) and set `FlavorLabel.color` to the tier color. Then all F- labels are red, all God labels are gold — visually, the wheel shows tier density without reading labels. This is a Claude's discretion item.

**Warning signs:** Wheel looks like a random color explosion with no visual pattern.

### Pitfall 4: Resume With Mismatched Queue

**What goes wrong:** User plays Race, gets 3 ability spins spliced in, saves after each. On reload, `loadSession()` restores `completedSpins` and `spinQueue`. If `spinQueue` was serialized AFTER splicing (correct), restore works. If it was serialized BEFORE splicing (wrong order), restore shows the wrong next spin.

**Why it happens:** If `saveSession()` is called before `spinQueue.splice()` runs, the stored queue lacks the ability slots. On resume, the user would skip directly to Archetype.

**How to avoid:** In `onSpinComplete`: (1) splice the queue, (2) push the result, (3) call `saveSession()`. This ordering guarantees the stored queue includes the spliced slots.

**Warning signs:** Resume skips ability spins; character is missing racial abilities.

### Pitfall 5: 28-Grade Reachability — Weight Distribution

**What goes wrong:** If F- through F+ labels exist in the data but have very low weight relative to B-tier labels, users almost never see extreme tiers. Success criterion 5 ("all 28 grades reachable") requires that each grade appears on the wheel.

**Why it happens:** If a stat wheel has 560 segments with 20 per tier × 28 tiers, and all have equal weight, each tier occupies 20/560 = 3.6% of the wheel. This is fine — each tier is reachable. The pitfall is unequal weights that accidentally de-weight extreme tiers.

**How to avoid:** Within a tier, all 20 labels should have equal weight. Across tiers, all 28 tiers should have equal total weight. This means each label's weight = 1 (or any equal constant). Do NOT give F- labels lower weights just because they are "rare" — rarity in this game comes from Redemption, not from wheel weights. Each spin outcome should be uniformly distributed across tiers.

**Warning signs:** In a simulation of 1,000 Strength spins, God and F- labels never appear.

### Pitfall 6: Content File Size at Build Time

**What goes wrong:** 1,000+ power entries + 500+ weapons + 500+ weaknesses + ~6,000 stat labels in TypeScript files may slow Vite's module graph resolution and TypeScript type-checking.

**Why it happens:** Large constant arrays in `.ts` files are parsed by the TypeScript compiler during `svelte-check`. At 8,000+ entries, this can add 10–30 seconds to type checking.

**How to avoid:** Use `.ts` files with typed constants (not `.json` with no type inference). Keep each content file under ~1,000 entries if possible. The `powers.ts` file with 1,000+ entries is the main risk — consider splitting into `powers-epic.ts`, `powers-absurd.ts`, and re-exporting from a barrel `powers.ts`. JSON files (`powers.json`) with a `satisfies PowerItem[]` assertion at the import site are another option for authoring speed.

**Warning signs:** `npm run check` takes >60 seconds; `npm run build` hits memory limits.

### Pitfall 7: Weakness Count = 0 Edge Case

**What goes wrong:** If a race has a very low `weaknessProbabilityModifier`, the drawn weakness count may be 0. The code must handle the case where the Weakness sentinel slot in the queue expands to zero actual weakness spins — i.e., the queue does not grow, and the results array gets no weakness entries.

**Why it happens:** Variable-count slots expand based on a drawn count. If count = 0, `.splice(index + 1, 0)` is a no-op. `handleNextSpin()` advances past the sentinel.

**How to avoid:** The sentinel slot for Weakness should be handled differently from Race/Archetype: rather than splicing real spins, it resolves immediately to count = 0 and records an empty result array. The character card must handle `weaknesses: []` gracefully.

**Warning signs:** Character card crashes when accessing weaknesses[0]; undefined error in CharacterCard.

---

## Code Examples

### How SpinWheel Receives Stat Segments

```typescript
// In +page.svelte — $derived ensures reactive update when currentSpinIndex changes
// Source: Svelte 5 $state/$derived pattern [VERIFIED: sveltejs/svelte docs]

let currentDef = $derived(spinQueue[currentSpinIndex])

let currentSegments = $derived(
  getSegmentsForCategory(currentDef?.category)
)

// In template:
// <SpinWheel segments={currentSegments} onSpinComplete={onSpinComplete} />
```

### How CharacterCard Displays a Stat Result

```svelte
<!-- Source: pattern based on Phase 1 SpinWheel.svelte + Svelte 5 each block -->
<!-- CharacterCard.svelte -->
<script lang="ts">
  import TierBadge from './TierBadge.svelte'
  import { scoreTier, computeOverallScore } from '$lib/game/scoreTier'
  import type { SpinResult } from '$lib/session/types'

  let { results }: { results: SpinResult[] } = $props()

  const statCategories = ['strength','speed','agility','durability','iq',
    'charisma','fightingSkill','potential','energyLevel','powerMastery','weaponMastery']

  const statResults = $derived(
    Object.fromEntries(
      statCategories.map(cat => {
        const r = results.find(r => r.category === cat)
        return [cat, r?.score ?? 0]
      })
    )
  )

  const overallScore = $derived(computeOverallScore(statResults))
  const overallTier  = $derived(scoreTier(overallScore))
</script>

<div class="character-card">
  <!-- Overall tier hero badge (D-05) -->
  <TierBadge grade={overallTier} score={overallScore} hero />

  <!-- Per-stat rows (D-04) -->
  {#each results as result}
    {#if result.tier}
      <div class="stat-row">
        <span class="stat-name">{result.category}</span>
        <TierBadge grade={result.tier} score={result.score} />
        <span class="stat-label">{result.resultLabel}</span>
      </div>
    {/if}
  {/each}
</div>
```

### How "New Character" Resets State (D-06)

```typescript
// Source: Phase 1 handleStartOver() pattern, extended for Phase 2
function handleNewCharacter() {
  clearSession()                    // removes wof_session from localStorage
  currentSession = createSession()  // fresh sessionId + timestamp
  spinQueue = buildInitialQueue()   // reset to 22 fixed entries
  currentSpinIndex = 0
  results = []
  showAnnouncement = null
  showCard = false
}
// Svelte 5 $state: all assignments above trigger reactive DOM updates.
// No page reload required (D-06). [VERIFIED: Svelte 5 reactivity model]
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Svelte 4 `$:` reactive declarations | Svelte 5 `$state` + `$derived` runes | Svelte 5.0 (Oct 2024) | Array mutations (push, splice) are now reactive; no self-assignment needed |
| Svelte 4 legacy `let` + `=` reassignment for arrays | `$state([])` with `.splice()` | Svelte 5.0 | Can mutate in-place; Svelte 4 self-assignment pattern is legacy mode only |
| `JSON.parse(JSON.stringify(proxy))` to de-proxy | `$state.snapshot(proxy)` | Svelte 5.0 | `$state.snapshot` is the official API; handles toJSON and nested proxies |

**Deprecated/outdated:**
- `$: reactiveVar = derivedValue` — Svelte 4 reactive statement; replaced by `$derived()` in Svelte 5
- `export let prop` — Svelte 4 prop syntax; replaced by `$props()` in Svelte 5 (already used in SpinWheel.svelte)

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The "23 spin categories" produces a final queue length of 24–30 entries after ability expansion, not exactly 23 | Pattern 1: SpinDefinition | Planner may hard-code "23" in loop termination; should use `spinQueue.length` instead |
| A2 | Stat weights for overall score aggregation (Strength 0.10, Fighting Skill 0.12, etc.) | Pattern 9: Overall Score | Wrong weights produce an overall tier that feels disconnected from character identity; tune in Phase 6 polish |
| A3 | Weakness count uses probabilities [0: 10%, 1: 45%, 2: 35%, 3: 10%] baseline | Pattern 8: Weakness Count | May produce too many or too few weaknesses per character on average; adjustable at content authoring time |
| A4 | Non-stat spins (Race, Archetype, Powers, Weapons, etc.) do not contribute to the numeric overall score in Phase 2 | Pattern 9: Overall Score | REDEM-01 only specifies "stat spins"; if race tier should contribute, formula must change |
| A5 | Vite tree-shaking handles 8,000+ label entries without build performance issues | Pitfall 6 | If build becomes slow, split content files into sub-files |

---

## Open Questions (RESOLVED)

1. **Weakness spin count resolution mechanism**
   - What we know: CONT-05 specifies 0–3 weaknesses per character; race modifier affects count distribution
   - What's unclear: Should the count be drawn by a weighted random roll at the Weakness sentinel, or should it be pre-determined by the race at queue-build time?
   - Recommendation: Draw at the Weakness sentinel (same moment of tension as other variable spins). The race's `weaknessProbabilityModifier` adjusts the weight distribution for the count roll.
   - **RESOLVED**: Draw count at the Weakness sentinel using `weightedRandom` on modifier-adjusted weights. Baseline probabilities [0: 10%, 1: 45%, 2: 35%, 3: 10%]; race's `weaknessProbabilityModifier` scales the distribution. Implemented in Plan 02-04 weakness sentinel logic.

2. **Powers and Weapons — single spin or multiple?**
   - What we know: CORE-02 lists "Power(s)" and "Weapon(s)" suggesting potentially multiple; the architecture doc shows `powers: []` and `weapons: []` as arrays
   - What's unclear: Are Power and Weapon also variable-count like abilities? Or exactly one each?
   - Recommendation: Treat as single spins in Phase 2 for simplicity (matching the 23-category framing). The "plural" in CORE-02 likely reflects that a character may have one power from a large pool. If variable-count is desired, the same splice pattern applies.
   - **RESOLVED**: Treat as single spins in Phase 2. One Power spin, one Weapon spin. The "plural" in CORE-02 reflects a large pool, not multiple draws. Implemented in `buildInitialQueue()` with single `'power'` and `'weapon'` entries.

3. **Archetype ability pools — shared or archetype-specific?**
   - What we know: CONT-02 specifies archetype-specific ability pools (8–12 entries per archetype, v2 deferred)
   - What's unclear: In Phase 2, do archetype ability spins draw from a shared pool or a per-archetype pool?
   - Recommendation: Use the shared racial ability pool for both racial and archetype ability spins in Phase 2 (simpler), with a `TODO: split per-archetype in v2` comment. CONT-02 is a v2 requirement.
   - **RESOLVED**: Use a shared general ability pool for both `racialAbility` and `archetypeAbility` spins in Phase 2 (same pool as racial abilities). Per-archetype pools are v2 per CONT-02. Implemented in Plan 02-03 Task 2 (spinQueue.ts wiring).

4. **Height spin — what are the segments?**
   - What we know: Height is listed as one of the 23 categories; the example data shows `"6'4\""` as a height value with tier and score
   - What's unclear: Does Height have flavor labels like other stats, or is it a fixed list of measurement strings?
   - Recommendation: Simple fixed list of heights (e.g., 5'0" through 7'6" in 1" increments, or dramatic flavor names like "Towering", "Diminutive"), each with an embedded tier. Not a FlavorLabel stat wheel — no tier system for height needed unless the requirements specify it.
   - **RESOLVED**: Simple `SimpleItem[]` fixed list with dramatic height descriptions (no tier system — height does not contribute to score). Implemented in Plan 02-03 Task 2 as `height-labels.ts`.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 2 is purely browser-side code changes. No new external tools, services, runtimes, or CLI utilities are required. All dependencies are already installed from Phase 1.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.6 |
| Config file | `/Users/bastianpethel/Documents/AI-AGENTS/wheel spin game/vitest.config.ts` |
| Quick run command | `npx vitest run src/lib/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CORE-02 | `buildInitialQueue()` returns 22 entries in correct order | unit | `npx vitest run src/lib/game/spinQueue.test.ts` | Wave 0 |
| CORE-03 | Splicing 1–4 racial ability slots inserts at correct index; `currentSpinIndex` stays valid | unit | `npx vitest run src/lib/game/spinQueue.test.ts` | Wave 0 |
| CORE-03 | Splicing 0 ability slots (edge) leaves queue unchanged | unit | `npx vitest run src/lib/game/spinQueue.test.ts` | Wave 0 |
| CORE-04 | `scoreTier(1)` returns `'F-'`; `scoreTier(100)` returns `'God'`; all 28 grades reachable | unit | `npx vitest run src/lib/game/scoreTier.test.ts` | Wave 0 |
| CORE-04 | `scoreTier()` returns a valid grade for every integer 1–100 (no gaps) | unit | `npx vitest run src/lib/game/scoreTier.test.ts` | Wave 0 |
| REDEM-01 | `computeOverallScore()` returns value in [1, 100] for representative stat inputs | unit | `npx vitest run src/lib/game/scoreTier.test.ts` | Wave 0 |
| REDEM-01 | `gradeToScore()` is inverse-consistent with `scoreTier()` for all 28 grades | unit | `npx vitest run src/lib/game/scoreTier.test.ts` | Wave 0 |
| CARD-01 | Session serialized with `$state.snapshot` round-trips through `saveSession`/`loadSession` | unit | `npx vitest run src/lib/session/` | Exists (extend store.test.ts) |
| CORE-05 | Extended `SessionState` (with `spinQueue` + `currentSpinIndex`) persists and restores without error | unit | `npx vitest run src/lib/session/store.test.ts` | Exists (extend) |

### Sampling Rate

- **Per task commit:** `npx vitest run src/lib/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/lib/game/scoreTier.ts` — implementation needed before tests
- [ ] `src/lib/game/scoreTier.test.ts` — covers CORE-04 + REDEM-01
- [ ] `src/lib/game/spinQueue.ts` — `buildInitialQueue()`, `SpinDefinition`, `getSegmentsForCategory()`
- [ ] `src/lib/game/spinQueue.test.ts` — covers CORE-02 + CORE-03
- [ ] `src/lib/content/types.ts` — shared type definitions (no test needed)

---

## Security Domain

Phase 2 is entirely browser-only — no network requests, no user input stored beyond `localStorage`, no authentication. No ASVS categories apply to this phase.

`localStorage` is same-origin restricted by the browser. No sensitive data is stored — only game session state (spin results, tier grades, numeric scores). No security controls required for Phase 2. [VERIFIED: Phase 2 is browser-only per CONTEXT.md domain section]

---

## Sources

### Primary (HIGH confidence)
- `/sveltejs/svelte` (Context7) — `$state` deep reactive proxy, `.splice()` reactivity, `$state.snapshot()` API
- `src/lib/session/types.ts` — Existing type contracts (`WeightedSegment`, `SpinResult`, `SessionState`)
- `src/lib/session/store.ts` — Existing `saveSession/loadSession/clearSession` API
- `src/lib/game/random.ts` — Existing `weightedRandom()` implementation
- `src/components/SpinWheel.svelte` — Existing component API (`segments`, `onSpinComplete`)
- `.planning/phases/01-animation-foundation/SKELETON.md` — All Phase 1 locked decisions
- `CLAUDE.md` — Critical architecture rules (power4.out, result-before-animation, scoreTier single source of truth, localStorage after every spin)
- `.planning/REQUIREMENTS.md` — CORE-02, CORE-03, CORE-04, REDEM-01, CARD-01, CONT-01 through CONT-08

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md` — Session accumulator shape, sequencer pattern, tier scoring map
- `.planning/research/SUMMARY.md` — Rarity weighting percentages (Common ~35%, Uncommon ~45%, Rare ~18%, Legendary ~2%), content pool counts

### Tertiary (LOW confidence — none in this research)

All assumptions are explicitly tagged in the Assumptions Log above.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — unchanged from Phase 1; all packages verified installed
- Architecture (queue, splice, types): HIGH — Svelte 5 `$state` docs verified; pattern derived from existing code
- scoreTier mapping (numeric ranges): MEDIUM — grade list is locked; exact numeric boundaries are Claude's discretion and can be adjusted without breaking the system
- Content structure: HIGH — types derived directly from requirements; file strategy is standard TS module pattern
- Pitfalls: HIGH — derived from code inspection and Svelte 5 docs

**Research date:** 2026-05-15
**Valid until:** 2026-06-15 (Svelte 5 is stable; GSAP 3.15 is stable; no fast-moving dependencies)
