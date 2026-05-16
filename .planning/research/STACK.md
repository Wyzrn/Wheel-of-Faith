# Technology Stack

**Project:** Wheel of Fate
**Researched:** 2026-05-15
**Confidence:** HIGH (all versions verified via npm registry; capabilities verified via Context7 official docs)

---

## Recommended Stack

### Animation Engine

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| GSAP | 3.15.0 | Spinning wheel animation, deceleration, sequencing | See rationale below |

**GSAP is the correct choice for the wheel animation.** The core mechanic — a wheel that spins fast, decelerates with a natural curve, and lands precisely on a segment — maps directly to GSAP's `rotation` tween with `power3.out` or `expo.out` easing. You control: final rotation angle (calculated from target segment), duration, and easing curve. GSAP's `gsap.timeline()` enables the 23-wheel sequential flow: each wheel's `onComplete` callback triggers the next. The library handles SVG `rotation` with correct `svgOrigin` transform origins, operates on compositor-only properties for 60fps, and provides `CustomEase` for a bespoke deceleration feel if the built-in power curves aren't dramatic enough.

GSAP 3.x uses a "Standard no charge" license — free for non-premium plugins on non-SaaS projects. The premium plugins (MorphSVG, DrawSVG, etc.) require a paid license, but none of those are needed here. Confirm at https://gsap.com/standard-license before shipping.

**Confidence: HIGH** — Context7 official GSAP skills docs confirmed rotation, easing, timeline, and SVG origin APIs. Version confirmed via npm registry.

---

### Wheel Rendering: SVG over Canvas

**Use SVG, not Canvas, not PixiJS.**

The wheel is a pie chart with labeled segments. SVG handles this natively with `<path>` elements for pie slices, `<text>` for labels, and CSS or inline styles for colors. GSAP animates SVG `rotation` directly with correct transform origin via `svgOrigin`.

Canvas (raw 2D context) requires re-drawing every frame during the spin — you'd reimplement what GSAP's SVG path does better. PixiJS (8.16.0 current) is a WebGL/WebGPU scene graph built for game-scale rendering with thousands of sprites, particles, and shader effects. It is architectural overkill for a single pie chart that spins once per interaction. PixiJS adds ~1MB+ to the bundle and forces a fundamentally different programming model (scene graph vs DOM) for no benefit at this scale.

CSS-only spinning (CSS `animation: spin` + `animation-play-state: paused`) cannot reliably land on a specific segment because browsers calculate final state from keyframe percentages, not from a computed rotation angle. Controlling deceleration to an exact degree is not possible with pure CSS.

**Decision: SVG rendered in the DOM, animated by GSAP.**

---

### Frontend Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Svelte | 5.55.7 | Frontend UI framework | See rationale below |
| SvelteKit | 2.60.1 | Routing, page structure, SSR-optional | File-based router, built on Vite |
| Vite | 8.0.13 | Build tool (bundled with SvelteKit) | Fast HMR, modern ESM |

**Svelte 5 with SvelteKit is the correct frontend choice for this project.**

The game has three distinct UI surfaces: the active spin screen (one animated wheel + result display), the character card (static styled sheet after all 23 spins), and the gallery (browsable list of saved characters). These are page-level concerns, not a complex component tree. Svelte's compiled output is smaller than React's runtime bundle, which matters for a game that should feel instant to load.

Svelte 5's rune system (`$state`, `$derived`, `$effect`) provides reactive state without the overhead of learning a separate state management library. The 23-wheel sequence is a state machine: current wheel index, accumulated results array, and derived character score. This maps cleanly to `$state` variables and `$derived` computations.

SvelteKit's file-based routing gives you `/` (game/spin screen), `/character/[id]` (shareable character card), and `/gallery` (roster) with zero router configuration. SvelteKit can be deployed as a Node.js server via `@adapter-node` (5.5.4) alongside the Fastify API, or built to static files via `@adapter-static` (3.0.10) with the API hosted separately.

**Why not React?** React 19 (19.2.0 current) is well-suited to this project too, but it brings a larger runtime, requires a separate router (React Router 7 or TanStack Router), and requires `useGSAP` from `@gsap/react` (2.1.2) to manage animation cleanup. GSAP's Context7 docs confirm this hook works correctly and handles unmount cleanup — but it's an extra dependency. Svelte's native lifecycle and smaller output tip the recommendation toward Svelte for a project where animation and snappy feel are the primary value.

**Why not Vue?** Vue 3 is a solid choice but Svelte's compiled-away reactivity and smaller bundle size are preferable for a game-feel product. No strong reason to pick Vue over Svelte here.

