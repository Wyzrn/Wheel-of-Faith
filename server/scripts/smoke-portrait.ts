// End-to-end smoke test: generate a portrait via fal.ai, upload to R2,
// verify the public URL serves it. Disposable — delete after validation.
// Run: cd server && npx tsx --env-file=.env scripts/smoke-portrait.ts
import { generatePortrait } from '../src/services/portraits.ts'

const result = await generatePortrait({
  shareId: `smoketest-${Date.now()}`,
  name: 'Smoke Test',
  race: 'Saiyan',
  archetype: 'Warrior',
  topPower: 'Spirit Bomb',
})

console.log('--- generatePortrait result ---')
console.log(JSON.stringify(result, null, 2))

if (result.ok) {
  console.log('--- fetching URL to verify R2 + public binding ---')
  const r = await fetch(result.url)
  console.log(`HTTP ${r.status} ${r.statusText}`)
  console.log(`Content-Type: ${r.headers.get('content-type')}`)
  console.log(`Bytes: ${Number(r.headers.get('content-length') ?? 0)}`)
  if (r.ok) console.log('OK End-to-end pipeline working — portrait at:', result.url)
  else      console.log('FAIL R2 upload succeeded but public URL not serving — check bucket public binding')
  process.exit(r.ok ? 0 : 1)
} else {
  console.log('FAIL Generation failed — see message above')
  process.exit(1)
}
