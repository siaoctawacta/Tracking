import { Router, type Request } from 'express'
import { z } from 'zod'
import { prisma } from '../db'
import { canSetStatus, computePrice, MODES, newTrackingId, normalizePhone, STAFF_ROLES, STATUSES, statusLabel, STATUS_LOCATION, type Role } from '../lib/domain'
import { invoicePdf, labelPdf } from '../lib/pdf'
import { photoStorage } from '../lib/storage'
import { photoUpload, storePhoto } from '../lib/uploads'
import { applyStatus, statusIndex } from '../lib/workflow'
import { activeProvider, previewStatusAlert, queueStatusAlert, resendAlert } from '../lib/whatsapp'
import { notifyStaff } from '../lib/staffNotify'
import { requireRole } from '../middleware/auth'
import { HttpError } from '../middleware/errors'

export const shipmentsRouter = Router()

const isStaff = (role: Role) => STAFF_ROLES.includes(role)

const withLabels = <T extends { status: string; mode: string }>(s: T) => ({ ...s, statusLabel: statusLabel(s.status, s.mode) })

/** Loads a shipment and enforces object-level access: staff, or the client whose phone/email it belongs to. */
async function loadAccessible(req: Request, id: string) {
  const shipment = await prisma.shipment.findUnique({ where: { id }, include: { container: true } })
  if (!shipment) throw new HttpError(404, 'Expédition introuvable', 'not_found')
  if (isStaff(req.user!.role)) return shipment
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } })
  const owns = !!user && ((!!user.phone && user.phone === shipment.clientPhone) || (!!user.email && user.email === shipment.clientEmail))
  // 404 rather than 403 so IDs of other customers' shipments cannot be probed.
  if (!owns) throw new HttpError(404, 'Expédition introuvable', 'not_found')
  return shipment
}

// ---------- Client space ----------

shipmentsRouter.get('/mine', requireRole('CLIENT'), async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } })
  if (!user) throw new HttpError(401, 'Authentification requise', 'unauthenticated')
  const or = [user.phone ? { clientPhone: user.phone } : null, user.email ? { clientEmail: user.email } : null].filter((x) => x !== null)
  const shipments = or.length
    ? await prisma.shipment.findMany({
        where: { OR: or },
        orderBy: { createdAt: 'desc' },
        include: { container: { select: { code: true, etaAt: true } }, _count: { select: { photos: true } } },
      })
    : []
  res.json({ shipments: shipments.map(withLabels) })
})

// ---------- Staff listing & stats ----------

const ListQuery = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.enum(STATUSES).optional(),
  mode: z.enum(MODES).optional(),
  unassigned: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
})

shipmentsRouter.get('/', requireRole(...STAFF_ROLES), async (req, res) => {
  const q = ListQuery.parse(req.query)
  const where = {
    ...(q.status && { status: q.status }),
    ...(q.mode && { mode: q.mode }),
    ...(q.unassigned === 'true' && { containerId: null }),
    ...(q.q && {
      OR: [
        { trackingId: { contains: q.q.toUpperCase() } },
        { clientName: { contains: q.q, mode: 'insensitive' as const } },
        { clientPhone: { contains: q.q.replace(/\s/g, '') } },
        { description: { contains: q.q, mode: 'insensitive' as const } },
      ],
    }),
  }
  const [total, shipments] = await prisma.$transaction([
    prisma.shipment.count({ where }),
    prisma.shipment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: { container: { select: { id: true, code: true } } },
    }),
  ])
  res.json({ shipments: shipments.map(withLabels), total, page: q.page, pageSize: q.pageSize })
})

shipmentsRouter.get('/stats', requireRole(...STAFF_ROLES), async (_req, res) => {
  const [byStatus, byMode, openContainers, recent] = await prisma.$transaction([
    prisma.shipment.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } }),
    prisma.shipment.groupBy({ by: ['mode'], _count: { _all: true }, _sum: { priceXof: true, weightKg: true, volumeCbm: true }, orderBy: { mode: 'asc' } }),
    prisma.container.count({ where: { state: 'OPEN' } }),
    prisma.shipmentEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 8, include: { shipment: { select: { id: true, trackingId: true, mode: true } } } }),
  ])
  res.json({
    byStatus: Object.fromEntries(STATUSES.map((s) => [s, byStatus.find((b) => b.status === s)?._count?._all ?? 0])),
    byMode: byMode.map((m) => ({ mode: m.mode, count: m._count?._all ?? 0, revenueXof: m._sum?.priceXof ?? 0, weightKg: m._sum?.weightKg ?? 0, volumeCbm: m._sum?.volumeCbm ?? 0 })),
    openContainers,
    recent: recent.map((e) => ({ id: e.id, status: e.status, label: statusLabel(e.status, e.shipment.mode), at: e.createdAt, shipment: e.shipment })),
  })
})

