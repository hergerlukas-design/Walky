import {
  HEARTBEAT_INTERVAL_MS,
  WS_PATH_PREFIX,
  type ClientMessage,
  type IceCandidate,
  type PeerId,
  type PeerInfo,
  type ServerMessage,
  type SessionDescription,
} from '../../shared/protocol'
import { getSignalingBaseUrl } from './env'
import type { SignalingStatus } from '../types'

const RECONNECT_BASE_MS = 500
const RECONNECT_MAX_MS = 15_000
/** Kommt nach dem Beitritt kein `welcome`, ist die Verbindung tot. */
const WELCOME_TIMEOUT_MS = 10_000

export interface SignalingHandlers {
  /** Vollständige Teilnehmerliste ohne den eigenen Peer. */
  onPeers(peers: PeerInfo[]): void
  onDescription(from: PeerId, description: SessionDescription): void
  onCandidate(from: PeerId, candidate: IceCandidate): void
  onTalk(from: PeerId, talking: boolean): void
  onStatus(status: SignalingStatus, error?: string): void
  /** Der Server hat die Verbindung endgültig abgelehnt (z. B. Kanal voll). */
  onFatal(message: string): void
}

export interface SignalingOptions {
  code: string
  peerId: PeerId
  name: string
  handlers: SignalingHandlers
}

/**
 * WebSocket-Client zum eigenen Signaling-Server.
 *
 * Kanal und Peer stehen in der URL, der Beitritt passiert also mit dem
 * Verbindungsaufbau. Die Teilnehmerliste wird lokal aus `welcome`,
 * `peer-join` und `peer-leave` fortgeschrieben und als Ganzes nach oben
 * gereicht — die Mesh-Logik bekommt so immer ein vollständiges Bild und muss
 * keine Deltas verarbeiten.
 */
export class Signaling {
  private readonly url: string
  private readonly handlers: SignalingHandlers
  private readonly selfId: PeerId

  private socket: WebSocket | null = null
  private peers = new Map<PeerId, PeerInfo>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private welcomeTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private reconnectAttempt = 0
  private stopped = false

  constructor({ code, peerId, name, handlers }: SignalingOptions) {
    const query = new URLSearchParams({ peer: peerId, name })
    this.url = `${getSignalingBaseUrl()}${WS_PATH_PREFIX}${code}?${query.toString()}`
    this.selfId = peerId
    this.handlers = handlers
  }

  start(): void {
    this.stopped = false
    this.connect()
  }

  private connect(): void {
    if (this.stopped) return

    this.closeSocket()
    this.handlers.onStatus(this.reconnectAttempt === 0 ? 'connecting' : 'reconnecting')

    let socket: WebSocket
    try {
      socket = new WebSocket(this.url)
    } catch (error) {
      this.handlers.onStatus(
        'error',
        error instanceof Error ? error.message : 'Verbindung nicht möglich.',
      )
      this.scheduleReconnect()
      return
    }

    this.socket = socket

    this.welcomeTimer = setTimeout(() => {
      console.warn('[walky] Kein welcome vom Signaling-Server — neuer Versuch')
      socket.close()
    }, WELCOME_TIMEOUT_MS)

    socket.onopen = () => {
      // Der eigentliche "verbunden"-Zustand ist erst mit `welcome` erreicht.
      this.startHeartbeat()
    }

    socket.onmessage = (event) => {
      this.handleMessage(event.data)
    }

    socket.onerror = () => {
      // Details liefert der Browser aus Sicherheitsgründen nicht; das
      // anschließende close-Event übernimmt die Wiederverbindung.
      this.handlers.onStatus('reconnecting', 'Verbindung zum Signaling-Server gestört.')
    }

    socket.onclose = (event) => {
      this.stopHeartbeat()
      this.clearWelcomeTimer()
      if (this.socket === socket) this.socket = null
      if (this.stopped) return

      // 1008 = Policy Violation: der Server hat uns bewusst abgewiesen,
      // ein erneuter Versuch würde genauso enden.
      if (event.code === 1008) {
        this.handlers.onFatal(this.fatalMessage(event.reason))
        return
      }

      this.peers.clear()
      this.handlers.onPeers([])
      this.scheduleReconnect()
    }
  }

