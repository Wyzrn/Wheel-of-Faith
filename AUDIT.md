# Wheel of Fate — Full Code Audit

**Date:** 2026-05-21  
**Scope:** Frontend (`src/`) + Backend (`server/src/`)  
**Stack:** Svelte 5, SvelteKit, TypeScript, Fastify 5, MongoDB/Mongoose, GSAP, Stripe

---

## Critical

### C-01: Stripe webhook accepts unauthenticated events when `STRIPE_WEBHOOK_SECRET` is unset

**File:** `server/src/routes/shop.ts:111–121`

When `STRIPE_WEBHOOK_SECRET` is not set, the code logs a warning and **processes the raw request body as a real Stripe event with zero verification**. Any external party can POST a crafted `checkout.session.completed` event with an arbitrary `userId` and `shards` value to `/api/shop/webhook` and receive free shards.

```ts
// Current — dangerous dev fallback reachable in production if env var is missing
event = webhookSecret
  ? stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  : (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Stripe.Event
```

**Fix:** Reject all webhook requests immediately when the secret is unset. Never fall through to an unverified parse path.

```ts
if (!webhookSecret) {
  app.log.error('STRIPE_WEBHOOK_SECRET not set — rejecting all webhook calls')
  return reply.status(500).send({ error: 'webhook not configured' })
}
let event: Stripe.Event
try {
  event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
} catch (err: any) {
  return reply.status(400).send({ error: 'invalid signature' })
}
```

---

### C-02: `PATCH /characters/:shareId/gallery` has no authentication or ownership check

**File:** `server/src/routes/characters.ts:183–211`

Any anonymous caller who knows (or guesses) a character's `shareId` can toggle `share_in_gallery` on or off for that character. There is no `req.userId` check and no ownership verification.

```ts
// Current — no auth at all
fastify.patch('/characters/:shareId/gallery', { ... }, async (request, reply) => {
  const { shareId } = request.params as { shareId: string }
  const { share_in_gallery } = request.body as { share_in_gallery: boolean }
  const character = await Character.findOneAndUpdate(
    { shareId },
    { share_in_gallery },
    { new: true }
  ).lean()
  ...
```

**Fix:** Require authentication and verify the character belongs to the requesting user before updating.

```ts
const userId = (request as any).userId
if (!userId) return reply.code(401).send({ error: 'not authenticated' })
const character = await Character.findOneAndUpdate(
  { shareId, userId: new mongoose.Types.ObjectId(userId) },
  { share_in_gallery },
  { new: true }
).lean()
if (!character) return reply.code(404).send({ error: 'Character not found or not yours' })
```

---

### C-03: `PATCH /characters/:shareId/rivals-win` is unauthenticated and has no rate-limiting meaningful enough to prevent win inflation

**File:** `server/src/routes/characters.ts:247–267`

There is no authentication requirement. Any caller can increment `rivals_wins` on any character by its `shareId`. The rate limit (100/10 min) is per-IP, not per-character-per-user, making it trivial to abuse from distributed sources or inflate a specific character's win count.

**Fix:** Require a valid JWT and verify the requestor participated in the battle (or gate this behind the server-side WebSocket battle resolution).

```ts
const userId = (request as any).userId
if (!userId) return reply.code(401).send({ error: 'not authenticated' })
// Additionally, enforce that the win was awarded via server-side battle resolution,
// not a direct client call.
```

---

### C-04: `POST /auth/rivals-result` accepts any `won: true` claim with no server-side verification

**File:** `server/src/routes/auth.ts:112–119`  
**File:** `src/routes/rivals/+page.svelte:533`

The client decides the outcome of a battle and self-reports it. Any authenticated user can POST `{ won: true }` to `/api/auth/rivals-result` unlimited times (rate-limited to nothing meaningful) to farm `rivalsWins`. The leaderboard is therefore fully gameable.

**Fix:** Move battle result recording inside the server-side WebSocket handler (`rivals-ws.ts`) where the server already has both players' results and can determine the winner itself. The REST endpoint should be removed or restricted to admin use.

