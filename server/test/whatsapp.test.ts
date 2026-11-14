import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app'
import { config } from '../src/config'
import { prisma } from '../src/db'
import { composeStatusMessage, queueStatusAlert, type AlertShipment } from '../src/lib/whatsapp'

const app = createApp()
let ip = 100
async function staff(identifier: string, password: string) {
  const agent = request.agent(app)
  const addr = `10.1.0.${ip++}`
  const csrf = (await agent.get('/api/v1/auth/csrf').set('X-Forwarded-For', addr)).body.csrfToken as string
  const s = {
    get: (u: string) => agent.get(u).set('X-Forwarded-For', addr),
    post: (u: string) => agent.post(u).set('X-Forwarded-For', addr).set('X-CSRF-Token', csrf),
    patch: (u: string) => agent.patch(u).set('X-Forwarded-For', addr).set('X-CSRF-Token', csrf),
  }
  expect((await s.post('/api/v1/auth/login').send({ identifier, password })).status).toBe(200)
  return s
}
const ADMIN = ['admin@kadercargo.com', 'Admin#Kader2026'] as const
const GZ = ['gz@kadercargo.com', 'Guangzhou#2026'] as const

const sample: AlertShipment = {
  id: 'x', trackingId: 'KC-2026-TEST01', clientName: 'afi Mensah', clientPhone: '+22890112233', mode: 'AIR',
  description: 'Smartphones', pieces: 2, weightKg: 12.5, priceXof: 118_800,
  container: { code: 'AIR-2026-P9XD', etaAt: new Date('2026-11-20T12:00:00Z') },
}

describe('WhatsApp message wording', () => {
  it('writes a specific, well-formed message for every step', () => {
    const reg = composeStatusMessage(sample, 'REGISTERED').body
    expect(reg).toContain('Colis bien reçu à Guangzhou')
    expect(reg).toContain('Bonjour Afi,')
    expect(reg).toContain('*KC-2026-TEST01*')
    expect(reg).toContain('118 800 FCFA')
    expect(reg).toContain('●○○○○○  Étape 1/6')

    expect(composeStatusMessage(sample, 'LOADING').body).toContain('lot *AIR-2026-P9XD*')
    const flight = composeStatusMessage(sample, 'IN_TRANSIT').body
    expect(flight).toContain('Votre colis est en vol')
    expect(flight).toContain('Arrivée prévue : *vendredi 20 novembre*')
    expect(composeStatusMessage({ ...sample, mode: 'SEA' }, 'IN_TRANSIT').body).toContain('en mer')
    expect(composeStatusMessage(sample, 'ARRIVED').body).toContain('dédouanement')

    const ready = composeStatusMessage(sample, 'READY').body
    expect(ready).toContain('Montant à régler : *118 800 FCFA*')
    expect(ready).toContain('+228 90 94 44 48 (Moussa)')
    expect(ready).toContain('●●●●●○  Étape 5/6')
    expect(composeStatusMessage(sample, 'DELIVERED', null, new Date('2026-11-25T10:00:00Z')).body).toContain('remis le mercredi 25 novembre')
  })

  it('includes the agent note and returns template variables', () => {
    const { body, vars } = composeStatusMessage(sample, 'IN_TRANSIT', 'Vol ET 607 via Addis-Abeba')
    expect(body).toContain('📝 Note de l’agence : Vol ET 607 via Addis-Abeba')
    expect(vars).toEqual(['Afi', 'KC-2026-TEST01', 'vendredi 20 novembre'])
  })
})

