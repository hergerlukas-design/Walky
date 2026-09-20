import type { PeerId } from '../shared/protocol'

export type { PeerId }

/** Zustand der Verbindung zum Signaling-Server. */
export type SignalingStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error'

/** Zustand einer einzelnen P2P-Audioverbindung im Mesh. */
export type PeerStatus =
  | 'new'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed'
  | 'closed'

/**
 * Fehler werden als Code durchgereicht, nicht als Text: Transport und
 * Geräteschicht kennen keine Anzeigesprache. Übersetzt wird erst in der
 * Oberfläche.
 */
export type MicErrorCode =
  | 'denied'
  | 'notFound'
  | 'insecureContext'
  | 'trackEnded'
  | 'unknown'

export type SignalingErrorCode =
  | 'channelFull'
  | 'invalidChannel'
  | 'rejected'
  | 'unreachable'

export type MicState =
  | 'idle'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'unavailable'

export interface Participant {
  peerId: PeerId
  name: string
  joinedAt: number
  isSelf: boolean
  status: PeerStatus
  talking: boolean
  /** Lokal stummgeschaltet — betrifft nur die eigene Wiedergabe. */
  muted: boolean
  /** Fremd-Audio, das an ein <audio>-Element gehängt wird. */
  stream: MediaStream | null
}

export interface SessionSnapshot {
  code: string
  selfId: PeerId
  selfName: string
  signaling: SignalingStatus
  signalingError: SignalingErrorCode | null
  mic: MicState
  micError: MicErrorCode | null
  selfTalking: boolean
  participants: Participant[]
  /** Tonausgabe wurde vom Browser blockiert — braucht eine Nutzergeste. */
  playbackBlocked: boolean
}
