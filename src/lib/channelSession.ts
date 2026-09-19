import { Mesh } from './mesh'
import { MicrophoneError, requestMicrophone } from './microphone'
import { Signaling } from './signaling'
import { getIceServers } from './env'
import type { PeerInfo } from '../../shared/protocol'
import type {
  MicState,
  Participant,
  PeerId,
  PeerStatus,
  SessionSnapshot,
  SignalingStatus,
} from '../types'

/** Notbremse, falls ein Knopfdruck hängen bleibt (Anruf, App-Wechsel). */
const MAX_TALK_MS = 60_000

/** Sprecher-Anzeige zurücksetzen, falls das "Ende"-Signal verloren geht. */
const REMOTE_TALK_TIMEOUT_MS = 65_000

export interface ChannelSessionOptions {
  code: string
  selfId: PeerId
  displayName: string
}

interface PeerRecord {
  info: PeerInfo
  status: PeerStatus
  stream: MediaStream | null
  talking: boolean
  muted: boolean
  talkTimer: ReturnType<typeof setTimeout> | null
}

/**
 * Bindet Signaling, Mesh und Mikrofon zu einer Kanal-Sitzung zusammen und
 * stellt der UI einen unveränderlichen Schnappschuss bereit. Die gesamte
 * Verbindungslogik lebt hier und nicht in React-Effekten — das übersteht
 * Re-Renders, doppelte Effekt-Aufrufe im Strict Mode und Netzwechsel.
 */
export class ChannelSession {
  private readonly signaling: Signaling
  private readonly mesh: Mesh
  private readonly code: string
  private readonly selfId: PeerId
  private readonly selfName: string
  private readonly joinedAt = Date.now()

  private readonly peers = new Map<PeerId, PeerRecord>()
  private readonly listeners = new Set<() => void>()
  /** Ein Angebot kann vor der Teilnehmerliste eintreffen — Stream parken. */
  private readonly pendingStreams = new Map<PeerId, MediaStream>()

  private localStream: MediaStream | null = null
  private micState: MicState = 'idle'
  private micError: string | null = null
  private signalingStatus: SignalingStatus = 'idle'
  private signalingError: string | null = null
  private selfTalking = false
  private playbackBlocked = false
  private talkGuard: ReturnType<typeof setTimeout> | null = null
  private stopped = false
  private snapshot: SessionSnapshot

  constructor({ code, selfId, displayName }: ChannelSessionOptions) {
    this.code = code
    this.selfId = selfId
    this.selfName = displayName

    this.mesh = new Mesh({
      selfId,
      iceServers: getIceServers(),
      callbacks: {
        sendDescription: (to, description) => this.signaling.sendDescription(to, description),
        sendCandidate: (to, candidate) => this.signaling.sendCandidate(to, candidate),
        onStream: (peerId, stream) => {
          const record = this.peers.get(peerId)
          if (!record) {
            this.pendingStreams.set(peerId, stream)
            return
          }
          record.stream = stream
          this.publish()
        },
        onStatus: (peerId, status) => {
          const record = this.peers.get(peerId)
          if (!record) return
          record.status = status
          if (status === 'closed' || status === 'failed') {
            this.setRemoteTalking(peerId, false)
          }
          this.publish()
        },
      },
    })

    this.signaling = new Signaling({
      code,
      peerId: selfId,
      name: displayName,
      handlers: {
        onPeers: (peers) => this.handlePeers(peers),
        onDescription: (from, description) => {
          void this.mesh.handleDescription(from, description)
        },
        onCandidate: (from, candidate) => {
          void this.mesh.handleCandidate(from, candidate)
        },
        onTalk: (from, talking) => this.setRemoteTalking(from, talking),
        onStatus: (status, error) => {
          this.signalingStatus = status
          this.signalingError = error ?? (status === 'connected' ? null : this.signalingError)
          if (status === 'connected') this.signalingError = null
          this.publish()
        },
        onFatal: (message) => {
          this.signalingStatus = 'error'
          this.signalingError = message
          this.mesh.close()
          this.peers.clear()
          this.publish()
        },
      },
    })

    this.snapshot = this.buildSnapshot()
  }

  // ---------------------------------------------------------------- Lifecycle

  /**
   * Muss aus einer Nutzergeste heraus laufen: erst Mikrofon (iOS zeigt den
   * Dialog sonst nicht zuverlässig), dann Signaling. Ohne Mikrofon wird
   * trotzdem beigetreten — dann eben im Nur-Hören-Modus.
   */
  async start(): Promise<void> {
    if (this.stopped) return
    await this.acquireMicrophone()
    if (this.stopped) return
    this.signaling.start()
  }

  private async acquireMicrophone(): Promise<boolean> {
    if (this.localStream) return true

    this.micState = 'requesting'
    this.micError = null
    this.publish()

    try {
      const stream = await requestMicrophone()

      if (this.stopped) {
        stream.getTracks().forEach((track) => track.stop())
        return false
      }

      const track = stream.getAudioTracks()[0] ?? null
      if (track) {
        // Standardmäßig stumm: übertragen wird erst bei gedrücktem Knopf.
        track.enabled = false
        track.onended = () => {
          this.localStream = null
          this.mesh.setLocalStream(null)
          this.micState = 'unavailable'
          this.micError = 'Die Mikrofon-Verbindung wurde unterbrochen.'
          this.publish()
        }
      }

      this.localStream = stream
      this.micState = 'granted'
      this.mesh.setLocalStream(stream)
      this.publish()
      return true
    } catch (error) {
      const reason = error instanceof MicrophoneError ? error.reason : 'unavailable'
      this.micState = reason === 'denied' ? 'denied' : 'unavailable'
      this.micError = error instanceof Error ? error.message : 'Mikrofon nicht verfügbar.'
      this.publish()
      return false
    }
  }

