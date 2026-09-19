/**
 * Laufzeit-Konfiguration aus Vite-Env-Variablen. Bewusst so gewählt, dass die
 * App ohne jede Konfiguration läuft, solange Signaling-Server und PWA
 * denselben Origin teilen — das ist im Fly-Deployment der Fall.
 */

const str = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : ''

const list = (value: unknown): string[] =>
  str(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

const CONFIGURED_SIGNALING_URL = str(import.meta.env.VITE_SIGNALING_URL)

/**
 * Basis-URL des Signaling-Servers ohne Pfad, z. B. `wss://walky.fly.dev`.
 * Ohne explizite Konfiguration wird der eigene Origin verwendet — über HTTPS
 * automatisch `wss:`.
 */
export function getSignalingBaseUrl(): string {
  if (CONFIGURED_SIGNALING_URL) {
    return CONFIGURED_SIGNALING_URL.replace(/\/+$/, '')
  }

  const { protocol, host } = window.location
  return `${protocol === 'https:' ? 'wss:' : 'ws:'}//${host}`
}

const DEFAULT_STUN = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
]

const TURN_URLS = list(import.meta.env.VITE_TURN_URLS)
const TURN_USERNAME = str(import.meta.env.VITE_TURN_USERNAME)
const TURN_CREDENTIAL = str(import.meta.env.VITE_TURN_CREDENTIAL)

export const hasTurnServer = TURN_URLS.length > 0

/**
 * STUN reicht für die meisten Heim- und WLAN-Netze. Hinter symmetrischem NAT
 * (häufig im Mobilfunk und in Firmennetzen) kommt eine direkte Verbindung nur
 * über ein TURN-Relay zustande.
 */
export function getIceServers(): RTCIceServer[] {
  const stunUrls = list(import.meta.env.VITE_STUN_URLS)
  const servers: RTCIceServer[] = [
    { urls: stunUrls.length > 0 ? stunUrls : DEFAULT_STUN },
  ]

  if (TURN_URLS.length > 0) {
    servers.push({
      urls: TURN_URLS,
      username: TURN_USERNAME,
      credential: TURN_CREDENTIAL,
    })
  }

  return servers
}
