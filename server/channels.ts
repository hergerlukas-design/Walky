import type { PeerInfo, ServerMessage } from '../shared/protocol.js'
import { MAX_PEERS_PER_CHANNEL } from '../shared/protocol.js'

export interface Connection {
  readonly peerId: string
  readonly name: string
  readonly joinedAt: number
  /** Auf das Nötigste reduziert, damit die Kanal-Logik ohne `ws` testbar ist. */
  send(message: ServerMessage): void
  close(): void
}

export type JoinResult =
  | { ok: true; peers: PeerInfo[] }
  | { ok: false; reason: 'channel_full' }

const toInfo = (connection: Connection): PeerInfo => ({
  peerId: connection.peerId,
  name: connection.name,
  joinedAt: connection.joinedAt,
})

/**
 * Der komplette Serverzustand: pro Kanal-Code die gerade verbundenen Clients.
 * Alles nur im Speicher — ein Kanal existiert genau so lange, wie jemand
 * drin ist. Damit gibt es nichts zu migrieren, nichts aufzuräumen und keine
 * Datenbank.
 */
export class ChannelRegistry {
  private readonly channels = new Map<string, Map<string, Connection>>()

  join(code: string, connection: Connection): JoinResult {
    let channel = this.channels.get(code)
    if (!channel) {
      channel = new Map()
      this.channels.set(code, channel)
    }

    // Reconnect mit gleicher Peer-ID: die alte Verbindung ist eine Leiche.
    const stale = channel.get(connection.peerId)
    if (stale) {
      channel.delete(connection.peerId)
      stale.close()
      this.broadcast(code, { type: 'peer-leave', peerId: connection.peerId })
    }

    if (channel.size >= MAX_PEERS_PER_CHANNEL) {
      if (channel.size === 0) this.channels.delete(code)
      return { ok: false, reason: 'channel_full' }
    }

    const peers = [...channel.values()].map(toInfo)
    channel.set(connection.peerId, connection)
    this.broadcast(code, { type: 'peer-join', peer: toInfo(connection) }, connection.peerId)

    return { ok: true, peers }
  }

  leave(code: string, peerId: string): void {
    const channel = this.channels.get(code)
    if (!channel?.delete(peerId)) return

    if (channel.size === 0) {
      this.channels.delete(code)
      return
    }
    this.broadcast(code, { type: 'peer-leave', peerId })
  }

  /** Signaling ist immer an genau eine Gegenstelle im selben Kanal adressiert. */
  relay(code: string, to: string, message: ServerMessage): boolean {
    const target = this.channels.get(code)?.get(to)
    if (!target) return false
    return this.safeSend(target, message)
  }

  broadcast(code: string, message: ServerMessage, exceptPeerId?: string): void {
    const channel = this.channels.get(code)
    if (!channel) return
    for (const connection of channel.values()) {
      if (connection.peerId === exceptPeerId) continue
      this.safeSend(connection, message)
    }
  }

  /**
   * Ein Socket, der gerade wegbricht, wirft beim Senden. Das darf die
   * Zustellung an die übrigen Teilnehmer nicht abbrechen — der Heartbeat
   * räumt die tote Verbindung ohnehin gleich ab.
   */
  private safeSend(connection: Connection, message: ServerMessage): boolean {
    try {
      connection.send(message)
      return true
    } catch (error) {
      console.warn(`[walky] Zustellung an ${connection.peerId} fehlgeschlagen:`, error)
      return false
    }
  }

  size(code: string): number {
    return this.channels.get(code)?.size ?? 0
  }

  stats(): { channels: number; peers: number } {
    let peers = 0
    for (const channel of this.channels.values()) peers += channel.size
    return { channels: this.channels.size, peers }
  }
}
