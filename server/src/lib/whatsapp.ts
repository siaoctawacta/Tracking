/**
 * WhatsApp alerts — one clear message to the client each time their parcel clears a step.
 *
 * - `composeStatusMessage` writes the message for a step (French, WhatsApp formatting).
 * - `queueStatusAlert` records the alert and delivers it in the background (never blocks or
 *   breaks the business operation), with automatic retries and de-duplication per step.
 * - Providers: Twilio (free text or approved Content templates) or Meta WhatsApp Cloud API
 *   (approved templates or free text). Without credentials, alerts are simulated: logged and
 *   visible in the back-office, so the workflow can be tested end to end.
 */
import { config } from '../config'
import { prisma } from '../db'
import { company } from './company'
import { isServerless, runInBackground, sleep } from './background'
import { STATUSES, type Status } from './domain'
import { notifyStaff } from './staffNotify'

export interface AlertShipment {
  id: string
  trackingId: string
  clientName: string
  clientPhone: string
  mode: string
  description: string
  pieces: number
  weightKg: number
  priceXof: number
  container?: { code: string; etaAt: Date | null } | null
}

/** Template variables, in this order, for providers that require approved templates. */
export type TemplateVars = [firstName: string, trackingId: string, detail: string]

const TZ = 'Africa/Lome'
const xof = (n: number) => new Intl.NumberFormat('fr-FR').format(n).replace(/ | /g, ' ') + ' FCFA'
const num = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n)
const longDate = (d: Date) => d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ })
const firstName = (name: string) => {
  const f = name.trim().split(/\s+/)[0] ?? ''
  return f ? f[0].toUpperCase() + f.slice(1) : 'cher client'
}

function progress(status: Status) {
  const i = STATUSES.indexOf(status)
  return `${'●'.repeat(i + 1)}${'○'.repeat(STATUSES.length - i - 1)}  Étape ${i + 1}/${STATUSES.length}`
}

export function trackingUrl(trackingId: string) {
  return config.publicWebUrl ? `${config.publicWebUrl}/suivi/${trackingId}` : ''
}

/** Builds the message announcing that `s` has reached `status`. */
export function composeStatusMessage(s: AlertShipment, status: Status, note?: string | null, now = new Date()): { body: string; vars: TemplateVars } {
  const name = firstName(s.clientName)
  const id = `*${s.trackingId}*`
  const air = s.mode === 'AIR'
  const lot = s.container?.code
  const eta = s.container?.etaAt ? longDate(s.container.etaAt) : null
  const lomeContact = company.lome.contacts[0]

  let title: string
  let lines: string[]
  let detail: string

  switch (status) {
    case 'REGISTERED':
      title = '📦 *Colis bien reçu à Guangzhou*'
      lines = [
        `Votre colis ${id} a été réceptionné et contrôlé dans notre entrepôt de Guangzhou.`,
        '',
        `• Contenu : ${s.description}`,
        `• ${s.pieces} colis · ${num(s.weightKg)} kg`,
        `• Mode : ${air ? 'aérien express ✈️' : 'maritime 🚢'}`,
        `• Montant : ${xof(s.priceXof)}`,
        '',
        'Conservez bien ce numéro de suivi : il vous sera demandé au retrait.',
      ]
      detail = `${s.pieces} colis · ${num(s.weightKg)} kg · ${xof(s.priceXof)}`
      break
    case 'LOADING':
      title = '🗂️ *Colis en préparation d’expédition*'
      lines = [`Votre colis ${id} est en cours de chargement${lot ? ` dans le lot *${lot}*` : ''} à Guangzhou. Il partira très prochainement.`]
      detail = lot ?? 'Guangzhou'
      break
    case 'IN_TRANSIT':
      title = air ? '✈️ *Votre colis est en vol*' : '🚢 *Votre colis est en mer*'
      lines = [
        air ? `Votre colis ${id} a décollé de Guangzhou à destination de Lomé.` : `Votre colis ${id} a quitté la Chine par bateau à destination de Lomé.`,
        eta ? `Arrivée prévue : *${eta}*.` : 'Nous vous préviendrons dès son arrivée.',
      ]
      detail = eta ?? 'à confirmer'
      break
    case 'ARRIVED':
      title = air ? '🛬 *Votre colis est arrivé à Lomé*' : '⚓ *Votre colis est arrivé au port de Lomé*'
      lines = [`Votre colis ${id} est bien arrivé à Lomé. Il est en cours de dédouanement : nous vous prévenons dès qu’il est prêt.`]
      detail = 'Lomé'
      break
    case 'READY':
      title = '✅ *Votre colis est prêt*'
      lines = [
        `Bonne nouvelle : votre colis ${id} est dédouané et disponible.`,
        '',
        `• Montant à régler : *${xof(s.priceXof)}*`,
        '• À présenter : votre numéro de suivi et une pièce d’identité',
        `• Retrait : ${company.lome.label}, ou livraison à votre porte sur demande`,
        '',
        `Contact Lomé : ${lomeContact.phone} (${lomeContact.name})`,
      ]
      detail = xof(s.priceXof)
      break
    case 'DELIVERED':
      title = '🤝 *Colis remis — merci !*'
      lines = [`Votre colis ${id} vous a été remis le ${longDate(now)}.`, 'Merci de votre confiance. À très bientôt pour votre prochain envoi depuis Guangzhou !']
      detail = longDate(now)
      break
  }

  const link = trackingUrl(s.trackingId)
  const body = [
    title,
    '',
    `Bonjour ${name},`,
    ...lines,
    ...(note ? ['', `📝 Note de l’agence : ${note}`] : []),
    '',
    progress(status),
    ...(link ? [`🔎 Suivre votre colis : ${link}`] : []),
    '',
    `_${company.name} · ${company.tagline} · WhatsApp ${company.whatsapp}_`,
  ].join('\n')

  return { body, vars: [name, s.trackingId, detail] }
}

