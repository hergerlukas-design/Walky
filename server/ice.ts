import type { IceConfig, IceFailureReason, IceServerConfig } from '../shared/protocol.js'

const DEFAULT_STUN = ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302']

const CLOUDFLARE_ENDPOINT = 'https://rtc.live.cloudflare.com/v1/turn/keys'

/** Kurz genug, dass abgegriffene Zugangsdaten wenig wert sind. */
const CREDENTIAL_TTL_SECONDS = 2 * 60 * 60

/** Vor Ablauf erneuern, damit nie eine tote Angabe ausgeliefert wird. */
const REFRESH_MARGIN_MS = 15 * 60 * 1000

export interface IceProviderEnv {
  /** Im Cloudflare-Dashboard "TURN Token ID"; beide Namen werden akzeptiert. */
  CLOUDFLARE_TURN_KEY_ID?: string
  CLOUDFLARE_TURN_TOKEN_ID?: string
  CLOUDFLARE_TURN_API_TOKEN?: string
  TURN_URLS?: string
  TURN_USERNAME?: string
  TURN_CREDENTIAL?: string
  STUN_URLS?: string
}

type Fetcher = typeof fetch

const list = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

/**
 * Cloudflare liefert die Angaben unter `iceServers` — je nach Fassung als
 * einzelnes Objekt oder als Liste. Beides wird akzeptiert, damit ein
 * Formatwechsel nicht stillschweigend den Ton abstellt.
 */
export function parseCloudflareResponse(payload: unknown): IceServerConfig[] {
  const raw = (payload as { iceServers?: unknown } | null)?.iceServers
  if (!raw) return []

  const entries = Array.isArray(raw) ? raw : [raw]

  return entries.flatMap((entry) => {
    const record = entry as { urls?: unknown; username?: unknown; credential?: unknown }
    const urls = Array.isArray(record.urls)
      ? record.urls.filter((url): url is string => typeof url === 'string')
      : typeof record.urls === 'string'
        ? [record.urls]
        : []

    if (urls.length === 0) return []

    const server: IceServerConfig = { urls }
    if (typeof record.username === 'string') server.username = record.username
    if (typeof record.credential === 'string') server.credential = record.credential
    return [server]
  })
}

class CloudflareError extends Error {
  constructor(
    readonly reason: IceFailureReason,
    status: number,
  ) {
    super(`Cloudflare antwortete mit ${status}`)
    this.name = 'CloudflareError'
  }
}

const hasRelay = (servers: IceServerConfig[]): boolean =>
  servers.some((server) => server.urls.some((url) => url.startsWith('turn:') || url.startsWith('turns:')))

/**
 * Liefert die ICE-Server für die Clients. Drei Quellen, in dieser Reihenfolge:
 * kurzlebige Cloudflare-Zugangsdaten, fest hinterlegte Daten eines anderen
 * Anbieters, sonst nur STUN. Fällt der Anbieter aus, wird ausgeliefert, was
 * da ist — ohne Relay klappt immerhin dasselbe Netz.
 */
export class IceProvider {
  private cached: { config: IceConfig; expiresAt: number } | null = null
  private inFlight: Promise<IceConfig> | null = null

  constructor(
    private readonly env: IceProviderEnv,
    private readonly fetcher: Fetcher = fetch,
  ) {}

  private get stunServers(): IceServerConfig[] {
    const urls = list(this.env.STUN_URLS)
    return [{ urls: urls.length > 0 ? urls : DEFAULT_STUN }]
  }

  private staticConfig(): IceConfig | null {
    const urls = list(this.env.TURN_URLS)
    if (urls.length === 0) return null

    const turn: IceServerConfig = { urls }
    if (this.env.TURN_USERNAME) turn.username = this.env.TURN_USERNAME
    if (this.env.TURN_CREDENTIAL) turn.credential = this.env.TURN_CREDENTIAL

    return { iceServers: [...this.stunServers, turn], hasTurn: true, source: 'static' }
  }

  async get(): Promise<IceConfig> {
    if (this.cached && Date.now() < this.cached.expiresAt) return this.cached.config
    // Mehrere gleichzeitige Beitritte sollen nicht mehrere Anfragen auslösen.
    if (this.inFlight) return this.inFlight

    this.inFlight = this.load().finally(() => {
      this.inFlight = null
    })
    return this.inFlight
  }

  private async load(): Promise<IceConfig> {
    // Das Dashboard nennt die Kennung "TURN Token ID", die Doku "Key ID" —
    // beide Schreibweisen gelten, damit niemand danach suchen muss.
    const keyId = this.env.CLOUDFLARE_TURN_KEY_ID ?? this.env.CLOUDFLARE_TURN_TOKEN_ID
    const token = this.env.CLOUDFLARE_TURN_API_TOKEN

    let reason: IceFailureReason = 'not_configured'

    if (keyId && token) {
      try {
        const servers = await this.fetchCloudflare(keyId, token)
        if (servers.length > 0) {
          const config: IceConfig = {
            iceServers: [...this.stunServers, ...servers],
            hasTurn: hasRelay(servers),
            source: 'cloudflare',
          }
          this.cached = {
            config,
            expiresAt: Date.now() + CREDENTIAL_TTL_SECONDS * 1000 - REFRESH_MARGIN_MS,
          }
          return config
        }
        reason = 'unexpected_response'
        console.warn('[walky] Cloudflare lieferte keine verwertbaren ICE-Server')
      } catch (error) {
        reason = error instanceof CloudflareError ? error.reason : 'unreachable'
        console.warn('[walky] TURN-Zugangsdaten nicht abrufbar:', reason, error)
      }
    }

    // Ein Ausfall des Anbieters darf nicht den ganzen Kanal lahmlegen: ohne
    // Relay funktioniert wenigstens noch dasselbe Netz. Nicht zwischenspeichern,
    // damit der nächste Versuch bald wieder erfolgt.
    const fallback = this.staticConfig()
    if (fallback) {
      this.cached = { config: fallback, expiresAt: Date.now() + 60 * 60 * 1000 }
      return fallback
    }

    return { iceServers: this.stunServers, hasTurn: false, source: 'stun-only', reason }
  }

  private async fetchCloudflare(keyId: string, token: string): Promise<IceServerConfig[]> {
    const response = await this.fetcher(
      `${CLOUDFLARE_ENDPOINT}/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ttl: CREDENTIAL_TTL_SECONDS }),
        signal: AbortSignal.timeout(8000),
      },
    )

    if (!response.ok) {
      // Gegen eine erfundene Kennung antwortet Cloudflare mit 401, nicht 404
      // — "unauthorized" meint deshalb: Token oder Token-ID stimmt nicht.
      const reason: IceFailureReason =
        response.status === 401 || response.status === 403
          ? 'unauthorized'
          : response.status === 404
            ? 'unknown_key'
            : 'unreachable'
      throw new CloudflareError(reason, response.status)
    }

    return parseCloudflareResponse(await response.json())
  }
}
