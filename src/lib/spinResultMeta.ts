// Shared type for SpinResultReveal — kept here so route files can import
// without crossing into Svelte component land for type-only imports.
import type { ElementType, ItemGrade } from '$lib/content/types'
import type { IdentityCard, IdentityPerk } from '$lib/identityCard'

export interface ResolvedMeta {
  element?: ElementType
  grade?: ItemGrade
  abilityType?: string
  description?: string
  statEffect?: string
  // Race + archetype lands swap the generic reveal copy for a themed
  // "identity card" surfacing their unique perks, granted powers, ability
  // pool rename, etc. When set, SpinResultReveal renders this in place of
  // the standard description + statEffect lines.
  identityCard?: IdentityCard
  // Structured grant list for non-identity-card spins (raceClass, raceWheel,
  // raceSubType, raceTransformation). Surfaces every concrete reward — flat
  // stat bonuses, granted weapons/armor/powers, unlocked perks, floor lifts,
  // bonus spins, disabled spins — as animated perk rows in the reveal panel.
  grants?: IdentityPerk[]
}
