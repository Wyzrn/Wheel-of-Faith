// content/types.ts — Shared content data interfaces for all spin categories.
// Types only — no functions, no constants, no runtime code. No default export.
// Mirrors src/lib/session/types.ts structure (interface-only file).

import type { TierGrade } from '$lib/game/scoreTier'

// Race definition — drives racial ability spin count and weakness probability.
// Used in src/lib/content/races.ts (Plan 02-02).
// Stat bonus grants: maps stat category names to bonus ('statBonus') or penalty ('statPenalty') spin type.
// When a transformation/class/subType with this field resolves, those stats get a bonus spin spliced after them.
export type StatBonusGrants = Record<string, 'statBonus' | 'statPenalty'>

// Item grade — rarity/power tier for powers, weapons, and armors.
// F = Common, E = Weak, D = Uncommon, C = Rare, B = Epic, A = Legendary, S = Mythic, SS = Divine, SSS = Primordial, God = God-Tier
export type ItemGrade = 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S' | 'SS' | 'SSS' | 'God'

// Attack type — how a power/ability behaves in battle.
// passive = applied at character build time, never triggered as a move.
export type AttackType = 'attack' | 'aoe' | 'summon' | 'heal' | 'buff' | 'debuff' | 'passive'

// Element type — thematic elemental affinity for powers, weapons, armor, and race classes.
export type ElementType =
  | 'Fire' | 'Ice' | 'Lightning' | 'Earth' | 'Wind' | 'Shadow' | 'Light'
  | 'Arcane' | 'Nature' | 'Void' | 'Cosmic' | 'Blood' | 'Metal' | 'Soul'
  | 'Poison' | 'Time' | 'Water' | 'Sound' | 'Gravity' | 'Psychic' | 'Chaos'
  | 'Neutral'

// Spin Identity taxonomy — what a race DOES to the spin loop, not just to
// stats. Surfaces internally to route per-race mechanics (extra wheels,
// secret-event weighting, archetype mutation rules). Players never see the
// label directly — they experience it through differentiated wheel feel.
export type SpinIdentity =
  | 'FateManipulator'   // Influence wheel outcomes (Human, Halfling, Time Lord, Creator)
  | 'Evolution'         // Unlock more spins as the run progresses (Saiyan, Dragon, Vampire, Titan Shifter)
  | 'Corruption'        // Risk/reward instability (Demon, Hollow, Eldritch Being, Parasite)
  | 'Combo'             // Heavy archetype interaction (Shinigami, Nen User, Shinobi, Bender)
  | 'Scaling'           // Start weak, snowball (Human, Ghoul, Symbiote, Dragon)
  | 'RuleBreaker'       // Modify normal spin rules (Creator, Primordial, Time Lord)
  | 'Summoner'          // Inject companion systems (Beast, Spirit, Creator, Alien)
  | 'HighVariance'      // Can be garbage or unstoppable (Mutant, Alien, Parasite, Cyborg)

// A custom wheel injected by a race at a specific point in the spin sequence.
// Each entry resolves to an extra spin slot during race-extras splice — same
// mechanism as the existing classPool / subTypePool entries, but generalised
// so a single race can inject many named wheels (Vampire wants Bloodline +
// Age + Corruption; Creator wants Reality Law + Creation Domain + Architecture).
export interface RaceWheel {
  /** Internal id used by archetype mutations to override segment pools. */
  id: string
  /** Display name on the spin queue ("Bloodline", "Reality Law"). */
  displayName: string
  /** When this wheel fires relative to other race extras. Lower = sooner. */
  order?: number
  /** Segments shown on the wheel. */
  segments: { label: string; weight: number; element?: ElementType; grade?: ItemGrade; statBonusGrants?: StatBonusGrants; description?: string }[]
}

// Six-bucket rarity classifier. Previously derived from `weight` via
// threshold ranges (≤1 Divine / ≤2 Mythological / ≤4 Legendary / ≤7 Rare /
// ≤11 Uncommon / 12+ Common), but the wheel-distribution rebalance broke
// the assumption that weight uniquely determines bucket — multiple buckets
// now share weight ranges. This field is the source of truth for rarity
// classification (celebration tier, stat-bonus cap, tier-shift modifier);
// `weight` is now purely the wheel-selection probability.
export type RaceRarity = 'Common' | 'Uncommon' | 'Rare' | 'Legendary' | 'Mythological' | 'Divine'

