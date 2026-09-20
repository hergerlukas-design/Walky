import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import { createWalkyServer, parseJoinRequest, type WalkyServer } from '../server/app'
import { MAX_PEERS_PER_CHANNEL, type ServerMessage } from '../shared/protocol'

/**
 * Testet gegen einen echten Server auf einem echten Port: nur so sind
 * URL-Auswertung, Upgrade-Prüfung und Nachrichtenfluss wirklich abgedeckt.
 */
describe('Signaling-Server', () => {
  let server: WalkyServer
  let port: number
  const open: WebSocket[] = []

  beforeEach(async () => {
    server = createWalkyServer({ heartbeatIntervalMs: 60_000 })
    port = await server.listen(0, '127.0.0.1')
  })

  afterEach(async () => {
    for (const socket of open.splice(0)) socket.close()
    await server.close()
  })

  function connect(code: string, peerId: string, name = peerId): Promise<Client> {
    const query = new URLSearchParams({ peer: peerId, name })
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws/kanal/${code}?${query}`)
    open.push(socket)
    return Client.wrap(socket)
  }

  it('begrüßt den ersten Teilnehmer mit leerer Teilnehmerliste', async () => {
    const alice = await connect('testen', 'peer-alice')
    const welcome = await alice.next()

    expect(welcome).toEqual({
      type: 'welcome',
      self: expect.objectContaining({ peerId: 'peer-alice', name: 'peer-alice' }),
      peers: [],
    })
  })

  it('nennt dem Zweiten den Ersten und meldet dem Ersten den Zugang', async () => {
    const alice = await connect('testen', 'peer-alice')
    await alice.next()

    const bob = await connect('testen', 'peer-bobbb')
    const welcome = (await bob.next()) as Extract<ServerMessage, { type: 'welcome' }>
    expect(welcome.peers.map((peer) => peer.peerId)).toEqual(['peer-alice'])

    expect(await alice.next()).toEqual({
      type: 'peer-join',
      peer: expect.objectContaining({ peerId: 'peer-bobbb' }),
    })
  })

  it('reicht ein Angebot nur an den Adressaten weiter', async () => {
    const alice = await connect('testen', 'peer-alice')
    const bob = await connect('testen', 'peer-bobbb')
    const carol = await connect('testen', 'peer-carol')
    await Promise.all([alice.drain(), bob.drain(), carol.drain()])

    alice.send({
      type: 'signal',
      to: 'peer-bobbb',
      kind: 'description',
      description: { type: 'offer', sdp: 'v=0 test' },
    })

    expect(await bob.next()).toEqual({
      type: 'signal',
      from: 'peer-alice',
      kind: 'description',
      description: { type: 'offer', sdp: 'v=0 test' },
    })
    // Carol darf davon nichts sehen.
    expect(await carol.nextOrNothing(150)).toBeNull()
  })

  it('verteilt Sprechsignale an alle anderen im Kanal', async () => {
    const alice = await connect('testen', 'peer-alice')
    const bob = await connect('testen', 'peer-bobbb')
    await Promise.all([alice.drain(), bob.drain()])

    alice.send({ type: 'talk', talking: true })

    expect(await bob.next()).toEqual({ type: 'talk', from: 'peer-alice', talking: true })
    expect(await alice.nextOrNothing(150)).toBeNull()
  })

  it('trennt Kanäle voneinander', async () => {
    const alice = await connect('kanala', 'peer-alice')
    const bob = await connect('kanalb', 'peer-bobbb')
    await Promise.all([alice.drain(), bob.drain()])

    alice.send({ type: 'talk', talking: true })

    expect(await bob.nextOrNothing(200)).toBeNull()
  })

  it('meldet den Abgang, wenn eine Verbindung wegfällt', async () => {
    const alice = await connect('testen', 'peer-alice')
    const bob = await connect('testen', 'peer-bobbb')
    await Promise.all([alice.drain(), bob.drain()])

    bob.close()

    expect(await alice.next()).toEqual({ type: 'peer-leave', peerId: 'peer-bobbb' })
  })

  it('antwortet auf ping mit pong', async () => {
    const alice = await connect('testen', 'peer-alice')
    await alice.drain()

    alice.send({ type: 'ping' })
    expect(await alice.next()).toEqual({ type: 'pong' })
  })

  it('beantwortet Unsinn mit einem Fehler statt die Verbindung zu kappen', async () => {
    const alice = await connect('testen', 'peer-alice')
    await alice.drain()

    alice.raw('kein json')
    expect(await alice.next()).toMatchObject({ type: 'error', code: 'bad_message' })

    alice.raw(JSON.stringify({ type: 'nicht-vorgesehen' }))
    expect(await alice.next()).toMatchObject({ type: 'error', code: 'bad_message' })

    // Die Verbindung steht weiterhin.
    alice.send({ type: 'ping' })
    expect(await alice.next()).toEqual({ type: 'pong' })
  })

  it('weist einen vollen Kanal ab', async () => {
    for (let i = 0; i < MAX_PEERS_PER_CHANNEL; i += 1) {
      const client = await connect('testen', `peer-nummer-${i}`)
      await client.next()
    }

    const abgewiesen = await connect('testen', 'peer-zuviel')
    expect(await abgewiesen.next()).toMatchObject({ type: 'error', code: 'channel_full' })
    expect(await abgewiesen.closedWith()).toBe(1008)
  })

  it('lehnt Upgrades mit unbrauchbarer URL ab', async () => {
    const tooShort = new WebSocket(`ws://127.0.0.1:${port}/ws/kanal/ab?peer=peer-alice`)
    const noPeer = new WebSocket(`ws://127.0.0.1:${port}/ws/kanal/testen`)
    const wrongPath = new WebSocket(`ws://127.0.0.1:${port}/etwas-anderes`)

    await Promise.all(
      [tooShort, noPeer, wrongPath].map(
        (socket) =>
          new Promise<void>((done) => {
            socket.on('error', () => done())
          }),
      ),
    )
  })

  it('liefert einen Gesundheitsstatus mit Kanalzahl', async () => {
    const alice = await connect('testen', 'peer-alice')
    await alice.next()

    const response = await fetch(`http://127.0.0.1:${port}/healthz`)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok', channels: 1, peers: 1 })
  })
})

