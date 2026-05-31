// Universal client-side load for the share view.
//
// Previously this route used a +page.server.ts loader with ssr=true so the
// HTML rendered with character data inline. That works on Heroku (adapter-
// node serves it) but breaks on the itch.io static build (adapter-static)
// because the client requests __data.json files that don't exist when
// there's no server. Going universal — fetch via apiUrl() inside a normal
// load() — works for both targets at the cost of one extra round-trip on
// Heroku (fetch happens client-side after hydration).
//
// 404 mapping is preserved so the share view still shows the missing-fate
// error page when the shareId is bogus.
import { error } from '@sveltejs/kit'
import type { PageLoad } from './$types'
import { apiUrl } from '$lib/api'

export const load: PageLoad = async ({ params, fetch }) => {
	// `credentials: include` so the request carries the auth cookie — the
	// server uses it to compute `isOwner` for owner-only UI affordances
	// (e.g. the Regenerate Portrait button).
	const res = await fetch(apiUrl(`/api/characters/${params.id}`), { credentials: 'include' })

	if (res.status === 404) {
		error(404, { message: 'This fate has been lost to the multiverse.' })
	}
	if (!res.ok) {
		error(500, { message: 'Failed to load character.' })
	}

	const character = await res.json()
	return { character }
}
