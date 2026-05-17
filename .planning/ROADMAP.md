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

### Phase 7: Character Roster
**Goal:** Players can store generated characters in a persistent roster with auto-generated fantasy names, view compact character cards, and sell unwanted characters for Fate Shards.
**Requirements:** ROST-01, ROST-02, ROST-03, ROST-04
**Success Criteria:**
1. After a character is fully generated, the player is offered "Add to Roster" alongside the existing share flow; the roster persists across sessions via localStorage and backend
2. Rostered characters receive an auto-generated fantasy name (adjective + noun pattern seeded from character stats); the name is permanent and shown everywhere the character appears
3. The roster screen displays compact cards sortable by overall tier, race, or archetype; clicking a card expands the full character sheet
4. Selling a character shows its Fate Shard value (based on overall tier), requires confirmation, and is irreversible; the character is removed from the roster and the shards are added to the balance

---

### Phase 8: Tiered Spin System
**Goal:** Spin content is gated behind four progression tiers; players start with a constrained pool and unlock broader races, higher stat ceilings, and rarer content as they advance through Story Mode.
**Requirements:** PROG-01, PROG-02, PROG-03, PROG-04
**Tier definitions (based on rebalanced race weights):**
- **Tier 1 — Common** (starting): Races weight ≥ 12 (Human, Halfling, Goblin, Gnome, Robot, Dwarf); all stats capped at B; common powers and weapons only
- **Tier 2 — Uncommon**: + Races weight 7–11 (Elf, Half-Elf, Orc, Half-Orc, Tiefling, Lizardfolk, Tabaxi, Dragonborn, Aasimar, Goliath, Genasi variants, Warforged, Cyborg, Bender); stats up to A+; uncommon powers and weapons unlocked
- **Tier 3 — Rare**: + Races weight 4–6 (Shinobi, Mutant, Nen User, Titan Shifter, Namekian, Vampire, Werewolf, Dragon, Devil Fruit User, Demon, Beast, Undead, Saiyan, Symbiote, Half-Dragon, Sphinx, Githyanki, Mindflayer, Hollow, Angel); no stat cap; rare content unlocked
- **Tier 4 — Legendary**: + All remaining races weight ≤ 3 (Viltrumite, Asgardian, Kryptonian, Kaiju, Eldritch Being, Mythological Creature, Time Lord, Demi-god, God, Primordial, Creator); no restrictions; all content available
**Success Criteria:**
1. A Tier 1 spin cannot produce a race with weight < 12; locked segments are visually greyed out on the wheel with weight 0
2. Stats are hard-capped at the tier ceiling; flavor labels above the cap are dimmed and unselectable when generating a character at that tier
3. Tier unlocks are permanent and never regress; a player who reaches Tier 3 keeps it on every subsequent load
4. Each spin tier has a distinct currency cost displayed clearly in the shop before purchase

---

### Phase 9: Enemy Generation System
**Goal:** Enemies are randomly generated characters built with the same wheel content modules but constrained to a tier bracket; Normal / Elite / Boss variants scale in power and drop different Fate Shard amounts.
**Requirements:** ENEMY-01, ENEMY-02, ENEMY-03, ENEMY-04
**Enemy tiers:**
- **Normal:** Tier 1 constraints; 1–2 abilities; lower stat weight toward F–C range
- **Elite:** Tier 2 constraints; 2–3 abilities; stat weights biased toward C–A range
- **Boss:** Tier 3–4 constraints; full ability slots; unique auto-title; stat weights biased toward A–God; 3× currency drop
**Success Criteria:**
1. A Normal enemy's race, stats, and powers never exceed Tier 1 thresholds; validated at generation time
2. Bosses always have a unique title generated from the title pool, at least 2 weaknesses, full ability count for their race/archetype, and Power Mastery of B or higher
3. Enemy generation is seeded per (area index + encounter index) so the same playthrough always produces the same enemies in the same order
4. Enemy character cards display name, race, archetype, key stats, powers list, weaknesses, and estimated currency drop before combat begins

---

### Phase 10: Card Combat System
**Goal:** Player selects a rostered character to fight a generated enemy in a turn-based card battle where wheel stats drive combat values; powers function as limited-use abilities; weaknesses are exploitable.
**Requirements:** COMBAT-01, COMBAT-02, COMBAT-03, COMBAT-04, COMBAT-05
**Stat → combat mapping:**
- **Max HP:** (Durability score + Energy Level score) / 2, scaled to a readable range (e.g. 50–500)
- **Attack:** Strength score + Fighting Skill score
- **Defense (damage reduction %):** Agility score × 0.3, capped at 60%
- **Speed (turn order):** Speed score; higher Speed goes first; ties broken by Agility
- **Weapon bonus:** Weapon Mastery tier index × (1 + enchantment count × 0.15)
- **Power uses:** Power Mastery score ÷ 20, rounded up; each power can be used that many times total per fight
- **Crit chance:** Potential score × 0.2%, capped at 25%
**Success Criteria:**
1. Combat is turn-based; each turn the player chooses Attack, Use Power, or Defend; enemy AI follows a weighted random decision tree biased toward Attack
2. Powers are categorized into effect types (damage burst, heal, stun, shield, bleed) derived from a keyword map on the power label; effect type is displayed on the power card
3. Weaknesses are exploitable — if a player power's effect type matches an enemy weakness keyword, that power deals 1.5× damage and displays a "WEAKNESS HIT" indicator
4. Losing a combat applies a 10% Fate Shard penalty on current balance but does not remove the character from the roster; the player may retry with a different character
5. Post-combat summary screen shows: damage dealt, damage taken, powers used, weaknesses exploited, and Fate Shards earned

---

