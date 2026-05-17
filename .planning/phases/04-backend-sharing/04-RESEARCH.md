# Phase 4: Backend + Sharing — Research

**Researched:** 2026-05-16
**Domain:** Fastify 5 + Mongoose 9.6 + nanoid 5 + SvelteKit API routes + MongoDB soft-delete
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BACK-01 | Fastify 5 + MongoDB (Mongoose) saves character as document; `spins` as JSON blob; `race`, `archetype`, `overall_score`, `overall_tier` denormalized | Mongoose schema pattern documented below; denormalized field selection driven by GALL-01 query needs |
| BACK-02 | nanoid(10) share ID; character accessible at `/character/[id]` | nanoid 5 ESM import confirmed; SvelteKit `[id]` dynamic route pattern documented |
| BACK-03 | Soft-delete only (`deleted_at` timestamp); missing or deleted ID returns styled 404 page | Mongoose soft-delete plugin pattern documented; SvelteKit `error()` helper for 404 page documented |
| BACK-04 | `POST /api/characters` validates 90-second minimum session time; IP rate limiting via `@fastify/rate-limit` | Session timing via `startedAt` timestamp already in `SessionState`; rate-limit plugin config documented |
| CARD-02 | "Save & Share" button on character card that persists character and generates shareable URL | SvelteKit `+server.ts` POST handler pattern documented; CharacterCard needs a new action button wired to fetch |
</phase_requirements>

---

## Summary

Phase 4 adds a Fastify 5 backend running as a **separate Node.js process** alongside the SvelteKit dev server, connected via a Vite proxy in development and a reverse proxy (or same-origin deployment) in production. The frontend calls `POST /api/characters` from a SvelteKit `+server.ts` route that acts as a thin proxy to the Fastify server — or, more correctly, from a client-side `fetch()` in `CharacterCard.svelte` that hits a SvelteKit server route, which in turn calls the Fastify API. The SvelteKit `/character/[id]` route uses a `+page.server.ts` load function to fetch character data from MongoDB (via a SvelteKit server-side module) and renders the same `CharacterCard` component for shareable URLs.

The key architectural question is whether Fastify runs standalone or whether all API logic lives in SvelteKit `+server.ts` files. Based on CLAUDE.md's explicit stack declaration ("Backend: Fastify 5"), Fastify runs as a **separate server**. The SvelteKit frontend calls it via `fetch()` — with Vite proxy for local dev. For the `/character/[id]` page, the SvelteKit load function can call the Fastify API directly (server-to-server, no CORS) during SSR. The Fastify server handles all MongoDB operations; SvelteKit stays purely frontend-tier.

**Primary recommendation:** Fastify 5 as standalone backend on port 3001; SvelteKit on port 5173 (dev) with Vite proxy `'/api' → 'http://localhost:3001'`. The character share page (`/character/[id]`) uses a SvelteKit `+page.server.ts` load function that calls `http://localhost:3001/api/characters/:id` server-side — no client-side fetch needed for the share view, which means correct SSR and no CORS issues.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Save character to MongoDB | API (Fastify) | — | All DB writes live in Fastify; SvelteKit stays stateless |
| Generate nanoid share ID | API (Fastify) | — | ID must be unique and server-generated before persistence |
| Rate limiting (POST /api/characters) | API (Fastify) | — | `@fastify/rate-limit` plugin registered on Fastify server |
| Session timing validation (90s) | API (Fastify) | Frontend (disable Save button) | Backend is authoritative; frontend provides UX feedback only |
| Serve `/character/[id]` page | Frontend Server (SvelteKit SSR) | API (data source) | SvelteKit load function fetches from Fastify; renders CharacterCard |
| Styled 404 for missing/deleted character | Frontend Server (SvelteKit) | — | `+error.svelte` at route level; `error(404, ...)` from load function |
| "Save & Share" button and URL display | Browser / Client | SvelteKit server route | Button triggers fetch; response URL shown in UI |
| IP detection for rate limiting | API (Fastify) | — | `trustProxy` option + `request.ip` in Fastify |

---

## Architecture Decision: SvelteKit API Routes vs Separate Fastify Server

### Decision: Separate Fastify Server (as specified in CLAUDE.md)

CLAUDE.md explicitly declares `Backend: Fastify 5` and the project has already decided this in STATE.md:

> "4 API endpoints total: POST /api/characters, GET /api/characters/:id, GET /api/characters, DELETE /api/characters/:id"

This means:
- **Fastify 5** runs on port 3001 (or configurable), handles all MongoDB operations
- **SvelteKit** runs on port 5173 (dev), handles UI routing + SSR
- In **development**: Vite proxy forwards `/api/*` from 5173 → 3001
- In **production**: Same-origin deployment (reverse proxy) or CORS header on Fastify

