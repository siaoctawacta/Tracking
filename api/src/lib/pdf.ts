import PDFDocument from 'pdfkit'
import bwipjs from 'bwip-js'
import { config } from '../config'
import { company } from './company'
import { statusLabel, TARIFFS } from './domain'

// Kader Cargo charter: bordeaux + white.
const BRAND = '#8B1538'
const BRAND_DARK = '#5C0D24'
const TEXT = '#2A2225'
const MUTED = '#7A6A70'
const LINE = '#EEE5E8'
const TINT = '#FBEFF3'

const PLANE = 'M34 8c2 0 3.2 2.6 3.2 5.4V24l15.3 8.6c.6.3.9.9.9 1.6v2.2l-16.2-4.6v10.6l4.6 3.6c.3.2.4.6.4.9v2l-7.2-2.2-7.2 2.2v-2c0-.3.2-.7.4-.9l4.6-3.6V31.8l-16.2 4.6v-2.2c0-.7.3-1.3.9-1.6L30.8 24V13.4C30.8 10.6 32 8 34 8z'

/** Airplane mark (same geometry as brand/kader-cargo-icon.svg), `size` pt square. */
function drawMark(doc: PDFKit.PDFDocument, x: number, y: number, size: number, inverted = false) {
  const k = size / 64
  doc.save().translate(x, y).scale(k)
  doc.roundedRect(0, 0, 64, 64, 16).fill(inverted ? '#FFFFFF' : BRAND)
  doc.save().rotate(45, { origin: [34, 30] }).path(PLANE).fill(inverted ? BRAND : '#FFFFFF').restore()
  doc.restore()
}

function wordmark(doc: PDFKit.PDFDocument, x: number, y: number, size: number, color: string) {
  doc.fillColor(color).font('Times-Bold').fontSize(size).text('KADER CARGO', x, y, { characterSpacing: size * 0.06, lineBreak: false })
}

interface InvoiceShipment {
  trackingId: string
  description: string
  mode: string
  status: string
  pieces: number
  weightKg: number
  volumeCbm: number
  priceXof: number
  clientName: string
  clientPhone: string
  clientEmail: string | null
  createdAt: Date
  container?: { code: string } | null
}

const xof = (n: number) => new Intl.NumberFormat('fr-FR').format(n).replace(/ | /g, ' ') + ' FCFA'
const date = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

function toBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    doc.end()
  })
}

export async function invoicePdf(s: InvoiceShipment): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 56, info: { Title: `Facture ${s.trackingId}`, Author: company.name } })
  const W = doc.page.width - 112

  doc.rect(0, 0, doc.page.width, 6).fill(BRAND)
  drawMark(doc, 56, 52, 36)
  wordmark(doc, 100, 56, 19, BRAND)
  doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(7).text('EXPRESS AIR CARGO  ·  GUANGZHOU - LOMÉ', 101, 79, { characterSpacing: 1 })
  doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(24).text('Facture', 56, 52, { width: W, align: 'right' })
  doc.fillColor(MUTED).font('Helvetica').fontSize(9)
    .text(`N° FAC-${s.trackingId.replace('BC-', '')}`, 56, 86, { width: W, align: 'right' })
    .text(`Émise le ${date(s.createdAt)}`, { width: W, align: 'right' })

  let y = 140
  doc.moveTo(56, y).lineTo(56 + W, y).strokeColor(LINE).lineWidth(1).stroke()
  y += 20
  const col = (label: string, lines: string[], x: number) => {
    doc.fillColor(MUTED).fontSize(8).font('Helvetica-Bold').text(label.toUpperCase(), x, y, { characterSpacing: 0.8 })
    doc.fillColor(TEXT).fontSize(10).font('Helvetica')
    lines.forEach((l, i) => doc.text(l, x, y + 16 + i * 14))
  }
  col('Client', [s.clientName, s.clientPhone, s.clientEmail ?? ''].filter(Boolean), 56)
  col('Expédition', [s.trackingId, s.mode === 'AIR' ? 'Fret aérien' : 'Fret maritime', statusLabel(s.status, s.mode)], 56 + W / 2)

  y += 90
  doc.rect(56, y, W, 26).fill(TINT)
  doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(8)
  const cols = [56 + 12, 56 + W * 0.45, 56 + W * 0.62, 56 + W * 0.78]
  ;['Désignation', 'Colis', 'Poids / Vol.', 'Montant'].forEach((h, i) =>
    doc.text(h.toUpperCase(), cols[i], y + 9, i === 3 ? { width: W * 0.22 - 12, align: 'right' } : {}),
  )
  y += 38
  const basis = s.mode === 'AIR'
    ? `${s.weightKg} kg × ${xof(TARIFFS.AIR_PER_KG)}`
    : `${s.volumeCbm} m³ × ${xof(TARIFFS.SEA_PER_CBM)}`
  doc.fillColor(TEXT).font('Helvetica').fontSize(10)
  doc.text(s.description, cols[0], y, { width: W * 0.4 })
  doc.fillColor(MUTED).fontSize(8).text(basis, cols[0], doc.y + 2, { width: W * 0.4 })
  doc.fillColor(TEXT).fontSize(10)
  doc.text(String(s.pieces), cols[1], y)
  doc.text(`${s.weightKg} kg\n${s.volumeCbm} m³`, cols[2], y)
  doc.font('Helvetica-Bold').text(xof(s.priceXof), cols[3], y, { width: W * 0.22 - 12, align: 'right' })

  y += 60
  doc.moveTo(56, y).lineTo(56 + W, y).strokeColor(LINE).stroke()
  y += 16
  doc.fillColor(MUTED).font('Helvetica').fontSize(10).text('Total à payer', 56 + W * 0.5, y, { width: W * 0.25 })
  doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(16).text(xof(s.priceXof), 56 + W * 0.6, y - 3, { width: W * 0.4, align: 'right' })

  const code = await bwipjs.toBuffer({ bcid: 'code128', text: s.trackingId, scale: 2, height: 9 })
  doc.image(code, 56, 668, { height: 34 })
  doc.fillColor(MUTED).font('Helvetica').fontSize(8)
    .text('Paiement à l’agence de Lomé avant retrait. Merci de votre confiance.', 56, 712, { width: W })
    .text(`Lomé : ${company.lome.contacts.map((c) => `${c.phone} (${c.name})`).join('  ·  ')}`, 56, 728, { width: W })
    .text(`Guangzhou : ${company.guangzhou.contacts.map((c) => `${c.phone} (${c.name})`).join('  ·  ')}`, 56, 742, { width: W })
    .text(company.guangzhou.address, 56, 756, { width: W })
  return toBuffer(doc)
}

