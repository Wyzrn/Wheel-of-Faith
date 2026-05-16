# Requirements — Wheel of Fate

**Version:** v1
**Last updated:** 2026-05-15
**Status:** Approved

---

## v1 Requirements

### Core Loop

- [ ] **CORE-01**: User sees an animated spinning wheel graphic (SVG segments, GSAP `power4.out` deceleration) that slows and lands on a result for each spin
- [ ] **CORE-02**: User completes 23 spin categories in fixed order: Race → Racial Ability Spin(s) → Archetype → Archetype Ability Spin(s) → Backstory → Height → Strength → Speed → Agility → Durability → IQ → Charisma → Fighting Skill → Power(s) → Power Mastery → Weapon(s) → Weapon Mastery → Weapon Enchantment → Potential → Energy Level → Weakness(s) → Redemption Spin → Title
- [ ] **CORE-03**: Number of racial ability spins is determined by the race result (1–4); number of archetype ability spins is determined by archetype result (1–4) — queue is built dynamically after each variable-count result lands
- [ ] **CORE-04**: Each stat wheel (Strength, Speed, Agility, Durability, IQ, Charisma, Fighting Skill, Potential, Energy Level) displays a letter tier (F → D → C → B → A → S → SS → SSS → God) and a numeric score (1–100)
- [ ] **CORE-05**: User session progress is saved to localStorage after every completed spin; if user reloads mid-session, they are offered to resume from where they left off

### Scoring + Redemption

- [ ] **REDEM-01**: Overall character score is computed from all stat spins using a shared `scoreTier()` utility function; tier letter is always derived from score, never stored independently
- [ ] **REDEM-02**: Redemption Spin stage 1 — a probability wheel is spun; chance of landing on Redemption is weighted inversely to overall character score (low score = high chance, capped at 85%; high score = low chance, floored at 5%); result is pre-determined before animation starts
- [ ] **REDEM-03**: If Redemption is earned, stage 2 spins a second wheel with 18+ chaotic outcomes (examples: Inversion — all stats flip tiers; God's Gift — worst stat becomes God tier; Wild Card — complete character re-roll; Cursed — best stat drops to F; The Bargain — player may sacrifice Title for SSS in one stat; etc.); all outcomes have stat mutation effects applied to character sheet
- [ ] **REDEM-04**: Redemption probability curve is validated via a simulation script (10,000 random characters) before launch; target trigger rate: 25–35%

### Character Card

- [ ] **CARD-01**: After all spins complete, user sees a full styled character sheet displaying all 23 spin results, computed tier/score for each stat, and overall character tier badge
- [ ] **CARD-02**: Character card has a "Save & Share" button that persists the character to the backend and generates a shareable URL
- [ ] **CARD-03**: Character card has a "Share to Gallery" toggle that opts the character into the public gallery

### Content — Scale and Tone

- [ ] **CONT-01**: 35+ races with rarity weighting (Common ~35%, Uncommon ~45%, Rare ~18%, Legendary ~2%); each race defines ability spin count (1–4), weakness probability modifier (higher/lower than baseline), and flavor description
- [ ] **CONT-02**: 15+ archetypes each defining ability spin count (1–4) and a pool of archetype-specific abilities
- [ ] **CONT-03**: 1,000+ unique powers spanning the full tonal range — from epic (Shadow Manipulation, Time Reversal, Reality Anchor) to absurd (Balding, Aggressive Sneezing, Wet Sock Awareness, Ability to Sense Nearby Vending Machines); powers are stored in seeded database, lazy-loaded per category
- [ ] **CONT-04**: 500+ unique weapons spanning the full tonal range — from legendary (Excalibur, Mjolnir, Kusarigama) to absurd (Pineapple, Grandma's Slipper, Slightly Sharp Pencil, Frozen Fish); stored in seeded database
- [ ] **CONT-05**: 500+ unique weaknesses spanning the full tonal range — from classic (Sunlight, Silver, Running Water) to absurd (Testicular Torsion, Vague Social Anxiety, The Smell of Burnt Toast, Exposure to the Word "Moist"); race-based probability modifier affects: (a) chance of getting 0 vs 1 vs 2 vs 3 weaknesses, and (b) likelihood of drawing from the "severe" weakness pool
- [ ] **CONT-06**: 17+ backstories, 52+ titles, 15+ weapon enchantments — all with flavor text; tone range matches powers/weapons
- [ ] **CONT-07**: 18+ Redemption Spin outcomes fully defined with effect descriptions and stat mutation logic
- [ ] **CONT-08**: All content stored as seeded JS/JSON files importable into MongoDB; counts tracked in a manifest file; launch gates on minimums being met

### Backend + Persistence

- [ ] **BACK-01**: Fastify 5 + MongoDB (Mongoose) backend saves completed character as a document; `spins` stored as JSON blob; `race`, `archetype`, `overall_score`, `overall_tier` denormalized as real fields for querying
- [ ] **BACK-02**: Each saved character gets a nanoid(10) share ID; character is accessible at `/character/[id]`
- [ ] **BACK-03**: Characters are soft-deleted only (`deleted_at` timestamp); a missing or deleted character ID shows a styled "This fate has been lost to the multiverse" 404 page
- [ ] **BACK-04**: `POST /api/characters` validates minimum session completion time (reject if under 90 seconds) and applies IP rate limiting to prevent gallery spam

### Gallery

- [ ] **GALL-01**: Public gallery lists characters that opted into sharing, showing summary card (Title, Race, Archetype, overall tier badge, score, creation date)
- [ ] **GALL-02**: Gallery supports offset pagination; default sort is newest first; secondary sort by overall score available
- [ ] **GALL-03**: Clicking a gallery card navigates to the full character card at `/character/[id]`

---

## v2 Requirements (Deferred)

- Full archetype ability pools (8–12 entries per archetype; stub names exist, writing deferred)
- Open Graph / social card metadata on character card pages (share preview image)
- Gallery filtering by race, archetype, or tier
- "The Bargain" interactive timer (10s auto-select to preserve fate aesthetic)
- Admin soft-delete tooling for gallery moderation
- Sound design / audio reveal cues

---

## Out of Scope

- Login / accounts — characters identified by share link only; no auth in v1
- Re-spin buttons (other than Redemption Spin) — defeats the fate concept, kills tension
- Manual character customization — randomness is the product
- Combat or gameplay beyond character creation — future milestone
- Mobile native app — responsive web only
- Multiplayer or real-time features

---

## Traceability

| REQ-ID | Phase |
|--------|-------|
| CORE-01 | Phase 1 |
| CORE-02 | Phase 2 |
| CORE-03 | Phase 2 |
| CORE-04 | Phase 2 |
| CORE-05 | Phase 1 |
| REDEM-01 | Phase 2 |
| REDEM-02 | Phase 3 |
| REDEM-03 | Phase 3 |
| REDEM-04 | Phase 3 |
| CARD-01 | Phase 2 |
| CARD-02 | Phase 4 |
| CARD-03 | Phase 5 |
| CONT-01–02 | Phase 2 (stub) + Phase 6 (full) |
| CONT-03–05 | Phase 6 (content sprint) |
| CONT-06–08 | Phase 6 (content sprint) |
| BACK-01–04 | Phase 4 |
| GALL-01–03 | Phase 5 |
