import { exportJWK, generateKeyPair, SignJWT, createLocalJWKSet } from 'jose'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { config } from '../src/config'
import { prisma } from '../src/db'
import { setGoogleKeysForTests } from '../src/lib/google'

const app = createApp()
let ipSeq = 1
function client() {
  const agent = request.agent(app)
  const ip = `10.2.0.${ipSeq++}`
  let csrf = ''
  const s = {
    init: async () => { csrf = (await agent.get('/api/v1/auth/csrf').set('X-Forwarded-For', ip)).body.csrfToken; return s },
    get: (u: string) => agent.get(u).set('X-Forwarded-For', ip),
    post: (u: string) => agent.post(u).set('X-Forwarded-For', ip).set('X-CSRF-Token', csrf),
    patch: (u: string) => agent.patch(u).set('X-Forwarded-For', ip).set('X-CSRF-Token', csrf),
    del: (u: string) => agent.delete(u).set('X-Forwarded-For', ip).set('X-CSRF-Token', csrf),
  }
  return s
}
async function staff(identifier: string, password: string) {
  const s = await client().init()
  expect((await s.post('/api/v1/auth/login').send({ identifier, password })).status).toBe(200)
  return s
}
const admin = () => staff('admin@kadercargo.com', 'Admin#Kader2026')
const approve = async (userId: string, decision: 'APPROVE' | 'REJECT' = 'APPROVE') => (await admin()).post(`/api/v1/users/${userId}/approval`).send({ decision })

const savedOtp = { ...config.otp }
beforeAll(() => Object.assign(config.otp, { resendCooldownMs: 0, maxPerHour: 1000 }))
afterAll(() => { Object.assign(config.otp, savedOtp); setGoogleKeysForTests(null) })

describe('client sign-up by phone (WhatsApp code)', () => {
  const phone = '+228 97 00 11 22'
  let userId = ''

  it('sends a code, rejects wrong codes, creates a pending account', async () => {
    const c = await client().init()
    const start = await c.post('/api/v1/auth/register/start').send({ name: 'Ama Koffi', identifier: phone, password: 'MotDePasse#2026' })
    expect(start.status).toBe(200)
    expect(start.body).toMatchObject({ channel: 'WHATSAPP', destination: '+228 •• •• 22' })
    expect(start.body.devCode).toMatch(/^\d{6}$/)

    const otp = await prisma.otpCode.findFirstOrThrow({ where: { destination: '+22897001122' }, orderBy: { createdAt: 'desc' } })
    expect(otp.codeHash).not.toContain(start.body.devCode) // only an HMAC is stored

    const wrong = start.body.devCode === '000000' ? '111111' : '000000'
    expect((await c.post('/api/v1/auth/register/verify').send({ identifier: phone, code: wrong })).status).toBe(400)
    const ok = await c.post('/api/v1/auth/register/verify').send({ identifier: phone, code: start.body.devCode })
    expect(ok.status).toBe(202)
    expect(ok.body.status).toBe('PENDING_APPROVAL')
    // a code works once
    expect((await c.post('/api/v1/auth/register/verify').send({ identifier: phone, code: start.body.devCode })).status).toBe(400)

    const u = await prisma.user.findUniqueOrThrow({ where: { phone: '+22897001122' } })
    expect(u).toMatchObject({ role: 'CLIENT', approvalStatus: 'PENDING', signupMethod: 'PHONE' })
    expect(u.phoneVerifiedAt).toBeTruthy()
    expect(u.passwordHash).toMatch(/^\$argon2id\$/)
    userId = u.id
    expect(await prisma.staffNotification.count({ where: { type: 'ACCOUNT_PENDING', body: { contains: '+22897001122' } } })).toBe(1)
  })

  it('cannot sign in until an admin validates the account', async () => {
    const c = await client().init()
    const pw = await c.post('/api/v1/auth/login').send({ identifier: phone, password: 'MotDePasse#2026' })
    expect(pw.status).toBe(403)
    expect(pw.body.error.code).toBe('account_pending')
    const code = (await c.post('/api/v1/auth/otp/request').send({ identifier: phone })).body.devCode
    expect((await c.post('/api/v1/auth/otp/verify').send({ identifier: phone, code })).body.error.code).toBe('account_pending')
  })

  it('after approval, signs in with a WhatsApp code and sees parcels sent to that number', async () => {
    const res = await approve(userId)
    expect(res.status).toBe(200)
    expect(res.body.user.approvalStatus).toBe('APPROVED')
    expect(res.body.notified).toBe(true)

    const c = await client().init()
    const code = (await c.post('/api/v1/auth/otp/request').send({ identifier: '97001122' })).body.devCode
    const login = await c.post('/api/v1/auth/otp/verify').send({ identifier: '97001122', code })
    expect(login.status).toBe(200)
    expect(login.body.user.phone).toBe('+22897001122')
    expect((await c.get('/api/v1/auth/me')).status).toBe(200)
    expect((await c.get('/api/v1/shipments/mine')).status).toBe(200)
  })

  it('locks a code after 5 wrong attempts', async () => {
    const c = await client().init()
    const { devCode } = (await c.post('/api/v1/auth/otp/request').send({ identifier: phone })).body
    const wrong = devCode === '000000' ? '111111' : '000000'
    for (let i = 0; i < 5; i++) await c.post('/api/v1/auth/otp/verify').send({ identifier: phone, code: wrong })
    const r = await c.post('/api/v1/auth/otp/verify').send({ identifier: phone, code: devCode })
    expect(r.status).toBe(400)
    expect(r.body.error.code).toBe('otp_locked')
  })
})

