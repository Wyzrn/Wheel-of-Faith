// Race + Archetype battle gimmicks — passive mechanics that make different
// races/archetypes feel mechanically distinct in combat, not just "+X to
// stats." Each gimmick is one named effect that fires under a specific
// trigger (round start, damage dealt, HP threshold, etc.) — the battle
// engine reads the character's gimmick IDs and applies the right hooks.
//
// Inspiration source: the "feature beyond stats" gap our identity layer
// surfaces visually but doesn't yet back up in combat. Now it does.

import type { BattleCharacter } from '$lib/game/battle'

export interface Gimmick {
  id: string
  name: string
  icon: string                // Material Symbols name
  description: string         // shown on identity card + battle tooltip
  // Tuning constants live on the gimmick so all balance values stay in
  // one place. Unused keys are ignored.
  params?: Record<string, number | string>
}

// ── Registry ─────────────────────────────────────────────────────────────
// Each gimmick is referenced by string id from RACE_GIMMICKS /
// ARCHETYPE_GIMMICKS below. Effects are applied in battle.ts +
// controller.ts at the relevant trigger point.
export const GIMMICKS: Record<string, Gimmick> = {
  // ── HP threshold ─────────────────────────────────────────────────────
  lastStand: {
    id: 'lastStand',
    name: 'Last Stand',
    icon: 'crisis_alert',
    description: 'Heals 30% HP once per battle when dropped below 20% HP.',
    params: { healFraction: 0.30, hpThreshold: 0.20 },
  },

  // ── On damage dealt ──────────────────────────────────────────────────
  lifesteal: {
    id: 'lifesteal',
    name: 'Bloodthirst',
    icon: 'opacity',
    description: 'Heals 15% of damage dealt back as HP.',
    params: { fraction: 0.15 },
  },

  // ── Damage modifiers (build-time) ────────────────────────────────────
  berserkerRage: {
    id: 'berserkerRage',
    name: 'Berserker Rage',
    icon: 'local_fire_department',
    description: '+35% damage dealt, but takes +20% damage.',
    params: { dmgMult: 1.35, takenMult: 1.20 },
  },
  glassCannon: {
    id: 'glassCannon',
    name: 'Glass Cannon',
    icon: 'flash_on',
    description: 'Double damage, but half max HP.',
    params: { dmgMult: 2.00, hpMult: 0.50 },
  },
  ironSkin: {
    id: 'ironSkin',
    name: 'Iron Skin',
    icon: 'shield_with_heart',
    description: '+15% physical damage reduction.',
    params: { physReductionAdd: 0.15 },
  },
  conceptAvatar: {
    id: 'conceptAvatar',
    name: 'Concept Avatar',
    icon: 'all_inclusive',
    description: '+25% damage when the attack matches the character\'s signature element.',
    params: { dmgMult: 1.25 },
  },
  underdog: {
    id: 'underdog',
    name: 'Underdog',
    icon: 'trending_up',
    description: '+20% damage against higher-tier opponents.',
    params: { dmgMult: 1.20 },
  },

  // ── Crit / first-strike ──────────────────────────────────────────────
  firstStrike: {
    id: 'firstStrike',
    name: 'First Strike',
    icon: 'speed',
    description: 'First attack of the battle is a guaranteed crit.',
  },

  // ── Round start ──────────────────────────────────────────────────────
  divineFavor: {
    id: 'divineFavor',
    name: 'Divine Favor',
    icon: 'sunny',
    description: 'Heals 6% max HP at the start of every round.',
    params: { healFraction: 0.06 },
  },

  // ── Battle start ─────────────────────────────────────────────────────
  leader: {
    id: 'leader',
    name: 'Leader',
    icon: 'military_tech',
    description: 'Starts the battle with a 3-round +20% damage buff.',
    params: { dmgMult: 1.20, rounds: 3 },
  },

  // ── Predator (rivalry / counter-target) ──────────────────────────────
  // The target race is encoded in PREDATOR_TARGETS below; the gimmick
  // itself is the same effect with different prey.
  predator: {
    id: 'predator',
    name: 'Predator',
    icon: 'pets',
    description: '+30% damage against rival races.',
    params: { dmgMult: 1.30 },
  },

  // ── Enemy-only on-death hooks (Story Mode unique enemy types) ───────
  // These fire from teamController's resolveTurn when an enemy with the
  // gimmick drops to 0 HP. They make the threat-tier enemy types feel
  // genuinely different — not just stat-padded normal mobs.

  /** On death, the bomber takes its CURRENT HP (pre-killing-blow if it
   *  survived the hit) worth of damage to a random living party member. */
  bomberDeath: {
    id: 'bomberDeath',
    name: 'Detonation',
    icon: 'explosion',
    description: 'Explodes on death — its remaining HP becomes damage to a random ally of the player.',
    params: { dmgMult: 1.0 },
  },

  /** On death, the cloner spawns 3 mini-clones with 10% of its original
   *  HP and damage. Clones spawn on the same side, attached to the
   *  controller team mid-round so the next round picks them up. */
  clonerDeath: {
    id: 'clonerDeath',
    name: 'Cellular Division',
    icon: 'biotech',
    description: 'On death, splits into 3 weakened clones (each at 10% original stats).',
    params: { count: 3, fraction: 0.10 },
  },

  /** Reflects 35% of damage taken back to the attacker. */
  reflectShield: {
    id: 'reflectShield',
    name: 'Reflective Shell',
    icon: 'reply',
    description: 'Reflects 35% of damage taken back to the attacker.',
    params: { fraction: 0.35 },
  },

  /** Applies a random status (burn/poison/wither/bleed) on every hit
   *  the enemy lands. Replaces the move's effectTag if it had one. */
  curseStrike: {
    id: 'curseStrike',
    name: 'Cursed Touch',
    icon: 'auto_awesome',
    description: 'Every hit inflicts a random status (burn / poison / bleed / wither).',
  },
}

