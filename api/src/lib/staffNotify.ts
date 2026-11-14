import { prisma } from '../db'
import type { Role } from './domain'

export type StaffNotificationType = 'ACCOUNT_PENDING' | 'CONTAINER_DEPARTED' | 'CONTAINER_ARRIVED' | 'SHIPMENT_ARRIVED' | 'WHATSAPP_FAILED'

/** Posts a back-office notification (bell + sound) to the given staff roles. Never throws. */
export async function notifyStaff(type: StaffNotificationType, title: string, body: string, link: string | null, roles: Role[]) {
  try {
    await prisma.staffNotification.create({ data: { type, title, body, link, roles: roles.join(',') } })
  } catch (e) {
    console.error('[staff-notify]', e)
  }
}
