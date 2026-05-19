# Phase 7: Story Mode Shell + Character Roster - Pattern Map

**Mapped:** 2026-05-18
**Files analyzed:** 10 new/modified files
**Analogs found:** 9 / 10

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/routes/story/+page.svelte` | route/page | event-driven (view state machine) | `src/routes/+page.svelte` | exact |
| `src/lib/story/types.ts` | types | — | `src/lib/session/types.ts` + `src/lib/content/types.ts` | exact |
| `src/lib/story/store.ts` | utility (localStorage) | CRUD | `src/lib/session/store.ts` + `src/lib/spinHistory.ts` | exact |
| `src/lib/story/naming.ts` | utility (pure function) | transform | no direct analog — pattern from RESEARCH.md | none |
| `src/lib/story/shards.ts` | utility (pure function) | transform | `src/lib/game/scoreTier.ts` (tier-bracket lookup) | role-match |
| `src/lib/story/naming.test.ts` | test | — | `src/lib/game/random.test.ts` | exact |
| `src/lib/story/store.test.ts` | test | — | `src/lib/session/store.test.ts` | exact |
| `src/lib/story/shards.test.ts` | test | — | `src/lib/game/scoreTier.test.ts` | exact |
| `src/components/story/RosterCard.svelte` | component | — | `src/components/TierBadge.svelte` (prop/runes style) | role-match |
| `src/components/story/SellConfirmModal.svelte` | component (modal) | event-driven | `src/routes/+page.svelte` resume-prompt overlay (lines 1855–1888) | role-match |

---

## Pattern Assignments

### `src/lib/story/types.ts` (types module)

**Analog:** `src/lib/session/types.ts`

**Pattern — interface-only file** (lines 1–40 of session/types.ts):
```typescript
// Phase 2 additions — import type only to avoid circular runtime dependency risk
import type { TierGrade } from '$lib/game/scoreTier'
import type { SpinDefinition } from '$lib/game/spinQueue'
import type { ElementType, ItemGrade } from '$lib/content/types'

export type SpinStatus = 'IDLE' | 'SPINNING' | 'LANDED' | 'REVEALED'

export interface SpinResult {
  step: number
  category: string
  resultLabel: string
  resultIndex: number
  timestamp: string
  tier?: TierGrade
  score?: number
  displayLabel?: string
}

export interface SessionState {
  sessionId: string
  startedAt: string
  completedSpins: SpinResult[]
  spinQueue?: SpinDefinition[]
  currentSpinIndex?: number
  pendingStatBonuses?: Record<string, Array<'statBonus' | 'statPenalty'>>
}
```

**Apply this pattern:** `types.ts` is interface-only — no functions, no runtime code, no default export. Use `import type` at the top. Comment each interface with its purpose.

**Story-specific interface to implement** (from RESEARCH.md Pattern 3):
```typescript
// src/lib/story/types.ts
import type { SpinResult } from '$lib/session/types'
import type { TierGrade } from '$lib/game/scoreTier'

export interface StoryRosterEntry {
  id: string              // crypto.randomUUID()
  name: string            // auto-generated, permanent
  race: string            // denormalized for sort/filter
  archetype: string       // denormalized for sort/filter
  overallScore: number    // from computeOverallScore()
  overallTier: TierGrade  // from scoreTier(overallScore)
  spins: SpinResult[]     // full array for CharacterCard
  createdAt: string       // ISO timestamp
  sessionStartedAt: string  // required by CharacterCard startedAt prop
}

export interface StoryState {
  roster: StoryRosterEntry[]
  shards: number
}
```

**CRITICAL:** `sessionStartedAt` must be stored (not `startedAt`) to match CharacterCard's required `startedAt` prop. Set it when the spin session begins, not at session end.

---

### `src/lib/story/store.ts` (localStorage CRUD utility)

**Analog:** `src/lib/session/store.ts` (lines 1–33) + `src/lib/spinHistory.ts` (lines 1–60)

**Imports pattern** (`src/lib/session/store.ts` lines 1–3):
```typescript
import type { SessionState } from './types'

