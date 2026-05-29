// spinQueue.ts — Spin queue data model and segment resolver
// Provides SpinCategory union, SpinDefinition interface, buildInitialQueue, and getSegmentsForCategory.
// No default export. Named exports only. Mirror geometry.ts multi-export structure.

import type { WeightedSegment } from '$lib/session/types'

// Content imports — stat flavor labels (Plan 02-03)
import { strengthLabels }    from '$lib/content/strength-labels'
import { speedLabels }       from '$lib/content/speed-labels'
import { agilityLabels }     from '$lib/content/agility-labels'
import { durabilityLabels }  from '$lib/content/durability-labels'
import { iqLabels }          from '$lib/content/iq-labels'
import { charismaLabels }    from '$lib/content/charisma-labels'
import { fightingSkillLabels } from '$lib/content/fighting-skill-labels'
import { powerMasteryLabels } from '$lib/content/power-mastery-labels'
import { weaponMasteryLabels } from '$lib/content/weapon-mastery-labels'
import { potentialLabels }   from '$lib/content/potential-labels'
import { energyLevelLabels } from '$lib/content/energy-level-labels'
import { heightLabels }      from '$lib/content/height-labels'

// Content imports — races, archetypes, items (Plans 02-02)
import { races as _races } from '$lib/content/races'
const races = [..._races].sort((a, b) => b.weight - a.weight)
import { archetypes }  from '$lib/content/archetypes'
import { powers }      from '$lib/content/powers'
import { weapons }     from '$lib/content/weapons'
import { weaknesses }  from '$lib/content/weaknesses'
import { backstories } from '$lib/content/backstories'
import { titles }      from '$lib/content/titles'
import { enchantments } from '$lib/content/enchantments'
import { armors } from '$lib/content/armors'
import { armorStrengthLabels } from '$lib/content/armor-strength-labels'

// Redemption outcomes — spun when the redemptionSpin lands on 'Redemption'.
// Rare/powerful outcomes have lower weight; fun/mild ones are more common.
const REDEMPTION_OUTCOMES: WeightedSegment[] = [
  { label: 'Reroll Your Worst Stat', weight: 3 },
  { label: 'Gain a Bonus Power', weight: 3 },
  { label: 'Lose One Weakness', weight: 3 },
  { label: 'Plot Armour (Permanent)', weight: 3 },
  { label: 'Free Power Reroll', weight: 3 },
  { label: 'Your Weakness Becomes a Strength (Somehow)', weight: 2 },
  { label: 'Immunity to Your Own Weaknesses', weight: 2 },
  { label: 'Swap Race Abilities (Narrator Chooses)', weight: 2 },
  { label: 'All Stats +1 Tier', weight: 1 },
  { label: 'Stat of Your Choice: S Tier', weight: 1 },
  { label: 'Bonus Archetype Ability', weight: 2 },
  { label: 'Secret Fourth Racial Ability', weight: 1 },
  { label: 'Double Your Best Stat', weight: 1 },
  { label: 'God Tier Potential (One Use)', weight: 1 },
  { label: 'Demigod Status (Unofficial)', weight: 1 },
  { label: 'Free God Tier Strength', weight: 1 },
  { label: 'Retroactive Legendary Race Upgrade', weight: 1 },
  { label: 'The Universe Owes You One', weight: 1 },
  { label: 'The DM Sighs and Gives You One Thing You Want', weight: 1 },
  { label: 'Reroll Everything (Chaos Edition)', weight: 1 },
]

// Corruption reveal pool — spun when corruptionScore hits threshold after Title.
const CORRUPTION_REVEAL_OUTCOMES: WeightedSegment[] = [
  { label: 'Lich Ascension',          weight: 2 },
  { label: 'Half-Demon Emergence',    weight: 3 },
  { label: 'Void-Touched',            weight: 3 },
  { label: 'Cursed Champion',         weight: 4 },
  { label: 'Dark God Candidate',      weight: 2 },
  { label: 'Shadow Soul',             weight: 4 },
  { label: 'Undying Revenant',        weight: 3 },
  { label: 'Infernal Pact Sealed',    weight: 3 },
  { label: 'Corruption: Consumed',    weight: 1 },
]

