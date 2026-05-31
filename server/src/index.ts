// Load `.env` (located at server/.env) BEFORE importing app.ts so that any
// module-level `process.env.*` reads in the app see the file's values.
// Without this, env vars only resolve when set in the shell or by the
// hosting platform — which masked the portrait config in dev.
import 'dotenv/config'

import { createApp } from './app.js'

try {
  const app = await createApp()
  await app.listen({ port: Number(process.env.PORT ?? 3001), host: '0.0.0.0' })
} catch (err) {
  console.error(err)
  process.exit(1)
}
