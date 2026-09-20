import { useEffect } from 'react'

export interface MediaSessionOptions {
  /** Titelzeile auf dem Sperrbildschirm, üblicherweise der Kanal. */
  title: string
  /** Zweite Zeile: wer gerade spricht oder der Ruhezustand. */
  artist: string
  album: string
  /** Sperrbildschirm-Taste: pausieren schaltet den Kanal stumm. */
  muted: boolean
  onMutedChange(muted: boolean): void
}

/**
 * Meldet die laufende Verbindung als Medienwiedergabe an.
 *
 * Das ist nicht bloß Kosmetik: Android behandelt eine Seite mit aktiver
 * Medien-Sitzung deutlich schonender, wenn sie in den Hintergrund gerät, und
 * man sieht auf dem Sperrbildschirm, dass der Kanal noch offen ist — samt
 * Taste, um ihn stummzuschalten, ohne das Gerät zu entsperren.
 *
 * Voraussetzung ist eine tatsächlich laufende Wiedergabe; die liefert die
 * stille Endlosschleife in `KeepAliveAudio`.
 */
export function useMediaSession({
  title,
  artist,
  album,
  muted,
  onMutedChange,
}: MediaSessionOptions): void {
  useEffect(() => {
    if (!('mediaSession' in navigator)) return

    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist,
      album,
      artwork: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    })
  }, [album, artist, title])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return

    // "Pausiert" heißt hier stummgeschaltet — die Verbindung bleibt stehen,
    // sonst verschwände der Eintrag und man käme nicht mehr zurück.
    navigator.mediaSession.playbackState = muted ? 'paused' : 'playing'

    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => onMutedChange(false)],
      ['pause', () => onMutedChange(true)],
      ['stop', () => onMutedChange(true)],
    ]

    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler)
      } catch {
        // Nicht jede Plattform kennt jede Aktion.
      }
    }

    return () => {
      for (const [action] of handlers) {
        try {
          navigator.mediaSession.setActionHandler(action, null)
        } catch {
          /* siehe oben */
        }
      }
    }
  }, [muted, onMutedChange])

  useEffect(() => {
    return () => {
      if (!('mediaSession' in navigator)) return
      navigator.mediaSession.metadata = null
      navigator.mediaSession.playbackState = 'none'
    }
  }, [])
}
