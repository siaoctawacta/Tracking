/**
 * Generates the Kader Cargo logo files (SVG, text converted to vector paths so they render
 * identically everywhere, with no font dependency).
 *   node brand/build-logo.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import opentype from 'opentype.js'

const require = createRequire(import.meta.url)
const here = path.dirname(new URL(import.meta.url).pathname)
const fontFile = (w) =>
  path.join(path.dirname(require.resolve('@fontsource/playfair-display/package.json', { paths: [path.join(here, '../web')] })), `files/playfair-display-latin-${w}-normal.woff`)
const jakarta = path.join(path.dirname(require.resolve('@fontsource/plus-jakarta-sans/package.json')), 'files/plus-jakarta-sans-latin-700-normal.woff')

export const BRAND = { bordeaux: '#8B1538', bordeauxDark: '#5C0D24', white: '#FFFFFF', ink: '#2B0C16' }

/** Square app icon: bordeaux tile, white airplane taking off, flight trail. 64×64 units. */
export function iconMarkup({ tile = BRAND.bordeaux, plane = BRAND.white } = {}) {
  return `<rect width="64" height="64" rx="16" fill="${tile}"/>
  <path d="M8 50.5C15 51 21 49.2 25.6 45.2" fill="none" stroke="${plane}" stroke-opacity=".5" stroke-width="2.6" stroke-linecap="round"/>
  <path fill="${plane}" transform="rotate(45 34 30)" d="M34 8c2 0 3.2 2.6 3.2 5.4V24l15.3 8.6c.6.3.9.9.9 1.6v2.2l-16.2-4.6v10.6l4.6 3.6c.3.2.4.6.4.9v2l-7.2-2.2-7.2 2.2v-2c0-.3.2-.7.4-.9l4.6-3.6V31.8l-16.2 4.6v-2.2c0-.7.3-1.3.9-1.6L30.8 24V13.4C30.8 10.6 32 8 34 8z"/>`
}

function textPath(font, text, x, baseline, size, tracking = 0) {
  let cursor = x
  const parts = []
  for (const ch of text) {
    const g = font.charToGlyph(ch)
    parts.push(g.getPath(cursor, baseline, size).toPathData(2))
    cursor += (g.advanceWidth / font.unitsPerEm) * size + tracking
  }
  return { d: parts.join(''), width: cursor - x - tracking }
}

async function main() {
  const serif = opentype.parse(fs.readFileSync(fontFile(800)).buffer)
  const sans = fs.existsSync(jakarta) ? opentype.parse(fs.readFileSync(jakarta).buffer) : serif
  const out = path.join(here)

  const variants = [
    { file: 'kader-cargo-logo.svg', word: BRAND.bordeaux, tag: BRAND.ink, tile: BRAND.bordeaux, plane: BRAND.white, bg: null },
    { file: 'kader-cargo-logo-white.svg', word: BRAND.white, tag: '#F3D9E1', tile: BRAND.white, plane: BRAND.bordeaux, bg: null },
    { file: 'kader-cargo-logo-on-bordeaux.svg', word: BRAND.white, tag: '#F3D9E1', tile: BRAND.white, plane: BRAND.bordeaux, bg: BRAND.bordeaux },
  ]
  for (const v of variants) {
    const name = textPath(serif, 'KADER CARGO', 84, 41, 34, 2.2)
    const tag = textPath(sans, 'EXPRESS AIR CARGO · GUANGZHOU – LOMÉ', 86, 60, 9.2, 1.6)
    const width = Math.ceil(84 + Math.max(name.width, tag.width) + (v.bg ? 24 : 4))
    const pad = v.bg ? 16 : 0
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${width + pad} ${64 + pad * 2}" role="img" aria-label="Kader Cargo">
  <title>Kader Cargo</title>
  ${v.bg ? `<rect x="${-pad}" y="${-pad}" width="${width + pad}" height="${64 + pad * 2}" fill="${v.bg}"/>` : ''}
  ${iconMarkup({ tile: v.tile, plane: v.plane })}
  <path fill="${v.word}" d="${name.d}"/>
  <path fill="${v.tag}" d="${tag.d}"/>
</svg>
`
    fs.writeFileSync(path.join(out, v.file), svg)
  }
  fs.writeFileSync(path.join(out, 'kader-cargo-icon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Kader Cargo">\n  <title>Kader Cargo</title>\n  ${iconMarkup()}\n</svg>\n`)
  fs.copyFileSync(path.join(out, 'kader-cargo-icon.svg'), path.join(here, '../web/public/favicon.svg'))
  console.log('Logo files written to brand/')
}

main()
