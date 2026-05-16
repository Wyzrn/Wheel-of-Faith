# Domain Pitfalls: Wheel of Fate

**Domain:** Browser-based animated wheel spin character creation game
**Researched:** 2026-05-15
**Confidence:** HIGH for engineering pitfalls (well-documented patterns); MEDIUM for game balance
  pitfalls (project-specific, requires playtesting to fully validate)

---

## Critical Pitfalls

Mistakes in this category cause rewrites, player abandonment, or broken core mechanics.

---

### Pitfall 1: Wrong Easing Curve Makes the Spin Feel Fake

**What goes wrong:**
The wheel decelerates linearly or with a symmetric ease-in-out. The result is that the
wheel feels like it's stopping on command rather than being thrown and caught — it has no
physical weight. Players immediately sense something is off, even if they cannot name it.
The opposite failure is using pure `ease-out` (cubic-bezier) with a long tail that drags
forever, making users wait impatiently with no payoff moment.

**Why it happens:**
Developers reach for CSS `transition: transform ease-out 3s` because it is the default
mental model for "spinning things slow down." The problem is that CSS ease-out is
symmetrical about its inflection point; a real spinning wheel has most of its deceleration
front-loaded and a very slow crawl at the end. When the crawl is too slow and the
deceleration too gradual, it looks like it is still spinning and then awkwardly stops.

**Consequences:**
- The landing moment — the single most satisfying beat in the entire game — feels flat
- Players reload to "see if it works better" or assume the game is broken
- On mobile, smooth CSS transitions get janked by paint thrashing; the wrong easing
  makes this more visible because there is no sharp moment of resolution

**Prevention:**
Use a custom cubic-bezier that front-loads deceleration heavily:
`cubic-bezier(0.17, 0.67, 0.12, 0.99)` or similar. The key shape: fast start,
most of the slowdown in the first 30% of duration, very gentle final 10% crawl.
Do NOT use `ease`, `ease-in-out`, or `linear`. Implement via `requestAnimationFrame`
with a custom easing function rather than CSS transitions if fine control is needed —
this also makes it easier to calculate where the wheel will actually land before the
animation begins, which prevents the "snap correction" bug (see Pitfall 2).

**Warning signs:**
- QA feedback: "it doesn't feel satisfying when it stops"
- Developers adjusting `transition-duration` repeatedly trying to fix feel
- The wheel visually stops mid-segment rather than cleanly on a label

**Phase to address:** Phase 1 (core wheel animation). Get this right before building
all 23 wheels on top of it. A wrong easing baked into a shared component is a full
rewrite.

---

### Pitfall 2: Result Determined After Animation, Not Before ("Snap Correction")

**What goes wrong:**
The code picks a random result, starts the wheel spinning, then at the end of the
animation tries to rotate the wheel graphic to land on that result's position. Because
floating-point rotation math accumulated over the animation does not perfectly match the
computed landing angle, the wheel visibly snaps by 1-3 degrees at the very end. On
high-refresh screens this looks like a glitch. On low-end hardware where frames drop, it
looks catastrophically wrong.

**Why it happens:**
Developers separate the concerns of "what did we roll" (random number) from "where does
the wheel stop" (animation). They seem independent, but they must be fused. The roll must
be determined first, then the target rotation angle computed, then the animation driven
toward that exact angle.

**Consequences:**
- Visible snap/glitch on landing, destroying the reveal moment
- On mobile, dropped frames make the snap worse and more likely
- Impossible to fix without refactoring the animation architecture

**Prevention:**
Always determine the result before the animation starts. Compute the exact target angle
(segment midpoint in degrees + full rotations for drama) before the first frame. Drive the
animation toward that fixed target. The result is known to the game logic the moment the
user clicks Spin; the animation is purely theatrical.

**Warning signs:**
- Code contains any rotation-to-result mapping at the END of an animation callback
- The landing angle is computed from `currentRotation % 360` rather than from the result

**Phase to address:** Phase 1 (core wheel animation architecture). Non-negotiable
constraint on how the wheel component is built.

---

### Pitfall 3: Result Reveal Timing Mismatch

**What goes wrong:**
The text result (e.g. "You are a Void Elf!") appears at the wrong time relative to the
wheel stopping. Either it appears before the wheel fully settles (breaking the mystery) or
it appears 1-2 seconds after the wheel has obviously stopped (creating a confused,
dead-air pause). Both destroy the dramatic beat.

