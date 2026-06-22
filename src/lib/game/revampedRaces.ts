// Registry of races that have been through the 2026-06 race revamp.
// Used to surface a "Legacy" tag on characters spun before their race was
// revamped (and on new characters built with non-revamped races still using
// the legacy structure).
//
// Adding to this list = removing the Legacy tag from characters of that race.
// Order is purely alphabetical for human scanning; lookup is via Set.

export const REVAMPED_RACES: ReadonlySet<string> = new Set([
  // Common tier
  'Human', 'Orc', 'Halfling', 'Goblin', 'Gnome', 'Robot', 'Elf', 'Kobold',
  'Catfolk', 'Sprite', 'Zombie', 'Merfolk', 'Imp', 'Satyr', 'Hobgoblin',
  'Ghost', 'Pixie', 'Gremlin', 'Wisp', 'Rat',
  // Uncommon tier
  'Half-Elf', 'Half-Orc', 'Hellborn', 'Drakekin', 'Lightborn', 'Lizardfolk',
  'Felfolk', 'Goliath', 'Oni', 'Troll', 'Treant', 'Harpy', 'Dullahan',
  'Gargoyle', 'Fairy', 'Dryad', 'Skeleton', 'Ogre', 'Centaur', 'Lamia',
  // Rare tier
  'Soulforged', 'Cyborg', 'Bender', 'Mutant', 'Numokian', 'Vampire',
  'Werebeast', 'Dragon', 'Parasyte', 'Beast', 'Alien', 'Dinosaur',
  'Spirit', 'Ghoul', 'Giant', 'Golem', 'Construct', 'Revenant',
  'Griffin', 'Elemental', 'Insectoid',
])

// Includes pre-revamp race labels still present on older characters (before
// the rebrand commits). Their characters keep the Legacy tag forever, but
// won't double-flag if someone re-spins under the new name.
const LEGACY_RACE_ALIASES: ReadonlySet<string> = new Set([
  'Verdantian', // → Numokian
  'Werewolf',   // → Werebeast
  'Symbiote',   // → Parasyte
])

export function isLegacyCharacter(raceLabel: string | null | undefined): boolean {
  if (!raceLabel) return false
  if (LEGACY_RACE_ALIASES.has(raceLabel)) return true
  return !REVAMPED_RACES.has(raceLabel)
}