// ---------- Detail ----------

shipmentsRouter.get('/:id', async (req, res) => {
  const base = await loadAccessible(req, req.params.id as string)
  const staff = isStaff(req.user!.role)
  const s = await prisma.shipment.findUniqueOrThrow({
    where: { id: base.id },
    include: {
      container: true,
      events: { orderBy: { createdAt: 'asc' }, include: { createdBy: { select: { name: true } } } },
      photos: { orderBy: { createdAt: 'asc' }, select: { id: true, mimeType: true, size: true, createdAt: true } },
      notifications: staff ? { orderBy: { createdAt: 'desc' } } : false,
      createdBy: { select: { name: true } },
    },
  })
  res.json({
    shipment: {
      ...withLabels(s),
      events: s.events.map((e) => ({ ...e, label: statusLabel(e.status, s.mode), createdBy: staff ? e.createdBy : undefined, createdById: undefined })),
      createdBy: staff ? s.createdBy : undefined,
      createdById: undefined,
    },
  })
})

// ---------- Create (Guangzhou warehouse reception) ----------

const num = (min: number, max: number) => z.coerce.number().min(min).max(max)

const CreateBody = z
  .object({
    description: z.string().trim().min(2).max(200),
    mode: z.enum(MODES),
    pieces: z.coerce.number().int().min(1).max(10_000).default(1),
    weightKg: num(0.01, 100_000),
    volumeCbm: num(0, 1_000),
    clientName: z.string().trim().min(2).max(120),
    clientPhone: z.string().trim().min(6).max(25).regex(/^[+\d\s().-]+$/, 'Numéro invalide'),
    clientEmail: z.string().trim().toLowerCase().email().max(160).optional().or(z.literal('').transform(() => undefined)),
    notify: z.enum(['true', 'false']).optional(),
  })
  .strict()

shipmentsRouter.post('/', requireRole('AGENT_GZ', 'ADMIN'), photoUpload.array('photos', 8), async (req, res) => {
  const body = CreateBody.parse(req.body ?? {})
  const files = (req.files as Express.Multer.File[] | undefined) ?? []
  const stored = await Promise.all(files.map(storePhoto))

  let trackingId = newTrackingId()
  while (await prisma.shipment.findUnique({ where: { trackingId } })) trackingId = newTrackingId()

  const shipment = await prisma.shipment.create({
    data: {
      trackingId,
      description: body.description,
      mode: body.mode,
      pieces: body.pieces,
      weightKg: body.weightKg,
      volumeCbm: body.volumeCbm,
      priceXof: computePrice(body.mode, body.weightKg, body.volumeCbm),
      clientName: body.clientName,
      clientPhone: normalizePhone(body.clientPhone),
      clientEmail: body.clientEmail,
      createdById: req.user!.sub,
      events: { create: { status: 'REGISTERED', location: STATUS_LOCATION.REGISTERED, note: 'Colis réceptionné et contrôlé à l’entrepôt.', createdById: req.user!.sub } },
      photos: { create: stored },
    },
  })
  if (body.notify !== 'false') await queueStatusAlert(shipment.id, 'REGISTERED')
  res.status(201).json({ shipment: withLabels(shipment) })
})

// ---------- Status update (+ WhatsApp alert) ----------

const StatusBody = z
  .object({
    status: z.enum(STATUSES),
    note: z.string().trim().max(280).optional(),
    location: z.string().trim().max(120).optional(),
  })
  .strict()

