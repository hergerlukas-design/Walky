/**
 * Erzeugt die PWA-Icons ohne Bildbibliothek: die Grafik wird pixelweise
 * gezeichnet und mit zlib als PNG kodiert. Damit bleibt der Build frei von
 * nativen Abhängigkeiten, und die Icons sind reproduzierbar.
 *
 *   node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../public/icons')

const BACKGROUND = [11, 15, 20, 255]
const BODY = [245, 165, 36, 255]
const DARK = [11, 15, 20, 255]

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function encodePng(width, height, pixels) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // RGBA
  // 10-12: Kompression, Filter, Interlace — jeweils Standard (0).

  // Jede Zeile bekommt ein führendes Filter-Byte (0 = None).
  const raw = Buffer.alloc(height * (width * 4 + 1))
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1)
    raw[rowStart] = 0
    pixels.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Zeichenfläche mit Hilfsfunktionen in normalisierten Koordinaten (0..1). */
function createCanvas(size) {
  const pixels = Buffer.alloc(size * size * 4)

  const set = (x, y, color) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const offset = (y * size + x) * 4
    pixels[offset] = color[0]
    pixels[offset + 1] = color[1]
    pixels[offset + 2] = color[2]
    pixels[offset + 3] = color[3]
  }

  const fill = (color) => {
    for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) set(x, y, color)
  }

  const roundedRect = (x0, y0, x1, y1, radius, color) => {
    const [px0, py0, px1, py1, r] = [x0, y0, x1, y1, radius].map((v) => v * size)
    for (let y = Math.floor(py0); y < Math.ceil(py1); y += 1) {
      for (let x = Math.floor(px0); x < Math.ceil(px1); x += 1) {
        const dx = Math.max(px0 + r - x, 0, x - (px1 - r))
        const dy = Math.max(py0 + r - y, 0, y - (py1 - r))
        if (dx * dx + dy * dy <= r * r) set(x, y, color)
      }
    }
  }

  const disc = (cx, cy, radius, color) => {
    const [pcx, pcy, r] = [cx, cy, radius].map((v) => v * size)
    for (let y = Math.floor(pcy - r); y <= Math.ceil(pcy + r); y += 1) {
      for (let x = Math.floor(pcx - r); x <= Math.ceil(pcx + r); x += 1) {
        const dx = x - pcx
        const dy = y - pcy
        if (dx * dx + dy * dy <= r * r) set(x, y, color)
      }
    }
  }

  return { pixels, fill, roundedRect, disc }
}

/**
 * Walkie-Talkie in Draufsicht: Gehäuse, Antenne, Display, zwei Knöpfe.
 * `inset` schrumpft das Motiv für maskable Icons in die sichere Zone.
 */
function drawIcon(size, { inset = 0, background = true } = {}) {
  const canvas = createCanvas(size)
  if (background) canvas.fill(BACKGROUND)

  const scale = 1 - inset * 2
  const at = (value) => inset + value * scale

  // Antenne
  canvas.roundedRect(at(0.6), at(0.12), at(0.66), at(0.34), 0.03 * scale, BODY)
  // Gehäuse
  canvas.roundedRect(at(0.26), at(0.3), at(0.74), at(0.9), 0.1 * scale, BODY)
  // Display
  canvas.roundedRect(at(0.34), at(0.38), at(0.66), at(0.56), 0.04 * scale, DARK)
  // Knöpfe
  canvas.disc(at(0.41), at(0.68), 0.05 * scale, DARK)
  canvas.disc(at(0.59), at(0.68), 0.05 * scale, DARK)
  canvas.roundedRect(at(0.36), at(0.78), at(0.64), at(0.83), 0.025 * scale, DARK)

  return encodePng(size, size, canvas.pixels)
}

mkdirSync(OUT_DIR, { recursive: true })

const targets = [
  ['icon-192.png', drawIcon(192)],
  ['icon-512.png', drawIcon(512)],
  // Maskable: Motiv innerhalb der sicheren Zone (80 %), Fläche randlos gefüllt.
  ['maskable-512.png', drawIcon(512, { inset: 0.1 })],
]

for (const [name, data] of targets) {
  writeFileSync(resolve(OUT_DIR, name), data)
  console.log(`${name} (${data.length} Bytes)`)
}

// Apple erwartet das Touch-Icon im Wurzelverzeichnis.
writeFileSync(resolve(OUT_DIR, '../apple-touch-icon.png'), drawIcon(180))
console.log('apple-touch-icon.png')