const STORAGE_KEY = 'wof_session'
```

**Core CRUD pattern** (`src/lib/session/store.ts` lines 5–33):
```typescript
export function createSession(): SessionState {
  return {
    sessionId: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    completedSpins: [],
  }
}

export function loadSession(): SessionState | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as SessionState
  } catch {
    return null
  }
}

export function saveSession(session: SessionState): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function clearSession(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}
```

**Cap-enforcement pattern** (`src/lib/spinHistory.ts` lines 56–59 adapted):
```typescript
// spinHistory.ts uses unshift + splice for max-entries enforcement
const history = loadSpinHistory()
history.unshift(entry)
if (history.length > MAX_ENTRIES) history.splice(MAX_ENTRIES)
localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
```

**Story store implementation to follow** (from RESEARCH.md Pattern 1 + Code Examples):
```typescript
// src/lib/story/store.ts
import type { StoryRosterEntry } from './types'

const ROSTER_KEY = 'story_roster'
const SHARDS_KEY = 'story_shards'
export const MAX_ROSTER_SIZE = 50

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

// Cap enforced at WRITE time — returns null when at cap
export function addToRoster(
  roster: StoryRosterEntry[],
  entry: StoryRosterEntry
): StoryRosterEntry[] | null {
  if (roster.length >= MAX_ROSTER_SIZE) return null
  const updated = [entry, ...roster]
  saveRoster(updated)
  return updated
}
```

**Key differences from session/store.ts:**
- Two separate keys (`story_roster`, `story_shards`) — never touch `wof_session`
- `loadRoster()` returns `[]` (not `null`) on miss/error — avoids null checks at call sites
- `loadShards()` returns `0` (not `null`) — same convention
- Cap enforced in `addToRoster()`, not in the display layer

---

### `src/lib/story/shards.ts` (pure function, tier-bracket lookup)

**Analog:** `src/lib/game/scoreTier.ts` (lines 104–110, pattern of tier bracket iteration)

**Core lookup pattern** from scoreTier.ts (lines 104–110):
```typescript
// scoreTier() iterates TIER_THRESHOLDS array — same bracket-walking approach
export function scoreTier(score: number): TierGrade {
  const clamped = Math.max(1, Math.min(150, score))
  for (const t of TIER_THRESHOLDS) {
    if (clamped >= t.min && clamped <= t.max) return t.grade
  }
  return 'F-'
}
```

**Imports pattern** (mirrors scoreTier.ts lines 1–5):
```typescript
// No imports from other project files — pure functions only. No default export.
import type { TierGrade } from '$lib/game/scoreTier'
```

**Story shards implementation to follow** (from RESEARCH.md Pattern 4):

The TIER_THRESHOLDS import is NOT needed — use inline tier arrays with `Array.includes()`.
The function must cover all 46 TierGrade values. Tiers above SS use `500 + 100 * stepsAboveSS`.
The `TIERS_ABOVE_SS` array order determines the step multiplier — SS+ = step 1, Absolute+ = highest step.

```typescript
import type { TierGrade } from '$lib/game/scoreTier'

const TIERS_ABOVE_SS: TierGrade[] = [
  'SS+',
  'SSS-', 'SSS', 'SSS+',
  'Z-', 'Z', 'Z+',
  'ZZ-', 'ZZ', 'ZZ+',
  'ZZZ-', 'ZZZ', 'ZZZ+',
  'Celestial-', 'Celestial', 'Celestial+',
  'Godly-', 'Godly',
  'Primordial',
  'Primordial+', 'Absolute-', 'Absolute', 'Absolute+'
]

