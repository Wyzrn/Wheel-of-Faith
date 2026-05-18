# Phase 6 Context — Polish

**Goal:** Game runs smoothly on mobile, UI is fully responsive, bundle is optimized, and content is seedable.

---

## Decisions

### Mobile Layout (LOCKED)
- **Scope:** Every route — not just the main spin page. All pages must be audited and fixed.
- **Target:** Mobile layout should match the PC layout as closely as possible at 375px.
- **Approach:** Fix every route: `/`, `/characters`, `/gallery`, `/rivals`, `/friends`, `/leaderboard`, `/profile`, `/login`, `/register`, `/character/[shareId]`, `/users/[username]`, `/battle`.
- **Method:** Eliminate horizontal overflow, ensure no elements exceed viewport width, keep visual hierarchy consistent with desktop at narrow widths. Use `overflow-x: hidden` where needed, restructure grid/flex layouts for single-column mobile where the desktop is multi-column.
- **Do not:** Add new breakpoint utility classes that conflict with existing `md:hidden` / `hidden md:flex` patterns. Work within Tailwind 4 + existing inline style patterns.

### Animation Performance (LOCKED)
- **Approach:** `will-change: transform` + `transform: translateZ(0)` on the spinning SVG wheel element to promote it to its own GPU compositor layer.
- **Where:** `SpinWheel.svelte` — the rotating SVG group that GSAP animates.
- **Why:** Prevents browser from repainting the entire page on each animation frame. Measurable improvement on mid-range Android without touching GSAP config.
- **Constraint:** `power4.out` easing is non-negotiable per CLAUDE.md. Do not change GSAP tween configuration.

### Bundle Size (LOCKED)
- **Approach:** Lazy-load content modules (races, weapons, abilities, archetypes, weaknesses) using dynamic imports.
- **Pattern:** Convert `import { WEAPONS } from '$lib/data/weapons'` at module top-level to `const { WEAPONS } = await import('$lib/data/weapons')` inside the function/component that needs it, triggered when the relevant spin wheel mounts or when that data is first needed.
- **Target:** < 2MB total JS bundle. Run `vite build --report` to confirm after changes.
- **Priority order:** Largest files first (races.ts ~259KB, then weapons.ts ~67KB, then abilities).
- **Do not:** Change the data structures or content arrays themselves. Only change how they're imported.

### CONT-08: MongoDB Seeding (LOCKED)
- **Approach:** One-time seed script at `server/scripts/seed.ts`, run via `npm run seed`.
- **What it seeds:** All content arrays that need to be queryable server-side (races, archetypes, if any). Does NOT seed weapons/abilities/weaknesses unless the server needs to query them — those can stay as TS imports if only used on frontend.
- **Safety:** Upsert by slug/id — safe to re-run without duplicating data.
- **Script location:** `server/scripts/seed.ts` with a corresponding npm script `"seed": "tsx scripts/seed.ts"` in `server/package.json`.

---

## Content Minimums (Confirmation Pass)
Phase 6 success criteria requires confirming CONT-01 through CONT-07 minimums are met:
- CONT-01: Powers ≥ 1,000 unique entries
- CONT-02: Weapons ≥ 500
- CONT-03: Weaknesses ≥ 500
- CONT-04: Races ≥ 35 with rarity weights
- CONT-05: Redemption outcomes ≥ 18
- CONT-06: Each tier has ~20 unique labels per stat wheel
- CONT-07: Race-weighted weakness probability modifiers present

Run content count audit as part of Phase 6 verification step.

---

## Routes to Audit for Mobile
All routes must be tested at 375px viewport width:
- `/` — main spin page (118KB, highest priority)
- `/characters` — character list/gallery
- `/gallery` — public gallery with challenge button
- `/rivals` — multiplayer room, matchmaking search
- `/friends` — friends list, requests, add friend
- `/leaderboard` — top 50 table
- `/profile` — own profile
- `/login`, `/register` — auth forms
- `/character/[shareId]` — public character view
- `/users/[username]` — public user profile
- `/battle` — battle result screen

---

## What Was NOT Changed
- GSAP easing (`power4.out`) — locked, do not touch
- Character save flow (single POST at session end) — locked
- scoreTier() as single source of truth — locked
- WebSocket rivals protocol — not in scope for Phase 6
