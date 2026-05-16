# Wheel of Fate — Walking Skeleton

**Phase:** 01 — Animation Foundation
**Produced by:** Plan 01-01 (scaffold) + Plan 01-02 (wheel) + Plan 01-03 (persistence)

This document records the architectural decisions made in Phase 1 that all subsequent
phases build on without renegotiating.

---

## What the Skeleton Proves

After Phase 1 completes, a developer can:

1. Run `npm run dev` and see the game at localhost:5173
2. Click Spin and watch the SVG wheel rotate with `power4.out` deceleration, land precisely
   on a segment, and reveal the result — with the correct easing and no snap correction
3. Reload the page and be offered to resume from the last completed spin
4. Verify on a mobile viewport (375px) that the wheel renders fully and animates without
   dropped frames

These four behaviors validate the entire animation and persistence stack before any
game content, backend, or character logic is added.

---

## Routes

| Route | File | Description |
|-------|------|-------------|
| / | src/routes/+page.svelte | Game screen — single animated wheel, Spin button, history |

No other routes in Phase 1. Phase 2 will add no new routes (game loop stays on /). Phase 4
adds /character/[id]. Phase 5 adds /gallery.

---

## Real Interaction Proven

**The wheel spins and lands correctly.**

This is the core mechanic of the entire product. Every one of the 23 spin categories in
Phase 2 uses the exact same SpinWheel component, the exact same GSAP tween configuration,
and the exact same angle-calculation formula established here. If this mechanic were wrong
(wrong easing, wrong svgOrigin, result read from animation instead of pre-computed), all 23
wheels would need refactoring.

The interaction proves:
- Weighted random result selection runs BEFORE animation starts
- GSAP power4.out tween moves the SVG `<g>` using svgOrigin: "200 200"
- onComplete fires at the pre-computed targetAngle and records the result
- localStorage is written immediately after the spin completes (REVEALED state)

---

## How to Run the Dev Server

```bash
cd "wheel spin game"
npm run dev
```

Open http://localhost:5173

---

## Project Structure (established by skeleton)

```
wheel spin game/
├── src/
│   ├── app.css                        — @import "tailwindcss"; (only line needed for v4)
│   ├── routes/
│   │   ├── +layout.js                 — export const ssr = false (SPA mode, all routes)
│   │   ├── +layout.svelte             — imports app.css, renders children
│   │   └── +page.svelte               — game screen; mounts SpinWheel, wires session store
│   ├── components/
│   │   └── SpinWheel.svelte           — SVG wheel + GSAP animation + state machine
│   └── lib/
│       ├── game/
│       │   ├── geometry.ts            — slicePath, equalSegmentAngles, calculateTargetAngle
│       │   ├── geometry.test.ts       — unit tests for geometry functions
│       │   ├── random.ts              — weightedRandom
│       │   ├── random.test.ts         — unit tests for weightedRandom
│       │   └── spinEngine.ts          — SpinStatus, isValidTransition
│       └── session/
│           ├── types.ts               — WeightedSegment, SpinStatus, SpinResult, SessionState
│           ├── store.ts               — loadSession, saveSession, clearSession, createSession
│           └── store.test.ts          — unit tests for session store
├── vite.config.ts                     — tailwindcss() before sveltekit() in plugins
├── vitest.config.ts                   — jsdom environment, browser conditions
├── svelte.config.js                   — SvelteKit adapter config
└── package.json                       — dependencies listed below
```

---

## Architectural Decisions (locked for all phases)

### Framework: SvelteKit 2 in SPA mode

`src/routes/+layout.js` exports `ssr = false`. This makes the entire app a client-side SPA.
The server sends a minimal HTML shell; Svelte hydrates in the browser. This is required
because GSAP, `localStorage`, and `bind:this` DOM refs are browser-only APIs.

Do NOT set `ssr = false` per-page. It must be in the root layout file so it applies to all
current and future routes.

### Animation: GSAP 3.15.0 with power4.out

