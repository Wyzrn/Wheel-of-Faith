// statDescriptions.ts — Generates a flavour description for a stat-wheel
// result. The label is already shown above the description in the reveal
// modal, so this fills the second line with stat-and-tier-appropriate
// context ("This isn't just genius — it's the kind of mind that only
// arrives every few generations").
//
// 12 stats × 6 tier bands = 72 hand-authored lines. The function picks one
// deterministically per (category, tier) pair; same label always shows the
// same description. No imports — pure function, safe to call anywhere.

import type { TierGrade } from '$lib/game/scoreTier'

type TierBand = 'F' | 'E_D' | 'C_B' | 'A_SSS' | 'Z' | 'POST'

// Maps a TierGrade to a band. Bands group prose-similar tiers so we can
// keep descriptions tight without writing 60 unique lines per stat.
function bandFor(tier: TierGrade | string | undefined): TierBand {
  if (!tier) return 'F'
  const t = String(tier)
  if (/^Cosmic|^Immortal|^Celestial|^Godly|^Primordial|^Absolute|^Transcendent|^Infinite/.test(t)) return 'POST'
  if (/^Z[-+]?$|^ZZ[-+]?$|^ZZZ[-+]?$/.test(t)) return 'Z'
  if (/^A[-+]?$|^S[-+]?$|^SS[-+]?$|^SSS[-+]?$/.test(t)) return 'A_SSS'
  if (/^C[-+]?$|^B[-+]?$/.test(t)) return 'C_B'
  if (/^E[-+]?$|^D[-+]?$/.test(t)) return 'E_D'
  return 'F'
}

