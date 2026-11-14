import { prisma } from '../db'
import { STATUSES, STATUS_LOCATION, type Status } from './domain'
import { notifyStatusChange } from './whatsapp'

export const statusIndex = (s: string) => STATUSES.indexOf(s as Status)

interface ApplyOptions {
  actorId: string
  note?: string | null
  location?: string | null
}

/** Moves one shipment to a new status: updates it, appends a timeline event, sends the WhatsApp alert. */
export async function applyStatus(shipmentId: string, status: Status, opts: ApplyOptions) {
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
  await notifyStatusChange(shipment, status, opts.note)
  return shipment
}