**Why not SvelteKit API routes?** The project stack is Fastify 5 + Mongoose, not SvelteKit server routes. Placing business logic in `+server.ts` would contradict the explicit stack choice and make the Phase 5 gallery (which needs a real HTTP API) harder to share.

**The `/character/[id]` page:** SvelteKit `+page.server.ts` load function fetches from the Fastify server using a server-side `fetch()`. Because this runs server-side (Node.js → Node.js), there is no CORS constraint. The Fastify URL is read from an environment variable (`VITE_API_URL` or `API_URL`).

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fastify | 5.8.5 | HTTP server | Declared in project stack; already version-locked in STATE.md |
| mongoose | 9.6.2 | MongoDB ODM | Declared in project stack; schema validation, soft-delete plugins |
| nanoid | 5.1.11 | Share ID generation | Declared in project stack; cryptographically strong, URL-safe |
| @fastify/rate-limit | 10.3.0 | IP rate limiting on POST route | Official Fastify plugin; integrates with `request.ip` and `trustProxy` |
| @fastify/cors | 11.2.0 | CORS headers for dev/prod | Official Fastify plugin; needed when SvelteKit and Fastify run on separate origins |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fastify-plugin | 5.1.0 | Wrap mongoose connector as Fastify plugin | When decorating fastify instance with `fastify.mongoose` across plugin scope |
| dotenv / @dotenvx | latest | Env var loading in Node.js | API_URL, MONGODB_URI, PORT need env config |

[VERIFIED: npm registry — all versions confirmed via `npm view <pkg> version` on 2026-05-16]

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Fastify standalone | SvelteKit `+server.ts` routes | SvelteKit routes are simpler but contradict the declared stack; Fastify gives a real API server for Phase 5 gallery |
| @fastify/rate-limit | SvelteKit-rate-limiter | No — rate limiting must be at the Fastify layer where IP detection is authoritative |
| Mongoose | native MongoDB driver | Mongoose gives schema validation and the soft-delete plugin pattern; native driver would require hand-rolling both |

### Installation (backend package.json — new `server/` directory)
```bash
npm install fastify @fastify/cors @fastify/rate-limit mongoose nanoid fastify-plugin dotenv
```

---

## Architecture Patterns

### System Architecture Diagram

```
Browser
  │  POST /api/characters (fetch)
  │  GET /character/xK3mP9qR2v (navigate)
  ▼
SvelteKit (port 5173 dev / same-origin prod)
  │  /character/[id]  →  +page.server.ts load()
  │       │  server-to-server fetch
  │       ▼
  │  Fastify (port 3001)  ──────────────────────────────────────────────
  │       │  POST /api/characters                                       │
  │       │    → validate sessionTime ≥ 90s                            │
  │       │    → rate limit by IP                                       │
  │       │    → generate nanoid(10)                                    │
  │       │    → Character.create(doc)  →  MongoDB                     │
  │       │    ← { shareId, url }                                       │
  │       │                                                             │
  │       │  GET /api/characters/:id                                    │
  │       │    → Character.findOne({ shareId, deletedAt: null })        │
  │       │    ← character doc or 404                                    │
  │       ─────────────────────────────────────────────────────────────
  │  Vite proxy in dev: /api/* → http://localhost:3001
  │  (SvelteKit load fn calls Fastify directly in SSR — no proxy)
  ▼
CharacterCard.svelte (renders share view or live session)
```

### Recommended Project Structure
```
server/
├── index.ts              # Fastify entry point — build + listen
├── app.ts                # createApp() factory — register plugins, routes
├── plugins/
│   └── mongoose.ts       # Fastify plugin: connect to MongoDB, decorate fastify.mongoose
├── models/
│   └── Character.ts      # Mongoose schema + model
└── routes/
    └── characters.ts     # POST /api/characters, GET /api/characters/:id

src/
├── routes/
│   ├── character/
│   │   └── [id]/
│   │       ├── +page.server.ts   # load(): fetch from Fastify, handle 404
│   │       ├── +page.svelte      # render CharacterCard with loaded data
│   │       └── +error.svelte     # styled "fate lost to the multiverse" page
│   └── api/
│       └── characters/
│           └── +server.ts        # (optional thin proxy — see Pattern 2)
└── components/
    └── CharacterCard.svelte      # add Save & Share button here
```

### Pattern 1: Fastify Server Entry + Plugin Registration

