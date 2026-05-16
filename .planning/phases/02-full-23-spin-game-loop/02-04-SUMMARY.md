---
phase: 02-full-23-spin-game-loop
plan: 04
status: complete
completed_at: 2026-05-16
---

# Plan 02-04 Summary — Full Game Loop Orchestrator

## What Was Built

`src/routes/+page.svelte` was completely rewritten from the Phase 1 proof-of-concept into the full production game loop orchestrator.

### Core game loop
- `spinQueue` (`$state<SpinDefinition[]>`) starts with `buildInitialQueue()` (20 fixed entries).
- `currentSpinIndex` advances only when the user clicks Continue/Next Spin — the result overlay persists until dismissed.
- After every spin resolves, `$state.snapshot()` is called before `saveSession()` to prevent Svelte proxy serialization errors (CLAUDE.md rule).
- `spinCounterText` is `$derived` from `spinQueue.length` — updates reactively as ability spins are spliced in.

### Queue splicing logic
- **Race result**: looks up `races.find(r => r.label === resultLabel)`, splices `race.abilitySpinCount` `racialAbility` entries at `currentSpinIndex + 1`. Shows announcement: `"Your race grants N ability spin(s)!"`.
- **Race subtype / transformation**: bonus spin definitions (e.g., `raceSubType`, `raceTransformation`) spliced in for races that benefit from them (Saiyan, Half-Demon, etc.).
- **Archetype result**: same pattern using `archetypes.find(...)` and `archetype.abilitySpinCount` for `archetypeAbility` slots.
- **Weakness**: race's `weaknessProbabilityModifier` used to weight `[0: 10%, 1: 45%, 2: 35%, 3: 10%]` baseline; `weightedRandom` picks count; that many `weakness` entries spliced in. The weakness spin itself does NOT push a result — it splices the actual weakness spins then advances the index.
- **weaponMastery result**: if tier is B+ or above, a `weaponEnchantment` spin is spliced immediately after `weapon`.
- **power** count: high `powerMastery` scores add extra `power` spins (up to 3 extras).

### Score-based stat modifiers
High-tier race/archetype abilities temporarily bias the segments offered for subsequent stat wheels. This was implemented directly in `currentSegments` derived logic rather than via a separate module.

### Result overlay (Continue on top of wheel)
On spin complete, an `absolute inset-0` overlay with `rgba(0,0,0,0.78)` + `backdrop-filter: blur(4px)` appears over the wheel. Shows: tier badge (colored), result label, announcement text (if any), and a gold "Continue" button. The wheel stays mounted beneath. Dismissing the overlay advances `currentSpinIndex`.

### Two-column layout
- LEFT `<aside>` (260px, sticky `height: calc(100vh - 3.5rem)`): "Destiny Log" with tier-colored left-border rows, newest at top.
- RIGHT flex-1: category header + relative wheel container + result overlay sibling.
- Mobile strip (`md:hidden`): compact results below wheel.

### Resume from localStorage
On `onMount`, if `loadSession()` returns a session with `completedSpins.length > 0`, `showResumePrompt` is set. Restores `spinQueue`, `currentSpinIndex`, and `results` from saved session. `handleNewCharacter()` calls `clearSession()` and resets all state.

### Naming screen
Added a character naming screen that appears after all spins complete but before the CharacterCard. User can enter a name (optional); name is passed as prop to CharacterCard and displayed in the hero banner.

## Deviations from Plan

- The weakness sentinel was implemented as a silent splice (no sentinel result pushed) per the plan, but the weakness count spin consumes itself rather than being a separate "sentinel" category — category is just `weakness` throughout, with the first one being the decision point.
- Score-based stat modifiers were added beyond what Plan 02-04 specified — this was done inline rather than waiting for a later plan.
- UI was substantially redesigned per the gold/void mockup provided mid-session; the Tailwind utility classes in the plan spec were replaced with inline styles matching the established design system.

## Files Modified

- `src/routes/+page.svelte` — complete rewrite
