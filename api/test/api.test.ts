import request from 'supertest'
import { beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { prisma } from '../src/db'

const app = createApp()
let ipSeq = 10
const nextIp = () => `10.0.0.${ipSeq++}`

/** A browser-like session: cookie jar + CSRF token + stable IP. */
async function session(login?: { identifier: string; password: string }) {
  const agent = request.agent(app)
  const ip = nextIp()
  const { body } = await agent.get('/api/v1/auth/csrf').set('X-Forwarded-For', ip)
  const csrf = body.csrfToken as string
  const s = {
    agent,
    csrf,
    get: (url: string) => agent.get(url).set('X-Forwarded-For', ip),
    post: (url: string) => agent.post(url).set('X-Forwarded-For', ip).set('X-CSRF-Token', csrf),
    patch: (url: string) => agent.patch(url).set('X-Forwarded-For', ip).set('X-CSRF-Token', csrf),
  }
  if (login) {
    const res = await s.post('/api/v1/auth/login').send(login)
    expect(res.status).toBe(200)
  }
  return s
}

const ADMIN = { identifier: 'admin@benitcargo.com', password: 'Admin#Benit2026' }
const GZ = { identifier: 'gz@benitcargo.com', password: 'Guangzhou#2026' }
const LOME = { identifier: 'lome@benitcargo.com', password: 'Lome#Agence2026' }
const AFI = { identifier: '90 11 22 33', password: 'Client#2026' }
const YAO = { identifier: '+22891445566', password: 'Client#2026' }

describe('authentication & sessions', () => {
  it('stores passwords as Argon2id hashes with a per-user salt', async () => {
    const users = await prisma.user.findMany()
    for (const u of users) expect(u.passwordHash).toMatch(/^\$argon2id\$v=19\$m=65536,t=3,p=1\$/)
    const salts = new Set(users.map((u) => u.passwordHash.split('$')[4]))
    expect(salts.size).toBe(users.length)
  })

  it('rejects state-changing requests without a CSRF token', async () => {
    const res = await request(app).post('/api/v1/auth/login').set('X-Forwarded-For', nextIp()).send(ADMIN)
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('csrf_invalid')
  })

  it('returns the same generic error for unknown user and wrong password', async () => {
    const s = await session()
    const a = await s.post('/api/v1/auth/login').send({ identifier: 'nobody@x.com', password: 'whatever' })
    const b = await s.post('/api/v1/auth/login').send({ identifier: ADMIN.identifier, password: 'wrong-password' })
    expect(a.status).toBe(401)
    expect(b.status).toBe(401)
    expect(a.body).toEqual(b.body)
  })

  it('rate-limits login to 5 attempts per IP per 15 minutes', async () => {
    const s = await session()
    for (let i = 0; i < 5; i++) await s.post('/api/v1/auth/login').send({ identifier: 'x@x.com', password: 'nope' })
    const res = await s.post('/api/v1/auth/login').send(ADMIN)
    expect(res.status).toBe(429)
  })

  it('issues HttpOnly SameSite=Strict cookies and never returns the token in the body', async () => {
    const s = await session()
    const res = await s.post('/api/v1/auth/login').send(ADMIN)
    expect(res.status).toBe(200)
    const cookies = res.headers['set-cookie'] as unknown as string[]
    const jwt = cookies.find((c) => c.startsWith('jwt='))!
    expect(jwt).toMatch(/HttpOnly/)
    expect(jwt).toMatch(/SameSite=Strict/)
    expect(jwt).toMatch(/Max-Age=900/)
    expect(JSON.stringify(res.body)).not.toMatch(/eyJ/)
    expect(res.body.user).not.toHaveProperty('passwordHash')
    expect((await s.get('/api/v1/auth/me')).body.user.role).toBe('ADMIN')
  })

  it('rotates the refresh token on every refresh', async () => {
    const s = await session(ADMIN)
    const before = await prisma.refreshToken.count({ where: { revokedAt: null } })
    const r1 = await s.post('/api/v1/auth/refresh')
    expect(r1.status).toBe(200)
    expect((r1.headers['set-cookie'] as unknown as string[]).some((c) => c.startsWith('rt='))).toBe(true)
    // One token revoked (and linked to its successor), one issued: active count unchanged.
    expect(await prisma.refreshToken.count({ where: { revokedAt: null } })).toBe(before)
    const rotated = await prisma.refreshToken.findFirst({ where: { replacedBy: { not: null } }, orderBy: { createdAt: 'desc' } })
    expect(rotated?.revokedAt).toBeTruthy()
  })

  it('detects reuse of a rotated refresh token', async () => {
    const s = await session()
    const login = await s.post('/api/v1/auth/login').send(GZ)
    const rt = (login.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('rt='))!.split(';')[0]
    await s.post('/api/v1/auth/refresh')
    const replay = await request(app).post('/api/v1/auth/refresh').set('X-Forwarded-For', nextIp()).set('Cookie', [rt, `csrf=${s.csrf}`]).set('X-CSRF-Token', s.csrf)
    expect(replay.status).toBe(401)
    expect(replay.body.error.code).toBe('token_reused')
    // The legitimate session's refresh token is revoked too.
    expect((await s.post('/api/v1/auth/refresh')).status).toBe(401)
  })

  it('logout revokes the session', async () => {
    const s = await session(LOME)
    expect((await s.post('/api/v1/auth/logout')).status).toBe(204)
    expect((await s.get('/api/v1/auth/me')).status).toBe(401)
    expect((await s.post('/api/v1/auth/refresh')).status).toBe(401)
  })

  it('session probe never 401s and reports refreshability', async () => {
    const anon = await request(app).get('/api/v1/auth/session')
    expect(anon.status).toBe(200)
    expect(anon.body).toEqual({ user: null, refreshable: false })
    const s = await session(ADMIN)
    expect((await s.get('/api/v1/auth/session')).body.user.role).toBe('ADMIN')
  })

  it('rejects forged JWTs', async () => {
    const forged = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4Iiwicm9sZSI6IkFETUlOIn0.'
    const res = await request(app).get('/api/v1/auth/me').set('Cookie', `jwt=${forged}`)
    expect(res.status).toBe(401)
  })
})

describe('public tracking', () => {
  it('returns a timeline without exposing personal data', async () => {
    const res = await request(app).get('/api/v1/tracking/bc-2026-889x').set('X-Forwarded-For', nextIp())
    expect(res.status).toBe(200)
    expect(res.body.tracking.statusLabel).toBe('En mer')
    expect(res.body.tracking.events.length).toBe(3)
    expect(JSON.stringify(res.body)).not.toContain('90112233')
    expect(JSON.stringify(res.body)).not.toContain('Mensah')
  })
  it('validates the format and 404s unknown parcels', async () => {
    expect((await request(app).get('/api/v1/tracking/abc').set('X-Forwarded-For', nextIp())).status).toBe(400)
    expect((await request(app).get('/api/v1/tracking/BC-2026-ZZZZZZ').set('X-Forwarded-For', nextIp())).status).toBe(404)
  })
})

describe('shipments workflow & RBAC', () => {
  let shipmentId = ''
  let trackingId = ''

  beforeAll(async () => {
    const gz = await session(GZ)
    const res = await gz.post('/api/v1/shipments').field('description', 'Téléviseurs 55"').field('mode', 'SEA')
      .field('pieces', '2').field('weightKg', '40').field('volumeCbm', '0.5')
      .field('clientName', 'Yao Kodjo').field('clientPhone', '91 44 55 66')
    expect(res.status).toBe(201)
    shipmentId = res.body.shipment.id
    trackingId = res.body.shipment.trackingId
  })

  it('creates a shipment with a tracking ID, computed price and a WhatsApp alert', async () => {
    expect(trackingId).toMatch(/^BC-\d{4}-[A-Z0-9]{6}$/)
    const s = await prisma.shipment.findUnique({ where: { id: shipmentId } })
    expect(s?.clientPhone).toBe('+22891445566')
    expect(s?.priceXof).toBe(125_000)
    expect(await prisma.notification.count({ where: { shipmentId } })).toBe(1)
  })

  it('forbids clients from creating shipments', async () => {
    const c = await session(AFI)
    const res = await c.post('/api/v1/shipments').send({})
    expect(res.status).toBe(403)
  })

  it('rejects unknown fields (strict DTO)', async () => {
    const gz = await session(GZ)
    const res = await gz.patch(`/api/v1/shipments/${shipmentId}/status`).send({ status: 'LOADING', priceXof: 1 })
    expect(res.status).toBe(400)
  })

  it('enforces role-specific statuses and forward-only transitions', async () => {
    const lome = await session(LOME)
    expect((await lome.patch(`/api/v1/shipments/${shipmentId}/status`).send({ status: 'LOADING' })).status).toBe(403)
    const gz = await session(GZ)
    expect((await gz.patch(`/api/v1/shipments/${shipmentId}/status`).send({ status: 'IN_TRANSIT' })).status).toBe(200)
    expect((await gz.patch(`/api/v1/shipments/${shipmentId}/status`).send({ status: 'LOADING' })).status).toBe(409)
    expect((await lome.patch(`/api/v1/shipments/${shipmentId}/status`).send({ status: 'ARRIVED', note: 'Déchargé au port' })).status).toBe(200)
    expect(await prisma.notification.count({ where: { shipmentId } })).toBe(3)
  })

  it('scopes the client dashboard to their own parcels', async () => {
    const yao = await session(YAO)
    const mine = await yao.get('/api/v1/shipments/mine')
    expect(mine.body.shipments.map((s: any) => s.trackingId)).toContain(trackingId)
    expect(mine.body.shipments.every((s: any) => s.clientPhone === '+22891445566')).toBe(true)

    const afi = await session(AFI)
    expect((await afi.get(`/api/v1/shipments/${shipmentId}`)).status).toBe(404)
    expect((await afi.get(`/api/v1/shipments/${shipmentId}/invoice.pdf`)).status).toBe(404)
    expect((await afi.get('/api/v1/shipments')).status).toBe(403)

    const pdf = await yao.get(`/api/v1/shipments/${shipmentId}/invoice.pdf`)
    expect(pdf.status).toBe(200)
    expect(pdf.headers['content-type']).toBe('application/pdf')
  })

  it('rejects files that are not real images', async () => {
    const gz = await session(GZ)
    const res = await gz.post(`/api/v1/shipments/${shipmentId}/photos`)
      .attach('photos', Buffer.from('<?php echo 1; ?>'), { filename: 'x.jpg', contentType: 'image/jpeg' })
    expect(res.status).toBe(400)
  })

  it('accepts real images and serves them only to authorised users', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
    const gz = await session(GZ)
    const res = await gz.post(`/api/v1/shipments/${shipmentId}/photos`).attach('photos', png, { filename: 'qc.png', contentType: 'image/png' })
    expect(res.status).toBe(201)
    const photoId = res.body.photos[0].id
    expect((await (await session(YAO)).get(`/api/v1/shipments/${shipmentId}/photos/${photoId}`)).status).toBe(200)
    expect((await (await session(AFI)).get(`/api/v1/shipments/${shipmentId}/photos/${photoId}`)).status).toBe(404)
  })
})

