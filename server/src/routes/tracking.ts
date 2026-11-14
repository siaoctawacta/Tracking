import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { PostgresStore } from '../lib/rateLimitStore'
import { prisma } from '../db'
import { statusLabel } from '../lib/domain'
import { HttpError } from '../middleware/errors'

export const trackingRouter = Router()

// Public endpoint: throttle to make tracking-number enumeration impractical.
trackingRouter.use(rateLimit({ store: new PostgresStore('tracking'), windowMs: 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false }))

const TRACKING_RE = /^KC-\d{4}-[A-Z0-9]{4,8}$/

const maskName = (n: string) =>
  n.split(/\s+/).filter(Boolean).map((p, i) => (i === 0 ? p : p[0] + '.')).join(' ')
const maskPhone = (p: string) => p.slice(0, 4) + ' •• •• ' + p.slice(-2)

trackingRouter.get('/:trackingId', async (req, res) => {
  const trackingId = String(req.params.trackingId).trim().toUpperCase()
  if (!TRACKING_RE.test(trackingId)) throw new HttpError(400, 'Format de numéro de suivi invalide (ex : KC-2026-7KX9QA)', 'bad_tracking_id')

  const s = await prisma.shipment.findUnique({
    where: { trackingId },
    include: { events: { orderBy: { createdAt: 'asc' } }, container: true },
  })
  if (!s) throw new HttpError(404, 'Aucun colis ne correspond à ce numéro', 'not_found')

  res.set('Cache-Control', 'no-store').json({
    tracking: {
      trackingId: s.trackingId,
      mode: s.mode,
      status: s.status,
      statusLabel: statusLabel(s.status, s.mode),
      description: s.description,
      pieces: s.pieces,
      weightKg: s.weightKg,
      volumeCbm: s.volumeCbm,
      recipient: maskName(s.clientName),
      recipientPhone: maskPhone(s.clientPhone),
      origin: 'Guangzhou, Chine',
      destination: 'Lomé, Togo',
      container: s.container ? { code: s.container.code, departureAt: s.container.departureAt, etaAt: s.container.etaAt } : null,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      events: s.events.map((e) => ({
        status: e.status,
        label: statusLabel(e.status, s.mode),
        location: e.location,
        note: e.note,
        at: e.createdAt,
      })),
    },
  })
})
