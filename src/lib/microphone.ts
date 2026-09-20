import type { MicErrorCode } from '../types'

/**
 * Audio-Einstellungen für Sprachfunk: Mono reicht, Echo-Unterdrückung ist
 * Pflicht, weil oft mehrere Geräte im selben Raum stehen.
 */
const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
}

export class MicrophoneError extends Error {
  readonly code: MicErrorCode

  constructor(code: MicErrorCode, cause?: unknown) {
    // Die Meldung ist für Protokolle gedacht; was Leute lesen, entsteht aus
    // dem Code in der Oberfläche.
    super(`Mikrofon nicht verfügbar: ${code}`, { cause })
    this.name = 'MicrophoneError'
    this.code = code
  }
}

/**
 * Holt den Mikrofon-Stream. Muss aus einer Nutzergeste heraus aufgerufen
 * werden — iOS zeigt den Berechtigungsdialog sonst nicht zuverlässig.
 */
export async function requestMicrophone(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new MicrophoneError('insecureContext')
  }

  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: AUDIO_CONSTRAINTS,
      video: false,
    })
  } catch (error) {
    throw new MicrophoneError(classify(error), error)
  }
}

function classify(error: unknown): MicErrorCode {
  const name = error instanceof DOMException ? error.name : ''

  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'notFound'
  return 'unknown'
}
