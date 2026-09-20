import { useCallback, useEffect, useRef } from 'react'

export interface KeepAliveAudio {
  /**
   * Stellt sicher, dass die Schleife läuft. Nach jedem Druck auf eine
   * Medientaste aufzurufen: Android pausiert dabei mitunter auch das
   * Element selbst, und mit der Wiedergabe verschwände die Benachrichtigung
   * — man käme dann nicht mehr ans Senden.
   */
  ensurePlaying(): void
}

/**
 * Stille Endlosschleife, die läuft, solange man im Kanal ist.
 *
 * Zwei Gründe: Chrome blendet den Medieneintrag auf dem Sperrbildschirm nur
 * bei tatsächlich laufender Wiedergabe ein, und eine Seite, die Ton ausgibt
 * oder aufnimmt, wird im Hintergrund nicht eingefroren.
 *
 * Die Länge der Datei ist kein Zufall: Chrome auf Android fordert den
 * Audio-Fokus erst ab fünf Sekunden Spieldauer an, und ohne Audio-Fokus
 * erscheint überhaupt keine Medienbenachrichtigung.
 *
 * Das Element entsteht bewusst nicht im Komponentenbaum, sondern hier —
 * so kommen die Medientasten-Handler direkt heran.
 */
/**
 * Höchstzahl selbsttätiger Wiederaufnahmen. Begrenzt, damit sich die App
 * nicht mit etwas streitet, das den Ton zu Recht beansprucht — bei einem
 * eingehenden Telefonat etwa soll die Schleife schweigen.
 */
const MAX_RESUMES = 10

export function useKeepAliveAudio(active: boolean): KeepAliveAudio {
  const ref = useRef<HTMLAudioElement | null>(null)
  const resumesLeft = useRef(MAX_RESUMES)

  useEffect(() => {
    if (!active) return

    resumesLeft.current = MAX_RESUMES

    const element = document.createElement('audio')
    element.src = '/silence.wav'
    element.loop = true
    element.preload = 'auto'
    element.setAttribute('playsinline', '')
    // Nicht auf null: manche Plattformen behandeln eine Wiedergabe mit
    // Lautstärke 0 wie gar keine. Zusammen mit der minimalen Auslenkung der
    // Datei sind das rund -76 dBFS, sicher unterhalb des Hörbaren.
    element.volume = 0.02
    document.body.append(element)
    ref.current = element

    element.play().catch(() => {
      // Ohne Nutzergeste abgelehnt — dann fehlt eben der Sperrbildschirm.
      // Die Verbindung selbst hängt nicht davon ab.
    })

    // Wer auch immer die Wiedergabe anhält — die Sperrbildschirm-Taste, das
    // System, ein anderer Tab —, ohne sie verschwindet die Benachrichtigung
    // und damit der Weg zum Senden.
    const onPause = () => {
      if (resumesLeft.current <= 0) return
      resumesLeft.current -= 1
      element.play().catch(() => undefined)
    }
    element.addEventListener('pause', onPause)

    return () => {
      ref.current = null
      element.removeEventListener('pause', onPause)
      element.pause()
      element.remove()
    }
  }, [active])

  const ensurePlaying = useCallback(() => {
    const element = ref.current
    if (!element?.paused) return
    // Ausdrücklich angefordert, zählt deshalb nicht gegen die Obergrenze.
    element.play().catch(() => undefined)
  }, [])

  return { ensurePlaying }
}
