// One-shot localStorage migration matching the 2026-05-31 rebrand.
// Walks every persisted character payload (rolling history, story save
// slots, saved-chars index) and rewrites legacy race/archetype/transform
// names in-place using the same map the server migration applied.
//
// Idempotent: new names never appear on the LHS, so subsequent runs are
// no-ops. A migrated-version flag in localStorage skips re-runs entirely
// on future page loads.

const REBRAND_VERSION_KEY = 'wof_rebrand_v1'

// Order matters: longest LHS first so 'Super Saiyan 3' matches before 'Saiyan'.
const RENAME_PAIRS: Array<[string, string]> = [
  ['Viltrumite Anomaly (Invincible-Level)', 'Victrumite Anomaly (Apex-Level)'],
  ['Hollow / Arrancar',                     'Null'],
  ['Hollow/Arrancar',                       'Null'],
  ['Super Saiyan Blue',                     'Super Zenith Blue'],
  ['Super Saiyan God',                      'Super Zenith God'],
  ['Super Saiyan 3',                        'Super Zenith 3'],
  ['Super Saiyan 2',                        'Super Zenith 2'],
  ['Super Saiyan',                          'Super Zenith'],
  ['Ultra Instinct',                        'Zenith Instinct'],
  ['Base Saiyan',                           'Base Zenithian'],
  ['House of El',                           'House of Lume'],
  ['House of Zod',                          'House of Sovereign'],
  ['Fortress of Solitude',                  'Solitude Citadel'],
  ['Kryptonian Heritage',                   'Krystalian Heritage'],
  ['Kryptonian Martial Arts',               'Krystalian Martial Arts'],
  ['Kryptonian Battle Art',                 'Krystalian Battle Art'],
  ['Viltrum Combat Doctrine',               'Victrum Combat Doctrine'],
  ['Viltrum Elite Combat',                  'Victrum Elite Combat'],
  ['Viltrum Legend',                        'Victrum Legend'],
  ['Beyond Viltrum Peak',                   'Beyond Victrum Peak'],
  ['Atom Eve Bond',                         'Cosmic Bond'],
  ['Hakai (Destruction)',                   'Unmake (Destruction)'],
  ['Hakai Authority',                       'Unmake Authority'],
  ['Planet Vegeta',                         'Planet Caprica'],
  ["IT'S OVER 9000",                        'Beyond Reading'],
  ['Zenkai Surge',                          'Resurgence Surge'],
  ['Half-Viltrumite',                       'Half-Victrumite'],
  ['Demon Slayer',                          'Dawnbringer'],
  ['Nen Hunter',                            'Aura Hunter'],
  ['Stand User',                            'Phantom Bonded'],
  ['Titan Shifter',                         'Colossus Shifter'],
  ['Devil Fruit User',                      'Cursed Fruit Eater'],
  ['Devil Fruit',                           'Cursed Fruit'],
  ['Sea King',                              'Abyssal Leviathan'],
  ['Avatar State',                          'Convergence State'],
  ['Lightning Bender',                      'Voltbender'],
  ['Breathing Style',                       'Combat Breath'],
  ['Time Lord',                             'Lord of Time'],
  ['Cybertronian',                          'Mechshifter'],
  ['Cybertron',                             'Mechforge'],
  ['Kryptonian',                            'Krystalian'],
  ['Krypton',                               'Krystos'],
  ['Kal-El',                                'Krystal Prime'],
  ['Viltrumite',                            'Victrumite'],
  ['Viltrum',                               'Victrum'],
  ['Saiyan',                                'Zenithian'],
  ['Mindflayer',                            'Cerebrosaur'],
  ['Dragonborn',                            'Drakekin'],
  ['Aasimar',                               'Lightborn'],
  ['Tiefling',                              'Hellborn'],
  ['Tabaxi',                                'Felfolk'],
  ['Warforged',                             'Soulforged'],
  ['Namekian',                              'Verdantian'],
  ['Asgardian',                             'Aesir'],
  ['Zenkai',                                'Resurgence'],
  ['Hakai',                                 'Unmake'],
  ['Oozaru',                                'Lunar Beast'],
  ['Vegeta',                                'Capricorn'],
  ['Kamehameha',                            'Pulse Cannon'],
  ['Spirit Bomb',                           'Sky-Forged Sphere'],
  ['Mjolnir',                               'Hammer of Thor'],
  ['Bifrost',                               'Rainbow Bridge'],
  ['TARDIS',                                'Chronopod'],
  ['Gallifrey',                             'Aevus'],
  ['Haki',                                  'Inner Resolve'],
  ['Bankai',                                'True Form'],
  ['Zanpakuto',                             'Soul Blade'],
  ['Arrancar',                              'Riftborn'],
  ['Sharingan',                             'Reading Eye'],
  ['Rasengan',                              'Spiral Sphere'],
  ['Energon',                               'Aetherium'],
  ['Allspark',                              'Coreheart'],
  ['Airbender',                             'Skybender'],
  ['Esper',                                 'Psion'],
  ['Shinobi',                               'Shadowblade'],
]

// Pre-compile patterns once at module load. The lookarounds skip matches
// inside identifiers (e.g. 'Saiyan' inside a className) so we don't damage
// stored CSS hooks or internal flags.
function escRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
const PATTERNS: Array<{ pattern: RegExp; to: string }> = RENAME_PAIRS.map(([from, to]) => ({
  pattern: new RegExp('(?<![A-Za-z0-9_])' + escRegex(from) + '(?![A-Za-z0-9_])', 'g'),
  to,
}))

function renameString(s: string): string {
  let out = s
  for (const { pattern, to } of PATTERNS) {
    if (pattern.test(out)) out = out.replace(pattern, to)
  }
  return out
}

// Recursively rewrite every string value in a parsed JSON tree.
function renameDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(renameDeep)
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = renameDeep(val)
    return out
  }
  if (typeof v === 'string') return renameString(v)
  return v
}

/** localStorage keys to walk. All hold JSON. Anything else is skipped. */
const KEYS_TO_MIGRATE = [
  'wof_char_history_v1',  // rolling 5-character history
  'wof_session',          // in-progress spin session
  'wof_saved_chars',      // saved-shareId index
]

// Story Mode slots are keyed by id (story_slot_1..4); enumerate all of them.
function storySlotKeys(): string[] {
  return ['story_slot_1', 'story_slot_2', 'story_slot_3', 'story_slot_4']
}

/** Run once on first page load after the rebrand. Subsequent loads are
 *  no-ops because we stamp REBRAND_VERSION_KEY when done. Safe to call
 *  from anywhere — bails immediately if not in the browser. */
export function runRebrandMigration(): void {
  if (typeof localStorage === 'undefined') return
  if (localStorage.getItem(REBRAND_VERSION_KEY)) return

  const allKeys = [...KEYS_TO_MIGRATE, ...storySlotKeys()]
  let migrated = 0

  for (const key of allKeys) {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw)
      const next = renameDeep(parsed)
      const before = JSON.stringify(parsed)
      const after = JSON.stringify(next)
      if (before !== after) {
        localStorage.setItem(key, after)
        migrated++
      }
    } catch { /* malformed value — leave it alone */ }
  }

  localStorage.setItem(REBRAND_VERSION_KEY, '1')
  if (migrated > 0 && typeof console !== 'undefined') {
    console.info(`[rebrand] migrated ${migrated} localStorage entries`)
  }
}
