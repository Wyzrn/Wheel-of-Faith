import { redemptionProbability } from '../src/lib/game/redemption.js'

const TRIALS = 10_000

function randomScore(): number {
  // Average of 3 uniform [0,100] draws — bell-ish distribution centered ~50
  return (Math.random() * 100 + Math.random() * 100 + Math.random() * 100) / 3
}

let redemptionCount = 0
const buckets: Record<string, number> = { '0-20': 0, '21-40': 0, '41-60': 0, '61-80': 0, '81-100': 0 }

for (let i = 0; i < TRIALS; i++) {
  const score = randomScore()
  const p = redemptionProbability(score)
  if (Math.random() < p) redemptionCount++

  if (score <= 20) buckets['0-20']++
  else if (score <= 40) buckets['21-40']++
  else if (score <= 60) buckets['41-60']++
  else if (score <= 80) buckets['61-80']++
  else buckets['81-100']++
}

const triggerRate = (redemptionCount / TRIALS * 100).toFixed(2)
console.log(`\nRedemption Simulation — ${TRIALS.toLocaleString()} trials`)
console.log(`Trigger rate: ${triggerRate}% (target: 25–35%)`)
console.log(`Triggered: ${redemptionCount}`)
console.log(`\nScore distribution:`)
for (const [range, count] of Object.entries(buckets)) {
  console.log(`  ${range}: ${count} (${(count / TRIALS * 100).toFixed(1)}%)`)
}

console.log(`\nProbability spot-check:`)
for (const score of [0, 25, 50, 75, 100]) {
  console.log(`  Score ${score}: ${(redemptionProbability(score) * 100).toFixed(1)}%`)
}
