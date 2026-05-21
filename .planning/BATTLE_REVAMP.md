# Battle System Revamp — Master Plan

**Status**: Planning  
**Affects**: `battle.ts`, `AttackFX.svelte`, `BattleScreen.svelte`, `QuickBattleView.svelte`, `TeamBattleScreen.svelte`, `story/BattleView.svelte`, `content/types.ts`, `content/powers-epic.ts`, `content/powers-absurd.ts`, `content/weaknesses.ts`

---

## Goals

1. **Element-grade particle FX** — Each of the 22 elements gets 10 grade tiers (F→E→D→C→B→A→S→SS→SSS→God) of particles that scale in count, size, and intensity.
2. **Attack type system** — Powers are classified into 7 types with distinct battle mechanics.
3. **Origin-based animations** — FX fires from the attacking character's screen position, flies to target(s).
4. **Multi-party support** — AOE, heals, buffs, debuffs all respect full party/team layouts.
5. **Summons** — Summoner powers spawn a temporary ally unit scaled by grade.
6. **Elemental weaknesses** — Weaknesses become elemental tags; take +25% damage from that element.
7. **Passives** — Applied at character build time, not triggered as moves.

---

## Attack Types

| Type | Description | Multi-target? | Notes |
|------|-------------|---------------|-------|
| `attack` | Standard single-target damage | No | Default for most offensive powers |
| `aoe` | Splash — hits all living enemies | Yes | 0.65× base damage multiplier per target |
| `summon` | Spawns a temporary ally unit | No (spawner) | Grade-scaled stat % (see table below) |
| `heal` | Restores HP | Self + party | Caster + random injured ally |
| `buff` | Stat enhancement | Party | Raises ATK/DEF multiplier for N rounds |
| `debuff` | Status effect on enemy | Single or party | Applies freeze, poison, paralyze, wither, burn |
| `passive` | Constant modifier — not triggered in battle | N/A | Applied at `buildBattleCharacter` time |

### Summon Scaling by Grade
| Grade | Summoned stats (% of summoner) | Survives reset? |
|-------|-------------------------------|-----------------|
| F     | 10% | No |
| E     | 14% | No |
| D     | 20% | No |
| C     | 28% | No |
| B     | 38% | No |
| A     | 50% | No |
| S     | 64% | No |
| SS    | 78% | No |
| SSS   | 92% | No |
| God   | 110% | No |

Summoned units occupy a party slot. When killed they are removed. On battle reset they are removed. Summoned units have a single generic attack move only (no powers of their own).

### Debuff Effects
| Status | Tick damage | Duration | Other |
|--------|-------------|----------|-------|
| `burn` | 6% maxHp/round | 2 rounds | Existing |
| `poison` | 4% maxHp/round | 3 rounds | Existing |
| `freeze` | 0 dmg | 1 round | Skips turn; already exists |
| `paralyze` | 0 dmg | 1 round | 50% chance skip each round |
| `wither` | 3% maxHp/round | 4 rounds | Also reduces target's damage output by 15% |
| `bleed` | 5% maxHp/round | 3 rounds | Physical only |

### Passive Effects (applied at build time in `buildBattleCharacter`)
| Keyword category | Effect |
|-----------------|--------|
| Invincible / Invulnerable / Immortal | `damageReductionCap = 0.88` (normally 0.80); character still killable |
| Power Resistant / Magic Resistant | Power-type moves deal 60% less damage to this character |
| Poison Nullification / Poison Immunity | Immune to `poison` status |
| Strength % boost (e.g. "Strength Enhancement") | `physicalDamage *= 1.15` |
| Regeneration passive | `passiveHealPerRound = maxHp * 0.03` |
| Elemental Resistance (e.g. "Fire Resistance") | Detected element → 30% damage reduction from that element |
| Elemental Absorption | Detected element → heals instead of damages from that element (0.2× damage as heal) |

---

## Elemental Weaknesses Revamp

**Old**: Text-based absurd/comedic weaknesses (e.g. "Weakness to Cheese").  
**New**: Elemental weaknesses only. A weakness roll produces an `ElementType` weakness.

### Implementation
- `Weakness` interface gains `element?: ElementType` field.
- `weaknesses.ts` is rebuilt as a pool of elemental weakness entries (one per element, weighted by lore).
- Races that currently get 0 weaknesses continue to get 0 (`weaknessCount: 0`).
- **In battle**: when an attacker's move element matches a defender's weakness element → `damage *= 1.25`.
- `BattleCharacter` gains `elementWeaknesses: ElementType[]`.

### Weakness Pool (22 entries, one per element)
Each entry exists once with weight-based rarity:

