# Tier Overhaul & Story Mode Expansion — Plan

**Created:** 2026-05-27
**Scope:** New tier ladder, descriptions, races/archetypes/titles, story mode worlds + levels, Paragon spins, Dismantle, Fuse, game-pass feedback, power/weapon scaling.

---

## Current State (Verified)

- **46 tiers** defined in `src/lib/game/scoreTier.ts:14-83`: F-..SSS+ (3-pt bands), Z..ZZZ+ (2-pt bands), Celestial..Absolute+ (1-pt bands).
- **Overflow:** `extendedTierFromScore()` produces `Absolute+N` for scores >150 (capped N≤20).
- **Story levels 0–5** with caps `[54, 92, 99, 103, 115, ∞]` — `saveSlots.ts:1030`.
- **Worlds (16):** F..ZZZ + Celestial, Godly, Primordial, Absolute — `story/worlds.ts`.
- **Player-level unlocks:** L1=C, L2=A, L3=SS, L4=Z, L5=ZZZ.
- **Spin types:** Normal (50 shards), Hero (100, L2, 2× luck+stats), Legend (500, L4, 4×).
- **Landing celebration:** 5 intensities. Celestial+ already triggers a "transcendent" tier (single shared animation).
- **Inventory + equipment** already exists. Stat crystals: common/elite/legendary (10/5/3 daily buy caps).
- **Game passes:** revenge_protocol, double_shard_drop, crit_surge, etc. — most have no on-screen feedback.

---

## New Target State

### Tier Ladder (top of existing, inserts + extensions)

| New tier | Position | Subdivisions | Visual |
|---|---|---|---|
| Cosmic | INSERT after ZZZ, before Celestial | -, none, + | Deep cyan gradient |
| Immortal | INSERT after Cosmic, before Celestial | -, none, + | Rainbow gradient |
| Celestial | (existing position) | -, none, + | Dark pink gradient (was different) |
| Godly | (existing) | -, none, + | Light pink gradient |
| Primordial | (existing) | -, none, + | White/gray gradient |
| Absolute | (existing) | -, none, + | Light cyan blue gradient |
| Transcendent | EXTEND after Absolute+ | -, none, + | Lime green gradient |
| Infinite | EXTEND after Transcendent+ | -, none, + | Black/white gradient |
| Infinite+N | overflow replaces Absolute+N | — | — |

**Cosmic and above** → gradient applies to BOTH text and wheel segment slice.

### Story Mode Caps & Unlocks

| Player Level | Stat cap (max tier) | Unlocked by |
|---|---|---|
| 0 | unchanged (~F+) | start |
| 1 | unchanged (~SS-) | beat F-C |
| 2 | unchanged (~SSS+) | beat A |
| 3 | **ZZ-** (was Z-) | beat SS |
| 4 | **Cosmic-** (was ~ZZ+) | beat Z |
| 5 | **Celestial-** (was ∞) | beat ZZZ |
| **6 (new)** | **Primordial-** | beat **Immortal** |
| **7 (new)** | **Transcendent-** | beat **Godly** |
| **8 (new, max)** | **no cap** | beat **Absolute** |

### Worlds (add 4 new)

Order: F..ZZZ → **Cosmic** → **Immortal** → Celestial → Godly → Primordial → Absolute → **Transcendent** → **Infinite**

### Spin Types

| Type | Cost | Multiplier | Unlock | Color | Border (roster + battle) |
|---|---|---|---|---|---|
| Normal | 50 shards | 1× | always | default | none |
| Hero | 100 | 2× | L2 | gold | yes (existing) |
| Legend | 500 | 4× | L4 | purple | yes (existing) |
| **Paragon** | **2500** | **8×** | **L6** | **red** | **yes (NEW — both roster + battle)** |

3× rarer than legend (luck math TBD — likely halve proc rate or apply 1/3 rate to existing legend procs).

UX: locked spin types (Hero/Legend/Paragon) **always visible** in the spin selector — show as locked, can't use yet.

### Dismantle (unlock L4)

- Cost: gems ∝ overall grade
- Yields:
  - **Stat crystal tier banding:** F..SS → T1 (common), SSS..Cosmic → T2 (elite), Immortal+ → T3 (legendary)
  - **Per-stat crystal chance:** scales with sub-grade position within band. F = 1%/stat, SS = 5%/stat → linear interpolate.
  - **Chance** to add equipped powers/weapons/armors to inventory (open-item list, equippable later).

### Fuse (unlock L6)

- Pick **2 characters**; pick which is the **baseplate**.
- Output: combines best stats of both (per-stat max).
- Cost: very expensive gems. Rare.

### Other

- **Armor-strength `statBonusGrants`** added to subset of races + archetypes + backstories + titles.
- **More rarity tiers / higher min rolls** for races/archetypes (raise `minStatTier` floors; redistribute weights).
- **Game-pass visible feedback** for currently-silent passes (revenge_protocol, double_shard_drop, sell_bonus, double_luck, crit_surge).
- **Power/weapon damage scaling** with `powerMastery` / `energyLevel` / `weaponMastery` audited & tuned (formulas exist but contribution weights may be too low).
- **Re-grade migration** for stored Absolute+N characters → mapped onto new ladder.

