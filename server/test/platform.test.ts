import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app'
import { config } from '../src/config'
import { prisma } from '../src/db'
import { PostgresStore } from '../src/lib/rateLimitStore'

const app = createApp()
let ipSeq = 1
async function staff(identifier: string, password: string) {
  const agent = request.agent(app)
  const ip = `10.3.0.${ipSeq++}`
  const csrf = (await agent.get('/api/v1/auth/csrf').set('X-Forwarded-For', ip)).body.csrfToken as string
  const s = {
    get: (u: string) => agent.get(u).set('X-Forwarded-For', ip),
    post: (u: string) => agent.post(u).set('X-Forwarded-For', ip).set('X-CSRF-Token', csrf),
  }
  expect((await s.post('/api/v1/auth/login').send({ identifier, password })).status).toBe(200)
  return s
}

describe('rate-limit store (PostgreSQL)', () => {
  it('shares counters between instances and resets after the window', async () => {
    const a = new PostgresStore('t-shared')
    const b = new PostgresStore('t-shared')
    for (const s of [a, b]) s.init({ windowMs: 400 } as never)
    expect((await a.increment('1.2.3.4')).totalHits).toBe(1)
    expect((await b.increment('1.2.3.4')).totalHits).toBe(2) // another "function instance"
    expect((await a.increment('1.2.3.4')).totalHits).toBe(3)
    await b.decrement('1.2.3.4')
    expect((await a.get('1.2.3.4'))?.totalHits).toBe(2)
    await new Promise((r) => setTimeout(r, 450))
    expect((await b.increment('1.2.3.4')).totalHits).toBe(1)
    await a.resetKey('1.2.3.4')
    expect(await a.get('1.2.3.4')).toBeUndefined()
  })
})

describe('photo storage on Supabase', () => {
  const saved = { ...config.supabase }
  afterEach(() => { Object.assign(config.supabase, saved); vi.unstubAllGlobals() })

  it('uploads to the private bucket and serves photos only after the access check', async () => {
    Object.assign(config.supabase, { url: 'https://abc.supabase.co', serviceRoleKey: 'eyJhbGciOiJIUzI1NiJ9.service', bucket: 'photos' })
    const objects = new Map<string, Buffer>()
    const calls: { method: string; url: string; auth: string | null; apikey: string | null }[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
      const h = new Headers(init.headers)
      calls.push({ method: init.method ?? 'GET', url, auth: h.get('authorization'), apikey: h.get('apikey') })
      if (init.method === 'POST') { objects.set(url, Buffer.from(init.body as Uint8Array)); return new Response('{"Key":"x"}', { status: 200 }) }
      const body = objects.get(url)
      return body ? new Response(new Uint8Array(body), { status: 200 }) : new Response('{"error":"not_found"}', { status: 400 })
    }))

    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
    const gz = await staff('gz@kadercargo.com', 'Guangzhou#2026')
    const s = await prisma.shipment.findUniqueOrThrow({ where: { trackingId: 'KC-2026-R2D4HN' } })
    const up = await gz.post(`/api/v1/shipments/${s.id}/photos`).attach('photos', png, { filename: 'qc.png', contentType: 'image/png' })
    expect(up.status).toBe(201)

    const put = calls.find((c) => c.method === 'POST')!
    expect(put.url).toMatch(/^https:\/\/abc\.supabase\.co\/storage\/v1\/object\/photos\/[0-9a-f-]{36}\.png$/)
    expect(put.auth).toBe('Bearer eyJhbGciOiJIUzI1NiJ9.service')
    expect(put.apikey).toBe('eyJhbGciOiJIUzI1NiJ9.service')

    const photoId = up.body.photos.at(-1).id
    const got = await gz.get(`/api/v1/shipments/${s.id}/photos/${photoId}`)
    expect(got.status).toBe(200)
    expect(Buffer.compare(got.body, png)).toBe(0)
    // Another client cannot read it (the API checks access before touching the bucket).
    const before = calls.length
    const other = request.agent(app)
    expect((await other.get(`/api/v1/shipments/${s.id}/photos/${photoId}`)).status).toBe(401)
    expect(calls.length).toBe(before)
  })
})

describe('Supabase secret keys', () => {
  const saved = { ...config.supabase }
  afterEach(() => { Object.assign(config.supabase, saved); vi.unstubAllGlobals() })

  it('sends new sb_secret_ keys only in the apikey header', async () => {
    Object.assign(config.supabase, { url: 'https://abc.supabase.co', serviceRoleKey: 'sb_secret_abc123', bucket: 'photos' })
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { photoStorage } = await import('../src/lib/storage')
    await photoStorage().put('a.jpg', Buffer.from([0xff, 0xd8, 0xff]), 'image/jpeg')
    const h = new Headers((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].headers)
    expect(h.get('apikey')).toBe('sb_secret_abc123')
    expect(h.get('authorization')).toBeNull()
  })
})

describe('maintenance route (Vercel Cron)', () => {
  const saved = config.cronSecret
  afterEach(() => { config.cronSecret = saved })

  it('is disabled without CRON_SECRET and requires the bearer secret', async () => {
    config.cronSecret = ''
    expect((await request(app).get('/api/v1/cron/maintenance')).status).toBe(404)
    config.cronSecret = 'cron-secret-123'
    expect((await request(app).get('/api/v1/cron/maintenance')).status).toBe(401)
    expect((await request(app).get('/api/v1/cron/maintenance').set('Authorization', 'Bearer wrong')).status).toBe(401)
  })

  it('purges expired codes, sessions and counters', async () => {
    config.cronSecret = 'cron-secret-123'
    const old = new Date(Date.now() - 3 * 24 * 3600_000)
    await prisma.otpCode.create({ data: { channel: 'EMAIL', destination: 'old@example.com', purpose: 'LOGIN', codeHash: 'x', expiresAt: old } })
    await prisma.rateLimit.create({ data: { key: 'expired:1', hits: 3, resetAt: old } })
    const res = await request(app).get('/api/v1/cron/maintenance').set('Authorization', 'Bearer cron-secret-123')
    expect(res.status).toBe(200)
    expect(res.body.purged.otpCodes).toBeGreaterThanOrEqual(1)
    expect(res.body.purged.rateLimits).toBeGreaterThanOrEqual(1)
    expect(await prisma.otpCode.count({ where: { destination: 'old@example.com' } })).toBe(0)
  })
})
