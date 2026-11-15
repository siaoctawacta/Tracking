import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { ConfigError } from '../src/lib/configError'
import { diagnoseDbError, isDbUnavailable } from '../src/lib/dbErrors'
import { startupFailure } from '../src/vercel'

const run = promisify(execFile)
const root = fileURLToPath(new URL('..', import.meta.url))

/** Starts the Vercel entry point in a fresh process with the given environment and calls one route. */
async function callVercel(env: Record<string, string | undefined>, path: string) {
  const script = `
    const { default: handler } = await import('./src/vercel.ts')
    const http = await import('node:http')
    const server = http.createServer(handler).listen(0, async () => {
      const r = await fetch('http://127.0.0.1:' + server.address().port + '/api?__path=' + encodeURIComponent(${JSON.stringify(path)}))
      console.log(JSON.stringify({ status: r.status, type: r.headers.get('content-type'), body: await r.json() }))
      server.close(); process.exit(0)
    })`
  const clean = { ...process.env, VITEST: undefined, NODE_ENV: undefined, JWT_SECRET: undefined, ...env }
  const { stdout } = await run('npx', ['tsx', '--input-type=module', '-e', script], { cwd: root, env: clean as NodeJS.ProcessEnv })
  return JSON.parse(stdout.trim().split('\n').pop()!) as { status: number; type: string; body: { error?: { code: string; message: string }; csrfToken?: string } }
}

describe('Vercel startup failures', () => {
  it('answers JSON naming the missing variable instead of a bare platform error', async () => {
    const r = await callVercel({ VERCEL: '1' }, 'v1/auth/csrf')
    expect(r.status).toBe(500)
    expect(r.type).toContain('application/json')
    expect(r.body.error?.code).toBe('server_misconfigured')
    expect(r.body.error?.message).toContain('JWT_SECRET absente')
  }, 60_000)

  it('reports a too-short secret without revealing it', async () => {
    const r = await callVercel({ VERCEL: '1', JWT_SECRET: 'tooshort-secret' }, 'v1/auth/csrf')
    expect(r.body.error?.message).toContain('JWT_SECRET trop courte (15 caractères)')
    expect(r.body.error?.message).not.toContain('tooshort-secret')
  }, 60_000)

  it.each([
    ['a "#" in the password', 'postgresql://u:Zq9@Kx#Wv@host:5432/db'],
    ['a "/" in the password', 'postgresql://u:Zq9/KxWv@host:5432/db'],
  ])('reports an unreadable DATABASE_URL (%s)', async (_label, url) => {
    const r = await callVercel({ VERCEL: '1', JWT_SECRET: 'x'.repeat(48), DATABASE_URL: url }, 'v1/auth/csrf')
    expect(r.status).toBe(500)
    expect(r.body.error?.message).toContain('DATABASE_URL illisible')
    expect(r.body.error?.message).not.toContain('Kx')
  }, 60_000)

  it('serves the API normally once configured', async () => {
    const r = await callVercel({ VERCEL: '1', JWT_SECRET: 'x'.repeat(48) }, 'v1/auth/csrf')
    expect(r.status).toBe(200)
    expect(typeof r.body.csrfToken).toBe('string')
  }, 60_000)

  it('names only configuration errors', () => {
    expect(startupFailure(new ConfigError('JWT_SECRET absente')).error.message).toContain('JWT_SECRET absente')
    expect(startupFailure(new Error('connect postgres://user:secret@host')).error.message).not.toContain('secret')
  })
})

describe('database diagnostics', () => {
  it('turns driver errors into secret-free advice', () => {
    expect(diagnoseDbError({ message: 'x', cause: { code: '28P01', message: 'password authentication failed for user "postgres.abc"' } })).toMatch(/Mot de passe de la base refusé/)
    expect(diagnoseDbError(new Error('FATAL: Tenant or user not found'))).toMatch(/pooler Supabase/)
    expect(diagnoseDbError({ cause: { code: 'ENOTFOUND' } })).toMatch(/Hôte de la base introuvable/)
    expect(diagnoseDbError({ code: '42P01' })).toMatch(/Tables absentes/)
    // Shapes thrown by Prisma 7 with the pg driver adapter.
    const prismaErr = (code: string, cause: object) => ({ name: 'PrismaClientKnownRequestError', code, message: 'Invalid `prisma.user.count()` invocation', meta: { driverAdapterError: { name: 'DriverAdapterError', cause } } })
    expect(diagnoseDbError(prismaErr('P1000', { originalCode: '28P01', kind: 'AuthenticationFailed' }))).toMatch(/Mot de passe de la base refusé/)
    expect(diagnoseDbError(prismaErr('P1001', { kind: 'DatabaseNotReachable', host: 'h' }))).toMatch(/Base injoignable/)
    expect(diagnoseDbError(prismaErr('P2010', { originalCode: 'XX000', originalMessage: 'Tenant or user not found' }))).toMatch(/pooler Supabase/)
    expect(isDbUnavailable(prismaErr('P1001', { kind: 'DatabaseNotReachable' }))).toBe(true)
    expect(isDbUnavailable({ cause: { code: 'ECONNREFUSED' } })).toBe(true)
    expect(isDbUnavailable({ code: 'P2002' })).toBe(false)
  })

  it('checks the database on demand in the health probe', async () => {
    const app = createApp()
    expect((await request(app).get('/api/v1/health')).body).toEqual({ ok: true })
    const r = await request(app).get('/api/v1/health?db=1')
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ ok: true, database: 'ok' })
  })
})
