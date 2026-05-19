// Story Mode character auto-naming — pure function module.
// No imports from other project files. No default export. No Math.random() calls.
// Deterministic: same (overallScore, raceLabel) always produces the same name.

/** Mulberry32 seeded PRNG — returns a closure that yields pseudorandom [0,1) floats. */
function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** djb2-style hash of a string to a non-negative 32-bit integer. */
function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

const ADJECTIVES: string[] = [
  'Crimson', 'Void', 'Iron', 'Shattered', 'Eternal', 'Cursed', 'Golden', 'Silent',
  'Blazing', 'Ancient', 'Fallen', 'Raging', 'Hollow', 'Gilded', 'Wretched',
  'Undying', 'Forsaken', 'Radiant', 'Obsidian', 'Exiled',
  'Phantom', 'Scarlet', 'Azure', 'Ebony', 'Feral',
  'Sovereign', 'Ruined', 'Bound', 'Gilded', 'Shadowed',
  'Limitless', 'Cursed', 'Broken', 'Relentless', 'Forsaken',
  'Twisted', 'Sacred', 'Venomous', 'Storm', 'Abyssal',
  'Hallowed', 'Dreadful', 'Malevolent', 'Serene', 'Unbroken',
  'Shining', 'Hollow', 'Sinful', 'Gilded', 'Thunderous',
  'Murky', 'Spectral', 'Infernal', 'Glacial', 'Vermillion',
  'Ashen', 'Molten', 'Verdant', 'Celestial', 'Runic',
  'Voidborn', 'Ironclad', 'Timeless', 'Burning', 'Twilight',
  'Sable', 'Boundless', 'Colossal', 'Eldritch', 'Penitent',
  'Sovereign', 'Nameless', 'Drifting', 'Vengeful', 'Untamed',
  'Fractured', 'Stormborn', 'Gilded', 'Hollow', 'Primal',
]

const NOUNS: string[] = [
  'Reaper', 'Sovereign', 'Wraith', 'Colossus', 'Arbiter', 'Specter', 'Titan',
  'Champion', 'Revenant', 'Oracle', 'Warden', 'Phantom', 'Hierarch', 'Nemesis',
  'Bastion', 'Harbinger', 'Sentinel', 'Vanguard', 'Pariah', 'Justicar',
  'Archon', 'Tyrant', 'Seraph', 'Crusader', 'Juggernaut',
  'Overlord', 'Shade', 'Drifter', 'Wanderer', 'Ravager',
  'Forsaken', 'Hunter', 'Predator', 'Commander', 'Usurper',
  'Exile', 'Aberrant', 'Apostle', 'Templar', 'Marauder',
  'Pilgrim', 'Destroyer', 'Defiler', 'Guardian', 'Emissary',
  'Warlord', 'Conqueror', 'Annihilator', 'Seeker', 'Defiant',
  'Sage', 'Strider', 'Berserker', 'Inquisitor', 'Paladin',
  'Dreadnought', 'Voidwalker', 'Stormbringer', 'Nightstalker', 'Stormcaller',
  'Ironbreaker', 'Dawnbringer', 'Oathbreaker', 'Desolator', 'Harbinger',
  'Silencer', 'Runebreaker', 'Flamekeeper', 'Soulreaper', 'Frostbane',
  'Ashwalker', 'Doombringer', 'Lightbringer', 'Ironveil', 'Cinderfang',
  'Thunderstrike', 'Abyssal', 'Wraithbane', 'Deathshroud', 'Sunbreaker',
]

/**
 * Generates a deterministic fantasy name for a Story Mode character.
 * Same (overallScore, raceLabel) always returns the same string.
 * Format: "CapitalizedAdjective CapitalizedNoun"
 */
export function generateCharacterName(overallScore: number, raceLabel: string): string {
  const seed = (overallScore * 31 + hashStr(raceLabel)) | 0
  const rand = mulberry32(seed)
  const adj = ADJECTIVES[Math.floor(rand() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(rand() * NOUNS.length)]
  return `${adj} ${noun}`
}
