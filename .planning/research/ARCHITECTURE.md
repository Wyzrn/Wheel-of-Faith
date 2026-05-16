# Architecture Patterns: Wheel of Fate

**Domain:** Browser-based sequential spin game with backend persistence
**Researched:** 2026-05-15
**Overall confidence:** HIGH (core patterns), MEDIUM (redemption probability curve)

---

## Recommended Architecture

### System Topology

```
Browser (Vanilla JS + Vite)
  └─ Game Engine Layer        (spin state machine, session accumulator)
  └─ Animation Layer          (GSAP wheel rotation, reveal choreography)
  └─ UI Layer                 (wheel canvas/SVG, character card, gallery)
  └─ API Client               (fetch wrapper, one save call at session end)

Node.js / Express API
  └─ /api/characters          (CRUD + gallery pagination)
  └─ /api/characters/:id      (single character fetch by short ID)
  └─ /api/content             (optional: serve wheel content JSON)

SQLite (better-sqlite3)
  └─ characters table         (id, title, data JSON blob, scores JSON, created_at)
```

### Component Boundaries

| Component | Responsibility | Talks To |
|-----------|---------------|----------|
| `WheelRenderer` | Draw SVG/Canvas wheel, animate rotation | `SpinEngine` (receives target angle) |
| `SpinEngine` | State machine: IDLE → SPINNING → DECELERATING → LANDED → REVEALED | `SessionAccumulator`, `WheelRenderer` |
| `SessionAccumulator` | In-memory store of all 23 spin results during a session | `SpinEngine` (writes), `CardRenderer` (reads), `APIClient` (serializes) |
| `WheelSequencer` | Orchestrates which wheel comes next; handles variable ability spin counts | `SpinEngine`, content data |
| `CardRenderer` | Renders the completed character sheet | `SessionAccumulator` |
| `APIClient` | Single `saveCharacter(payload)` call; `fetchCharacter(id)` for share links | Express API |
| `GalleryView` | Paginated list of characters; fetches from API | APIClient |
| Express Router | Route definitions, validation, error handling | SQLite via DB module |
| `DB` module | Thin wrapper around better-sqlite3 statements | SQLite file |

---

## Spinning Wheel Animation Architecture

### Rendering Approach: SVG + GSAP Rotation

Use an SVG wheel (not Canvas). SVG gives crisp segments at any size, easy DOM-based label placement, and GSAP can animate `rotation` directly on an SVG element via `svgOrigin`.

```javascript
// Wheel is an <svg> containing <g id="wheel"> with N pie-slice <path> elements
// A fixed pointer/arrow sits outside the SVG in the DOM

gsap.to("#wheel", {
  rotation: targetAngle,   // pre-computed: spins + landing angle
  duration: 4,
  ease: "power4.out",      // fast start, dramatic deceleration — best for spin reveal
  svgOrigin: "200 200",    // center of 400x400 SVG
  onComplete: () => spinEngine.transition("LANDED")
});
```

`power4.out` eases in fast and decelerates hard — exactly the feel of a real wheel slowing to a stop. Avoid `elastic` or `bounce` (unrealistic for a physical wheel).

### Spin Angle Calculation

The result is determined BEFORE the animation starts. The angle is calculated to land the pointer on the correct segment, plus enough full rotations to look dramatic.

```javascript
function calculateTargetAngle(currentRotation, segmentIndex, totalSegments, minSpins = 5) {
  const segmentAngle = 360 / totalSegments;
  // Center of the winning segment, adjusted so pointer (at top = 0 deg) lands on it
  const segmentCenter = segmentIndex * segmentAngle + segmentAngle / 2;
  const landingAngle = 360 - segmentCenter; // wheel rotates CW, pointer is fixed at top
  const fullRotations = minSpins * 360;
  // Compute net new rotation from current position
  const currentMod = currentRotation % 360;
  const delta = (landingAngle - currentMod + 360) % 360;
  return currentRotation + fullRotations + delta;
}
```

Key principle: always accumulate rotation (never reset to 0) so GSAP doesn't animate backwards between spins.

