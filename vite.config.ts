import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		proxy: {
			'/api': {
				target: 'http://localhost:3001',
				changeOrigin: true,
			},
		},
	},
	build: {
		assetsInlineLimit: 4096,
		// Split large content/vendor modules into long-lived cacheable chunks so the
		// initial parse is smaller and content modules (races 300KB, weapons/archetypes
		// 52KB each, powers 60KB+) don't blow up the main bundle on every route.
		rollupOptions: {
			output: {
				manualChunks: (id) => {
					if (id.includes('node_modules')) {
						if (id.includes('gsap')) return 'vendor-gsap';
						if (id.includes('svelte')) return 'vendor-svelte';
						return 'vendor';
					}
					if (id.includes('src/lib/content/races')) return 'content-races';
					if (id.includes('src/lib/content/archetypes')) return 'content-archetypes';
					if (id.includes('src/lib/content/weapons') || id.includes('src/lib/content/armors')) return 'content-gear';
					if (id.includes('src/lib/content/powers')) return 'content-powers';
					if (id.includes('src/lib/content/')) return 'content-misc';
				},
			},
		},
	},
});
