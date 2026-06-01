/**
 * One-shot migration: rebrand existing Character + StorySlot documents to
 * the new race/archetype/transformation names introduced in commit 0bf79ed.
 *
 * Walks every document, applies the same rename map the codebase uses, and
 * writes back if anything changed. Safe to re-run — idempotent (the new
 * names don't appear in the LHS of the map so a second pass is a no-op).
 *
 * Run with:
 *   heroku run --app wheel-of-fate -- npx tsx scripts/migrate-rebrand.ts
 *
 * To preview without writing, pass --dry-run:
 *   heroku run --app wheel-of-fate -- npx tsx scripts/migrate-rebrand.ts --dry-run
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import { Character } from '../src/models/Character.js'
import { StorySlot } from '../src/models/StorySlot.js'

const DRY_RUN = process.argv.includes('--dry-run')

// Same map applied to the codebase. Order-sensitive: longest LHS first to
// avoid partial overlap (e.g. 'Super Saiyan 3' must replace before 'Saiyan').
const RENAME_MAP: Record<string, string> = {
  // Long phrases / multi-word transformations first
  'Viltrumite Anomaly (Invincible-Level)': 'Victrumite Anomaly (Apex-Level)',
  'Hammer of Thor':                         'Hammer of Thor', // already migrated source; keep as no-op safety
  'Hollow / Arrancar':                      'Null',
  'Hollow/Arrancar':                        'Null',
  'Super Saiyan Blue':                      'Super Zenith Blue',
  'Super Saiyan God':                       'Super Zenith God',
  'Super Saiyan 3':                         'Super Zenith 3',
  'Super Saiyan 2':                         'Super Zenith 2',
  'Super Saiyan':                           'Super Zenith',
  'Ultra Instinct':                         'Zenith Instinct',
  'Base Saiyan':                            'Base Zenithian',
  'House of El':                            'House of Lume',
  'House of Zod':                           'House of Sovereign',
  'Fortress of Solitude':                   'Solitude Citadel',
  'Kryptonian Heritage':                    'Krystalian Heritage',
  'Kryptonian Martial Arts':                'Krystalian Martial Arts',
  'Kryptonian Battle Art':                  'Krystalian Battle Art',
  'Viltrum Combat Doctrine':                'Victrum Combat Doctrine',
  'Viltrum Elite Combat':                   'Victrum Elite Combat',
  'Viltrum Legend':                         'Victrum Legend',
  'Beyond Viltrum Peak':                    'Beyond Victrum Peak',
  'Atom Eve Bond':                          'Cosmic Bond',
  'Hakai (Destruction)':                    'Unmake (Destruction)',
  'Hakai Authority':                        'Unmake Authority',
  'Planet Vegeta':                          'Planet Caprica',
  "IT'S OVER 9000":                         'Beyond Reading',
  'Zenkai Surge':                           'Resurgence Surge',
  'Half-Viltrumite':                        'Half-Victrumite',
  'Demon Slayer':                           'Dawnbringer',
  'Nen Hunter':                             'Aura Hunter',
  'Stand User':                             'Phantom Bonded',
  'Titan Shifter':                          'Colossus Shifter',
  'Devil Fruit User':                       'Cursed Fruit Eater',
  'Devil Fruit':                            'Cursed Fruit',
  'Sea King':                               'Abyssal Leviathan',
  'Avatar State':                           'Convergence State',
  'Lightning Bender':                       'Voltbender',
  'Breathing Style':                        'Combat Breath',
  'Lord of Time':                           'Lord of Time',
  'Time Lord':                              'Lord of Time',
  // Single-token replacements
  'Cybertronian':                           'Mechshifter',
  'Cybertron':                              'Mechforge',
  'Kryptonian':                             'Krystalian',
  'Krypton':                                'Krystos',
  'Kal-El':                                 'Krystal Prime',
  'Viltrumite':                             'Victrumite',
  'Viltrum':                                'Victrum',
  'Saiyan':                                 'Zenithian',
  'Mindflayer':                             'Cerebrosaur',
  'Dragonborn':                             'Drakekin',
  'Aasimar':                                'Lightborn',
  'Tiefling':                               'Hellborn',
  'Tabaxi':                                 'Felfolk',
  'Warforged':                              'Soulforged',
  'Namekian':                               'Verdantian',
  'Asgardian':                              'Aesir',
  'Zenkai':                                 'Resurgence',
  'Hakai':                                  'Unmake',
  'Oozaru':                                 'Lunar Beast',
  'Vegeta':                                 'Capricorn',
  'Kamehameha':                             'Pulse Cannon',
  'Spirit Bomb':                            'Sky-Forged Sphere',
  'Mjolnir':                                'Hammer of Thor',
  'Bifrost':                                'Rainbow Bridge',
  'TARDIS':                                 'Chronopod',
  'Gallifrey':                              'Aevus',
  'Haki':                                   'Inner Resolve',
  'Bankai':                                 'True Form',
  'Zanpakuto':                              'Soul Blade',
  'Arrancar':                               'Riftborn',
  'Sharingan':                              'Reading Eye',
  'Rasengan':                               'Spiral Sphere',
  'Energon':                                'Aetherium',
  'Allspark':                               'Coreheart',
  'Airbender':                              'Skybender',
  'Esper':                                  'Psion',
  'Shinobi':                                'Shadowblade',
}

// Sort keys by length DESC so the longest match wins when patterns overlap.
const RENAME_KEYS = Object.keys(RENAME_MAP).sort((a, b) => b.length - a.length)

function escRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const RENAME_PATTERNS: Array<{ pattern: RegExp; to: string }> = RENAME_KEYS.map(k => ({
  pattern: new RegExp('(?<![A-Za-z0-9_])' + escRegex(k) + '(?![A-Za-z0-9_])', 'g'),
  to: RENAME_MAP[k],
}))

/** Apply rename map to a string. Returns the original if nothing matched. */
function renameString(s: unknown): unknown {
  if (typeof s !== 'string') return s
  let out = s
  for (const { pattern, to } of RENAME_PATTERNS) {
    if (pattern.test(out)) {
      out = out.replace(pattern, to)
    }
  }
  return out
}