// ── Race → gimmick IDs ───────────────────────────────────────────────────
// Tied to actual race labels that exist in races.ts. Some races get more
// than one — high-rarity races (God, Primordial, Saiyan) earn the layered
// kit. Common races get one signature so they still feel different.
export const RACE_GIMMICKS: Record<string, string[]> = {
  // Combat-leaning rares
  'Saiyan':            ['lastStand', 'berserkerRage'],
  'Viltrumite':        ['lastStand', 'ironSkin'],
  'Kryptonian':        ['conceptAvatar', 'lastStand'],
  'Asgardian':         ['ironSkin', 'leader'],
  'Demi-god':          ['conceptAvatar'],
  'God':               ['conceptAvatar', 'leader'],
  'Primordial':        ['conceptAvatar', 'lastStand', 'ironSkin'],
  'Creator':           ['conceptAvatar', 'leader'],

  // Predator + drainer types
  'Vampire':           ['lifesteal'],
  'Demon':             ['lifesteal', 'berserkerRage'],
  'Symbiote':          ['lifesteal'],
  'Hollow / Arrancar': ['lifesteal', 'berserkerRage'],
  'Parasite':          ['lifesteal'],
  'Werewolf':          ['berserkerRage', 'lifesteal'],

  // Tank archetype races
  'Dwarf':             ['ironSkin'],
  'Robot':             ['ironSkin'],
  'Cyborg':            ['ironSkin'],
  'Warforged':         ['ironSkin'],
  'Giant':             ['ironSkin'],
  'Goliath':           ['ironSkin'],
  'Cybertronian':      ['ironSkin'],
  'Titan Shifter':     ['ironSkin', 'berserkerRage'],

  // Underdog races (commons + scrappers)
  'Goblin':            ['underdog'],
  'Halfling':          ['underdog'],
  'Human':             ['underdog'],
  'Gnome':             ['underdog'],
  'Half-Orc':          ['underdog', 'berserkerRage'],

  // Speed / agility
  'Tabaxi':            ['firstStrike'],
  'Elf':               ['firstStrike'],
  'Half-Elf':          ['firstStrike'],
  'Shinobi':           ['firstStrike'],

  // Holy / supportive
  'Aasimar':           ['divineFavor'],
  'Angel':             ['divineFavor', 'conceptAvatar'],
  'Spirit':            ['divineFavor'],

  // Glass cannon
  'Eldritch Being':    ['glassCannon', 'conceptAvatar'],
  'Mindflayer':        ['glassCannon'],

  // Predator (vs specific race — wired via PREDATOR_TARGETS)
  'Dragon':            ['conceptAvatar'],
  'Dragonborn':        ['conceptAvatar'],

  // Time / dimensional
  'Time Lord':         ['leader'],
  'Sphinx':            ['leader'],
  'Alien':             ['firstStrike'],
  'Kaiju':             ['berserkerRage', 'ironSkin'],
  'Mythological Creature': ['conceptAvatar'],
  'Beast':             ['berserkerRage'],
  'Sea King':          ['ironSkin', 'conceptAvatar'],
  'Atlantean':         ['ironSkin'],
  'Shinigami':         ['lifesteal'],
  'Namekian':          ['divineFavor'],
  'Nen User':          ['firstStrike'],
  'Mutant':            ['conceptAvatar'],
  'Bender':            ['conceptAvatar'],
  'Genasi (Fire)':     ['conceptAvatar'],
  'Genasi (Water)':    ['conceptAvatar'],
  'Genasi (Air)':      ['conceptAvatar', 'firstStrike'],
  'Genasi (Earth)':    ['conceptAvatar', 'ironSkin'],
  'Undead (Revenant)': ['lifesteal', 'ironSkin'],
  'Ghoul':             ['lifesteal'],
  'Hybrid':            ['underdog'],
  'Half-Dragon':       ['conceptAvatar'],
  'Lizardfolk':        ['ironSkin'],
  'Tiefling':          ['conceptAvatar'],
  'Immortal':          ['divineFavor', 'lastStand'],
  'Dinosaur':          ['berserkerRage', 'ironSkin'],
  'Githyanki':         ['firstStrike'],
  'Bard':              ['leader'],
}