export function getShardValue(tier: TierGrade): number {
  const fdTiers: TierGrade[] = ['F-','F','F+','E-','E','E+','D-','D','D+']
  if (fdTiers.includes(tier)) {
    const idx = fdTiers.indexOf(tier)
    return 20 + Math.round((idx / (fdTiers.length - 1)) * 35)
  }
  const cbTiers: TierGrade[] = ['C-','C','C+','B-','B','B+']
  if (cbTiers.includes(tier)) {
    const idx = cbTiers.indexOf(tier)
    return 70 + Math.round((idx / (cbTiers.length - 1)) * 60)
  }
  const asTiers: TierGrade[] = ['A-','A','A+','S-','S','S+']
  if (asTiers.includes(tier)) {
    const idx = asTiers.indexOf(tier)
    return 160 + Math.round((idx / (asTiers.length - 1)) * 160)
  }
  if (tier === 'SS-' || tier === 'SS') return 500
  const aboveIdx = TIERS_ABOVE_SS.indexOf(tier)
  if (aboveIdx >= 0) return Math.min(2000, 500 + (aboveIdx + 1) * 100)
  return 20
}
```

---

### `src/lib/story/naming.ts` (pure function, seeded PRNG)

**No direct analog in codebase.** Closest structural analog is `src/lib/game/random.ts` — both are pure function modules with no imports.

**Read `src/lib/game/random.ts` for file structure:**
```typescript
// random.ts — pure, no imports, no default export
export function weightedRandom(segments: { weight: number }[]): number {
  // ...
}
```

**Implement the mulberry32 pattern** from RESEARCH.md Pattern 2. No existing codebase code to copy — write from scratch using the documented algorithm:

```typescript
// src/lib/story/naming.ts
// No imports — pure function module, zero dependencies. No default export.

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

// ADJECTIVES and NOUNS arrays: 40+ entries each for 1,600+ unique combinations
// (see RESEARCH.md Pattern 2 for starter lists)