**Why not vanilla JS?** With 23 wheel states, a character accumulator, three page views, and shareable links — vanilla JS rapidly becomes difficult to maintain. The routing and state management problems that frameworks solve are present here.

**Confidence: HIGH** — Svelte 5 runes, SvelteKit routing, and GSAP/React integration all verified via Context7 official docs. Versions confirmed via npm.

---

### Backend Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Fastify | 5.8.5 | REST API (Node.js) | See rationale below |
| @fastify/cors | 11.2.0 | CORS for browser requests | Official Fastify plugin |
| @fastify/static | 9.1.3 | Serve frontend static build | Optional monorepo deployment |

**Fastify is the correct backend framework.**

The API surface for this project is small: `POST /characters` (save a new character), `GET /characters/:id` (fetch one by share link), `GET /characters` (paginated gallery list). Fastify's built-in JSON Schema validation on request bodies is exactly right for validating the 23-field character document before persistence. The schema-first approach (shown in its Context7 docs) documents the API while enforcing it simultaneously.

Fastify 5.x uses async/await throughout with no callback-style legacy. Its plugin system (`@fastify/cors`, `@fastify/static`) covers everything this project needs without configuration complexity. It is measurably faster than Express under benchmarks, though at this project's scale that is not the deciding factor — the deciding factor is Fastify's built-in validation and cleaner async design.

**Why not Express?** Express 5.2.1 is stable but has no built-in request validation, requires separate middleware for async error handling, and its middleware pattern results in more boilerplate. The project does not benefit from Express's larger ecosystem (most packages have Fastify equivalents).

**Why not Hono?** Hono 4.12.18 is excellent for edge runtimes (Cloudflare Workers, Deno Deploy). For a Node.js + MongoDB deployment on a traditional VPS or Railway/Render, Hono adds complexity without benefit — its Node.js adapter is an extra layer. Choose Hono if you later decide to deploy to edge; keep Fastify for Node.js-native deployment.

**Confidence: HIGH** — Fastify route schema validation, CORS and static file plugins verified via Context7 official docs. Version confirmed via npm.

---

### Database

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| MongoDB Atlas (cloud) | — | Character document storage | See rationale below |
| Mongoose | 9.6.2 | Node.js ODM | Schema definition, validation, query |

**MongoDB with Mongoose is the correct database choice.**

A character in Wheel of Fate is a document: a flat-ish JSON object with 23+ fields, some of which are arrays (powers, weapons, abilities), some are nested objects (scores with letter + numeric values), and the schema may grow as content is added. There is no relational structure to enforce — a character is self-contained, looked up by ID, and displayed in full. MongoDB's document model fits this naturally.

The `shareable link` requirement maps directly to MongoDB's `_id` field (or a short nanoid stored alongside it). `GET /characters/:id` is a single `findById` call. The gallery is `Character.find({}).sort({ createdAt: -1 }).limit(20)`.

Mongoose 9.x (latest stable) provides: schema definition that mirrors Fastify's request validation (the character shape is defined once and enforced at both API and database layers), middleware hooks for pre-save logic (e.g., computing the overall power score before persistence), and typed query results.

**MongoDB Atlas Free Tier** provides 512MB storage with no infrastructure to manage — appropriate for this project's scale. The free tier connection string drops into a `MONGODB_URI` environment variable. Upgrade path is clear if the gallery grows large.