/** 100 × 150 mm thermal label for warehouse parcels. */
export async function labelPdf(s: InvoiceShipment): Promise<Buffer> {
  const mm = (v: number) => (v * 72) / 25.4
  const doc = new PDFDocument({ size: [mm(100), mm(150)], margin: mm(6), info: { Title: `Étiquette ${s.trackingId}` } })
  const W = mm(88)
  const x = mm(6)

  doc.rect(0, 0, mm(100), mm(18)).fill(BRAND)
  drawMark(doc, x, mm(3.5), mm(11), true)
  wordmark(doc, x + mm(13.5), mm(6.2), 13, '#FFFFFF')
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8).text(s.mode === 'AIR' ? 'AÉRIEN EXPRESS' : 'MARITIME', x, mm(7.2), { width: W, align: 'right' })

  doc.fillColor(BRAND_DARK).fontSize(7).font('Helvetica-Bold').text('GUANGZHOU  >  LOMÉ', x, mm(23), { characterSpacing: 1 })
  doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(22).text(s.trackingId, x, mm(28), { width: W })

  const bar = await bwipjs.toBuffer({ bcid: 'code128', text: s.trackingId, scale: 3, height: 14 })
  doc.image(bar, x, mm(42), { width: W, height: mm(22) })

  const field = (label: string, value: string, fx: number, fy: number, w: number) => {
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(6.5).text(label.toUpperCase(), fx, fy, { characterSpacing: 0.8 })
    doc.fillColor(TEXT).font('Helvetica').fontSize(10).text(value, fx, fy + mm(3.5), { width: w, height: mm(10), ellipsis: true })
  }
  field('Destinataire', s.clientName, x, mm(70), W)
  field('Téléphone', s.clientPhone, x, mm(82), W / 2)
  field('Colis', String(s.pieces), x + W / 2, mm(82), W / 2)
  field('Poids', `${s.weightKg} kg`, x, mm(94), W / 2)
  field('Volume', `${s.volumeCbm} m³`, x + W / 2, mm(94), W / 2)
  field('Contenu', s.description, x, mm(106), W)
  field('Lot / Conteneur', s.container?.code ?? '—', x, mm(118), W / 2)
  field('Reçu le', s.createdAt.toLocaleDateString('fr-FR'), x + W / 2, mm(118), W / 2)

  const qr = await bwipjs.toBuffer({ bcid: 'qrcode', text: s.trackingId, scale: 3 })
  doc.image(qr, x + W - mm(16), mm(129), { width: mm(16) })
  doc.fillColor(MUTED).fontSize(7).text(config.publicWebUrl ? `Suivi : ${config.publicWebUrl.replace(/^https?:\/\//, '')}` : `WhatsApp ${company.whatsapp}`, x, mm(140))
  return toBuffer(doc)
}
