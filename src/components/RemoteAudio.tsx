import { useEffect, useRef } from 'react'

interface RemoteAudioProps {
  stream: MediaStream
  muted: boolean
  /** Hochzählen, um die Wiedergabe nach einer Nutzergeste erneut zu starten. */
  retryToken: number
  onBlocked(blocked: boolean): void
}

/**
 * Ein Audio-Element je Gegenstelle. Safari startet die Wiedergabe nur nach
 * einer Nutzergeste — schlägt `play()` fehl, meldet die Komponente das nach
 * oben, damit die UI eine Schaltfläche zum Freigeben anbieten kann.
 */
export function RemoteAudio({ stream, muted, retryToken, onBlocked }: RemoteAudioProps) {
  const ref = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    element.srcObject = stream
    let cancelled = false

    element
      .play()
      .then(() => {
        if (!cancelled) onBlocked(false)
      })
      .catch(() => {
        if (!cancelled) onBlocked(true)
      })

    return () => {
      cancelled = true
      element.srcObject = null
    }
  }, [onBlocked, retryToken, stream])

  useEffect(() => {
    if (ref.current) ref.current.muted = muted
  }, [muted])

  // Ohne `controls` stellt ein Audio-Element ohnehin nichts dar — es braucht
  // kein display:none. Umgekehrt ist das sogar schädlich: Safari auf iOS
  // verweigert ausgeblendeten Medienelementen die Wiedergabe.
  // Live-Sprachfunk, deshalb auch keine Untertitelspur.
  return <audio ref={ref} autoPlay playsInline />
}
