import { useCallback, useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export interface InstallPromptApi {
  /** Android/Chrome: die App kann direkt installiert werden. */
  canInstall: boolean
  /** iOS bietet keine API — dort hilft nur eine Anleitung. */
  isIos: boolean
  isStandalone: boolean
  install(): Promise<void>
}

export function useInstallPrompt(): InstallPromptApi {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setDeferred(null)

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = useCallback(async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
  }, [deferred])

  const isIos =
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPadOS meldet sich als Mac mit Touchscreen.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && Boolean((navigator as { standalone?: boolean }).standalone))

  return { canInstall: deferred !== null, isIos, isStandalone, install }
}
