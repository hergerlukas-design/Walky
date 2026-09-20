/**
 * Kanal-Codes werden vorgelesen, abgetippt und per QR geteilt. Deshalb ein
 * Alphabet ohne verwechselbare Zeichen (kein 0/o, 1/l/i).
 */
export const CODE_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'
export const CODE_LENGTH = 6
export const MIN_CODE_LENGTH = 4
export const MAX_CODE_LENGTH = 24

type RandomSource = (size: number) => Uint8Array

const defaultRandom: RandomSource = (size) => {
  const bytes = new Uint8Array(size)
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < size; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }
  return bytes
}

export function generateChannelCode(
  length: number = CODE_LENGTH,
  random: RandomSource = defaultRandom,
): string {
  const bytes = random(length)
  let code = ''
  for (let i = 0; i < length; i += 1) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  }
  return code
}

/**
 * Akzeptiert alles, was Leute realistisch einfügen: den blanken Code, eine
 * komplette Kanal-URL, Codes mit Bindestrichen oder in Großbuchstaben.
 */
export function normalizeChannelCode(input: string): string {
  let candidate = (input ?? '').trim()

  if (candidate.includes('/')) {
    const withoutQuery = candidate.split(/[?#]/)[0]
    const segments = withoutQuery.split('/').filter(Boolean)
    candidate = segments[segments.length - 1] ?? ''
  }

  return candidate
    .toLowerCase()
    .split('')
    .filter((char) => CODE_ALPHABET.includes(char))
    .join('')
    .slice(0, MAX_CODE_LENGTH)
}

export function isValidChannelCode(code: string): boolean {
  return (
    code.length >= MIN_CODE_LENGTH &&
    code.length <= MAX_CODE_LENGTH &&
    code.split('').every((char) => CODE_ALPHABET.includes(char))
  )
}

export function channelPath(code: string): string {
  return `/kanal/${code}`
}

/** `origin` wird bewusst übergeben — das Modul läuft auch im Server ohne DOM. */
export function channelUrl(code: string, origin: string): string {
  return `${origin.replace(/\/+$/, '')}${channelPath(code)}`
}

/** "abc123" -> "abc 123": leichter vorzulesen. */
export function formatChannelCode(code: string): string {
  return code.replace(/(.{3})(?=.)/g, '$1 ')
}
