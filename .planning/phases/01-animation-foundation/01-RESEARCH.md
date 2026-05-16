# Phase 1: Animation Foundation — Research

**Researched:** 2026-05-15
**Domain:** SVG wheel animation with GSAP, Svelte 5 runes, SvelteKit scaffolding, localStorage session persistence
**Confidence:** HIGH (all stack claims verified via Context7 and npm registry; architecture patterns verified via official docs)

---

## Summary

Phase 1 is a walking skeleton: it must scaffold the full SvelteKit project structure AND deliver a working single-wheel animation with correct `power4.out` deceleration and localStorage resume. Everything Phase 2–6 builds on top of this phase — wrong easing, wrong transform architecture, or wrong state design here means refactoring all 23 wheels later.

The three load-bearing decisions are already locked in CLAUDE.md: (1) result must be determined before animation starts, (2) `power4.out` easing only, (3) localStorage after every completed spin. Research confirms these are correct. The remaining open questions are implementation details: exact GSAP SVG setup in Svelte 5's `onMount`/`gsap.context()` pattern, SVG pie geometry math, the landing angle formula, and how to structure the project so game logic lives in `$lib` and is testable separately from components.

The GSAP + SVG + Svelte 5 integration pattern is well-documented. GSAP uses `svgOrigin` (not `transformOrigin`) for SVG element rotation to target the correct center in SVG global coordinate space. `power4.out` is a valid string literal directly in `gsap.to()`. Svelte 5's `onMount` (not `$effect`) is the correct lifecycle hook for GSAP initialization because it runs only once and its returned cleanup function is called on component destroy — matching `gsap.context().revert()` perfectly.

**Primary recommendation:** Scaffold with `npx sv create`, add `@tailwindcss/vite` plugin, install `gsap`, and build the wheel as a single `SpinWheel.svelte` component with all game logic extracted into `src/lib/game/` TypeScript modules. This separation makes the angle calculation and state machine independently testable without mounting components.

---

## Project Constraints (from CLAUDE.md)

| Directive | Enforcement |
|-----------|-------------|
| Result MUST be determined before animation starts | No rotation-to-result mapping in `onComplete`. Weighted random runs first, angle computed second, tween runs third. |
| GSAP `power4.out` ONLY | No CSS transitions, no `ease-in-out`, no `linear`. String literal `"power4.out"` in every `gsap.to()` call. |
| localStorage after every completed spin | Write in `REVEALED` state transition handler, not at session end. |
| Single POST at session end | Backend not in scope for Phase 1. LocalStorage only. |
| `scoreTier()` is single source of truth | Not needed in Phase 1 (no scoring yet), but the function placeholder should exist in `$lib`. |
| Svelte 5 + SvelteKit stack | No React, no Vue, no vanilla JS SPA. |
| GSAP 3.15.0 + SVG | No Canvas, no PixiJS. |
| Tailwind CSS 4 | No plain CSS architecture, no CSS modules as primary styling. |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| SVG wheel rendering | Browser / Client | — | Pure DOM manipulation; no server involvement |
| GSAP tween execution | Browser / Client | — | requestAnimationFrame-based; browser-only API |
| Weighted random result selection | Browser / Client (`$lib/game/`) | — | Pure JS computation; can run anywhere but lives in lib for testability |
| Landing angle calculation | Browser / Client (`$lib/game/`) | — | Pure math function; no DOM access required |
| Spin state machine (IDLE→SPINNING→LANDED→REVEALED) | Browser / Client | — | Reactive `$state` in component or lib module |
| localStorage read/write | Browser / Client (`$lib/session/`) | — | Browser-only API; must be guarded against SSR execution |
| SVG pie slice geometry | Browser / Client (`$lib/game/`) | — | Pure math; computed once at component mount |
| SvelteKit routing (`/`) | Frontend Server (SSR shell) | Browser hydration | SPA mode (ssr=false) renders shell; game runs client-only |

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CORE-01 | User sees animated spinning wheel (SVG segments, GSAP `power4.out` deceleration) that slows and lands on a result | GSAP `gsap.to()` with `rotation`, `svgOrigin`, `ease: "power4.out"`, `onComplete` — fully verified via Context7 `/greensock/gsap-skills` |
| CORE-05 | Session progress saved to localStorage after every spin; resume offered on reload | `onMount` + `localStorage.getItem` on load; `localStorage.setItem` in `REVEALED` handler; resume prompt via `$state` flag |

</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| svelte | 5.55.7 | UI component framework | Runes (`$state`, `$derived`, `$effect`) replace stores; compiled output, no runtime overhead |
| @sveltejs/kit | 2.60.1 | Routing, SSR shell, Vite integration | File-based routing; `ssr=false` option for SPA mode game |
| gsap | 3.15.0 | Wheel rotation animation | `power4.out` easing, `svgOrigin` SVG rotation, `onComplete` callback — exact match for spin mechanic |
| tailwindcss | 4.3.0 | Utility CSS | Vite plugin integration (no PostCSS config file needed in v4) |
| @tailwindcss/vite | 4.3.0 | Tailwind v4 Vite plugin | Replaces PostCSS pipeline; single line in `vite.config.ts` |
| vite | 8.0.13 | Build tool (included via SvelteKit) | HMR, ESM native, zero config with SvelteKit |

