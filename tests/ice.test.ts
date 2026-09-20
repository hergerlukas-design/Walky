import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IceProvider, parseCloudflareResponse, type IceProviderEnv } from '../server/ice'

const CLOUDFLARE_URLS = [
  'stun:stun.cloudflare.com:3478',
  'turn:turn.cloudflare.com:3478?transport=udp',
  'turns:turn.cloudflare.com:5349?transport=tcp',
]

function okResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('parseCloudflareResponse', () => {
  // Die Doku war von hier aus nicht erreichbar, deshalb werden beide
  // plausiblen Formen abgedeckt: ein Objekt und eine Liste.
  it('liest iceServers als einzelnes Objekt', () => {
    expect(
      parseCloudflareResponse({
        iceServers: { urls: CLOUDFLARE_URLS, username: 'abc', credential: 'xyz' },
      }),
    ).toEqual([{ urls: CLOUDFLARE_URLS, username: 'abc', credential: 'xyz' }])
  })

  it('liest iceServers als Liste', () => {
    expect(
      parseCloudflareResponse({
        iceServers: [{ urls: CLOUDFLARE_URLS, username: 'abc', credential: 'xyz' }],
      }),
    ).toEqual([{ urls: CLOUDFLARE_URLS, username: 'abc', credential: 'xyz' }])
  })

  it('nimmt auch eine einzelne URL als Zeichenkette', () => {
    expect(parseCloudflareResponse({ iceServers: { urls: 'turn:example:3478' } })).toEqual([
      { urls: ['turn:example:3478'] },
    ])
  })

  it('verwirft Unbrauchbares, statt kaputte Angaben durchzureichen', () => {
    expect(parseCloudflareResponse(null)).toEqual([])
    expect(parseCloudflareResponse({})).toEqual([])
    expect(parseCloudflareResponse({ iceServers: { username: 'ohne-urls' } })).toEqual([])
    expect(parseCloudflareResponse({ iceServers: [{ urls: [] }] })).toEqual([])
  })

  it('übernimmt Zugangsdaten nur, wenn es Zeichenketten sind', () => {
    const [server] = parseCloudflareResponse({
      iceServers: { urls: ['turn:x:1'], username: 42, credential: null },
    })
    expect(server).toEqual({ urls: ['turn:x:1'] })
  })
})