### Spin State Machine

```
IDLE
  │  user clicks SPIN (or auto-advances)
  ▼
SPINNING  ──── GSAP tween running (4s, power4.out)
  │  onComplete fires
  ▼
LANDED    ──── result locked in SessionAccumulator
  │  short delay (500ms), then reveal animation
  ▼
REVEALED  ──── result label animates in, highlight segment
  │  user clicks NEXT or auto-advance after 2s
  ▼
IDLE (next wheel) OR SESSION_COMPLETE (after spin 23)
```

State is a plain JS object — no library needed for a linear machine this simple:

```javascript
const spinEngine = {
  state: "IDLE",   // "IDLE" | "SPINNING" | "LANDED" | "REVEALED"
  transition(newState) {
    // guard valid transitions
    this.state = newState;
    this.emit(newState);
  }
};
```

---

## 23-Spin Session Flow Architecture

### Session State Design

All spin results live in a single `SessionAccumulator` object in memory. Nothing is written to the backend until the entire session completes (spin 23 resolves). This avoids partial character saves and keeps the API surface tiny.

```javascript
// SessionAccumulator shape (in-memory during play)
const session = {
  id: null,            // assigned by server after save
  completedAt: null,
  spins: {
    race: null,                  // { name, tier, score }
    racialAbilities: [],         // variable length, 1-3 items
    archetype: null,
    archetypeAbilities: [],      // variable length, 1-3 items
    backstory: null,
    height: null,                // { value, tier, score }
    strength: null,
    speed: null,
    agility: null,
    durability: null,
    iq: null,
    charisma: null,
    fightingSkill: null,
    powers: [],                  // variable length
    powerMastery: null,
    weapons: [],                 // variable length
    weaponMastery: null,
    weaponEnchantment: null,
    potential: null,
    energyLevel: null,
    weaknesses: [],              // variable length
    redemptionSpin: null,        // { earned: bool, outcome: string|null }
    title: null,
  },
  scores: {
    overallNumeric: 0,
    overallTier: "F",
    breakdown: {}    // per-category score contributions
  }
};
```

### Wheel Sequencing (Variable Ability Counts)

The `WheelSequencer` generates the ordered queue dynamically after each variable-count result lands:

```javascript
// Content data defines how many ability spins each race/archetype triggers
const CONTENT = {
  races: {
    "Celestial": { abilitySpinCount: 3, ... },
    "Human":     { abilitySpinCount: 1, ... },
  }
};

// Sequencer builds queue after race lands
function buildQueue(raceName, archetypeName) {
  const raceAbilityCount = CONTENT.races[raceName].abilitySpinCount;
  const archetypeAbilityCount = CONTENT.archetypes[archetypeName].abilitySpinCount;
  return [
    "race",
    ...Array(raceAbilityCount).fill("racialAbility"),
    "archetype",
    ...Array(archetypeAbilityCount).fill("archetypeAbility"),
    "backstory", "height", "strength", "speed", "agility",
    "durability", "iq", "charisma", "fightingSkill",
    "powers",          // count TBD from power tier result
    "powerMastery",
    "weapons",         // count TBD from weapon tier result
    "weaponMastery", "weaponEnchantment", "potential",
    "energyLevel", "weaknesses",
    "redemptionSpin", "title"
  ];
}
```

The sequencer is rebuilt as gate results arrive — not pre-computed upfront.

---

## Character Data Schema

### Database Schema (SQLite)

```sql
CREATE TABLE characters (
  id          TEXT PRIMARY KEY,          -- nanoid(10), URL-safe
  title       TEXT NOT NULL,             -- the final Title spin result, for display
  race        TEXT NOT NULL,             -- denormalized for gallery queries
  archetype   TEXT NOT NULL,             -- denormalized for gallery queries
  overall_tier TEXT NOT NULL,            -- "F"|"D"|"C"|"B"|"A"|"S"|"SS"|"SSS"|"God"
  overall_score INTEGER NOT NULL,        -- 0-1000 numeric aggregate
  spins       TEXT NOT NULL,             -- JSON blob: full SessionAccumulator.spins
  scores      TEXT NOT NULL,             -- JSON blob: SessionAccumulator.scores
  created_at  INTEGER NOT NULL           -- Unix timestamp (ms)
);

CREATE INDEX idx_characters_created_at ON characters(created_at DESC);
CREATE INDEX idx_characters_overall_score ON characters(overall_score DESC);
```

