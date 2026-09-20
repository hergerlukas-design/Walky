import { readStored, writeStored } from './storage'

const ADJECTIVES = [
  'Blauer', 'Roter', 'Grüner', 'Stiller', 'Schneller', 'Wacher',
  'Kalter', 'Heller', 'Weiter', 'Flinker', 'Hoher', 'Später',
]

const NOUNS = [
  'Falke', 'Anker', 'Kompass', 'Norden', 'Funker', 'Kater',
  'Turm', 'Bote', 'Pfeil', 'Fuchs', 'Wagen', 'Kanal',
]

const NAME_KEY = 'walky:name'

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

/** Zufälliges Rufzeichen, damit niemand vor dem Beitreten tippen muss. */
export function randomCallsign(): string {
  return `${pick(ADJECTIVES)} ${pick(NOUNS)}`
}

export function loadDisplayName(): string {
  const stored = readStored(NAME_KEY)
  if (stored && stored.trim().length > 0) return stored.trim()
  const generated = randomCallsign()
  writeStored(NAME_KEY, generated)
  return generated
}

export function saveDisplayName(name: string): void {
  writeStored(NAME_KEY, name.trim().slice(0, 32))
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
