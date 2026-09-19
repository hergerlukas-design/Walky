const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'
const ID_LENGTH = 21

/**
 * Peer-IDs müssen nur innerhalb eines Kanals eindeutig und stabil sortierbar
 * sein — daraus leitet die Mesh-Logik ab, wer bei einer Angebots-Kollision
 * nachgibt ("polite peer"). Der Server akzeptiert `[A-Za-z0-9-]{8,64}`.
 */
export function createPeerId(): string {
  const bytes = new Uint8Array(ID_LENGTH)

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    // Nur als Notnagel: eine Kollision kostet hier lediglich eine Sitzung.
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }

  return Array.from(bytes, (byte) => ID_ALPHABET[byte % ID_ALPHABET.length]).join('')
}
