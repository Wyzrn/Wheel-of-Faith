# Phase 2: Full 23-Spin Game Loop - Context

**Gathered:** 2026-05-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the complete playable game loop entirely in-browser (no backend). User spins through all 23 categories in order — Race → Racial Ability Spin(s) → Archetype → Archetype Ability Spin(s) → Backstory → Height → Strength → Speed → Agility → Durability → IQ → Charisma → Fighting Skill → Power(s) → Power Mastery → Weapon(s) → Weapon Mastery → Weapon Enchantment → Potential → Energy Level → Weakness(s) → Redemption Spin → Title — and sees a complete styled character card at the end. All content (flavor labels, races, powers, weapons, weaknesses) is written in full in this phase. Backend, sharing, and gallery are Phase 4+.

</domain>

<decisions>
## Implementation Decisions

### Inter-spin Flow
- **D-01:** After a spin lands (REVEALED state), a **"Next Spin" button** advances to the next spin. User controls pacing — no auto-advance. This preserves the tension of each spin as a moment.
- **D-02:** Before each spin, the **category name is shown** (e.g., "Next: Strength"). Gives the user orientation and builds anticipation.
- **D-03:** Results **accumulate as a growing list** alongside the wheel throughout the session. As each spin resolves, the result joins a visible history panel. User sees their character building in real time.

### Character Card Scope
- **D-04:** Character card is **functional + styled** — a real designed character sheet, not a debug dump. Each stat shows its tier badge (letter grade e.g. B+, S, God), a numeric score, and the result label.
- **D-05:** The overall tier badge shows **both** the computed letter grade (from `scoreTier()`) AND the numeric score (0–100). Grade badge is the hero element; numeric score shown beneath it.
- **D-06:** A **"New Character" button** on the card resets all state and starts spin 1 fresh — no page refresh required. Session store is cleared, queue is reset.

### Phase 2 Content Depth
- **D-07:** **Full ~560 flavor labels per stat wheel** written in Phase 2 (not Phase 6). All 11 stat wheels (Strength, Speed, Agility, Durability, IQ, Charisma, Fighting Skill, Power Mastery, Weapon Mastery, Potential, Energy Level) get approximately 20 unique labels per tier × 28 tiers each. This is ~6,000+ stat labels total.
- **D-08:** **Full real content for all other spin categories** written in Phase 2: 35+ races with rarity weighting and ability spin counts, 15+ archetypes, 1,000+ powers (epic → absurd), 500+ weapons (legendary → pineapple), 500+ weaknesses (classic → testicular torsion), 17+ backstories, 52+ titles, 15+ enchantments.
- **D-09:** This decision **folds Phase 6 content work into Phase 2**. Phase 6 is updated to "Polish only" — mobile responsiveness, performance, UI refinement. The ROADMAP.md Phase 6 description should be updated accordingly.

### Spin Queue Architecture
- **D-10:** The spin queue is a **reactive array built dynamically at runtime**. The array starts with all fixed categories. When Race lands, `abilitySpinCount` from the race result splices N racial ability spin definitions into the array immediately after the Race entry. When Archetype lands, M archetype ability spin definitions are spliced in after it. A `currentSpinIndex` pointer tracks progress.
- **D-11:** Game loop state (`spinQueue` array, `currentSpinIndex`, accumulated results) lives as **`$state` in `+page.svelte`** and is serialized to localStorage after every completed spin. Resume logic restores queue + index from localStorage on mount, consistent with Phase 1's `wof_session` pattern.
- **D-12:** When the queue expands after Race or Archetype lands, a **brief announcement is shown**: e.g., "Your race grants 3 ability spins!" This gives the user a sense of consequence from their result before clicking Next Spin.

### Claude's Discretion
- Exact visual layout of the growing results list (sidebar vs below-wheel vs collapsible panel)
- Exact tier color coding for badges (e.g., gold for S+, red for God)
- Animation/transition between spins (if any)
- Whether the results list scrolls or uses a fixed-height panel
- File structure for the large content datasets (separate JSON files per category, or a single content module)
- scoreTier() mapping: exact numeric ranges for each of the 28 grades

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 1 Foundation (locked — do not change)
- `.planning/phases/01-animation-foundation/SKELETON.md` — All architectural decisions locked in Phase 1. SpinWheel API, GSAP config, state machine, localStorage key, SVG geometry.
- `src/components/SpinWheel.svelte` — Reused as-is. Phase 2 passes different `segments` arrays to it. Do NOT modify ease, svgOrigin, or onComplete logic.
- `src/lib/session/types.ts` — `WeightedSegment`, `SpinStatus`, `SpinResult`, `SessionState` are the shared type contracts.
- `src/lib/session/store.ts` — `loadSession`, `saveSession`, `clearSession`, `createSession` — used for queue persistence.
- `src/lib/game/geometry.ts` — `slicePath`, `equalSegmentAngles`, `calculateTargetAngle` — reused by all wheels.
- `src/lib/game/random.ts` — `weightedRandom` — used for result selection in every spin.