// Possession strength pool — used when the Possessed archetype lands.
// Higher possession = more stat grants applied in +page.svelte POSSESSION_GRANTS lookup.
const POSSESSION_STRENGTH_POOL: WeightedSegment[] = [
  { label: 'Barely a Whisper (5%)',        weight: 4 },
  { label: 'A Flicker of Influence (20%)', weight: 3 },
  { label: 'Shared Consciousness (40%)',   weight: 2 },
  { label: 'Dominant Presence (60%)',      weight: 2 },
  { label: 'Consuming Takeover (80%)',     weight: 1 },
  { label: 'Full Possession (100%)',       weight: 1 },
]

// Shared ability pool for racialAbility and archetypeAbility slots.
// Used until a dedicated racial-abilities content module is authored.
// All entries weight 1 for uniform draw probability.
const GENERAL_ABILITY_POOL: WeightedSegment[] = [
  { label: 'Enhanced Senses',          weight: 1, element: 'Nature', grade: 'C' },
  { label: 'Regeneration',             weight: 1, element: 'Nature', grade: 'C' },
  { label: 'Elemental Affinity',       weight: 1, element: 'Arcane', grade: 'C' },
  { label: 'Telepathic Whisper',       weight: 1, element: 'Psychic', grade: 'B' },
  { label: 'Shadow Step',              weight: 1, element: 'Shadow', grade: 'B' },
  { label: 'Iron Skin',                weight: 1, element: 'Earth', grade: 'C' },
  { label: 'Berserk Surge',            weight: 1, element: 'Chaos', grade: 'C' },
  { label: 'Arcane Pulse',             weight: 1, element: 'Arcane', grade: 'C' },
  { label: 'Venomous Touch',           weight: 1, element: 'Poison', grade: 'B' },
  { label: 'Gravity Shift',            weight: 1, element: 'Gravity', grade: 'B' },
  { label: 'Time Fracture',            weight: 1, element: 'Time', grade: 'A' },
  { label: 'Soul Drain',               weight: 1, element: 'Soul', grade: 'B' },
  { label: 'Divine Ward',              weight: 1, element: 'Light', grade: 'B' },
  { label: 'Dimensional Anchor',       weight: 1, element: 'Void', grade: 'B' },
  { label: 'Molecular Control',        weight: 1, element: 'Arcane', grade: 'A' },
]

// ── Limit Break ────────────────────────────────────────────────────────────
// Steep-rarity How-Broken wheel: most break rolls land on Weak, Limitless is
// the jackpot-on-a-jackpot. Each label encodes the +N stat-tier shift in the
// LIMIT_BREAK_SHIFT map below.
export const LIMIT_BREAK_LEVEL_POOL: WeightedSegment[] = [
  { label: 'Weak',      weight: 10, tier: 'Cosmic',       color: 'var(--tier-cosmic)' },
  { label: 'Mild',      weight: 5,  tier: 'Immortal',     color: 'var(--tier-immortal)' },
  { label: 'Strong',    weight: 2,  tier: 'Celestial',    color: 'var(--tier-celestial)' },
  { label: 'Limitless', weight: 1,  tier: 'Infinite',     color: 'var(--tier-infinite)' },
]
// Maps a How-Broken result label to the number of tier-index positions the
// character's minimum stat tier shifts up by. Used by the stat-wheel filter.
export const LIMIT_BREAK_SHIFT: Record<string, number> = {
  'Weak': 1, 'Mild': 2, 'Strong': 3, 'Limitless': 4,
}
// Builds the per-race Limit Break wheel. Weighting is "Limit Break" 1 vs
// "No Limit Break" (N-1) so the natural 1/N chance is preserved. Returns
// null when the race is ineligible (omit / 0 limitBreakOdds) so callers can
// skip the splice entirely.
export function limitBreakSegmentsFor(odds: number | undefined | null): WeightedSegment[] | null {
  if (!odds || odds < 2) return null
  // "Limit Break" weighted 2 (vs odds-2) makes it land ~2× as often as the
  // natural 1/odds chance — i.e. ≈ 2/odds.
  return [
    { label: 'No Limit Break', weight: Math.max(1, odds - 2) },
    { label: 'Limit Break',    weight: 2, tier: 'Infinite', color: 'var(--tier-infinite)' },
  ]
}