---

### C-05: Gamepass purchase endpoint has a TOCTOU race condition that can make shards go negative

**File:** `server/src/routes/shop.ts:167–181`

The pattern is: `findById` → check `user.shards >= cost` → `user.shards -= cost` → `user.save()`. Two concurrent requests (e.g., double-tap) can both pass the balance check before either writes back, resulting in double-deduction or negative shard balance.

```ts
// Current — not atomic
const user = await User.findById(req.userId)    // read
if (user.shards < cost) return reply.status(402)...
user.shards -= cost                              // mutate in memory
user.gamepasses.push(id)
await user.save()                                // write (lost update possible)
```

**Fix:** Use a single atomic `findOneAndUpdate` with a conditional query that enforces the balance check at the database level:

```ts
const user = await User.findOneAndUpdate(
  { _id: req.userId, shards: { $gte: cost }, ...(NON_STACKABLE.has(id) ? { gamepasses: { $ne: id } } : {}) },
  { $inc: { shards: -cost }, $push: { gamepasses: id } },
  { new: true }
)
if (!user) return reply.status(402).send({ error: 'not enough shards or already owned' })
```

---

### C-06: Duplicate JWT `preHandler` hook causes every auth route request to verify the token twice

**File:** `server/src/app.ts:45–50`  
**File:** `server/src/routes/auth.ts:14–21`

`app.ts` registers a global `preHandler` hook that calls `jwtVerify()` and sets `req.userId`. `authRoutes` then registers **its own** `preHandler` hook that does the exact same thing. Every request to an `/api/auth/*` route will verify the JWT twice — the second verification is redundant work and the two hooks' error handling is not coordinated. If the global hook sets `req.userId` and the route hook later throws (on e.g. token expiry race), the behavior is implementation-defined.

**Fix:** Remove the `preHandler` hook from `authRoutes`. The global hook in `app.ts` is sufficient; individual route handlers already guard with `if (!req.userId)`.

```ts
// Remove from authRoutes:
// app.addHook('preHandler', async (req) => { ... jwtVerify ... })
```

---

## High

### H-01: `GET /characters/:shareId` returns the full Mongoose document including internal `userId` ObjectId and all spin data with no field selection

**File:** `server/src/routes/characters.ts:171–179`

Unlike all other read endpoints, this one uses `.lean()` with no `.select()`. The raw document includes `userId` (a MongoDB ObjectId that could enable enumeration across other models), `deleted_at`, and the full `spins` blob. While `shareId` is not easily guessed, returning the owner's internal ID is unnecessary and leaks private data.

**Fix:** Add a `.select()` to only expose public fields:

```ts
const character = await Character.findOne({ shareId })
  .select('shareId name race archetype overall_tier overall_score rivals_wins created_at spins elementWeaknesses share_in_gallery')
  .lean()
```

---

### H-02: `reroll_insurance` daily use is never tracked — the gamepass grants unlimited free rerolls

**File:** `server/src/routes/shop.ts:186–201`

The `POST /shop/reroll-insurance/use` endpoint comments out daily tracking with "for now just authorize". The endpoint returns `{ authorized: true }` every time it is called, with no timestamp written and no enforcement of the "once per day" limit. A user with this gamepass can call this endpoint repeatedly and apply unlimited free rerolls.

**Fix:** Add a `rerollInsuranceLastUsed: Date` field to the User model and enforce the daily limit in the handler:

```ts
const today = new Date(); today.setHours(0,0,0,0)
const user = await User.findById(req.userId)
if (user.rerollInsuranceLastUsed && user.rerollInsuranceLastUsed >= today) {
  return reply.status(429).send({ error: 'daily reroll already used' })
}
await User.findByIdAndUpdate(req.userId, { rerollInsuranceLastUsed: new Date() })
reply.send({ authorized: true })
```

---

### H-03: `sell_bonus` gamepass is never applied when selling characters in Story Mode

**File:** `src/routes/story/+page.svelte:316–324`  
**File:** `src/lib/story/saveSlots.ts` (`sellCharacterFromSlot`)

