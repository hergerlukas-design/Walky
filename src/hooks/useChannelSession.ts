import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ChannelSession } from '../lib/channelSession'
import { createPeerId } from '../lib/ids'
import type { SessionSnapshot } from '../types'

export interface ChannelSessionApi {
  snapshot: SessionSnapshot
  setTalking(talking: boolean): void
  setMuted(peerId: string, muted: boolean): void
  retryMicrophone(): void
  setPlaybackBlocked(blocked: boolean): void
}

/**
 * Hängt eine `ChannelSession` an den Komponentenbaum. Die Sitzung selbst ist
 * bewusst kein React-State: sie wird einmal erzeugt, meldet Änderungen über
 * `useSyncExternalStore` und wird beim Verlassen abgeräumt.
 */
export function useChannelSession(code: string, displayName: string): ChannelSessionApi {
  const [session, setSession] = useState<ChannelSession | null>(null)
  // Ohne Ref würde ein Namenswechsel während der Sitzung einen Neuaufbau
  // auslösen; der Name wird nur beim Beitritt gebraucht.
  const nameRef = useRef(displayName)
  useEffect(() => {
    nameRef.current = displayName
  }, [displayName])

  useEffect(() => {
    const instance = new ChannelSession({
      code,
      selfId: createPeerId(),
      displayName: nameRef.current,
    })
    setSession(instance)
    void instance.start()

    const onOnline = () => instance.refresh()
    const onVisible = () => {
      if (document.visibilityState === 'visible') instance.refresh()
    }

    // Netzwechsel (WLAN <-> Mobilfunk) und Rückkehr aus dem Hintergrund sind
    // die beiden Fälle, in denen Verbindungen still gestorben sein können.
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
      instance.stop()
      setSession(null)
    }
  }, [code])

  const snapshot = useSyncExternalStore(
    session ? session.subscribe : emptySubscribe,
    session ? session.getSnapshot : () => placeholderSnapshot(code),
  )

  const setTalking = useCallback(
    (talking: boolean) => {
      void session?.setTalking(talking)
    },
    [session],
  )

  const setMuted = useCallback(
    (peerId: string, muted: boolean) => session?.setMuted(peerId, muted),
    [session],
  )

  const retryMicrophone = useCallback(() => {
    void session?.retryMicrophone()
  }, [session])

  const setPlaybackBlocked = useCallback(
    (blocked: boolean) => session?.setPlaybackBlocked(blocked),
    [session],
  )

  return { snapshot, setTalking, setMuted, retryMicrophone, setPlaybackBlocked }
}

const emptySubscribe = () => () => {}

const snapshotCache = new Map<string, SessionSnapshot>()

/** Stabile Referenz, solange die Sitzung noch nicht existiert. */
function placeholderSnapshot(code: string): SessionSnapshot {
  const cached = snapshotCache.get(code)
  if (cached) return cached

  const snapshot: SessionSnapshot = {
    code,
    selfId: '',
    selfName: '',
    signaling: 'connecting',
    signalingError: null,
    mic: 'idle',
    micError: null,
    selfTalking: false,
    participants: [],
    playbackBlocked: false,
  }
  snapshotCache.set(code, snapshot)
  return snapshot
}
