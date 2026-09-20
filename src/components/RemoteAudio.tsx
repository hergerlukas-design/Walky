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

  // Live-Sprachfunk: es gibt nichts zu untertiteln, das Element ist reine
  // Wiedergabe ohne sichtbare Steuerung.
  return <audio ref={ref} autoPlay playsInline className="hidden" />
}