// ---------------------------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------------------------

export type Provider = 'twilio' | 'meta' | 'simulated'

export function activeProvider(): Provider {
  const { provider, twilio, meta } = config.whatsapp
  if (provider === 'twilio' || provider === 'meta' || provider === 'simulated') return provider
  if (twilio.sid && twilio.token && twilio.from) return 'twilio'
  if (meta.token && meta.phoneNumberId) return 'meta'
  return 'simulated'
}

const digits = (phone: string) => phone.replace(/\D/g, '')

async function sendTwilio(to: string, body: string, step: string, vars: string[]): Promise<string> {
  const { sid, token, from, contentSids } = config.whatsapp.twilio
  const params = new URLSearchParams({ From: `whatsapp:${from}`, To: `whatsapp:+${digits(to)}` })
  if (contentSids[step]) {
    params.set('ContentSid', contentSids[step])
    params.set('ContentVariables', JSON.stringify(Object.fromEntries(vars.map((v, i) => [String(i + 1), v]))))
  } else {
    params.set('Body', body)
  }
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
    signal: AbortSignal.timeout(10_000),
  })
  const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string }
  if (!res.ok) throw new Error(`Twilio ${res.status}${json.message ? ` — ${json.message}` : ''}`)
  return json.sid ?? ''
}

async function sendMeta(to: string, body: string, step: string, vars: string[]): Promise<string> {
  const { token, phoneNumberId, templatePrefix, language } = config.whatsapp.meta
  const payload = templatePrefix
    ? {
        messaging_product: 'whatsapp',
        to: digits(to),
        type: 'template',
        template: {
          name: `${templatePrefix}${step.toLowerCase()}`,
          language: { code: language },
          components: [
            { type: 'body', parameters: vars.map((text) => ({ type: 'text', text })) },
            // Authentication templates carry the code in a "copy code" button as well.
            ...(step === 'OTP' ? [{ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: vars[0] }] }] : []),
          ],
        },
      }
    : { messaging_product: 'whatsapp', to: digits(to), type: 'text', text: { body, preview_url: true } }
  const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  })
  const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } }
  if (!res.ok) throw new Error(`Meta ${res.status}${json.error?.message ? ` — ${json.error.message}` : ''}`)
  return json.messages?.[0]?.id ?? ''
}

export const MAX_ATTEMPTS = 3
/** Wait before attempts 1, 2, 3. Shorter on serverless: the retries must fit in one function run (maxDuration). */
const retryDelays = () => (isServerless() ? [0, 5_000, 20_000] : [0, 30_000, 120_000])

/**
 * Sends one WhatsApp message right away (awaited) — used for verification codes and account
 * notices, where the caller needs to know whether it went out. `key` selects the approved
 * template (Twilio content SID map / Meta `${prefix}${key}`).
 */
export async function sendWhatsAppNow(to: string, body: string, key: 'OTP' | 'ACCOUNT', vars: string[]): Promise<'SENT' | 'SIMULATED'> {
  const provider = activeProvider()
  if (provider === 'simulated') {
    if (!config.isTest) console.info(`[whatsapp:simulated] → ${to}\n${body}\n`)
    return 'SIMULATED'
  }
  await (provider === 'meta' ? sendMeta : sendTwilio)(to, body, key, vars)
  return 'SENT'
}

/**
 * Delivers a recorded alert, retrying up to MAX_ATTEMPTS times. Runs in the background (see
 * runInBackground). Anything still PENDING afterwards (e.g. the function was stopped) is picked up
 * by the maintenance job (retryStuckAlerts).
 */
