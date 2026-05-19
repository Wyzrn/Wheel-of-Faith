# Wheel of Fate — Roadmap

## Milestone 1: v1 Launch

### Phase 1: Animation Foundation
**Goal:** Developer can see a single animated SVG wheel spin with correct `power4.out` deceleration, land on a pre-determined result, and recover its state from localStorage after a page reload.
**Mode:** mvp
**Requirements:** CORE-01, CORE-05
**Success Criteria:**
1. User clicks "Spin" and the wheel visibly accelerates then decelerates smoothly, landing precisely on a segment — no snap correction or jitter visible on any screen refresh rate
2. The easing curve feels physically satisfying — the wheel slows as if losing momentum, not linearly stopping
3. After a page reload mid-session, the user is offered to resume from their last completed spin and the correct result is restored
4. On mobile viewport, the wheel renders fully visible and the animation runs without dropped frames

---

### Phase 2: Full 23-Spin Game Loop
**Goal:** User can play through all 23 spin categories in order — including variable ability spins — and see a complete styled character card at the end with every result and tier score displayed.
**Mode:** mvp
**Requirements:** CORE-02, CORE-03, CORE-04, REDEM-01, CARD-01
**Plans:** 5 plans
Plans:
- [x] 02-01-PLAN.md — Core utilities: scoreTier, spinQueue, tierColor, content types, session extension
- [x] 02-02-PLAN.md — Non-stat content data: races, archetypes, powers, weapons, weaknesses, backstories, titles, enchantments
- [x] 02-03-PLAN.md — Stat flavor label files (11 × ~560 labels) + app.css tier color palette
- [x] 02-04-PLAN.md — Game loop orchestrator: extend +page.svelte with queue, results panel, announcement, resume
- [x] 02-05-PLAN.md — Character card: TierBadge, CharacterCard, New Character reset flow
**Success Criteria:**
1. User spins through Race, then sees the correct number of Racial Ability spins (1–4 determined by the race result), then Archetype, then the correct number of Archetype Ability spins, then all remaining categories in the defined sequence — no spin appears out of order
2. Each stat wheel (Strength, Speed, Agility, Durability, IQ, Charisma, Fighting Skill, Potential, Energy Level, Power Mastery, Weapon Mastery) displays flavor label segments; landing on a label shows its tier grade (e.g. "B") and numeric score without any manual lookup
3. After spin 23 resolves, user sees a complete character card listing all spin results, each stat's tier badge, and an overall character tier badge computed from the `scoreTier()` utility
4. User can replay from the beginning — state resets cleanly and a new character can be generated without refreshing the page
5. The full 28-grade scale (F- through God) is reachable — no tier grade is permanently excluded from any wheel

---

