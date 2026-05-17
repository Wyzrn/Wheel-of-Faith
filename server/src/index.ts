import { createApp } from './app.js'

try {
  const app = await createApp()
  await app.listen({ port: Number(process.env.PORT ?? 3001), host: '0.0.0.0' })
} catch (err) {
  console.error(err)
  process.exit(1)
}
