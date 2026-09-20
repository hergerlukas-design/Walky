import { ICE_PATH, type IceConfig, type IceServerConfig } from '../../shared/protocol'

/**
 * Laufzeit-Konfiguration. Bewusst so gewählt, dass die App ohne jede
 * Einstellung läuft, solange Signaling-Server und PWA denselben Origin
 * teilen — das ist im Fly-Deployment der Fall.
 */

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const CONFIGURED_SIGNALING_URL = str(import.meta.env.VITE_SIGNALING_URL)

/**
 * Basis-URL des Signaling-Servers ohne Pfad, z. B. `wss://walky.fly.dev`.
 * Ohne explizite Angabe wird der eigene Origin verwendet — über HTTPS
 * automatisch `wss:`.
 */
export function getSignalingBaseUrl(): string {
  if (CONFIGURED_SIGNALING_URL) return CONFIGURED_SIGNALING_URL.replace(/\/+$/, '')

  const { protocol, host } = window.location
  return `${protocol === 'https:' ? 'wss:' : 'ws:'}//${host}`
}

/** Notnagel, falls der Server nicht antwortet: STUN reicht im selben Netz. */
const FALLBACK_ICE: IceConfig = {
  iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }],
  hasTurn: false,
}

function iceEndpoint(): string {
  if (!CONFIGURED_SIGNALING_URL) return ICE_PATH
  return `${CONFIGURED_SIGNALING_URL.replace(/^ws/, 'http').replace(/\/+$/, '')}${ICE_PATH}`
}

function isIceConfig(value: unknown): value is IceConfig {
  const candidate = value as IceConfig | null
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    Array.isArray(candidate.iceServers) &&
    candidate.iceServers.every((server: IceServerConfig) => Array.isArray(server?.urls))
  )
}

/**
 * Holt die ICE-Server beim Server statt sie in das Bundle zu backen. So
 * bleiben TURN-Zugangsdaten Server-Geheimnisse, lassen sich ohne Neubau
 * wechseln und dürfen kurzlebig sein.
 */
export async function fetchIceConfig(): Promise<IceConfig> {
  try {
    const response = await fetch(iceEndpoint(), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) throw new Error(`Server antwortete mit ${response.status}`)

    const payload: unknown = await response.json()
    if (!isIceConfig(payload)) throw new Error('Unerwartete Antwortform')

    return payload
  } catch (error) {
    console.warn('[walky] ICE-Konfiguration nicht abrufbar, nur STUN:', error)
    return FALLBACK_ICE
  }
}