export type SpinCategory =
  | 'race'
  | 'raceSubType'
  | 'raceClass'
  | 'raceTransformation'
  | 'racialAbility'
  | 'archetype'
  | 'archetypeAbility'
  | 'backstory'
  | 'height'
  | 'strength'
  | 'speed'
  | 'agility'
  | 'durability'
  | 'iq'
  | 'charisma'
  | 'fightingSkill'
  | 'power'
  | 'powerMastery'
  | 'weaponType'
  | 'weapon'
  | 'weaponMastery'
  | 'weaponEnchantment'
  | 'potential'
  | 'energyLevel'
  | 'weakness'
  | 'statBonus'
  | 'statPenalty'
  | 'redemptionSpin'
  | 'redemptionOutcome'
  | 'title'
  | 'possessionRace'
  | 'possessionStrength'
  | 'devilFruitName'
  | 'armorType'
  | 'armor'
  | 'armorStrength'
  | 'armorEnchantment'
  | 'gender'
  | 'corruptionReveal'
  | 'twistSpin'
  // Pre-class wheel that resolves to "No Limit Break" (common) or "Limit Break"
  // (rare, 1/N where N = race.limitBreakOdds). Only spliced for races with a
  // limitBreakOdds value.
  | 'limitBreak'
  // How-Broken wheel — fires after limitBreak lands on "Limit Break". Resolves
  // to Weak / Mild / Strong / Limitless (steep rarity). The +N stat-tier shift
  // is encoded in the resultLabel and applied to stat-wheel filters downstream.
  | 'limitBreakLevel'
  // Generic race-injected wheel. Each entry's `raceWheelId` on SpinDefinition
  // names which wheel to render (e.g. 'destiny', 'bloodline', 'realityLaw').
  // Segments come from raceWheelRegistry.ts; archetype mutations
  // (archetypeMutations.ts) can override the pool keyed off (race, archetype).
  | 'raceWheel'

export interface SpinDefinition {
  category: SpinCategory
  displayName: string  // shown in "Next: {displayName}" header (D-02)
  isSentinel?: boolean // true only on the initial weakness spin; spliced weakness spins omit this
  targetStat?: string  // for statBonus/statPenalty spins: which stat category this bonus modifies
  useRacialPowerPool?: boolean  // if true, power spin draws from activePowerPool instead of global pool
  isReroll?: boolean   // if true, this spin replaces an existing result of the same category
  // Dynamic twist spin — when a race/archetype triggers a custom sub-wheel
  // (God worshippers, Saiyan power level, Bender element, etc.), the trigger
  // splices a slot with twistKind set to a key in TWIST_REGISTRY. The wheel
  // reads the registered segments + the handler applies registered effects
  // when the result lands. Lets us add new twists by adding registry entries
  // without growing SpinCategory each time.
  twistKind?: string
  // Hybrid race twist: when the player rolls "Hybrid", we splice two extra
  // race spins (the two parents). These slots set this flag so the wheel
  // filters Hybrid itself out of the parent pool (no infinite recursion) and
  // the result handler applies the second race's extras to the character.
  isHybridParent?: boolean
  // For 'raceWheel' category slots — identifies which RaceWheel.id to render.
  // Resolved against raceWheelRegistry at spin time. Mutually exclusive with
  // the other category-specific fields.
  raceWheelId?: string
  // For race-derived sub-spins (raceSubType / raceClass / raceTransformation /
  // racialAbility / racial weapon / racial weakness), the race label that
  // spawned this spin. When unset, downstream resolvers fall back to the
  // most-recent 'race' result. Set this whenever a parent race spawns extras
  // (Hybrid threads it through to two different parents) so each lookup goes
  // to the right race pool.
  forRace?: string
}