The `confirmSell()` function calls `getGemValue(sellTarget.overallTier)` without checking whether the authenticated user owns the `sell_bonus` gamepass. The gamepass description says "+25% shards on character sell" but the 1.25× multiplier is never applied anywhere in the sell flow.

**Fix:** Pass `auth.user?.gamepasses ?? []` into `confirmSell` and apply the multiplier:

```ts
function confirmSell() {
  if (!sellTarget || !currentSlot) return
  const passes = auth.user?.gamepasses ?? []
  let value = getGemValue(sellTarget.overallTier)
  if (passes.includes('sell_bonus')) value = Math.ceil(value * 1.25)
  currentSlot = sellCharacterFromSlot($state.snapshot(currentSlot) as StorySaveSlot, sellTarget.id, value)
  sellTarget = null
}
```

---

### H-04: `expanded_roster` gamepass is purchased but never applied to roster capacity in Story Mode

**File:** `src/routes/story/+page.svelte:91`  
**File:** `src/lib/story/saveSlots.ts:452–455` (`getEffectiveRosterCapacity`)

`saveSlots.ts` exports `getEffectiveRosterCapacity(slot, gamepasses)` which correctly adds +25 per `expanded_roster` purchase. However, `story/+page.svelte` derives `rosterCapacity` directly from `currentSlot.rosterCapacity` (line 91) and never calls `getEffectiveRosterCapacity`. The `addCharacterToSlot` function also compares against `slot.rosterCapacity` (not the effective capacity). Users who buy `expanded_roster` receive no benefit.

**Fix:** Replace the raw `rosterCapacity` derived state with the effective value and pass gamepasses through:

```ts
// In story/+page.svelte
import { getEffectiveRosterCapacity } from '$lib/story/saveSlots'
import { auth } from '$lib/stores/auth.svelte'

let rosterCapacity = $derived(
  currentSlot ? getEffectiveRosterCapacity(currentSlot, auth.user?.gamepasses ?? []) : 5
)
```

And update `addCharacterToSlot` calls to pass the effective capacity or refactor to accept it.

---

### H-05: `daily_booster` gamepass is purchased but never applied to spin refresh in Story Mode

**File:** `src/routes/story/+page.svelte:73–75` (tickRefresh)  
**File:** `src/lib/story/saveSlots.ts:447–449` (`getEffectiveMaxSpins`)

`saveSlots.ts` exports `getEffectiveMaxSpins(gamepasses)` which doubles the daily spin cap for `daily_booster` owners. `applySpinRefresh` and `msUntilNextRefresh` accept a `maxSpins` parameter for this purpose. However, `story/+page.svelte`'s `tickRefresh()` calls `applySpinRefresh(snapshot)` and `msUntilNextRefresh(refreshed)` without passing `maxSpins`, so the cap is always hardcoded to `MAX_DAILY_SPINS = 10` regardless of the gamepass.

**Fix:**

```ts
import { getEffectiveMaxSpins } from '$lib/story/saveSlots'
import { auth } from '$lib/stores/auth.svelte'

function tickRefresh() {
  if (!currentSlot) return
  const snapshot = $state.snapshot(currentSlot) as StorySaveSlot
  const maxSpins = getEffectiveMaxSpins(auth.user?.gamepasses ?? [])
  const refreshed = applySpinRefresh(snapshot, maxSpins)
  if (refreshed !== snapshot) currentSlot = refreshed
  refreshMs = msUntilNextRefresh(refreshed, maxSpins)
}
```

---

### H-06: `GET /characters/mine` route defined after `GET /characters/:shareId` — route shadowing risk

**File:** `server/src/routes/characters.ts:171, 214`

In Fastify, when `GET /characters/:shareId` is registered first and `GET /characters/mine` is registered after, Fastify's router will correctly give static paths priority over parametric routes. However, the current ordering places the parametric route first (line 171) and the static route second (line 214). Fastify's `find-my-way` router does handle static vs parametric correctly regardless of registration order, but this is a maintenance hazard. Any future middleware added to the parametric route may affect `/mine` calls before Fastify resolves the ambiguity.

