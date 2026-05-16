# Research Summary — Wheel of Fate

**Domain:** Browser-based animated sequential wheel spin character creation game
**Researched:** 2026-05-15
**Confidence:** HIGH (stack, architecture, engineering pitfalls); MEDIUM (game balance calibration)

---

## Executive Summary

Wheel of Fate is a browser-based character creation game driven entirely by randomized animated wheel spins. The core loop is 23 sequential spins that accumulate into a character sheet, capped by a probability-gated Redemption Spin and a dramatic Title reveal.

The recommended build order is **frontend-first, backend-last**. The entire game loop can be built and validated in-browser before a single line of backend code is written. The two highest-risk areas are the wheel animation architecture (easing curve and result-before-animation pattern must be right in Phase 1) and session durability (localStorage recovery must be designed from step one, not retrofitted).

---

## Recommended Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Animation | GSAP | 3.15.0 |
| Wheel rendering | SVG (DOM) | — |
| Frontend | Svelte + SvelteKit | 5.55.7 / 2.60.1 |
| Build tool | Vite (via SvelteKit) | 8.0.13 |
| Styling | Tailwind CSS | 4.3.0 |
| Backend | Fastify | 5.8.5 |
| Database | MongoDB Atlas + Mongoose | cloud / 9.6.2 |
| Share IDs | nanoid | 5.1.11 |

**Why GSAP + SVG:** `power4.out` easing produces physical deceleration feel. SVG handles pie-slice geometry natively. Canvas would need manual redraw loops; PixiJS is architectural overkill for a single wheel.

**Why Svelte over React:** Smaller compiled bundle, native reactivity (runes), SvelteKit file-based routing gives `/character/[id]` and `/gallery` for free.

**Why MongoDB over PostgreSQL:** Character is a variable-schema document (nested arrays for abilities/powers). No relational joins exist. PostgreSQL would require awkward JSONB columns.

> **License note:** GSAP Standard License is free for non-SaaS non-premium-plugin usage. Confirm at gsap.com/standard-license before public launch.

---

## Table Stakes Features

Missing any of these breaks the core loop:

- Animated spinning wheel with `power4.out` deceleration — this IS the product
- All 23 spin categories in correct narrative order
- Variable racial and archetype ability spin counts (1–4 per race/archetype)
- Letter tier (F → D → C → B → A → S → SS → SSS → God) + numeric score on every stat
- Redemption Spin — two stages (probability gate + outcome wheel) — the signature mechanic
- Character card as session payoff
- Shareable URL per character
- Content at minimums: 35+ races, 50+ powers, 50+ titles

## Differentiators

- 18 named Redemption outcomes with distinct effects (Inversion, God's Gift, Wild Card, Ascension, The Bargain, etc.)
- Rarity weighting on race wheel (2% Legendary, 18% Rare, 45% Uncommon, 35% Common)
- "The Bargain" — only player-choice moment in the entire game
- Character gallery with opt-in sharing

## Anti-Features (Do Not Build)

- Re-spin buttons (except Redemption) — defeats the fate concept
- Login / accounts — kills casual viral sharing
- Manual customization
- Combat or gameplay beyond character creation

---

## Content Pools (Fully Designed)

| Pool | Count | Status |
|------|-------|--------|
| Races | 35 | Designed with rarity tiers |
| Archetypes | 15 | Named, ability counts set |
| Powers | 55 | Named with flavor hooks |
| Weapons | 22 | Named |
| Enchantments | 15 | Named |
| Backstories | 17 | Named |
| Weaknesses | 18 | Named |
| Titles | 52 | Named with flavor hooks |
| Redemption outcomes | 18 | Fully designed with effects |

**Tier system:** F (1–10) → D (11–20) → C (21–30) → B (31–40) → A (41–55) → S (56–70) → SS (71–82) → SSS (83–93) → God (94–100)

---

## Architecture Decisions

1. **Result-before-animation is mandatory** — compute weighted-random result, calculate landing angle, then run GSAP tween to that fixed angle. Never read wheel position at animation end.

2. **Single POST at session end** — accumulate all 23 results in a `SessionAccumulator` in memory; write to backend only when spin 23 resolves.

3. **localStorage after every spin** — serialize `SessionAccumulator` to localStorage after each completed spin. Resume flow on page reload.

4. **JSON blob + denormalized columns** — `spins` stored as document field; `race`, `archetype`, `overall_score`, `overall_tier` as real columns for gallery queries.

5. **Redemption Spin probability** — inverse logistic sigmoid: `P = 1 / (1 + e^(k * (score - midpoint)))` with midpoint=45, steepness=0.12. Validate with 10,000-character simulation — these are design estimates, not validated values.

6. **4 API endpoints total:** POST /api/characters, GET /api/characters/:id, GET /api/characters (gallery), DELETE /api/characters/:id (soft delete)

7. **Wheel content as static JSON** — bundled with frontend, lazy-loaded per category. No API endpoint for content.

---

## Critical Pitfalls (Top 5)

1. **Wrong easing curve** — Use GSAP `power4.out` only. CSS ease or ease-in-out will feel wrong. Must be right in Phase 1 or all 23 wheels need refactoring.

2. **Snap correction bug** — If result is determined after animation, float rounding produces a visible glitch on high-refresh screens. Result must be pre-determined.

3. **No session recovery** — Without localStorage write after every spin, a tab switch at spin 17 is a rage-quit event with no gallery entry.

4. **Redemption probability miscalibration** — Logistic curve params need simulation validation. Build a 10,000-character simulation script in Phase 3. Target 25–35% trigger rate.

5. **Shareable links returning blank pages** — Implement soft-delete (never hard-delete), a styled 404 page, and loading/error states. Build alongside happy path in Phase 4.

---

## Recommended Phase Order

| Phase | Focus | Key Deliverable |
|-------|-------|----------------|
| 1 | Core Wheel Animation + State | Single animated SVG wheel; easing validated on mobile; localStorage recovery |
| 2 | Full 23-Spin Flow + Character Card | Complete game loop in-browser; scoring system; `scoreTier()` utility |
| 3 | Redemption Spin | Two-stage mechanic; 18 outcomes; simulation script |
| 4 | Backend + Sharing | Fastify + MongoDB; nanoid share IDs; soft-delete; rate limiting |
| 5 | Gallery | Opt-in sharing; offset pagination; character summary cards |
| 6 | Content + Polish | Full content pools; mobile responsive; Open Graph |

---

## Open Questions for Design

- Redemption outcome UX: when a stat is replaced, show before/after or replace silently?
- "The Bargain" — timer-based auto-select if no input (to preserve fate aesthetic)?
- Gallery opt-in or automatic for all completed characters?
- Redemption eligibility wheel: sectors sized by probability weight, or equal-size with hidden weights?
- Weakness count: how many weakness spins can trigger (fixed or variable)?

---

*Research completed: 2026-05-15 | Ready for roadmap: YES*