**Version verification:** All versions confirmed via npm registry on 2026-05-15. [VERIFIED: npm registry]

### Supporting (for testing)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 4.1.6 | Unit test runner | Testing pure logic in `$lib/game/` (angle calc, weighted random, state transitions) |
| jsdom | (vitest peer) | DOM environment for tests | Required by vitest for browser-API tests |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| GSAP `power4.out` | CSS `cubic-bezier(0.17, 0.67, 0.12, 0.99)` | CSS cannot reliably target an exact final angle; GSAP is authoritative |
| SVG `<g>` rotation via GSAP | Canvas 2D redraw loop | Canvas needs manual per-frame redraw; no benefit for a single pie chart |
| `onMount` + `gsap.context()` | `$effect` + manual tween ref | `onMount` runs once (correct for init); `$effect` re-runs on dependency changes (wrong for one-shot animation init) |
| `@tailwindcss/vite` plugin | PostCSS + `tailwindcss` | v4 Vite plugin eliminates `postcss.config.js` and `autoprefixer` setup entirely |

**Installation:**
```bash
# 1. Scaffold the project
npx sv create wheel-of-fate
# Choose: SvelteKit skeleton, TypeScript yes, add Tailwind CSS (sv CLI supports it), no Playwright yet

cd wheel-of-fate

# 2. If Tailwind not added by sv CLI:
npm install tailwindcss @tailwindcss/vite

# 3. Animation engine
npm install gsap

# 4. Test tooling
npm install -D vitest jsdom
```

---

## Architecture Patterns

### System Architecture Diagram

```
User clicks SPIN button
        │
        ▼
[SpinWheel.svelte]
  spinState: $state("IDLE" | "SPINNING" | "LANDED" | "REVEALED")
        │
        ├─ on SPIN click ──► weightedRandom(segments) ──► resultIndex
        │                         │ [src/lib/game/random.ts]
        │                    calculateTargetAngle(resultIndex, totalSegments, currentRotation)
        │                         │ [src/lib/game/geometry.ts]
        │                    gsap.to(wheelEl, { rotation: targetAngle, ease: "power4.out",
        │                                       svgOrigin: "cx cy", duration: 4,
        │                                       onComplete: → spinState = "LANDED" })
        │                    spinState = "SPINNING"
        │
        ├─ on LANDED ──────► sessionStore.recordSpin(result)
        │                    [src/lib/session/store.ts]
        │                    localStorage.setItem("wof_session", serialize(session))
        │                    500ms delay → spinState = "REVEALED"
        │
        ├─ on REVEALED ─────► [SVG segment highlight + result label animates in]
        │                    [User sees result; Phase 1 complete at this point]
        │
        └─ on page LOAD ───► localStorage.getItem("wof_session")
                              │  if found → $state resumePrompt = true
                              │  user clicks "Resume" → restore session
                              │  user clicks "Start Over" → clear localStorage
                              ▼
                        sessionStore.init() [src/lib/session/store.ts]
```

### Recommended Project Structure
```
src/
├── lib/
│   ├── game/
│   │   ├── geometry.ts        # SVG pie path calculation, landing angle formula
│   │   ├── random.ts          # weightedRandom(), segment selection
│   │   └── spinEngine.ts      # State machine logic (pure, no DOM)
│   └── session/
│       ├── store.ts           # SessionAccumulator shape, localStorage read/write
│       └── types.ts           # SpinResult, SessionState, SpinStatus types
├── routes/
│   ├── +layout.svelte         # Import app.css (Tailwind), global layout
│   ├── +layout.js             # export const ssr = false  (SPA mode)
│   └── +page.svelte           # Main game screen; mounts SpinWheel
└── components/
    └── SpinWheel.svelte       # SVG wheel + GSAP animation; imports $lib/game/*
```

Note on `src/components/` vs colocating in routes: SvelteKit's official guidance is to colocate route-specific components inside the route directory. For Phase 1 (one page), either works. Using `src/components/` is fine since the wheel component will be reused across the 23-spin flow in Phase 2. [CITED: svelte.dev/docs/kit/project-structure]

### Pattern 1: SvelteKit Project Init + Tailwind v4

```bash
# Official scaffold command (sv CLI, not create-svelte)
npx sv create wheel-of-fate
# Interactive: choose SvelteKit, TypeScript, Tailwind CSS option
cd wheel-of-fate && npm install
```

If Tailwind was not added by `sv create`:

```typescript
// vite.config.ts
// Source: https://tailwindcss.com/docs/guides/sveltekit
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    tailwindcss(),   // MUST come before sveltekit()
    sveltekit(),
  ],
});
```

```css
/* src/app.css — the only CSS file needed for Tailwind v4 */
@import "tailwindcss";
```

