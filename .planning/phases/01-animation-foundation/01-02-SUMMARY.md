---
phase: 1
plan: 2
subsystem: frontend/animation
tags: [svelte5, gsap, svg, animation, state-machine]
dependency_graph:
  requires: [01-plan-01]
  provides: [SpinWheel-component, demo-game-screen]
  affects: [src/routes/+page.svelte]
tech_stack:
  added: []
  patterns: [gsap-power4-out, svelte5-runes, svg-pie-segments, state-machine]
key_files:
  created:
    - src/components/SpinWheel.svelte
  modified:
    - src/routes/+page.svelte
decisions:
  - "svgOrigin set to '200 200' pixel string (not '50% 50%') per GSAP SVG rotation requirement"
  - "onMount used for GSAP context initialization (not $effect) per Svelte 5 runes guidance"
  - "resultIndex determined by weightedRandom() before gsap.to() — result never read from DOM"
  - "currentRotation accumulates monotonically so each spin's targetAngle grows from prior rotation"
metrics:
  duration_minutes: 10
  completed_date: "2026-05-16"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 1 Plan 2: SVG Wheel Component + GSAP Animation Summary

## One-liner

SVG pie wheel with GSAP power4.out rotation tween, four-state machine (IDLE/SPINNING/LANDED/REVEALED), and pre-computed weighted-random result before animation starts.

## What Was Built

### SpinWheel.svelte — Component Structure

**File:** `src/components/SpinWheel.svelte`

Props (Svelte 5 `$props()`):
- `segments: WeightedSegment[]` — wheel slice data with label, weight, optional color
- `onSpinComplete: (resultIndex: number, resultLabel: string) => void` — callback for Wave 3 accumulator

Reactive state (`$state`):
- `spinStatus: SpinStatus` — IDLE | SPINNING | LANDED | REVEALED
- `currentRotation: number` — accumulated total rotation, never reset to 0
- `lastResult: { index, label } | null` — set in GSAP onComplete

Derived (`$derived`):
- `canSpin` — true only when IDLE
- `isRevealed` — true only when REVEALED
- `segmentAngles` — computed from `equalSegmentAngles(segments.length)`

GSAP integration:
- `onMount` initializes `gsap.context()` scoped to `wheelGroupEl` (`<g>` element via `bind:this`)
- `handleSpin()` calls `weightedRandom(segments)` first, then `calculateTargetAngle()`, then `gsap.to()`
- `svgOrigin: '200 200'` (pixel coordinates in SVG global space)
- `ease: 'power4.out'`
- `duration: 4`, `force3D: true`

SVG structure:
- Outer `<svg>` 400×400, `viewBox="0 0 400 400"`, `class="w-full"` for responsive scaling
- `<g bind:this={wheelGroupEl}>` — GSAP rotates this element
- One `<path>` per segment using `slicePath()` + one `<text>` label per segment at 65% radius
- Winning segment: `stroke="gold"` `stroke-width="4"` when `isRevealed && lastResult?.index === i`
- Fixed `<polygon>` pointer at 12 o'clock OUTSIDE the `<g>` (does not rotate)

Button states:
- Text shows `spinStatus` string while not IDLE
- Disabled (`opacity-40`, `cursor-not-allowed`) when `spinStatus !== 'IDLE'`

### +page.svelte — Demo Game Screen

8 demo segments (equal weight 1, distinct colors):

| Label  | Color     |
|--------|-----------|
| Fire   | `#E63946` |
| Water  | `#457B9D` |
| Earth  | `#2A9D8F` |
| Air    | `#E9C46A` |
| Shadow | `#264653` |
| Light  | `#F4A261` |
| Void   | `#6A0572` |
| Storm  | `#0077B6` |

Spin history list below the wheel shows each spin's result label and segment index — useful for verifying monotonic rotation accumulation across multiple spins.

## Verification Results

- `npm run build` — completed with zero TypeScript errors, zero warnings
- `npm run dev` — Vite ready in 440ms, no HMR errors
- Source constraint checks:
  - `svgOrigin: SVG_CENTER` where `SVG_CENTER = '200 200'` — confirmed
  - `ease: 'power4.out'` — exact string confirmed
  - `$effect` hits in SpinWheel.svelte — 0
  - `weightedRandom()` at source line 39, `gsap.to()` at line 44 — result before animation confirmed
  - `bind:this={wheelGroupEl}` on `<g>` — confirmed
  - `onMount` used for GSAP context — confirmed

## Deviations from Plan

None — plan executed exactly as written. The SVG attribute duplication issue mentioned in the plan (duplicate stroke / stroke-width) was avoided by writing each attribute exactly once with a conditional expression, as specified.

## Known Stubs

None — this plan is a self-contained animation proof-of-concept. `onSpinComplete` callback is intentionally minimal (only accumulates to `spinHistory`); Wave 3 will extend it to persist to localStorage.

## Threat Flags

None — no network endpoints, auth paths, or trust boundary changes introduced. All logic runs client-side.

## Self-Check

- [x] `src/components/SpinWheel.svelte` — created
- [x] `src/routes/+page.svelte` — updated
- [x] Commit `9a9306e` exists: "feat: SpinWheel SVG component + GSAP animation (Phase 1 Wave 2)"
- [x] `npm run build` — zero errors