| Element | Label | Weight |
|---------|-------|--------|
| Fire | Weakness to Fire | 10 |
| Ice | Weakness to Ice | 10 |
| Lightning | Weakness to Lightning | 10 |
| Earth | Weakness to Earth | 8 |
| Wind | Weakness to Wind | 8 |
| Shadow | Weakness to Shadow | 9 |
| Light | Weakness to Light | 9 |
| Arcane | Weakness to Arcane | 8 |
| Nature | Weakness to Nature | 7 |
| Void | Weakness to Void | 7 |
| Cosmic | Weakness to Cosmic | 5 |
| Blood | Weakness to Blood | 8 |
| Metal | Weakness to Metal | 7 |
| Soul | Weakness to Soul | 6 |
| Poison | Weakness to Poison | 9 |
| Time | Weakness to Time | 5 |
| Water | Weakness to Water | 9 |
| Sound | Weakness to Sound | 7 |
| Gravity | Weakness to Gravity | 6 |
| Psychic | Weakness to Psychic | 7 |
| Chaos | Weakness to Chaos | 5 |
| Neutral | Weakness to Neutral | 3 |

---

## Element × Grade FX Scaling

`AttackFX.svelte` currently has element types (`fire`, `ice`, `lightning`, etc.) each with fixed particle sets. Grade tier is added as a second axis.

### Grade Intensity Multipliers (applied per particle set)

| Grade | Particle count mult | Scale mult | Spread mult | Extra effects |
|-------|---------------------|------------|-------------|---------------|
| F | 0.5× (drop 50% of particles) | 0.75× | 0.8× | None |
| E | 0.6× | 0.85× | 0.85× | None |
| D | 0.75× | 0.95× | 0.9× | None |
| C | 1.0× (base) | 1.0× | 1.0× | None |
| B | 1.0× | 1.15× | 1.1× | Screen flash (10% opacity) |
| A | 1.2× (extra particles) | 1.3× | 1.2× | Screen flash (15% opacity) |
| S | 1.5× | 1.6× | 1.4× | Shockwave ring + screen flash (25%) |
| SS | 2.0× | 2.0× | 1.6× | Shockwave ring + camera shake + 30% flash |
| SSS | 2.5× | 2.5× | 2.0× | Double shockwave + camera shake + 40% flash |
| God | 3.0× | 3.2× | 2.5× | Triple shockwave + camera shake + 60% flash + screen whiteout momentary |

### Grade → CSS class: `fx-grade-f`, `fx-grade-s`, `fx-grade-god` etc.

Shockwave = expanding `border-radius: 50%` CSS animation from attacker origin.  
Camera shake = `animation: battle-shake 0.3s ease` on the battle arena element.  
Screen flash = brief `::after` overlay on the battle container.

---

## Power Auto-Classification (Keyword → AttackType)

Since there are 1,000+ powers, we use keyword-based auto-detection in `buildBattleCharacter`. Manual overrides can be added later per power.

### Detection priority (first match wins):

```
passive → invincib|invulnerab|immortal|eternal life|undying will|passive|always active|
          aura of|absorb damage|permanent|damage resist|power resist|magic resist|
          nullif.*poison|nullif.*fire|immune to|invisibl|untouchable (passive variant)

summon  → summon|conjure|manifest|call forth|raise|invoke|spirit call|
          familiar|servant|army of|horde|legion|minion|ally manifestation

aoe     → aoe|eruption|explosion|wave|storm|burst|rain of|cascade|flood|
          shockwave|apocalypse|annihilation|area|widespread|scatter|barrage|
          rain|meteor shower|tidal wave|inferno|wildfire|blizzard (large scale)

debuff  → paralyze|freeze|poison|corrode|wither|curse|weaken|slow|blind|silence|
          petrify|stun|cripple|rot|decay|decay|drain|sap|afflict|plague|

buff    → enhance|empower|strengthen|haste|rally|inspire|bless|fortify|reinforce|
          speed boost|battle cry|war cry|protect|aura of strength|power boost|
          shield allies|cover|barrier (team variant)

heal    → healing|regenerat|mend|restor|revive|resurrect|life force|second wind|
          cure|vitality|recover|phoenix rebirth|lay on hands|blessed healer

attack  → (fallback — everything else)
```

---

## Data Model Changes

### `content/types.ts`

```typescript
export type AttackType = 'attack' | 'aoe' | 'summon' | 'heal' | 'buff' | 'debuff' | 'passive'

export interface SimpleItem {
  // existing fields ...
  attackType?: AttackType   // auto-detected at buildBattleCharacter; can be set explicitly
}

export interface Weakness extends SimpleItem {
  severe: boolean
  element?: ElementType   // NEW: elemental type this weakness corresponds to
}
```