  /** Zweiter Anlauf, nachdem die Berechtigung nachträglich erteilt wurde. */
  async retryMicrophone(): Promise<void> {
    await this.acquireMicrophone()
  }

  stop(): void {
    if (this.stopped) return
    this.stopped = true

    this.clearTalkGuard()
    if (this.selfTalking) this.signaling.sendTalk(false)
    this.signaling.stop()
    this.mesh.close()

    for (const record of this.peers.values()) {
      if (record.talkTimer) clearTimeout(record.talkTimer)
    }
    this.peers.clear()
    this.pendingStreams.clear()

    this.localStream?.getTracks().forEach((track) => {
      track.onended = null
      track.stop()
    })
    this.localStream = null
    this.selfTalking = false
    this.publish()
  }

  // ------------------------------------------------------------ Push-to-Talk

  async setTalking(talking: boolean): Promise<void> {
    if (this.stopped) return

    if (talking) {
      if (!this.localStream) {
        const granted = await this.acquireMicrophone()
        if (!granted) return
      }
      if (this.selfTalking) return

      this.selfTalking = true
      this.setLocalTrackEnabled(true)
      this.signaling.sendTalk(true)
      this.clearTalkGuard()
      this.talkGuard = setTimeout(() => void this.setTalking(false), MAX_TALK_MS)
    } else {
      if (!this.selfTalking) return
      this.selfTalking = false
      this.setLocalTrackEnabled(false)
      this.signaling.sendTalk(false)
      this.clearTalkGuard()
    }

    this.publish()
  }

  private setLocalTrackEnabled(enabled: boolean): void {
    this.localStream?.getAudioTracks().forEach((track) => {
      track.enabled = enabled
    })
  }

  private clearTalkGuard(): void {
    if (this.talkGuard) {
      clearTimeout(this.talkGuard)
      this.talkGuard = null
    }
  }

  // ------------------------------------------------------------------- State

  private handlePeers(peers: PeerInfo[]): void {
    const seen = new Set<PeerId>()

    for (const info of peers) {
      if (info.peerId === this.selfId) continue
      seen.add(info.peerId)

      const existing = this.peers.get(info.peerId)
      if (existing) {
        existing.info = info
      } else {
        this.peers.set(info.peerId, {
          info,
          status: this.mesh.getStatus(info.peerId),
          stream: this.pendingStreams.get(info.peerId) ?? null,
          talking: false,
          muted: false,
          talkTimer: null,
        })
        this.pendingStreams.delete(info.peerId)
      }
    }

    for (const [peerId, record] of this.peers) {
      if (!seen.has(peerId)) {
        if (record.talkTimer) clearTimeout(record.talkTimer)
        this.peers.delete(peerId)
        this.pendingStreams.delete(peerId)
      }
    }

    this.mesh.sync([...seen])
    this.publish()
  }

  private setRemoteTalking(peerId: PeerId, talking: boolean): void {
    const record = this.peers.get(peerId)
    if (!record) return

    record.talking = talking
    if (record.talkTimer) {
      clearTimeout(record.talkTimer)
      record.talkTimer = null
    }
    if (talking) {
      record.talkTimer = setTimeout(() => {
        record.talking = false
        record.talkTimer = null
        this.publish()
      }, REMOTE_TALK_TIMEOUT_MS)
    }
    this.publish()
  }

  setMuted(peerId: PeerId, muted: boolean): void {
    const record = this.peers.get(peerId)
    if (!record) return
    record.muted = muted
    this.publish()
  }

  setPlaybackBlocked(blocked: boolean): void {
    if (this.playbackBlocked === blocked) return
    this.playbackBlocked = blocked
    this.publish()
  }

  /** Nach Netzwechsel oder Rückkehr in den Vordergrund aufräumen. */
  refresh(): void {
    if (this.stopped) return
    this.mesh.resetFailed()
    this.signaling.refresh()
  }

  // ------------------------------------------------------- Snapshot-Anbindung

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = (): SessionSnapshot => this.snapshot

  private buildSnapshot(): SessionSnapshot {
    const self: Participant = {
      peerId: this.selfId,
      name: this.selfName,
      joinedAt: this.joinedAt,
      isSelf: true,
      status: this.signalingStatus === 'connected' ? 'connected' : 'connecting',
      talking: this.selfTalking,
      muted: false,
      stream: null,
    }

    const others: Participant[] = [...this.peers.values()]
      .map((record) => ({
        peerId: record.info.peerId,
        name: record.info.name,
        joinedAt: record.info.joinedAt,
        isSelf: false,
        status: record.status,
        talking: record.talking,
        muted: record.muted,
        stream: record.stream,
      }))
      .sort((a, b) => a.joinedAt - b.joinedAt || a.peerId.localeCompare(b.peerId))

    return {
      code: this.code,
      selfId: this.selfId,
      selfName: this.selfName,
      signaling: this.signalingStatus,
      signalingError: this.signalingError,
      mic: this.micState,
      micError: this.micError,
      selfTalking: this.selfTalking,
      participants: [self, ...others],
      playbackBlocked: this.playbackBlocked,
    }
  }

  private publish(): void {
    this.snapshot = this.buildSnapshot()
    for (const listener of this.listeners) {
      listener()
    }
  }
}
