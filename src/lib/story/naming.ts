// Story Mode character auto-naming — pure function module.
// No imports from other project files. No default export.
// generateCharacterName is deterministic (same inputs → same name);
// randomCharacterName uses Math.random() and picks from multiple name
// styles (fantasy, real, hybrid, single-word, etc.) so the Randomize
// button feels actually varied — not just adj + noun every time.

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

// ── Fantasy adjective + noun pools (original style) ──────────────────────
const ADJECTIVES: string[] = [
  'Crimson', 'Void', 'Iron', 'Shattered', 'Eternal', 'Cursed', 'Golden', 'Silent',
  'Blazing', 'Ancient', 'Fallen', 'Raging', 'Hollow', 'Gilded', 'Wretched',
  'Undying', 'Forsaken', 'Radiant', 'Obsidian', 'Exiled',
  'Phantom', 'Scarlet', 'Azure', 'Ebony', 'Feral',
  'Sovereign', 'Ruined', 'Bound', 'Shadowed',
  'Limitless', 'Broken', 'Relentless',
  'Twisted', 'Sacred', 'Venomous', 'Storm', 'Abyssal',
  'Hallowed', 'Dreadful', 'Malevolent', 'Serene', 'Unbroken',
  'Shining', 'Sinful', 'Thunderous',
  'Murky', 'Spectral', 'Infernal', 'Glacial', 'Vermillion',
  'Ashen', 'Molten', 'Verdant', 'Celestial', 'Runic',
  'Voidborn', 'Ironclad', 'Timeless', 'Burning', 'Twilight',
  'Sable', 'Boundless', 'Colossal', 'Eldritch', 'Penitent',
  'Nameless', 'Drifting', 'Vengeful', 'Untamed',
  'Fractured', 'Stormborn', 'Primal',
  // New additions
  'Frostbitten', 'Sunless', 'Hexed', 'Blooded', 'Veiled',
  'Doomed', 'Ascendant', 'Wandering', 'Reborn', 'Quiet',
  'Lonely', 'Mercurial', 'Wicked', 'Soft-Spoken', 'Lawless',
  'Lucid', 'Marbled', 'Splintered', 'Hexing', 'Restless',
  'Bleeding', 'Whisperless', 'Pale', 'Final', 'First',
  'Last', 'Hollowed', 'Inverted', 'Tideborn', 'Skybound',
  'Earthborn', 'Lightless', 'Faceless', 'Maskbearing', 'Halfway',
  'Patient', 'Reckless', 'Vexed', 'Sour', 'Pristine',
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
  'Ironbreaker', 'Dawnbringer', 'Oathbreaker', 'Desolator',
  'Silencer', 'Runebreaker', 'Flamekeeper', 'Soulreaper', 'Frostbane',
  'Ashwalker', 'Doombringer', 'Lightbringer', 'Ironveil', 'Cinderfang',
  'Thunderstrike', 'Wraithbane', 'Deathshroud', 'Sunbreaker',
  // New
  'Beggar', 'Heir', 'Witness', 'Cartographer', 'Magus',
  'Engineer', 'Knight', 'Squire', 'Acolyte', 'Heretic',
  'Penitent', 'Confessor', 'Saint', 'Sinner', 'Mendicant',
  'Pyromancer', 'Cryomancer', 'Necromancer', 'Geomancer',
  'Voidcaller', 'Daystar', 'Nightbreaker', 'Songsmith', 'Bonecarver',
  'Tinkerer', 'Trickster', 'Sphinx', 'Lich', 'Empress',
  'Emperor', 'Outsider', 'Watcher', 'Listener', 'Wayfarer',
]

