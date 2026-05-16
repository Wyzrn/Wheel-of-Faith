# Wheel of Fate — Project Guide

## What This Is

A browser-based character creation game where players spin 23 sequential animated wheels to generate a complete character. Built in JavaScript (Svelte 5 + SvelteKit frontend, Fastify 5 + MongoDB backend). Inspired by the "Wheel of Faith" Instagram format.

## Planning Artifacts

| Artifact | Location |
|----------|----------|
| Project context | `.planning/PROJECT.md` |
| Requirements | `.planning/REQUIREMENTS.md` |
| Roadmap | `.planning/ROADMAP.md` |
| Research | `.planning/research/` |
| Config | `.planning/config.json` |

## Stack

| Layer | Technology |
|-------|-----------|
| Animation | GSAP 3.15.0 + SVG |
| Frontend | Svelte 5 + SvelteKit |
| Styling | Tailwind CSS 4 |
| Backend | Fastify 5 |
| Database | MongoDB + Mongoose 9.6 |
| Share IDs | nanoid 5 |

## Critical Architecture Rules

1. **Result before animation** — determine weighted-random outcome first, compute landing angle, then run GSAP tween. Never read wheel position at animation end.
2. **localStorage after every spin** — serialize session state after each completed spin. User must be able to resume after page reload.
3. **Single POST at session end** — accumulate all 23 results in `SessionAccumulator`; write to backend only when spin 23 resolves.
4. **`scoreTier()` is the single source of truth** — tier grade always derived from this function, never stored independently.
5. **GSAP `power4.out` only** — no CSS ease, no linear. The physical deceleration feel is core to the product.

## Tier System

28 grades: F-, F, F+, E-, E, E+, D-, D, D+, C-, C, C+, B-, B, B+, A-, A, A+, S-, S, S+, SS-, SS, SS+, SSS-, SSS, SSS+, God

Each stat wheel shows **flavor label segments** — the label IS the result. Each tier has ~20 unique labels per stat. Landing on a label determines tier grade and numeric score from that label's embedded data.

## Content Scale

- Powers: 1,000+ (epic → absurd)
- Weapons: 500+ (legendary → pineapple)
- Weaknesses: 500+ (classic → testicular torsion), race-weighted (0–3 per character)
- Races: 35+ with rarity weighting and weakness probability modifiers
- Redemption outcomes: 18+ chaotic effects

## Phase Order (Do Not Reorder)

1. Animation Foundation — easing + localStorage
2. Full 23-Spin Game Loop — browser-only, no backend
3. Redemption Spin — depends on `overall_score`
4. Backend + Sharing — additive once frontend is proven
5. Gallery — depends on backend
6. Content + Polish — gates launch

## Workflow

- Mode: YOLO (auto-approve)
- Granularity: Standard
- Agents: Researcher + Plan Checker + Verifier enabled

Run `/gsd-discuss-phase 1` to start Phase 1.
