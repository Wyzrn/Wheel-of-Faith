// Per-race landing FX signature registry. Every race that's been through
// the 2026 revamp maps to one of ~20 distinct "themes" — fire-burst,
// frost-shatter, void-pull, blood-spray, holy-radiance, bone-rattle,
// mechanical-grid, bestial-claws, fae-glimmer, etc. Each theme drives a
// CSS overlay class on LandingCelebration so the landing animation
// feels distinct per race without authoring 61 unique animations.
//
// Theme is the visual identity; accentColor is the dominant hue that
// tints particles + rings + glow when no element override is provided.
// Themes were chosen to cover every revamped race in a way that reads
// at a glance — Dragon fires embers, Ghost drifts wisps, Skeleton
// rattles bones, Wisp pulses light, etc.

export interface RaceLandingFX {
  /** CSS class applied to LandingCelebration's root for the bespoke
   *  overlay layer. Maps 1:1 to a `.lc-race-{theme}` rule in app.css. */
  theme: string
  /** Race-specific accent color. Falls back to element color in the
   *  consumer when omitted, so element-based palettes still drive
   *  particle hue when this is undefined. */
  accentColor?: string
  /** Short label shown as a subtitle prefix on cinematic landings.
   *  Optional flavor (e.g. "Embered", "Sanguine", "Voidtouched"). */
  flavor?: string
}

// Theme catalog — each value MUST have a matching `.lc-race-{theme}`
// CSS class. New themes added here MUST also add a CSS rule.
const FIRE        = 'fire'         // ember burst + heat ripple
const ICE         = 'ice'          // frost shatter + crystal shards
const LIGHTNING   = 'lightning'    // arc-flash + voltage crackle
const VOID        = 'void'         // dark pull + reality crack
const BLOOD       = 'blood'        // crimson spray + drip
const HOLY        = 'holy'         // radiance + halo bloom
const NATURE      = 'nature'       // petal scatter + verdant pulse
const EARTH       = 'earth'        // tremor + dust plume
const SHADOW      = 'shadow'       // ink spread + smoke veil
const ARCANE      = 'arcane'       // glyph sigil + sparkle storm
const COSMIC      = 'cosmic'       // starfield + galaxy swirl
const SOUL        = 'soul'         // ghostly drift + ectoplasm
const METAL       = 'metal'        // gear-click + spark shower
const POISON      = 'poison'       // bubble burst + acid drip
const WIND        = 'wind'         // gust streamers + feather flutter
const WATER       = 'water'        // splash + ripple bloom
const PSYCHIC     = 'psychic'      // ripple-warp + thought wave
const CHAOS       = 'chaos'        // glitch + chromatic split
const SOUND       = 'sound'        // resonance ring + sonic bloom
const TIME        = 'time'         // chrono-loop + clockface
const PRIMAL      = 'primal'       // bestial claws + roar shake
const MECHANICAL  = 'mechanical'   // circuit grid + assembly sparks
const BONE        = 'bone'         // rattle scatter + ash puff
const FAE         = 'fae'          // pollen swirl + iridescent shimmer
const LUMINOUS    = 'luminous'     // pure light burst + lens bloom