**Fix:** Reorder to register static routes before parametric ones as a defensive practice:

```ts
fastify.get('/characters/mine', ...) // line 214 → move to before line 171
fastify.get('/characters/:shareId', ...) // line 171
```

---

### H-07: Wildcard `setTimeout` on `+page.svelte` is not cancelled — fires after navigation or reset

**File:** `src/routes/+page.svelte:758, 771`

When a wildcard triggers, two `setTimeout(() => { wildcardPhase = 'reveal' }, 3000)` calls run with no cleanup. If the user navigates away (SvelteKit component unmounts) or resets the game within 3 seconds, the callback fires on an unmounted component and attempts to set `wildcardPhase`, potentially causing a stale state write or (in future Svelte versions) an error.

**Fix:** Store the timeout ID and clear it in a cleanup path. Add an `onDestroy` or cancel in `handleStartOver`/`handleNewCharacter`:

```ts
let wildcardRevealTimeout: ReturnType<typeof setTimeout> | null = null

// Where wildcard is set:
if (wildcardRevealTimeout) clearTimeout(wildcardRevealTimeout)
wildcardRevealTimeout = setTimeout(() => { wildcardPhase = 'reveal' }, 3000)

// In handleStartOver, handleNewCharacter, etc.:
if (wildcardRevealTimeout) { clearTimeout(wildcardRevealTimeout); wildcardRevealTimeout = null }
```

---

### H-08: Story Mode `handleSpinCancel` refunds the wrong spin type for hero/legend spins — always refunds `spinsRemaining`

**File:** `src/routes/story/+page.svelte:349–362`

```ts
function handleSpinCancel() {
  if (!currentSlot) { view = 'hub'; return }
  const snap = $state.snapshot(currentSlot) as StorySaveSlot
  if (lastSpinType === 'bonus') {
    currentSlot = { ...snap, bonusSpins: snap.bonusSpins + 1 }
  } else if (lastSpinType === 'hero') {
    currentSlot = { ...snap, heroSpins: (snap.heroSpins ?? 0) + 1 }
  } else if (lastSpinType === 'legend') {
    currentSlot = { ...snap, legendSpins: (snap.legendSpins ?? 0) + 1 }
  } else {
    currentSlot = { ...snap, spinsRemaining: snap.spinsRemaining + 1 }
  }
```

This looks correct as written, but `lastSpinType` must be set before calling the spin view. Check that all paths that enter the spin view set `lastSpinType` consistently. If `lastSpinType` is not declared or initialized in scope, the else branch fires for every cancel — refunding a free spin even when a hero/legend spin was consumed.

**Fix:** Verify `lastSpinType` is declared and initialized before use, and add a TypeScript type annotation to prevent missing cases:

```ts
let lastSpinType = $state<'normal' | 'bonus' | 'hero' | 'legend'>('normal')
```

---

## Medium

### M-01: `usedRacialAbilities.add()` and `usedArchetypeAbilities.add()` mutate a Svelte 5 `$state` Set in-place — reactivity may not propagate

**File:** `src/routes/+page.svelte:933–935`

```ts
usedRacialAbilities.add(resultLabel)
usedArchetypeAbilities.add(resultLabel)
```

In Svelte 5, `$state` wraps objects with a Proxy but `Set.add()` mutations via the Proxy **are** tracked (Svelte 5 uses `Map`/`Set` traps). This is technically valid, but other reset paths (lines 1329, 1646, 1700, 1732, 1764, 1797) correctly do `usedRacialAbilities = new Set()` (full reassignment). The inconsistency — in-place mutation in one path, full reassignment in others — is a maintenance hazard that can break future migrations to non-proxied state. Standardize to full reassignment.

**Fix:** Consistently reassign:

```ts
usedRacialAbilities = new Set([...usedRacialAbilities, resultLabel])
usedArchetypeAbilities = new Set([...usedArchetypeAbilities, resultLabel])
```

---

