import { useEffect, useRef } from 'react'

/**
 * Stille Endlosschleife, die läuft, solange man im Kanal ist.
 *
 * Zwei Gründe: Chrome blendet den Medieneintrag auf dem Sperrbildschirm nur
 * bei tatsächlich laufender Wiedergabe ein, und eine Seite, die Ton ausgibt
 * oder aufnimmt, wird im Hintergrund nicht eingefroren. Ohne sie wäre beides
 * erst ab dem Moment gegeben, in dem die erste Gegenstelle verbunden ist.
 *
 * Die Länge der Datei ist kein Zufall: Chrome auf Android fordert den
 * Audio-Fokus erst ab fünf Sekunden Spieldauer an, und ohne Audio-Fokus
 * erscheint überhaupt keine Medienbenachrichtigung.
 */
export function KeepAliveAudio() {
  const ref = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    // Nicht auf null: manche Plattformen behandeln eine Wiedergabe mit
    // Lautstärke 0 wie gar keine. Zusammen mit der minimalen Auslenkung der
    // Datei liegt das bei etwa -76 dBFS — sicher unterhalb des Hörbaren.
    element.volume = 0.02
    element.play().catch(() => {
      // Ohne Nutzergeste abgelehnt — dann fehlt eben der Sperrbildschirm.
      // Die Verbindung selbst hängt nicht davon ab.
    })

    return () => {
      element.pause()
    }
  }, [])

  return <audio ref={ref} src="/silence.wav" loop playsInline preload="auto" />
}