// ── Archetype → gimmick IDs ──────────────────────────────────────────────
export const ARCHETYPE_GIMMICKS: Record<string, string[]> = {
  'Warrior':           ['ironSkin', 'leader'],
  'Berserker':         ['berserkerRage', 'glassCannon'],
  'Rogue':             ['firstStrike'],
  'Mage':              ['conceptAvatar', 'glassCannon'],
  'Paladin':           ['divineFavor', 'ironSkin'],
  'Cleric':            ['divineFavor'],
  'Ranger':            ['firstStrike'],
  'Bard':              ['leader'],
  'Monk':              ['firstStrike'],
  'Anti-Hero':         ['berserkerRage'],
  'Superhero':         ['leader', 'ironSkin'],
  'Supervillain':      ['conceptAvatar', 'berserkerRage'],
  'Shinobi':           ['firstStrike'],
  'Demon Slayer':      ['predator'],
  'Bounty Hunter':     ['predator', 'firstStrike'],
  'Stand User':        ['conceptAvatar'],
  'Nen Hunter':        ['firstStrike'],
  'Esper':             ['conceptAvatar'],
  'Cursed Sorcerer':   ['conceptAvatar', 'glassCannon'],
  'Necromancer':       ['lifesteal', 'conceptAvatar'],
  'Druid':             ['divineFavor', 'conceptAvatar'],
  'Artificer':         ['ironSkin'],
  'Warlock':           ['lifesteal', 'conceptAvatar'],
  'Exorcist':          ['predator', 'divineFavor'],
  'Alchemist':         ['conceptAvatar'],
  'Devil Fruit User':  ['conceptAvatar'],
  'Possessed':         ['berserkerRage', 'lifesteal'],
  'Sorcerer':          ['conceptAvatar', 'glassCannon'],
  'Middle Manager':    ['leader'],
  'Professional Sneezer': ['underdog'],
  'Chaos Gremlin':     ['underdog', 'firstStrike'],
  'Time Traveler':     ['leader', 'firstStrike'],
  'Titan Shifter':     ['berserkerRage', 'ironSkin'],
  'Awakened':          ['conceptAvatar', 'lastStand'],
  'Dual Wielder':      ['berserkerRage'],
}

// ── Predator targets (rivalry / counter-race) ────────────────────────────
// When an archetype/race grants 'predator', the bonus damage applies vs
// the listed target race labels. Demon Slayer → kills demons. Dragon
// Slayer (none in our data yet, but pattern's there). Etc.
export const PREDATOR_TARGETS: Record<string, string[]> = {
  'Demon Slayer':      ['Demon', 'Devil Fruit User'],
  'Exorcist':          ['Demon', 'Undead (Revenant)', 'Possessed', 'Hollow / Arrancar', 'Ghoul'],
  'Bounty Hunter':     [],   // hunts whoever opposed them — no fixed prey
}

// ── Public API ───────────────────────────────────────────────────────────

// Resolve every gimmick ID active on this character, deduplicated.
export function gimmickIdsForCharacter(raceLabel: string, archetypeLabel: string): string[] {
  const fromRace = RACE_GIMMICKS[raceLabel] ?? []
  const fromArc  = ARCHETYPE_GIMMICKS[archetypeLabel] ?? []
  return Array.from(new Set([...fromRace, ...fromArc]))
}

// Hydrate gimmick objects from IDs. Filters unknown IDs silently.
export function gimmicksForCharacter(raceLabel: string, archetypeLabel: string): Gimmick[] {
  return gimmickIdsForCharacter(raceLabel, archetypeLabel)
    .map(id => GIMMICKS[id])
    .filter((g): g is Gimmick => !!g)
}

