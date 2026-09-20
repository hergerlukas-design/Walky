import type { Language } from '../i18n/translations'
import { readStored, writeStored } from './storage'

/**
 * Rufzeichen statt Klarnamen: Man tritt einem Kanal bei, ohne vorher etwas
 * tippen zu müssen, und gibt nebenbei nicht seinen Namen preis.
 */
const WORDS: Record<Language, { adjectives: string[]; nouns: string[] }> = {
  de: {
    adjectives: [
      'Blauer', 'Roter', 'Grüner', 'Stiller', 'Schneller', 'Wacher',
      'Kalter', 'Heller', 'Weiter', 'Flinker', 'Hoher', 'Später',
    ],
    nouns: [
      'Falke', 'Anker', 'Kompass', 'Norden', 'Funker', 'Kater',
      'Turm', 'Bote', 'Pfeil', 'Fuchs', 'Wagen', 'Kanal',
    ],
  },
  en: {
    adjectives: [
      'Blue', 'Red', 'Green', 'Quiet', 'Swift', 'Sharp',
      'Cold', 'Bright', 'Distant', 'Nimble', 'High', 'Late',
    ],
    nouns: [
      'Falcon', 'Anchor', 'Compass', 'North', 'Signal', 'Tomcat',
      'Tower', 'Courier', 'Arrow', 'Fox', 'Wagon', 'Channel',
    ],
  },
}

const NAME_KEY = 'walky:name'

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

export function randomCallsign(lang: Language): string {
  const { adjectives, nouns } = WORDS[lang]
  return `${pick(adjectives)} ${pick(nouns)}`
}

export function loadDisplayName(lang: Language): string {
  const stored = readStored(NAME_KEY)
  if (stored && stored.trim().length > 0) return stored.trim()

  const generated = randomCallsign(lang)
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
