import { describe, expect, it } from 'vitest'
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  channelPath,
  channelUrl,
  formatChannelCode,
  generateChannelCode,
  isValidChannelCode,
  normalizeChannelCode,
} from '../shared/channelCode'

describe('generateChannelCode', () => {
  it('liefert einen Code in der erwarteten Länge aus dem erlaubten Alphabet', () => {
    const code = generateChannelCode()
    expect(code).toHaveLength(CODE_LENGTH)
    expect(code.split('').every((char) => CODE_ALPHABET.includes(char))).toBe(true)
  })

  it('vermeidet verwechselbare Zeichen', () => {
    // Bei 4000 Zeichen wäre jedes zugelassene Zeichen praktisch sicher dabei.
    const sample = Array.from({ length: 200 }, () => generateChannelCode(20)).join('')
    expect(sample).not.toMatch(/[01ilo]/)
  })

  it('bildet die Zufallsbytes gleichmäßig auf das Alphabet ab', () => {
    const bytes = Uint8Array.from([0, 1, 2, 30])
    expect(generateChannelCode(4, () => bytes)).toBe('234z')
  })
})

describe('normalizeChannelCode', () => {
  it('akzeptiert einen blanken Code', () => {
    expect(normalizeChannelCode('abc234')).toBe('abc234')
  })

  it('macht aus Großbuchstaben und Trennzeichen einen gültigen Code', () => {
    expect(normalizeChannelCode(' ABC-234 ')).toBe('abc234')
  })

  it('zieht den Code aus einer eingefügten Kanal-URL', () => {
    expect(normalizeChannelCode('https://walky.fly.dev/kanal/abc234')).toBe('abc234')
    expect(normalizeChannelCode('https://walky.fly.dev/kanal/abc234?x=1#top')).toBe('abc234')
  })

  it('verwirft verwechselbare Zeichen statt sie zu raten', () => {
    expect(normalizeChannelCode('ab0o1il')).toBe('ab')
  })

  it('kappt überlange Eingaben', () => {
    expect(normalizeChannelCode('a'.repeat(100))).toHaveLength(24)
  })

  it('kommt mit leerer Eingabe klar', () => {
    expect(normalizeChannelCode('')).toBe('')
    expect(normalizeChannelCode('   ')).toBe('')
  })
})

describe('isValidChannelCode', () => {
  it.each([
    ['abc234', true],
    ['abcd', true],
    ['abc', false],
    ['', false],
    ['abc01o', false],
    ['a'.repeat(25), false],
  ])('%s -> %s', (code, expected) => {
    expect(isValidChannelCode(code)).toBe(expected)
  })

  it('akzeptiert jeden selbst erzeugten Code', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(isValidChannelCode(generateChannelCode())).toBe(true)
    }
  })
})

describe('Links', () => {
  it('baut Pfad und URL', () => {
    expect(channelPath('abc234')).toBe('/kanal/abc234')
    expect(channelUrl('abc234', 'https://walky.fly.dev')).toBe(
      'https://walky.fly.dev/kanal/abc234',
    )
  })

  it('doppelt keinen Schrägstrich bei Origin mit Slash', () => {
    expect(channelUrl('abc234', 'https://walky.fly.dev/')).toBe(
      'https://walky.fly.dev/kanal/abc234',
    )
  })

  it('gruppiert den Code zum Vorlesen', () => {
    expect(formatChannelCode('abc234')).toBe('abc 234')
    expect(formatChannelCode('abcd')).toBe('abc d')
  })
})
