import PDFDocument from 'pdfkit'
import bwipjs from 'bwip-js'
import { statusLabel, TARIFFS } from './domain'

const NAVY = '#121E31'
const BLUE = '#1E90FF'
const TEXT = '#1E293B'
const MUTED = '#64748B'

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
  const doc = new PDFDocument({ size: 'A4', margin: 56, info: { Title: `Facture ${s.trackingId}`, Author: 'Benit Cargo' } })
  const W = doc.page.width - 112

  doc.rect(0, 0, doc.page.width, 6).fill(BLUE)
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(20).text('Benit Cargo', 56, 56)
  doc.fillColor(MUTED).font('Helvetica').fontSize(9).text('Fret maritime & aérien Chine → Togo', 56, 80)
  doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(24).text('Facture', 56, 56, { width: W, align: 'right' })
  doc.fillColor(MUTED).font('Helvetica').fontSize(9)
    .text(`N° FAC-${s.trackingId.replace('BC-', '')}`, 56, 86, { width: W, align: 'right' })
    .text(`Émise le ${date(s.createdAt)}`, { width: W, align: 'right' })

  let y = 140
  doc.moveTo(56, y).lineTo(56 + W, y).strokeColor('#E2E8F0').lineWidth(1).stroke()
  y += 20
  const col = (label: string, lines: string[], x: number) => {
    doc.fillColor(MUTED).fontSize(8).font('Helvetica-Bold').text(label.toUpperCase(), x, y, { characterSpacing: 0.8 })
    doc.fillColor(TEXT).fontSize(10).font('Helvetica')
    lines.forEach((l, i) => doc.text(l, x, y + 16 + i * 14))
  }
  col('Client', [s.clientName, s.clientPhone, s.clientEmail ?? ''].filter(Boolean), 56)
  col('Expédition', [s.trackingId, s.mode === 'AIR' ? 'Fret aérien' : 'Fret maritime', statusLabel(s.status, s.mode)], 56 + W / 2)

  y += 90
  doc.rect(56, y, W, 26).fill('#F1F5F9')
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
  doc.moveTo(56, y).lineTo(56 + W, y).strokeColor('#E2E8F0').stroke()
  y += 16
  doc.fillColor(MUTED).font('Helvetica').fontSize(10).text('Total à payer', 56 + W * 0.5, y, { width: W * 0.25 })
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(16).text(xof(s.priceXof), 56 + W * 0.6, y - 3, { width: W * 0.4, align: 'right' })

  const code = await bwipjs.toBuffer({ bcid: 'code128', text: s.trackingId, scale: 2, height: 9 })
  doc.image(code, 56, 700, { height: 34 })
  doc.fillColor(MUTED).font('Helvetica').fontSize(8)
    .text('Paiement à l’agence de Lomé ou par Mobile Money avant retrait. Merci de votre confiance.', 56, 750, { width: W })
    .text('Benit Cargo — Guangzhou · Lomé', 56, 764, { width: W })
  return toBuffer(doc)
}

/** 100 × 150 mm thermal label for warehouse parcels. */
export async function labelPdf(s: InvoiceShipment): Promise<Buffer> {
  const mm = (v: number) => (v * 72) / 25.4
  const doc = new PDFDocument({ size: [mm(100), mm(150)], margin: mm(6), info: { Title: `Étiquette ${s.trackingId}` } })
  const W = mm(88)
  const x = mm(6)

  doc.rect(0, 0, mm(100), mm(18)).fill(NAVY)
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(14).text('BENIT CARGO', x, mm(6))
  doc.font('Helvetica').fontSize(8).text(s.mode === 'AIR' ? 'AÉRIEN' : 'MARITIME', x, mm(7), { width: W, align: 'right' })

  doc.fillColor(MUTED).fontSize(7).font('Helvetica-Bold').text('GUANGZHOU  →  LOMÉ', x, mm(23), { characterSpacing: 1 })
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
  doc.fillColor(MUTED).fontSize(7).text('Suivi : benitcargo.com', x, mm(140))
  return toBuffer(doc)
}