### M-02: `shop.ts` – `auth.user.shards` and `auth.user.gamepasses` are directly mutated from `shop.svelte.ts`

**File:** `src/lib/stores/shop.svelte.ts:71–72, 91–92`

```ts
auth.user.shards     = data.shards
auth.user.gamepasses = data.gamepasses
```

`auth.user` is a getter returning the internal `_user` `$state`. These lines mutate nested properties on the returned reactive object. While Svelte 5's proxy tracks this, it bypasses the auth store's internal write discipline (which elsewhere always does `_user = { ..._user, ... }`). If the auth store is ever refactored to use a different backing mechanism (e.g., signals), this will silently break.

**Fix:** Add a dedicated method to the auth store for updating shop data:

```ts
// In auth.svelte.ts:
updateShopData(shards: number, gamepasses: string[]) {
  if (_user) _user = { ..._user, shards, gamepasses }
},
```

---

### M-03: `crit_surge`, `blessed_wheel`, `cursed_wheel`, `legend_tag`, `gold_roster_frame`, `boss_magnet`, and `revenge_protocol` gamepasses are sold but produce no in-game effect

**File:** `src/lib/shop/gamepasses.ts` (definitions)  
**File:** `src/routes/+page.svelte`, `src/components/story/StorySpinView.svelte`

`double_luck` is the only "spinning" gamepass that is actually wired in `StorySpinView.svelte` (lines 419, 460). The following gamepasses have no code path that applies their described effect:

- `crit_surge` (+10% crit chance) — battle engine ignores gamepass list
- `blessed_wheel` (higher segments favoured) — no weight adjustment in either spin view
- `cursed_wheel` (dark wheel cosmetic) — no visual change applied
- `legend_tag` (cosmetic badge) — not shown in rivals/roster UI
- `gold_roster_frame` (gold frame) — not applied to card rendering
- `boss_magnet` (more bosses in Endless) — not referenced in Endless view
- `revenge_protocol` (50% shard drop on loss) — not applied in battle drops

**Fix:** Either implement these effects before selling the gamepasses, or add a pre-release warning in the shop UI that specific passes are "coming soon."

---

### M-04: Character `overall_score` and `overall_tier` are accepted verbatim from the client — no server-side recomputation

**File:** `server/src/routes/characters.ts:37, 79–80`

The schema validates `overall_score` is a number in `[-20, 150]` but accepts whatever the client sends. A malicious user can submit `overall_score: 150, overall_tier: 'God'` regardless of their actual spin results, falsifying the gallery and leaderboard rankings.

**Fix:** Import `computeOverallScore` and `scoreTier` on the server and recompute from the submitted `spins` array:

```ts
import { computeOverallScore, scoreTier } from '../game/scoreTier.js'

// After receiving spins:
const scoreMap = buildScoreMapFromSpins(body.spins)
const computed_score = computeOverallScore(scoreMap)
const computed_tier  = scoreTier(computed_score)
// Store computed values, ignore body.overall_score and body.overall_tier
```

---

### M-05: `join_room` WebSocket handler sends `partner_joined` to P2 with P1's username, but P2 receives their own join confirmation as "opponent" — creates confusing race

**File:** `server/src/routes/rivals-ws.ts:130–133`

```ts
send(socket,  { type: 'partner_joined', username: room.p1?.username })
```

P2 receives `partner_joined` with P1's username, which is used in `handleMessage` on the client to set `partnerName`. The client then immediately calls `navigateToSpin()`. However, if P2's identify message hasn't been processed yet (it's sent on `onopen` with a 100ms delay), `room.p1?.username` could still be `undefined`, making `partnerName` undefined for P2.

**Fix:** Ensure the identify message is processed before room creation/join is allowed, or use a synchronization step. At minimum, fall back gracefully:

```ts
send(socket, { type: 'partner_joined', username: room.p1?.username ?? 'Opponent' })
```

---

### M-06: `profile/+page.svelte` uses a polling busy-wait loop to check auth state

**File:** `src/routes/profile/+page.svelte:25–30`