```svelte
<!-- src/routes/+layout.svelte -->
<script>
  import '../app.css';
  let { children } = $props();
</script>
{@render children()}
```

Tailwind v4 removes the need for `postcss.config.js`, `tailwind.config.js`, or `autoprefixer`. The `@tailwindcss/vite` plugin handles everything. [VERIFIED: tailwindcss.com/docs/guides/sveltekit]

### Pattern 2: SPA Mode (Disable SSR for Game Routes)

GSAP, `localStorage`, and `bind:this` DOM references are browser-only. Disabling SSR prevents server-render errors for the game route.

```javascript
// src/routes/+layout.js
// Source: https://svelte.dev/docs/kit/page-options
export const ssr = false;
export const prerender = false;
```

This makes the entire app a client-side SPA. The server sends a minimal HTML shell; Svelte hydrates in the browser. [CITED: svelte.dev/docs/kit/page-options]

### Pattern 3: GSAP SVG Wheel Animation in Svelte 5

The canonical Svelte + GSAP pattern uses `onMount` (not `$effect`) because:
- `onMount` runs once after mount, its return value is the cleanup function
- `$effect` re-runs when dependencies change — wrong for a one-shot animation initializer
- Official GSAP Skills docs explicitly recommend `onMount` + `gsap.context()` for Svelte

```svelte
<!-- src/components/SpinWheel.svelte -->
<!-- Source: Context7 /greensock/gsap-skills (SKILL.md - Svelte section) -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { gsap } from 'gsap';
  import { calculateTargetAngle } from '$lib/game/geometry';
  import { weightedRandom } from '$lib/game/random';

  let wheelEl: SVGGElement;          // bind:this target
  let currentRotation = $state(0);   // accumulated rotation — NEVER reset to 0
  let spinStatus = $state<'IDLE' | 'SPINNING' | 'LANDED' | 'REVEALED'>('IDLE');
  let activeTween: gsap.core.Tween | null = null;

  const SVG_SIZE = 400;
  const SVG_CENTER = `${SVG_SIZE / 2} ${SVG_SIZE / 2}`;  // "200 200"

  onMount(() => {
    const ctx = gsap.context(() => {
      // No animations here — wheel starts static
    }, wheelEl);

    return () => ctx.revert(); // cleanup on component destroy
  });

  function handleSpin() {
    if (spinStatus !== 'IDLE') return;

    // 1. Determine result BEFORE animation starts (CLAUDE.md rule #1)
    const resultIndex = weightedRandom(segments);

    // 2. Calculate exact target rotation
    const targetAngle = calculateTargetAngle(
      currentRotation,
      resultIndex,
      segments.length,
      5  // minSpins for drama
    );

    spinStatus = 'SPINNING';

    // 3. Run GSAP tween toward pre-determined target
    activeTween = gsap.to(wheelEl, {
      rotation: targetAngle,
      duration: 4,
      ease: 'power4.out',   // CLAUDE.md rule #5 — this string is correct in GSAP 3.x
      svgOrigin: SVG_CENTER, // global SVG coordinate space, not element-local
      onComplete: () => {
        currentRotation = targetAngle;  // persist for next spin's delta calculation
        spinStatus = 'LANDED';
        recordResult(resultIndex);      // writes localStorage
        // 500ms beat before reveal
        setTimeout(() => { spinStatus = 'REVEALED'; }, 500);
      }
    });
  }
</script>

<svg width={SVG_SIZE} height={SVG_SIZE} viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}>
  <g bind:this={wheelEl}>
    <!-- Pie slice <path> elements rendered here -->
  </g>
  <!-- Fixed pointer sits OUTSIDE the <g> so it doesn't rotate -->
</svg>

<button onclick={handleSpin} disabled={spinStatus !== 'IDLE'}>
  {spinStatus === 'IDLE' ? 'Spin' : spinStatus}
</button>
```

Key implementation details:
- `bind:this={wheelEl}` gives GSAP a direct DOM reference — avoids string selectors that can fail if multiple wheel instances exist
- `svgOrigin: "200 200"` uses SVG global coordinate space (center of a 400×400 SVG) — **NOT** `transformOrigin: "50% 50%"` which behaves differently on SVG elements
- `currentRotation` accumulates — the next spin's `targetAngle` is computed as `currentRotation + delta + fullSpins`. Never reset to 0 or GSAP may animate backwards.
- The `onComplete` callback is the ONLY place state transitions to `LANDED`. Never read `gsap.getProperty(wheelEl, "rotation")` to determine the result.

[VERIFIED: Context7 /greensock/gsap-skills — svgOrigin, power4.out, Svelte onMount pattern]

### Pattern 4: SVG Pie Slice Geometry

