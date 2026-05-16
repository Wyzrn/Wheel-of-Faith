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

### Phase 6: Content + Polish
**Goal:** User encounters a rich, non-repetitive content pool across all spin categories — with full flavor text, minimum counts met, and the game running smoothly on mobile.
**Mode:** mvp
**Requirements:** CONT-01, CONT-02, CONT-03, CONT-04, CONT-05, CONT-06, CONT-07, CONT-08
**Success Criteria:**
1. Race wheel contains 35+ races with correct rarity weighting — in 100 playthroughs, Legendary races appear roughly 2% of the time and Common races roughly 35% of the time
2. Powers pool contains 1,000+ unique entries spanning the full tonal range from epic to absurd; two characters generated back-to-back rarely share more than one power
3. Weapons pool contains 500+ unique entries and Weaknesses pool contains 500+ unique entries; both span epic-to-absurd tonal range
4. All content (powers, weapons, weaknesses, backstories, titles, enchantments, Redemption outcomes) is loadable from MongoDB via seeded JSON files, with a manifest file tracking counts against launch minimums; a pre-launch check script confirms all minimums are met before deployment
5. On a mid-range Android phone in Chrome, the full 23-spin session completes without layout overflow, animation jank, or scroll trapping

---

## Phases Summary

- [x] **Phase 1: Animation Foundation** — Validated single-wheel animation with correct easing and localStorage recovery
- [ ] **Phase 2: Full 23-Spin Game Loop** — Complete playable game loop from Race to Title with character card
- [ ] **Phase 3: Redemption Spin** — Probability-gated two-stage mechanic with 18+ outcomes and simulation validation
- [ ] **Phase 4: Backend + Sharing** — Fastify + MongoDB persistence with unique shareable URLs
- [ ] **Phase 5: Gallery** — Public opt-in gallery with pagination and score sorting
- [ ] **Phase 6: Content + Polish** — Full content pools at launch minimums, mobile polish

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Animation Foundation | 3/3 | Complete | 2026-05-15 |
| 2. Full 23-Spin Game Loop | 0/? | Not started | — |
| 3. Redemption Spin | 0/? | Not started | — |
| 4. Backend + Sharing | 0/? | Not started | — |
| 5. Gallery | 0/? | Not started | — |
| 6. Content + Polish | 0/? | Not started | — |
