/**
 * Builds docs/Kader-Cargo-Guide.pdf from docs/guide/{cover,guide}.html.
 *   node docs/guide/build-pdf.mjs
 * Requires: Playwright (Chromium), poppler-utils (pdftotext), Python 3 with pypdf.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const here = path.dirname(new URL(import.meta.url).pathname)
const out = path.join(here, '..', 'Kader-Cargo-Guide.pdf')
const tmp = fs.mkdtempSync('/tmp/kader-guide-')

const footer = `<div style="width:100%;padding:0 17mm;display:flex;justify-content:space-between;font-family:Helvetica,Arial,sans-serif;font-size:7.5pt;color:#7a6a70">
  <span>Kader Cargo — Guide d’utilisation et de déploiement</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`

const pdfOpts = { format: 'A4', printBackground: true, displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: footer, margin: { top: '16mm', bottom: '18mm', left: '17mm', right: '17mm' } }

const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto('file://' + path.join(here, 'guide.html'), { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)

// Table of contents from the document structure (page numbers filled in pass 2).
const entries = await page.evaluate(() => {
  const toc = document.getElementById('toc')
  const list = []
  for (const part of document.querySelectorAll('section.part')) {
    const pid = 'p' + list.length
    part.querySelector('h1').id = pid
    list.push({ id: pid, title: part.dataset.tocPart, find: part.querySelector('.num').textContent + part.querySelector('h1').textContent, part: true })
    const tp = document.createElement('div'); tp.className = 'tp'
    tp.innerHTML = `<span>${part.dataset.tocPart}</span><span class="dots" style="border:0"></span><span class="pg" data-for="${pid}">00</span>`
    toc.appendChild(tp)
    for (const h of part.querySelectorAll('h2[id]')) {
      const n = h.querySelector('.n')?.textContent ?? ''
      const t = h.textContent.replace(n, '').trim()
      list.push({ id: h.id, title: `${n} ${t}`, find: n + t })
      const row = document.createElement('div'); row.className = 'row'
      row.innerHTML = `<span>${n ? `<b style="color:#8b1538;margin-right:6pt">${n}</b>` : ''}${t}</span><span class="dots"></span><span class="pg" data-for="${h.id}">00</span>`
      toc.appendChild(row)
    }
  }
  return list
})

// Compare without any whitespace: PDF text extraction splits and joins words unpredictably.
const norm = (s) => s.replace(/[’']/g, "'").replace(/\s+/g, '').toLowerCase()
function locate(pdf) {
  const pages = Number(/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [pdf]).toString())[1])
  const texts = Array.from({ length: pages }, (_, i) => norm(execFileSync('pdftotext', ['-f', String(i + 1), '-l', String(i + 1), '-layout', pdf, '-']).toString()))
  const found = {}
  let from = 1 // skip the table of contents page
  for (const e of entries) {
    const needle = norm(e.find).slice(0, 40)
    const idx = texts.findIndex((t, i) => i >= from && t.includes(needle))
    if (idx < 0) throw new Error(`Section introuvable dans le PDF : ${e.find}`)
    found[e.id] = idx + 1
    from = idx
  }
  return { pages, found }
}

const pass1 = path.join(tmp, 'pass1.pdf')
await page.pdf({ ...pdfOpts, path: pass1 })
const first = locate(pass1)
await page.evaluate((found) => { for (const el of document.querySelectorAll('.pg')) el.textContent = String(found[el.dataset.for]) }, first.found)
const body = path.join(tmp, 'body.pdf')
await page.pdf({ ...pdfOpts, path: body })
const second = locate(body)
for (const e of entries) if (second.found[e.id] !== first.found[e.id]) throw new Error(`Pagination instable pour ${e.title}`)

const cover = await browser.newPage()
await cover.goto('file://' + path.join(here, 'cover.html'), { waitUntil: 'networkidle' })
await cover.evaluate(() => document.fonts.ready)
const coverPdf = path.join(tmp, 'cover.pdf')
await cover.pdf({ path: coverPdf, format: 'A4', printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } })
await browser.close()

execFileSync('python3', ['-c', `
import sys
from pypdf import PdfReader, PdfWriter
w = PdfWriter()
w.append(PdfReader(sys.argv[1]))
w.append(PdfReader(sys.argv[2]))
w.add_metadata({'/Title': 'Kader Cargo — Guide d’utilisation et de déploiement', '/Author': 'Kader Cargo', '/Subject': 'Utilisation de la plateforme et déploiement sur un serveur'})
w.compress_identical_objects()
with open(sys.argv[3], 'wb') as f: w.write(f)
`, coverPdf, body, out])
fs.rmSync(tmp, { recursive: true, force: true })
console.log(`✓ ${path.relative(process.cwd(), out)} — ${second.pages + 1} pages`)
for (const e of entries) console.log(`  p.${String(second.found[e.id]).padStart(2)}  ${e.title}`)
