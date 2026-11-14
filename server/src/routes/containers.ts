import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db'
import { canSetStatus, MODES, newContainerCode, STAFF_ROLES, STATUSES, statusLabel } from '../lib/domain'
import { applyStatus, statusIndex } from '../lib/workflow'
import { notifyStaff } from '../lib/staffNotify'
import { requireRole } from '../middleware/auth'
import { HttpError } from '../middleware/errors'

export const containersRouter = Router()
containersRouter.use(requireRole(...STAFF_ROLES))

async function getContainer(id: string) {
  const c = await prisma.container.findUnique({ where: { id } })
  if (!c) throw new HttpError(404, 'Conteneur introuvable', 'not_found')
  return c
}

containersRouter.get('/', async (_req, res) => {
  const containers = await prisma.container.findMany({
    orderBy: { createdAt: 'desc' },
    include: { shipments: { select: { status: true, weightKg: true, volumeCbm: true } } },
  })
  res.json({
    containers: containers.map(({ shipments, ...c }) => ({
      ...c,
      count: shipments.length,
      weightKg: Math.round(shipments.reduce((a, s) => a + s.weightKg, 0) * 100) / 100,
      volumeCbm: Math.round(shipments.reduce((a, s) => a + s.volumeCbm, 0) * 1000) / 1000,
      // The "slowest" parcel defines where the batch is.
      status: shipments.length ? STATUSES[Math.min(...shipments.map((s) => statusIndex(s.status)))] : null,
    })),
  })
})

const optDate = z.union([z.string().datetime({ offset: true }), z.string().date()]).optional().transform((v) => (v ? new Date(v) : undefined))
const CreateBody = z.object({ mode: z.enum(MODES), departureAt: optDate, etaAt: optDate }).strict()

containersRouter.post('/', requireRole('AGENT_GZ', 'ADMIN'), async (req, res) => {
  const body = CreateBody.parse(req.body)
  let code = newContainerCode(body.mode)
  while (await prisma.container.findUnique({ where: { code } })) code = newContainerCode(body.mode)
  const container = await prisma.container.create({ data: { code, mode: body.mode, departureAt: body.departureAt, etaAt: body.etaAt } })
  res.status(201).json({ container })
})

containersRouter.get('/:id', async (req, res) => {
  const c = await prisma.container.findUnique({
    where: { id: req.params.id },
    include: { shipments: { orderBy: { createdAt: 'asc' } } },
  })
  if (!c) throw new HttpError(404, 'Conteneur introuvable', 'not_found')
  res.json({ container: { ...c, shipments: c.shipments.map((s) => ({ ...s, statusLabel: statusLabel(s.status, s.mode) })) } })
})

const UpdateBody = z.object({ departureAt: optDate, etaAt: optDate }).strict()
containersRouter.patch('/:id', requireRole('AGENT_GZ', 'ADMIN'), async (req, res) => {
  const body = UpdateBody.parse(req.body)
  await getContainer(req.params.id as string)
  const container = await prisma.container.update({ where: { id: req.params.id as string }, data: body })
  res.json({ container })
})

const AssignBody = z.object({ trackingIds: z.array(z.string().trim().toUpperCase().max(20)).min(1).max(500) }).strict()

containersRouter.post('/:id/shipments', requireRole('AGENT_GZ', 'ADMIN'), async (req, res) => {
  const c = await getContainer(req.params.id as string)
  if (c.state !== 'OPEN') throw new HttpError(409, 'Ce conteneur est clôturé', 'container_closed')
  const { trackingIds } = AssignBody.parse(req.body)
  const found = await prisma.shipment.findMany({ where: { trackingId: { in: trackingIds } }, include: { container: true } })
  const rejected: { trackingId: string; reason: string }[] = []
  const ok: string[] = []
  for (const id of trackingIds) {
    const s = found.find((f) => f.trackingId === id)
    if (!s) rejected.push({ trackingId: id, reason: 'Introuvable' })
    else if (s.mode !== c.mode) rejected.push({ trackingId: id, reason: s.mode === 'AIR' ? 'Colis aérien' : 'Colis maritime' })
    else if (s.status !== 'REGISTERED') rejected.push({ trackingId: id, reason: 'Déjà expédié' })
    else if (s.container && s.container.state !== 'OPEN') rejected.push({ trackingId: id, reason: `Dans ${s.container.code}` })
    else ok.push(s.id)
  }
  if (ok.length) await prisma.shipment.updateMany({ where: { id: { in: ok } }, data: { containerId: c.id } })
  res.json({ assigned: ok.length, rejected })
})