async function deliver(notificationId: string, vars: TemplateVars, firstAttempt = 1): Promise<void> {
  const delays = retryDelays()
  for (let attempt = firstAttempt; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > firstAttempt) await sleep(delays[attempt - 1] ?? 0)
    const n = await prisma.notification.findUnique({ where: { id: notificationId } })
    if (!n || n.status === 'SENT') return
    try {
      const provider = activeProvider()
      const send = provider === 'meta' ? sendMeta : sendTwilio
      const providerMessageId = await send(n.to, n.body, n.step ?? '', vars)
      await prisma.notification.update({ where: { id: n.id }, data: { status: 'SENT', attempts: attempt, sentAt: new Date(), error: null, providerMessageId } })
      return
    } catch (e) {
      const error = (e instanceof Error ? e.message : String(e)).slice(0, 300)
      const last = attempt >= MAX_ATTEMPTS
      await prisma.notification.update({ where: { id: n.id }, data: { status: last ? 'FAILED' : 'PENDING', attempts: attempt, error } })
      if (last) {
        console.error(`[whatsapp] alert ${n.id} failed after ${attempt} attempts: ${error}`)
        await notifyStaff('WHATSAPP_FAILED', 'Alerte WhatsApp non délivrée', `${n.to} · ${error}`, `/admin/colis/${n.shipmentId}`, ['ADMIN'])
      }
    }
  }
}

/** Maintenance: re-sends alerts left PENDING for more than 10 minutes (interrupted deliveries). */
export async function retryStuckAlerts() {
  if (activeProvider() === 'simulated') return 0
  const stuck = await prisma.notification.findMany({
    where: { status: 'PENDING', createdAt: { lt: new Date(Date.now() - 10 * 60_000) }, attempts: { lt: MAX_ATTEMPTS } },
    include: { shipment: { include: { container: { select: { code: true, etaAt: true } } } } },
    take: 50,
  })
  for (const n of stuck) {
    const { vars } = composeStatusMessage(n.shipment, (n.step ?? n.shipment.status) as Status)
    await deliver(n.id, vars, n.attempts + 1)
  }
  return stuck.length
}

async function loadAlertShipment(shipmentId: string) {
  return prisma.shipment.findUnique({ where: { id: shipmentId }, include: { container: { select: { code: true, etaAt: true } } } })
}

/**
 * Announces to the client that their parcel reached `status`.
 * At most one alert per step and parcel, unless `force` (manual resend from the back-office).
 */
export async function queueStatusAlert(shipmentId: string, status: Status, opts: { note?: string | null; force?: boolean } = {}) {
  const s = await loadAlertShipment(shipmentId)
  if (!s) return null
  if (!opts.force) {
    const already = await prisma.notification.findFirst({ where: { shipmentId, step: status, status: { in: ['PENDING', 'SENT', 'SIMULATED'] } } })
    if (already) return null
  }
  const { body, vars } = composeStatusMessage(s, status, opts.note)
  const provider = activeProvider()

  if (provider === 'simulated') {
    if (!config.isTest) console.info(`[whatsapp:simulated] → ${s.clientPhone}\n${body}\n`)
    return prisma.notification.create({ data: { shipmentId, step: status, to: s.clientPhone, body, status: 'SIMULATED', attempts: 1, sentAt: new Date() } })
  }
  const n = await prisma.notification.create({ data: { shipmentId, step: status, to: s.clientPhone, body, status: 'PENDING' } })
  runInBackground('whatsapp', () => deliver(n.id, vars)) // the HTTP request never waits on WhatsApp
  return n
}

/** Re-sends an existing alert (same text) — used by the back-office "Renvoyer" action. */
export async function resendAlert(notificationId: string) {
  const n = await prisma.notification.findUnique({ where: { id: notificationId } })
  if (!n) return null
  const s = await loadAlertShipment(n.shipmentId)
  if (!s) return null
  const step = (n.step ?? s.status) as Status
  const { vars } = composeStatusMessage(s, step)
  if (activeProvider() === 'simulated') {
    return prisma.notification.update({ where: { id: n.id }, data: { status: 'SIMULATED', attempts: { increment: 1 }, sentAt: new Date(), error: null } })
  }
  const updated = await prisma.notification.update({ where: { id: n.id }, data: { status: 'PENDING', error: null } })
  runInBackground('whatsapp', () => deliver(n.id, vars, 1))
  return updated
}

/** What the client would receive — shown to agents before they validate a step. */
export async function previewStatusAlert(shipmentId: string, status: Status, note?: string | null) {
  const s = await loadAlertShipment(shipmentId)
  return s ? composeStatusMessage(s, status, note).body : null
}
