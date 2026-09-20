import { useEffect } from 'react'

export interface MediaSessionOptions {
  /** Titelzeile auf dem Sperrbildschirm, üblicherweise der Kanal. */
  title: string
  /** Zweite Zeile: wer spricht, oder die Aufforderung zum Senden. */
  artist: string
  album: string
  /** Läuft gerade eine eigene Übertragung? */
  talking: boolean
  onTalkingChange(talking: boolean): void
  /** Hält die stille Schleife am Laufen, falls eine Taste sie pausiert hat. */
  ensurePlaying(): void
}

/**
 * Meldet die laufende Verbindung als Medienwiedergabe an — und macht die
 * Medientasten zur Sprechtaste.
 *
 * Android behandelt eine Seite mit aktiver Medien-Sitzung im Hintergrund
 * schonender, und man sieht auf dem Sperrbildschirm, dass der Kanal offen
 * ist. Der eigentliche Gewinn hängt aber an der Play/Pause-Taste: Sie liegt
 * nicht nur auf dem Sperrbildschirm, sondern auch auf dem Knopf von
 * Kopfhörern und Headsets. Damit lässt sich funken, ohne das Telefon
 * anzufassen.
 *
 * Halten geht dabei nicht — ein Knopf in einer Benachrichtigung kennt kein
 * Gedrückthalten. Es ist deshalb ein Umschalter, wie der Freihändig-Modus in
 * der App. Gegen die vergessene offene Leitung greift dieselbe
 * Sicherheitsabschaltung nach 60 Sekunden.
 *
 * Voraussetzung ist eine tatsächlich laufende Wiedergabe; die liefert die
 * stille Endlosschleife in `KeepAliveAudio`.
 */
export function useMediaSession({
  title,
  artist,
  album,
  talking,
  onTalkingChange,
  ensurePlaying,
}: MediaSessionOptions): void {
  useEffect(() => {
    if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return

    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist,
      album,
      artwork: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    })

    // Ohne Positionsangabe zeichnet Android keinen Fortschrittsbalken. Der
    // gehörte zu einem Musikstück, nicht zu einem offenen Funkkanal — und er
    // lud dazu ein, in einer Datei zu spulen, die niemand hören soll.
    try {
      navigator.mediaSession.setPositionState?.()
    } catch {
      /* nicht überall vorhanden */
    }
  }, [album, artist, title])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    const session = navigator.mediaSession

    // Durchgehend "playing", solange man im Kanal ist. Ein pausierter
    // Zustand riskiert, dass Android die Benachrichtigung einklappt oder
    // verwirft — und dann käme man über den Sperrbildschirm gar nicht mehr
    // ans Senden. Welchen Zustand die Übertragung hat, steht im Text.
    session.playbackState = 'playing'

    // Chrome kennt seit Fassung 91 eigene Konferenz-Aktionen. Wo sie
    // dargestellt werden, ist das der passendere Knopf; wo nicht, bleibt
    // Play/Pause — das kommt auch vom Kopfhörerknopf.
    const setMicrophoneActive = (
      session as MediaSession & { setMicrophoneActive?: (active: boolean) => void }
    ).setMicrophoneActive?.bind(session)
    setMicrophoneActive?.(talking)

    // Ein Knopf, zwei Zustände: Beide Tasten schalten um. Welches Symbol die
    // Plattform gerade zeichnet, ist damit gleichgültig — es tut immer das
    // Erwartete. Nur "stop" beendet ausdrücklich.
    const toggle = () => {
      onTalkingChange(!talking)
      // Android pausiert bei "pause" mitunter auch das Element selbst. Ohne
      // laufende Wiedergabe verschwindet die Benachrichtigung — und mit ihr
      // die einzige Möglichkeit, die Übertragung wieder zu beenden.
      ensurePlaying()
    }

    const handlers: [string, MediaSessionActionHandler][] = [
      ['play', toggle],
      ['pause', toggle],
      ['stop', () => {
        onTalkingChange(false)
        ensurePlaying()
      }],
      ['togglemicrophone', toggle],
    ]

    for (const [action, handler] of handlers) {
      try {
        session.setActionHandler(action as MediaSessionAction, handler)
      } catch {
        // Nicht jede Plattform kennt jede Aktion — togglemicrophone etwa
        // gibt es nur in Chrome.
      }
    }

    return () => {
      for (const [action] of handlers) {
        try {
          session.setActionHandler(action as MediaSessionAction, null)
        } catch {
          /* siehe oben */
        }
      }
    }
  }, [ensurePlaying, onTalkingChange, talking])

  useEffect(() => {
    return () => {
      if (!('mediaSession' in navigator)) return
      navigator.mediaSession.metadata = null
      navigator.mediaSession.playbackState = 'none'
    }
  }, [])
}