// Apply build-time gimmick effects to a character's stats. Called from
// buildBattleCharacter AFTER base stats are computed but BEFORE the
// character is returned. Effects compound (berserker + glass cannon
// stacks; iron skin adds to existing reduction).
export interface GimmickBuildEffects {
  damageMultiplier: number       // applied to physical + power damage
  takenMultiplier: number        // applied to damage taken (inverse of armor)
  hpMultiplier: number           // applied to hp + maxHp
  physReductionAdd: number       // added to physicalDamageReduction (clamped to cap)
}
export function computeBuildEffects(gimmickIds: string[]): GimmickBuildEffects {
  let damageMultiplier = 1.0
  let takenMultiplier  = 1.0
  let hpMultiplier     = 1.0
  let physReductionAdd = 0
  for (const id of gimmickIds) {
    const g = GIMMICKS[id]
    if (!g?.params) continue
    if (typeof g.params.dmgMult === 'number')
      damageMultiplier *= g.params.dmgMult as number
    if (typeof g.params.takenMult === 'number')
      takenMultiplier *= g.params.takenMult as number
    if (typeof g.params.hpMult === 'number')
      hpMultiplier *= g.params.hpMult as number
    if (typeof g.params.physReductionAdd === 'number')
      physReductionAdd += g.params.physReductionAdd as number
  }
  return { damageMultiplier, takenMultiplier, hpMultiplier, physReductionAdd }
}

// Round-start passive heal — sum of divineFavor + any other round-tick heals.
export function roundStartHealFraction(gimmickIds: string[]): number {
  let total = 0
  for (const id of gimmickIds) {
    const g = GIMMICKS[id]
    if (!g?.params) continue
    if (id === 'divineFavor' && typeof g.params.healFraction === 'number') {
      total += g.params.healFraction as number
    }
  }
  return total
}

// Lifesteal fraction (heals % of damage dealt). 0 if not present.
export function lifestealFraction(gimmickIds: string[]): number {
  if (!gimmickIds.includes('lifesteal')) return 0
  const g = GIMMICKS.lifesteal
  return (g.params?.fraction as number) ?? 0
}

// Last Stand check + payload. Returns the heal fraction (of maxHp) to
// trigger, or null if the gimmick is absent / threshold not met /
// already fired this battle. The "fired" tracking is owned by the caller
// (controller maintains a per-character set of fired gimmicks).
export function lastStandCheck(
  gimmickIds: string[],
  hpFraction: number,
  alreadyFired: boolean,
): { healFraction: number } | null {
  if (!gimmickIds.includes('lastStand')) return null
  if (alreadyFired) return null
  const g = GIMMICKS.lastStand
  const threshold = (g.params?.hpThreshold as number) ?? 0.20
  if (hpFraction > threshold) return null
  return { healFraction: (g.params?.healFraction as number) ?? 0.30 }
}

// Predator bonus damage multiplier when the defender's race matches the
// attacker's prey list. Falls back to 1.0 (no bonus).
export function predatorMultiplier(
  attackerArchetype: string,
  attackerRace: string,
  defenderRace: string,
): number {
  // Archetype-driven prey list takes precedence; race-level predator could
  // be added later (Slayer race, etc.).
  const prey = PREDATOR_TARGETS[attackerArchetype]
  if (!prey || prey.length === 0) return 1.0
  if (!prey.includes(defenderRace)) return 1.0
  return (GIMMICKS.predator.params?.dmgMult as number) ?? 1.30
}

// Concept Avatar bonus when the move's element matches the character's
// signature element. The "signature" is the highest-grade element from
// the race's class/transformation pool, looked up via the race label.
// For archetypes, it's the element of the first elemental ability.
export function conceptAvatarMultiplier(
  gimmickIds: string[],
  moveElement: string | undefined,
  signatureElement: string | undefined,
): number {
  if (!gimmickIds.includes('conceptAvatar')) return 1.0
  if (!moveElement || !signatureElement) return 1.0
  if (moveElement !== signatureElement) return 1.0
  return (GIMMICKS.conceptAvatar.params?.dmgMult as number) ?? 1.25
}

// Underdog bonus — true if the defender's HP is higher than the attacker's.
// Simpler proxy than "tier comparison" since both characters are already
// built; whoever has more HP is implicitly the more powerful build.
export function underdogMultiplier(
  gimmickIds: string[],
  attackerMaxHp: number,
  defenderMaxHp: number,
): number {
  if (!gimmickIds.includes('underdog')) return 1.0
  if (defenderMaxHp <= attackerMaxHp) return 1.0
  return (GIMMICKS.underdog.params?.dmgMult as number) ?? 1.20
}