describe('WhatsApp alerts on every step', () => {
  it('sends exactly one alert per step cleared, none on backward corrections', async () => {
    const gz = await staff(...GZ)
    const created = await gz.post('/api/v1/shipments').send({ description: 'Sacs', mode: 'AIR', weightKg: 5, volumeCbm: 0.02, clientName: 'Yao Kodjo', clientPhone: '+22891445566' })
    const id = created.body.shipment.id
    await gz.patch(`/api/v1/shipments/${id}/status`).send({ status: 'LOADING' })
    await gz.patch(`/api/v1/shipments/${id}/status`).send({ status: 'IN_TRANSIT' })

    const admin = await staff(...ADMIN)
    await admin.patch(`/api/v1/shipments/${id}/status`).send({ status: 'LOADING' }) // correction backwards
    await admin.patch(`/api/v1/shipments/${id}/status`).send({ status: 'IN_TRANSIT' }) // forward again, already announced

    const alerts = await prisma.notification.findMany({ where: { shipmentId: id }, orderBy: { createdAt: 'asc' } })
    expect(alerts.map((a) => a.step)).toEqual(['REGISTERED', 'LOADING', 'IN_TRANSIT'])
    expect(alerts.every((a) => a.to === '+22891445566' && a.status === 'SIMULATED')).toBe(true)
  })

  it('previews the exact message for staff only, and can resend an alert', async () => {
    const gz = await staff(...GZ)
    const s = await prisma.shipment.findUniqueOrThrow({ where: { trackingId: 'KC-2026-B8K4TY' } })
    const preview = await gz.get(`/api/v1/shipments/${s.id}/alert-preview?status=LOADING&note=Départ%20demain`)
    expect(preview.status).toBe(200)
    expect(preview.body.body).toContain('Colis en préparation')
    expect(preview.body.body).toContain('Départ demain')
    expect(preview.body.provider).toBe('simulated')

    const n = await queueStatusAlert(s.id, 'REGISTERED')
    const resend = await gz.post(`/api/v1/shipments/${s.id}/notifications/${n!.id}/resend`)
    expect(resend.status).toBe(200)
    expect(resend.body.notification.attempts).toBe(2)
  })
})

describe('WhatsApp providers', () => {
  const saved = structuredClone(config.whatsapp)
  afterEach(() => {
    Object.assign(config.whatsapp, structuredClone(saved))
    vi.unstubAllGlobals()
  })

  async function waitFor(id: string) {
    for (let i = 0; i < 50; i++) {
      const n = await prisma.notification.findUniqueOrThrow({ where: { id } })
      if (n.status !== 'PENDING') return n
      await new Promise((r) => setTimeout(r, 20))
    }
    throw new Error('alert still pending')
  }

  it('delivers through Twilio with an approved Content template', async () => {
    Object.assign(config.whatsapp.twilio, { sid: 'AC123', token: 'tok', from: '+14155238886', contentSids: { READY: 'HXready' } })
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ sid: 'SM1' }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    const s = await prisma.shipment.findUniqueOrThrow({ where: { trackingId: 'KC-2026-R2D4HN' } })

    const n = await queueStatusAlert(s.id, 'READY', { force: true })
    const done = await waitFor(n!.id)
    expect(done.status).toBe('SENT')
    expect(done.providerMessageId).toBe('SM1')
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('/Accounts/AC123/Messages.json')
    const form = new URLSearchParams(init.body as URLSearchParams)
    expect(form.get('To')).toBe('whatsapp:+22890112233')
    expect(form.get('ContentSid')).toBe('HXready')
    expect(JSON.parse(form.get('ContentVariables')!)).toMatchObject({ 1: 'Afi', 2: 'KC-2026-R2D4HN' })
  })

  it('delivers through Meta Cloud API templates and records failures', async () => {
    Object.assign(config.whatsapp.meta, { token: 'EAA', phoneNumberId: '123', templatePrefix: 'kader_' })
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ messages: [{ id: 'wamid.1' }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const s = await prisma.shipment.findUniqueOrThrow({ where: { trackingId: 'KC-2026-HT6M3C' } })
    const done = await waitFor((await queueStatusAlert(s.id, 'ARRIVED', { force: true }))!.id)
    expect(done.status).toBe('SENT')
    const payload = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(payload.template.name).toBe('kader_arrived')
    expect(payload.to).toBe('22891445566')

    // Provider error → recorded on the alert (retried in the background), never thrown to the caller.
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'Template not approved' } }), { status: 400 })))
    const failing = await queueStatusAlert(s.id, 'ARRIVED', { force: true })
    await new Promise((r) => setTimeout(r, 100))
    const after = await prisma.notification.findUniqueOrThrow({ where: { id: failing!.id } })
    expect(after.error).toContain('Template not approved')
    expect(after.attempts).toBe(1)
  })
})