describe('containers', () => {
  it('assigns, closes and bulk-updates a batch', async () => {
    const gz = await session(GZ)
    const c = await gz.post('/api/v1/containers').send({ mode: 'AIR' })
    expect(c.status).toBe(201)
    const id = c.body.container.id

    const created = await gz.post('/api/v1/shipments').send({ description: 'Montres', mode: 'AIR', weightKg: 3, volumeCbm: 0.01, clientName: 'Afi Mensah', clientPhone: '+22890112233' })
    const tid = created.body.shipment.trackingId
    const assign = await gz.post(`/api/v1/containers/${id}/shipments`).send({ trackingIds: [tid, 'BC-2026-889X', 'BC-2026-NOPE00'] })
    expect(assign.body.assigned).toBe(1)
    expect(assign.body.rejected).toHaveLength(2)

    expect((await gz.patch(`/api/v1/containers/${id}/status`).send({ status: 'IN_TRANSIT' })).status).toBe(409)
    expect((await gz.post(`/api/v1/containers/${id}/close`)).status).toBe(200)
    expect((await prisma.shipment.findUnique({ where: { trackingId: tid } }))?.status).toBe('LOADING')

    const bulk = await gz.patch(`/api/v1/containers/${id}/status`).send({ status: 'IN_TRANSIT' })
    expect(bulk.body.updated).toBe(1)
    const lome = await session(LOME)
    expect((await lome.patch(`/api/v1/containers/${id}/status`).send({ status: 'IN_TRANSIT' })).status).toBe(403)
    expect((await lome.patch(`/api/v1/containers/${id}/status`).send({ status: 'ARRIVED' })).body.updated).toBe(1)
  })
})

describe('admin users', () => {
  it('only admins can create accounts; passwords are hashed', async () => {
    const gz = await session(GZ)
    expect((await gz.post('/api/v1/users').send({})).status).toBe(403)
    const admin = await session(ADMIN)
    const res = await admin.post('/api/v1/users').send({ name: 'Nouveau Client', phone: '90 55 44 33', role: 'CLIENT', password: 'TresSecret#1' })
    expect(res.status).toBe(201)
    const u = await prisma.user.findUnique({ where: { phone: '+22890554433' } })
    expect(u?.passwordHash).not.toContain('TresSecret')
  })
})