```ts
await new Promise<void>(res => {
  if (!auth.loading) { res(); return }
  const iv = setInterval(() => { if (!auth.loading) { clearInterval(iv); res() } }, 50)
})
```

This creates a 50ms polling interval that is not cleaned up if the component unmounts before `auth.loading` turns false. If the user navigates away during this poll, the interval continues and the callback sets local state on an unmounted component.

**Fix:** Use a Svelte 5 `$effect` or a signal-based subscription rather than polling. Alternatively, ensure `clearInterval(iv)` is called if the component unmounts:

```ts
// Simpler approach: just check auth.loading in a $derived and show loading UI
// until auth.loading === false, then conditionally redirect
```

---

### M-07: `handleSpinComplete` splices `spinQueue` and pushes to `results` before saving — if `saveSession` throws, the in-memory state is mutated but not persisted

**File:** `src/routes/+page.svelte:1545–1551`

Queue splices and result pushes happen as direct reactive mutations to `$state` arrays before `saveSession` is called (line 1545). If `saveSession` throws (e.g. `localStorage` quota exceeded), the in-memory state is already advanced but not persisted. On reload, the session will not resume correctly.

**Fix:** Wrap `saveSession` in a try/catch and surface a user-visible error:

```ts
try {
  saveSession({ ... })
} catch (e) {
  console.error('Failed to save session:', e)
  // Optionally show a toast: "Save failed — storage may be full"
}
```

---

### M-08: `searchPct` is computed incorrectly in the search progress ring — it counts DOWN as time passes (ring empties, not fills)

**File:** `src/routes/rivals/+page.svelte:46`

```ts
let searchPct = $derived(Math.min(searchSeconds / MATCH_TIMEOUT, 1))
```

The SVG circle uses `stroke-dashoffset="{2 * Math.PI * 40 * searchPct}"` — as `searchPct` increases toward 1, `stroke-dashoffset` increases toward the full circumference, which **removes** the stroke (circle empties). This means the ring animates from full to empty, looking like a countdown (time expiring) rather than a progress fill (searching). Whether this is intentional (countdown timer) or not should be verified with the product intent; if it's a countdown, the label should say "Time remaining" not "Searching for".

---

### M-09: Bot character generator uses `resultIndex: 0` for all results — breaks any display code that uses `resultIndex` as a lookup key

**File:** `src/routes/rivals/+page.svelte:265–266`

```ts
const push = (obj: Omit<SpinResult, 'step' | 'resultIndex' | 'timestamp'>) =>
  r.push({ ...obj, step: step++, resultIndex: 0, timestamp: ts })
```

Every bot spin result has `resultIndex: 0`. If any downstream display component (e.g. `SpinWheel`, `CharacterCard`) uses `resultIndex` to look up segment data (angle, color, label from a segment array), all bot stats will render using index 0. The battle engine builds stats from `tier` and `score` fields (which are set correctly), so the battle itself is fine — but any victory screen or character card that tries to render bot spin wheel positions will misrender.

---

### M-10: `joinRoom()` creates a new WebSocket if the user is already connected — multiple simultaneous connections can exist

**File:** `src/routes/rivals/+page.svelte:218–222`

```ts
function joinRoom() {
  joinError = ''
  if (joinCode.length < 4) { joinError = 'Enter the room code.'; return }
  connectWs(() => setTimeout(() => ws?.send(JSON.stringify({ type: 'join_room', code: joinCode.toUpperCase() })), 100))
}
```

`connectWs()` always creates a new WebSocket and assigns it to `ws`. If the user is already connected (e.g., they previously called `createRoom()` and are on the waiting screen, then navigate back and call `joinRoom()`), the old connection is not closed before creating the new one. The old socket stays open on the server, occupying a player slot in a room.

**Fix:** Close the existing socket before creating a new one in `connectWs`:

```ts
function connectWs(onOpen?: () => void): WebSocket {
  if (ws && ws.readyState !== WebSocket.CLOSED) ws.close()
  ...
}
```

---