// Master map — every revamped race → its theme signature.
// Races not in this map fall through to element-based defaults via
// getRaceLandingFX's secondary lookup.
const RACE_THEMES: Record<string, RaceLandingFX> = {
  // ── Common tier ────────────────────────────────────────────────────
  'Human':         { theme: ARCANE,   flavor: 'Adaptive' },
  'Orc':           { theme: PRIMAL,   flavor: 'War-Howl' },
  'Halfling':      { theme: NATURE,   flavor: 'Hearthfire' },
  'Goblin':        { theme: SHADOW,   flavor: 'Cackle' },
  'Gnome':         { theme: METAL,    flavor: 'Tinker' },
  'Robot':         { theme: MECHANICAL, flavor: 'Boot-Up' },
  'Elf':           { theme: ARCANE,   flavor: 'Ancient' },
  'Kobold':        { theme: FIRE,     flavor: 'Spark' },
  'Catfolk':       { theme: PRIMAL,   flavor: 'Pounce' },
  'Sprite':        { theme: FAE,      flavor: 'Glimmer' },
  'Zombie':        { theme: POISON,   flavor: 'Decay' },
  'Merfolk':       { theme: WATER,    flavor: 'Tide' },
  'Imp':           { theme: FIRE,     flavor: 'Brimstone' },
  'Satyr':         { theme: NATURE,   flavor: 'Wild-Reverie' },
  'Hobgoblin':     { theme: METAL,    flavor: 'Iron Order' },
  'Ghost':         { theme: SOUL,     flavor: 'Spectral' },
  'Pixie':         { theme: FAE,      flavor: 'Pollen-Drift' },
  'Gremlin':       { theme: MECHANICAL, flavor: 'Scrap-Spark' },
  'Wisp':          { theme: LUMINOUS, flavor: 'Mote' },
  'Rat':           { theme: SHADOW,   flavor: 'Skitter' },

  // ── Uncommon tier ──────────────────────────────────────────────────
  'Half-Elf':      { theme: ARCANE,   flavor: 'Twin-Bound' },
  'Half-Orc':      { theme: PRIMAL,   flavor: 'Bloodfeud' },
  'Hellborn':      { theme: FIRE,     flavor: 'Damnation' },
  'Drakekin':      { theme: FIRE,     flavor: 'Wyrm-Touched' },
  'Lightborn':     { theme: LUMINOUS, flavor: 'Solar-Heart' },
  'Lizardfolk':    { theme: WATER,    flavor: 'Mire' },
  'Felfolk':       { theme: VOID,     flavor: 'Corrupted' },
  'Goliath':       { theme: EARTH,    flavor: 'Mountain-Born' },
  'Oni':           { theme: BLOOD,    flavor: 'Wrath' },
  'Troll':         { theme: NATURE,   flavor: 'Regenerative' },
  'Treant':        { theme: NATURE,   flavor: 'Heartwood' },
  'Harpy':         { theme: WIND,     flavor: 'Cliff-Cry' },
  'Dullahan':      { theme: SOUL,     flavor: 'Headless' },
  'Gargoyle':      { theme: EARTH,    flavor: 'Stone-Sentinel' },
  'Fairy':         { theme: FAE,      flavor: 'Glimmer-Born' },
  'Dryad':         { theme: NATURE,   flavor: 'Verdant Soul' },
  'Skeleton':      { theme: BONE,     flavor: 'Bone-Rattle' },
  'Ogre':          { theme: PRIMAL,   flavor: 'Brutish' },
  'Centaur':       { theme: WIND,     flavor: 'Steppe-Born' },
  'Lamia':         { theme: PSYCHIC,  flavor: 'Hypnotic' },

  // ── Rare tier ──────────────────────────────────────────────────────
  'Soulforged':    { theme: MECHANICAL, flavor: 'Clockwork Soul' },
  'Cyborg':        { theme: MECHANICAL, flavor: 'Augment' },
  'Bender':        { theme: ARCANE,   flavor: 'Element-Channel' },
  'Mutant':        { theme: CHAOS,    flavor: 'Aberration' },
  'Numokian':      { theme: NATURE,   flavor: 'Antennae-Clan' },
  'Vampire':       { theme: BLOOD,    flavor: 'Crimson' },
  'Werebeast':     { theme: PRIMAL,   flavor: 'Lycanthrope' },
  'Dragon':        { theme: FIRE,     flavor: 'Wyrm' },
  'Parasyte':      { theme: BLOOD,    flavor: 'Host-Bound' },
  'Beast':         { theme: PRIMAL,   flavor: 'Apex' },
  'Alien':         { theme: COSMIC,   flavor: 'Off-World' },
  'Dinosaur':      { theme: EARTH,    flavor: 'Prehistoric' },
  'Spirit':        { theme: SOUL,     flavor: 'Disembodied' },
  'Ghoul':         { theme: BONE,     flavor: 'Carrion' },
  'Giant':         { theme: EARTH,    flavor: 'Titan-Step' },
  'Golem':         { theme: EARTH,    flavor: 'Constructed' },
  'Construct':     { theme: MECHANICAL, flavor: 'Sentient Frame' },
  'Revenant':      { theme: SOUL,     flavor: 'Vengeance-Bound' },
  'Griffin':       { theme: WIND,     flavor: 'Skybound' },
  'Elemental':     { theme: ARCANE,   flavor: 'Primal Core' },
  'Insectoid':     { theme: POISON,   flavor: 'Chitin' },
  // Legendary tier
  'Undead':        { theme: VOID,     flavor: 'Cold Throne' },
  'Zenithian':     { theme: HOLY,     flavor: 'Zenith Pulse' },
  'Cerebrosaur':   { theme: PSYCHIC,  flavor: 'Mind-Harvest' },
  'Null':          { theme: VOID,     flavor: 'Erasure' },
  'Demon':         { theme: BLOOD,    flavor: 'Sulfur Crown' },
  'Half-Dragon':   { theme: FIRE,     flavor: 'Dragonkin' },
  'Angel':         { theme: HOLY,     flavor: 'Seraphic' },
  'Mythological Creature': { theme: BLOOD, flavor: 'Mythic Awakening' },
  'Victrumite':    { theme: HOLY,     flavor: 'Worldbreaker' },
  'Aesir':         { theme: HOLY,     flavor: 'Ragnarok' },
  'Krystalian':    { theme: HOLY,     flavor: 'Solar' },
  'Kaiju':         { theme: VOID,     flavor: 'Cataclysm' },
  'Lord of Time':  { theme: ARCANE,   flavor: 'Hourglass' },
  'Demi-god':      { theme: HOLY,     flavor: 'Domain Echo' },
  'Immortal':      { theme: SOUL,     flavor: 'Deathless' },
  'Mechshifter':   { theme: MECHANICAL, flavor: 'Core Pulse' },
  'Shinigami':     { theme: SOUL,     flavor: 'Final Ledger' },
  'Abyssal Leviathan': { theme: VOID, flavor: 'Drowned Dominion' },
  'Atlantean':     { theme: BLOOD,    flavor: 'Drowned Court' },
  'Hybrid':        { theme: ARCANE,   flavor: 'Spliced' },
  'Chimera':       { theme: BLOOD,    flavor: 'Amalgam' },
}

// Element → theme fallback for any race that isn't in RACE_THEMES yet
// (Legacy races still using the old structure). Keeps the system
// graceful — every race gets SOME themed treatment even before its
// own revamp.
const ELEMENT_THEMES: Record<string, string> = {
  Fire: FIRE, Ice: ICE, Lightning: LIGHTNING, Earth: EARTH, Wind: WIND,
  Shadow: SHADOW, Light: HOLY, Arcane: ARCANE, Nature: NATURE,
  Void: VOID, Cosmic: COSMIC, Blood: BLOOD, Metal: METAL, Soul: SOUL,
  Poison: POISON, Time: TIME, Water: WATER, Sound: SOUND,
  Gravity: VOID, Psychic: PSYCHIC, Chaos: CHAOS,
}

export function getRaceLandingFX(
  raceLabel: string | null | undefined,
  primaryElement?: string | null,
): RaceLandingFX | null {
  if (!raceLabel) return null
  const direct = RACE_THEMES[raceLabel]
  if (direct) return direct
  if (primaryElement && ELEMENT_THEMES[primaryElement]) {
    return { theme: ELEMENT_THEMES[primaryElement] }
  }
  return null
}
