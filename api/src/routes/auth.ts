import { Router, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { config } from '../config'
import { prisma } from '../db'
import { normalizePhone, type Role } from '../lib/domain'
import { getDummyHash, randomToken, sha256, signAccessToken, verifyAccessToken, verifyPassword } from '../lib/security'
import { authenticate } from '../middleware/auth'
import { issueCsrf } from '../middleware/csrf'
import { HttpError } from '../middleware/errors'

export const authRouter = Router()

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.loginRateLimit,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Trop de tentatives. Réessayez dans 15 minutes.' } },
})

const baseCookie = { httpOnly: true, secure: config.cookieSecure, sameSite: 'strict' as const, path: '/' }

export function publicUser(u: { id: string; name: string; email: string | null; phone: string | null; role: string }) {
  return { id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role }
}

async function startSession(res: Response, user: { id: string; role: string; name: string }, familyId?: string) {
  const access = signAccessToken({ sub: user.id, role: user.role as Role, name: user.name })
  const refresh = randomToken(32)
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(refresh), // only the hash is persisted
      familyId: familyId ?? randomToken(12),
      expiresAt: new Date(Date.now() + config.refreshTtlSec * 1000),
    },
  })
  res.cookie(config.cookies.access, access, { ...baseCookie, maxAge: config.accessTtlSec * 1000 })
  res.cookie(config.cookies.refresh, refresh, { ...baseCookie, maxAge: config.refreshTtlSec * 1000 })
  return sha256(refresh)
}

function clearSession(res: Response) {
  for (const name of [config.cookies.access, config.cookies.refresh]) res.clearCookie(name, baseCookie)
}

authRouter.get('/csrf', (_req, res) => {
  res.set('Cache-Control', 'no-store').json({ csrfToken: issueCsrf(res) })
})

const LoginBody = z
  .object({
    identifier: z.string().trim().min(3).max(120),
    password: z.string().min(1).max(256),
  })
  .strict()

authRouter.post('/login', loginLimiter, async (req, res) => {
  const { identifier, password } = LoginBody.parse(req.body)
  const where = identifier.includes('@') ? { email: identifier.toLowerCase() } : { phone: normalizePhone(identifier) }
  const user = await prisma.user.findUnique({ where })

  // Constant-ish time: always run one Argon2 verification.
  const ok = await verifyPassword(user?.passwordHash ?? (await getDummyHash()), password)
  if (!user || !ok || !user.active) throw new HttpError(401, 'Identifiants invalides', 'invalid_credentials')

  await startSession(res, user)
  res.json({ user: publicUser(user) })
})

authRouter.post('/refresh', async (req, res) => {
  const token = req.cookies?.[config.cookies.refresh]
  if (typeof token !== 'string' || !token) throw new HttpError(401, 'Session expirée', 'unauthenticated')

  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } })
  if (!stored || stored.expiresAt < new Date() || !stored.user.active) {
    clearSession(res)
    throw new HttpError(401, 'Session expirée', 'unauthenticated')
  }
  if (stored.revokedAt) {
    // Reuse of a rotated token = likely theft. Kill the whole token family.
    await prisma.refreshToken.updateMany({ where: { familyId: stored.familyId, revokedAt: null }, data: { revokedAt: new Date() } })
    clearSession(res)
    throw new HttpError(401, 'Session révoquée', 'token_reused')
  }

  const newHash = await startSession(res, stored.user, stored.familyId)
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date(), replacedBy: newHash } })
  res.json({ user: publicUser(stored.user) })
})

authRouter.post('/logout', authenticate, async (req, res) => {
  const token = req.cookies?.[config.cookies.refresh]
  if (typeof token === 'string' && token) {
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(token) } })
    if (stored) {
      await prisma.refreshToken.updateMany({ where: { familyId: stored.familyId, revokedAt: null }, data: { revokedAt: new Date() } })
    }
  }
  clearSession(res)
  res.status(204).end()
})

/**
 * Soft session probe for the SPA boot: never 401s. Tells the client whether a refresh cookie
 * exists (the SPA cannot see HttpOnly cookies) so anonymous visitors skip a pointless refresh.
 */
authRouter.get('/session', async (req, res) => {
  res.set('Cache-Control', 'no-store')
  const token = req.cookies?.[config.cookies.access]
  const claims = typeof token === 'string' ? verifyAccessToken(token) : null
  const user = claims ? await prisma.user.findUnique({ where: { id: claims.sub } }) : null
  if (user?.active) return res.json({ user: publicUser(user), refreshable: false })
  res.json({ user: null, refreshable: typeof req.cookies?.[config.cookies.refresh] === 'string' })
})

authRouter.get('/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } })
  if (!user || !user.active) throw new HttpError(401, 'Authentification requise', 'unauthenticated')
  res.json({ user: publicUser(user) })
})