Design rationale: keep `spins` and `scores` as JSON blobs. The schema of a character's abilities is variable (different counts per race/archetype), so a normalized table of ability rows would require joins and complicated queries with no real gain at this scale. Denormalize `race`, `archetype`, `overall_tier`, `overall_score` for filtering and sorting the gallery without parsing JSON.

### JSON Spin Blob Shape

```json
{
  "race": { "name": "Celestial", "tier": "S", "score": 85 },
  "racialAbilities": [
    { "name": "Starfire Aura", "tier": "A", "score": 72 },
    { "name": "Void Step", "tier": "SS", "score": 91 },
    { "name": "Celestial Sight", "tier": "B", "score": 58 }
  ],
  "archetype": { "name": "Berserker", "tier": "A", "score": 70 },
  "archetypeAbilities": [
    { "name": "Blood Rage", "tier": "S", "score": 80 }
  ],
  "backstory": { "name": "Exiled God", "tier": "A", "score": 65 },
  "height": { "value": "6'4\"", "tier": "B", "score": 55 },
  "strength": { "tier": "SSS", "score": 97 },
  "speed": { "tier": "C", "score": 42 },
  "agility": { "tier": "B", "score": 58 },
  "durability": { "tier": "A", "score": 70 },
  "iq": { "tier": "D", "score": 28 },
  "charisma": { "tier": "SS", "score": 90 },
  "fightingSkill": { "tier": "S", "score": 83 },
  "powers": [
    { "name": "Graviton Manipulation", "tier": "SSS", "score": 99 }
  ],
  "powerMastery": { "tier": "B", "score": 55 },
  "weapons": [
    { "name": "Void Blade", "tier": "S", "score": 82 },
    { "name": "Chain Whip", "tier": "C", "score": 40 }
  ],
  "weaponMastery": { "tier": "A", "score": 75 },
  "weaponEnchantment": { "name": "Soul Drain", "tier": "SS", "score": 88 },
  "potential": { "tier": "God", "score": 100 },
  "energyLevel": { "tier": "A", "score": 72 },
  "weaknesses": [
    { "name": "Sunlight Vulnerability", "tier": "D", "score": -20 }
  ],
  "redemptionSpin": { "earned": true, "outcome": "God's Gift" },
  "title": { "name": "The Voidborn Tyrant" }
}
```

### Tier Scoring Map

```javascript
const TIER_SCORES = {
  "F":   0,
  "D":   20,
  "C":   40,
  "B":   55,
  "A":   70,
  "S":   83,
  "SS":  91,
  "SSS": 97,
  "God": 100
};
```

Overall score = weighted average of per-category scores. Category weights defined in content data (stats like Strength/Speed/Durability count more than Height). Weaknesses subtract. Redemption outcomes modify the final score.

---

## API Design

### Endpoint Table

| Method | Path | Purpose | Request | Response |
|--------|------|---------|---------|----------|
| `POST` | `/api/characters` | Save completed character | Full session JSON | `{ id, shareUrl }` |
| `GET` | `/api/characters/:id` | Fetch one character (share link) | — | Full character JSON |
| `GET` | `/api/characters` | Gallery list (paginated) | `?page=1&limit=20&sort=score` | `{ characters[], total, page }` |
| `GET` | `/api/health` | Server alive check | — | `{ ok: true }` |

Four endpoints total. No auth, no sessions. Character content data (the wheel options) is bundled with the frontend as static JSON — it does not need an API endpoint since it never changes at runtime.

### POST /api/characters

Request body: the full `SessionAccumulator` object serialized as JSON.

Server-side:
1. Validate required fields are present (race, title, overall_score)
2. Generate `id = nanoid(10)` (URL-safe, collision-negligible at this scale)
3. Insert row into SQLite
4. Return `{ id, shareUrl: "https://yourapp.com/c/" + id }`

