import type { IceCandidate, SessionDescription } from '../../shared/protocol'
import type { PeerId, PeerStatus } from '../types'

export interface PeerCallbacks {
  sendDescription(to: PeerId, description: SessionDescription): void
  sendCandidate(to: PeerId, candidate: IceCandidate): void
  onStream(peerId: PeerId, stream: MediaStream): void
  onStatus(peerId: PeerId, status: PeerStatus): void
}

export interface PeerOptions {
  peerId: PeerId
  /** true = dieser Peer gibt bei einer Angebots-Kollision nach. */
  polite: boolean
  iceServers: RTCIceServer[]
  localStream: MediaStream | null
  callbacks: PeerCallbacks
}

/**
 * Entscheidet deterministisch und ohne Absprache, wer bei gleichzeitigen
 * Angeboten nachgibt: beide Seiten vergleichen dieselben IDs und kommen
 * zwangsläufig zum gegenteiligen Ergebnis.
 */
export function isPolite(selfId: PeerId, remoteId: PeerId): boolean {
  return selfId > remoteId
}

/**
 * Eine Gegenstelle im Mesh, umgesetzt nach dem "perfect negotiation"-Muster
 * (siehe MDN). Damit ist es egal, wer zuerst ein Angebot schickt — der
 * unhöfliche Peer setzt sich durch, der höfliche rollt sein eigenes Angebot
 * zurück. Das erspart eine eigene Rollenverteilung über das Signaling.
 */
export class Peer {
  readonly peerId: PeerId
  readonly polite: boolean

  private readonly pc: RTCPeerConnection
  private readonly callbacks: PeerCallbacks
  private sender: RTCRtpSender | null = null

  private makingOffer = false
  private ignoreOffer = false
  private settingRemoteAnswer = false
  private closed = false
  private status: PeerStatus = 'new'

  constructor({ peerId, polite, iceServers, localStream, callbacks }: PeerOptions) {
    this.peerId = peerId
    this.polite = polite
    this.callbacks = callbacks

    this.pc = new RTCPeerConnection({ iceServers, bundlePolicy: 'max-bundle' })
    this.attachLocalStream(localStream)

    this.pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer = true
        await this.pc.setLocalDescription()
        if (this.pc.localDescription) {
          this.callbacks.sendDescription(this.peerId, this.pc.localDescription.toJSON())
        }
      } catch (error) {
        console.warn('[walky] Angebot fehlgeschlagen', this.peerId, error)
      } finally {
        this.makingOffer = false
      }
    }

    this.pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this.callbacks.sendCandidate(this.peerId, candidate.toJSON())
      }
    }

    this.pc.ontrack = ({ streams, track }) => {
      const stream = streams[0] ?? new MediaStream([track])
      this.callbacks.onStream(this.peerId, stream)
    }

    this.pc.onconnectionstatechange = () => {
      switch (this.pc.connectionState) {
        case 'connected':
          this.setStatus('connected')
          break
        case 'connecting':
          this.setStatus('connecting')
          break
        case 'disconnected':
          this.setStatus('reconnecting')
          break
        case 'failed':
          this.setStatus('failed')
          this.restartIce()
          break
        case 'closed':
          this.setStatus('closed')
          break
        default:
          break
      }
    }

    this.setStatus('connecting')
  }

  private setStatus(status: PeerStatus): void {
    if (this.closed || this.status === status) return
    this.status = status
    this.callbacks.onStatus(this.peerId, status)
  }

  getStatus(): PeerStatus {
    return this.status
  }

  /**
   * Ein ICE-Restart wird nur vom unhöflichen Peer ausgelöst: sonst werfen
   * beide Seiten gleichzeitig neue Angebote in die Leitung.
   */
  private restartIce(): void {
    if (this.closed || this.polite) return
    try {
      this.pc.restartIce()
    } catch (error) {
      console.warn('[walky] ICE-Restart fehlgeschlagen', this.peerId, error)
    }
  }

  async handleDescription(description: SessionDescription): Promise<void> {
    if (this.closed) return

    const readyForOffer =
      !this.makingOffer &&
      (this.pc.signalingState === 'stable' || this.settingRemoteAnswer)
    const offerCollision = description.type === 'offer' && !readyForOffer

    this.ignoreOffer = !this.polite && offerCollision
    if (this.ignoreOffer) return

    try {
      this.settingRemoteAnswer = description.type === 'answer'
      await this.pc.setRemoteDescription(description)
      this.settingRemoteAnswer = false

      if (description.type === 'offer') {
        await this.pc.setLocalDescription()
        if (this.pc.localDescription) {
          this.callbacks.sendDescription(this.peerId, this.pc.localDescription.toJSON())
        }
      }
    } catch (error) {
      this.settingRemoteAnswer = false
      console.warn('[walky] Beschreibung abgelehnt', this.peerId, error)
    }
  }

  async handleCandidate(candidate: IceCandidate): Promise<void> {
    if (this.closed) return
    try {
      await this.pc.addIceCandidate(candidate)
    } catch (error) {
      // Nach einem verworfenen Angebot treffen noch Kandidaten dazu ein.
      if (!this.ignoreOffer) {
        console.warn('[walky] ICE-Kandidat verworfen', this.peerId, error)
      }
    }
  }

  /**
   * Bewusst `addTrack` statt `addTransceiver`: nur ein per addTrack angelegter
   * Transceiver darf beim Eintreffen eines Angebots mit dessen m-Zeile
   * verknüpft werden. Mit addTransceiver handelten beide Seiten je eine eigene
   * m-Zeile aus — die Verbindung trug dann zwei Audiospuren statt einer.
   */
  private attachLocalStream(stream: MediaStream | null): void {
    const track = stream?.getAudioTracks()[0] ?? null

    if (track && stream) {
      this.sender = this.pc.addTrack(track, stream)
      return
    }

    // Ohne Mikrofon nur zuhören. Der Sendepfad kommt später per addTrack dazu
    // und löst dann eine erneute Aushandlung aus.
    this.pc.addTransceiver('audio', { direction: 'recvonly' })
  }

  setLocalStream(stream: MediaStream | null): void {
    if (this.closed) return
    const track = stream?.getAudioTracks()[0] ?? null

    if (this.sender) {
      void this.sender.replaceTrack(track).catch((error: unknown) => {
        console.warn('[walky] Mikrofon-Track nicht übernommen', this.peerId, error)
      })
      return
    }

    if (track && stream) {
      this.sender = this.pc.addTrack(track, stream)
    }
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    this.pc.onnegotiationneeded = null
    this.pc.onicecandidate = null
    this.pc.ontrack = null
    this.pc.onconnectionstatechange = null
    try {
      this.pc.close()
    } catch {
      /* bereits geschlossen */
    }
  }
}