describe('parseJoinRequest', () => {
  it('liest Kanal, Peer und Namen aus der URL', () => {
    expect(parseJoinRequest('/ws/kanal/abc234?peer=peer-alice-1&name=Blauer%20Falke')).toEqual({
      code: 'abc234',
      peerId: 'peer-alice-1',
      name: 'Blauer Falke',
    })
  })

  it('setzt einen Ersatznamen, wenn keiner mitkommt', () => {
    expect(parseJoinRequest('/ws/kanal/abc234?peer=peer-alice-1')?.name).toBe('Unbekannt')
  })

  it('kürzt überlange Namen', () => {
    const result = parseJoinRequest(`/ws/kanal/abc234?peer=peer-alice-1&name=${'x'.repeat(100)}`)
    expect(result?.name).toHaveLength(32)
  })

  it.each([
    ['falscher Pfad', '/socket?peer=peer-alice-1'],
    ['Code zu kurz', '/ws/kanal/ab?peer=peer-alice-1'],
    ['Code fehlt', '/ws/kanal/?peer=peer-alice-1'],
    ['Peer fehlt', '/ws/kanal/abc234'],
    ['Peer zu kurz', '/ws/kanal/abc234?peer=kurz'],
    ['Peer mit Sonderzeichen', '/ws/kanal/abc234?peer=peer/../andere'],
  ])('weist ab: %s', (_label, url) => {
    expect(parseJoinRequest(url)).toBeNull()
  })
})

/** Kleiner Wrapper, der eingehende Nachrichten puffert. */
class Client {
  private readonly queue: ServerMessage[] = []
  private readonly waiting: ((message: ServerMessage) => void)[] = []
  private closeCode: number | null = null

  private constructor(private readonly socket: WebSocket) {
    socket.on('message', (data) => {
      const message = JSON.parse(data.toString()) as ServerMessage
      const next = this.waiting.shift()
      if (next) next(message)
      else this.queue.push(message)
    })
    socket.on('close', (code) => {
      this.closeCode = code
    })
  }

  static wrap(socket: WebSocket): Promise<Client> {
    const client = new Client(socket)
    return new Promise((done, fail) => {
      socket.once('open', () => done(client))
      socket.once('error', fail)
    })
  }

  next(timeoutMs = 2000): Promise<ServerMessage> {
    const queued = this.queue.shift()
    if (queued) return Promise.resolve(queued)

    return new Promise((done, fail) => {
      const timer = setTimeout(() => fail(new Error('Zeitüberschreitung beim Warten')), timeoutMs)
      this.waiting.push((message) => {
        clearTimeout(timer)
        done(message)
      })
    })
  }

  /** Erwartet, dass in der Wartezeit nichts eintrifft. */
  async nextOrNothing(timeoutMs: number): Promise<ServerMessage | null> {
    try {
      return await this.next(timeoutMs)
    } catch {
      return null
    }
  }

  /**
   * Alles Ausstehende (welcome, peer-join …) abräumen — und zwar so lange,
   * bis nichts mehr nachkommt. Ein einzelnes `next()` würde je nach Timing
   * die Beitrittsmeldung der anderen stehen lassen.
   */
  async drain(settleMs = 60): Promise<void> {
    let seen = -1
    while (seen !== this.queue.length) {
      seen = this.queue.length
      await new Promise((done) => setTimeout(done, settleMs))
    }
    this.queue.length = 0
  }

  send(message: unknown): void {
    this.socket.send(JSON.stringify(message))
  }

  raw(data: string): void {
    this.socket.send(data)
  }

  close(): void {
    this.socket.close()
  }

  async closedWith(timeoutMs = 2000): Promise<number | null> {
    const deadline = Date.now() + timeoutMs
    while (this.closeCode === null && Date.now() < deadline) {
      await new Promise((done) => setTimeout(done, 20))
    }
    return this.closeCode
  }
}
