/**
 * clear-clans.ts — One-shot admin script to wipe all clans + scrub all
 * clanId references from users.
 *
 * Run on Heroku: heroku run "npx tsx scripts/clear-clans.ts" -a wheel-of-fate
 * Run locally:   MONGODB_URI=... npx tsx scripts/clear-clans.ts
 *
 * Why a one-shot script: there's no admin UI for this and exposing
 * "DELETE all clans" as an HTTP endpoint is asking for accidents.
 */

import mongoose from 'mongoose'
import { Clan } from '../src/models/Clan.js'
import { User } from '../src/models/User.js'

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/wheel-of-fate'

async function main() {
  console.log(`[clear-clans] connecting to ${MONGODB_URI.replace(/:\/\/[^@]+@/, '://***@')}`)
  await mongoose.connect(MONGODB_URI)

  // 1. Count what we're about to wipe so the operator sees the scale
  const clanCount = await Clan.countDocuments({})
  const usersInClan = await User.countDocuments({ clanId: { $ne: null, $exists: true } })
  console.log(`[clear-clans] found ${clanCount} clans, ${usersInClan} users with clanId set`)

  if (clanCount === 0 && usersInClan === 0) {
    console.log('[clear-clans] nothing to do — clans collection empty + no users in clans')
    await mongoose.disconnect()
    return
  }

  // 2. Drop every clan
  const clanResult = await Clan.deleteMany({})
  console.log(`[clear-clans] deleted ${clanResult.deletedCount} clans`)

  // 3. Unset clanId on every user (even orphans whose clan was already gone)
  const userResult = await User.updateMany(
    { clanId: { $ne: null, $exists: true } },
    { $unset: { clanId: 1 } },
  )
  console.log(`[clear-clans] cleared clanId on ${userResult.modifiedCount} users`)

  console.log('[clear-clans] done. All clans wiped, all users now clan-less.')
  await mongoose.disconnect()
}

main().catch(err => {
  console.error('[clear-clans] failed:', err)
  process.exit(1)
})