export function generateCharacterName(overallScore: number, raceLabel: string): string {
  const seed = (overallScore * 31 + hashStr(raceLabel)) | 0
  const rand = mulberry32(seed)
  const adj  = ADJECTIVES[Math.floor(rand() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(rand() * NOUNS.length)]
  return `${adj} ${noun}`
}
```

**CRITICAL:** No `Math.random()` calls anywhere in this file. The seed must come from `(overallScore * 31 + hashStr(raceLabel)) | 0`. Same inputs must always produce the same name.

---

### `src/routes/story/+page.svelte` (route, view state machine)

**Analog:** `src/routes/+page.svelte`

**Imports pattern** (`src/routes/+page.svelte` lines 1–36):
```typescript
import { onMount } from 'svelte'
import SpinWheel from '../components/SpinWheel.svelte'
import TierBadge from '../components/TierBadge.svelte'
import CharacterCard from '../components/CharacterCard.svelte'
import { buildInitialQueue, getSegmentsForCategory } from '$lib/game/spinQueue'
import type { SpinDefinition, SpinCategory } from '$lib/game/spinQueue'
import { computeOverallScore, scoreTier } from '$lib/game/scoreTier'
import type { TierGrade } from '$lib/game/scoreTier'
// ... content modules ...
```

**DO NOT import from story route:** `$lib/session/store`, `$lib/spinHistory`, any `wof_*` key references.

**State declarations pattern** (`src/routes/+page.svelte` lines 86–108):
```typescript
let showMenu = $state(true)
let currentSession = $state<SessionState>(createSession())
let spinQueue = $state<SpinDefinition[]>(buildInitialQueue())
let currentSpinIndex = $state(0)
let results = $state<SpinResult[]>([])
let showCard = $state(false)
```

**Story-specific view state machine** (from RESEARCH.md Pattern 5):
```typescript
import { loadRoster, loadShards, saveRoster, saveShards } from '$lib/story/store'
import type { StoryRosterEntry } from '$lib/story/types'
import { generateCharacterName } from '$lib/story/naming'
import { getShardValue } from '$lib/story/shards'

let view = $state<'entry' | 'spin' | 'roster' | 'expanded'>('entry')
let roster = $state<StoryRosterEntry[]>([])
let shards = $state(0)
let sortBy = $state<'tier' | 'race' | 'archetype'>('tier')
let expandedId = $state<string | null>(null)
let sellTarget = $state<StoryRosterEntry | null>(null)

let sortedRoster = $derived([...roster].sort((a, b) => {
  if (sortBy === 'tier') return b.overallScore - a.overallScore
  if (sortBy === 'race') return a.race.localeCompare(b.race)
  return a.archetype.localeCompare(b.archetype)
}))
```

**onMount pattern** (`src/routes/+page.svelte` lines 578–602):
```typescript
onMount(() => {
  const saved = loadSession()
  if (saved && saved.completedSpins.length > 0) {
    currentSession = saved
    // ... restore state ...
  } else {
    tutorialStep = localStorage.getItem(TUTORIAL_KEY) ? -1 : 0
  }
})
```

**Story onMount:**
```typescript
onMount(() => {
  roster = loadRoster()
  shards = loadShards()
})
```

**$effect for localStorage persistence** (`src/routes/+page.svelte` lines 1595–1600):
```typescript
$effect(() => {
  if (menuSignal.count > _lastMenuSignal) {
    _lastMenuSignal = menuSignal.count
    handleBackToMenu()
  }
})
```

**Story $effects:**
```typescript
$effect(() => { saveRoster(roster) })
$effect(() => { saveShards(shards) })
```

**saveSession with $state.snapshot** (`src/routes/+page.svelte` lines 1462–1471):
```typescript
saveSession({
  ...currentSession,
  completedSpins: $state.snapshot(results),
  spinQueue: $state.snapshot(spinQueue),
  currentSpinIndex: currentSpinIndex + 1,
  pendingStatBonuses: $state.snapshot(pendingStatBonuses),
} as SessionState)
```

**Apply the same `$state.snapshot()` pattern** when saving story session state mid-spin to localStorage. Proxy objects will not serialize correctly without it.

**Atomic sell handler** (from RESEARCH.md Pattern 7):
```typescript
function handleSell(entry: StoryRosterEntry): void {
  const value = getShardValue(entry.overallTier)
  roster = roster.filter(r => r.id !== entry.id)
  shards += value
  sellTarget = null
}
```

**Expanded card overlay pattern** (`src/routes/+page.svelte` lines 1855–1888 — resume prompt modal):
```svelte
{#if showResumePrompt}
  <div class="fixed inset-0 z-40 flex items-center justify-center px-4"
    style="background: rgba(7,7,13,0.9); backdrop-filter: blur(12px);"
  >
    <div class="obsidian-slab w-full max-w-sm rounded-xl p-7 text-center relative overflow-hidden"
      style="border: 1px solid rgba(240,192,64,0.3);"
    >
      ...
    </div>
  </div>
{/if}
```

**Story expanded overlay:** Use `fixed inset-0 z-50`, `rgba(7,7,13,0.88)` backdrop, `backdrop-filter: blur(8px)`. Click backdrop closes (`expandedId = null`). Panel: `obsidian-slab`, `max-w-[640px]`, `max-h-[90vh] overflow-y-auto`, `rounded-xl`. Stop propagation on inner panel click.

---

### `src/components/story/RosterCard.svelte` (compact card component)

**Analog:** `src/components/TierBadge.svelte` (Svelte 5 runes pattern) + gallery page card markup patterns

**Props pattern** (`src/components/TierBadge.svelte` lines 1–16):
```typescript
<script lang="ts">
  import { tierToCssVar } from '$lib/game/tierColor'
  import type { TierGrade } from '$lib/game/scoreTier'

  let { grade, score, hero = false, displayLabel = undefined }: {
    grade: TierGrade
    score?: number
    hero?: boolean
    displayLabel?: string
  } = $props()

  let bgColor = $derived(tierToCssVar(grade))
  let textColor = $derived(grade === 'God' ? '#1a1a1a' : 'white')
  let label = $derived(normalizeLegacyDisplayLabel(displayLabel) ?? grade)
</script>
```

**RosterCard props to implement:**
```typescript
import TierBadge from '$lib/components/TierBadge.svelte'
import type { StoryRosterEntry } from '$lib/story/types'

let { entry, onExpand, onSell }: {
  entry: StoryRosterEntry
  onExpand: (id: string) => void
  onSell: (entry: StoryRosterEntry) => void
} = $props()
```

**Card styling from UI-SPEC.md:**
- Background: `--color-surface-container-low` (#1b1b24)
- Border resting: `1px solid rgba(255,223,150,0.08)`
- Border hover: `1px solid rgba(240,192,64,0.25)`
- Border-radius: `rounded-lg` (8px)
- Padding: `p-2` (8px)
- Hover lift: `translateY(-2px)` transition 120ms
- TierBadge: inline variant (`hero={false}`), absolute positioned top-right

**Sell button:**
- Class: `metal-stamp-crimson` (defined in app.css lines 225–238)
- Must `stopPropagation` to prevent triggering `onExpand`
- Height: `min-h-[36px]`
- Full card width

**Font pattern** (from `+layout.svelte` lines 149–154 — existing `.nav-label`):
```css
font-family: 'JetBrains Mono', monospace;
font-size: 9px;
letter-spacing: 0.1em;
text-transform: uppercase;
font-weight: 600;
```

**RosterCard uses 14px JetBrains Mono** (elevated from nav's 9px): `text-sm font-mono` for name/race/archetype. Single line with `truncate`.

---

### `src/components/story/SellConfirmModal.svelte` (modal dialog)

**Analog:** Resume prompt overlay in `src/routes/+page.svelte` (lines 1855–1888)

**Backdrop pattern** (from `+page.svelte` lines 1857–1858):
```svelte
<div class="fixed inset-0 z-40 flex items-center justify-center px-4"
  style="background: rgba(7,7,13,0.9); backdrop-filter: blur(12px);"
>
```

**Dialog panel pattern** (from `+page.svelte` lines 1860–1886):
```svelte
<div class="obsidian-slab w-full max-w-sm rounded-xl p-7 text-center relative overflow-hidden"
  style="border: 1px solid rgba(240,192,64,0.3); box-shadow: 0 0 60px rgba(0,0,0,0.9);"
>
  <div class="relative z-10">
    <!-- icon, heading, body copy -->
    <div class="flex gap-3">
      <button onclick={onCancel} ...>Keep Character</button>
      <button onclick={onConfirm} class="metal-stamp-crimson flex-1 ...">Confirm Sell</button>
    </div>
  </div>
</div>
```

**SellConfirmModal props:**
```typescript
import { getShardValue } from '$lib/story/shards'
import type { StoryRosterEntry } from '$lib/story/types'
import TierBadge from '$lib/components/TierBadge.svelte'

let { entry, onConfirm, onCancel }: {
  entry: StoryRosterEntry
  onConfirm: () => void
  onCancel: () => void
} = $props()

let value = $derived(getShardValue(entry.overallTier))
```

**Dialog-specific styling** (from UI-SPEC.md Screen 5):
- Backdrop: `rgba(7,7,13,0.72)` (lighter than character sheet overlay)
- Dialog panel border: `1px solid rgba(255,180,171,0.25)` (destructive red tint)
- Animation: `popIn` keyframe (app.css line 113) — 180ms
- Width: `w-80` (320px), centered
- Padding: `p-6` (24px)
- Warning icon: Material Symbols `warning`, `--color-error` (#ffb4ab)
- "Keep Character" button: ghost style (transparent bg, `1px solid rgba(255,223,150,0.2)`)
- "Confirm Sell" button: `metal-stamp-crimson` class

**Button row pattern** (from resume prompt `+page.svelte` lines 1876–1885):
```svelte
<div class="flex gap-3">
  <button onclick={handleResume}
    class="metal-stamp-gold flex-1 py-2.5 rounded-lg text-sm font-bold"
    style="font-family: 'Cinzel', serif; letter-spacing: 0.1em;"
  >Resume</button>
  <button onclick={handleStartOver}
    class="obsidian-slab flex-1 py-2.5 rounded-lg text-sm font-bold"
    style="font-family: 'Cinzel', serif; color: #9a907b; border: 1px solid #4e4635;"
  >Start Over</button>
</div>
```

---

### `src/lib/story/naming.test.ts`, `store.test.ts`, `shards.test.ts` (unit tests)

**Primary analog:** `src/lib/session/store.test.ts` (localStorage mock + describe/it/expect pattern)

**Test file structure** (`src/lib/session/store.test.ts` lines 1–51):
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { loadSession, saveSession, clearSession, createSession } from './store'

beforeEach(() => {
  const store: Record<string, string> = {}
  globalThis.localStorage = {
    getItem(k: string) { return store[k] ?? null },
    setItem(k: string, v: string) { store[k] = v },
    removeItem(k: string) { delete store[k] },
  } as unknown as Storage
})

describe('loadSession', () => {
  it('returns null when localStorage is empty', () => {
    expect(loadSession()).toBeNull()
  })

  it('returns null for corrupted JSON', () => {
    localStorage.setItem('wof_session', '{"bad json')
    expect(loadSession()).toBeNull()
  })
})

describe('saveSession + loadSession', () => {
  it('round-trip preserves session data', () => {
    const session = createSession()
    saveSession(session)
    const loaded = loadSession()
    expect(loaded?.sessionId).toBe(session.sessionId)
  })
})
```

**Secondary analog for pure-function tests:** `src/lib/game/scoreTier.test.ts` (lines 1–9):
```typescript
import { describe, it, expect } from 'vitest'
import {
  scoreTier,
  gradeToScore,
  computeOverallScore,
  type TierGrade,
  TIER_THRESHOLDS,
} from './scoreTier'
```

**For `store.test.ts`:** Copy the `beforeEach` localStorage mock verbatim from `session/store.test.ts`. Test `loadRoster()` → `[]` on miss/corrupt, `saveRoster + loadRoster` round-trip, `addToRoster()` cap enforcement at 50, `loadShards()` → 0 on miss.

**For `naming.test.ts`:** No localStorage mock needed (pure function). Test determinism (same inputs → same name), different inputs → different names (probabilistically), output is a non-empty string with a space.

**For `shards.test.ts`:** No localStorage mock needed (pure function). Test boundary values: `getShardValue('F-')` === 20, `getShardValue('SS')` === 500, `getShardValue('Absolute+')` === 2000. Also test that all 46 TierGrade values return a number ≥ 20 (no fallback hit).

**Run command:** `npx vitest run src/lib/story/ --reporter=verbose`

---

## Shared Patterns

### Svelte 5 Runes — No Stores
**Source:** `src/routes/+page.svelte` (lines 86–108, 139–168, 193–200)
**Apply to:** `src/routes/story/+page.svelte`, `src/components/story/RosterCard.svelte`, `src/components/story/SellConfirmModal.svelte`

```typescript
// $state for mutable local state
let view = $state<'entry' | 'spin' | 'roster' | 'expanded'>('entry')

// $derived for computed views — no manual sync needed
let sortedRoster = $derived([...roster].sort(...))

// $effect for side effects (localStorage writes, DOM reactions)
$effect(() => { saveRoster(roster) })
```

No Svelte stores (`writable`, `readable`). No `$store` syntax. All state is local runes.

### localStorage Guard Pattern
**Source:** `src/lib/session/store.ts` (lines 13–14, 24–25, 29–30)
**Apply to:** `src/lib/story/store.ts` — every read and write function

```typescript
if (typeof localStorage === 'undefined') return null  // or [] or 0
```

Every `localStorage` access must be guarded. Story route inherits `ssr = false` from root layout, but the guard protects against test environments and edge cases.

### $state.snapshot for localStorage Serialization
**Source:** `src/routes/+page.svelte` (lines 1462–1471)
**Apply to:** `src/routes/story/+page.svelte` when saving story session mid-spin

```typescript
saveSession({
  ...currentSession,
  completedSpins: $state.snapshot(results),
  spinQueue: $state.snapshot(spinQueue),
})
```

Svelte 5 reactive state is a Proxy — `JSON.stringify()` directly on `$state` variables produces `{}`. Always use `$state.snapshot()` before any serialization.

### Utility Classes from app.css
**Source:** `src/app.css` (lines 170–243)
**Apply to:** All new components

| Class | Usage in Story Mode |
|-------|-------------------|
| `obsidian-slab` | Entry screen central card, modal panel content |
| `metal-stamp-gold` | "Enter Story Mode" CTA, "Generate New Character" CTA |
| `metal-stamp-crimson` | Sell button on roster card, "Confirm Sell" in modal |
| `gold-emboss` | "STORY MODE" title on entry screen |
| `noise-overlay` | Texture layer inside `obsidian-slab` cards (must be inside `relative overflow-hidden` parent) |

Keyframes already in app.css:
- `slideInBottom` (line 108) — character sheet overlay entrance (200ms)
- `popIn` (line 113) — sell confirm modal entrance (180ms)

### TierBadge Reuse Pattern
**Source:** `src/components/TierBadge.svelte` (lines 1–31)
**Apply to:** `src/components/story/RosterCard.svelte`, `src/components/story/SellConfirmModal.svelte`

```svelte
<!-- Inline variant (no hero prop) — for roster cards -->
<TierBadge grade={entry.overallTier} />

<!-- Hero variant — for sell dialog tier display -->
<TierBadge grade={entry.overallTier} hero={true} />
```

Do not replicate `--tier-*` CSS variables or the color map. TierBadge handles all 46 grades.

### CharacterCard readonly Pattern
**Source:** `src/components/CharacterCard.svelte` (lines 13–21)
**Apply to:** `src/routes/story/+page.svelte` expanded overlay

```typescript
// CharacterCard prop signature (line 13):
let { results, name = '', startedAt, readonly = false, rivalsWins = 0, onNewCharacter, onBackToMenu }: {
  results: SpinResult[]
  name?: string
  startedAt: string          // REQUIRED — pass entry.sessionStartedAt
  readonly?: boolean
  rivalsWins?: number
  onNewCharacter: () => void  // Required even in readonly mode — pass () => {}
  onBackToMenu?: () => void
} = $props()
```

`onNewCharacter` is currently required (non-optional). Until it's made optional, pass a no-op: `onNewCharacter={() => {}}`. `startedAt` must come from `StoryRosterEntry.sessionStartedAt` (set when the story spin session begins).

### Bottom Nav Active State
**Source:** `src/routes/+layout.svelte` (lines 15–25)
**Apply to:** `src/routes/story/+page.svelte` — the `/story` route does NOT appear in the existing nav. The `activeTab` derived in layout.svelte will not highlight any tab for `/story` (falls through to `'home'`). This is acceptable for Phase 7.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/story/naming.ts` | utility | transform | No seeded PRNG or name-generation module exists in the codebase. Use mulberry32 algorithm from RESEARCH.md Pattern 2. Closest structural analog for file shape: `src/lib/game/random.ts` (pure function, no imports, no default export). |

---

## Critical Implementation Notes

### 1. TierGrade count mismatch in tests
`scoreTier.test.ts` line 145 asserts `TIER_THRESHOLDS` has exactly 42 entries. The actual `scoreTier.ts` union has 46 grades (includes Primordial+, Absolute-, Absolute, Absolute+). `shards.test.ts` must test against all 46 grades, not the 42 in the existing test's `ALL_GRADES` array.

### 2. Roster at cap disables "Generate New Character"
`addToRoster()` returns `null` when at cap. The story page must check `roster.length >= MAX_ROSTER_SIZE` before rendering the "Generate New Character" button as enabled. The button itself should have `disabled` attribute and `cursor-not-allowed opacity-40` when at cap.

### 3. No `+layout.js` in `src/routes/story/`
Do NOT create `src/routes/story/+layout.js`. The root `src/routes/+layout.js` exports `ssr = false` and this is inherited automatically. Adding a layout file that re-enables SSR will cause `ReferenceError: localStorage is not defined`.

### 4. Story spin loop isolation
The spin orchestration inside `view === 'spin'` owns its own Svelte `$state` variables (separate `storySpinQueue`, `storyResults`, `storySpinIndex`, `storySession`). It does not share variables with the main game's session shape. It calls `buildInitialQueue()`, `getSegmentsForCategory()`, `weightedRandom()` directly — same as the main page — but accumulates results into its own local state.

---

## Metadata

**Analog search scope:** `src/routes/`, `src/lib/session/`, `src/lib/game/`, `src/lib/content/`, `src/components/`
**Files scanned:** 18
**Pattern extraction date:** 2026-05-18
