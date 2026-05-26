# Wheel of Fate — Improvement Roadmap

Captured from the "improve every system" conversation. Items are grouped by
implementation cost, ordered within group by user-visible impact. Status
column flips to ✅ as they ship.

---

## Tier 1 — Easy (one focused session) — ✅ SHIPPED

| Status | Item | Notes |
|---|---|---|
| ✅ | Auto-continue toggle in settings | 4 speeds (Off/1.5s/2.5s/4s); countdown shown in Continue button |
| ✅ | Glossary popup for tier symbols | `TierGlossary.svelte` + made `TierBadge` interactive (click/tap/Enter) |
| ✅ | Roster filter + sort | 6 sort options (Power/Tier/Level/Recent/Race/Class) + 6 archetype filter chips; prefs persisted in localStorage |
| ✅ | Power rating per character | `powerRating()` in `lib/story/powerRating.ts`; shown on roster card |
| ✅ | "I've played before" skip on welcome modal | Express button on page 0 of welcome → skips + starts immediately |
| ✅ | Lifetime stats panel on profile | 6-card grid (sessions / total spins / avg score / S+ rolls / SSS+ rolls / win %) + fav class chip |
| ✅ | Quick-equip best gear button | `quickEquipBestGear()` helper + button in expanded character view; toasts what it equipped |
| ✅ | Keyboard nav (Tab/Enter/Esc) | Global `:focus-visible` gold ring; Enter/Space/Esc dismisses SpinResultReveal |
| ✅ | **Bonus**: VFX cutoff fix | Dropped `contain: paint` from SpinWheel/AttackFX/BattleScreen/BattleView — particles no longer clipped at panel edges |

**Next step after Tier 1 ships:** review results, pick from Tier 2 based on what moved the needle.

---

## Tier 2 — Medium (one focused session each)

| Status | Item | Notes |
|---|---|---|
| ✅ | Achievement / badge system | 20 achievements (bronze/silver/gold/mythic), `lib/achievements.ts` + `/achievements` route. Auto-celebrates new unlocks. |
| ✅ | Pre-battle preview screen (rivals) | `RivalsPreviewIntro.svelte` — 4s countdown showing both characters side-by-side; Enter/Space skips. |
| ✅ | Battle replay (story mode first) | MVP text replay — `lib/battleReplay.ts` saves last 5 battles; `/replays` route renders the log + combatants. Visual frame-by-frame replay still on the wishlist. |
| ✅ | Tier-scaled landing intensity + sound design pass | `tierIntensity()` in SpinWheel scales audio gain/pitch/sustain + haptic pattern; mythic+ adds a fifth-harmonic shimmer + bright wheel flash. |
| ⏳ | Donation system for clans | Members request gems, others fulfill, daily caps |
| ⏳ | Status effect badges in battle | Chip strip under each character (buff/debuff/poisoned/frozen/stunned/burning) with hover descriptions. Requires plumbing `activeStatuses[]` through `BattleCharacter` + round results, then UI consumes it. Bigger than it looks — deferred to its own session. |
| ⏳ | Bundle deals / featured-of-the-day in shop | Rotating gamepass discount with countdown |
| ⏳ | Virtual scroll on gallery/characters | Once lists pass ~50 entries |
| ⏳ | Compare two characters side-by-side | Stat overlay diff |
| ⏳ | Gem ↔ shard converter | Last-resort exchange with unfavorable rate |
| ✅ | **Bonus**: rivals-win medal credentials fix | PATCH `/characters/:shareId/rivals-win` now passes credentials so the auth-gated ownership check actually sees the cookie. |
| ✅ | **Bonus**: battle FX positioning fix | Story BattleView + TeamBattleScreen no longer fall back to viewport-relative coords (75vw / 50vh). Uses the battle wrapper's rect so FX shoots from the actual panel area, not the screen edge. |
| ✅ | **Bonus**: L-bracket corner glyphs removed | The "arrow looking things" on 3D buttons are gone — single-rule CSS no-op. |

---

## Tier 3 — Hard (multi-session each, may need your input mid-stream)

| Status | Item | Notes |
|---|---|---|
| ⏳ | Clan chat (WS message wall) | Real-time, needs moderation thinking |
| ⏳ | Clan wars | Multi-day match state, server-side scoring, leaderboard |
| ⏳ | Custom tournaments inside clans | Bracket UI + state machine |
| ⏳ | PWA / installable + service worker | Cache invalidation testing required |
| ⏳ | Push notifications | Daily reset, challenge ready, clan war started. Needs push service + your call on defaults |
| ⏳ | Full screen-reader accessibility pass | Needs real testing with AT |
| ⏳ | Long-press spin to skip animation | Sounds easy but the GSAP tween + result handoff is finicky |

---

## Tier 4 — Don't attempt without you

| Status | Item | Why |
|---|---|---|
| 🚫 | Custom avatar / banner asset packs | I'd be guessing on art direction — need source assets |
| 🚫 | First-purchase bonus + monetization tuning | Should be A/B tested, not me-decided |
| 🚫 | Clan perk balancing | Game-balance call that affects retention |

---

## Working agreement

- Ship in tier order unless you redirect.
- After each tier completes, the assistant pings the user with "Tier N done, next would be X" so you can redirect or continue.
- Mark items ✅ here as they land so we have a paper trail across sessions.
- Items that turn out to be larger than their tier get split, not silently expanded.
