import { useCallback } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/** Im Hintergrund nach neuen Versionen sehen, ohne dass jemand neu lädt. */
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000

export interface PwaUpdateApi {
  /** Eine neue Version liegt bereit und wartet auf Zustimmung. */
  updateAvailable: boolean
  /** Einmalige Rückmeldung, dass die App jetzt auch ohne Netz startet. */
  offlineReady: boolean
  /** Übernimmt die neue Version — die Seite lädt dabei neu. */
  applyUpdate(): void
  dismiss(): void
}

/**
 * Bewusst mit Rückfrage statt automatisch: Ein selbsttätiger Neustart würde
 * mitten im Gespräch die Kanalverbindung kappen. Der Service Worker wartet
 * deshalb, bis jemand zustimmt.
 */
export function usePwaUpdate(): PwaUpdateApi {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return

      // Ein installierter Service Worker sucht von sich aus nur beim
      // Seitenaufruf nach Neuem. Eine PWA, die tagelang offen bleibt,
      // erführe sonst nie von einer neuen Version.
      const check = () => {
        if (document.visibilityState === 'visible') {
          void registration.update().catch(() => undefined)
        }
      }

      const timer = setInterval(check, UPDATE_CHECK_INTERVAL_MS)
      document.addEventListener('visibilitychange', check)

      // Der Hook räumt selbst nicht auf; beim Entladen ist es ohnehin vorbei.
      window.addEventListener('beforeunload', () => {
        clearInterval(timer)
        document.removeEventListener('visibilitychange', check)
      })
    },
    onRegisterError(error) {
      console.warn('[walky] Service Worker nicht registriert', error)
    },
  })

  const applyUpdate = useCallback(() => {
    void updateServiceWorker(true)
  }, [updateServiceWorker])

  /**
   * "Später" blendet nur den Hinweis aus. Der neue Service Worker bleibt im
   * Wartezustand und übernimmt beim nächsten vollständigen Start von selbst —
   * niemand bleibt dauerhaft auf einer alten Fassung sitzen.
   */
  const dismiss = useCallback(() => {
    setNeedRefresh(false)
    setOfflineReady(false)
  }, [setNeedRefresh, setOfflineReady])

  return { updateAvailable: needRefresh, offlineReady, applyUpdate, dismiss }
}
