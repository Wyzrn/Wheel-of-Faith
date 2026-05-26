// Shared type for SpinResultReveal — kept here so route files can import
// without crossing into Svelte component land for type-only imports.
import type { ElementType, ItemGrade } from '$lib/content/types'

export interface ResolvedMeta {
  element?: ElementType
  grade?: ItemGrade
  abilityType?: string
  description?: string
  statEffect?: string
}