```typescript
// src/lib/game/geometry.ts
// Source: Standard SVG arc mathematics — [ASSUMED: training knowledge, unverified against specific reference]
// Core formula is standard trigonometry; the path command structure is from SVG spec

export interface Segment {
  label: string;
  weight: number;  // relative weight for weighted random
}

/**
 * Convert an angle in degrees to radians.
 */
function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Build the SVG <path> d attribute for one pie slice.
 * Angles are measured clockwise from 12 o'clock (top/north = 0°).
 *
 * @param cx        - SVG center X
 * @param cy        - SVG center Y
 * @param r         - Wheel radius
 * @param startDeg  - Slice start angle in degrees (0 = top)
 * @param endDeg    - Slice end angle in degrees
 */
export function slicePath(
  cx: number, cy: number, r: number,
  startDeg: number, endDeg: number
): string {
  // SVG's coordinate system has 0° at 3 o'clock (east), going clockwise.
  // We define 0° at 12 o'clock (top), so subtract 90°.
  const startRad = toRad(startDeg - 90);
  const endRad   = toRad(endDeg - 90);

  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);

  // large-arc-flag: 1 if slice spans more than 180°
  const largeArc = (endDeg - startDeg) > 180 ? 1 : 0;

  // M = move to center, L = line to arc start, A = arc to arc end, Z = close
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

/**
 * Build angle data for N segments of equal size.
 * Returns array of { startDeg, endDeg, midDeg } for each segment.
 */
export function equalSegmentAngles(count: number) {
  const size = 360 / count;
  return Array.from({ length: count }, (_, i) => ({
    startDeg: i * size,
    endDeg:   (i + 1) * size,
    midDeg:   i * size + size / 2,
  }));
}

/**
 * Calculate the rotation angle GSAP should tween to so that segment
 * `targetIndex` ends up under the pointer (fixed at top = 0°).
 *
 * The wheel rotates clockwise. The pointer is at 12 o'clock.
 * Segment 0 starts at 0° (top). Segment i's center is at (i * segSize + segSize/2)°.
 *
 * To land segment i under the pointer, the wheel must rotate so that
 * the segment's center aligns with 0° (top). Since the wheel rotates CW,
 * we need to rotate FORWARD by (360 - segCenter) degrees, then add full
 * rotations for drama.
 *
 * Always add to currentRotation to prevent backward animation.
 */
export function calculateTargetAngle(
  currentRotation: number,
  targetIndex: number,
  totalSegments: number,
  minSpins: number = 5
): number {
  const segmentSize = 360 / totalSegments;
  const segmentCenter = targetIndex * segmentSize + segmentSize / 2;

  // Where does the pointer sit relative to the current wheel face?
  const currentMod = currentRotation % 360;
  // How many more degrees CW to reach the segment center at top?
  const delta = ((360 - segmentCenter) - currentMod + 360) % 360;
  // Full rotations for visual drama + the delta to land precisely
  const fullRotations = minSpins * 360;

  return currentRotation + fullRotations + delta;
}
```

**Critical geometry note:** The `- 90` adjustment is mandatory. SVG's default coordinate system places 0° at the right (east), going clockwise. If you want 0° at the top (north), you subtract 90° before converting to radians. Forgetting this shifts all segment labels by a quarter turn. [ASSUMED: standard SVG math — verified by reasoning from SVG spec coordinate system definition, not by running test]

### Pattern 5: Weighted Random Selection

```typescript
// src/lib/game/random.ts
export interface WeightedItem {
  label: string;
  weight: number;
}

/**
 * Returns the index of the selected item using weighted random selection.
 * Called BEFORE animation starts.
 */
export function weightedRandom(items: WeightedItem[]): number {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= items[i].weight;
    if (roll <= 0) return i;
  }
  return items.length - 1; // fallback for floating-point edge case
}
```

[ASSUMED: standard weighted random algorithm — well-known pattern, no verification needed]

### Pattern 6: LocalStorage Session Persistence

```typescript
// src/lib/session/store.ts
export interface SpinResult {
  step: number;
  category: string;
  resultLabel: string;
  resultIndex: number;
}

export interface SessionState {
  sessionId: string;
  startedAt: string;   // ISO timestamp
  completedSpins: SpinResult[];
}

const STORAGE_KEY = 'wof_session';

export function loadSession(): SessionState | null {
  // Guard: localStorage is not available on server
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionState;
  } catch {
    return null;  // corrupted data — treat as no session
  }
}

export function saveSession(session: SessionState): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

export function createSession(): SessionState {
  return {
    sessionId: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    completedSpins: [],
  };
}
```

The `typeof localStorage === 'undefined'` guard is required even with `ssr=false` in `+layout.js` because Svelte still imports and parses `$lib` modules in the build step. The guard is belt-and-suspenders. [CITED: svelte.dev/docs/svelte/legacy-reactive-assignments — browser guard pattern]

**Resume flow on page load:**

