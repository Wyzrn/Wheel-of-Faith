// Material Symbols icon picks for each race. The glyph is shown next to
// the race name on character cards + identity reveals so the Zenithian
// "whatshot" flame visually distinguishes them from the Vampire "bedtime"
// crescent before you read either name.
//
// Coverage target: every race in races.ts. Unmapped races fall back to
// the generic 'person' glyph via raceGlyph() helper.

export interface RaceGlyph {
  // Material Symbols Outlined icon name. Must be a real Symbols glyph —
  // see https://fonts.google.com/icons.
  icon: string
}

export const RACE_GLYPHS: Record<string, RaceGlyph> = {
  // ── D&D / fantasy core ─────────────────────────────────────────────────
  'Human':        { icon: 'person' },
  'Dwarf':        { icon: 'foundation' },
  'Elf':          { icon: 'park' },
  'Halfling':     { icon: 'cake' },
  'Gnome':        { icon: 'engineering' },
  'Orc':          { icon: 'sports_kabaddi' },
  'Half-Elf':     { icon: 'people' },
  'Half-Orc':     { icon: 'group' },
  'Goblin':       { icon: 'sentiment_extremely_dissatisfied' },
  'Drakekin':   { icon: 'shield_lock' },
  'Hellborn':     { icon: 'whatshot' },
  'Lightborn':      { icon: 'auto_awesome' },
  'Felfolk':       { icon: 'cruelty_free' },
  'Goliath':      { icon: 'fitness_center' },
  'Lizardfolk':   { icon: 'crop_landscape' },

  // ── Element / planar ────────────────────────────────────────────────────
  'Genasi (Fire)':  { icon: 'local_fire_department' },
  'Genasi (Water)': { icon: 'water_drop' },
  'Genasi (Air)':   { icon: 'air' },
  'Genasi (Earth)': { icon: 'landscape' },

  // ── Mechanical ──────────────────────────────────────────────────────────
  'Robot':        { icon: 'smart_toy' },
  'Cyborg':       { icon: 'precision_manufacturing' },
  'Soulforged':    { icon: 'hardware' },
  'Mechshifter': { icon: 'memory' },

  // ── Anime / shonen ─────────────────────────────────────────────────────
  'Zenithian':           { icon: 'whatshot' },
  'Verdantian':         { icon: 'healing' },
  'Shadowblade':          { icon: 'kid_star' },
  'Nen User':         { icon: 'category' },
  'Colossus Shifter':    { icon: 'transit_enterexit' },
  'Demon Fruit Eater': { icon: 'nutrition' },
  'Null': { icon: 'mask' },
  'Shinigami':        { icon: 'crisis_alert' },
  'Bender':           { icon: 'air' },

  // ── Monstrous / supernatural ────────────────────────────────────────────
  'Vampire':           { icon: 'bedtime' },
  'Werewolf':          { icon: 'pets' },
  'Demon':             { icon: 'local_fire_department' },
  'Undead (Revenant)': { icon: 'tomb' },
  'Ghoul':             { icon: 'sentiment_very_dissatisfied' },
  'Sphinx':            { icon: 'quiz' },
  'Dragon':            { icon: 'whatshot' },
  'Half-Dragon':       { icon: 'shield_lock' },
  'Mythological Creature': { icon: 'castle' },
  'Beast':             { icon: 'pets' },
  'Symbiote':          { icon: 'science' },
  'Parasite':          { icon: 'coronavirus' },
  'Hybrid':            { icon: 'merge_type' },

  // ── Cosmic / divine ─────────────────────────────────────────────────────
  'Krystalian':     { icon: 'shield' },
  'Aesir':      { icon: 'bolt' },
  'Victrumite':     { icon: 'rocket_launch' },
  'God':            { icon: 'all_inclusive' },
  'Primordial':     { icon: 'star' },
  'Creator':        { icon: 'gesture' },
  'Demi-god':       { icon: 'sports_martial_arts' },
  'Angel':          { icon: 'auto_awesome' },
  'Spirit':         { icon: 'flare' },
  'Eldritch Being': { icon: 'visibility' },
  'Cerebrosaur':     { icon: 'psychology' },

  // ── Other ───────────────────────────────────────────────────────────────
  'Alien':       { icon: 'rocket' },
  'Mutant':      { icon: 'biotech' },
  'Lord of Time':   { icon: 'schedule' },
  'Immortal':    { icon: 'all_inclusive' },
  'Dinosaur':    { icon: 'pets' },
  'Abyssal Leviathan':    { icon: 'waves' },
  'Atlantean':   { icon: 'water' },
  'Giant':       { icon: 'height' },
  'Kaiju':       { icon: 'pest_control' },
  'Githyanki':   { icon: 'rocket' },
}

// Resolver — falls back to a generic person glyph for unmapped races.
export function raceGlyph(raceLabel: string | undefined | null): string {
  if (!raceLabel) return 'person'
  return RACE_GLYPHS[raceLabel]?.icon ?? 'person'
}