### GET /api/characters (Gallery)

Query params: `page` (default 1), `limit` (default 20, max 50), `sort` (`recent` | `score` | `tier`).

SQL backing the gallery:
```sql
SELECT id, title, race, archetype, overall_tier, overall_score, created_at
FROM characters
ORDER BY created_at DESC   -- or overall_score DESC
LIMIT ? OFFSET ?;
```

Do not return the full `spins` JSON blob in the gallery list — only the summary columns. This keeps gallery responses small.

### Shareable Link Strategy

Use nanoid(10) with the default URL-safe alphabet (A-Za-z0-9_-). At 10 characters this gives ~10^18 combinations — effectively zero collision risk. No slugs needed (character names are not unique). No short codes (nanoid IS the short code at 10 chars).

URL pattern: `/c/:id` on the frontend routes to the character card view, which fetches `/api/characters/:id`.

Example: `https://wheeloffate.app/c/V1StGXR8_Z`

---

## Redemption Spin: Probability Algorithm

### Overview

The Redemption Spin has two stages:
1. A probability gate: does the character earn a spin at all?
2. If earned: an outcome wheel with chaotic results.

Both are driven by the character's `overall_score` (0–100 numeric scale computed from all prior spins).

### Stage 1: Probability Gate

The probability of earning the Redemption Spin is an inverse sigmoid (S-curve) centered around the midpoint score. Weak characters get high odds, strong characters get low but nonzero odds.

```javascript
/**
 * Returns the probability (0.0–1.0) of earning the Redemption Spin.
 * Uses a logistic curve: P = 1 / (1 + e^(k * (score - midpoint)))
 *
 * @param {number} score      - Overall character score, 0–100
 * @param {number} midpoint   - Score where P = 0.5 (default 45)
 * @param {number} steepness  - Curve steepness, higher = harder cutoff (default 0.12)
 */
function redemptionProbability(score, midpoint = 45, steepness = 0.12) {
  return 1 / (1 + Math.exp(steepness * (score - midpoint)));
}

// Reference values (midpoint=45, steepness=0.12):
// score=10  → ~97% chance
// score=30  → ~87% chance
// score=45  → ~50% chance
// score=60  → ~18% chance
// score=80  → ~5% chance
// score=100 → ~0.4% chance
```

To roll:
```javascript
function didEarnRedemptionSpin(overallScore) {
  return Math.random() < redemptionProbability(overallScore);
}
```

If false: the Redemption Spin wheel still animates but lands on "No Redemption" — preserving the dramatic tension. The player sees the wheel spin regardless; they only find out the result when it lands.

### Stage 2: Outcome Wheel (If Earned)

The outcome wheel is a separate weighted spin. Outcomes are partitioned into tiers with distinct character-level impact:

```javascript
const REDEMPTION_OUTCOMES = [
  // outcome, weight, effect
  { name: "God's Gift",      weight: 3,  effect: "score += 25, reroll lowest stat at S tier" },
  { name: "Inversion",       weight: 8,  effect: "swap highest and lowest stats" },
  { name: "Second Wind",     weight: 12, effect: "reroll weaknesses as neutral" },
  { name: "Cursed",          weight: 15, effect: "score -= 15, add extra weakness" },
  { name: "Forgotten Past",  weight: 20, effect: "backstory becomes 'Unknown'" },
  { name: "The Blessing",    weight: 20, effect: "upgrade one random stat by one tier" },
  { name: "Hollow Shell",    weight: 12, effect: "powers reduced to F tier" },
  { name: "Ascension",       weight: 5,  effect: "overall tier upgrades one step" },
  { name: "Twisted Fate",    weight: 5,  effect: "title replaced with ironic opposite" },
];
// weights sum to 100 for easy reading (not required — algorithm normalizes)

function weightedRandom(outcomes) {
  const total = outcomes.reduce((sum, o) => sum + o.weight, 0);
  let roll = Math.random() * total;
  for (const outcome of outcomes) {
    roll -= outcome.weight;
    if (roll <= 0) return outcome;
  }
  return outcomes[outcomes.length - 1]; // fallback
}
```