describe('IceProvider', () => {
  let fetcher: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetcher = vi.fn()
  })

  const provider = (env: IceProviderEnv) =>
    new IceProvider(env, fetcher as unknown as typeof fetch)

  it('liefert ohne Konfiguration nur STUN und meldet das ehrlich', async () => {
    const config = await provider({}).get()

    expect(config.hasTurn).toBe(false)
    expect(config.iceServers).toHaveLength(1)
    expect(config.iceServers[0].urls[0]).toMatch(/^stun:/)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('nimmt fest hinterlegte Zugangsdaten eines anderen Anbieters', async () => {
    const config = await provider({
      TURN_URLS: 'turn:relay.example:3478, turns:relay.example:5349',
      TURN_USERNAME: 'walky',
      TURN_CREDENTIAL: 'geheim',
    }).get()

    expect(config.hasTurn).toBe(true)
    expect(config.iceServers[1]).toEqual({
      urls: ['turn:relay.example:3478', 'turns:relay.example:5349'],
      username: 'walky',
      credential: 'geheim',
    })
  })

  it('holt kurzlebige Zugangsdaten bei Cloudflare', async () => {
    fetcher.mockResolvedValue(
      okResponse({ iceServers: { urls: CLOUDFLARE_URLS, username: 'u', credential: 'c' } }),
    )

    const config = await provider({
      CLOUDFLARE_TURN_KEY_ID: 'schlüssel/mit zeichen',
      CLOUDFLARE_TURN_API_TOKEN: 'token',
    }).get()

    expect(config.hasTurn).toBe(true)
    const [url, init] = fetcher.mock.calls[0]
    expect(url).toBe(
      'https://rtc.live.cloudflare.com/v1/turn/keys/schl%C3%BCssel%2Fmit%20zeichen/credentials/generate-ice-servers',
    )
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer token')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body)).toEqual({ ttl: 7200 })
  })

  it('nimmt auch die Dashboard-Schreibweise CLOUDFLARE_TURN_TOKEN_ID', async () => {
    fetcher.mockResolvedValue(
      okResponse({ iceServers: { urls: CLOUDFLARE_URLS, username: 'u', credential: 'c' } }),
    )

    const config = await provider({
      CLOUDFLARE_TURN_TOKEN_ID: 'aus-dem-dashboard',
      CLOUDFLARE_TURN_API_TOKEN: 'token',
    }).get()

    expect(config.hasTurn).toBe(true)
    expect(fetcher.mock.calls[0][0]).toContain('/keys/aus-dem-dashboard/credentials/')
  })

  it('fragt nicht bei jedem Beitritt neu an', async () => {
    fetcher.mockResolvedValue(
      okResponse({ iceServers: { urls: CLOUDFLARE_URLS, username: 'u', credential: 'c' } }),
    )
    const instance = provider({
      CLOUDFLARE_TURN_KEY_ID: 'k',
      CLOUDFLARE_TURN_API_TOKEN: 't',
    })

    await instance.get()
    await instance.get()
    await instance.get()

    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('bündelt gleichzeitige Anfragen zu einer', async () => {
    let freigeben: (value: Response) => void = () => {}
    fetcher.mockReturnValue(new Promise<Response>((resolve) => (freigeben = resolve)))

    const instance = provider({
      CLOUDFLARE_TURN_KEY_ID: 'k',
      CLOUDFLARE_TURN_API_TOKEN: 't',
    })
    const alle = Promise.all([instance.get(), instance.get(), instance.get()])
    freigeben(okResponse({ iceServers: { urls: CLOUDFLARE_URLS, username: 'u', credential: 'c' } }))

    const ergebnisse = await alle
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(ergebnisse.every((config) => config.hasTurn)).toBe(true)
  })

  it('legt bei einem Ausfall des Anbieters nicht den Kanal lahm', async () => {
    fetcher.mockRejectedValue(new Error('Netz weg'))

    const config = await provider({
      CLOUDFLARE_TURN_KEY_ID: 'k',
      CLOUDFLARE_TURN_API_TOKEN: 't',
    }).get()

    // Im selben Netz funktioniert es weiterhin — und die Oberfläche kann
    // ehrlich melden, dass kein Relay da ist.
    expect(config.hasTurn).toBe(false)
    expect(config.iceServers[0].urls[0]).toMatch(/^stun:/)
  })

  it('versucht es nach einem Ausfall erneut, statt den Fehler festzuhalten', async () => {
    fetcher.mockRejectedValueOnce(new Error('kurzer Aussetzer'))
    fetcher.mockResolvedValue(
      okResponse({ iceServers: { urls: CLOUDFLARE_URLS, username: 'u', credential: 'c' } }),
    )
    const instance = provider({
      CLOUDFLARE_TURN_KEY_ID: 'k',
      CLOUDFLARE_TURN_API_TOKEN: 't',
    })

    expect((await instance.get()).hasTurn).toBe(false)
    expect((await instance.get()).hasTurn).toBe(true)
  })

  it('fällt bei einem Cloudflare-Fehler auf feste Zugangsdaten zurück', async () => {
    fetcher.mockResolvedValue(new Response('nope', { status: 401 }))

    const config = await provider({
      CLOUDFLARE_TURN_KEY_ID: 'k',
      CLOUDFLARE_TURN_API_TOKEN: 'falsch',
      TURN_URLS: 'turn:ersatz.example:3478',
    }).get()

    expect(config.hasTurn).toBe(true)
    expect(config.iceServers[1].urls).toEqual(['turn:ersatz.example:3478'])
  })

  it('meldet kein Relay, wenn die Antwort nur STUN enthält', async () => {
    fetcher.mockResolvedValue(okResponse({ iceServers: { urls: ['stun:nur.stun:3478'] } }))

    const config = await provider({
      CLOUDFLARE_TURN_KEY_ID: 'k',
      CLOUDFLARE_TURN_API_TOKEN: 't',
    }).get()

    expect(config.hasTurn).toBe(false)
  })
})
