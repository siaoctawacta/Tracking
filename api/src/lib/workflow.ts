import { prisma } from '../db'
import { STATUSES, STATUS_LOCATION, type Status } from './domain'
import { queueStatusAlert } from './whatsapp'

export const statusIndex = (s: string) => STATUSES.indexOf(s as Status)

interface ApplyOptions {
  actorId: string
  note?: string | null
  location?: string | null
}

/**
 * Moves one shipment to a new status: updates it, appends a timeline event and — when the
 * parcel moves forward — sends the client the WhatsApp alert for that step.
 * Backward corrections (admin only) are recorded silently so the client is not confused.
 */
export async function applyStatus(shipmentId: string, status: Status, opts: ApplyOptions) {
  const before = await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId }, select: { status: true } })
  const [shipment] = await prisma.$transaction([
    prisma.shipment.update({ where: { id: shipmentId }, data: { status } }),
    prisma.shipmentEvent.create({
      data: {
        shipmentId,
        status,
        location: opts.location || STATUS_LOCATION[status],
        note: opts.note || null,
        createdById: opts.actorId,
      },
    }),
  ])
  if (statusIndex(status) > statusIndex(before.status)) await queueStatusAlert(shipmentId, status, { note: opts.note })
  return shipment
}
