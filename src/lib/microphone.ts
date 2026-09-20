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
  readonly reason: 'denied' | 'unavailable'

  constructor(reason: 'denied' | 'unavailable', message: string) {
    super(message)
    this.name = 'MicrophoneError'
    this.reason = reason
  }
}

/**
 * Holt den Mikrofon-Stream. Muss aus einer Nutzergeste heraus aufgerufen
 * werden — iOS zeigt den Berechtigungsdialog sonst nicht zuverlässig.
 */
export async function requestMicrophone(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new MicrophoneError(
      'unavailable',
      'Dieser Browser gibt kein Mikrofon frei. Die Seite muss über HTTPS laufen.',
    )
  }

  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: AUDIO_CONSTRAINTS,
      video: false,
    })
  } catch (error) {
    const name = error instanceof DOMException ? error.name : ''

    if (name === 'NotAllowedError' || name === 'SecurityError') {
      throw new MicrophoneError(
        'denied',
        'Mikrofonzugriff wurde abgelehnt. In den Browser-Einstellungen für diese Seite freigeben.',
      )
    }

    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      throw new MicrophoneError('unavailable', 'Kein Mikrofon gefunden.')
    }

    throw new MicrophoneError(
      'unavailable',
      error instanceof Error ? error.message : 'Mikrofon konnte nicht gestartet werden.',
    )
  }
}