### M-11: `handleMessage` case `'partner_joined'` immediately calls `navigateToSpin()` before the player has a chance to see who joined

**File:** `src/routes/rivals/+page.svelte:153–155`

```ts
case 'partner_joined':
  partnerName = (msg.username as string) ?? 'Opponent'
  navigateToSpin()
  break
```

For P1, as soon as P2 joins the room, P1 is immediately navigated to the spin screen with no confirmation. If P1 wanted to cancel (e.g., wrong code), they now have no way to do so without aborting the spin. Consider showing a "Opponent joined: [name] — Ready?" confirmation step.

This is a UX bug that also creates a correctness issue: `navigateToSpin()` stores the WS in the module store and navigates; if the navigation fails for any reason, the stored WS reference and the local `ws` are now diverged.

---

### M-12: Story Mode `addCharacterToSlot` ignores `getEffectiveRosterCapacity` — duplicate of H-04

*See H-04.*

---

### M-13: The `leaderboard` endpoint at `/auth/leaderboard` only filters `rivalsWins > 0` but does no pagination on the result set over time

**File:** `server/src/routes/auth.ts:102–109`

The query hard-limits to 50 results but has no index on `rivalsWins DESC`. As the user base grows, this becomes a full collection scan sorted in memory.

**Fix:** Add a compound index:

```ts
UserSchema.index({ rivalsWins: -1 })
```

---

## Low

### L-01: Hardcoded fallback JWT secret in production code

**File:** `server/src/app.ts:40`

```ts
secret: process.env.JWT_SECRET ?? 'wheel-of-fate-dev-secret-change-in-production',
```

If `JWT_SECRET` is not set in production, all JWTs will be signed with a public, well-known secret visible in the repository. Any attacker can forge tokens. Add a startup assertion:

```ts
if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is required')
```

---

### L-02: `leaderboard` route highlights `/leaderboard` tab as `friends` in the nav

**File:** `src/routes/+layout.svelte:23`

```ts
$page.url.pathname.startsWith('/leaderboard') ? 'friends' :
```

The leaderboard route is parented under the `friends` tab in the nav. This is intentional by the current nav layout (no dedicated leaderboard tab) but means the leaderboard item in the nav links list has `activeTab === 'friends'` which may confuse users expecting a "Rivals" highlight given leaderboard is displayed within the Rivals section.

---

### L-03: `profile/+page.svelte` uses `let characters = $state<any[]>([])` — `any` type erases type safety for all downstream usage

**File:** `src/routes/profile/+page.svelte:8`

The characters array fetched from the server is typed as `any[]`. All property accesses (`a.overall_score`, `a.overall_tier`, etc.) are unchecked. A schema change on the server will produce a silent runtime error rather than a compile-time TypeScript error.

**Fix:** Define and use a proper `CharacterSummary` interface matching the server response shape.

---

### L-04: `createRoom()` in rivals page uses a 100ms `setTimeout` race to wait for the WebSocket `onopen` event before sending the create message

**File:** `src/routes/rivals/+page.svelte:215, 221, 225`

```ts
connectWs(() => setTimeout(() => ws?.send(JSON.stringify({ type: 'create_room' })), 100))
```

The `onOpen` callback already fires after the WebSocket `open` event. The additional 100ms `setTimeout` is a workaround for an unknown timing issue. If the connection is slow (high-latency network) and the WS `open` fires but the `identify` message from `connectWs`'s `onOpen` hasn't been sent by the server side yet, the 100ms delay can still fail. This is fragile.

**Fix:** Send the room creation/join message directly in the `onOpen` callback (after `identify`) without the extra setTimeout, or handle the message ordering server-side by queuing messages until `identify` is received.

---

### L-05: `shop/+page.svelte` `successShards` is computed from URL query params without sanitization and displayed directly

**File:** `src/routes/shop/+page.svelte:8–11`

```ts
let successShards = $derived(
  $page.url.searchParams.get('success') === '1'
    ? parseInt($page.url.searchParams.get('shards') ?? '0')
    : 0
)
```

