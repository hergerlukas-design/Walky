import { useCallback, useEffect, useRef, useState } from 'react'

export interface PushToTalkOptions {
  onChange(talking: boolean): void
  disabled?: boolean
}

export interface PushToTalkApi {
  talking: boolean
  /** Dauerhaft an, bis erneut getippt wird (Hände frei). */
  locked: boolean
  toggleLock(): void
  handlers: {
    onPointerDown(event: React.PointerEvent): void
    onPointerUp(event: React.PointerEvent): void
    onPointerCancel(event: React.PointerEvent): void
    onContextMenu(event: React.MouseEvent): void
  }
}

/**
 * Push-to-Talk über Pointer-Events (deckt Maus, Touch und Stift ab) plus
 * Leertaste am Desktop. Zusätzlich ein Rast-Modus, damit man das Gerät nicht
 * dauerhaft festhalten muss.
 */
export function usePushToTalk({ onChange, disabled = false }: PushToTalkOptions): PushToTalkApi {
  const [talking, setTalking] = useState(false)
  const [locked, setLocked] = useState(false)
  const onChangeRef = useRef(onChange)
  // Spiegelt `talking` für die Event-Handler: die feuern außerhalb des
  // Renderings und brauchen den aktuellen Wert ohne neue Callback-Identität.
  const talkingRef = useRef(false)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const apply = useCallback((next: boolean) => {
    if (talkingRef.current === next) return
    talkingRef.current = next
    setTalking(next)
    onChangeRef.current(next)
  }, [])

  const press = useCallback(() => {
    if (disabled) return
    apply(true)
  }, [apply, disabled])

  const release = useCallback(() => {
    if (locked) return
    apply(false)
  }, [apply, locked])

  const toggleLock = useCallback(() => {
    setLocked((current) => {
      const next = !current
      if (!next) apply(false)
      return next
    })
  }, [apply])

  // Loslassen außerhalb des Buttons, Tab-Wechsel oder ein eingehender Anruf
  // dürfen die Leitung nicht offen lassen.
  useEffect(() => {
    if (!talking) return

    const stop = () => {
      if (!locked) apply(false)
    }
    const onHidden = () => {
      if (document.visibilityState === 'hidden') apply(false)
    }

    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    window.addEventListener('blur', stop)
    document.addEventListener('visibilitychange', onHidden)

    return () => {
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      window.removeEventListener('blur', stop)
      document.removeEventListener('visibilitychange', onHidden)
    }
  }, [apply, locked, talking])

  useEffect(() => {
    if (disabled) return

    const isTypingTarget = (target: EventTarget | null): boolean =>
      target instanceof HTMLElement &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat || isTypingTarget(event.target)) return
      event.preventDefault()
      press()
    }

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || isTypingTarget(event.target)) return
      event.preventDefault()
      release()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [disabled, press, release])

  return {
    talking,
    locked,
    toggleLock,
    handlers: {
      onPointerDown: (event) => {
        // Pointer Capture sorgt dafür, dass der Finger den Button verlassen
        // darf, ohne dass die Übertragung abreißt.
        event.currentTarget.setPointerCapture?.(event.pointerId)
        event.preventDefault()
        press()
      },
      onPointerUp: (event) => {
        event.preventDefault()
        release()
      },
      onPointerCancel: () => release(),
      onContextMenu: (event) => event.preventDefault(),
    },
  }
}
