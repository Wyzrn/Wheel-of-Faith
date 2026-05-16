# Phase 2: Full 23-Spin Game Loop - Pattern Map

**Mapped:** 2026-05-15
**Files analyzed:** 22 new/modified files
**Analogs found:** 14 / 22

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/game/scoreTier.ts` | utility | transform | `src/lib/game/random.ts` | role-match |
| `src/lib/game/scoreTier.test.ts` | test | transform | `src/lib/game/random.test.ts` | exact |
| `src/lib/game/spinQueue.ts` | utility | transform | `src/lib/game/geometry.ts` | role-match |
| `src/lib/game/spinQueue.test.ts` | test | transform | `src/lib/game/geometry.test.ts` | exact |
| `src/lib/game/tierColor.ts` | utility | transform | `src/lib/game/random.ts` | role-match |
| `src/lib/content/types.ts` | model | — | `src/lib/session/types.ts` | role-match |
| `src/lib/content/races.ts` | model | — | `src/lib/session/types.ts` | partial |
| `src/lib/content/archetypes.ts` | model | — | `src/lib/session/types.ts` | partial |
| `src/lib/content/powers.ts` | model | — | `src/lib/session/types.ts` | partial |
| `src/lib/content/weapons.ts` | model | — | `src/lib/session/types.ts` | partial |
| `src/lib/content/weaknesses.ts` | model | — | `src/lib/session/types.ts` | partial |
| `src/lib/content/backstories.ts` | model | — | `src/lib/session/types.ts` | partial |
| `src/lib/content/titles.ts` | model | — | `src/lib/session/types.ts` | partial |
| `src/lib/content/enchantments.ts` | model | — | `src/lib/session/types.ts` | partial |
| `src/lib/content/strength-labels.ts` (+ 10 other stat label files) | model | — | `src/lib/session/types.ts` | partial |
| `src/components/CharacterCard.svelte` | component | request-response | `src/components/SpinWheel.svelte` | role-match |
| `src/components/TierBadge.svelte` | component | request-response | `src/components/SpinWheel.svelte` | partial |
| `src/routes/+page.svelte` | component (orchestrator) | event-driven | `src/routes/+page.svelte` (self) | exact |
| `src/lib/session/types.ts` | model | — | `src/lib/session/types.ts` (self) | exact |
| `src/app.css` | config | — | `src/app.css` (self) | exact |

---

## Pattern Assignments

### `src/lib/game/scoreTier.ts` (utility, transform)

**Analog:** `src/lib/game/random.ts`

**Imports pattern** (`random.ts` lines 1–0, no imports; `geometry.ts` lines 1–0 same): No external imports needed. Pure TypeScript — no imports beyond types from within the same module.

**Core pattern** (`random.ts` lines 1–14): Export a typed named function and any required interfaces from the same file. No default export. No class.

```typescript
// random.ts — full file structure to copy
export interface WeightedItem {
  label: string
  weight: number
}

export function weightedRandom(items: WeightedItem[]): number {
  const total = items.reduce((sum, item) => sum + item.weight, 0)
  let roll = Math.random() * total
  for (let i = 0; i < items.length; i++) {
    roll -= items[i].weight
    if (roll <= 0) return i
  }
  return items.length - 1
}
```

**Apply to `scoreTier.ts`:** Export `TierGrade` union type, `TIER_THRESHOLDS` const array, `scoreTier(score: number): TierGrade`, `gradeToScore(grade: TierGrade): number`, and `computeOverallScore(statResults: Record<string, number>): number`. No imports from other project files (self-contained utility). `STAT_WEIGHTS` constant lives in the same file.

**Error handling pattern:** No try/catch — pure functions. Mirror `random.ts` which also has no error handling beyond a fallback last-index return. `scoreTier()` uses a fallback `return 'F-'` as a TypeScript-safety valve, identical in intent to `return items.length - 1` in `weightedRandom`.

---

### `src/lib/game/scoreTier.test.ts` (test, transform)

**Analog:** `src/lib/game/random.test.ts`

**Imports pattern** (`random.test.ts` lines 1–2):
```typescript
import { describe, it, expect } from 'vitest'
import { weightedRandom } from './random'
```

**Test structure pattern** (`random.test.ts` lines 4–38): Fixture data declared outside `describe` blocks as `const`. Single `describe` block per exported function. Each `it` block tests one observable behavior. Loop-based coverage tests for exhaustive validation (1000 calls). No `beforeEach` or mocking needed for pure functions.

```typescript
// random.test.ts — structure to copy exactly
import { describe, it, expect } from 'vitest'
import { weightedRandom } from './random'