describe('anti-enumeration and throttling', () => {
  it('answers sign-up the same way for an existing customer, and signs them in with the code', async () => {
    const c = await client().init()
    const res = await c.post('/api/v1/auth/register/start').send({ name: 'Quelqu’un', identifier: '+22890112233' })
    expect(res.status).toBe(200)
    expect(Object.keys(res.body).sort()).toEqual(['channel', 'destination', 'devCode'])
    const v = await c.post('/api/v1/auth/register/verify').send({ identifier: '+22890112233', code: res.body.devCode })
    expect(v.body.status).toBe('SIGNED_IN')
    expect((await prisma.user.findUniqueOrThrow({ where: { phone: '+22890112233' } })).name).toBe('Afi Mensah') // untouched
  })

  it('code requests for unknown accounts look identical (no code leaves the server)', async () => {
    const c = await client().init()
    const res = await c.post('/api/v1/auth/otp/request').send({ identifier: '+22899999999' })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ channel: 'WHATSAPP', destination: '+228 •• •• 99' })
    expect(await prisma.otpCode.count({ where: { destination: '+22899999999' } })).toBe(0)
  })

  it('enforces a resend cooldown', async () => {
    config.otp.resendCooldownMs = 60_000
    try {
      const c = await client().init()
      await c.post('/api/v1/auth/otp/request').send({ identifier: 'afi.mensah@example.com' })
      const again = await c.post('/api/v1/auth/otp/request').send({ identifier: 'afi.mensah@example.com' })
      expect(again.status).toBe(429)
      expect(again.body.error.code).toBe('otp_cooldown')
    } finally {
      config.otp.resendCooldownMs = 0
    }
  })
})