`successShards` is sourced from a URL param and displayed as `{successShards.toLocaleString()}`. While `parseInt` prevents XSS, an attacker who shares a link with `?success=1&shards=9999999` will see a misleading success banner showing a large number of shards. The actual shards come from the Stripe webhook, so the display is cosmetic-only — but it's deceptive.

**Fix:** After the page loads, re-fetch the actual shard balance from the server and display that instead of the URL param value.

---

### L-06: `cancelSearch()` closes the WebSocket and sets `phase = 'menu'` but the server may still match the player before the cancel message arrives

**File:** `src/routes/rivals/+page.svelte:233–237`

```ts
function cancelSearch() {
  ws?.send(JSON.stringify({ type: 'cancel_match' }))
  stopSearchTimer()
  ws?.close()
  phase = 'menu'
}
```

The `cancel_match` message and `ws.close()` run synchronously back-to-back. The cancel message may not reach the server before the connection closes (WebSocket close can flush the send buffer, but there's no guarantee in all browsers). If the server matches this player between the message flight time, a `matched` event is sent but arrives on a closed socket, leaving the room occupied with a ghost player.

**Fix:** Wait for `match_cancelled` acknowledgement from the server before closing the socket, or handle the case where the socket closes mid-match on the server by cleaning up the queue entry in the `close` event handler (which is already done via `removeFromQueue` in `rivals-ws.ts:189`, so this is partially mitigated).

---

### L-07: `shop.ts` `SHARD_PACKS` definition is duplicated from `gamepasses.ts` — the two can drift

**File:** `server/src/routes/shop.ts:7–12`  
**File:** `src/lib/shop/gamepasses.ts:181–186`

The shard pack definitions (names, amounts, prices) are hardcoded in two places. A price change in one file must be manually replicated in the other; a mismatch would result in the Stripe checkout creating a session with a different price than shown in the UI.

**Fix:** Create a shared source of truth (e.g., a JSON config or a shared TypeScript module that both the frontend and backend import) to eliminate duplication.

---

### L-08: `rivals-ws.ts` in-memory `rooms` map and `matchQueue` are module-level singletons — they survive server restarts but are not persisted, creating stale state after hot reloads in development

**File:** `server/src/routes/rivals-ws.ts:27–28`

In development with file watching, changes to `rivals-ws.ts` will cause the module to re-evaluate, resetting both `rooms` and `matchQueue` while existing WebSocket connections are not terminated. This leads to players in rooms that no longer exist in the map.

This is development-only but worth noting for local debugging.

---

### L-09: The `handleSpinComplete` function is approximately 750 lines — far exceeds any reasonable single-function complexity budget

**File:** `src/routes/+page.svelte:709–1554`

The function handles wildcard logic, all category-specific branching (30+ categories), stat bonus splicing, queue mutation, result saving, rivals relay, reroll re-application, and granted item injection. This creates a very high risk of category-interaction bugs and makes unit testing essentially impossible without a full component mount.

**Recommendation:** Extract category handlers into separate modules: `handleRaceResult`, `handleArchetypeResult`, `handleStatResult`, etc., each returning a `QueueMutation[]` type. The main `handleSpinComplete` orchestrates these.

---

### L-10: `auth.ts` `register` endpoint does not validate that `username` contains only safe characters

**File:** `server/src/routes/auth.ts:27–29`

```ts
const { username, email, password } = req.body as { username: string; email?: string; password: string }
if (!username || !password) return reply.status(400).send({ error: 'username and password required' })
```

Mongoose enforces `minlength: 3, maxlength: 24` but places no constraint on allowed characters. A username containing `<script>`, `\n`, or MongoDB operator characters (e.g., `$where`) is accepted. While MongoDB queries use parameter binding and the username is displayed via Svelte's text interpolation (which auto-escapes), unusual usernames can still cause display issues.

**Fix:** Add a regex validation:

```ts
if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(username)) {
  return reply.status(400).send({ error: 'username may only contain letters, numbers, _, ., -' })
}
```

---

*End of audit. 6 Critical, 8 High, 13 Medium, 10 Low findings.*
