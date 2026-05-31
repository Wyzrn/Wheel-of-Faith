import { error } from '@sveltejs/kit'
import type { PageLoad } from './$types'
import { apiUrl } from '$lib/api'

export const ssr = false

export const load: PageLoad = async ({ params, fetch }) => {
  const res = await fetch(apiUrl(`/api/story-slots/${params.shareId}`))
  if (!res.ok) throw error(404, 'Save slot not found')
  const data = await res.json()
  return { slotData: data.slotData, shareId: params.shareId }
}