describe('sign-up by e-mail and linking a phone', () => {
  it('registers with an e-mail code, then links a WhatsApp number to the same account', async () => {
    const c = await client().init()
    const start = await c.post('/api/v1/auth/register/start').send({ name: 'Edem Lawson', identifier: 'Edem.Lawson@Gmail.com' })
    expect(start.body.channel).toBe('EMAIL')
    expect(start.body.destination).toBe('ed•••@gmail.com')
    await c.post('/api/v1/auth/register/verify').send({ identifier: 'edem.lawson@gmail.com', code: start.body.devCode })
    const u = await prisma.user.findUniqueOrThrow({ where: { email: 'edem.lawson@gmail.com' } })
    expect(u.passwordHash).toBeNull() // code-only account
    await approve(u.id)

    const code = (await c.post('/api/v1/auth/otp/request').send({ identifier: 'edem.lawson@gmail.com' })).body.devCode
    expect((await c.post('/api/v1/auth/otp/verify').send({ identifier: 'edem.lawson@gmail.com', code })).status).toBe(200)
    expect((await c.get('/api/v1/shipments/mine')).body.shipments).toHaveLength(0)

    // Another customer's number cannot be linked.
    expect((await c.post('/api/v1/account/link/start').send({ identifier: '+22890112233' })).status).toBe(409)

    // Link the phone his parcels are registered under (seed: KC-2026-W3NZ7F → +22893778899).
    const link = await c.post('/api/v1/account/link/start').send({ identifier: '93 77 88 99' })
    expect(link.body.channel).toBe('WHATSAPP')
    const done = await c.post('/api/v1/account/link/verify').send({ identifier: '93 77 88 99', code: link.body.devCode })
    expect(done.status).toBe(200)
    expect(done.body.methods.phone.value).toBe('+22893778899')
    expect((await c.get('/api/v1/shipments/mine')).body.shipments.map((s: { trackingId: string }) => s.trackingId)).toContain('KC-2026-W3NZ7F')

    // Add a password, then sign in with it via the phone.
    expect((await c.post('/api/v1/account/password').send({ newPassword: 'Nouveau#Pass26' })).body.methods.password).toBe(true)
    const pw = await (await client().init()).post('/api/v1/auth/login').send({ identifier: '+22893778899', password: 'Nouveau#Pass26' })
    expect(pw.status).toBe(200)
  })
})

describe('Google sign-in', () => {
  let sign: (claims: Record<string, unknown>) => Promise<string>
  beforeAll(async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256')
    const jwk = { ...(await exportJWK(publicKey)), kid: 'test', alg: 'RS256' }
    setGoogleKeysForTests(createLocalJWKSet({ keys: [jwk] }))
    config.googleClientId = 'kader-test.apps.googleusercontent.com'
    sign = (claims) =>
      new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: 'test' }).setIssuer('https://accounts.google.com')
        .setAudience(config.googleClientId).setIssuedAt().setExpirationTime('5m').sign(privateKey)
  })

  it('creates a pending account, then signs in once validated', async () => {
    const c = await client().init()
    const credential = await sign({ sub: 'g-123', email: 'yawa.dogbe@gmail.com', email_verified: true, name: 'Yawa Dogbe' })
    const first = await c.post('/api/v1/auth/google').send({ credential })
    expect(first.status).toBe(202)
    const u = await prisma.user.findUniqueOrThrow({ where: { googleSub: 'g-123' } })
    expect(u).toMatchObject({ email: 'yawa.dogbe@gmail.com', signupMethod: 'GOOGLE', approvalStatus: 'PENDING' })
    await approve(u.id)
    const second = await c.post('/api/v1/auth/google').send({ credential })
    expect(second.status).toBe(200)
    expect(second.body.status).toBe('SIGNED_IN')
  })

  it('links Google to an existing account with the same verified Gmail', async () => {
    const credential = await sign({ sub: 'g-afi', email: 'afi.mensah@example.com', email_verified: true, name: 'Afi' })
    const res = await (await client().init()).post('/api/v1/auth/google').send({ credential })
    expect(res.body.user.phone).toBe('+22890112233')
    expect((await prisma.user.findUniqueOrThrow({ where: { email: 'afi.mensah@example.com' } })).googleSub).toBe('g-afi')
  })

  it('rejects tokens for another audience or with a bad signature', async () => {
    const wrongAud = await new SignJWT({ sub: 'x' }).setProtectedHeader({ alg: 'HS256' }).setIssuer('https://accounts.google.com').setAudience('other').setExpirationTime('5m').sign(new TextEncoder().encode('x'.repeat(32)))
    expect((await (await client().init()).post('/api/v1/auth/google').send({ credential: wrongAud })).status).toBe(401)
  })
})