### Requirements
- `.planning/REQUIREMENTS.md` — CORE-02 (23-spin order), CORE-03 (variable ability spins), CORE-04 (28-grade tier system + flavor labels), REDEM-01 (scoreTier utility), CARD-01 (character card)
- `.planning/ROADMAP.md` — Phase 2 success criteria (5 criteria including full replay without refresh, all 28 grades reachable)

### Project Context
- `CLAUDE.md` — Critical architecture rules (result-before-animation, localStorage-after-every-spin, scoreTier() as single source of truth, power4.out only)
- `.planning/research/SUMMARY.md` — Architecture decisions section (result-before-animation, single POST at session end, JSON blob content storage)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/SpinWheel.svelte`: Accepts `segments: WeightedSegment[]` and `onSpinComplete: (index, label) => void`. Phase 2 just passes different arrays to it for each of the 23 categories. No modification needed.
- `src/lib/game/random.ts` `weightedRandom()`: Already handles weighted segments — used for rarity-weighted race selection.
- `src/lib/session/store.ts`: `saveSession/loadSession/clearSession` are ready. Phase 2 extends `SessionState` or wraps it with queue state.
- `src/lib/game/spinEngine.ts` `isValidTransition()`: State machine for IDLE→SPINNING→LANDED→REVEALED→IDLE is ready.

### Established Patterns
- **Result-before-animation**: `weightedRandom()` always called before `gsap.to()`. Must remain true for all 23 spin categories.
- **localStorage after every REVEALED**: `saveSession()` called inside the `onSpinComplete` callback after the result is recorded.
- **Monotonic rotation accumulation**: `currentRotation` never resets to 0 between spins. SpinWheel handles this internally.
- **SPA mode**: `ssr=false` in `+layout.js`. All game logic is browser-only.

### Integration Points
- `+page.svelte` becomes the game loop orchestrator: it owns the `spinQueue` array, `currentSpinIndex`, and passes the correct `segments` array to `SpinWheel` based on `spinQueue[currentSpinIndex]`.
- Content data (races, archetypes, powers, weapons, etc.) imported as static TypeScript/JSON modules. No API endpoint — bundled with the frontend.
- `scoreTier()` utility (new in Phase 2) must be importable from `$lib/game/scoreTier.ts` so both the game loop and character card can use it.

</code_context>

<specifics>
## Specific Ideas

- Flavor label examples from requirements: Strength F- = "Wet Noodle Arm", Speed God = "Omnipresent". Powers: "Balding", "Aggressive Sneezing", "Wet Sock Awareness". Weapons: "Pineapple", "Grandma's Slipper". Weaknesses: "Testicular Torsion", "Vague Social Anxiety", "The Smell of Burnt Toast". Tone is intentionally epic → absurd across all content pools.
- The 28-grade tier system: F-, F, F+, E-, E, E+, D-, D, D+, C-, C, C+, B-, B, B+, A-, A, A+, S-, S, S+, SS-, SS, SS+, SSS-, SSS, SSS+, God
- Race examples from research: rarity Common ~35%, Uncommon ~45%, Rare ~18%, Legendary ~2%. Each race defines ability spin count (1–4).
- The announcement on queue expansion ("Your race grants 3 ability spins!") should display briefly between the Race REVEALED state and the Next Spin button becoming active.
- Phase 6 ROADMAP.md should be updated: "Content + Polish" → "Polish" with scope limited to mobile responsiveness, performance, and UI refinement. Content minimums (CONT-01 through CONT-08) are met in Phase 2.

</specifics>

<deferred>
## Deferred Ideas

- Open Graph / social card metadata on character card pages — explicitly Phase 6 (v2) per ROADMAP.md
- "The Bargain" interactive timer (10s auto-select) — Phase 3 (Redemption Spin)
- Sound design / audio reveal cues — v2 per ROADMAP.md
- Gallery opt-in toggle on character card — Phase 5

</deferred>

---

*Phase: 2-Full 23-Spin Game Loop*
*Context gathered: 2026-05-15*
