// Override the root layout's ssr = false for the share route.
// The /character/[id] page uses a +page.server.ts load function that must run on the server
// to fetch character data from Fastify. Without SSR enabled here, the load function is skipped
// and the share view breaks. The root layout disables SSR for the game (no server needed for
// the spin loop), but the share view needs server-side rendering for correct data hydration.
export const ssr = true;
export const prerender = false;
