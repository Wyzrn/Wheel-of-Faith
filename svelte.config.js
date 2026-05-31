// Build target is selected by ITCH=1 env at build time:
//   ITCH=1 npm run build   →   adapter-static  (SPA fallback for itch.io)
//   npm run build          →   adapter-node    (Heroku, default)
//
// adapter-static needs every route to be reachable as a static asset; the
// SPA fallback to index.html means dynamic routes (/character/[id],
// /users/[username], /story/slot/[shareId], …) are rendered client-side at
// runtime instead of being prerendered. The whole app already runs as
// `ssr: false; prerender: false` (see src/routes/+layout.js), so this is a
// clean SPA build.

import nodeAdapter from '@sveltejs/adapter-node';
import staticAdapter from '@sveltejs/adapter-static';

const isItch = process.env.ITCH === '1';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: isItch
			? staticAdapter({
					// SPA mode: every request not matched by a static file falls
					// back to index.html, letting SvelteKit's client-side router
					// resolve the URL. Required for dynamic routes since they
					// can't be prerendered.
					fallback: 'index.html',
					pages: 'build',
					assets: 'build',
					strict: false
				})
			: nodeAdapter(),
		// itch.io hosts each HTML5 game under a randomized subpath
		// (html-classic.itch.zone/html/<id>/<hash>/…). SvelteKit's default
		// absolute asset URLs (/_app/immutable/…) would resolve to the root
		// of html-classic.itch.zone where nothing exists, returning 403 for
		// every chunk. Emitting relative URLs (./_app/…) makes the browser
		// resolve them from the current document, which is the game's
		// actual subpath. No-op for the Heroku build (same-origin), so
		// always-on is safe.
		paths: isItch ? { relative: true } : undefined
	}
};

export default config;