describe('admin validation and staff notifications', () => {
  it('rejected sign-ups cannot sign in', async () => {
    const c = await client().init()
    const start = await c.post('/api/v1/auth/register/start').send({ name: 'Spam', identifier: 'spam@example.com' })
    await c.post('/api/v1/auth/register/verify').send({ identifier: 'spam@example.com', code: start.body.devCode })
    const u = await prisma.user.findUniqueOrThrow({ where: { email: 'spam@example.com' } })
    expect((await approve(u.id, 'REJECT')).body.user.approvalStatus).toBe('REJECTED')
    const code = (await c.post('/api/v1/auth/otp/request').send({ identifier: 'spam@example.com' })).body.devCode
    expect((await c.post('/api/v1/auth/otp/verify').send({ identifier: 'spam@example.com', code })).body.error.code).toBe('account_rejected')
  })

  it('lists pending accounts for admins only', async () => {
    const a = await admin()
    const list = await a.get('/api/v1/users?status=PENDING')
    expect(list.body.pending).toBeGreaterThan(0)
    expect(list.body.users.every((u: { approvalStatus: string }) => u.approvalStatus === 'PENDING')).toBe(true)
    const gz = await staff('gz@kadercargo.com', 'Guangzhou#2026')
    expect((await gz.get('/api/v1/users?status=PENDING')).status).toBe(403)
  })

  it('feeds the bell: role audience, unread count, mark as read', async () => {
    const a = await admin()
    const feed = await a.get('/api/v1/staff/notifications')
    expect(feed.status).toBe(200)
    expect(feed.body.unread).toBeGreaterThan(0)
    expect(feed.body.notifications.some((n: { type: string }) => n.type === 'ACCOUNT_PENDING')).toBe(true)
    expect((await a.post('/api/v1/staff/notifications/read')).status).toBe(204)
    expect((await a.get('/api/v1/staff/notifications')).body.unread).toBe(0)

    // Lomé agents are not told about sign-ups, and clients have no feed at all.
    const lome = await staff('lome@kadercargo.com', 'Lome#Agence2026')
    expect((await lome.get('/api/v1/staff/notifications')).body.notifications.some((n: { type: string }) => n.type === 'ACCOUNT_PENDING')).toBe(false)
    const afi = await client().init()
    const code = (await afi.post('/api/v1/auth/otp/request').send({ identifier: '+22890112233' })).body.devCode
    await afi.post('/api/v1/auth/otp/verify').send({ identifier: '+22890112233', code })
    expect((await afi.get('/api/v1/staff/notifications')).status).toBe(403)
  })

  it('notifies staff when a container leaves and when the boat arrives', async () => {
    const gz = await staff('gz@kadercargo.com', 'Guangzhou#2026')
    const c = (await gz.post('/api/v1/containers').send({ mode: 'SEA', etaAt: '2026-12-20' })).body.container
    const s = (await gz.post('/api/v1/shipments').send({ description: 'Carrelage', mode: 'SEA', weightKg: 300, volumeCbm: 1.2, clientName: 'Afi Mensah', clientPhone: '+22890112233' })).body.shipment
    await gz.post(`/api/v1/containers/${c.id}/shipments`).send({ trackingIds: [s.trackingId] })
    await gz.post(`/api/v1/containers/${c.id}/close`)
    expect((await gz.patch(`/api/v1/containers/${c.id}/status`).send({ status: 'IN_TRANSIT' })).body.updated).toBe(1)

    const lome = await staff('lome@kadercargo.com', 'Lome#Agence2026')
    const departed = (await lome.get('/api/v1/staff/notifications')).body.notifications.find((n: { link: string; type: string }) => n.link === `/admin/conteneurs/${c.id}` && n.type === 'CONTAINER_DEPARTED')
    expect(departed.title).toBe(`Le bateau du conteneur ${c.code} est parti 🚢`)
    expect(departed.body).toContain('20 décembre')
    expect(departed.unread).toBe(true)

    const after = new Date().toISOString()
    expect((await lome.patch(`/api/v1/containers/${c.id}/status`).send({ status: 'ARRIVED' })).body.updated).toBe(1)
    // The GZ warehouse is told too, and polling with ?after= returns only what is new.
    const fresh = (await gz.get(`/api/v1/staff/notifications?after=${encodeURIComponent(after)}`)).body.notifications
    expect(fresh).toHaveLength(1)
    expect(fresh[0]).toMatchObject({ type: 'CONTAINER_ARRIVED', title: `Le bateau est arrivé : conteneur ${c.code} au port de Lomé ⚓` })
  })
})