export interface Race {
  label: string                       // display name shown on wheel and in results
  weight: number                      // for weightedRandom(); pure selection probability
  rarity: RaceRarity                  // celebration tier + stat-cap + tier-modifier bucket
  abilitySpinCount: number            // 1–4; determines how many racialAbility slots are spliced
  weaknessProbabilityModifier: number // kept for backward compat; used to derive weaknessCount when explicit count absent
  weaknessCount?: number              // explicit weakness slots spliced at race resolution; derived from modifier if absent
  description?: string                // optional flavor text for character card
  abilities: { label: string; weight: number; element?: ElementType; grade?: ItemGrade }[]  // race-unique ability pool drawn for racialAbility spins
  statModifiers?: Record<string, number>  // multiplier per stat category; >1 boosts higher tiers, <1 pushes lower
  extraPowerSpins?: number                // additional power category spins spliced after race lands
  extraWeaponSpins?: number               // additional weapon spins spliced after race lands (some races get unique weapons)
  minStatTier?: TierGrade                 // lowest stat tier grade that can be rolled; tiers below this are excluded
  // Limit Break odds — denominator N for the 1/N chance of a Limit Break spin
  // resolving as "Limit Break" instead of "No Limit Break". Lower N = higher
  // chance (Human ≈ 20, Viltrumite ≈ 70). Omit / 0 = race cannot Limit Break.
  // The Limit Break spin fires before the class spin for eligible races.
  limitBreakOdds?: number
  // Spin identity taxonomy — drives which routing hooks fire (Evolution races
  // unlock transformation wheels, Corruption races re-roll segments mid-spin,
  // RuleBreaker races can override caps, etc.). A race can hold multiple
  // identities (Dragon is both Evolution AND Scaling). Empty/missing = no
  // identity-specific behaviour beyond the standard race extras.
  spinIdentity?: SpinIdentity[]
  // Race-specific injected wheels. Each entry adds one extra spin slot after
  // the race result lands. Resolved by the race-extras splice in +page.svelte
  // and StorySpinView.svelte; segments come from RaceWheel.segments but can
  // be overridden by archetype mutation rules (see archetypeMutations.ts).
  injectedWheels?: RaceWheel[]
  // Secret-event weighting — multiplier applied to the base random chance of
  // a secret event firing during this character's spin run. >1 means events
  // are more likely (Eldritch, Mutant, Mythological Creature); <1 means
  // less likely (Robot, Human, baseline races).
  secretEventBias?: number
  customHeightPool?: { label: string; weight: number }[]
  customGenderPool?: { label: string; weight: number }[]  // overrides default height labels for this race
  // Multipliers applied to base weaponType/armorType segment weights for this race.
  // Keys match segment labels (e.g. 'Melee', 'None'). Missing keys default to ×1.
  weaponTypeBias?: Record<string, number>
  armorTypeBias?: Record<string, number>
  // powerPool entries accept element/grade so the wheel can themed-color
  // race-granted power spins and the landing celebration can subtitle them
  // with the proper rarity. When an entry omits them, races.ts inherits from
  // the global powers pool or the parent class/subtype/transformation.
  subTypePool?: { label: string; weight: number; element?: ElementType; grade?: ItemGrade; statBonusGrants?: StatBonusGrants; grantedPowers?: string[]; bonusSpins?: { category: string; displayName: string }[]; powerPool?: { label: string; weight: number; element?: ElementType; grade?: ItemGrade }[]; abilities?: { label: string; weight: number; element?: ElementType; grade?: ItemGrade }[] }[]
  classPool?: { label: string; weight: number; element?: ElementType; grade?: ItemGrade; statBonusGrants?: StatBonusGrants; grantedPowers?: string[]; bonusSpins?: { category: string; displayName: string }[]; powerPool?: { label: string; weight: number; element?: ElementType; grade?: ItemGrade }[]; abilities?: { label: string; weight: number; element?: ElementType; grade?: ItemGrade }[] }[]
  transformationPool?: { label: string; weight: number; element?: ElementType; grade?: ItemGrade; statBonus: number; statBonusGrants?: StatBonusGrants; grantedPowers?: string[]; powerPool?: { label: string; weight: number; element?: ElementType; grade?: ItemGrade }[]; abilities?: { label: string; weight: number; element?: ElementType; grade?: ItemGrade }[] }[]
}