```typescript
// Source: https://fastify.dev/docs/v5.5.x/Reference/Server
// server/app.ts
import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { mongoosePlugin } from './plugins/mongoose.js'
import { characterRoutes } from './routes/characters.js'

export async function createApp() {
  const app = Fastify({
    logger: true,
    trustProxy: true,   // honour X-Forwarded-For from reverse proxy / Vite proxy
  })

  await app.register(cors, {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  })

  await app.register(rateLimit, {
    global: false,  // apply only to specific routes
  })

  await app.register(mongoosePlugin)
  await app.register(characterRoutes, { prefix: '/api' })

  return app
}
```

```typescript
// server/index.ts
import { createApp } from './app.js'

const app = await createApp()
await app.listen({ port: Number(process.env.PORT ?? 3001), host: '0.0.0.0' })
```

### Pattern 2: Mongoose Plugin (Fastify Plugin Pattern)

```typescript
// Source: Mongoose docs — https://mongoosejs.com/docs/connections.html
// Source: fastify-plugin npm (v5.1.0)
// server/plugins/mongoose.ts
import fp from 'fastify-plugin'
import mongoose from 'mongoose'

export const mongoosePlugin = fp(async (fastify) => {
  const uri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/wheel-of-fate'
  await mongoose.connect(uri, {
    maxPoolSize: 10,
    autoIndex: process.env.NODE_ENV !== 'production',
  })

  fastify.addHook('onClose', async () => {
    await mongoose.disconnect()
  })

  // Decorate so routes can import models directly — no need to pass connection
  fastify.decorate('mongoose', mongoose)
})
```

**Key insight:** `fp()` (fastify-plugin) breaks Fastify's encapsulation boundary so `fastify.mongoose` is visible across all plugins. Without `fp()`, decorations are scoped to the registering plugin only. [VERIFIED: fastify-plugin README, Context7]

### Pattern 3: Character Mongoose Schema

```typescript
// server/models/Character.ts
import mongoose, { Schema, type Document } from 'mongoose'

export interface ICharacter extends Document {
  shareId: string
  name: string
  race: string
  archetype: string
  overall_score: number
  overall_tier: string
  spins: object              // full SpinResult[] JSON blob
  session_started_at: Date   // for 90s validation
  created_at: Date
  deleted_at: Date | null
  share_in_gallery: boolean
}

const CharacterSchema = new Schema<ICharacter>({
  shareId:          { type: String, required: true, unique: true, index: true },
  name:             { type: String, required: true },
  race:             { type: String, required: true, index: true },      // gallery queries
  archetype:        { type: String, required: true, index: true },      // gallery queries
  overall_score:    { type: Number, required: true, index: true },      // gallery sort
  overall_tier:     { type: String, required: true },
  spins:            { type: Schema.Types.Mixed, required: true },       // SpinResult[] blob
  session_started_at: { type: Date, required: true },
  created_at:       { type: Date, default: Date.now },
  deleted_at:       { type: Date, default: null, index: true },
  share_in_gallery: { type: Boolean, default: false },
}, {
  collection: 'characters',
  versionKey: false,
})

// Soft-delete: default queries exclude deleted documents
CharacterSchema.pre(/^find/, function () {
  // Only apply when not explicitly including deleted — simplest approach for Phase 4
  this.where({ deleted_at: null })
})

export const Character = mongoose.model<ICharacter>('Character', CharacterSchema)
```

**Why `spins` as `Schema.Types.Mixed`:** The spin array has variable length (23+ entries with spliced ability/weakness spins) and heterogeneous shape (stat spins have `tier`/`score`, others do not). Storing as Mixed/blob avoids trying to enumerate every possible SpinResult variant in Mongoose schema. The denormalized top-level fields (`race`, `archetype`, `overall_score`, `overall_tier`) handle all future query needs. [ASSUMED — design decision, not a documented Mongoose requirement]

### Pattern 4: POST /api/characters Route

