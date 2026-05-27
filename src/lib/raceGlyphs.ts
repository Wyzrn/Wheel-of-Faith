// Material Symbols icon picks for each race. The glyph is shown next to
// the race name on character cards + identity reveals so the Saiyan
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
  'Dragonborn':   { icon: 'shield_lock' },
  'Tiefling':     { icon: 'whatshot' },
  'Aasimar':      { icon: 'auto_awesome' },
  'Tabaxi':       { icon: 'cruelty_free' },
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
  'Warforged':    { icon: 'hardware' },
  'Cybertronian': { icon: 'memory' },

  // ── Anime / shonen ─────────────────────────────────────────────────────
  'Saiyan':           { icon: 'whatshot' },
  'Namekian':         { icon: 'healing' },
  'Shinobi':          { icon: 'kid_star' },
  'Nen User':         { icon: 'category' },
  'Titan Shifter':    { icon: 'transit_enterexit' },
  'Devil Fruit User': { icon: 'nutrition' },
  'Hollow / Arrancar': { icon: 'mask' },
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
  'Kryptonian':     { icon: 'shield' },
  'Asgardian':      { icon: 'bolt' },
  'Viltrumite':     { icon: 'rocket_launch' },
  'God':            { icon: 'all_inclusive' },
  'Primordial':     { icon: 'star' },
  'Creator':        { icon: 'gesture' },
  'Demi-god':       { icon: 'sports_martial_arts' },
  'Angel':          { icon: 'auto_awesome' },
  'Spirit':         { icon: 'flare' },
  'Eldritch Being': { icon: 'visibility' },
  'Mindflayer':     { icon: 'psychology' },

  // ── Other ───────────────────────────────────────────────────────────────
  'Alien':       { icon: 'rocket' },
  'Mutant':      { icon: 'biotech' },
  'Time Lord':   { icon: 'schedule' },
  'Immortal':    { icon: 'all_inclusive' },
  'Dinosaur':    { icon: 'pets' },
  'Sea King':    { icon: 'waves' },
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
