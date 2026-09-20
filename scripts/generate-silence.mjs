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
/**
 * Muss über fünf Sekunden liegen: Chrome auf Android fordert den Audio-Fokus
 * erst ab dieser Länge an, und ohne Audio-Fokus gibt es keine Medien-
 * benachrichtigung und damit keinen Sperrbildschirm-Eintrag.
 */
const SECONDS = 10
const samples = SAMPLE_RATE * SECONDS

/**
 * Nicht bitgenau still, sondern eine Schwingung mit der kleinstmöglichen
 * Auslenkung von einem Schritt um die Mitte (128). Das sind rund -42 dBFS,
 * zusammen mit der geringen Lautstärke des Elements weit unter allem, was man
 * hören könnte — aber eben kein digitales Nichts, das manche Plattformen wie
 * "spielt gar nichts" behandeln.
 */
const data = Buffer.alloc(samples)
for (let i = 0; i < samples; i += 1) {
  data[i] = 128 + (Math.sin((i / SAMPLE_RATE) * 2 * Math.PI * 40) >= 0 ? 1 : -1)
}

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