containersRouter.delete('/:id/shipments/:shipmentId', requireRole('AGENT_GZ', 'ADMIN'), async (req, res) => {
  const c = await getContainer(req.params.id as string)
  if (c.state !== 'OPEN') throw new HttpError(409, 'Ce conteneur est clôturé', 'container_closed')
  const { count } = await prisma.shipment.updateMany({ where: { id: req.params.shipmentId as string, containerId: c.id }, data: { containerId: null } })
  if (!count) throw new HttpError(404, 'Colis absent de ce conteneur', 'not_found')
  res.status(204).end()
})

/** Closing a batch seals it and moves every parcel to "En cours de chargement". */
containersRouter.post('/:id/close', requireRole('AGENT_GZ', 'ADMIN'), async (req, res) => {
  const c = await getContainer(req.params.id as string)
  if (c.state !== 'OPEN') throw new HttpError(409, 'Conteneur déjà clôturé', 'container_closed')
  const shipments = await prisma.shipment.findMany({ where: { containerId: c.id } })
  if (!shipments.length) throw new HttpError(409, 'Impossible de clôturer un conteneur vide', 'container_empty')
  await prisma.container.update({ where: { id: c.id }, data: { state: 'CLOSED', closedAt: new Date() } })
  for (const s of shipments) {
    if (statusIndex(s.status) < statusIndex('LOADING')) {
      await applyStatus(s.id, 'LOADING', { actorId: req.user!.sub, note: `Chargé dans ${c.code}.` })
    }
  }
  res.json({ container: await prisma.container.findUnique({ where: { id: c.id } }), updated: shipments.length })
})

const BulkBody = z.object({ status: z.enum(STATUSES), note: z.string().trim().max(280).optional(), location: z.string().trim().max(120).optional() }).strict()

/** Bulk status change for every parcel of a closed batch (+ one WhatsApp alert per parcel). */
containersRouter.patch('/:id/status', async (req, res) => {
  const body = BulkBody.parse(req.body)
  const role = req.user!.role
  if (!canSetStatus(role, body.status)) throw new HttpError(403, 'Votre rôle ne permet pas ce changement de statut', 'forbidden_status')
  const c = await getContainer(req.params.id as string)
  if (c.state !== 'CLOSED') throw new HttpError(409, 'Clôturez le conteneur avant de modifier les statuts en masse', 'container_open')
  const shipments = await prisma.shipment.findMany({ where: { containerId: c.id } })
  const targets = shipments.filter((s) => role === 'ADMIN' ? s.status !== body.status : statusIndex(s.status) < statusIndex(body.status))
  for (const s of targets) await applyStatus(s.id, body.status, { actorId: req.user!.sub, note: body.note, location: body.location })
  if (body.status === 'IN_TRANSIT' && !c.departureAt) await prisma.container.update({ where: { id: c.id }, data: { departureAt: new Date() } })
  if (targets.length && (body.status === 'IN_TRANSIT' || body.status === 'ARRIVED')) {
    const air = c.mode === 'AIR'
    const n = `${targets.length} colis`
    const eta = c.etaAt ? ` · arrivée prévue le ${c.etaAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}` : ''
    if (body.status === 'IN_TRANSIT') {
      await notifyStaff('CONTAINER_DEPARTED', air ? `Le vol ${c.code} a décollé ✈️` : `Le bateau du conteneur ${c.code} est parti 🚢`, `${n} en route vers Lomé${eta}`, `/admin/conteneurs/${c.id}`, ['ADMIN', 'AGENT_LOME'])
    } else {
      await notifyStaff('CONTAINER_ARRIVED', air ? `Le vol ${c.code} est arrivé à Lomé 🛬` : `Le bateau est arrivé : conteneur ${c.code} au port de Lomé ⚓`, `${n} à dédouaner et à préparer pour le retrait`, `/admin/conteneurs/${c.id}`, ['ADMIN', 'AGENT_LOME', 'AGENT_GZ'])
    }
  }
  res.json({ updated: targets.length, skipped: shipments.length - targets.length })
})