```svelte
<!-- In +page.svelte or SpinWheel.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { loadSession, clearSession, createSession } from '$lib/session/store';

  let existingSession = $state<SessionState | null>(null);
  let showResumePrompt = $state(false);

  onMount(() => {
    const saved = loadSession();
    if (saved && saved.completedSpins.length > 0) {
      existingSession = saved;
      showResumePrompt = true;
    }
  });

  function resumeSession() {
    // Restore wheel to last completed state
    // (Phase 1: single wheel, so this means showing the last spin result)
    showResumePrompt = false;
  }

  function startFresh() {
    clearSession();
    existingSession = null;
    showResumePrompt = false;
  }
</script>

{#if showResumePrompt}
  <div>
    <p>You have an in-progress session. Resume?</p>
    <button onclick={resumeSession}>Resume</button>
    <button onclick={startFresh}>Start Over</button>
  </div>
{/if}
```

### Anti-Patterns to Avoid

- **Reading rotation after `onComplete` to determine result:** GSAP's `onComplete` fires when the tween reaches its final value, but floating-point rotation math makes reading back `gsap.getProperty(el, "rotation")` unreliable for segment determination. Always use the pre-computed `resultIndex`.
- **Using `$effect` to initialize GSAP:** `$effect` re-runs when reactive dependencies change, causing GSAP to create new tweens on state updates. Use `onMount` for one-shot GSAP initialization.
- **Resetting `currentRotation` to 0 between spins:** GSAP interpolates from the last known rotation value. Resetting causes a backward snap on the next spin. Always accumulate.
- **Setting `transformOrigin` instead of `svgOrigin` on SVG elements:** `transformOrigin` works differently on SVG vs HTML elements across browsers. `svgOrigin` uses SVG global coordinate space and is browser-consistent.
- **Calling `localStorage` outside `onMount` or without the `typeof` guard:** Causes SSR/build-time failures even with `ssr=false`.
- **Tailwind `@apply` in Svelte `<style>` blocks without `@reference`:** Tailwind v4 requires `@reference "tailwindcss";` at the top of any `<style>` block that uses `@apply`. [VERIFIED: tailwindcss.com/docs/guides/sveltekit]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Smooth deceleration to exact angle | Custom `requestAnimationFrame` loop with manual easing | `gsap.to()` with `ease: "power4.out"` | GSAP handles floating-point precision, cross-browser rAF, and `onComplete` timing correctly |
| SVG element rotation with correct origin | Setting `style="transform-origin: ..."` on `<g>` | `gsap.to(el, { rotation, svgOrigin })` | Browser behavior of CSS `transform-origin` on SVG is inconsistent; GSAP's `svgOrigin` is spec-correct |
| Short unique session IDs | Manual `Date.now()` or counter | `crypto.randomUUID()` | Built-in, collision-free, available in all modern browsers without a dependency |
| Scroll-safe mobile viewport | Manual viewport meta tag | SvelteKit's `app.html` template + Tailwind `overflow-hidden` | SvelteKit scaffolds the meta tag; Tailwind handles layout containment |

---

## Common Pitfalls

### Pitfall 1: `svgOrigin` Uses SVG Global Coordinates, Not Element-Local
**What goes wrong:** Developer passes `svgOrigin: "50% 50%"` (percentage) or `svgOrigin: "0 0"` (element origin). The wheel rotates around the wrong point, visually spinning off-center.
**Why it happens:** HTML developers expect `transformOrigin: "50% 50%"` to mean "element center." In SVG, coordinates are in the SVG canvas's global space.
**How to avoid:** Always use pixel values equal to the SVG center: for a `viewBox="0 0 400 400"` wheel, use `svgOrigin: "200 200"`. Define this as a constant.
**Warning signs:** Wheel visually translates (moves) while rotating instead of spinning in place.

### Pitfall 2: `power4.out` Must Be the String Literal
**What goes wrong:** Developer writes `ease: Power4.easeOut` (GSAP 2.x syntax) or `ease: gsap.parseEase("power4.out")`.
**Why it happens:** Old tutorials use GSAP 2 syntax. GSAP 3 uses lowercase strings.
**How to avoid:** In GSAP 3.x, the correct string is `"power4.out"`. `"power4"` alone defaults to `.out`. Both work. [VERIFIED: Context7 /llmstxt/gsap_llms_txt — "Use string identifiers for eases"]
**Warning signs:** TypeScript shows `Power4 is not defined`; animation falls back to default ease.

### Pitfall 3: `$effect` vs `onMount` for GSAP Init
**What goes wrong:** Developer uses `$effect(() => { gsap.to(wheelEl, {...}); })`. Every time any reactive state changes, GSAP spawns a new tween. The wheel starts re-animating on unrelated state updates.
**Why it happens:** `$effect` is the Svelte 5 equivalent of "run this when state changes." For GSAP init, that's exactly wrong.
**How to avoid:** Use `onMount(() => { const ctx = gsap.context(..., el); return () => ctx.revert(); })`. Note: Svelte 5 docs say `onMount` still works in runes mode — it is NOT deprecated, only the old `onDestroy` companion is replaced by returning a cleanup function from `onMount`.
**Warning signs:** Wheel animates unexpectedly when the spin button UI updates; multiple simultaneous tweens visible.