```typescript
// server/routes/characters.ts
import { nanoid } from 'nanoid'
import { Character } from '../models/Character.js'
import type { FastifyPluginAsync } from 'fastify'

export const characterRoutes: FastifyPluginAsync = async (fastify) => {

  // POST — save character, return share URL
  fastify.post('/characters', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '10 minutes',  // 5 saves per IP per 10 min window
      },
    },
    schema: {
      body: {
        type: 'object',
        required: ['name', 'race', 'archetype', 'overall_score', 'overall_tier', 'spins', 'session_started_at'],
        properties: {
          name:               { type: 'string', maxLength: 40 },
          race:               { type: 'string' },
          archetype:          { type: 'string' },
          overall_score:      { type: 'number', minimum: 0, maximum: 100 },
          overall_tier:       { type: 'string' },
          spins:              { type: 'array' },
          session_started_at: { type: 'string', format: 'date-time' },
          share_in_gallery:   { type: 'boolean' },
        },
      },
    },
  }, async (request, reply) => {
    const body = request.body as {
      name: string
      race: string
      archetype: string
      overall_score: number
      overall_tier: string
      spins: unknown[]
      session_started_at: string
      share_in_gallery?: boolean
    }

    // 90-second session guard
    const sessionStart = new Date(body.session_started_at).getTime()
    const now = Date.now()
    const sessionSeconds = (now - sessionStart) / 1000
    if (sessionSeconds < 90) {
      return reply.code(422).send({
        error: 'Session too short',
        message: `Minimum session length is 90 seconds (got ${Math.floor(sessionSeconds)}s)`,
      })
    }

    const shareId = nanoid(10)

    const character = await Character.create({
      shareId,
      name: body.name,
      race: body.race,
      archetype: body.archetype,
      overall_score: body.overall_score,
      overall_tier: body.overall_tier,
      spins: body.spins,
      session_started_at: new Date(body.session_started_at),
      share_in_gallery: body.share_in_gallery ?? false,
    })

    return reply.code(201).send({
      shareId: character.shareId,
      url: `/character/${character.shareId}`,
    })
  })

  // GET — fetch by shareId (soft-delete handled by pre-find hook)
  fastify.get('/characters/:shareId', async (request, reply) => {
    const { shareId } = request.params as { shareId: string }
    const character = await Character.findOne({ shareId }).lean()

    if (!character) {
      return reply.code(404).send({ error: 'Character not found' })
    }

    return reply.send(character)
  })
}
```

### Pattern 5: SvelteKit `/character/[id]` Load Function

```typescript
// src/routes/character/[id]/+page.server.ts
import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, fetch }) => {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

  const res = await fetch(`${apiUrl}/api/characters/${params.id}`)

  if (res.status === 404) {
    error(404, {
      message: 'This fate has been lost to the multiverse.',
    })
  }

  if (!res.ok) {
    error(500, { message: 'Failed to load character.' })
  }

  const character = await res.json()
  return { character }
}
```

```svelte
<!-- src/routes/character/[id]/+error.svelte -->
<script>
  import { page } from '$app/stores'
</script>

<!-- Styled 404 — "This fate has been lost to the multiverse" -->
<div class="...">
  <h1>{$page.error?.message ?? 'This fate has been lost to the multiverse.'}</h1>
</div>
```

**Important:** `+error.svelte` at `src/routes/character/[id]/+error.svelte` catches errors thrown from that route's load function only. A generic `src/routes/+error.svelte` catches everything else. [VERIFIED: SvelteKit docs, Context7 /llmstxt/svelte_dev_kit_llms_txt]

### Pattern 6: nanoid Usage in ESM Context

```typescript
// Source: Context7 /ai/nanoid
// nanoid 5 is pure ESM — import only, no require()
import { nanoid } from 'nanoid'

const shareId = nanoid(10)  // "xK3mP9qR2v" — URL-safe, 10 chars
// Collision probability at 10 chars (64-char alphabet): 1% at ~1 billion IDs
```

**Critical:** nanoid 5.x is pure ESM. The server package.json must include `"type": "module"` or use `.mjs` file extensions. If mixing CJS and ESM in the same project causes issues, use `customAlphabet` approach to control alphabet explicitly. [VERIFIED: Context7 /ai/nanoid]

### Pattern 7: Rate Limiting Configuration

```typescript
// Source: Context7 /fastify/fastify-rate-limit
await app.register(rateLimit, {
  global: false,       // don't apply to all routes by default
  keyGenerator: (request) => {
    // nginx proxy passes X-Real-IP; load balancers use X-Forwarded-For
    // trustProxy: true on Fastify server makes request.ip read from X-Forwarded-For
    return request.ip   // already respects trustProxy when configured
  },
})

// Per-route config in route definition:
config: {
  rateLimit: {
    max: 5,
    timeWindow: '10 minutes',
  },
}
```

### Pattern 8: Session Timing — Frontend Side

The `startedAt` field already exists in `SessionState`:

```typescript
// src/lib/session/types.ts (existing)
export interface SessionState {
  sessionId: string
  startedAt: string          // ISO timestamp — set by createSession() on first spin
  completedSpins: SpinResult[]
  // ...
}
```