// Returns the initial queue of 22 fixed spin definitions.
// No racial ability or archetype ability slots — those are spliced in at runtime
// after Race and Archetype land respectively (D-10, CORE-03).
//
// Queue order from RESEARCH.md Pattern 1:
// Race → Archetype → Backstory → Height → Strength → Speed → Agility → Durability
// → IQ → Charisma → FightingSkill → Power → PowerMastery → Weapon → WeaponMastery
// → WeaponEnchantment → Potential → EnergyLevel → Weakness → RedemptionSpin → Title
// = 21 fixed categories + 1 for a total of 22 (ability slots expand dynamically)
export function buildInitialQueue(): SpinDefinition[] {
  return [
    { category: 'race',          displayName: 'Race'          },
    // raceSubType spliced here if race has subTypePool
    // racialAbility slots spliced here (count = race.abilitySpinCount)
    // weakness slots spliced here (count = race.weaknessCount or derived)
    { category: 'archetype',     displayName: 'Archetype'     },
    // archetypeAbility slots spliced here (count = archetype.abilitySpinCount)
    { category: 'backstory',     displayName: 'Backstory'     },
    // bonus stat spin spliced here if backstory has bonusSpin
    { category: 'height',        displayName: 'Height'        },
    { category: 'gender',        displayName: 'Gender'        },
    { category: 'strength',      displayName: 'Strength'      },
    { category: 'speed',         displayName: 'Speed'         },
    { category: 'agility',       displayName: 'Agility'       },
    { category: 'durability',    displayName: 'Durability'    },
    { category: 'iq',            displayName: 'IQ'            },
    { category: 'charisma',      displayName: 'Charisma'      },
    { category: 'fightingSkill', displayName: 'Fighting Skill'},
    { category: 'power',         displayName: 'Power'         },
    { category: 'powerMastery',  displayName: 'Power Mastery' },
    { category: 'weaponType',    displayName: 'Weapon Type'   },
    { category: 'weapon',        displayName: 'Weapon'        },
    { category: 'weaponMastery', displayName: 'Weapon Mastery'},
    // weaponEnchantment spliced here if weaponMastery tier >= C-
    { category: 'armorType',     displayName: 'Armor Type'    },
    { category: 'armor',         displayName: 'Armor'         },
    { category: 'armorStrength', displayName: 'Armor Strength'},
    // armorEnchantment spliced here if armorStrength tier >= C-
    { category: 'potential',     displayName: 'Potential'     },
    { category: 'energyLevel',   displayName: 'Energy Level'  },
    { category: 'redemptionSpin',displayName: 'Redemption Spin'},
    { category: 'title',         displayName: 'Title'         },
    // bonus stat spin spliced here if title has bonusSpin
  ]
}

// Resolves the segments array for a given category.
// All stat labels and item pools are wired to real content modules.
// racialAbility and archetypeAbility use GENERAL_ABILITY_POOL until
// a dedicated racial-abilities module is authored.
// redemptionSpin uses a placeholder until Plan 02-04.
// Sort helper — descending weight (commons first), label tie-break, so the
// wheel renders as a clean rarity gradient (big arcs cluster, sliver arcs
// cluster) instead of races + archetypes mixed by declaration order. Used
// for the race + archetype wheels in Main Game so they match Story Mode's
// already-sorted versions. Stable, deterministic.
function sortedByWeight<T extends { label: string; weight: number }>(arr: readonly T[]): T[] {
  return [...arr].sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label))
}