### Pitfall 4: Svelte 5 Runes Mode and `onMount` Compatibility
**What goes wrong:** A search result or old blog post says "`onMount` cannot be used in runes mode." Developer switches to `$effect` for GSAP.
**Why it happens:** Svelte 5 migration docs warn that `onDestroy` is no longer available separately — but `onMount` IS still valid in runes mode. The warning is specifically about `onDestroy` and legacy stores, not `onMount`.
**How to avoid:** The Svelte 5 docs (verified via Context7 `/websites/svelte_dev_svelte`) explicitly show `onMount` usage alongside runes. Use `onMount` for GSAP. [VERIFIED: Context7 /websites/svelte_dev_svelte — onMount API]

### Pitfall 5: Tailwind v4 — No `tailwind.config.js` Expected
**What goes wrong:** Developer creates `tailwind.config.js` (v3 pattern). Some styles don't apply. The `content` array in config does nothing.
**Why it happens:** Tailwind v4 uses automatic content detection via the Vite plugin. The config file is not needed and its `content` array is ignored.
**How to avoid:** For standard projects: only `@import "tailwindcss";` in `app.css` and the Vite plugin. For custom config (theme extensions, etc.), Tailwind v4 uses CSS `@theme` blocks inside the CSS file, not a JS config. [VERIFIED: tailwindcss.com/docs/guides/sveltekit]

### Pitfall 6: `ssr=false` Scope
**What goes wrong:** Developer sets `ssr=false` in `+page.js` for the game page only, but the `+layout.svelte` imports `app.css` which triggers a CSS parse on the server, and a GSAP import somewhere in `$lib` causes a SSR error.
**Why it happens:** `ssr=false` on a page prevents the page from rendering on the server, but it doesn't prevent the build process from analyzing imports.
**How to avoid:** Set `ssr=false` in `+layout.js` (the root layout) so the guard applies to ALL routes. All game logic in `$lib` should avoid top-level browser API calls (use `typeof localStorage === 'undefined'` guards).

### Pitfall 7: Accumulated Rotation Precision Drift
**What goes wrong:** After 20+ spins in Phase 2 playtesting, `currentRotation` is a large number like `37,521.34`. Floating-point `% 360` yields slightly wrong modular values, causing the landing position to be off by a fraction of a degree.
**Why it happens:** JavaScript floats lose precision at large magnitudes.
**How to avoid:** Cap `currentRotation` periodically: after each spin, subtract `Math.floor(currentRotation / 360) * 360` (full turns already completed) while preserving the remainder. Or: store the net rotation as the remainder only, and always add `minSpins * 360 + delta` fresh. The ARCHITECTURE.md pattern of `currentRotation + fullRotations + delta` is safe for Phase 1's single spin; add normalization before Phase 2.

---

## Code Examples

### Full Working Angle Calculation
```typescript
// Source: Derived from ARCHITECTURE.md + SVG spec coordinate system [ASSUMED on the -90 offset derivation]
function calculateTargetAngle(
  currentRotation: number,  // accumulated, never reset
  targetIndex: number,      // 0-based segment index
  totalSegments: number,
  minSpins: number = 5
): number {
  const segmentSize = 360 / totalSegments;
  const segmentCenter = targetIndex * segmentSize + segmentSize / 2;
  const currentMod = currentRotation % 360;
  const delta = ((360 - segmentCenter) - currentMod + 360) % 360;
  return currentRotation + (minSpins * 360) + delta;
}

// Example: 8 segments, targeting index 3, currentRotation=0
// segmentSize = 45°
// segmentCenter = 3*45 + 22.5 = 157.5°
// delta = (360 - 157.5 - 0 + 360) % 360 = 202.5°
// targetAngle = 0 + 1800 + 202.5 = 2002.5°
// → wheel completes 5 full turns and stops with segment 3 at top
```

### GSAP Tween Pattern (verified)
```javascript
// Source: Context7 /greensock/gsap-skills (CSS plugin, svgOrigin)
// Source: Context7 /llmstxt/gsap_llms_txt (Svelte onMount pattern)
gsap.to(wheelEl, {
  rotation: targetAngle,       // absolute target, not relative +=
  duration: 4,
  ease: 'power4.out',          // GSAP 3 string syntax; fast start, hard decel
  svgOrigin: '200 200',        // center of 400x400 SVG in global SVG coordinates
  force3D: true,               // explicitly request compositor layer (optional, GSAP defaults to "auto")
  onComplete: () => {
    // result was determined before tween started — just update state here
    spinStatus = 'LANDED';
  }
});
```