**Why it happens:**
The reveal is triggered by a `setTimeout` or `transitionend` event that does not exactly
match the wheel animation duration after accounting for easing. CSS `transitionend` fires
at the nominal end of transition time but the easing tail may make the wheel appear to
stop 200-400ms before it technically completes. Or the developer adds a hardcoded delay
that is slightly wrong.

**Consequences:**
- The single best moment of each spin — the reveal — feels amateur
- Multiplied across 23 spins, even a slight misalignment becomes exhausting

**Prevention:**
Fire the reveal at the visual stop, not the animation end. If using CSS transitions, listen
for `transitionend` then add a short (100-150ms) intentional pause before reveal — this
creates a satisfying beat of "the wheel has stopped... and now you know." This pause should
be a named constant (`REVEAL_DELAY_MS = 150`), not a magic number. Sound design (a
satisfying "thock" on landing + a reveal sound) masks minor timing imprecision.

**Warning signs:**
- Reveal logic uses hardcoded milliseconds matching animation duration exactly
- No pause between wheel-stop and text reveal
- QA notes "it feels like it already shows the answer before it lands"

**Phase to address:** Phase 1 alongside easing. Shared timing constants across all 23
wheels.

---

### Pitfall 4: Mobile Performance Collapse from Canvas/Transform Thrashing

**What goes wrong:**
The wheel renders fine at 60fps on a desktop, but on a mid-range Android phone it drops to
15-20fps during the spin, making the animation look broken. On older iOS devices it hitches
every 500ms as the garbage collector runs.

**Why it happens:**
Two common causes. First: animating properties that trigger layout (width, height, top,
left) instead of compositor-only properties (transform, opacity). The browser must
recalculate layout on every frame. Second: if using canvas, drawing all wheel segments
with stroke + fill + text on every frame without caching the static wheel image as an
offscreen canvas — the text rendering cost alone is prohibitive.

**Consequences:**
- Core gameplay is broken on half the likely target devices (target audience skews mobile)
- Performance cannot be fixed without changing the rendering approach

**Prevention:**
- Use `transform: rotate()` exclusively for wheel rotation, never layout properties
- Add `will-change: transform` to the wheel element before animation starts, remove after
- If canvas: draw the static wheel once to an offscreen canvas, then on each frame only
  composite that cached image at the current rotation angle
- Test on a physical mid-range Android (or emulator at 4x CPU throttle) in Phase 1,
  not after all 23 wheels are built

**Warning signs:**
- Chrome DevTools Performance tab shows "Layout" bars during animation frames
- Canvas implementation calls `fillText()` on every frame
- Wheel implementation uses absolute positioning changes for rotation

**Phase to address:** Phase 1. Mobile performance must be validated on the single wheel
prototype before the animation approach is locked in.

---

### Pitfall 5: Power Creep and Tier Uselessness

**What goes wrong:**
Some races/archetypes/powers are numerically or narratively dominant, so players who roll
them feel they "won the lottery" while players who roll lower tiers feel cheated. The
gallery fills with SSS-tier characters and F-tier results are never shared. The game
becomes about trying to re-roll rather than accepting your character.

**Why it happens:**
Content is written sequentially — early races/powers get more development and seem cooler.
Later additions are rushed. Or the tier system maps to real-world pop-culture power levels
that have implicit rankings players already know (a "God-tier wizard" vs. "F-tier peasant"
carries cultural baggage).

**Consequences:**
- Players refresh and restart repeatedly rather than committing to characters
- If re-rolling is not prevented, the game is just a viewer, not a game
- Gallery becomes a highlight reel rather than a record of fate — destroying the brand

**Prevention:**
- Each tier must have a clear narrative identity, not just a number. F-tier is not "weak,"
  it is "underdog with hidden potential." Design lore text that makes F-tier characters
  feel interesting, not pathetic.
- Write content in tier batches (all F-tier races first, then all C-tier, etc.) rather
  than writing all content for one race then moving to the next. This keeps tier
  "temperature" consistent.
- The Redemption Spin is the mechanical answer to bad rolls — lean into it in the lore and
  UI. "Your character rolled badly — but fate is not done with them yet."
- Do not allow re-spins on individual wheels. The spin is final by design.

**Warning signs:**
- Any power/race has no obvious "cool" narrative hook in its lowest tier
- Players in playtesting say "I got garbage, can I try again?"
- Gallery shows heavy skew toward S/SS/SSS characters

**Phase to address:** Content phase (Phase 2 or 3). Must be baked into content
guidelines before writing 30+ races, not retrofitted.