### `battle.ts` — `BattleMove`

```typescript
export interface BattleMove {
  name: string
  type: 'physical' | 'power' | 'ability'
  effectTag: string | null
  behavior: 'attack' | 'defend' | 'heal'
  attackType: AttackType          // NEW
  element?: ElementType           // NEW: from power's element field
  grade?: string                  // NEW: power's item grade (F–God)
}
```

### `battle.ts` — `BattleCharacter`

```typescript
export interface BattleCharacter {
  // existing fields...
  elementWeaknesses: ElementType[]   // NEW: elements that deal +25% damage
  passiveHealPerRound: number        // NEW: regen passive heal per round
  powerDamageReduction: number       // NEW: 0–0.6; reduces power damage taken (magic resist)
  physicalDamageReduction: number    // NEW: 0–0.6; reduces physical damage taken (power resist inverse)
  damageReductionCap: number         // NEW: normally 0.80; "invincible" type sets to 0.88
  statusImmunities: string[]         // NEW: ['poison', 'burn', etc.]
  summons: SummonedUnit[]            // NEW: active summons (empty until summon fires)
}

export interface SummonedUnit {
  name: string
  hp: number
  maxHp: number
  damage: number
  element?: ElementType
}
```

---

## Battle Engine Changes (`battle.ts`)

### `buildBattleCharacter`
1. Run keyword-based `detectAttackType(label)` for each power/weapon/ability → set `move.attackType`.
2. Set `move.element` and `move.grade` from power data (already has `element` and `grade`).
3. **Passive powers**: do NOT add to `moves[]`. Instead, apply their effects to character stats:
   - "invincible"-type → `damageReductionCap = 0.88`
   - "magic resistant" → `powerDamageReduction = 0.6`
   - "poison immunity" → `statusImmunities.push('poison')`
   - "regeneration" → `passiveHealPerRound += maxHp * 0.03`
4. Set `elementWeaknesses` from weakness spin results (detect element from label).

### `doAction` changes
- After target selection, check `attacker.move.element` vs `defender.elementWeaknesses` → `damage *= 1.25` if match.
- Check `defender.powerDamageReduction` when move type is `power`.
- Respect `defender.damageReductionCap` (cap effective armor at this value).
- Check `defender.statusImmunities` before applying status.
- Apply `attacker.passiveHealPerRound` each round for regen passives.

### `simulateTeamBattle` / `simulateBattle` — new behaviors per attackType
- **`aoe`**: Picks all living enemies as targets. Deals `damage * 0.65` to each.
- **`summon`**: No damage dealt. Spawns `SummonedUnit` into attacker's team. Returns `summonedUnit` in `AttackResult`.
- **`heal`**: Restores HP to attacker + 1 random injured ally (party battle) or just attacker (1v1).
- **`buff`**: Applies `buffMultiplier: 1.25` to team's damage for `buffDuration: 2` rounds.
- **`debuff`**: Applies one of the 6 status effects (expanded from 3). Element determines which debuff is preferred.
- **`passive`**: Never appears in `moves[]`, already consumed at build time.

### `AttackResult` extensions
```typescript
interface AttackResult {
  // existing...
  summonedUnit?: SummonedUnit    // set when attackType === 'summon'
  aoeDamages?: { targetIdx: number; damage: number }[]  // set for aoe
  healTargets?: number[]         // indices healed in party
  buffApplied?: boolean
  debuffType?: string
}
```

---

## AttackFX Changes (`AttackFX.svelte`)

### Props additions
```svelte
interface Props {
  type: string        // element name (fire, ice, etc.)
  color?: string
  size?: number
  direction?: 'ltr' | 'rtl' | 'center'
  grade?: string      // 'F'|'E'|'D'|'C'|'B'|'A'|'S'|'SS'|'SSS'|'God'  NEW
  originX?: number    // px from left in viewport  NEW
  originY?: number    // px from top in viewport   NEW
  targetX?: number    // for directional arc        NEW
  targetY?: number    // for directional arc        NEW
  attackType?: AttackType  // drives overlay style  NEW
}
```

### Grade-based particle scaling
- Compute `gradeIdx` (0=F → 9=God).
- Scale each sprite's `size` and position spread by grade multipliers from the table above.
- Drop low-weight sprites for F/E grades (particles with delay > 0.15 skipped).
- Add CSS class `fx-grade-{grade.toLowerCase()}` to root element.

