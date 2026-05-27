import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

// CRITICAL (RESEARCH.md Pitfall 1): The Vite proxy is browser-only and does NOT help SSR.
// This load function runs server-side in Node.js and MUST call the Fastify backend directly
// via API_URL env var, NOT via '/api/...' which would hit the Vite dev server and 404.
//
// IPv6 LANDMINE: Node 18+ `fetch` resolves `localhost` to ::1 first. On Heroku
// the Fastify server binds to 0.0.0.0 (IPv4 only), so a fetch to
// `http://localhost:$PORT/...` raises `TypeError: fetch failed` (ECONNREFUSED).
// Use 127.0.0.1 explicitly to pin the loopback to IPv4.
export const load: PageServerLoad = async ({ params, fetch }) => {
	const apiUrl = process.env.API_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3001}`

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