export function getSegmentsForCategory(category: SpinCategory): WeightedSegment[] {
  switch (category) {
    case 'race':
      return sortedByWeight(races as WeightedSegment[])

    case 'raceSubType':
      // Fallback; actual pool resolved in +page.svelte from race.subTypePool
      return [{ label: 'Standard Variant', weight: 1 }]

    case 'raceClass':
      // Fallback; actual pool resolved in +page.svelte from race.classPool
      return [{ label: 'Standard Class', weight: 1 }]

    case 'raceTransformation':
      // Fallback; actual pool resolved in +page.svelte from race.transformationPool
      return [{ label: 'Base Form', weight: 1 }]

    case 'racialAbility':
      return GENERAL_ABILITY_POOL

    case 'archetype':
      return sortedByWeight(archetypes as WeightedSegment[])

    case 'archetypeAbility':
      return GENERAL_ABILITY_POOL

    case 'backstory':
      return backstories as WeightedSegment[]

    case 'height':
      return heightLabels as WeightedSegment[]

    case 'strength':
      return strengthLabels as WeightedSegment[]

    case 'speed':
      return speedLabels as WeightedSegment[]

    case 'agility':
      return agilityLabels as WeightedSegment[]

    case 'durability':
      return durabilityLabels as WeightedSegment[]

    case 'iq':
      return iqLabels as WeightedSegment[]

    case 'charisma':
      return charismaLabels as WeightedSegment[]

    case 'fightingSkill':
      return fightingSkillLabels as WeightedSegment[]

    case 'power':
      return powers as WeightedSegment[]

    case 'powerMastery':
      return powerMasteryLabels as WeightedSegment[]

    case 'weaponType':
      return [
        { label: 'None',    weight: 5 },
        { label: 'Melee',   weight: 8 },
        { label: 'Ranged',  weight: 6 },
        { label: 'Magical', weight: 4 },
        { label: 'Exotic',  weight: 3 },
        { label: 'Cursed',  weight: 2 },
        { label: 'Ancient', weight: 2 },
      ]

    case 'armorType':
      return [
        { label: 'None',        weight: 4 },
        { label: 'Helmet Only', weight: 8 },
        { label: 'Half-Suit',   weight: 6 },
        { label: 'Full-Suit',   weight: 5 },
        { label: 'Exotic',      weight: 4 },
        { label: 'Cursed',      weight: 2 },
        { label: 'Ancient',     weight: 2 },
      ]

    case 'weapon':
      return weapons as WeightedSegment[]

    case 'weaponMastery':
      return weaponMasteryLabels as WeightedSegment[]

    case 'weaponEnchantment':
      return enchantments as WeightedSegment[]

    case 'armor':
      // Fallback; actual pool filtered by armorType in +page.svelte
      return armors as WeightedSegment[]

    case 'armorStrength':
      return armorStrengthLabels as WeightedSegment[]

    case 'armorEnchantment':
      return enchantments as WeightedSegment[]

    case 'gender':
      return [
        { label: 'Male',   weight: 1 },
        { label: 'Female', weight: 1 },
      ]

    case 'potential':
      return potentialLabels as WeightedSegment[]

    case 'energyLevel':
      return energyLevelLabels as WeightedSegment[]

    case 'weakness':
      return weaknesses as WeightedSegment[]

    case 'statBonus':
      // Actual segments imported from stat-bonus content; resolved in +page.svelte
      return [
        { label: '+1', weight: 15 }, { label: '+2', weight: 12 }, { label: '+3', weight: 9 },
        { label: '+4', weight: 7 },  { label: '+5', weight: 5 },  { label: '+6', weight: 4 },
        { label: '+7', weight: 3 },  { label: '+8', weight: 2 },  { label: '+10', weight: 2 },
        { label: '+12', weight: 1 }, { label: '+15', weight: 1 }, { label: '+20', weight: 1 },
      ]

    case 'statPenalty':
      return [
        { label: '-1', weight: 15 }, { label: '-2', weight: 12 }, { label: '-3', weight: 9 },
        { label: '-4', weight: 7 },  { label: '-5', weight: 5 },  { label: '-7', weight: 4 },
        { label: '-10', weight: 3 }, { label: '-12', weight: 2 }, { label: '-15', weight: 1 },
        { label: '-20', weight: 1 },
      ]

    case 'redemptionSpin':
      // Redemption is rare (~25%); most spins yield no redemption
      return [
        { label: 'Redemption',    weight: 1 },
        { label: 'No Redemption', weight: 3 },
      ]

    case 'redemptionOutcome':
      return REDEMPTION_OUTCOMES

    case 'title':
      return titles as WeightedSegment[]

    case 'possessionRace':
      // Which entity/race is possessing the character — draws from the full
      // race pool minus Hybrid (Hybrid has no real abilities/classes of its
      // own, so possessing a Hybrid would graft nothing onto the character).
      // Sorted by weight descending so the wheel reads as a rarity gradient.
      return sortedByWeight((races as WeightedSegment[]).filter(s => s.label !== 'Hybrid'))

    case 'possessionStrength':
      return POSSESSION_STRENGTH_POOL

    case 'devilFruitName':
      // Fallback; actual pool resolved in +page.svelte from DEVIL_FRUIT_POOLS[raceClass]
      return [{ label: 'Unknown Devil Fruit', weight: 1 }]

    case 'corruptionReveal':
      return CORRUPTION_REVEAL_OUTCOMES

    case 'limitBreak':
      // Fallback only — the real Limit Break wheel is built per-race from
      // race.limitBreakOdds (see limitBreakSegmentsFor()). This default is
      // returned when limitBreak somehow fires with no race context.
      return [
        { label: 'No Limit Break', weight: 98 },
        { label: 'Limit Break',    weight: 2, tier: 'Infinite' },
      ]

    case 'limitBreakLevel':
      // How-Broken wheel — only spun when limitBreak landed on "Limit Break".
      // Steep rarity: Limitless is jackpot-on-a-jackpot.
      return LIMIT_BREAK_LEVEL_POOL

    case 'raceWheel':
      // Fallback only — actual segments come from raceWheelRegistry via the
      // resolveSegments() hook in +page.svelte / StorySpinView using the
      // SpinDefinition.raceWheelId + the active race. This default is what
      // renders if a registry miss happens (shouldn't ever in production).
      return [{ label: '—', weight: 1 }]

    default:
      // Unknown category — return empty array, no throw
      return []
  }
}