### Phase 3: Redemption Spin
**Goal:** User experiences the two-stage Redemption Spin at the end of the loop — a probability-gated first wheel and, if earned, a chaotic outcome wheel that mutates their character sheet.
**Mode:** mvp
**Requirements:** REDEM-02, REDEM-03, REDEM-04
**Success Criteria:**
1. After spin 22, a Redemption probability wheel spins; a character with a very low overall score has a visibly high chance of landing on Redemption (up to 85%), and a high-scoring character has a visibly low chance (down to 5%)
2. When Redemption is earned, a second outcome wheel spins and lands on one of the 18+ named outcomes (Inversion, God's Gift, Wild Card, Cursed, The Bargain, etc.); the character card immediately reflects the stat mutations from that outcome
3. When Redemption is not earned, the flow proceeds to the Title spin without any mutation applied — the character sheet is unchanged
4. A simulation script can be run that generates 10,000 random characters and reports the Redemption trigger rate, confirming it falls in the 25–35% target window

---

### Phase 4: Backend + Sharing
**Goal:** User can save their completed character to the backend and share it via a unique URL that loads the full character card for anyone who clicks it.
**Mode:** mvp
**Requirements:** BACK-01, BACK-02, BACK-03, BACK-04, CARD-02
**Success Criteria:**
1. User clicks "Save & Share" on the character card and receives a unique URL (e.g. `/character/xK3mP9qR2v`) within one second; opening that URL on a different device shows the identical character card
2. A character URL that has never existed (or has been soft-deleted) returns a styled "This fate has been lost to the multiverse" page — not a blank screen or generic 404
3. Submitting a character with a session shorter than 90 seconds is rejected by the API — the Save button either remains disabled or shows an error
4. Repeatedly saving from the same IP address within a short window is rate-limited — subsequent attempts receive a clear error response, not a silent failure

---

### Phase 5: Gallery
**Goal:** User can browse a public gallery of opted-in characters, see summary cards, and navigate to any character's full sheet.
**Mode:** mvp
**Requirements:** GALL-01, GALL-02, GALL-03, CARD-03
**Success Criteria:**
1. The gallery page lists characters that chose to opt in, each showing Title, Race, Archetype, overall tier badge, score, and creation date
2. User can load more gallery entries by scrolling or clicking a "Load more" button — older characters appear below newer ones by default
3. User can re-sort the gallery by overall score to see the highest-rated characters at the top
4. Clicking any gallery card navigates to that character's full sheet at `/character/[id]` without a full page reload
5. A character's "Share to Gallery" toggle on the character card controls whether it appears in the gallery — toggling it off removes the card from the listing

---

### Phase 6: Polish
**Goal:** The game runs smoothly on mobile and the UI is refined — all content pools are already at launch minimums from Phase 2. Phase 6 focuses on mobile responsiveness, performance, and visual polish only.
**Mode:** mvp
**Requirements:** CONT-08
**Note (D-09):** Full content authoring (CONT-01 through CONT-07) was folded into Phase 2. Phase 6 is now Polish only: mobile responsiveness, animation performance, layout overflow fixes, visual refinement. CONT-08 (seeded JS/JSON files importable into MongoDB) is the only content requirement remaining for Phase 6, as the content itself already exists as TypeScript modules after Phase 2.
**Success Criteria:**
1. On a mid-range Android phone in Chrome, the full 23-spin session completes without layout overflow, animation jank, or scroll trapping
2. The character card renders correctly at 375px viewport with no horizontal overflow
3. The tier badge hero element is fully visible without scrolling on a 375px mobile viewport
4. npm run build completes in under 30 seconds and the bundle size is under 2MB
5. All CONT-01 through CONT-07 content minimums are confirmed met (script verifies counts against launch minimums)

---

---

## Milestone 2: Story Mode

> **Isolation rule:** Story Mode is a completely separate game mode from the main spin game. It lives at its own route (`/story`), uses its own localStorage namespace (`story_*`), its own backend collections, and its own in-mode character generation flow. Characters generated in the main spin game cannot be imported into Story Mode. No state crosses the boundary in either direction.

---

### Phase 7: Story Mode Shell + Character Roster
**Goal:** Story Mode exists as a standalone route with its own entry screen, isolated state, and a persistent character roster. Players generate characters entirely within Story Mode using a tiered spin flow, give them auto-generated names, and can sell unwanted ones for Fate Shards.
**Requirements:** ROST-01, ROST-02, ROST-03, ROST-04
**Architecture notes:**
- New route: `src/routes/story/+page.svelte` — no shared session state with `src/routes/+page.svelte`
- All Story Mode state (roster, shards, progression) lives under separate localStorage keys (e.g. `story_roster`, `story_shards`, `story_progress`)
- Story Mode character generation runs a constrained version of the spin loop inline (see Phase 8 for tier gating); it does not reuse main game session accumulator or share result state
- Backend: separate `story_characters` collection; main game's `characters` collection is never read or written from Story Mode
**Plans:** 3 plans
Plans:
- [ ] 07-01-PLAN.md — Story Mode data foundation: types, naming (mulberry32 seeded PRNG), localStorage store with 50-slot cap, shard value lookup + Vitest coverage
- [ ] 07-02-PLAN.md — Story Mode shell: /story route view state machine (entry / roster / expanded / sell), RosterCard + SellConfirmModal components, atomic sell flow
- [ ] 07-03-PLAN.md — Story Mode spin loop integration: StorySpinView component, story_session localStorage, auto-name + addToRoster on completion
**Success Criteria:**
1. Navigating to `/story` shows a Story Mode entry screen distinct from the main game; no main-game session state is present or accessible here
2. Spinning a new character inside Story Mode runs a full constrained wheel session and on completion lands in Story Mode — the main game is never touched
3. The resulting character is auto-named (adjective + noun seeded from stats), added to the Story Mode roster, and persists across page reloads via Story Mode localStorage keys
4. The roster screen shows compact character cards sortable by overall tier, race, or archetype; clicking a card expands the full sheet within Story Mode
5. Selling a character from the roster shows its Fate Shard value (based on overall tier), requires confirmation, is irreversible, and credits the Story Mode shard balance — the main game is unaffected

---

### Phase 8: Tiered Spin System
**Goal:** Story Mode's character generation is gated behind four progression tiers; players start with a constrained race and content pool and unlock broader options as they advance through Story Mode areas.
**Requirements:** PROG-01, PROG-02, PROG-03, PROG-04
**Architecture notes:**
- Tier state is stored in Story Mode's own localStorage (`story_unlock_tier`) and backend; it is independent of anything in the main game
- The spin loop in Story Mode reads the current unlock tier to filter race pool and stat ceilings before each session; the main game's spin loop is never modified
**Tier definitions:**
- **Tier 1 — Common** (starting): Races weight ≥ 12 (Human, Halfling, Goblin, Gnome, Robot, Dwarf)
- **Tier 2 — Uncommon**: + Races weight 7–11 (Elf, Half-Elf, Orc, Half-Orc, Tiefling, Lizardfolk, Tabaxi, Dragonborn, Aasimar, Goliath, Genasi variants, Warforged, Cyborg, Bender)
- **Tier 3 — Rare**: + Races weight 4–6 (Shinobi, Mutant, Nen User, Titan Shifter, Namekian, Vampire, Werewolf, Dragon, Devil Fruit User, Demon, Beast, Undead, Saiyan, Symbiote, Half-Dragon, Sphinx, Githyanki, Mindflayer, Hollow, Angel)
- **Tier 4 — Epic**: + Races weight 3 (Viltrumite, Asgardian, Kryptonian, Kaiju, Eldritch Being, Mythological Creature, Time Lord)
- **Tier 5 — Legendary**: + Races weight 2 (Demi-god, God, Primordial)
- **Tier 6 — Mythic**: + Races weight ≤ 1 (Creator and any weight-1 races)

**Content caps per tier (same wheel, segments above cap are dimmed with weight 0):**

| Tier | Stat ceiling | Powers / Weapons / Armor / Enchants ceiling |
|------|-------------|----------------------------------------------|
| 1 — Common | A+ | C |
| 2 — Uncommon | SS+ | B |
| 3 — Rare | Z+ | A |
| 4 — Epic | ZZZ+ | S |
| 5 — Legendary | Godly | SS |
| 6 — Mythic | No cap | SSS (full access) |

Stats use the extended grade scale (Z, ZZ, ZZZ, Celestial, Godly, Primordial, Absolute). Powers, weapons, armor, and enchantments top out at SSS and scale across tiers independently.
**Success Criteria:**
1. A Tier 1 Story Mode spin cannot produce a race with weight < 12, and no generated result (stat, power, weapon, ability) can exceed A+ grade; segments above the cap are visually dimmed with weight 0
2. Content ceiling is enforced consistently across all spin categories — stats, powers, weapons, armor, and abilities all respect the active tier cap; the wheel itself is unchanged, only what's reachable shifts
3. Tier unlocks are permanent within Story Mode and never regress; a player who reaches Tier 4 keeps it on every subsequent Story Mode load
4. Each spin tier has a distinct Fate Shard cost displayed clearly in the Story Mode shop before purchase

---

### Phase 9: Enemy Generation System
**Goal:** Story Mode generates enemies on the fly using the same content modules (races, powers, weaknesses) as the player spin but constrained to a tier bracket; Normal / Elite / Boss variants scale in power and drop different Fate Shard amounts.
**Requirements:** ENEMY-01, ENEMY-02, ENEMY-03, ENEMY-04
**Enemy tiers:**
- **Normal:** Tier 1 constraints; 1–2 abilities; stat weights biased toward F–C range
- **Elite:** Tier 2 constraints; 2–3 abilities; stat weights biased toward C–A range
- **Boss:** Tier 3–4 constraints; full ability slots; unique auto-title; stat weights biased toward A–God; 3× currency drop
**Success Criteria:**
1. A Normal enemy's race, stats, and powers never exceed Tier 1 thresholds; validated at generation time
2. Bosses always have a unique title from the title pool, at least 2 weaknesses, full ability count for their race/archetype, and Power Mastery of B or higher
3. Enemy generation is seeded per (area index + encounter index) so the same Story Mode playthrough always produces the same enemies in the same order
4. Enemy cards display name, race, archetype, key stats, powers list, weaknesses, and estimated Fate Shard drop before combat begins

---

### Phase 10: Card Combat System
**Goal:** Player selects a rostered Story Mode character to fight a generated enemy in a turn-based card battle where wheel stats drive combat values; powers are limited-use abilities; weaknesses are exploitable.
**Requirements:** COMBAT-01, COMBAT-02, COMBAT-03, COMBAT-04, COMBAT-05
**Stat → combat mapping:**
- **Max HP:** derived from Durability + Energy Level scores (scaled; see battle.ts formulas)
- **Physical damage:** Strength + Fighting Skill weighted blend
- **Power damage:** Power Mastery + Energy Level weighted blend
- **Defense (damage reduction %):** Armor Strength tier index × divisor, capped at 75%
- **Speed (turn order):** Speed score; ties broken by Agility
- **Weapon bonus:** Weapon Mastery tier index × (1 + enchantment count × 0.15)
- **Power uses per fight:** Power Mastery score ÷ 20, rounded up
- **Crit chance:** Potential score × 0.2%, capped at 25%
**Success Criteria:**
1. Combat is turn-based; each turn the player chooses Attack, Use Power, or Defend; enemy AI follows a weighted random decision tree biased toward Attack
2. Powers are categorized into effect types (damage burst, heal, stun, shield, bleed) derived from a keyword map on the power label; effect type is shown on the power card
3. Weaknesses are exploitable — if a player power's element or effect type matches an enemy weakness, that power deals 1.5× damage and shows a "WEAKNESS HIT" indicator
4. Losing combat applies a 10% Fate Shard penalty on the Story Mode balance but does not remove the character from the Story Mode roster; the player may retry with a different roster character
5. Post-combat summary shows: damage dealt, damage taken, powers used, weaknesses exploited, and Fate Shards earned

---

### Phase 11: Story Areas & Boss Progression
**Goal:** Story Mode is structured as seven unlockable areas in a fixed linear sequence; each area ends in a Boss fight; defeating a Boss unlocks the next area and may grant a spin tier upgrade.
**Requirements:** STORY-01, STORY-02, STORY-03, STORY-04
**Area sequence:**
1. **The Beginner's Bog** — 4 Normal encounters; no Boss; unlocks Tier 1 spins on first completion
2. **Goblin Market** — 3 Normal → 1 Elite → 3 Normal → Boss (Tier 1); defeating Boss unlocks Area 3 and Tier 2 spins
3. **The Iron Citadel** — 2 Normal → 2 Elite → 1 Normal → Boss (Tier 2); defeating Boss unlocks Area 4
4. **Shattered Highlands** — 2 Normal → 2 Elite → 2 Elite → Boss (Tier 2–3); defeating Boss unlocks Area 5 and Tier 3 spins
5. **The Abyssal Rift** — 1 Normal → 3 Elite → 1 Normal → Boss (Tier 3); defeating Boss unlocks Area 6
6. **Celestial Spire** — 4 Elite → 2 Boss encounters; defeating the second Boss unlocks Area 7 and Tier 4 spins
7. **The Void Beyond** — 2 Elite → Final Boss (Tier 4, seeded unique); defeating Final Boss triggers the Story Mode end-game screen and unlocks infinite run mode
**Success Criteria:**
1. The player cannot skip encounters within an area; completing each fight advances the encounter index
2. Defeating an area Boss permanently marks it cleared in Story Mode state; re-entering replays encounters for farming but the Boss does not re-grant the tier upgrade
3. Each area has a distinct visual theme: background gradient, enemy name prefix pool (e.g. "Bog-", "Iron ", "Void "), and area flavor text on the encounter card
4. Current area and encounter index persist in Story Mode localStorage and backend; reloading drops the player back to the start of the current encounter

---

### Phase 12: Economy & Shop
**Goal:** Fate Shards earned from Story Mode combat and character sales can be spent in the Story Mode shop to generate new rostered characters at different tier levels; the shop reflects story-gated unlock state.
**Requirements:** ECON-01, ECON-02, ECON-03, ECON-04
**Architecture notes:**
- Fate Shard balance is Story Mode-only (`story_shards` in localStorage + backend); the main game has no currency system and is never affected
- Purchasing a spin in the shop launches Story Mode's own constrained spin loop, not the main game
**Spin costs:**
- Tier 1 spin: 50 Fate Shards
- Tier 2 spin: 175 Fate Shards
- Tier 3 spin: 500 Fate Shards
- Tier 4 spin: 1,200 Fate Shards
**Currency drops:**
- Normal enemy win: 15–30 Fate Shards (randomised in range)
- Elite enemy win: 50–90 Fate Shards
- Boss win: 220–380 Fate Shards (+ tier upgrade on first clear)
**Character sell values (based on overall tier):**
- F–D overall: 20–55 Fate Shards
- C–B overall: 70–130 Fate Shards
- A–S overall: 160–320 Fate Shards
- SS+ overall: 500 Fate Shards base + 100 per tier above SS
- God overall: 2,000 Fate Shards
**Success Criteria:**
1. Story Mode Fate Shard balance persists across sessions and is completely separate from anything in the main game
2. The shop shows all four spin tiers; tiers not yet story-unlocked show a locked state with the area required to unlock them
3. Purchasing a spin launches Story Mode's constrained spin loop; the completed character is auto-named and added to the Story Mode roster — the main game is never involved
4. Economy is balanced so a player needs ~3–5 Normal wins to afford a Tier 1 spin, ~2–3 Boss clears to afford a Tier 4 spin

---

## Phases Summary

- [x] **Phase 1: Animation Foundation** — Validated single-wheel animation with correct easing and localStorage recovery
- [x] **Phase 2: Full 23-Spin Game Loop** — Complete playable game loop from Race to Title with character card (includes all content authoring per D-09)
- [x] **Phase 3: Redemption Spin** — Probability-gated two-stage mechanic with 18+ outcomes and simulation validation
- [ ] **Phase 4: Backend + Sharing** — Fastify + MongoDB persistence with unique shareable URLs
- [ ] **Phase 5: Gallery** — Public opt-in gallery with pagination and score sorting
- [ ] **Phase 6: Polish** — Mobile responsiveness, performance, visual refinement (content done in Phase 2)
- [ ] **Phase 7: Story Mode Shell + Character Roster** — Isolated `/story` route, Story Mode spin loop, auto-named roster, sell mechanic
- [ ] **Phase 8: Tiered Spin System** — Story Mode content unlock (Common → Legendary) gated by area progression
- [ ] **Phase 9: Enemy Generation** — Randomly generated Normal / Elite / Boss enemies constrained to tier brackets
- [ ] **Phase 10: Card Combat** — Turn-based card battle using wheel stats as combat values; power abilities; weakness exploitation
- [ ] **Phase 11: Story Areas** — 7-area linear progression with fixed encounter sequences and Boss unlocks
- [ ] **Phase 12: Economy & Shop** — Story Mode-only Fate Shards currency, spin shop, sell-character pricing

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Animation Foundation | 3/3 | Complete | 2026-05-15 |
| 2. Full 23-Spin Game Loop | 5/5 | Complete | 2026-05-16 |
| 3. Redemption Spin | 1/1 | Complete | 2026-05-16 |
| 4. Backend + Sharing | 0/? | Not started | — |
| 5. Gallery | 0/? | Not started | — |
| 6. Polish | 0/? | Not started | — |
| 7. Story Mode Shell + Roster | 0/? | Not started | — |
| 8. Tiered Spin System | 0/? | Not started | — |
| 9. Enemy Generation | 0/? | Not started | — |
| 10. Card Combat | 0/? | Not started | — |
| 11. Story Areas | 0/? | Not started | — |
| 12. Economy & Shop | 0/? | Not started | — |