// ── Real first names — international mix, no surnames here ──────────────
const FIRST_NAMES: string[] = [
  // English / Western
  'Marcus', 'James', 'Alex', 'Owen', 'Liam', 'Noah', 'Mason', 'Lucas', 'Ethan',
  'Henry', 'Oliver', 'Caleb', 'Theo', 'Wesley', 'Felix', 'Oscar', 'Adrian',
  'Damian', 'Cole', 'Hugo', 'Silas', 'Atlas', 'Ace', 'Kai',
  'Sophia', 'Olivia', 'Ava', 'Emma', 'Mia', 'Aria', 'Maya', 'Nora',
  'Iris', 'Cleo', 'Vera', 'Hazel', 'Luna', 'Stella', 'Wren', 'June',
  'Eloise', 'Aurora', 'Lyra', 'Sage',
  // Japanese
  'Hiroshi', 'Daichi', 'Ren', 'Haruto', 'Kaito', 'Yuki', 'Sora', 'Takeshi',
  'Akari', 'Hina', 'Sakura', 'Yui', 'Mei', 'Aoi', 'Rin', 'Hana',
  'Tatsumi', 'Kenji', 'Akira', 'Riku', 'Shou', 'Daisuke',
  // Korean
  'Min-jun', 'Ji-ho', 'Seo-jun', 'Do-yun', 'Si-woo', 'Ha-eun', 'Seo-yeon',
  'Yu-na', 'Su-bin', 'Mi-rae', 'Eun-woo', 'Joon', 'Hyun', 'Sang',
  // Chinese (pinyin)
  'Wei', 'Jian', 'Bo', 'Li', 'Yan', 'Mei', 'Ying', 'Xia',
  'Hua', 'Jing', 'Zheng', 'Feng', 'Lin', 'Long',
  // Arabic / Middle Eastern
  'Omar', 'Khalid', 'Yusuf', 'Karim', 'Hassan', 'Tariq', 'Amir', 'Nadir',
  'Layla', 'Zara', 'Yasmin', 'Amina', 'Salma', 'Rania', 'Fatima',
  // Indian / South Asian
  'Arjun', 'Vikram', 'Rohan', 'Aarav', 'Ishaan', 'Kabir', 'Rahul', 'Veer',
  'Priya', 'Ananya', 'Kavya', 'Maya', 'Riya', 'Diya', 'Aisha', 'Saanvi',
  // Russian / Eastern European
  'Dmitri', 'Mikhail', 'Nikolai', 'Alexei', 'Yuri', 'Vlad', 'Andrei',
  'Anya', 'Katya', 'Irina', 'Natasha', 'Sonya', 'Olga',
  // Spanish / Latin
  'Diego', 'Mateo', 'Santiago', 'Javier', 'Rafael', 'Carlos', 'Andrés',
  'Isabela', 'Camila', 'Valeria', 'Lucia', 'Daniela', 'Sofia',
  // African / Pan-African
  'Kwame', 'Jelani', 'Sefu', 'Bayo', 'Tariku', 'Zuberi', 'Kofi',
  'Amara', 'Nia', 'Zola', 'Ife', 'Asha', 'Imani',
  // Scandinavian / Norse
  'Bjorn', 'Magnus', 'Erik', 'Soren', 'Lars', 'Sven', 'Axel', 'Anders',
  'Ingrid', 'Astrid', 'Freya', 'Saga', 'Sigrid', 'Linnea',
  // Greek
  'Dimitri', 'Nikos', 'Alexios', 'Stavros', 'Theo', 'Lysander',
  'Elena', 'Maia', 'Calliope', 'Persephone', 'Athena',
  // Celtic / Irish
  'Cian', 'Finn', 'Declan', 'Cormac', 'Oisin', 'Eoin', 'Niall',
  'Saoirse', 'Aoife', 'Niamh', 'Sinead', 'Cara', 'Maeve',
]

// ── Real surnames — same international mix ──────────────────────────────
const SURNAMES: string[] = [
  // Anglo
  'Williams', 'Reed', 'Carter', 'Brooks', 'Hayes', 'Cole', 'Walsh', 'Foster',
  'Bishop', 'Wright', 'Knight', 'Marsh', 'Vaughn', 'Sterling', 'Holloway',
  'Ashcroft', 'Whitmore', 'Blackwood', 'Stone', 'Hawthorne',
  // Japanese
  'Tanaka', 'Yamamoto', 'Sato', 'Suzuki', 'Watanabe', 'Ito', 'Nakamura',
  'Kobayashi', 'Yoshida', 'Yamada', 'Kato', 'Inoue', 'Hayashi', 'Saito',
  // Korean
  'Kim', 'Park', 'Lee', 'Choi', 'Jung', 'Kang', 'Yoon', 'Han',
  // Chinese
  'Wang', 'Zhang', 'Liu', 'Chen', 'Yang', 'Huang', 'Zhou', 'Wu',
  // Arabic
  'Al-Mansour', 'Al-Rashid', 'Khalifa', 'Al-Faraj', 'Saadi', 'Al-Sayed',
  // Indian
  'Sharma', 'Patel', 'Singh', 'Kumar', 'Verma', 'Rao', 'Iyer', 'Reddy',
  'Mehta', 'Joshi', 'Banerjee', 'Mukherjee', 'Khanna',
  // Russian
  'Volkov', 'Ivanov', 'Petrov', 'Sokolov', 'Morozov', 'Romanov', 'Lebedev',
  // Spanish / Portuguese
  'Vega', 'Cruz', 'Reyes', 'Silva', 'Castillo', 'Mendoza', 'Herrera',
  'Navarro', 'Delgado', 'Ortiz', 'Salazar', 'Vargas',
  // African
  'Okonkwo', 'Adeyemi', 'Mensah', 'Diallo', 'Achebe', 'Mwangi', 'Osei',
  // Scandinavian
  'Lindqvist', 'Bergmann', 'Andersen', 'Eriksen', 'Holm', 'Aas',
  // Celtic
  'O\'Brien', 'O\'Connor', 'Murphy', 'Donovan', 'Kearney', 'McCarthy',
  // Greek
  'Papadopoulos', 'Dimitriou', 'Pappas', 'Karras', 'Stavros',
]

