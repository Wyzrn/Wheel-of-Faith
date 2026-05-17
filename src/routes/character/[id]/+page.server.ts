import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

// CRITICAL (RESEARCH.md Pitfall 1): The Vite proxy is browser-only and does NOT help SSR.
// This load function runs server-side in Node.js and MUST call the Fastify backend directly
// via API_URL env var, NOT via '/api/...' which would hit the Vite dev server and 404.
export const load: PageServerLoad = async ({ params, fetch }) => {
	const apiUrl = process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 3001}`

	const res = await fetch(`${apiUrl}/api/characters/${params.id}`)

	if (res.status === 404) {
		error(404, { message: 'This fate has been lost to the multiverse.' })
	}

	if (!res.ok) {
		error(500, { message: 'Failed to load character.' })
	}

	const character = await res.json()
	return { character }
}
