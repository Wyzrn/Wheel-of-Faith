# Shipping to itch.io

The build pipeline produces two artifacts from the same source tree:

- **Heroku build** (default): `npm run build` — uses `adapter-node`, ships
  the full SvelteKit + Fastify + MongoDB stack to Heroku.
- **itch.io build**: `npm run build:itch` — uses `adapter-static` with a
  SPA fallback, producing a fully static `build/` directory that talks to
  the existing Heroku backend over CORS for online features (rivals,
  gallery, friends, shop, leaderboards, clans, story-slot cloud sync).

Same codebase, same content, same UX. The flip is driven by the `ITCH=1`
env at build time + the `VITE_API_URL` env that re-routes every server
call from same-origin `/api/…` to the absolute Heroku URL.

## One-shot publish

```sh
# Builds + zips a wheel-of-fate-itch.zip ready to upload.
npm run package:itch
```

Override the backend if you're pointing at a non-prod server:

```sh
VITE_API_URL=https://my-staging.example.com npm run package:itch
```

Then in the itch.io dashboard:

1. Create a new project, kind = **HTML**.
2. Embed options: viewport 1280 × 720 (matches the design viewport), tick
   "Click to launch in fullscreen". Mobile friendly is already supported
   via the html-level CSS zoom + dynamic viewport units.
3. Upload `wheel-of-fate-itch.zip`. Mark it as "This file will be played in
   the browser." itch auto-detects `index.html` at the zip root.
4. Publish.

## Backend env vars (Heroku)

The Heroku app needs two extra env vars to accept requests from itch:

```sh
heroku config:set EXTRA_ORIGINS="https://html-classic.itch.zone"
heroku config:set CROSS_ORIGIN_COOKIES=1
```

- `EXTRA_ORIGINS` is a comma-separated allowlist that augments the
  hard-coded itch wildcard patterns (`*.itch.zone`, `*.ssl.hwcdn.net`).
- `CROSS_ORIGIN_COOKIES=1` switches the auth cookie from
  `SameSite=Lax; Secure-in-prod` to `SameSite=None; Secure` so the iframe
  can send credentials.

## Architecture notes

- **`src/lib/api.ts`** — every server call funnels through `apiUrl(path)` /
  `wsUrl(path)`. Adding a new server call? Use the helper. Hard-coded
  `/api/…` in a fresh fetch will work on Heroku but silently break on
  itch.
- **`svelte.config.js`** — picks the adapter from `process.env.ITCH`. No
  duplicated config files.
- **`server/src/app.ts`** — CORS allows itch CDN origins by pattern, plus
  anything in `EXTRA_ORIGINS`.
- **`server/src/routes/auth.ts`** — cookie attrs centralised in
  `cookieOpts()`. The `CROSS_ORIGIN_COOKIES` env flag flips the
  same-site/secure pair.

## Limitations

- The itch build **requires** the Heroku backend to be online for any
  account-driven feature (login, save sync, rivals, gallery, friends,
  shop, leaderboards, clans). Single-player spin runs work offline because
  the session lives in localStorage.
- No native Steam/Itch app wrapper yet — this is pure HTML5. The
  follow-on Tauri/Electron wrap is a separate effort.