### Phase 11: Story Areas & Boss Progression
**Goal:** Story Mode is structured as seven unlockable areas in a fixed linear sequence; each area has a defined encounter composition ending in a Boss fight; defeating a Boss unlocks the next area and may award a spin tier upgrade.
**Requirements:** STORY-01, STORY-02, STORY-03, STORY-04
**Area sequence:**
1. **The Beginner's Bog** — Tutorial pacing; 4 Normal encounters; no Boss; unlocks Tier 1 spins on first completion
2. **Goblin Market** — 3 Normal → 1 Elite → 3 Normal → Boss (Tier 1 Boss); defeating Boss unlocks Area 3 and Tier 2 spins
3. **The Iron Citadel** — 2 Normal → 2 Elite → 1 Normal → Boss (Tier 2 Boss); defeating Boss unlocks Area 4
4. **Shattered Highlands** — 2 Normal → 2 Elite → 2 Elite → Boss (Tier 2–3 Boss); defeating Boss unlocks Area 5 and Tier 3 spins
5. **The Abyssal Rift** — 1 Normal → 3 Elite → 1 Normal → Boss (Tier 3 Boss); defeating Boss unlocks Area 6
6. **Celestial Spire** — 4 Elite → 2 Boss encounters; defeating the second Boss unlocks Area 7 and Tier 4 spins
7. **The Void Beyond** — 2 Elite → Final Boss (Tier 4, seeded unique); defeating Final Boss triggers end-game screen and unlocks infinite run mode
**Success Criteria:**
1. The player cannot skip encounters within an area; completing each fight advances the encounter index
2. Defeating an area Boss permanently marks that area as cleared; re-entering replays encounters for farming but the Boss does not re-grant the tier upgrade
3. Each area applies a visual theme: distinct background color gradient, enemy name prefix pool (e.g. "Bog-", "Iron ", "Void "), and area-specific flavor text on the encounter card
4. Player's current area and encounter index persist in both localStorage and backend; reloading drops the player back at the start of the current encounter (not the start of the area)

---

### Phase 12: Economy & Shop
**Goal:** Fate Shards earned from combat and character sales can be spent in a spin shop to generate new rostered characters at different tier levels; the shop reflects story-gated unlock state.
**Requirements:** ECON-01, ECON-02, ECON-03, ECON-04
**Spin costs:**
- Tier 1 spin: 50 Fate Shards
- Tier 2 spin: 175 Fate Shards
- Tier 3 spin: 500 Fate Shards
- Tier 4 spin: 1,200 Fate Shards
**Currency drops:**
- Normal enemy win: 15–30 Fate Shards (randomised in range)
- Elite enemy win: 50–90 Fate Shards
- Boss win: 220–380 Fate Shards (+ tier upgrade reward on first clear)
**Character sell values (based on overall tier):**
- F–D overall: 20–55 Fate Shards
- C–B overall: 70–130 Fate Shards
- A–S overall: 160–320 Fate Shards
- SS+ overall: 500 Fate Shards base + 100 per tier above SS
- God overall: 2,000 Fate Shards
**Success Criteria:**
1. Fate Shard balance persists across sessions; closing and reopening the game returns the exact balance
2. The shop shows all four spin tiers; tiers not yet unlocked via story show a locked state with the area required to unlock them
3. Purchasing a spin immediately starts a full wheel generation session; the resulting character is auto-named and added to the roster on completion
4. The economy is balanced so a player needs ~3–5 Normal wins to afford a Tier 1 spin, ~2–3 Boss clears to afford a Tier 4 spin

---

## Phases Summary

- [x] **Phase 1: Animation Foundation** — Validated single-wheel animation with correct easing and localStorage recovery
- [x] **Phase 2: Full 23-Spin Game Loop** — Complete playable game loop from Race to Title with character card (includes all content authoring per D-09)
- [x] **Phase 3: Redemption Spin** — Probability-gated two-stage mechanic with 18+ outcomes and simulation validation
- [ ] **Phase 4: Backend + Sharing** — Fastify + MongoDB persistence with unique shareable URLs
- [ ] **Phase 5: Gallery** — Public opt-in gallery with pagination and score sorting
- [ ] **Phase 6: Polish** — Mobile responsiveness, performance, visual refinement (content done in Phase 2)
- [ ] **Phase 7: Character Roster** — Persistent roster with auto-generated names, compact card UI, sell mechanic
- [ ] **Phase 8: Tiered Spin System** — Progressive content unlock (Common → Legendary) tied to story progression
- [ ] **Phase 9: Enemy Generation** — Randomly generated Normal / Elite / Boss enemies constrained to tier brackets
- [ ] **Phase 10: Card Combat** — Turn-based card battle using wheel stats as combat values; power abilities; weakness exploitation
- [ ] **Phase 11: Story Areas** — 7-area linear progression with fixed encounter sequences and Boss unlocks
- [ ] **Phase 12: Economy & Shop** — Fate Shards currency, spin shop, sell-character pricing

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Animation Foundation | 3/3 | Complete | 2026-05-15 |
| 2. Full 23-Spin Game Loop | 5/5 | Complete | 2026-05-16 |
| 3. Redemption Spin | 1/1 | Complete | 2026-05-16 |
| 4. Backend + Sharing | 0/? | Not started | — |
| 5. Gallery | 0/? | Not started | — |
| 6. Polish | 0/? | Not started | — |
| 7. Character Roster | 0/? | Not started | — |
| 8. Tiered Spin System | 0/? | Not started | — |
| 9. Enemy Generation | 0/? | Not started | — |
| 10. Card Combat | 0/? | Not started | — |
| 11. Story Areas | 0/? | Not started | — |
| 12. Economy & Shop | 0/? | Not started | — |
