import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChannelRegistry, type Connection } from '../server/channels'
import { MAX_PEERS_PER_CHANNEL, type ServerMessage } from '../shared/protocol'

/** Testdouble statt echter WebSocket — die Kanal-Logik kennt nur `send`/`close`. */
function fakeConnection(peerId: string, joinedAt = Date.now()): Connection & {
  sent: ServerMessage[]
  closed: boolean
} {
  const sent: ServerMessage[] = []
  const connection = {
    peerId,
    name: `Peer ${peerId}`,
    joinedAt,
    sent,
    closed: false,
    send(message: ServerMessage) {
      sent.push(message)
    },
    close() {
      connection.closed = true
    },
  }
  return connection
}

describe('ChannelRegistry', () => {
  let registry: ChannelRegistry

  beforeEach(() => {
    registry = new ChannelRegistry()
  })

  it('meldet dem Beitretenden die bereits Anwesenden', () => {
    const first = fakeConnection('a', 1000)
    const second = fakeConnection('b', 2000)

    expect(registry.join('kanal', first)).toEqual({ ok: true, peers: [] })

    const result = registry.join('kanal', second)
    expect(result.ok).toBe(true)
    expect(result.ok && result.peers.map((peer) => peer.peerId)).toEqual(['a'])
  })

  it('kündigt neue Teilnehmer bei den anderen an, aber nicht bei sich selbst', () => {
    const first = fakeConnection('a')
    const second = fakeConnection('b')
    registry.join('kanal', first)
    registry.join('kanal', second)

    expect(first.sent).toEqual([{ type: 'peer-join', peer: expect.objectContaining({ peerId: 'b' }) }])
    expect(second.sent).toEqual([])
  })

  it('meldet das Verlassen an die verbliebenen Teilnehmer', () => {
    const first = fakeConnection('a')
    const second = fakeConnection('b')
    registry.join('kanal', first)
    registry.join('kanal', second)
    first.sent.length = 0

    registry.leave('kanal', 'b')
    expect(first.sent).toEqual([{ type: 'peer-leave', peerId: 'b' }])
    expect(registry.size('kanal')).toBe(1)
  })

  it('stellt genau einem Adressaten zu', () => {
    const a = fakeConnection('a')
    const b = fakeConnection('b')
    const c = fakeConnection('c')
    ;[a, b, c].forEach((connection) => registry.join('kanal', connection))
    ;[a, b, c].forEach((connection) => (connection.sent.length = 0))

    const message: ServerMessage = {
      type: 'signal',
      from: 'a',
      kind: 'candidate',
      candidate: { candidate: 'x' },
    }
    expect(registry.relay('kanal', 'b', message)).toBe(true)

    expect(b.sent).toEqual([message])
    expect(a.sent).toEqual([])
    expect(c.sent).toEqual([])
  })

  it('stellt nicht über Kanalgrenzen hinweg zu', () => {
    const a = fakeConnection('a')
    const other = fakeConnection('b')
    registry.join('kanal-1', a)
    registry.join('kanal-2', other)
    other.sent.length = 0

    const delivered = registry.relay('kanal-1', 'b', { type: 'pong' })
    expect(delivered).toBe(false)
    expect(other.sent).toEqual([])
  })

  it('ersetzt eine tote Verbindung mit gleicher Peer-ID', () => {
    const stale = fakeConnection('a')
    const witness = fakeConnection('w')
    registry.join('kanal', stale)
    registry.join('kanal', witness)
    witness.sent.length = 0

    const fresh = fakeConnection('a')
    expect(registry.join('kanal', fresh).ok).toBe(true)

    expect(stale.closed).toBe(true)
    expect(registry.size('kanal')).toBe(2)
    // Die anderen sehen erst das Gehen, dann das Kommen — sonst hätten sie
    // zwei Mesh-Verbindungen zur selben Gegenstelle.
    expect(witness.sent).toEqual([
      { type: 'peer-leave', peerId: 'a' },
      { type: 'peer-join', peer: expect.objectContaining({ peerId: 'a' }) },
    ])
  })

  it('weist Beitritte ab, sobald das Mesh zu groß würde', () => {
    for (let i = 0; i < MAX_PEERS_PER_CHANNEL; i += 1) {
      expect(registry.join('kanal', fakeConnection(`peer-${i}`)).ok).toBe(true)
    }

    expect(registry.join('kanal', fakeConnection('zu-viel'))).toEqual({
      ok: false,
      reason: 'channel_full',
    })
    expect(registry.size('kanal')).toBe(MAX_PEERS_PER_CHANNEL)
  })

  it('räumt leere Kanäle weg', () => {
    registry.join('kanal', fakeConnection('a'))
    registry.leave('kanal', 'a')

    expect(registry.size('kanal')).toBe(0)
    expect(registry.stats()).toEqual({ channels: 0, peers: 0 })
  })

  it('ignoriert das Verlassen eines unbekannten Peers', () => {
    const a = fakeConnection('a')
    registry.join('kanal', a)
    a.sent.length = 0

    registry.leave('kanal', 'gibt-es-nicht')
    registry.leave('anderer-kanal', 'a')

    expect(a.sent).toEqual([])
    expect(registry.size('kanal')).toBe(1)
  })

  it('zählt Kanäle und Teilnehmer über alle Kanäle', () => {
    registry.join('eins', fakeConnection('a'))
    registry.join('eins', fakeConnection('b'))
    registry.join('zwei', fakeConnection('c'))

    expect(registry.stats()).toEqual({ channels: 2, peers: 3 })
  })

  it('erreicht beim Broadcast alle außer dem Absender', () => {
    const a = fakeConnection('a')
    const b = fakeConnection('b')
    const c = fakeConnection('c')
    ;[a, b, c].forEach((connection) => registry.join('kanal', connection))
    ;[a, b, c].forEach((connection) => (connection.sent.length = 0))

    registry.broadcast('kanal', { type: 'talk', from: 'a', talking: true }, 'a')

    expect(a.sent).toEqual([])
    expect(b.sent).toEqual([{ type: 'talk', from: 'a', talking: true }])
    expect(c.sent).toEqual([{ type: 'talk', from: 'a', talking: true }])
  })

  it('lässt einen Sendefehler nicht die übrigen Zustellungen verhindern', () => {
    const broken = fakeConnection('broken')
    broken.send = vi.fn(() => {
      throw new Error('socket weg')
    })
    const healthy = fakeConnection('healthy')
    registry.join('kanal', broken)
    registry.join('kanal', healthy)
    healthy.sent.length = 0

    expect(() => registry.broadcast('kanal', { type: 'pong' })).not.toThrow()
    expect(healthy.sent).toEqual([{ type: 'pong' }])
  })
})
