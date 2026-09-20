import { describe, expect, it } from 'vitest'
import { LANGUAGES, translations } from '../src/i18n/translations'
import { detectLanguage } from '../src/i18n/LanguageProvider'

type Shape = Record<string, unknown>

/** Sammelt alle Blattpfade eines verschachtelten Objekts. */
function paths(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix]
  return Object.entries(value as Shape).flatMap(([key, child]) =>
    paths(child, prefix ? `${prefix}.${key}` : key),
  )
}

function leaf(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => (current as Shape)?.[key], source)
}

describe('Wörterbücher', () => {
  const [reference, ...others] = LANGUAGES

  it.each(others)('%s deckt dieselben Schlüssel ab wie %s', (lang) => {
    expect(paths(translations[lang]).sort()).toEqual(paths(translations[reference]).sort())
  })

  it.each(LANGUAGES)('%s hat keine leeren Texte', (lang) => {
    for (const path of paths(translations[lang])) {
      const value = leaf(translations[lang], path)
      if (typeof value === 'function') continue
      expect(typeof value, `${lang}.${path}`).toBe('string')
      expect((value as string).trim(), `${lang}.${path}`).not.toBe('')
    }
  })

  it.each(others)('%s verwendet dieselben Einsetzungsfunktionen', (lang) => {
    for (const path of paths(translations[reference])) {
      const expected = typeof leaf(translations[reference], path)
      expect(typeof leaf(translations[lang], path), `${lang}.${path}`).toBe(expected)
    }
  })

  it('setzt Werte in beiden Sprachen ein', () => {
    expect(translations.de.participants.heading(3)).toContain('3')
    expect(translations.en.participants.heading(3)).toContain('3')
    expect(translations.de.participants.mute('Blauer Falke')).toContain('Blauer Falke')
    expect(translations.en.participants.mute('Blue Falcon')).toContain('Blue Falcon')
    expect(translations.de.home.codeTooShort(4)).toContain('4')
    expect(translations.en.home.codeTooShort(4)).toContain('4')
  })

  it('übersetzt jeden Verbindungszustand', () => {
    for (const lang of LANGUAGES) {
      const status = translations[lang].participants.status
      expect(Object.values(status).every((label) => label.length > 0)).toBe(true)
    }
  })
})

describe('detectLanguage', () => {
  it('folgt einer gespeicherten Auswahl', () => {
    expect(detectLanguage('de', ['en-US'])).toBe('de')
    expect(detectLanguage('en', ['de-DE'])).toBe('en')
  })

  it('ignoriert unbrauchbar Gespeichertes', () => {
    expect(detectLanguage('klingonisch', ['de-DE'])).toBe('de')
    expect(detectLanguage('', ['en-GB'])).toBe('en')
  })

  it('nimmt Deutsch nur bei deutscher Browsersprache', () => {
    expect(detectLanguage(null, ['de'])).toBe('de')
    expect(detectLanguage(null, ['de-AT', 'en-US'])).toBe('de')
    expect(detectLanguage(null, ['en-US', 'de-DE'])).toBe('de')
    expect(detectLanguage(null, ['DE-CH'])).toBe('de')
  })

  it('fällt sonst auf Englisch zurück', () => {
    expect(detectLanguage(null, ['fr-FR'])).toBe('en')
    expect(detectLanguage(null, [])).toBe('en')
  })
})
