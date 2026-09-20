import { Peer, isPolite, type PeerCallbacks } from './peerConnection'
import type { IceCandidate, SessionDescription } from '../../shared/protocol'
import type { PeerId, PeerStatus } from '../types'

export interface MeshOptions {
  selfId: PeerId
  callbacks: PeerCallbacks
}

/**
 * Vollvermaschtes Netz: jedes Gerät hält zu jedem anderen eine eigene
 * Verbindung. Bei n Teilnehmern sind das n-1 Uploads pro Gerät — bis etwa
 * vier bis fünf Teilnehmern unproblematisch und ohne Media-Server. Darüber
 * gehört eine SFU davor (siehe README).
 */
export class Mesh {
  private readonly selfId: PeerId
  private readonly callbacks: PeerCallbacks
  private iceServers: RTCIceServer[] = []
  private readonly peers = new Map<PeerId, Peer>()
  private localStream: MediaStream | null = null

  constructor({ selfId, callbacks }: MeshOptions) {
    this.selfId = selfId
    this.callbacks = callbacks
  }

  /**
   * Wird gesetzt, bevor der erste Peer entsteht — die Angaben holt die
   * Sitzung beim Server, nicht aus dem Bundle.
   */
  setIceServers(iceServers: RTCIceServer[]): void {
    this.iceServers = iceServers
  }

  /**
   * Gleicht die offenen Verbindungen mit der Presence-Liste ab: neue Peers
   * bekommen eine Verbindung, verschwundene werden abgeräumt.
   */
  sync(presentIds: PeerId[]): void {
    const present = new Set(presentIds.filter((id) => id !== this.selfId))

    for (const [peerId, peer] of this.peers) {
      if (!present.has(peerId)) {
        peer.close()
        this.peers.delete(peerId)
        this.callbacks.onStatus(peerId, 'closed')
      }
    }

    for (const peerId of present) {
      this.ensurePeer(peerId)
    }
  }

  private ensurePeer(peerId: PeerId): Peer {
    const existing = this.peers.get(peerId)
    if (existing) return existing

    const peer = new Peer({
      peerId,
      polite: isPolite(this.selfId, peerId),
      iceServers: this.iceServers,
      localStream: this.localStream,
      callbacks: this.callbacks,
    })
    this.peers.set(peerId, peer)
    return peer
  }

  async handleDescription(from: PeerId, description: SessionDescription): Promise<void> {
    // Ein Angebot kann eintreffen, bevor Presence den Peer gemeldet hat.
    await this.ensurePeer(from).handleDescription(description)
  }

  async handleCandidate(from: PeerId, candidate: IceCandidate): Promise<void> {
    await this.peers.get(from)?.handleCandidate(candidate)
  }

  setLocalStream(stream: MediaStream | null): void {
    this.localStream = stream
    for (const peer of this.peers.values()) {
      peer.setLocalStream(stream)
    }
  }

  getStatus(peerId: PeerId): PeerStatus {
    return this.peers.get(peerId)?.getStatus() ?? 'new'
  }

  /** Verbindungen komplett neu aufbauen, z. B. nach einem Netzwechsel. */
  resetFailed(): void {
    for (const [peerId, peer] of this.peers) {
      if (peer.getStatus() === 'failed') {
        peer.close()
        this.peers.delete(peerId)
      }
    }
  }

  close(): void {
    for (const peer of this.peers.values()) {
      peer.close()
    }
    this.peers.clear()
  }
}
