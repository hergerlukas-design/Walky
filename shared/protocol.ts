/**
 * Nachrichtenformat zwischen PWA und Signaling-Server. Wird von Client und
 * Server importiert — das Protokoll kann damit nicht auseinanderlaufen.
 *
 * Der Server transportiert ausschließlich Verbindungsaufbau (SDP, ICE) und
 * Push-to-Talk-Signale. Die Sprache selbst läuft P2P und berührt ihn nie.
 */

export type PeerId = string

/** Pfad, unter dem der Server WebSocket-Upgrades annimmt. */
export const WS_PATH_PREFIX = '/ws/kanal/'

/** Mehr Teilnehmer trägt ein Mesh nicht (n-1 Uploads pro Gerät). */
export const MAX_PEERS_PER_CHANNEL = 8

/** Verbindungen ohne Lebenszeichen werden nach zwei Intervallen gekappt. */
export const HEARTBEAT_INTERVAL_MS = 25_000

/** Ein SDP-Angebot ist ein paar Kilobyte groß; alles darüber ist Unsinn. */
export const MAX_MESSAGE_BYTES = 64 * 1024

/**
 * Strukturell deckungsgleich mit den DOM-Typen `RTCSessionDescriptionInit`
 * bzw. `RTCIceCandidateInit`, hier aber eigenständig definiert: der Server
 * läuft in Node und soll die DOM-Typbibliothek nicht brauchen.
 */
export interface SessionDescription {
  type: 'offer' | 'answer' | 'pranswer' | 'rollback'
  sdp?: string
}

export interface IceCandidate {
  candidate?: string
  sdpMid?: string | null
  sdpMLineIndex?: number | null
  usernameFragment?: string | null
}

export interface PeerInfo {
  peerId: PeerId
  name: string
  joinedAt: number
}

// --------------------------------------------------------------- Client → Server

export type ClientMessage =
  /** SDP oder ICE-Kandidat, adressiert an genau einen anderen Peer im Kanal. */
  | {
      type: 'signal'
      to: PeerId
      kind: 'description'
      description: SessionDescription
    }
  | {
      type: 'signal'
      to: PeerId
      kind: 'candidate'
      candidate: IceCandidate
    }
  /** Sprechtaste gedrückt bzw. losgelassen — geht an alle im Kanal. */
  | { type: 'talk'; talking: boolean }
  | { type: 'ping' }

// --------------------------------------------------------------- Server → Client

export type ServerMessage =
  /** Erste Antwort nach dem Beitritt: wer ist schon da. */
  | { type: 'welcome'; self: PeerInfo; peers: PeerInfo[] }
  | { type: 'peer-join'; peer: PeerInfo }
  | { type: 'peer-leave'; peerId: PeerId }
  | {
      type: 'signal'
      from: PeerId
      kind: 'description'
      description: SessionDescription
    }
  | { type: 'signal'; from: PeerId; kind: 'candidate'; candidate: IceCandidate }
  | { type: 'talk'; from: PeerId; talking: boolean }
  | { type: 'error'; code: ServerErrorCode; message: string }
  | { type: 'pong' }

export type ServerErrorCode =
  | 'invalid_channel'
  | 'invalid_peer'
  | 'channel_full'
  | 'bad_message'

export function isClientMessage(value: unknown): value is ClientMessage {
  if (typeof value !== 'object' || value === null) return false
  const message = value as Record<string, unknown>

  switch (message.type) {
    case 'signal':
      if (typeof message.to !== 'string' || message.to.length === 0) return false
      if (message.kind === 'description') {
        return typeof message.description === 'object' && message.description !== null
      }
      if (message.kind === 'candidate') {
        return typeof message.candidate === 'object' && message.candidate !== null
      }
      return false
    case 'talk':
      return typeof message.talking === 'boolean'
    case 'ping':
      return true
    default:
      return false
  }
}