The GSAP tween that spins the wheel uses exactly these values — they are not negotiable:
- `rotation: targetAngle` — absolute rotation, always increasing (never reset to 0)
- `ease: 'power4.out'` — the exact GSAP 3 string; GSAP 2 syntax (Power4.easeOut) will fail
- `svgOrigin: '200 200'` — SVG global coordinate space center for a 400x400 viewBox
- `duration: 4` — 4 seconds of spin
- `force3D: true` — request compositor layer explicitly

If any of these change, all 23 wheels in Phase 2 must be updated simultaneously.

### SVG Wheel Geometry

- ViewBox: "0 0 400 400" — the SVG coordinate space
- Center: (200, 200) — matches svgOrigin
- Radius: 180 — leaves 20px margin from center to edge
- Segment 0 starts at 12 o'clock (top/north)
- The -90° offset in slicePath adjusts for SVG's native 0° = east (3 o'clock)
- The `<g bind:this={wheelGroupEl}>` wrapper is the GSAP animation target — all segment
  paths and labels are children of this group

The fixed pointer sits OUTSIDE the `<g>` element so it does not rotate. It points downward
at the 12 o'clock position.

### State Machine

Four states, one-directional:
  IDLE → SPINNING → LANDED → REVEALED → IDLE

State lives in `$state(spinStatus)` in SpinWheel.svelte.
`isValidTransition()` in spinEngine.ts documents the allowed transitions (not enforced at
runtime in Phase 1, but provides the contract for Phase 2's 23-spin sequencer).

### Result-Before-Animation

`weightedRandom(segments)` is called BEFORE `gsap.to()`. The result index is closed over
in the `onComplete` callback. The callback reads the closed-over `resultIndex` — it NEVER
calls `gsap.getProperty(el, 'rotation')` to determine which segment the wheel stopped on.

This is the most important architectural invariant. Violating it causes float-rounding bugs
that are intermittent and hard to reproduce.

### localStorage Persistence

Storage key: `wof_session` (constant in store.ts)
Written: in `handleSpinComplete` callback, after the result is recorded in `currentSession`
Read: in `onMount` of +page.svelte, before render
Structure: `SessionState` type from `$lib/session/types.ts`

All localStorage access is guarded with `typeof localStorage === 'undefined'` inside the
store functions. This prevents SSR/build failures even with ssr=false active.

### CSS: Tailwind v4 via Vite plugin

- `@tailwindcss/vite` plugin in vite.config.ts (listed FIRST, before sveltekit())
- `src/app.css` contains only `@import "tailwindcss";`
- No `postcss.config.js`
- No `tailwind.config.js`
- For custom theme values in later phases: use CSS `@theme` blocks in app.css (v4 syntax)
- For `@apply` in Svelte `<style>` blocks: prefix with `@reference "tailwindcss";`

### Testing: Vitest 4.1.6 with jsdom

All pure logic in `$lib/game/` and `$lib/session/` is unit-tested.
UI components are not unit-tested in Phase 1 (manual smoke tests cover them).
Run: `npx vitest run src/lib/` for the fast check; `npx vitest run` for the full suite.

---

## Packages Installed

| Package | Version | Dev | Purpose |
|---------|---------|-----|---------|
| svelte | 5.55.7 | no | UI framework |
| @sveltejs/kit | 2.60.1 | no | Routing + build |
| gsap | 3.15.0 | no | Wheel animation |
| tailwindcss | 4.3.0 | yes | CSS utilities |
| @tailwindcss/vite | 4.3.0 | yes | Tailwind Vite plugin |
| vite | 8.0.13 | yes | Build tool (via SvelteKit) |
| vitest | 4.1.6 | yes | Unit test runner |
| jsdom | (peer) | yes | DOM environment for tests |

---

## Phase 2 Contract

Phase 2 (Full 23-Spin Game Loop) can start immediately after Phase 1 completes.
It must:
- Import SpinWheel from 'src/components/SpinWheel.svelte' and pass real segment arrays
- Import WeightedSegment, SessionState, SpinResult from '$lib/session/types'
- Import calculateTargetAngle, weightedRandom, slicePath from '$lib/game/'
- Import loadSession, saveSession from '$lib/session/store'
- NOT change ease, svgOrigin, or the GSAP tween configuration
- NOT change the SpinStatus state machine transitions
- NOT change the STORAGE_KEY constant in store.ts (session data from Phase 1 would be lost)