const SIX_SEGS = [ /* fixtures */ ]

describe('weightedRandom', () => {
  it('always returns a valid index over 1000 calls', () => {
    for (let i = 0; i < 1000; i++) {
      const idx = weightedRandom(SIX_SEGS)
      expect(idx).toBeGreaterThanOrEqual(0)
      expect(idx).toBeLessThan(SIX_SEGS.length)
    }
  })
  // ...
})
```

**Apply to `scoreTier.test.ts`:** Three `describe` blocks: `scoreTier`, `gradeToScore`, `computeOverallScore`. For `scoreTier`: loop through all integers 1–100, assert each returns a valid TierGrade string. Assert boundary values explicitly: `scoreTier(1) === 'F-'`, `scoreTier(100) === 'God'`. For `gradeToScore`: assert it returns a number in [1, 100] for every TierGrade. For `computeOverallScore`: assert result is in [1, 100] for representative inputs.

---

### `src/lib/game/spinQueue.ts` (utility, transform)

**Analog:** `src/lib/game/geometry.ts`

**Imports pattern** (`geometry.ts` lines 1–0): No imports. Pure utility module. Self-contained.

**Core pattern** (`geometry.ts` lines 1–31): Export multiple named functions and no types (types live in `types.ts`). Functions are pure — no side effects, no module-level mutable state.

```typescript
// geometry.ts — export shape to mirror
export function slicePath(...): string { ... }
export function equalSegmentAngles(...): Array<...> { ... }
export function calculateTargetAngle(...): number { ... }
```

**Apply to `spinQueue.ts`:** Export `SpinCategory` union type, `SpinDefinition` interface, `buildInitialQueue(): SpinDefinition[]`, and `getSegmentsForCategory(category: SpinCategory): WeightedSegment[]`. The function `getSegmentsForCategory` is the only one that imports from content modules — it switches on the category and returns the appropriate segment array. Import `WeightedSegment` from `$lib/session/types`. Import content arrays from `$lib/content/*`.

**Error handling:** No try/catch. For unknown categories in `getSegmentsForCategory`, return `[]` (empty array) as a safe fallback — mirrors geometry's implicit behavior of returning valid values for all standard inputs.

---

### `src/lib/game/spinQueue.test.ts` (test, transform)

**Analog:** `src/lib/game/geometry.test.ts`

**Imports pattern** (`geometry.test.ts` lines 1–2):
```typescript
import { describe, it, expect } from 'vitest'
import { slicePath, equalSegmentAngles, calculateTargetAngle } from './geometry'
```

**Test structure pattern** (`geometry.test.ts` lines 1–46): One `describe` block per exported function. Tests use concrete numeric assertions (`toBeCloseTo`, `toHaveLength`, `toBe`). No mocks.

```typescript
// geometry.test.ts — the describe/it/expect shape to replicate
describe('equalSegmentAngles', () => {
  it('returns count items; first startDeg=0; last endDeg=360', () => {
    const segs = equalSegmentAngles(8)
    expect(segs).toHaveLength(8)
    expect(segs[0].startDeg).toBe(0)
    expect(segs[7].endDeg).toBeCloseTo(360, 5)
  })
})
```

**Apply to `spinQueue.test.ts`:** `describe('buildInitialQueue')` — assert length is 22, first entry category is `'race'`, last is `'title'`, no `racialAbility` or `archetypeAbility` entries in the initial queue. `describe('queue splice behavior')` — simulate the splice pattern: take a copy of the initial queue, splice 3 racialAbility entries at index 1, assert new length is 25, assert entries at indices 1–3 are `racialAbility`, assert entry at index 4 is `archetype`.

---

### `src/lib/game/tierColor.ts` (utility, transform)

**Analog:** `src/lib/game/random.ts`

**Imports pattern:** None — self-contained. Imports only the `TierGrade` type from `$lib/game/scoreTier`.

**Core pattern:** Single exported function `tierToCssVar(grade: TierGrade): string` with a `const map: Record<TierGrade, string>` lookup table. The full 28-entry map is specified verbatim in `02-UI-SPEC.md` lines 138–171. Copy that map exactly.

```typescript
// tierColor.ts — shape mirrors random.ts single-function structure
import type { TierGrade } from './scoreTier'

export function tierToCssVar(grade: TierGrade): string {
  const map: Record<TierGrade, string> = {
    'F-':   'var(--tier-f-minus)',
    // ... all 28 entries from UI-SPEC.md lines 143–169
  }
  return map[grade] ?? 'var(--tier-f-minus)'
}
```

**Error handling:** Fallback `?? 'var(--tier-f-minus)'` — same fallback-return pattern as `weightedRandom`'s `return items.length - 1`.

---

### `src/lib/content/types.ts` (model)

**Analog:** `src/lib/session/types.ts`

**Imports pattern** (`types.ts` lines 1–0): No imports — types file is self-contained. All types are declared inline with no dependencies on other project files. (Exception: `FlavorLabel` references `TierGrade` — import that type from `$lib/game/scoreTier`.)

**Core pattern** (`types.ts` lines 1–21): Export only `type`, `interface`, and `export type` declarations. No functions, no constants, no runtime code. One interface per concept.

```typescript
// session/types.ts — structure to replicate
export type SpinStatus = 'IDLE' | 'SPINNING' | 'LANDED' | 'REVEALED'

export interface WeightedSegment {
  label: string
  weight: number
  color?: string
}

export interface SpinResult {
  step: number
  category: string
  resultLabel: string
  resultIndex: number
  timestamp: string
}

export interface SessionState {
  sessionId: string
  startedAt: string
  completedSpins: SpinResult[]
}
```

**Apply to `content/types.ts`:** Export `Race`, `Archetype`, `SimpleItem`, `Weakness`, `FlavorLabel` interfaces per the shapes specified in RESEARCH.md Patterns 6 and 7. Import `TierGrade` from `$lib/game/scoreTier` for the `FlavorLabel.tier` field type.

---

### `src/lib/content/races.ts` (and all other content modules: archetypes, powers, weapons, weaknesses, backstories, titles, enchantments) (model)

**Analog:** No exact analog exists in the codebase. Closest structural analog: `src/lib/game/spinEngine.ts` for the pattern of a const data structure exported from a module.

**Imports pattern** (`spinEngine.ts` lines 1–2):
```typescript
export type { SpinStatus } from '../session/types'
import type { SpinStatus } from '../session/types'
```

**Core pattern** (`spinEngine.ts` lines 4–13): A typed `const` declared at module level with an explicit type annotation, followed by exported functions that consume it. For content modules, the pattern is simpler — only the `const` array export, no functions.

```typescript
// spinEngine.ts — const + type annotation shape to borrow
const VALID_TRANSITIONS: Record<SpinStatus, SpinStatus[]> = {
  IDLE: ['SPINNING'],
  // ...
}
```

**Apply to content modules:**
```typescript
// races.ts — follow this shape
import type { Race } from './types'

export const races: Race[] = [
  { label: 'Human', weight: 35, abilitySpinCount: 1, weaknessProbabilityModifier: 1.0 },
  // ... 35+ entries
]
```

Each content file: single named import of its type from `./types`, single `export const` array with explicit type annotation. No default export. No functions. File name matches the plural noun of the content type.

**For stat label files** (`strength-labels.ts`, etc.): Same pattern with `FlavorLabel` type.
```typescript
import type { FlavorLabel } from './types'

export const strengthLabels: FlavorLabel[] = [
  { label: 'Wet Noodle Arm', weight: 1, tier: 'F-', score: 2, color: 'var(--tier-f-minus)' },
  // ... ~560 entries
]
```

---

### `src/components/CharacterCard.svelte` (component, request-response)

**Analog:** `src/components/SpinWheel.svelte`

**Imports pattern** (`SpinWheel.svelte` lines 1–7):
```typescript
import { onMount } from 'svelte'
import { gsap } from 'gsap'
import { slicePath, equalSegmentAngles, calculateTargetAngle } from '$lib/game/geometry'
import { weightedRandom } from '$lib/game/random'
import type { WeightedSegment, SpinStatus } from '$lib/session/types'
```

**Apply to `CharacterCard.svelte`:**
```typescript
import TierBadge from './TierBadge.svelte'
import { scoreTier, computeOverallScore } from '$lib/game/scoreTier'
import type { SpinResult } from '$lib/session/types'
```

**Props pattern** (`SpinWheel.svelte` lines 15–18):
```typescript
let { segments, onSpinComplete }: {
  segments: WeightedSegment[]
  onSpinComplete: (resultIndex: number, resultLabel: string) => void
} = $props()
```

**Apply to `CharacterCard.svelte`:**
```typescript
let { results, onNewCharacter }: {
  results: SpinResult[]
  onNewCharacter: () => void
} = $props()
```

**Derived values pattern** (`SpinWheel.svelte` lines 24–26):
```typescript
let canSpin = $derived(spinStatus === 'IDLE')
let isRevealed = $derived(spinStatus === 'REVEALED')
let segmentAngles = $derived(equalSegmentAngles(segments.length))
```

**Apply to `CharacterCard.svelte`:**
```typescript
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
```

**Template structure** (`SpinWheel.svelte` lines 61–107): Svelte 5 template — no `{#if}` needed for the outer container; conditional rendering for sections uses `{#if}` and `{#each}`. All layout via Tailwind utility classes. `bg-gray-900 rounded-2xl p-8 max-w-2xl mx-auto` for the card container per UI-SPEC.

**Button pattern** (`SpinWheel.svelte` lines 96–102):
```svelte
<button
  onclick={handleSpin}
  disabled={!canSpin}
  class="bg-indigo-600 text-white px-8 py-3 rounded-lg text-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
>
```

**Apply to "New Character" button:**
```svelte
<button
  onclick={onNewCharacter}
  class="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-bold text-base"
>
  New Character
</button>
```

---

### `src/components/TierBadge.svelte` (component, request-response)

**Analog:** `src/components/SpinWheel.svelte` (partial — inline badge elements only)

**Imports pattern:** Minimal — only the type and color utility:
```typescript
import { tierToCssVar } from '$lib/game/tierColor'
import type { TierGrade } from '$lib/game/scoreTier'
```

**Props pattern** (copy `SpinWheel.svelte` lines 15–18 shape):
```typescript
let { grade, score, hero = false }: {
  grade: TierGrade
  score?: number
  hero?: boolean
} = $props()
```

**Derived values:**
```typescript
let bgColor = $derived(tierToCssVar(grade))
let textColor = $derived(grade === 'God' ? '#1a1a1a' : 'white')
```

**Template — two variants per UI-SPEC lines 296–303:**
```svelte
{#if hero}
  <div class="rounded-xl p-6 text-center w-full" style="background-color: {bgColor}; color: {textColor}">
    <div class="text-7xl font-bold leading-none">{grade}</div>
    {#if score !== undefined}
      <div class="text-sm text-gray-400 mt-1">{score} / 100</div>
    {/if}
  </div>
{:else}
  <span class="inline-flex items-center justify-center rounded px-2 py-0.5 text-xs font-bold w-12 h-6"
        style="background-color: {bgColor}; color: {textColor}">
    {grade}
  </span>
{/if}
```

---

### `src/routes/+page.svelte` (extended — component, event-driven)

**Analog:** `src/routes/+page.svelte` (self — extension of existing file)

**Imports pattern** (lines 1–6 — extend, do not replace):
```typescript
import { onMount } from 'svelte'
import SpinWheel from '../components/SpinWheel.svelte'
import { loadSession, saveSession, clearSession, createSession } from '$lib/session/store'
import type { WeightedSegment, SessionState } from '$lib/session/types'
```

**Add to imports:**
```typescript
import CharacterCard from '../components/CharacterCard.svelte'
import { buildInitialQueue, getSegmentsForCategory } from '$lib/game/spinQueue'
import type { SpinDefinition } from '$lib/game/spinQueue'
import type { SpinResult } from '$lib/session/types'
import { races } from '$lib/content/races'
import { archetypes } from '$lib/content/archetypes'
```

**State pattern** (lines 18–21 — existing `$state` declarations to extend):
```typescript
let currentSession = $state<SessionState>(createSession())
let showResumePrompt = $state(false)
let restoredResult = $state<{ index: number; label: string } | null>(null)
let spinHistory = $state<Array<{ index: number; label: string }>>([])
```

**New `$state` declarations** (follow the same `$state<Type>(initialValue)` pattern):
```typescript
let spinQueue = $state<SpinDefinition[]>(buildInitialQueue())
let currentSpinIndex = $state(0)
let results = $state<SpinResult[]>([])
let showAnnouncement = $state<string | null>(null)
let showCard = $state(false)
```

**`$derived` pattern** (lines 24–26 of SpinWheel.svelte, same idiom used in +page.svelte):
```typescript
let currentDef = $derived(spinQueue[currentSpinIndex])
let currentSegments = $derived(getSegmentsForCategory(currentDef?.category))
```

**onSpinComplete handler pattern** (lines 31–46 — extend `handleSpinComplete`):
```typescript
// Existing pattern to extend:
function handleSpinComplete(index: number, label: string) {
  const newSpin = {
    step: currentSession.completedSpins.length + 1,
    category: 'demo',
    resultLabel: label,
    resultIndex: index,
    timestamp: new Date().toISOString(),
  }
  const updatedSession = { ...currentSession, completedSpins: [...currentSession.completedSpins, newSpin] }
  currentSession = updatedSession
  saveSession(updatedSession)
  spinHistory = [...spinHistory, { index, label }]
}
```

**Replace with Phase 2 version** — uses `$state.snapshot()` before `saveSession()`, splices queue before saving:
```typescript
function handleSpinComplete(resultIndex: number, resultLabel: string) {
  const currentDef = spinQueue[currentSpinIndex]

  // 1. Splice queue FIRST (before saveSession)
  if (currentDef.category === 'race') {
    const race = races.find(r => r.label === resultLabel)
    const count = race?.abilitySpinCount ?? 1
    const slots: SpinDefinition[] = Array.from({ length: count }, (_, i) => ({
      category: 'racialAbility' as const,
      displayName: `Racial Ability ${i + 1}`,
    }))
    spinQueue.splice(currentSpinIndex + 1, 0, ...slots)
    showAnnouncement = `Your race grants ${count} ability spin${count > 1 ? 's' : ''}!`
  }
  // ... archetype same pattern

  // 2. Push result
  results.push({ /* ... */ })

  // 3. saveSession with snapshot (MUST use $state.snapshot)
  saveSession({
    ...currentSession,
    completedSpins: $state.snapshot(results),
    spinQueue: $state.snapshot(spinQueue),
    currentSpinIndex,
  } as SessionState)
}
```

**handleStartOver / handleNewCharacter pattern** (lines 60–66):
```typescript
function handleStartOver() {
  clearSession()
  currentSession = createSession()
  showResumePrompt = false
  restoredResult = null
  spinHistory = []
}
```

**Extend as `handleNewCharacter`:**
```typescript
function handleNewCharacter() {
  clearSession()
  currentSession = createSession()
  spinQueue = buildInitialQueue()
  currentSpinIndex = 0
  results = []
  showAnnouncement = null
  showCard = false
}
```

**Resume pattern** (lines 48–58): The existing `handleResume` pattern reads `completedSpins.at(-1)`. Extend to also restore `spinQueue` and `currentSpinIndex` from saved session if present, falling back to `buildInitialQueue()` if absent.

**Template pattern** (lines 69–114): Existing layout uses `min-h-screen bg-gray-950 text-white flex flex-col items-center py-8 px-4`. Phase 2 extends to two-column layout for spin screen: `flex flex-row gap-8 items-start` (desktop) with responsive `flex-col gap-6` (mobile). The resume prompt block (lines 73–93) stays structurally identical — same `bg-gray-800 border border-gray-600 rounded-xl p-6` shape.

**SpinWheel usage** (line 102 — unchanged call shape):
```svelte
<SpinWheel segments={currentSegments} onSpinComplete={handleSpinComplete} />
```

---

### `src/lib/session/types.ts` (extended — model)

**Analog:** `src/lib/session/types.ts` (self)

**Existing content** (lines 1–21) — preserved as-is. Add optional fields to existing interfaces:

```typescript
// Extend SpinResult — add optional tier + score fields
export interface SpinResult {
  step: number
  category: string
  resultLabel: string
  resultIndex: number
  timestamp: string
  tier?: TierGrade          // only for stat spins
  score?: number            // only for stat spins
}