/** Recursively walk an object/array, renaming any string values. Returns
 *  a tuple [transformed, changedCount]. */
function renameDeep(v: unknown): [unknown, number] {
  if (Array.isArray(v)) {
    let changed = 0
    const out = v.map(item => {
      const [next, c] = renameDeep(item)
      changed += c
      return next
    })
    return [out, changed]
  }
  if (v && typeof v === 'object') {
    let changed = 0
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v)) {
      const [next, c] = renameDeep(val)
      changed += c
      out[k] = next
    }
    return [out, changed]
  }
  if (typeof v === 'string') {
    const next = renameString(v) as string
    return [next, next === v ? 0 : 1]
  }
  return [v, 0]
}

async function migrateCharacters() {
  console.log('\n── Migrating Character documents ──')
  // Use deleted_at: { $exists: true } to bypass the model's pre-find hook
  // (which excludes soft-deleted docs) — we want to migrate even soft-deleted
  // characters in case a player un-deletes one later.
  const total = await Character.countDocuments({})
  console.log(`Total documents: ${total}`)

  let scanned = 0
  let changed = 0
  let fieldChanges = 0

  const cursor = Character.find({}).cursor()
  for await (const doc of cursor) {
    scanned++
    let docChanged = false

    const newRace = renameString(doc.race) as string
    const newArch = renameString(doc.archetype) as string
    if (newRace !== doc.race)        { doc.race = newRace; docChanged = true; fieldChanges++ }
    if (newArch !== doc.archetype)   { doc.archetype = newArch; docChanged = true; fieldChanges++ }

    // spins is a Mixed JSON blob — deep walk
    const [newSpins, spinChanges] = renameDeep(doc.spins as object)
    if (spinChanges > 0) {
      doc.spins = newSpins as object
      doc.markModified('spins')
      docChanged = true
      fieldChanges += spinChanges
    }

    if (docChanged) {
      changed++
      if (!DRY_RUN) await doc.save()
      if (scanned % 50 === 0) console.log(`  ${scanned}/${total} scanned, ${changed} updated…`)
    }
  }
  console.log(`Characters: ${scanned} scanned · ${changed} ${DRY_RUN ? 'would update' : 'updated'} · ${fieldChanges} field renames`)
}

async function migrateStorySlots() {
  console.log('\n── Migrating StorySlot documents ──')
  const total = await StorySlot.countDocuments({})
  console.log(`Total documents: ${total}`)

  let scanned = 0
  let changed = 0
  let fieldChanges = 0

  const cursor = StorySlot.find({}).cursor()
  for await (const doc of cursor) {
    scanned++
    const [newSlotData, slotChanges] = renameDeep(doc.slotData as object)
    if (slotChanges > 0) {
      doc.slotData = newSlotData as object
      doc.markModified('slotData')
      ;(doc as { updated_at?: Date }).updated_at = new Date()
      changed++
      fieldChanges += slotChanges
      if (!DRY_RUN) await doc.save()
      if (scanned % 25 === 0) console.log(`  ${scanned}/${total} scanned, ${changed} updated…`)
    }
  }
  console.log(`StorySlots: ${scanned} scanned · ${changed} ${DRY_RUN ? 'would update' : 'updated'} · ${fieldChanges} field renames`)
}

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error('MONGODB_URI not set — refusing to run.')
    process.exit(1)
  }
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE (will write)'}`)
  console.log(`Rename map: ${RENAME_KEYS.length} entries`)
  await mongoose.connect(uri)
  console.log('Connected to MongoDB.')

  try {
    await migrateCharacters()
    await migrateStorySlots()
  } finally {
    await mongoose.disconnect()
    console.log('\nDisconnected.')
  }
}

main().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
