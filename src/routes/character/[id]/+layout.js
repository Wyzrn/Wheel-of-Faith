// Mirrors the root layout: SPA mode (no SSR, no prerender). Previously this
// route forced ssr=true to support the server-only load function; that load
// has been converted to a universal +page.ts so we no longer need (or want)
// SSR — having it on breaks the itch.io static build because the client
// would request a __data.json file that doesn't exist server-side there.
export const ssr = false
export const prerender = false
