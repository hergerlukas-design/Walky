/**
 * Erzeugt eine kurze, stille WAV-Datei.
 *
 * Chrome blendet den Medieneintrag auf dem Sperrbildschirm nur ein, wenn
 * tatsächlich etwas abgespielt wird — Metadaten allein genügen nicht. Diese
 * Schleife läuft deshalb, solange man im Kanal ist, und hält die
 * Medien-Sitzung am Leben, auch wenn gerade niemand spricht.
 *
 *   node scripts/generate-silence.mjs
 */
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SAMPLE_RATE = 8000
const SECONDS = 1
const samples = SAMPLE_RATE * SECONDS

// 8 Bit unsigned PCM: die Mitte (128) ist Stille.
const data = Buffer.alloc(samples, 128)

const header = Buffer.alloc(44)
header.write('RIFF', 0, 'ascii')
header.writeUInt32LE(36 + data.length, 4)
header.write('WAVE', 8, 'ascii')
header.write('fmt ', 12, 'ascii')
header.writeUInt32LE(16, 16) // Länge des fmt-Blocks
header.writeUInt16LE(1, 20) // PCM
header.writeUInt16LE(1, 22) // Mono
header.writeUInt32LE(SAMPLE_RATE, 24)
header.writeUInt32LE(SAMPLE_RATE, 28) // Bytes pro Sekunde
header.writeUInt16LE(1, 32) // Blockausrichtung
header.writeUInt16LE(8, 34) // Bit pro Sample
header.write('data', 36, 'ascii')
header.writeUInt32LE(data.length, 40)

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../public/silence.wav')
writeFileSync(out, Buffer.concat([header, data]))
console.log(`silence.wav (${44 + data.length} Bytes)`)