### Svelte 5 `$state` + Type Union for Spin Status
```typescript
// Source: Context7 /sveltejs/svelte ($state rune docs)
type SpinStatus = 'IDLE' | 'SPINNING' | 'LANDED' | 'REVEALED';
let spinStatus = $state<SpinStatus>('IDLE');

// Derived values (no $effect needed for simple computations)
let canSpin = $derived(spinStatus === 'IDLE');
let isAnimating = $derived(spinStatus === 'SPINNING');
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `Power4.easeOut` (GSAP 2 class syntax) | `"power4.out"` string | GSAP 3.0 (2019) | Import not required; string is lighter |
| `create-svelte` scaffold CLI | `npx sv create` (sv CLI) | SvelteKit 2 / 2024 | Unified CLI; supports `sv add tailwindcss` |
| PostCSS-based Tailwind install | `@tailwindcss/vite` Vite plugin | Tailwind v4 (2025) | No `postcss.config.js`; no `tailwind.config.js` |
| `onDestroy` for GSAP cleanup | Return cleanup from `onMount` | Svelte 5 runes mode | `onMount` return value replaces `onDestroy` |
| `transformOrigin` on SVG | `svgOrigin` | GSAP 1.x+ | `svgOrigin` is the SVG-correct API |
| `$:` reactive statements | `$derived` / `$effect` runes | Svelte 5 | Runes are explicit, TypeScript-safe, location-independent |

**Deprecated/outdated:**
- `Power2.easeOut`, `Back.easeOut` etc.: GSAP 2 class-based syntax. Use `"power2.out"`, `"back.out(1.7)"`.
- `create-svelte` npm package: Still works but `npx sv create` is the current official CLI.
- Tailwind `content` array in `tailwind.config.js`: No-op in v4. Use CSS `@theme` for customization.
- `onDestroy` from Svelte: Replaced by returning a cleanup function from `onMount` in runes mode.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `- 90` offset in `slicePath()` correctly aligns segment 0 to the top of the wheel | Pattern 4: SVG Pie Geometry | Segment labels would be rotated 90° from expected; visible immediately in dev, easy fix |
| A2 | `calculateTargetAngle` formula correctly lands the target segment under the pointer for clockwise rotation | Pattern 4 / Code Examples | Wheel lands on adjacent segment; detectable in first smoke test |
| A3 | `weightedRandom` floating-point fallback edge case never visibly misselects in practice | Pattern 5 | Extremely rare misselection (< 1 in 10^15); negligible |
| A4 | `crypto.randomUUID()` is available in the target browser environments without polyfill | Pattern 6: localStorage | Fails in very old browsers; target audience on modern mobile/desktop — low risk |

---

## Open Questions

1. **Segment count for Phase 1 prototype wheel**
   - What we know: Phase 1 uses a single test wheel with placeholder segments
   - What's unclear: How many segments for the demo wheel? Equal weights? The architecture is the same regardless.
   - Recommendation: Use 8 equal segments for the Phase 1 demo. Weighted segments will be tested in Phase 2.

2. **Pointer position: top (12 o'clock) vs. right (3 o'clock)**
   - What we know: The landing angle formula assumes pointer at top (0° = north)
   - What's unclear: Design hasn't specified pointer position
   - Recommendation: Default to top (12 o'clock). The angle formula's `(360 - segmentCenter)` term implements this. To move pointer to 3 o'clock, change to `(360 - segmentCenter + 90)`.

3. **Reveal animation: segment highlight vs. text label animation**
   - What we know: REVEALED state should "animate the result in"
   - What's unclear: Exact visual — does the winning segment pulse, glow, or does a text label slide in?
   - Recommendation: Phase 1 minimum: change the winning segment's fill color and opacity-animate a text result label. Full reveal choreography is Phase 2 polish.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | SvelteKit build | ✓ | 20.19.2 | — |
| npm | Package install | ✓ | 10.8.2 | — |
| npx / sv CLI | Project scaffold | ✓ | Via npx | — |
| Browser (Chrome/Safari/Firefox) | GSAP animation | ✓ | Modern | — |

No external services required for Phase 1. All work is local browser + filesystem.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.6 |
| Config file | `vite.config.ts` (test section) or `vitest.config.ts` — Wave 0 creates it |
| Quick run command | `npx vitest run src/lib/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CORE-01 | `calculateTargetAngle` returns a value > `currentRotation` with correct modular remainder | unit | `npx vitest run src/lib/game/geometry.test.ts -t "calculateTargetAngle"` | ❌ Wave 0 |
| CORE-01 | `weightedRandom` always returns a valid index (0..N-1) over 10,000 calls | unit | `npx vitest run src/lib/game/random.test.ts -t "weightedRandom"` | ❌ Wave 0 |
| CORE-01 | `slicePath` returns a non-empty string for valid inputs; large-arc-flag is `1` for slices > 180° | unit | `npx vitest run src/lib/game/geometry.test.ts -t "slicePath"` | ❌ Wave 0 |
| CORE-01 | Spin button is disabled while `spinStatus !== 'IDLE'` (prevents double-spin) | smoke (manual) | Visual check in dev browser | manual |
| CORE-01 | Wheel visibly decelerates and lands precisely on expected segment | smoke (manual) | Open `localhost:5173`, click Spin, observe | manual |
| CORE-05 | `loadSession` returns `null` when localStorage is empty | unit | `npx vitest run src/lib/session/store.test.ts -t "loadSession returns null"` | ❌ Wave 0 |
| CORE-05 | `saveSession` + `loadSession` round-trip preserves all fields | unit | `npx vitest run src/lib/session/store.test.ts -t "round-trip"` | ❌ Wave 0 |
| CORE-05 | Resume prompt appears on page load if saved session exists | smoke (manual) | Spin once, reload `localhost:5173`, verify prompt | manual |
| CORE-05 | "Start Over" clears localStorage and hides prompt | smoke (manual) | After resume prompt, click Start Over, verify no session key | manual |

