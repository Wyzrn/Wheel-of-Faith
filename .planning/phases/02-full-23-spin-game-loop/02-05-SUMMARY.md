---
phase: 02-full-23-spin-game-loop
plan: 05
status: complete
completed_at: 2026-05-16
---

# Plan 02-05 Summary — CharacterCard + TierBadge

## What Was Built

### CharacterCard.svelte (full replacement)

The final character sheet shown after all spins complete. Key design decisions:

**Hero grade banner** — flex row with giant Cinzel-font grade letter (tier-colored, with `drop-shadow` glow) on the left and name/race/archetype on the right. Grade is computed via `computeOverallScore()` + `scoreTier()` per CLAUDE.md rule 4 — never stored independently.

**Overall score display** — `Score {overallScore} / 100` in JetBrains Mono beneath the grade. Background gradient uses `TIER_COLORS[overallGrade]` with low opacity for a subtle tinted card.

**Stats grid** — 2-column grid, each cell has `border-left: 2px solid {TIER_COLORS[tier]}` accent, tier badge (colored pill), category label, and flavor label. The 11 stat categories: strength, speed, agility, durability, iq, charisma, fightingSkill, powerMastery, weaponMastery, potential, energyLevel.

**Abilities sections** — racial abilities and archetype abilities in a 2-column grid, each as a small card.

**Powers** — pill tags with purple tint (`rgba(91,33,182,0.22)`).

**Weaknesses** — pill tags with red tint (`rgba(127,29,29,0.25)`).

**Weapon row** — shows weapon type, weapon name, enchantment (if present), and weaponMastery tier badge.

**Redemption block** — purple gradient card with `auto_awesome` icon, shown when `redemptionOutcome` result exists.

**"Rewrite Destiny" button** — gold engraved button using Cinzel, calls `onNewCharacter` directly with no confirmation.

### TierBadge.svelte (full replacement → inlined into CharacterCard)

Rather than a separate reusable component, tier coloring was applied directly in CharacterCard via the `TIER_COLORS` record mapping all 28 grades to hex values. The inline approach avoided an extra component import while keeping the tier-color logic colocated with where it's used.

### TIER_COLORS record

Both CharacterCard and +page.svelte carry a `TIER_COLORS` constant mapping all 28 grades (`F-` through `God`) to specific hex colors. This replaced the `tierToCssVar()` function approach from the plan (which referenced CSS vars) — inline hex values give more direct control over gradients and glow effects.

## Deviations from Plan

- `TierBadge.svelte` as a separate reusable component was not created. Tier coloring was inlined in CharacterCard via a `TIER_COLORS` record. The stub TierBadge.svelte file was replaced but the implementation is a minimal pass-through — the actual visual badge work lives in CharacterCard.
- The overall visual design diverged from the Tailwind-utility spec in the plan. The card uses `style=` attributes with the gold/void design system rather than `bg-gray-900 rounded-2xl p-8`. This was intentional per the mockup provided by the user.
- Character naming screen was added between the last spin and CharacterCard — the name is passed as a `name` prop and displayed prominently in the hero banner.

## Files Modified

- `src/components/CharacterCard.svelte` — complete rewrite
- `src/components/TierBadge.svelte` — stub replaced (thin wrapper, actual rendering in CharacterCard)