// Extend SessionState — add optional queue persistence fields
export interface SessionState {
  sessionId: string
  startedAt: string
  completedSpins: SpinResult[]
  spinQueue?: SpinDefinition[]     // Phase 2: queue for resume
  currentSpinIndex?: number        // Phase 2: pointer for resume
}
```

Import `TierGrade` from `$lib/game/scoreTier` and `SpinDefinition` from `$lib/game/spinQueue`. Use `import type` to avoid circular runtime dependency risk.

---

### `src/app.css` (extended — config)

**Analog:** `src/app.css` (self — currently one line)

**Current content** (line 1):
```css
@import "tailwindcss";
```

**Extend with tier CSS custom properties** per UI-SPEC.md lines 93–126. Append after the import:
```css
@import "tailwindcss";

@layer base {
  :root {
    --tier-f-minus: #6b4226;
    /* ... all 28 variables verbatim from UI-SPEC.md lines 97–124 ... */
    --tier-god:     #fef9c3;
  }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

---

## Shared Patterns

### $state Declarations
**Source:** `src/routes/+page.svelte` lines 18–21
**Apply to:** All new `$state` variables in `+page.svelte`

Pattern: `let varName = $state<TypeAnnotation>(initialValue)` — always explicit generic type, always initialized.

```typescript
let currentSession = $state<SessionState>(createSession())
let showResumePrompt = $state(false)
```

### $derived Declarations
**Source:** `src/components/SpinWheel.svelte` lines 24–26
**Apply to:** All computed values in `+page.svelte` and `CharacterCard.svelte`

```typescript
let canSpin = $derived(spinStatus === 'IDLE')
let isRevealed = $derived(spinStatus === 'REVEALED')
let segmentAngles = $derived(equalSegmentAngles(segments.length))
```

### $props() Destructuring with Inline Type
**Source:** `src/components/SpinWheel.svelte` lines 15–18
**Apply to:** `CharacterCard.svelte`, `TierBadge.svelte`

```typescript
let { segments, onSpinComplete }: {
  segments: WeightedSegment[]
  onSpinComplete: (resultIndex: number, resultLabel: string) => void
} = $props()
```

### localStorage Guard Pattern
**Source:** `src/lib/session/store.ts` lines 13–14, 24–25, 29–30
**Apply to:** Any direct localStorage access (none new in Phase 2 — use `saveSession`/`loadSession` from store instead)

```typescript
if (typeof localStorage === 'undefined') return null
```

### onMount + GSAP Context Cleanup
**Source:** `src/components/SpinWheel.svelte` lines 31–34
**Apply to:** `CharacterCard.svelte` does NOT use GSAP — do not copy this pattern there. Only copy if a new component uses GSAP animations.

```typescript
onMount(() => {
  ctx = gsap.context(() => {}, wheelGroupEl)
  return () => ctx.revert()
})
```

### Vitest Test File Structure
**Source:** `src/lib/session/store.test.ts` lines 1–4
**Apply to:** All new `.test.ts` files

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { functionUnderTest } from './module'

// For pure functions: no beforeEach needed
// For localStorage-dependent tests: mock localStorage in beforeEach (copy store.test.ts lines 4–11)
```

**localStorage mock** (for store extension tests — `store.test.ts` lines 4–11):
```typescript
beforeEach(() => {
  globalThis.localStorage = {
    store: {} as Record<string, string>,
    getItem(k: string) { return (this.store as Record<string, string>)[k] ?? null },
    setItem(k: string, v: string) { (this.store as Record<string, string>)[k] = v },
    removeItem(k: string) { delete (this.store as Record<string, string>)[k] },
  } as unknown as Storage
})
```

### Button Classes
**Source:** `src/components/SpinWheel.svelte` lines 96–102 and `src/routes/+page.svelte` lines 85–95
**Apply to:** All buttons in `+page.svelte` and `CharacterCard.svelte`

Primary (indigo):
```svelte
class="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg transition-colors"
```

Destructive (red, for "New Character"):
```svelte
class="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-bold text-base"
```

Secondary (gray):
```svelte
class="bg-gray-600 hover:bg-gray-500 text-white px-5 py-2 rounded-lg transition-colors"
```

Disabled state — add to any button that can be disabled:
```svelte
disabled={!canSpin}
class="... disabled:opacity-40 disabled:cursor-not-allowed"
```

### Resume Prompt UI Block
**Source:** `src/routes/+page.svelte` lines 73–93
**Apply to:** Resume prompt remains structurally identical in Phase 2 — extend the displayed text to include queue state, but keep the same container and button layout.

```svelte
<div class="w-full max-w-sm bg-gray-800 border border-gray-600 rounded-xl p-6 mb-6 text-center">
  <p class="text-lg font-semibold mb-2">You have a saved session</p>
  <p class="text-sm text-gray-400 mb-4">
    Last result: <span class="text-white font-medium">
      {currentSession.completedSpins.at(-1)?.resultLabel ?? ''}
    </span>
    ({currentSession.completedSpins.length} spin(s) completed)
  </p>
  <div class="flex gap-3 justify-center">
    <button onclick={handleResume} class="bg-indigo-600 hover:bg-indigo-700 ...">Resume</button>
    <button onclick={handleStartOver} class="bg-gray-600 hover:bg-gray-500 ...">Start Over</button>
  </div>
</div>
```

### $state.snapshot() Before saveSession
**Source:** RESEARCH.md Pattern 4 (no existing code analog — this is a new Phase 2 requirement)
**Apply to:** Every `saveSession()` call in `+page.svelte` that passes `$state` reactive values

```typescript
// ALWAYS wrap $state arrays/objects in $state.snapshot() before saveSession
saveSession({
  ...currentSession,
  completedSpins: $state.snapshot(results),
  spinQueue: $state.snapshot(spinQueue),
  currentSpinIndex,
} as SessionState)
```

---

## No Analog Found

Files with no close match in the codebase — planner should use RESEARCH.md patterns as the primary reference:

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/lib/content/races.ts` | model | — | No content data modules exist yet; structure derived from RESEARCH.md Pattern 7 |
| `src/lib/content/archetypes.ts` | model | — | Same — no content precedent |
| `src/lib/content/powers.ts` | model | — | Same — largest file (~1,000+ entries); consider split per RESEARCH.md Pitfall 6 |
| `src/lib/content/weapons.ts` | model | — | Same |
| `src/lib/content/weaknesses.ts` | model | — | Same; `Weakness` extends `SimpleItem` with `severe: boolean` |
| `src/lib/content/backstories.ts` | model | — | Same |
| `src/lib/content/titles.ts` | model | — | Same |
| `src/lib/content/enchantments.ts` | model | — | Same |
| `src/lib/content/strength-labels.ts` (and 10 other stat label files) | model | — | No stat label files exist; ~560 entries per file; use `FlavorLabel` type from `content/types.ts` |

**Pattern to use for all content modules** (derived from `spinEngine.ts` const-export shape):
```typescript
import type { Race } from './types'   // or Archetype, FlavorLabel, Weakness, etc.

export const races: Race[] = [
  // entries here
]
```

---

## Metadata

**Analog search scope:** `src/components/`, `src/lib/game/`, `src/lib/session/`, `src/routes/`
**Files scanned:** 10 source files (all files in the project)
**Pattern extraction date:** 2026-05-15