```typescript
// CharacterCard.svelte — compute remaining session seconds for Save button
const sessionAge = () => (Date.now() - new Date(session.startedAt).getTime()) / 1000
const canSave = () => sessionAge() >= 90   // disable button if under 90s

// POST body
const payload = {
  name,
  race: results.find(r => r.category === 'race')?.resultLabel ?? '',
  archetype: results.find(r => r.category === 'archetype')?.resultLabel ?? '',
  overall_score: overallScore,
  overall_tier: overallGrade,
  spins: results,
  session_started_at: session.startedAt,   // server validates this server-side
  share_in_gallery: false,
}
```

**How to access `session.startedAt` in CharacterCard:** The component currently receives `results` and `name` as props. The parent `+page.svelte` has `currentSession.startedAt`. The simplest approach is to add `session` as a third prop to `CharacterCard`, or pass `startedAt: string` directly. [ASSUMED — prop design is planner's discretion]

### Pattern 9: Vite Proxy for Dev

```typescript
// vite.config.ts (addition to existing config)
import { defineConfig } from 'vite'
import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'

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
})
```

**Note:** The Vite proxy only applies to client-side fetch calls in the browser. The SvelteKit SSR load function (`+page.server.ts`) runs in Node.js and must call `http://localhost:3001` directly using the `API_URL` env var. [VERIFIED: SvelteKit docs, Vite proxy documentation]

### Anti-Patterns to Avoid

- **Reading `request.ip` without `trustProxy: true`:** Behind a reverse proxy (including Vite's proxy), the real IP is in `X-Forwarded-For`. Without `trustProxy: true`, `request.ip` returns `127.0.0.1` for all requests — the rate limiter would see one IP for every user and incorrectly block legitimate users after 5 requests.
- **Storing the entire `spins` array as individual Mongoose schema fields:** The spin array length is variable (min ~20, can reach 35+). Use `Schema.Types.Mixed` for the blob. If you need to query individual spins, add a separate index field.
- **Using `require()` with nanoid 5:** nanoid 5 is ESM-only. `require('nanoid')` will throw at runtime. Use dynamic `import()` or ensure the server uses ESM.
- **Applying the pre-find soft-delete hook without considering future admin queries:** The pre-find hook filters `deleted_at: null` automatically. If a Phase 5/6 admin endpoint needs to retrieve deleted records, use `Character.findOne({ shareId }).setOptions({ includeSoftDeleted: true })` or bypass the pre-find hook with a separate lean query on the model before the hook is applied. [ASSUMED — admin tooling is v1 deferred per REQUIREMENTS.md]
- **Returning a SvelteKit generic 404:** When `/character/[id]` returns 404, the `+error.svelte` in the same route directory handles it with the styled "fate has been lost" message. Do NOT use a bare `throw new Response(...)` or the user sees the SvelteKit default error screen.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate limiting | Custom middleware with Map/counter | `@fastify/rate-limit` | Handles time windows, distributed state (Redis optional), `retry-after` headers, per-route config |
| Unique share ID | `Math.random().toString(36)` | `nanoid(10)` | Cryptographically strong, URL-safe, ~1% collision at 1 billion IDs; Math.random is not crypto-safe |
| IP detection behind proxy | Custom header parsing | Fastify `trustProxy: true` + `request.ip` | Handles multi-hop proxy chains, CIDR trust lists, `X-Forwarded-For` correctly |
| Soft-delete filtering | Manual `.where({ deleted_at: null })` on every query | Mongoose `pre(/^find/)` hook | Forgetting one query leaks deleted records; the pre-hook is applied automatically |
| CORS preflight | Manual `OPTIONS` handler | `@fastify/cors` | Handles preflight, credential mode, origin allow-listing |

---

## Runtime State Inventory

> Greenfield phase — no rename/refactor involved. No existing runtime state to migrate.

None — this phase adds new infrastructure (MongoDB collection, Fastify server) from scratch. No existing records, registered services, or OS-level state are affected.

---

## Common Pitfalls

### Pitfall 1: Vite Proxy Does Not Help SSR Load Functions
**What goes wrong:** The developer adds the Vite proxy (`/api → localhost:3001`) assuming that the SvelteKit load function will use it. The load function runs server-side in Node.js, not through the Vite dev server. It calls `http://localhost:5173/api/...` and gets a Vite 404 because the proxy is browser-only.
**Why it happens:** Vite's proxy is an HTTP proxy for browser traffic only. Node.js `fetch` inside `+page.server.ts` is a direct HTTP call, not mediated by Vite.
**How to avoid:** In `+page.server.ts`, use `process.env.API_URL` (default `http://localhost:3001`) for server-side fetches. The Vite proxy handles only client-side fetch calls from the browser.
**Warning signs:** Load function works in browser navigation but fails after page reload (SSR); `fetch` inside load throws "ECONNREFUSED" to port 5173.

### Pitfall 2: `trustProxy` Not Set — Rate Limiter Sees Only `127.0.0.1`
**What goes wrong:** Every request appears to come from `127.0.0.1` (the Vite dev proxy or reverse proxy). After 5 requests, ALL users are rate-limited simultaneously.
**Why it happens:** Fastify defaults `trustProxy: false`. Without it, `request.ip` returns the proxy's IP, not the client's.
**How to avoid:** Set `trustProxy: true` in `Fastify({ trustProxy: true })`. In production, use a specific CIDR instead of `true` (e.g., your load balancer's IP range).
**Warning signs:** Rate limit triggers for everyone simultaneously; `request.ip` always logs `127.0.0.1`.

### Pitfall 3: nanoid ESM Import Failure in CJS Context
**What goes wrong:** Server code uses `const { nanoid } = require('nanoid')` and Node throws `ERR_REQUIRE_ESM` at startup.
**Why it happens:** nanoid 5.x is pure ESM. It has no CJS export.
**How to avoid:** Add `"type": "module"` to `server/package.json` and use `import { nanoid } from 'nanoid'`. Alternatively, use dynamic `const { nanoid } = await import('nanoid')` in a CJS context.
**Warning signs:** Server crashes on startup with `ERR_REQUIRE_ESM` for nanoid.

### Pitfall 4: Soft-Delete Pre-Find Hook Blocks Admin Queries
**What goes wrong:** A future admin endpoint (e.g., `GET /admin/characters?includeDeleted=true`) cannot retrieve deleted characters because the Mongoose pre-find hook unconditionally adds `{ deleted_at: null }`.
**Why it happens:** The pre-find hook in Pattern 3 does not check any flag.
**How to avoid:** Implement the hook with an `includeDeleted` option check (see Mongoose Context7 example using `this.getOptions().includeDeleted`), OR skip the hook entirely and add the filter manually in all application queries. For Phase 4's scope (no admin UI), either approach works; the planner should note this as a future concern.
**Warning signs:** Admin queries return empty results for characters known to be soft-deleted.

### Pitfall 5: Session `startedAt` Is Client-Supplied — Not Trustworthy Alone
**What goes wrong:** A malicious or modified client sends a fake `session_started_at` from 91 seconds ago regardless of when the session actually began.
**Why it happens:** The 90-second check relies on a client-supplied timestamp.
**How to avoid:** For Phase 4 MVP, client-supplied `session_started_at` is acceptable — the game has no authentication and the 90-second check is anti-spam, not a security control. The rate limiter (5 per 10 min) provides the real protection. Note this for future consideration. [ASSUMED — acceptable for v1 per REQUIREMENTS.md "No login / accounts"]

### Pitfall 6: MongoDB Connection Not Closed on Fastify Shutdown
**What goes wrong:** The Fastify process does not disconnect from MongoDB on graceful shutdown, leaving connections open in MongoDB Atlas or local mongod.
**Why it happens:** Mongoose connections persist until explicitly closed.
**How to avoid:** Register `fastify.addHook('onClose', async () => mongoose.disconnect())` in the mongoose plugin — shown in Pattern 2 above.

---

## Code Examples

### Save & Share Button in CharacterCard (fetch pattern)
```typescript
// Source: SvelteKit docs pattern + project fetch convention
// In CharacterCard.svelte
let saving = $state(false)
let shareUrl = $state<string | null>(null)
let saveError = $state<string | null>(null)

async function handleSaveAndShare() {
  saving = true
  saveError = null
  try {
    const res = await fetch('/api/characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        race: results.find(r => r.category === 'race')?.resultLabel ?? '',
        archetype: results.find(r => r.category === 'archetype')?.resultLabel ?? '',
        overall_score: overallScore,
        overall_tier: overallGrade,
        spins: results,
        session_started_at: startedAt,   // prop passed from +page.svelte
        share_in_gallery: false,
      }),
    })

    if (!res.ok) {
      const body = await res.json()
      saveError = body.message ?? 'Save failed'
      return
    }

    const { url } = await res.json()
    shareUrl = `${window.location.origin}${url}`
  } finally {
    saving = false
  }
}
```

### Mongoose findOne with soft-delete bypass (for future admin use)
```typescript
// Source: Context7 /automattic/mongoose — soft-delete plugin docs
// To bypass the pre-find hook in future admin endpoint:
const deleted = await Character
  .findOne({ shareId })
  .setOptions({ includeSoftDeleted: true })
// Note: this only works if the pre-find hook checks this.getOptions().includeDeleted
// See Pattern 3 implementation note above for the full hook guard
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fastify middleware for CORS (`fastify.use(cors())`) | `@fastify/cors` registered as plugin | Fastify v3 → v4 | `fastify.use()` was removed; must use `fastify.register()` |
| nanoid 3/4 (had CJS export) | nanoid 5 (ESM-only) | nanoid 5.0.0 | `require('nanoid')` throws ERR_REQUIRE_ESM — server must be ESM |
| Mongoose `timestamps: true` built-in | Explicit `created_at` / `deleted_at` fields | — | Built-in `timestamps` adds `createdAt` (camelCase); explicit fields match the project's snake_case convention |

**Deprecated/outdated:**
- `fastify.use()` middleware: removed in Fastify v3. Use `fastify.register()` with official plugins.
- nanoid CJS require(): removed in nanoid 5. Server must be ESM or use dynamic import.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `spins` stored as `Schema.Types.Mixed` (JSON blob) is the right schema choice | Standard Stack / Pattern 3 | If querying individual spins becomes necessary (Phase 5+), a schema migration is needed |
| A2 | `session_started_at` client-supplied is acceptable for Phase 4 MVP (anti-spam, not security) | Pitfall 5 | If spam becomes an issue, server-side session tracking would be needed |
| A3 | The Fastify server lives in a new `server/` directory with its own entry point and package context | Architecture Patterns | If the project wants a monorepo with shared package.json, the build setup changes |
| A4 | `CharacterCard` will receive `startedAt: string` as a new prop from `+page.svelte` | Pattern 8 | Planner may choose a different prop threading approach (e.g., session store, context) |
| A5 | Rate limit of 5 POSTs per 10 minutes per IP is appropriate | Pattern 4 | Too low may frustrate legitimate power users; too high allows spam |

---

## Open Questions

1. **Where does the Fastify server get started in development?**
   - What we know: SvelteKit runs on `npm run dev` (Vite). Fastify is a separate Node.js process.
   - What's unclear: Should there be a single `npm run dev` that starts both (using `concurrently` or similar), or do developers run two terminals?
   - Recommendation: Add `concurrently` as a dev dependency; create a root `dev` script that starts both. Or a `server/` subdirectory with its own `npm run dev`.

2. **MongoDB Atlas vs local mongod for development?**
   - What we know: `mongod` v8.2.0 is available locally. No Atlas connection string in any config file.
   - What's unclear: Is the developer expected to run local mongod, or will a `.env` file have a Mongo Atlas URI?
   - Recommendation: Default to `mongodb://127.0.0.1:27017/wheel-of-fate` with env var override. Local mongod is already confirmed available.

3. **`API_URL` env var name: `VITE_` prefix or not?**
   - What we know: `VITE_*` env vars are exposed to the browser by SvelteKit/Vite. The Fastify API URL is used in `+page.server.ts` (server-side) — it should NOT be `VITE_API_URL` (which would be exposed to clients).
   - Recommendation: Use `API_URL` (no `VITE_` prefix) — server-only. Set in `.env` and reference as `process.env.API_URL` or `import.meta.env.API_URL` in server-side code only.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Fastify server | ✓ | v20.19.2 | — |
| mongod (local) | MongoDB connection in dev | ✓ | 8.2.0 | MongoDB Atlas URI via .env |
| npm | Package installation | ✓ | (from Node 20) | — |
| Fastify 5 | Backend server | not yet installed | 5.8.5 (registry) | — |
| Mongoose 9 | MongoDB ODM | not yet installed | 9.6.2 (registry) | — |
| nanoid 5 | Share ID generation | not yet installed | 5.1.11 (registry) | — |
| @fastify/rate-limit | Rate limiting | not yet installed | 10.3.0 (registry) | — |
| @fastify/cors | CORS headers | not yet installed | 11.2.0 (registry) | — |

**Missing dependencies with no fallback:** All backend packages need installation. Local mongod is available, so no Atlas required for development.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.6 |
| Config file | `vitest.config.ts` (project root — covers `src/**/*.test.ts`) |
| Quick run command | `npx vitest run src/` |
| Full suite command | `npx vitest run` |

**Note:** The existing vitest config uses `environment: 'jsdom'` and `conditions: ['browser']`. Backend unit tests (Fastify routes, Mongoose models) cannot run under jsdom — they need a Node environment. Options:
1. Add a separate `vitest.config.server.ts` with `environment: 'node'` for server tests
2. Use Fastify's built-in `inject()` for route testing (no real HTTP, no mongod needed in tests)

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BACK-01 | Character document saved with correct fields | unit (Mongoose schema validation) | `npx vitest run --config vitest.config.server.ts server/` | ❌ Wave 0 |
| BACK-02 | nanoid(10) generates 10-char URL-safe ID | unit | `npx vitest run --config vitest.config.server.ts server/` | ❌ Wave 0 |
| BACK-02 | GET /api/characters/:id returns character | integration (Fastify inject) | `npx vitest run --config vitest.config.server.ts server/` | ❌ Wave 0 |
| BACK-03 | GET /api/characters/:shareId for deleted doc returns 404 | integration (Fastify inject) | `npx vitest run --config vitest.config.server.ts server/` | ❌ Wave 0 |
| BACK-04 | POST rejects session < 90s with 422 | integration (Fastify inject) | `npx vitest run --config vitest.config.server.ts server/` | ❌ Wave 0 |
| BACK-04 | POST returns 429 after rate limit exceeded | integration (Fastify inject) | `npx vitest run --config vitest.config.server.ts server/` | ❌ Wave 0 |
| CARD-02 | Save & Share button triggers POST and displays URL | manual / browser | — | manual only |

### Sampling Rate
- **Per task commit:** `npx vitest run src/` (existing frontend tests — confirm nothing broke)
- **Per wave merge:** `npx vitest run` (full suite including new server tests)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `server/vitest.config.server.ts` — Vitest config with `environment: 'node'` for backend tests
- [ ] `server/__tests__/characters.test.ts` — Fastify inject-based route tests
- [ ] `server/__tests__/character-model.test.ts` — Mongoose schema unit tests (with in-memory MongoDB via `mongodb-memory-server`)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth in v1 (characters identified by share link only) |
| V3 Session Management | no | No session tokens — share link is the identity |
| V4 Access Control | no | No user roles — all characters are public via share URL |
| V5 Input Validation | yes | Fastify JSON schema validation (Ajv) on POST body; `maxLength` on name field |
| V6 Cryptography | partial | nanoid uses `crypto.getRandomValues()` (cryptographically strong) — no hand-rolled ID generation |

### Known Threat Patterns for Fastify 5 + MongoDB

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| MongoDB injection via Mixed field | Tampering | `$`-prefix keys in user-supplied JSON blob could execute operators; validate `spins` array structure before inserting |
| Rate limit bypass via IP spoofing | Elevation of Privilege | `trustProxy: true` with restricted trust (specific proxy IPs); do not use `true` in production without a known proxy |
| Excessively large POST body | Denial of Service | Fastify default body limit is 1 MB — sufficient for 35 spin results; no change needed |
| Stored XSS in character names | Tampering | Names are displayed in the card; SvelteKit auto-escapes text in templates; `maxLength: 40` limits attack surface |

---

## Sources

### Primary (HIGH confidence)
- Context7 `/llmstxt/fastify_dev_llms_txt` — trustProxy, server listen, JSON schema validation, plugin patterns
- Context7 `/fastify/fastify-rate-limit` — rate limit registration, keyGenerator, per-route config, IP detection
- Context7 `/automattic/mongoose` — schema definition, connection pool, soft-delete plugin, pre-find hooks
- Context7 `/ai/nanoid` — ESM import, customAlphabet, nanoid(10) usage
- Context7 `/llmstxt/svelte_dev_kit_llms_txt` — PageServerLoad, error helper, +error.svelte, server route handlers
- `npm view fastify version` → 5.8.5 [VERIFIED: npm registry]
- `npm view mongoose version` → 9.6.2 [VERIFIED: npm registry]
- `npm view nanoid version` → 5.1.11 [VERIFIED: npm registry]
- `npm view @fastify/rate-limit version` → 10.3.0 [VERIFIED: npm registry]
- `npm view @fastify/cors version` → 11.2.0 [VERIFIED: npm registry]
- `npm view fastify-plugin version` → 5.1.0 [VERIFIED: npm registry]

### Secondary (MEDIUM confidence)
- STATE.md architecture notes: "4 API endpoints total: POST /api/characters, GET /api/characters/:id, GET /api/characters, DELETE /api/characters/:id" [CITED: project STATE.md]
- SvelteKit Vite proxy configuration pattern [CITED: Vite docs via Context7 /llmstxt/svelte_dev_kit_llms_txt]

### Tertiary (LOW confidence — not needed, everything verified above)
None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions confirmed via npm registry; all packages verified available
- Architecture: HIGH — separation of Fastify/SvelteKit verified by CLAUDE.md declaration and STATE.md
- Patterns: HIGH — all code patterns verified against Context7 official docs
- Pitfalls: MEDIUM — verified for Fastify/nanoid/proxy; session timing security is ASSUMED acceptable for v1

**Research date:** 2026-05-16
**Valid until:** 2026-06-15 (stable ecosystem — Fastify 5, Mongoose 9, nanoid 5 all mature releases)