### Grade CSS additions (global)
```css
.fx-grade-s    { filter: brightness(1.4) saturate(1.3); }
.fx-grade-ss   { filter: brightness(1.7) saturate(1.6); animation: fx-shake 0.25s; }
.fx-grade-sss  { filter: brightness(2.0) saturate(2.0); animation: fx-shake 0.35s; }
.fx-grade-god  { filter: brightness(2.5) saturate(2.5) contrast(1.2); animation: fx-shake 0.45s; }
@keyframes fx-shake { 0%,100%{transform:translate(0)} 25%{transform:translate(-3px,2px)} 75%{transform:translate(3px,-2px)} }
```

### Shockwave overlay (S and above)
A `div.fx-shockwave` is appended at origin, expands from `0` to `120px` radius, fades out in 0.4s. SSS adds 2, God adds 3 waves with staggered timing.

---

## Battle View Changes (All 4 Views)

### Origin tracking
Each character avatar/card element gets a ref. On each attack, compute `getBoundingClientRect()` of the attacker's card to get `originX/Y`, and the target's card for `targetX/Y`.

### AttackFX integration
- `<AttackFX>` rendered in a `position: fixed; inset: 0; pointer-events: none; z-index: 50` overlay.
- Props: `originX`, `originY`, `targetX`, `targetY`, `grade`, `type` (element), `attackType`.
- Fly animation class determined by `direction` (attacker→target vector: ltr/rtl/center).

### AOE visual
For AOE moves: render `<AttackFX>` once per target simultaneously (fork `showAnim` → `showAoeFX(targets: DOMRect[])`).

### Summon visual
When `summonedUnit` returned: show a summoning circle at the attacker's position, then slide in a new character card into the party row.

### Party/summon display
`TeamBattleScreen` and `story/BattleView` need to render summoned units in the team row (name + HP bar). When HP reaches 0, animate out.

---

## Weakness Wheel Changes

The weakness spin category currently draws from `weaknesses.ts` (text-based, some comedic). The revamp:
- `weaknesses.ts` is replaced with 22 elemental weakness entries.
- `Weakness` interface keeps `severe` flag; elemental weaknesses are all `severe: true`.
- Race `weaknessCount: 0` continues to prevent any weakness spins.
- Displayed on the character card as: `🔥 Weak to Fire` (element icon + label).
- In `buildBattleCharacter`: read weakness spin results, detect element, push to `elementWeaknesses[]`.

---

## Implementation Phases

### Phase 1 — Types & Auto-Classification (Foundation)
**Files**: `content/types.ts`, `battle.ts`, `content/weaknesses.ts`  
**What**: Add `AttackType`, extend `BattleMove`/`BattleCharacter`, write `detectAttackType()`, passive extraction, elemental weakness detection. Replace weakness pool.  
**Test**: All 4 battle views still render. Characters built correctly. Passives not in moves.  
**Effort**: ~2–3 hours.

### Phase 2 — Battle Engine Mechanics
**Files**: `battle.ts`  
**What**: AOE multi-target, summon spawning + party tracking, heal party logic, buff/debuff expanded, elemental weakness +25%, passive regen per round, status immunity, `damageReductionCap`.  
**Test**: Simulate battles with summons, AOE, heals, debuffs. Check summon removal.  
**Effort**: ~3–4 hours.

### Phase 3 — AttackFX Grade Scaling
**Files**: `AttackFX.svelte`, global CSS  
**What**: Add `grade` prop, scale particles, shockwave overlays, CSS grade classes, screen flash.  
**Test**: Visually test each grade tier across fire/ice/lightning/shadow/void.  
**Effort**: ~2–3 hours.

### Phase 4 — Origin-Based Animations & Summon UI
**Files**: All 4 battle view components  
**What**: Ref-based origin tracking, `targetX/Y` passing, AOE fan-out FX, summon card animation, summoned unit party row display.  
**Test**: 1v1 and team battles, summons appear/disappear, AOE hits all.  
**Effort**: ~4–5 hours.

### Phase 5 — Weakness Display & Card Updates
**Files**: `CharacterCard.svelte`, weakness segment logic  
**What**: Show elemental weaknesses with element icon, update character card weakness section.  
**Test**: Character card renders weaknesses with element icon correctly.  
**Effort**: ~1 hour.

---

## Decision Log

- **Passives not in moves**: keeps battle log clean; effects are silent modifiers applied at build.
- **"Invincible" still killable**: cap at 88% DR instead of 100%; consistent with user spec.
- **Weakness pool replaces comedic weaknesses**: user explicitly said "no silly things anymore."
- **AOE at 0.65× per target**: prevents AOE from trivially one-shotting full teams; feels fair.
- **Summons removed on reset**: avoids stale summon state across reruns.
- **Grade detection from power.grade field**: already populated in `powers-epic.ts` and `powers-absurd.ts`; no extra spin state needed.
