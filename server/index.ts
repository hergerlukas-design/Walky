/**
 * Prozess-Start: Konfiguration aus der Umgebung lesen, Server hochfahren,
 * auf Signale von Fly.io reagieren. Die eigentliche Logik steckt in `app.ts`.
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWalkyServer } from './app.js'

const PORT = Number(process.env.PORT ?? 8080)
const HOST = process.env.HOST ?? '0.0.0.0'

const here = dirname(fileURLToPath(import.meta.url))
// Kompiliert liegt diese Datei unter dist-server/server/, der Vite-Build
// daneben unter dist/.
const clientDir = process.env.CLIENT_DIR
  ? resolve(process.env.CLIENT_DIR)
  : resolve(here, '../../dist')

const server = createWalkyServer({
  clientDir,
  // Laufzeit-Geheimnisse (auf Fly: `fly secrets set …`), nicht ins Bundle
  // gebacken — änderbar ohne Neubau.
  iceEnv: {
    CLOUDFLARE_TURN_KEY_ID: process.env.CLOUDFLARE_TURN_KEY_ID,
    CLOUDFLARE_TURN_API_TOKEN: process.env.CLOUDFLARE_TURN_API_TOKEN,
    TURN_URLS: process.env.TURN_URLS,
    TURN_USERNAME: process.env.TURN_USERNAME,
    TURN_CREDENTIAL: process.env.TURN_CREDENTIAL,
    STUN_URLS: process.env.STUN_URLS,
  },
})

const port = await server.listen(PORT, HOST)
console.log(
  `[walky] Server auf http://${HOST}:${port} — Client-Build: ${server.hasClientBuild ? 'ja' : 'nein'}`,
)

let shuttingDown = false

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[walky] ${signal} empfangen, fahre herunter`)

  // Notausgang, falls ein Socket nicht sauber schließt.
  const forced = setTimeout(() => process.exit(0), 5000)
  forced.unref()

  await server.close()
  process.exit(0)
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
