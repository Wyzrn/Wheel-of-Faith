/**
 * seed.ts — Content verification + MongoDB index bootstrap
 * Run: npm run seed (from server/)
 *
 * Checks CONT-01 through CONT-07 content minimums against source arrays,
 * then ensures MongoDB models have their indexes created.
 */

import mongoose from 'mongoose'
import { createRequire } from 'module'
import { pathToFileURL } from 'url'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/wheel-of-fate'

// ── Minimum thresholds (CONT-01 through CONT-07) ─────────────────────────────
const MINIMUMS: Record<string, number> = {
  powers:     1000,
  weapons:    500,
  weaknesses: 450,
  races:      35,
  archetypes: 20,
  armors:     100,
  enchantments: 50,
}

// ── Dynamically import frontend content (relative path from scripts/) ────────
async function loadContent() {
  const contentDir = path.resolve(__dirname, '../../src/lib/content')

  // tsx handles TypeScript imports via register; use dynamic import with file URLs
  const toURL = (file: string) => pathToFileURL(path.join(contentDir, file)).href

  const [
    { powers },
    { weapons },
    { weaknesses },
    { races },
    { archetypes },
    { armors },
    { enchantments },
  ] = await Promise.all([
    import(toURL('powers.ts')),
    import(toURL('weapons.ts')),
    import(toURL('weaknesses.ts')),
    import(toURL('races.ts')),
    import(toURL('archetypes.ts')),
    import(toURL('armors.ts')),
    import(toURL('enchantments.ts')),
  ])

  return {
    powers:      (powers      as any[]).length,
    weapons:     (weapons     as any[]).length,
    weaknesses:  (weaknesses  as any[]).length,
    races:       (races       as any[]).length,
    archetypes:  (archetypes  as any[]).length,
    armors:      (armors      as any[]).length,
    enchantments:(enchantments as any[]).length,
  }
}

// ── Content audit ─────────────────────────────────────────────────────────────
async function auditContent() {
  console.log('\n── Content Minimums Audit ──')
  let allPassed = true

  let counts: Record<string, number>
  try {
    counts = await loadContent()
  } catch (err) {
    console.warn('  ⚠  Could not load content files (tsx path resolution):', (err as Error).message)
    console.warn('  Skipping content audit — run from server/ with tsx registered.')
    return
  }

  for (const [key, min] of Object.entries(MINIMUMS)) {
    const actual = counts[key] ?? 0
    const pass = actual >= min
    if (!pass) allPassed = false
    const icon = pass ? '✓' : '✗'
    const suffix = pass ? '' : `  ← NEEDS ${min - actual} MORE`
    console.log(`  ${icon}  ${key.padEnd(14)} ${String(actual).padStart(5)} / ${min}${suffix}`)
  }

  if (allPassed) {
    console.log('\n  All content minimums met.\n')
  } else {
    console.log('\n  ✗ Some content minimums NOT met — add entries before launch.\n')
  }
}

// ── MongoDB bootstrap ─────────────────────────────────────────────────────────
async function bootstrapMongo() {
  console.log(`── MongoDB Bootstrap ──`)
  console.log(`  Connecting to ${MONGODB_URI} …`)

  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
    console.log('  Connected.')

    // Import models so Mongoose registers schemas and creates indexes
    await import('../src/models/User.js')
    await import('../src/models/Character.js')
    await import('../src/models/Friendship.js')

    // syncIndexes triggers ensureIndexes for all registered models
    await Promise.all(
      Object.values(mongoose.models).map(m => m.syncIndexes())
    )

    console.log(`  Indexes synced for: ${Object.keys(mongoose.models).join(', ')}`)
    await mongoose.disconnect()
    console.log('  Disconnected.\n')
  } catch (err) {
    console.error('  MongoDB error:', (err as Error).message)
    console.warn('  Skipping index sync — is MongoDB running?\n')
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log('\n╔══════════════════════════════╗')
console.log('║   Wheel of Fate — Seed       ║')
console.log('╚══════════════════════════════╝')

await auditContent()
await bootstrapMongo()

console.log('Done.')
