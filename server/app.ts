import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { Server } from 'node:http'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Duplex } from 'node:stream'
import sirv from 'sirv'
import { WebSocketServer, type WebSocket } from 'ws'
import {
  HEARTBEAT_INTERVAL_MS,
  MAX_MESSAGE_BYTES,
  WS_PATH_PREFIX,
  isClientMessage,
  type ServerErrorCode,
  type ServerMessage,
} from '../shared/protocol.js'
import { isValidChannelCode, normalizeChannelCode } from '../shared/channelCode.js'
import { ChannelRegistry, type Connection } from './channels.js'

export interface WalkyServerOptions {
  /** Verzeichnis mit dem Vite-Build. Fehlt es, läuft nur das Signaling. */
  clientDir?: string
  heartbeatIntervalMs?: number
}

export interface WalkyServer {
  httpServer: Server
  registry: ChannelRegistry
  /** false = es wird nur signalisiert, ohne die PWA auszuliefern. */
  hasClientBuild: boolean
  listen(port: number, host: string): Promise<number>
  close(): Promise<void>
}

interface JoinRequest {
  code: string
  peerId: string
  name: string
}

interface SocketState {
  code: string
  peerId: string
  alive: boolean
}

/**
 * Kanal und Peer stecken in der URL: `/ws/kanal/<code>?peer=<id>&name=<name>`.
 * Der Beitritt ist damit mit dem Verbindungsaufbau erledigt — es braucht
 * keinen zusätzlichen Handshake.
 */
export function parseJoinRequest(url: string): JoinRequest | null {
  let parsed: URL
  try {
    parsed = new URL(url, 'http://localhost')
  } catch {
    return null
  }

  if (!parsed.pathname.startsWith(WS_PATH_PREFIX)) return null

  const code = normalizeChannelCode(decodeURIComponent(parsed.pathname.slice(WS_PATH_PREFIX.length)))
  const peerId = (parsed.searchParams.get('peer') ?? '').slice(0, 64)
  const name = (parsed.searchParams.get('name') ?? '').trim().slice(0, 32)

  if (!isValidChannelCode(code)) return null
  if (!/^[A-Za-z0-9-]{8,64}$/.test(peerId)) return null

  return { code, peerId, name: name || 'Unbekannt' }
}

/**
 * Derselbe Prozess liefert die gebaute PWA aus und nimmt die WebSockets an.
 * Damit teilen Frontend und Signaling sich einen Origin: keine CORS-Regeln,
 * kein zweites Deployment, und die App findet ihren Server ohne Konfiguration.
 */
export function createWalkyServer(options: WalkyServerOptions = {}): WalkyServer {
  const { clientDir, heartbeatIntervalMs = HEARTBEAT_INTERVAL_MS } = options
  const registry = new ChannelRegistry()
  const hasClientBuild = Boolean(clientDir && existsSync(resolve(clientDir, 'index.html')))

  const serveStatic =
    hasClientBuild && clientDir
      ? sirv(clientDir, {
          etag: true,
          gzip: true,
          brotli: true,
          // Alles mit Hash im Namen ist unveränderlich; index.html und der
          // Service Worker müssen dagegen immer frisch geholt werden.
          setHeaders(res, pathname) {
            if (pathname.startsWith('/assets/')) {
              res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
            } else if (pathname.endsWith('.html') || pathname.endsWith('sw.js')) {
              res.setHeader('Cache-Control', 'no-cache')
            }
          },
          // /kanal/abc123 ist eine Client-Route und bekommt die App-Shell.
          single: true,
        })
      : null

  const httpServer = createHttpServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.url === '/healthz') {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      })
      res.end(JSON.stringify({ status: 'ok', ...registry.stats() }))
      return
    }

    if (serveStatic) {
      serveStatic(req, res, () => {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end('Nicht gefunden')
      })
      return
    }

    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Walky Signaling-Server läuft. Kein Client-Build vorhanden.')
  })

  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES })
  const sockets = new Map<WebSocket, SocketState>()

  const send = (socket: WebSocket, message: ServerMessage): void => {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(message))
    }
  }

  const fail = (socket: WebSocket, code: ServerErrorCode, message: string): void => {
    send(socket, { type: 'error', code, message })
    socket.close(1008, code)
  }

  httpServer.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const join = req.url ? parseJoinRequest(req.url) : null

    if (!join) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n')
      socket.destroy()
      return
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, join)
    })
  })

  wss.on('connection', (socket: WebSocket, _req: IncomingMessage, join: JoinRequest) => {
    const { code, peerId, name } = join
    const joinedAt = Date.now()

    const connection: Connection = {
      peerId,
      name,
      joinedAt,
      send: (message) => send(socket, message),
      close: () => socket.close(1000, 'replaced'),
    }

    const result = registry.join(code, connection)
    if (!result.ok) {
      fail(socket, 'channel_full', 'Dieser Kanal ist voll.')
      return
    }

    sockets.set(socket, { code, peerId, alive: true })
    send(socket, { type: 'welcome', self: { peerId, name, joinedAt }, peers: result.peers })

    socket.on('message', (raw) => {
      let parsed: unknown
      try {
        parsed = JSON.parse(raw.toString())
      } catch {
        send(socket, {
          type: 'error',
          code: 'bad_message',
          message: 'Nachricht war kein gültiges JSON.',
        })
        return
      }

      if (!isClientMessage(parsed)) {
        send(socket, {
          type: 'error',
          code: 'bad_message',
          message: 'Unbekanntes Nachrichtenformat.',
        })
        return
      }

      switch (parsed.type) {
        case 'signal':
          // Der Server prüft nur die Zustellbarkeit; den Inhalt reicht er
          // unverändert durch.
          registry.relay(
            code,
            parsed.to,
            parsed.kind === 'description'
              ? {
                  type: 'signal',
                  from: peerId,
                  kind: 'description',
                  description: parsed.description,
                }
              : { type: 'signal', from: peerId, kind: 'candidate', candidate: parsed.candidate },
          )
          break
        case 'talk':
          registry.broadcast(code, { type: 'talk', from: peerId, talking: parsed.talking }, peerId)
          break
        case 'ping':
          send(socket, { type: 'pong' })
          break
      }
    })

    socket.on('pong', () => {
      const state = sockets.get(socket)
      if (state) state.alive = true
    })

    socket.on('close', () => {
      sockets.delete(socket)
      registry.leave(code, peerId)
    })

    socket.on('error', () => socket.terminate())
  })

  /**
   * Mobilfunk- und Proxy-Verbindungen sterben oft still. Ohne Heartbeat blieben
   * Karteileichen im Kanal stehen und die Teilnehmerliste stimmte nicht mehr.
   */
  const heartbeat = setInterval(() => {
    for (const [socket, state] of sockets) {
      if (!state.alive) {
        socket.terminate()
        continue
      }
      state.alive = false
      try {
        socket.ping()
      } catch {
        socket.terminate()
      }
    }
  }, heartbeatIntervalMs)

  heartbeat.unref?.()

  return {
    httpServer,
    registry,
    hasClientBuild,
    listen: (port, host) =>
      new Promise<number>((resolvePort, reject) => {
        httpServer.once('error', reject)
        httpServer.listen(port, host, () => {
          httpServer.off('error', reject)
          const address = httpServer.address()
          resolvePort(typeof address === 'object' && address ? address.port : port)
        })
      }),
    close: () =>
      new Promise<void>((done) => {
        clearInterval(heartbeat)
        for (const socket of sockets.keys()) socket.close(1001, 'server shutdown')
        sockets.clear()
        wss.close(() => {
          httpServer.close(() => done())
        })
      }),
  }
}