**Why not PostgreSQL?** PostgreSQL requires either a rigid flat schema (awkward for variable-ability-count characters) or JSONB columns (which work but abandon the relational model's benefits anyway). The character document is not relational data. PostgreSQL is the correct choice when you have joins and referential integrity requirements — this project has neither.

**Why not SQLite?** SQLite is an excellent embedded database for single-server deployments, but a gallery of shareable links accessed by different people on different devices requires the database to be accessible over the network. SQLite's embedded, file-based nature complicates this. It would work on a single persistent server but is awkward on platforms like Railway or Render that may restart containers.

**Why not Supabase?** Supabase is PostgreSQL with a hosted layer and auto-generated REST API. For this project that would mean adopting PostgreSQL's constraints (see above) plus a third-party platform dependency. Supabase is excellent for projects that need auth, realtime, and row-level security — none of which apply here (no login required per PROJECT.md).

**Confidence: HIGH** — Mongoose schema and document save/query operations verified via Context7 official docs. MongoDB document model fit assessed against PROJECT.md requirements.

---

### Shareable Link ID Generation

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| nanoid | 5.1.11 | Short URL-safe character IDs | Cryptographically secure, URL-safe, tiny |

Each character gets a `nanoid(10)` as its public share ID, stored as `shareId` on the MongoDB document alongside `_id`. The share URL is `/character/abc1234xyz`. nanoid 5.x is ESM-native and works in both Node.js (Fastify) and browser (Svelte) environments. At 10 characters (64-character alphabet), collision probability is negligible for any realistic gallery size.

**Confidence: HIGH** — nanoid is the established standard for this use case. Version confirmed via npm.

---

## Complete Stack Summary

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend framework | Svelte + SvelteKit | 5.55.7 / 2.60.1 |
| Build tool | Vite (via SvelteKit) | 8.0.13 |
| Animation | GSAP | 3.15.0 |
| Wheel rendering | SVG (DOM, no library) | — |
| Backend framework | Fastify | 5.8.5 |
| CORS | @fastify/cors | 11.2.0 |
| Static serving | @fastify/static | 9.1.3 |
| Database | MongoDB Atlas | cloud-managed |
| ODM | Mongoose | 9.6.2 |
| ID generation | nanoid | 5.1.11 |
| CSS | Tailwind CSS | 4.3.0 |

Tailwind 4.x is included because the character card and gallery need real styling. Tailwind's utility classes integrate cleanly with Svelte components and avoid the overhead of building a custom CSS architecture.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Animation | GSAP | CSS animations | Cannot reliably target a specific rotation angle for segment landing |
| Animation | GSAP | PixiJS | WebGL/WebGPU scene graph is overkill for a single SVG pie chart |
| Animation | GSAP | Anime.js | GSAP has better timeline control, easing library, and SVG support |
| Wheel rendering | SVG | Canvas 2D | Requires manual re-draw loop; no benefit over GSAP-animated SVG |
| Frontend | Svelte | React | React is also viable but larger bundle and requires @gsap/react hook |
| Frontend | Svelte | Vanilla JS | 23-state sequence + routing + gallery = legitimate framework use case |
| Backend | Fastify | Express | No built-in validation; more boilerplate; Fastify is strictly better here |
| Backend | Fastify | Hono | Optimized for edge runtimes; adds friction on Node.js native deployment |
| Database | MongoDB | PostgreSQL | Relational model is a mismatch for a variable-schema character document |
| Database | MongoDB | SQLite | File-based embed is awkward for networked shareable links across devices |
| Database | MongoDB | Supabase | Brings unneeded auth/realtime; same schema mismatch as PostgreSQL |

---

## Installation

```bash
# Frontend (Svelte + SvelteKit)
npm create svelte@latest frontend
# Choose: Skeleton project, TypeScript optional, no ESLint/Prettier yet

cd frontend
npm install gsap
npm install -D tailwindcss @tailwindcss/vite

# Backend (Fastify + Mongoose)
mkdir backend && cd backend
npm init -y
npm install fastify @fastify/cors @fastify/static mongoose nanoid dotenv
npm install -D @types/node  # if using TypeScript
```

---

## Deployment Considerations

**Recommended deployment target: Railway or Render (free/hobby tier)**

Both platforms support Node.js services with persistent environment variables. The deployment model is:

1. SvelteKit frontend built to static files via `vite build` — deployed to a CDN (Netlify, Vercel, or served via `@fastify/static` from the same Node process)
2. Fastify backend deployed as a Node.js service with `MONGODB_URI` env var pointing to MongoDB Atlas

**Simplest monorepo approach:** Fastify serves the SvelteKit static build via `@fastify/static`. One process, one deployment, one port. This is appropriate for a hobby/personal project.

**Split deployment:** SvelteKit on Netlify/Vercel (free), Fastify on Railway (free tier), MongoDB on Atlas (free tier). More scalable but more configuration.

**No Docker required at launch** — these platforms handle Node.js natively. Add Docker if self-hosting.

**Confidence: MEDIUM** — Deployment platform details are based on current platform capabilities known up to knowledge cutoff (August 2025). Pricing tiers and free tier limits should be verified at launch.

---

## Sources

- GSAP skills, easing, rotation, timeline, React hook: Context7 `/greensock/gsap-skills` (Source Reputation: High, Benchmark Score: 92.75)
- Fastify route schemas, validation, CORS, static plugins: Context7 `/fastify/fastify` and `/websites/fastify_dev`
- Mongoose schema, save, find operations: Context7 `/automattic/mongoose`
- Svelte 5 runes ($state, $derived, $effect): Context7 `/websites/svelte_dev`
- SvelteKit file-based routing: Context7 `/websites/svelte_dev_svelte`
- Vite build configuration: Context7 `/vitejs/vite`
- All package versions: npm registry (verified 2026-05-15)
- GSAP license: npm registry description field referencing https://gsap.com/standard-license