shipmentsRouter.patch('/:id/status', requireRole(...STAFF_ROLES), async (req, res) => {
  const body = StatusBody.parse(req.body)
  const role = req.user!.role
  const shipment = await loadAccessible(req, req.params.id as string)
  if (!canSetStatus(role, body.status)) throw new HttpError(403, 'Votre rôle ne permet pas ce changement de statut', 'forbidden_status')
  if (role !== 'ADMIN' && statusIndex(body.status) <= statusIndex(shipment.status)) {
    throw new HttpError(409, 'Le statut ne peut qu’avancer dans la chaîne logistique', 'status_backwards')
  }
  const updated = await applyStatus(shipment.id, body.status, { actorId: req.user!.sub, note: body.note, location: body.location })
  if (body.status === 'ARRIVED' && statusIndex(shipment.status) < statusIndex('ARRIVED')) {
    await notifyStaff('SHIPMENT_ARRIVED', `Colis ${updated.trackingId} arrivé à Lomé`, `${updated.clientName} · ${updated.description}`, `/admin/colis/${updated.id}`, ['ADMIN', 'AGENT_GZ'])
  }
  res.json({ shipment: withLabels(updated) })
})

// ---------- WhatsApp alerts ----------

const PreviewQuery = z.object({ status: z.enum(STATUSES), note: z.string().trim().max(280).optional() })

/** Exact message the client will receive if the agent validates this step. */
shipmentsRouter.get('/:id/alert-preview', requireRole(...STAFF_ROLES), async (req, res) => {
  const q = PreviewQuery.parse(req.query)
  const shipment = await loadAccessible(req, req.params.id as string)
  res.json({ body: await previewStatusAlert(shipment.id, q.status, q.note), provider: activeProvider() })
})

shipmentsRouter.post('/:id/notifications/:notificationId/resend', requireRole(...STAFF_ROLES), async (req, res) => {
  const shipment = await loadAccessible(req, req.params.id as string)
  const n = await prisma.notification.findFirst({ where: { id: req.params.notificationId as string, shipmentId: shipment.id } })
  if (!n) throw new HttpError(404, 'Alerte introuvable', 'not_found')
  res.json({ notification: await resendAlert(n.id) })
})

// ---------- Photos ----------

shipmentsRouter.post('/:id/photos', requireRole('AGENT_GZ', 'ADMIN'), photoUpload.array('photos', 8), async (req, res) => {
  const shipment = await loadAccessible(req, req.params.id as string)
  const files = (req.files as Express.Multer.File[] | undefined) ?? []
  if (!files.length) throw new HttpError(400, 'Aucune image reçue (JPEG, PNG ou WebP)', 'no_file')
  const stored = await Promise.all(files.map(storePhoto))
  await prisma.photo.createMany({ data: stored.map((p) => ({ ...p, shipmentId: shipment.id })) })
  const photos = await prisma.photo.findMany({ where: { shipmentId: shipment.id }, select: { id: true, mimeType: true, size: true, createdAt: true } })
  res.status(201).json({ photos })
})

shipmentsRouter.get('/:id/photos/:photoId', async (req, res) => {
  const shipment = await loadAccessible(req, req.params.id as string)
  const photo = await prisma.photo.findFirst({ where: { id: req.params.photoId as string, shipmentId: shipment.id } })
  if (!photo) throw new HttpError(404, 'Photo introuvable', 'not_found')
  const body = await photoStorage().get(photo.fileName)
  if (!body) throw new HttpError(404, 'Photo introuvable', 'not_found')
  res.set({ 'Cache-Control': 'private, max-age=3600', 'Content-Type': photo.mimeType, 'X-Content-Type-Options': 'nosniff' })
  res.send(body)
})

// ---------- Documents ----------

shipmentsRouter.get('/:id/invoice.pdf', async (req, res) => {
  const shipment = await loadAccessible(req, req.params.id as string)
  const pdf = await invoicePdf(shipment)
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="facture-${shipment.trackingId}.pdf"`, 'Cache-Control': 'private, no-store' })
  res.send(pdf)
})

shipmentsRouter.get('/:id/label.pdf', requireRole(...STAFF_ROLES), async (req, res) => {
  const shipment = await loadAccessible(req, req.params.id as string)
  const pdf = await labelPdf(shipment)
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="etiquette-${shipment.trackingId}.pdf"`, 'Cache-Control': 'private, no-store' })
  res.send(pdf)
})