  private fatalMessage(reason: string): string {
    switch (reason) {
      case 'channel_full':
        return 'Der Kanal ist voll. Für größere Gruppen braucht es einen Media-Server (SFU).'
      case 'invalid_channel':
        return 'Ungültiger Kanal-Code.'
      default:
        return 'Der Signaling-Server hat die Verbindung abgelehnt.'
    }
  }

  private handleMessage(raw: unknown): void {
    if (typeof raw !== 'string') return

    let message: ServerMessage
    try {
      message = JSON.parse(raw) as ServerMessage
    } catch {
      console.warn('[walky] Unlesbare Nachricht vom Server verworfen')
      return
    }

    switch (message.type) {
      case 'welcome': {
        this.clearWelcomeTimer()
        this.reconnectAttempt = 0
        this.peers = new Map(message.peers.map((peer) => [peer.peerId, peer]))
        this.handlers.onStatus('connected')
        this.emitPeers()
        break
      }
      case 'peer-join':
        this.peers.set(message.peer.peerId, message.peer)
        this.emitPeers()
        break
      case 'peer-leave':
        if (this.peers.delete(message.peerId)) this.emitPeers()
        break
      case 'signal':
        if (message.from === this.selfId) break
        if (message.kind === 'description') {
          this.handlers.onDescription(message.from, message.description)
        } else {
          this.handlers.onCandidate(message.from, message.candidate)
        }
        break
      case 'talk':
        this.handlers.onTalk(message.from, message.talking)
        break
      case 'error':
        console.warn('[walky] Serverfehler:', message.code, message.message)
        if (message.code === 'channel_full') this.handlers.onFatal(message.message)
        break
      case 'pong':
        break
    }
  }

  private emitPeers(): void {
    const peers = [...this.peers.values()]
      .filter((peer) => peer.peerId !== this.selfId)
      .sort((a, b) => a.joinedAt - b.joinedAt || a.peerId.localeCompare(b.peerId))
    this.handlers.onPeers(peers)
  }

  private send(message: ClientMessage): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return
    this.socket.send(JSON.stringify(message))
  }

  sendDescription(to: PeerId, description: SessionDescription): void {
    this.send({ type: 'signal', to, kind: 'description', description })
  }

  sendCandidate(to: PeerId, candidate: IceCandidate): void {
    this.send({ type: 'signal', to, kind: 'candidate', candidate })
  }

  sendTalk(talking: boolean): void {
    this.send({ type: 'talk', talking })
  }

  /**
   * Der Server pingt von sich aus; dieser Gegen-Ping hält zusätzlich
   * Zwischenproxys wach, die stille Verbindungen nach ~60 s kappen.
   */
  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'ping' })
    }, HEARTBEAT_INTERVAL_MS)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private clearWelcomeTimer(): void {
    if (this.welcomeTimer) {
      clearTimeout(this.welcomeTimer)
      this.welcomeTimer = null
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return

    this.handlers.onStatus('reconnecting')
    // Voller Jitter, damit nach einem Serverneustart nicht alle Clients
    // gleichzeitig anklopfen.
    const ceiling = Math.min(RECONNECT_BASE_MS * 2 ** this.reconnectAttempt, RECONNECT_MAX_MS)
    const delay = RECONNECT_BASE_MS + Math.random() * (ceiling - RECONNECT_BASE_MS)
    this.reconnectAttempt += 1

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delay)
  }

  /** Nach Netzwechsel oder Rückkehr aus dem Hintergrund sofort neu verbinden. */
  refresh(): void {
    if (this.stopped) return
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.send({ type: 'ping' })
      return
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.reconnectAttempt = 0
    this.connect()
  }

  private closeSocket(): void {
    const socket = this.socket
    if (!socket) return
    this.socket = null
    socket.onopen = null
    socket.onmessage = null
    socket.onerror = null
    socket.onclose = null
    try {
      socket.close()
    } catch {
      /* bereits geschlossen */
    }
  }

  stop(): void {
    this.stopped = true
    this.stopHeartbeat()
    this.clearWelcomeTimer()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.closeSocket()
    this.peers.clear()
    this.handlers.onStatus('idle')
  }
}