The outcome wheel displayed on screen has segments sized proportionally to weights (larger segments for more common outcomes, smaller slivers for God's Gift). This is visually honest and adds tension — players can see the tiny God's Gift sliver before the spin.

### Probability Gate Animation Approach

The probability gate is an invisible internal roll. The player sees a "Redemption Eligibility" wheel that spins first, showing a gradient from "Earned" to "No Redemption" sectors. The sector sizes are NOT exact probabilities — they are a dramatic prop. The actual result was already determined. The animation just makes it theatrical.

This is the standard gacha / loot box reveal pattern: result-first, animation-second.

---

## Gallery Pagination Architecture

### Approach: Offset Pagination

At gallery scale (hundreds to low thousands of characters), offset pagination (`LIMIT ? OFFSET ?`) is sufficient and simple. Cursor-based pagination is only needed when rows are inserted so frequently that pages shift during browsing — not a concern here.

```javascript
// Express handler
router.get("/api/characters", (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  const sort = req.query.sort === "score" ? "overall_score DESC" : "created_at DESC";

  const rows = db.prepare(
    `SELECT id, title, race, archetype, overall_tier, overall_score, created_at
     FROM characters ORDER BY ${sort} LIMIT ? OFFSET ?`
  ).all(limit, offset);

  const total = db.prepare("SELECT COUNT(*) as count FROM characters").get().count;

  res.json({ characters: rows, total, page, limit });
});
```

Gallery card shows: title, race, archetype, tier badge, score, and created date. Clicking navigates to the full character card at `/c/:id`.

---

## Data Flow Direction

```
User clicks SPIN
  │
  ▼
WheelSequencer.getCurrentWheel()
  │  returns wheel config (options, weights)
  ▼
SpinEngine.startSpin(wheelConfig)
  │  rolls weighted random, computes targetAngle
  ▼
WheelRenderer.animate(targetAngle, duration=4s, ease="power4.out")
  │  GSAP tween runs
  ▼  (onComplete)
SpinEngine.transition("LANDED")
  │  result → SessionAccumulator.record(category, result)
  │  score updated in scores.breakdown
  ▼
WheelRenderer.revealResult(segmentIndex)
  │  highlight segment, animate label in
  ▼
SpinEngine.transition("REVEALED")
  │  WheelSequencer.advance() → next wheel or SESSION_COMPLETE
  ▼
[if SESSION_COMPLETE]
  │
  ▼
SessionAccumulator.finalize()  → computes overall_score, overall_tier
  │
  ▼
APIClient.saveCharacter(session)  → POST /api/characters
  │  receives { id, shareUrl }
  ▼
CardRenderer.render(session, shareUrl)  → display character sheet
  │
  ▼
User shares link OR visits Gallery
```

Nothing is sent to the backend during the spin sequence — only at the end.

---

## Build Order / Phase Dependency Implications

The architecture has clear dependency layers. Build bottom-up:

### Phase 1 — Content Engine + Wheel Mechanics (no backend)
- Define content JSON (races, archetypes, powers, etc.) with tier and weight metadata
- Build `WheelRenderer` with GSAP rotation + `power4.out` easing
- Build `SpinEngine` state machine
- Build `WheelSequencer` with static test content
- Result: single wheel spins correctly, result determined before animation

**Nothing to save yet. All in-browser. Fast iteration.**

### Phase 2 — Full 23-Spin Session Flow
- Build `SessionAccumulator`
- Wire `WheelSequencer` to generate dynamic queue based on race/archetype results
- Build scoring system (weighted average, tier lookup)
- Build `CardRenderer` (static, unstyled character sheet)
- Result: complete playthrough in browser, character sheet renders at end

**Still no backend. Validates the full game loop before any infra.**

### Phase 3 — Redemption Spin
- Implement probability gate (`redemptionProbability()` + roll)
- Build the two-wheel reveal sequence (eligibility spin → outcome spin)
- Apply outcome effects to `SessionAccumulator` scores
- Result: Redemption Spin works as a standalone mechanic

**Build after basic flow works — Redemption depends on overall_score being computed.**

### Phase 4 — Backend + Persistence
- Set up Express + better-sqlite3
- Implement POST/GET character endpoints
- Implement nanoid ID generation
- Wire `APIClient` in frontend
- Result: characters save and share links work

**Frontend is already complete before backend starts — clean separation.**

### Phase 5 — Gallery
- Add GET /api/characters with pagination
- Build `GalleryView` component
- Result: gallery browses saved characters

**Gallery is purely additive — doesn't change anything in the game loop.**

### Phase 6 — Polish
- Styling, sound effects, mobile responsiveness
- Content volume (30+ races, etc.)
- Share metadata (Open Graph tags for shareable links)

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Saving After Each Spin
**What:** POST to backend after every wheel result to "not lose progress."
**Why bad:** Creates 23 API calls per session, leaves partial characters in DB, complicates the data model, adds latency during the dramatic reveal sequence.
**Instead:** Accumulate in-memory, single save at session end. If user leaves early, the character is simply lost — that's fine, they haven't finished.

### Anti-Pattern 2: Determining Result From Animation
**What:** Letting the wheel spin freely and reading where it stopped to determine the result.
**Why bad:** Float rounding errors, off-by-one segment bugs, impossible to reproduce results. The animation is a prop, not the game mechanic.
**Instead:** Always determine result first (weighted random), then compute the landing angle to display that result.

### Anti-Pattern 3: Canvas for the Wheel
**What:** Drawing wheel segments on HTML5 Canvas.
**Why bad:** Canvas requires manual hit testing, pixel-based scaling, complex redraw loops. Harder to style, no browser accessibility.
**Instead:** SVG pie slices with `<path>` elements. GSAP animates the `<g>` wrapper's `rotation` directly. Labels are `<text>` elements — they can be styled with CSS.

### Anti-Pattern 4: Normalized Ability Tables
**What:** Separate DB tables for racial abilities, archetype abilities, powers, weapons.
**Why bad:** Variable-length arrays across 5+ categories require joins or complex queries. Schema migrations needed every time ability rules change.
**Instead:** JSON blob for the full spin data. Denormalize only what you actually filter/sort by (race, archetype, score, tier).

### Anti-Pattern 5: Complex ID Strategy
**What:** UUIDs (v4) for share links.
**Why bad:** UUIDs are 36 characters — ugly in URLs. They're overkill for the collision risk at this scale.
**Instead:** `nanoid(10)` — 10 URL-safe characters, ~10^18 combinations, collision risk negligible for thousands of characters.

---

## Scalability Notes

This application does not need horizontal scaling for its initial lifecycle. SQLite + a single Node process handles thousands of concurrent readers easily (better-sqlite3 is synchronous and extremely fast for read-heavy workloads).

If the gallery grows to 100K+ characters: add a `score DESC, id DESC` composite index and consider moving to PostgreSQL. That migration is a day's work if it ever becomes necessary — do not pre-optimize.

---

## Sources

- GSAP Skills documentation (Context7: `/greensock/gsap-skills`) — rotation, easing, timeline sequencing — HIGH confidence
- GSAP InertiaPlugin documentation (Context7: `/websites/gsap`) — spin deceleration patterns — HIGH confidence
- Express v5 documentation (Context7: `/websites/expressjs_en_5`) — routing patterns — HIGH confidence
- better-sqlite3 documentation (Context7: `/wiselibs/better-sqlite3`) — JSON column storage, synchronous API — HIGH confidence
- Nanoid documentation (Context7: `/ai/nanoid`) — short ID generation — HIGH confidence
- MDN Web Animations API — `updatePlaybackRate()` deceleration pattern — MEDIUM confidence (verified from official MDN)
- Logistic function probability curve — standard statistics; parameters (midpoint=45, steepness=0.12) are design choices, not empirically validated — MEDIUM confidence on curve shape, LOW confidence on specific parameter values (tune during implementation)