---

### Pitfall 6: Redemption Spin Probability Miscalibration

**What goes wrong:**
The probability of triggering the Redemption Spin (the "do you earn a chance at
redemption?" wheel) is calculated from the character's overall power score, but the
formula is wrong in one of two directions:

- **Always fires:** If the threshold is too easy to hit (e.g., any character below
  median score gets a redemption spin), then the majority of characters get one, making it
  feel routine rather than earned. The dramatic weight evaporates.
- **Never fires for average characters:** If the formula requires an extremely low score
  (only bottom 10th percentile), and the probability wheel itself has a low redemption
  rate for moderate scores, most players never see it. The mechanic might as well not exist.

**Why it happens:**
Probability thresholds are guessed upfront without simulation data. The actual score
distribution across all possible 23-spin combinations is not calculated — developers
assume it will be roughly normal, but with tiered discrete outcomes it is usually skewed
(more characters cluster in the middle tiers than expected, fewer in extremes).

**Consequences:**
- The signature mechanic either becomes meaningless noise or an invisible feature
- If it fires too rarely, players do not know it exists; if too often, it loses meaning

**Prevention:**
- Before shipping, simulate 10,000 random character rolls in code and plot the score
  distribution. The redemption threshold should be calibrated to fire approximately 25-35%
  of the time based on actual simulated distribution, not intuition.
- The Redemption Spin should have its own internal probability wheel (already planned),
  where even when triggered, outcomes range from "minor buff" to "God's Gift" to "Cursed."
  This means the trigger rate can be more generous (30%) because the outcome is still
  uncertain.
- Make the probability formula transparent in code: a named function
  `calculateRedemptionChance(score, minScore, maxScore)` that can be tuned easily.

**Warning signs:**
- Redemption chance is a hardcoded percentage rather than a function of score
- No simulation run to validate distribution before content launch
- Playtesters either always get or never get a Redemption Spin

**Phase to address:** Phase implementing scoring + Redemption Spin. Must include a
simulation script as part of the deliverable, not just the feature.

---

### Pitfall 7: 23-Step Flow Session Loss on Browser Refresh

**What goes wrong:**
A player is on step 17 (Powers). They accidentally refresh the tab, close it, or lose
connection. All 17 completed spins are gone. They must start over. On mobile, the browser
may kill the tab when the user switches apps briefly. This is not a minor inconvenience
— 23 steps takes 5-10 minutes minimum. Losing that is rage-quit territory.

**Why it happens:**
The simplest implementation stores spin state in JavaScript variables in memory. Nothing
is persisted to `localStorage` or the backend until the character is "completed" and saved.
Developers defer persistence thinking "we'll add it later" and it never gets properly
designed.

**Consequences:**
- Players abandon partway through and do not return
- Without completion data, the gallery never fills because players give up at step 18
- Support burden: "I lost my character"

**Prevention:**
Persist in-progress spin state to `localStorage` after every single completed spin. The key
should be keyed to a session ID generated at step 1. On page load, check for an in-progress
session and offer to resume. This is a frontend-only solution and does not require backend
involvement — save to backend only on full completion.

The localStorage object structure per spin result:
```json
{
  "sessionId": "uuid",
  "startedAt": "ISO timestamp",
  "completedSpins": [
    { "step": 1, "category": "race", "result": "Void Elf", "tier": "A", "score": 82 }
  ]
}
```

Offer a "Resume Character" prompt on page load if an incomplete session is found. Give an
explicit "Start Over" option to clear it.

**Warning signs:**
- Spin state lives only in JavaScript variables or React/Vue component state
- There is no `localStorage.setItem` call in the spin completion handler
- The "Save Character" action only happens at step 23

**Phase to address:** Phase 1 (state architecture). Must be designed into the flow
from step one, not added after all 23 wheels are implemented.

---

### Pitfall 8: Shareable Links Returning Empty Pages

**What goes wrong:**
A player shares their character link. The recipient clicks it and gets either a 404, a
generic error page, or a blank character sheet with no data. The sharing mechanic — a core
feature — is broken as a first impression.

**Why it happens:**
Three failure modes:

1. **Missing error handling:** The frontend assumes the character fetch will succeed.
   If the character ID does not exist (typo in URL, deleted record, wrong environment),
   the fetch fails and the component renders with `undefined` data, producing blank fields
   or a JavaScript crash.

2. **Database record deleted:** No soft-delete policy. Characters are hard-deleted in
   cleanup operations or by a mistyped admin query. The link permanently breaks.

3. **ID collision on short URLs:** If character IDs are short (6-8 chars) for readable
   URLs, collision probability is non-trivial at scale. A new character overwrites an old
   one's slot.

**Consequences:**
- The first impression of the shareable product — someone's friend sees it for the first
  time — is a broken page. No second chance at that first impression.
- Link rot causes the gallery to fill with dead links over time.

**Prevention:**
- Never hard-delete characters. Use a `deleted_at` timestamp. Soft-delete only.
- For character IDs use UUIDs (v4) on the backend; expose a shorter slug separately if
  needed for readable URLs. Never use the slug as the only identifier.
- On the character page: if the fetch returns 404, render a styled "This character's fate
  is lost to the multiverse" page — not a raw error or blank page. Include a CTA to create
  a new character.
- Test the 404 state as part of the shareable link feature acceptance criteria.

**Warning signs:**
- Character ID column is a short VARCHAR generated client-side
- The character detail page has no loading or error state, only a success state
- Database has no `deleted_at` column

**Phase to address:** Phase implementing backend + shareable links. The 404 page is
not optional — it must be built alongside the happy path.

---

## Moderate Pitfalls

Mistakes that degrade quality or create significant maintenance burden but do not
require full rewrites.

---

### Pitfall 9: Gallery Spam Without Rate Limiting

**What goes wrong:**
The gallery is filled with characters named "aaaaaaa", "test", or obvious troll content
within 48 hours of launch. Bots trigger the full 23-spin sequence programmatically and
create thousands of junk entries. The gallery, which is supposed to showcase the community's
fate, becomes unusable noise.

**Why it happens:**
The character save endpoint has no rate limiting because the developer assumed "who would
bother?" The answer is: bots, trolls, and stress-testers. The endpoint is trivially
discoverable by inspecting network traffic.

**Consequences:**
- Gallery feature becomes a liability instead of an asset
- Database fills with garbage data, increasing storage costs and query times
- Legitimate characters get buried

**Prevention:**
- Rate limit the character creation endpoint: maximum 3 characters per IP per hour at
  minimum. Use a library like `express-rate-limit`.
- Consider requiring a simple proof-of-work or honeypot field on submission (not CAPTCHA,
  which kills UX, but a server-verified token issued at session start that must be submitted
  with the final save).
- Add a minimum time-to-complete validation: if a character is submitted less than
  90 seconds after session start, reject it as implausible (23 spins cannot be completed
  that fast by a human).
- Soft-launch the gallery — make it opt-in ("Share to Gallery") rather than saving all
  characters automatically.

**Warning signs:**
- Character save is a single POST endpoint with no authentication or rate limiting
- Gallery is auto-populated from all saves rather than opt-in
- No server-side validation of completion time

**Phase to address:** Phase implementing the gallery and backend endpoints.

---

### Pitfall 10: Ability Array Schema That Cannot Evolve

**What goes wrong:**
Racial abilities and archetype abilities are variable in count (a race might grant 1, 2,
or 3 abilities). Storing them as a comma-separated string in a single column
(`abilities = "Fire Breath, Wing Flight, Dragon Roar"`) works initially but breaks the
moment you need to query "which characters have Fire Breath" or add per-ability
metadata (mastery level, score contribution).

**Why it happens:**
It is the fastest implementation. The developer knows it is a shortcut but plans to
"clean it up later." Later never comes, or the migration is painful.

**Consequences:**
- Cannot query or filter characters by specific ability
- Cannot add per-ability metadata without a schema migration
- JSON parsing errors if an ability name contains a comma
- Makes the gallery's future filter features impossible without full schema rework

**Prevention:**
Use a proper relational table from the start:

```sql
CREATE TABLE character_abilities (
  id          SERIAL PRIMARY KEY,
  character_id UUID REFERENCES characters(id) ON DELETE CASCADE,
  category    VARCHAR(50),  -- 'racial', 'archetype', 'power', 'weapon'
  ability_name VARCHAR(200),
  tier        VARCHAR(10),
  score       INTEGER,
  spin_order  INTEGER       -- which spin in the sequence this was
);
```

If using a document database (MongoDB), store abilities as a properly typed array of
objects, not a string. Either way: never store lists as delimited strings.

**Warning signs:**
- ERD has a single `abilities` column of type TEXT or VARCHAR
- Schema uses `JSON.stringify()` to serialize arrays before INSERT

**Phase to address:** Phase 1 (backend schema). Schema migrations on a live system
are painful. Get this right before inserting any real data.

---

### Pitfall 11: Tier + Score Schema Ambiguity

**What goes wrong:**
The dual system (letter tier F→God + numeric score) creates a question: is the tier
computed from the score, or are they independent? If they are independent and can
disagree (tier="A", score=12) the database becomes inconsistent. If the tier is always
derived from score, then storing both creates redundancy that can drift.

**Why it happens:**
The design says "tier + score" without specifying which is authoritative. Developers
implement it differently in different parts of the codebase. The backend stores both;
the frontend sometimes recomputes tier from score using a slightly different threshold
table.

**Consequences:**
- A character displayed on their shareable link shows "A-Tier" but the gallery sort
  by tier puts them in B-Tier
- Score thresholds change; stored tier letters are now wrong for old characters

**Prevention:**
Decide and document which is authoritative before writing any schema:
- **Recommended:** Store only the numeric score. Compute tier letter from score using a
  single shared `scoreTier(score)` function that lives in one place (a shared utility
  module imported by both frontend and backend). Never store tier letter in the database.
  On display, always compute tier from stored score. This means tier thresholds can be
  tuned without a data migration.

**Warning signs:**
- Database schema has both `tier VARCHAR` and `score INTEGER` columns
- Tier thresholds are defined in more than one place in the codebase

**Phase to address:** Phase 1 (schema design) and content phase (tier threshold
definition). Must be resolved before any character data is persisted.

---

### Pitfall 12: Too Little Content at Launch Causing Immediate Repetition

**What goes wrong:**
The game launches with 10 races, 8 archetypes, 20 powers, 15 weapons. Players spin twice
and get the same race they just had. The pool feels small, the game feels like a demo.
Players share two characters and notice they share 70% of the same elements.

**Why it happens:**
Content takes longer to write than code. The developer finishes all the mechanics and
fills in content placeholders with "enough to ship," planning to add more later. But the
launch audience judges the product on launch-day content.

**Consequences:**
- Early adopters churn, word of mouth is "it's cool but feels thin"
- Low variety means gallery is boring — killing the gallery's social purpose
- Adding content post-launch requires reviewing and potentially rebalancing scores

**Prevention:**
Establish a minimum content threshold before any public launch:
- Races: 30 minimum (already stated in PROJECT.md — hold to it)
- Archetypes: 20 minimum
- Powers: 50 minimum (with tier distribution: 20% F/D, 30% C/B, 30% A/S, 20% SS/SSS/God)
- Weapons: 30 minimum
- Backstories: 25 minimum (these repeat less noticeably but still need variety)
- Titles: 50 minimum (final reveal, must feel unique)

Track content counts in a content manifest file during development. Block ship until
minimums are met.

**Warning signs:**
- Any wheel category has fewer than 15 entries during content development
- No content manifest tracking counts
- Content added "as we go" without a target

**Phase to address:** Content phase. Set targets before writing a single race. Do not
start writing content without the targets in place.

---

### Pitfall 13: Loading All Wheel Data Upfront Causes Slow First Load

**What goes wrong:**
All content for all 23 wheels is bundled into a single JavaScript file or fetched in a
single API call on page load. If the content file grows to 500KB+ (likely with 30 races
× abilities + 50 powers × descriptions + 50 titles + etc.), the initial page takes
3-5 seconds to become interactive on a mobile connection.

**Why it happens:**
It is simpler. One fetch, then everything is available. Developers defer bundle size
concerns to "optimization later."

**Consequences:**
- High bounce rate before the first spin — users leave before the game loads
- Core Web Vitals suffer; if this is ever SEO-relevant, it matters
- Mobile users on slower connections are effectively excluded

**Prevention:**
Lazy-load by wheel category. The user only needs Race data on step 1. They do not need
Powers data until step 14. Fetch each category's data when the player reaches that step
(or one step ahead, prefetching the next wheel while the current animation plays).

Structure the API accordingly:
```
GET /api/content/race        → race data only
GET /api/content/archetype   → archetype data only
GET /api/content/powers      → powers data only
```

Keep the initial page load to: core UI assets + Race data only. Everything else loads
progressively. Target: < 200KB initial transfer, < 1.5s first contentful paint on 4G.

**Warning signs:**
- Single `contentData.js` file or `/api/content/all` endpoint
- Content fetched in a single `useEffect` or `DOMContentLoaded` handler for all categories
- Bundle analysis shows content data embedded in the JS bundle

**Phase to address:** Phase 1 (content API design) and content loading phase. The API
shape must support lazy loading from the start.

---

## Minor Pitfalls

Issues that add friction but are correctable without major rework.

---

### Pitfall 14: No Visual Indicator of Which Spin You Are On

**What goes wrong:**
The player is on spin 11 (Charisma) but does not know they are 11/23 of the way through.
There is no progress indicator. Long sessions feel interminable because players do not know
how close they are to the end.

**Prevention:**
Display a persistent step counter ("Spin 11 of 23") and a progress bar throughout the
flow. This is a single component, trivial to build, high impact on UX.

**Phase to address:** Phase 1 (flow UI scaffold).

---

### Pitfall 15: No Fallback for When a Wheel Category Has One or Zero Items

**What goes wrong:**
A coding error or content gap leaves a wheel category with zero entries. The random
selection returns `undefined`, which propagates through the scoring system and produces
`NaN` scores, `undefined` tier letters, and a character card with blank fields.

**Prevention:**
Validate all content arrays at server startup. If any category has fewer than the required
minimum entries, log a fatal error and refuse to start. Never let `undefined` reach the
spin logic — add a guard:
```javascript
if (!items || items.length === 0) {
  throw new Error(`Wheel category "${category}" has no items. Content validation failed.`);
}
```

**Phase to address:** Content phase + backend startup validation.

---

### Pitfall 16: Variable Ability Count Not Reflected in Step Counter

**What goes wrong:**
Some races grant 1 ability spin, others grant 3. The step counter says "23 spins" but a
player with a high-ability race experiences 25+ spins. This breaks their mental model and
makes the game feel inconsistent or misleading.

**Prevention:**
The step counter must be dynamic. After the Race result is determined, compute the total
expected spins for this character and update the counter immediately. Display "Spin 3 of
25" rather than "Spin 3 of 23." Communicate this in the UI: "Your race grants 3 Racial
Ability Spins!"

**Phase to address:** Phase implementing the full 23-step flow.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| Core wheel animation | Wrong easing + snap correction | Build animation with pre-determined result; use custom cubic-bezier |
| Session/flow architecture | Refresh kills progress (Pitfall 7) | localStorage persistence from step 1 |
| Backend schema design | Variable-length arrays as strings (Pitfall 10), tier/score ambiguity (Pitfall 11) | Normalize abilities table; store only score, derive tier |
| Content writing | Too little content (Pitfall 12), power creep (Pitfall 5) | Set minimums before writing; write by tier, not by race |
| Redemption Spin implementation | Probability miscalibration (Pitfall 6) | Simulation script required as deliverable |
| Backend endpoints | Gallery spam (Pitfall 9) | Rate limiting + minimum completion time check |
| Shareable links | 404 blank pages (Pitfall 8) | Soft-delete + styled 404 character page |
| Content API design | Slow first load (Pitfall 13) | Lazy load by category; never `/api/content/all` |
| Mobile QA | Performance collapse (Pitfall 4) | Test on throttled device in Phase 1 |

---

## Sources

These pitfalls are derived from:

- Established patterns in browser-based game animation (requestAnimationFrame, CSS
  compositor optimization, easing curve physics)
- Common session management failures in multi-step web flows (localStorage recovery
  patterns)
- Database schema anti-patterns for variable-length relational data (denormalized string
  storage)
- Rate limiting and anti-abuse patterns for anonymous-save web applications
- Game balance design principles for tier-based randomized systems
- Web performance patterns for progressive content loading

**Confidence levels by section:**

| Area | Confidence | Basis |
|------|------------|-------|
| Animation pitfalls (1-4) | HIGH | Well-documented browser rendering and animation patterns |
| Game balance pitfalls (5-6) | MEDIUM | Established game design principles; project-specific calibration requires playtesting |
| State + session pitfalls (7) | HIGH | Standard multi-step form/flow pattern failures |
| Shareable link pitfalls (8) | HIGH | Standard REST API and URL design failure modes |
| Gallery/spam pitfalls (9) | HIGH | Standard anonymous endpoint abuse patterns |
| Schema pitfalls (10-11) | HIGH | Relational data modeling anti-patterns |
| Content scaling pitfalls (12) | MEDIUM | Judgment call; thresholds are estimates, not empirically validated for this domain |
| Performance pitfalls (13) | HIGH | Standard web performance and bundle size patterns |
