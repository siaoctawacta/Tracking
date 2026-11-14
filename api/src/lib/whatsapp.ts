import { config } from '../config'
import { prisma } from '../db'
import { statusLabel } from './domain'

interface ShipmentLike {
  id: string
  trackingId: string
  clientName: string
  clientPhone: string
  mode: string
}

export function buildStatusMessage(s: ShipmentLike, status: string, note?: string | null) {
  const lines = [
    `Benit Cargo — Bonjour ${s.clientName.split(' ')[0]},`,
    `Votre colis ${s.trackingId} : ${statusLabel(status, s.mode)}.`,
  ]
  if (note) lines.push(note)
  if (status === 'READY') lines.push('Présentez ce numéro de suivi à notre agence de Lomé pour le retrait.')
  return lines.join('\n')
}

async function sendViaTwilio(to: string, body: string) {
  const { sid, token, from } = config.twilio
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ From: `whatsapp:${from}`, To: `whatsapp:${to}`, Body: body }),
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`Twilio HTTP ${res.status}`)
}

/**
 * Sends (or simulates, when Twilio is not configured) a WhatsApp alert and records it.
 * Failures never break the business operation that triggered them.
 */
export async function notifyStatusChange(s: ShipmentLike, status: string, note?: string | null) {
  const body = buildStatusMessage(s, status, note)
  const enabled = !!(config.twilio.sid && config.twilio.token && config.twilio.from)
  let state = 'SIMULATED'
  let error: string | undefined
  if (enabled) {
    try {
      await sendViaTwilio(s.clientPhone, body)
      state = 'SENT'
    } catch (e) {
      state = 'FAILED'
      error = e instanceof Error ? e.message : String(e)
    }
  } else if (!config.isTest) {
    console.info(`[whatsapp:simulated] → ${s.clientPhone}: ${body.replace(/\n/g, ' | ')}`)
  }
  return prisma.notification.create({
    data: { shipmentId: s.id, to: s.clientPhone, body, status: state, error },
  })
}