// Archetype definition — drives archetype ability spin count and special effects.
// Used in src/lib/content/archetypes.ts (Plan 02-02).
export interface Archetype {
  label: string
  weight: number
  abilitySpinCount: number    // 0–4; how many archetypeAbility slots are spliced
  description?: string
  abilities: { label: string; weight: number; element?: ElementType; grade?: ItemGrade }[]

  // Overrides the standard ability pool — used for Stand names, breathing styles, titan forms, etc.
  customAbilityPool?: { label: string; weight: number; element?: ElementType; grade?: ItemGrade }[]
  // Custom display name for ability spin slots (e.g. "Stand" instead of "Archetype Ability")
  abilitySpinDisplayName?: string
  // Stat bonus/penalty spins spliced immediately after archetype lands
  statBonusGrants?: StatBonusGrants
  // Extra power spins spliced after archetype lands
  extraPowerSpins?: number
  // Extra weapon spins spliced after archetype lands (dual wielders, gadgeteers, etc.)
  bonusWeaponSpins?: number
  // Arbitrary extra spins of any category spliced after archetype lands
  bonusSpins?: { category: string; displayName: string }[]
  // Powers injected directly into results without requiring a spin
  grantedPowers?: string[]
  // Category tag displayed alongside the archetype result (e.g. "Fighter", "Spellcaster")
  archetypeType?: string
  // Stat probability multipliers: >1 shifts toward higher tiers, <1 pushes lower.
  // Applied multiplicatively with race modifier during stat segment derivation.
  statModifiers?: Record<string, number>
  // Weapon/armor type probability multipliers (same semantics as Race.weaponTypeBias).
  weaponTypeBias?: Record<string, number>
  armorTypeBias?: Record<string, number>
  // Weapons auto-injected into results when this archetype lands (no spin required).
  grantedWeapons?: string[]
}

// Minimal shared type for content items with only label, weight, and optional description.
// Used as base for powers, weapons, backstories, titles, enchantments.
export interface SimpleItem {
  label: string
  weight: number          // for rarity variation within pool
  description?: string
  bonusSpin?: string      // SpinCategory string — if set, this item splices an extra spin when landed on
  bonusSpinDisplayName?: string  // display name for the bonus spin slot
  statBonusGrants?: StatBonusGrants  // maps stat category → statBonus/statPenalty; spliced immediately after this item resolves
  element?: ElementType   // thematic elemental affinity
  grade?: ItemGrade       // rarity/power tier (F=Common → SSS=Primordial)
  attackType?: AttackType // explicit override; if absent, auto-detected in buildBattleCharacter
}

// Weakness extends SimpleItem — adds a severity flag and elemental type.
// All weaknesses are now elemental (an element the character takes +25% damage from).
// severe: true entries are the default; kept for backward compat with race drawing logic.
export interface Weakness extends SimpleItem {
  severe: boolean
  element?: ElementType  // which element deals +25% damage to this character
}

// Flavor label for stat wheels (Strength, Speed, Agility, Durability, IQ, Charisma,
// Fighting Skill, Power Mastery, Weapon Mastery, Potential, Energy Level).
// Structural superset of WeightedSegment — can be passed directly to SpinWheel.
// tier and score are baked in at authoring time; never re-derived post-spin (CORE-04).
export interface FlavorLabel {
  label: string    // e.g., "Wet Noodle Arm" — shown on wheel segment and in results panel
  weight: number   // for weightedRandom(); all labels in same tier should have equal weight
  color?: string   // optional tier-keyed color e.g. 'var(--tier-f-minus)'; used by SpinWheel for segment fill
  tier: TierGrade  // embedded grade — read directly by onSpinComplete, never re-computed
  score: number    // numeric 1–100 derived from tier's canonical midpoint score
}