// ── Single mononyms — one-word legends ───────────────────────────────────
const MONONYMS: string[] = [
  'Riven', 'Sable', 'Wraith', 'Echo', 'Stark', 'Reign', 'Onyx',
  'Saint', 'Hex', 'Vex', 'Lume', 'Halcyon', 'Vesper', 'Thresh',
  'Crow', 'Wolfsbane', 'Tempest', 'Cinder', 'Iris', 'Mirage',
  'Sphinx', 'Lazarus', 'Nyx', 'Atlas', 'Pyre', 'Veil',
  'Rune', 'Quill', 'Talon', 'Knox', 'Voss',
]

// ── Epithets — "the X" / "of the X" suffixes ────────────────────────────
const EPITHETS: string[] = [
  'the Unbroken', 'the Pale', 'the Veiled', 'the Burning', 'the Hollow',
  'the Just', 'the Cruel', 'the Patient', 'the Lost', 'the First',
  'the Reborn', 'the Fearless', 'the Quiet', 'the Twice-Born', 'the Final',
  'the Untamed', 'the Forsworn', 'the Wandering', 'the Sleepless',
  'of the Black Tower', 'of Crimson Hollow', 'of the Last Sun',
  'of Nowhere', 'of the Silent Coast', 'of the Iron Vow',
  'of Broken Stars', 'of the Dying Light', 'of the Sundered Sea',
]

// ── Real-name conjunctions used in compound names ────────────────────────
const REAL_CONNECTORS: string[] = ['', '', '', '', ' "', ' ‘', ''] // mostly none

// ── Public API ──────────────────────────────────────────────────────────

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

/**
 * Returns a random character name using one of several styles. Picks style
 * weighted so the bulk of rolls feel familiar (fantasy adj+noun / real
 * first+last) while a long tail produces mononyms, epithets, and hybrids
 * for variety. Uses Math.random() — for the Randomize button.
 *
 * Styles + weights:
 *   30%  Fantasy adj + noun   ("Crimson Reaper")
 *   25%  Real first + last    ("Marcus Williams", "Hiroshi Tanaka")
 *   12%  Mononym              ("Riven")
 *   10%  Real first + epithet ("Marcus the Unbroken")
 *    8%  Fantasy noun + epithet ("Reaper of Broken Stars")
 *    7%  Real first only      ("Akari")
 *    5%  Hybrid (real first + fantasy noun) ("Hiroshi Stormbringer")
 *    3%  Surname only         ("Volkov")
 */
export function randomCharacterName(): string {
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]
  const r = Math.random()
  let cum = 0
  const w = (p: number) => (cum += p, r < cum)

  if (w(0.30)) return `${pick(ADJECTIVES)} ${pick(NOUNS)}`
  if (w(0.25)) return `${pick(FIRST_NAMES)} ${pick(SURNAMES)}`
  if (w(0.12)) return pick(MONONYMS)
  if (w(0.10)) return `${pick(FIRST_NAMES)} ${pick(EPITHETS)}`
  if (w(0.08)) return `${pick(NOUNS)} ${pick(EPITHETS)}`
  if (w(0.07)) return pick(FIRST_NAMES)
  if (w(0.05)) return `${pick(FIRST_NAMES)} ${pick(NOUNS)}`
  return pick(SURNAMES)
}
