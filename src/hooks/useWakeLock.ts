import { useEffect } from 'react'

/**
 * Hält den Bildschirm an, solange man im Kanal ist — ein gesperrtes Display
 * macht die Sprechtaste unerreichbar. Wird nicht überall unterstützt; dann
 * passiert schlicht nichts.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return

    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    const acquire = async () => {
      try {
        sentinel = await navigator.wakeLock.request('screen')
      } catch {
        /* z. B. bei niedrigem Akkustand — nicht kritisch */
      }
    }

    // Nach einem App-Wechsel gibt das System die Sperre frei.
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !cancelled) void acquire()
    }

    void acquire()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      void sentinel?.release().catch(() => undefined)
    }
  }, [active])
}
