/**
 * localStorage kann im privaten Modus oder bei blockierten Cookies werfen —
 * deshalb grundsätzlich gekapselt.
 */

export function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* ignorieren — die App funktioniert auch ohne Persistenz */
  }
}