// Hand-authored per (category × band). Single string each. Format:
// short flavour sentence keyed off both the stat's identity and the
// rough power scale of the band.
const STAT_FLAVORS: Record<string, Record<TierBand, string>> = {
  strength: {
    F:     "Couldn't open a stuck pickle jar without breathing exercises first.",
    E_D:   "Casual fitness — gym attendance, mostly. Move furniture for friends.",
    C_B:   "Visibly strong. Lifts more than they look like they should. Special-ops shoulders.",
    A_SSS: "Strength past the human ceiling — bend steel, throw cars, dent buildings. Reality starts considering you a force of nature.",
    Z:     "Multiversal might. Galaxies dent. Solar systems are debate topics. Your strike is the answer.",
    POST:  "Force as a property of existing. Whatever you push against agrees to lose.",
  },
  speed: {
    F:     "Slower than a moving sidewalk. The crosswalk doesn't wait for you.",
    E_D:   "Recreational-league quick. Could outrun a determined dog. Maybe.",
    C_B:   "Pro-athlete pace — sprints fast enough that cameras blur. Bullets are still faster.",
    A_SSS: "Supersonic to lightspeed range. Cameras can't catch you. Photons file a complaint.",
    Z:     "Crosses the observable universe between heartbeats. Causality is the bottleneck, not you.",
    POST:  "Already there before the question of moving was asked.",
  },
  agility: {
    F:     "Trips over carpet edges. Dropped things break before hitting the floor.",
    E_D:   "Normal hand-eye. Catches what's thrown at them. Most of the time.",
    C_B:   "Pro-grade reflexes — gymnast, parkour pro, fighting-game champ.",
    A_SSS: "Reads strikes mid-flight. Dodges bullets at close range. Untouchable in skilled hands.",
    Z:     "Reflex outpaces causation. Already avoided whatever you'd do next.",
    POST:  "Existence cannot tag them. The concept of catching them has no purchase.",
  },
  durability: {
    F:     "Bruises from sneezing. Hospital-adjacent at all times.",
    E_D:   "Hardy. Walks off bad falls. Survives car crashes if buckled in.",
    C_B:   "Veteran-soldier tough. Small arms register as inconveniences. Survives explosions.",
    A_SSS: "Tank-shell resistant. Walks out of artillery strikes. Universal collapse is the question.",
    Z:     "Endures multiversal extinction events. Destruction is rejected at the door.",
    POST:  "Damage is meaningless. The void filed for exemption and was denied.",
  },
  iq: {
    F:     "Outsmarted by simple machinery. Doors have won several debates.",
    E_D:   "Average to capable. Honors student, working professional. Solid mind.",
    C_B:   "PhD-tier mind. Multidisciplinary expert. Generation-defining specialty.",
    A_SSS: "Genius to omniscient-adjacent. Sees patterns no one else can. Reads reality like source code.",
    Z:     "Comprehends causality directly. Models every possible outcome in realtime.",
    POST:  "Knowing things into existence. Reality defers to their conclusions.",
  },
  charisma: {
    F:     "People cross the street. Plants close up. Pets pretend not to know them.",
    E_D:   "Pleasant. Easy to talk to. Office-favorite tier.",
    C_B:   "World-class orator. Crowds follow. Generation-defining presence.",
    A_SSS: "Persuades anyone of anything. Civilisations form around their word.",
    Z:     "Multiversal influence. Causality politely roots for them.",
    POST:  "Persuasion is their native tongue. Nothing has ever said no to them.",
  },
  fightingSkill: {
    F:     "Throws punches at the air. Loses to pillows. Self-defense lessons would be a beginning.",
    E_D:   "Hobby martial artist or amateur tournament fighter. Holds their own in a brawl.",
    C_B:   "Elite combat veteran. Olympic-level martial artist. Peak human in technique.",
    A_SSS: "Reality re-routes around their stance. No recorded loss in any universe.",
    Z:     "Has already won before you drew. Fights through probability itself.",
    POST:  "Combat as a property of their presence. Has never been in a fight — everyone surrendered.",
  },
  powerMastery: {
    F:     "Misfires constantly. Hits the wrong target. Sometimes hits themselves.",
    E_D:   "Confident user. Solid practitioner. Their gift is reliable on a calm day.",
    C_B:   "Master-class wielder. Authored their own technique. Combat-ready specialist.",
    A_SSS: "Powers bend to their will. Defines what their power can do. Inventing new applications mid-fight.",
    Z:     "Mastery spans every possibility. Has mastered powers that do not exist.",
    POST:  "Wields things beyond the word \"power\". Power defines itself by them.",
  },
  weaponMastery: {
    F:     "Could hurt themselves with a stick. Holds blades by the sharp end.",
    E_D:   "Hobby martial artist. Renaissance-fair veteran. Reliable in a skirmish.",
    C_B:   "Olympic-level fencer / world combat champion. Multi-weapon specialist.",
    A_SSS: "Any object is a weapon in their hand. Invents weapons mid-fight. Author of multiple schools.",
    Z:     "Multiversal weaponmaster. Every reality has a story about their blade.",
    POST:  "Weapons cooperate reflexively. Anything held by them becomes decisive.",
  },
  armorStrength: {
    F:     "Bathrobe. Threadbare cloth. The wind alone could be a problem.",
    E_D:   "Standard padded gear, chain shirt, soft body armor. Functional baseline.",
    C_B:   "Steel half-plate to peak composite. Combat-ready, frontline-tier.",
    A_SSS: "Mythril mail to runic full plate. Sees a city through a war.",
    Z:     "Plate forged from a dead star. Multiversal aegis. Reality filters out.",
    POST:  "Plate made of \"cannot be harmed\". Protection that transcends itself.",
  },
  potential: {
    F:     "Peaked in childhood. Plateau reached yesterday. No visible ceiling movement.",
    E_D:   "Steady trajectory. Late bloomer with promise. Quietly climbing.",
    C_B:   "PhD-tier growth curve. Multidisciplinary expert in waiting. Will be famous in this field.",
    A_SSS: "Limitless upward trajectory. Will surpass their teachers. No visible ceiling.",
    Z:     "Outgrows the universe within a year. Growth curve penetrates other realities.",
    POST:  "Beyond the idea of \"more\". They are the direction power walks toward.",
  },
  energyLevel: {
    F:     "Naps through combat. Tired just reading this. Stamina of a houseplant.",
    E_D:   "Reliable stamina. Marathon-capable. Pulls a long shift without complaining.",
    C_B:   "Ultramarathon reserves. Hours of sustained output. Pro endurance athlete.",
    A_SSS: "Self-recharging in combat. Body recharges from fighting itself. Output stable for days.",
    Z:     "Carries multiple universes of reserves. Powers up — nearby universes dim.",
    POST:  "Energy is a property of their existence. Reality borrows power from them.",
  },
}

/** Returns a one-line flavour description for a stat-wheel result. Always
 *  returns a string — falls back to a generic line if the (category, tier)
 *  pair somehow misses the table. */
export function generateStatDescription(
  category: string,
  tier: TierGrade | string | undefined,
  _label: string,
): string {
  const table = STAT_FLAVORS[category]
  if (!table) return ''
  const band = bandFor(tier)
  return table[band] ?? ''
}

/** Set of stat categories supported by the generator. Lets callers cheaply
 *  decide whether to bother calling generateStatDescription. */
export const STAT_DESCRIPTION_CATEGORIES = new Set(Object.keys(STAT_FLAVORS))