---

## Segmented Execution Plan

### **Segment 1 — Tier Foundation** (load-bearing)
Files: `scoreTier.ts`, `tierColor.ts`, `app.css`, `achievements.ts`, `battle.ts`, label files (tier field migration only).
- Insert Cosmic / Immortal between ZZZ+ and Celestial-.
- Append Transcendent / Infinite after Absolute+.
- New `extendedTierFromScore` returns `Infinite+N`.
- Add gradient CSS vars + helper `tierToGradient()`.
- Update battle damage/HP tier tables.
- Migration: any persisted character with `overall_tier` matching `Absolute+N` is remapped on read (linear lift).
- Update `achievements.ts` ELITE/MYTHIC/GODLY sets.
- Update `STAT_WEIGHTS` if needed for top-tier balance.

### **Segment 2 — Content Rescale**
Files: all 11 `src/lib/content/*-labels.ts`.
- Rewrite labels: F- = vegetable level, B/A = elite human (genius IQ at A range), SSS = reality-breaking, Cosmic+ = beyond-mortal, Infinite+ = "beyond infinity itself".
- Tone-down mid-tier physicality ("B-tier durability tanks a tank blast" → softened).
- Add new labels for Cosmic / Immortal / Transcendent / Infinite per stat.
- Recompute weights to preserve distribution intent.

### **Segment 3 — Race/Archetype/Backstory/Title Boost Pass**
Files: `races.ts`, `archetypes.ts`, `backstories.ts`, `titles.ts`.
- Add `statBonusGrants.armorStrength` to thematic entries (knights, tanks, dwarves, etc.).
- Add rarity gradation: more weight bands for "elite" archetypes/races.
- Raise `minStatTier` floors on elite races/archetypes.

### **Segment 4 — Story Mode Caps + World Expansion**
Files: `story/worlds.ts`, `story/saveSlots.ts`, `story/types.ts`.
- Add `Cosmic`, `Immortal`, `Transcendent`, `Infinite` to `WORLD_GRADES`.
- Drop tables + crystal ranges for new worlds.
- Expand `STAT_LEVEL_MAX_SCORES` from length 6 → length 9.
- Expand `PLAYER_LEVEL_WORLDS` with 6→Immortal, 7→Godly, 8→Absolute.
- Update boss / wave specs for new worlds.

### **Segment 5 — Landing Animation Differentiation**
File: `LandingCelebration.svelte`.
- Replace single "transcendent" bucket with **per-top-tier presets**: Cosmic / Immortal / Celestial / Godly / Primordial / Absolute / Transcendent / Infinite, each with distinct VFX palette + duration.
- Particle sprite palette per tier.

### **Segment 6 — Paragon Spin Type + Locked-but-Visible UX**
Files: `story/saveSlots.ts`, `story/types.ts`, `BattleView.svelte`, `RosterCard.svelte`, `StorySpinView.svelte`, shop component.
- Type + cost + multiplier + unlock + red color + border styling.
- Add `paragonSpins` to `StorySaveSlot`.
- Update spin selector to always render Hero/Legend/Paragon (locked overlay until prerequisite met).

### **Segment 7 — Dismantle**
Files: `story/saveSlots.ts` (logic), new component `DismantleView.svelte`, hub menu integration.
- Stat crystal yield rules + per-stat % roll.
- Equipped-item migration to inventory on success roll.
- Gem-cost curve by overall grade.
- L4 unlock gate.

### **Segment 8 — Fuse**
Files: `story/saveSlots.ts` (logic), new component `FuseView.svelte`, hub menu integration.
- Baseplate selection + per-stat max merge.
- Very high gem cost curve.
- L6 unlock gate.

### **Segment 9 — Game Pass Visible Feedback**
Files: `battle/controller.ts`, `BattleView.svelte`, gamepass effect callsites.
- Battle-log toast when a passive pass triggers (e.g., "Revenge Protocol → +50% shards on loss").
- Persistent badge cluster in HUD showing active passes.

### **Segment 10 — Power/Weapon Damage Scaling Audit**
Files: `battle.ts` damage formulas.
- Verify powerMastery / energyLevel / weaponMastery meaningfully scale damage.
- Tune `STAT_WEIGHTS` or add explicit per-stat multiplier curves if underweight.

---

## Risk / Migration Notes

- **Persisted characters** with `Absolute+N` (overflow grade) must remap cleanly. Strategy: on load, detect old grade, remap by score via new `extendedTierFromScore`. Existing characters with score ≤150 don't need re-grading.
- **Save-slot backward compatibility:** new `STAT_LEVEL_MAX_SCORES` is longer; existing saves with `playerLevel ≤ 5` keep working. Old `playerLevel = 5` (∞ cap) becomes `playerLevel = 5` (Celestial- cap) — this is a downgrade. Decision needed (see Q3).
- **Wheel content rescale (Segment 2)** is the largest single edit by line count — 11 files × ~30 entries.
- **Each segment** lands as its own atomic commit.