### Manual Smoke Test Protocol (Phase Gate)

Before `/gsd-verify-work`, perform this sequence in browser devtools:

1. **Easing check:** Open DevTools Performance tab. Click Spin. Confirm animation frames show no "Layout" entries during spin — only Paint/Composite.
2. **Landing precision check:** Inspect `localStorage.getItem('wof_session')` after a spin. Verify `completedSpins[0].resultIndex` matches the segment visually under the pointer.
3. **Accumulation check:** Spin 3 times without reload. Open console, run `gsap.getProperty(wheelEl, "rotation")`. Verify value is monotonically increasing (never decreases between spins).
4. **Resume check:** Spin once. Reload page. Verify resume prompt appears with correct prior result. Click "Start Over". Verify `wof_session` key absent from localStorage.
5. **Mobile check:** Open Chrome DevTools, select a mid-range Android device profile (e.g., Moto G4), enable 4× CPU throttle. Spin. Verify no visible frame drops.

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green + all 5 manual smoke tests pass before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/game/geometry.test.ts` — covers `slicePath` and `calculateTargetAngle` (CORE-01)
- [ ] `src/lib/game/random.test.ts` — covers `weightedRandom` (CORE-01)
- [ ] `src/lib/session/store.test.ts` — covers `loadSession`, `saveSession`, `clearSession` (CORE-05)
- [ ] `vitest.config.ts` or test section in `vite.config.ts` — with `environment: 'jsdom'` and `resolve: { conditions: ['browser'] }`

---

## Security Domain

> `security_enforcement` not set to `false` in config — section included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth in Phase 1 or v1 |
| V3 Session Management | Partial | localStorage session; no server tokens; no sensitive data |
| V4 Access Control | No | Single-page, no routes to protect in Phase 1 |
| V5 Input Validation | Minimal | No user text input in Phase 1; only button clicks |
| V6 Cryptography | No | `crypto.randomUUID()` for session ID only; no encryption needed |

### Known Threat Patterns for Phase 1 Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| localStorage tampering (user modifies `wof_session`) | Tampering | Validate structure on `loadSession`; wrap in try/catch; corrupted data treated as no session |
| XSS injection via SVG label text | Tampering | Svelte 5 auto-escapes text interpolations in templates; never use `{@html}` for segment labels |
| Prototype pollution via `JSON.parse` | Tampering | The session JSON structure is typed; use `as SessionState` cast with runtime field check |

Phase 1 has minimal attack surface: no user text input, no network requests, no auth tokens. The only sensitive operation is localStorage read/write, which is guarded by try/catch.

---

## Sources

### Primary (HIGH confidence)
- Context7 `/greensock/gsap-skills` — `svgOrigin`, `power4.out` string syntax, Svelte `onMount` + `gsap.context()` pattern, `onComplete` callback, `force3D`
- Context7 `/llmstxt/gsap_llms_txt` — `svgOrigin` API docs, `gsap.getProperty`, ease string format, `+=` rotation accumulation
- Context7 `/websites/svelte_dev_svelte` — `$state`, `$derived`, `$effect`, `bind:this`, `onMount`, SvelteKit routing, `ssr=false` page option, `$lib` project structure
- Context7 `/sveltejs/svelte` — `$state` rune class pattern, `$derived.by`, `$state.raw`
- `tailwindcss.com/docs/guides/sveltekit` — Tailwind v4 `@tailwindcss/vite` plugin, no `postcss.config.js`, `@reference` for `@apply` in Svelte style blocks [VERIFIED: WebFetch on 2026-05-15]
- npm registry — all package versions verified on 2026-05-15

### Secondary (MEDIUM confidence)
- `svelte.dev/docs/kit/project-structure` — directory layout, `$lib` alias, `src/lib/server` separation [VERIFIED: WebFetch]
- `svelte.dev/docs/kit/page-options` — `ssr=false` pattern confirmed via WebSearch + official docs URL

### Tertiary (LOW confidence)
- WebSearch: GSAP rotation accumulation forum discussions (gsap.com/community) — corroborates `+=` pattern but not primary source

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions npm-verified; APIs verified via Context7
- Architecture: HIGH — patterns from official GSAP Skills + Svelte docs; one ASSUMED item (SVG -90° offset, low risk)
- Pitfalls: HIGH — engineering pitfalls from PITFALLS.md (prior research) confirmed by this research
- SVG geometry: MEDIUM — standard math, but exact formula not verified against a running test (Wave 0 tests will validate)

**Research date:** 2026-05-15
**Valid until:** 2026-06-15 (stable stack; GSAP and Svelte 5 APIs are stable)
