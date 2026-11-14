import { Router, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { config } from '../config'
import { prisma } from '../db'
import type { Role } from '../lib/domain'
import { googleEnabled, verifyGoogleCredential } from '../lib/google'
import { maskIdentifier, parseIdentifier, whereIdentifier } from '../lib/identifiers'
import { consumeOtp, issueOtp } from '../lib/otp'
import { getDummyHash, hashPassword, randomToken, sha256, signAccessToken, verifyAccessToken, verifyPassword } from '../lib/security'
import { notifyStaff } from '../lib/staffNotify'
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

// Code-based flows (request + verify, sign-up) get their own, roomier budget per IP: mobile
// operators put many customers behind one public IP (CGNAT). Per-number limits (cooldown,
// 5 codes/hour, 5 attempts per code) are enforced in lib/otp.ts.
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Trop de tentatives. Réessayez dans 15 minutes.' } },
})

const baseCookie = { httpOnly: true, secure: config.cookieSecure, sameSite: 'strict' as const, path: '/' }

export { startSession }

export function publicUser(u: { id: string; name: string; email: string | null; phone: string | null; role: string }) {
  return { id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role }
}

type AccountUser = { id: string; name: string; role: string; active: boolean; approvalStatus: string }

/** Only active, admin-approved accounts may open a session. */
function assertCanSignIn(user: AccountUser) {
  if (!user.active) throw new HttpError(401, 'Identifiants invalides', 'invalid_credentials')
  if (user.approvalStatus === 'PENDING') throw new HttpError(403, 'Votre compte est en attente de validation par Kader Cargo. Vous serez prévenu dès son activation.', 'account_pending')
  if (user.approvalStatus === 'REJECTED') throw new HttpError(403, 'Votre demande de compte n’a pas été acceptée. Contactez Kader Cargo sur WhatsApp au +228 90 94 44 48.', 'account_rejected')
}

const canUse = (u: { active: boolean; approvalStatus: string }) => u.active && u.approvalStatus === 'APPROVED'

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
  let user = null
  try {
    user = await prisma.user.findUnique({ where: whereIdentifier(parseIdentifier(identifier)) })
  } catch {
    user = null
  }

  // Constant-ish time: always run one Argon2 verification.
  const ok = await verifyPassword(user?.passwordHash ?? (await getDummyHash()), password)
  if (!user || !ok) throw new HttpError(401, 'Identifiants invalides', 'invalid_credentials')
  assertCanSignIn(user)

  await startSession(res, user)
  res.json({ user: publicUser(user) })
})

authRouter.post('/refresh', async (req, res) => {
  const token = req.cookies?.[config.cookies.refresh]
  if (typeof token !== 'string' || !token) throw new HttpError(401, 'Session expirée', 'unauthenticated')

  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } })
  if (!stored || stored.expiresAt < new Date() || !canUse(stored.user)) {
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
  if (user && canUse(user)) return res.json({ user: publicUser(user), refreshable: false })
  res.json({ user: null, refreshable: typeof req.cookies?.[config.cookies.refresh] === 'string' })
})

authRouter.get('/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } })
  if (!user || !canUse(user)) throw new HttpError(401, 'Authentification requise', 'unauthenticated')
  res.json({ user: publicUser(user) })
})

// ---------------------------------------------------------------------------------------------
// Client sign-up and code-based sign-in
// ---------------------------------------------------------------------------------------------

/** Public capabilities so the SPA only shows the sign-in options that are configured. */
authRouter.get('/options', (_req, res) => {
  res.json({ google: googleEnabled() ? { clientId: config.googleClientId } : null })
})

const RegisterStart = z
  .object({
    name: z.string().trim().min(2, 'Indiquez votre nom').max(120),
    identifier: z.string().trim().min(3).max(160),
    password: z.string().min(10, 'Au moins 10 caractères').max(256).optional().or(z.literal('').transform(() => undefined)),
  })
  .strict()

/**
 * Step 1 — sends a 6-digit code by WhatsApp (phone) or e-mail.
 * If the identifier already has an account, a sign-in code is sent instead: the response is the
 * same either way, so this endpoint does not reveal who is a customer.
 */
authRouter.post('/register/start', otpLimiter, async (req, res) => {
  const body = RegisterStart.parse(req.body)
  const id = parseIdentifier(body.identifier)
  const existing = await prisma.user.findUnique({ where: whereIdentifier(id) })
  const issued = existing
    ? await issueOtp(id, 'LOGIN', { userId: existing.id })
    : await issueOtp(id, 'REGISTER', { payload: { name: body.name, passwordHash: body.password ? await hashPassword(body.password) : null } })
  res.json({ ...issued, destination: maskIdentifier(id) })
})

const CodeBody = z.object({ identifier: z.string().trim().min(3).max(160), code: z.string().trim().regex(/^\d{6}$/, 'Code à 6 chiffres') }).strict()

/** Step 2 — proves ownership of the phone/e-mail and creates the account, pending admin approval. */
authRouter.post('/register/verify', otpLimiter, async (req, res) => {
  const { identifier, code } = CodeBody.parse(req.body)
  const id = parseIdentifier(identifier)
  const existing = await prisma.user.findUnique({ where: whereIdentifier(id) })
  if (existing) {
    // Account already there: the code we sent was a sign-in code.
    await consumeOtp(id, 'LOGIN', code)
    assertCanSignIn(existing)
    await startSession(res, existing)
    return res.json({ status: 'SIGNED_IN', user: publicUser(existing) })
  }
  const otp = await consumeOtp(id, 'REGISTER', code)
  const payload = JSON.parse(otp.payload ?? '{}') as { name?: string; passwordHash?: string | null }
  const now = new Date()
  const user = await prisma.user
    .create({
      data: {
        name: payload.name || 'Client',
        role: 'CLIENT',
        approvalStatus: 'PENDING',
        signupMethod: id.kind === 'phone' ? 'PHONE' : 'EMAIL',
        passwordHash: payload.passwordHash ?? null,
        ...(id.kind === 'phone' ? { phone: id.value, phoneVerifiedAt: now } : { email: id.value, emailVerifiedAt: now }),
      },
    })
    .catch(() => {
      throw new HttpError(409, 'Un compte existe déjà avec cet identifiant. Connectez-vous.', 'conflict')
    })
  await notifyStaff('ACCOUNT_PENDING', 'Nouveau compte client à valider', `${user.name} · ${id.value} (${id.kind === 'phone' ? 'WhatsApp vérifié' : 'e-mail vérifié'})`, '/admin/utilisateurs?filtre=attente', ['ADMIN'])
  res.status(202).json({ status: 'PENDING_APPROVAL' })
})

const OtpRequest = z.object({ identifier: z.string().trim().min(3).max(160) }).strict()

/** Passwordless sign-in: sends a code if the account exists (same response otherwise). */
authRouter.post('/otp/request', otpLimiter, async (req, res) => {
  const id = parseIdentifier(OtpRequest.parse(req.body).identifier)
  const user = await prisma.user.findUnique({ where: whereIdentifier(id) })
  const issued = user && user.active ? await issueOtp(id, 'LOGIN', { userId: user.id }) : { channel: id.kind === 'phone' ? 'WHATSAPP' : 'EMAIL' }
  res.json({ ...issued, destination: maskIdentifier(id) })
})

authRouter.post('/otp/verify', otpLimiter, async (req, res) => {
  const { identifier, code } = CodeBody.parse(req.body)
  const id = parseIdentifier(identifier)
  const user = await prisma.user.findUnique({ where: whereIdentifier(id) })
  if (!user) throw new HttpError(400, 'Code invalide ou expiré', 'otp_invalid')
  await consumeOtp(id, 'LOGIN', code)
  assertCanSignIn(user)
  await startSession(res, user)
  res.json({ user: publicUser(user) })
})

/**
 * "Continuer avec Google": signs in the account linked to this Google identity, links it to an
 * existing account with the same verified Gmail address, or creates a new client account
 * (pending admin approval).
 */
authRouter.post('/google', otpLimiter, async (req, res) => {
  const { credential } = z.object({ credential: z.string().min(20).max(4096) }).strict().parse(req.body)
  const g = await verifyGoogleCredential(credential)
  let user = await prisma.user.findUnique({ where: { googleSub: g.sub } })
  if (!user && g.email && g.emailVerified) {
    const byEmail = await prisma.user.findUnique({ where: { email: g.email } })
    if (byEmail) user = await prisma.user.update({ where: { id: byEmail.id }, data: { googleSub: g.sub, emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date() } })
  }
  if (!user) {
    const emailFree = g.email && g.emailVerified && !(await prisma.user.findUnique({ where: { email: g.email } }))
    user = await prisma.user.create({
      data: {
        name: g.name || g.email?.split('@')[0] || 'Client',
        role: 'CLIENT',
        approvalStatus: 'PENDING',
        signupMethod: 'GOOGLE',
        googleSub: g.sub,
        ...(emailFree ? { email: g.email!, emailVerifiedAt: new Date() } : {}),
      },
    })
    await notifyStaff('ACCOUNT_PENDING', 'Nouveau compte client à valider', `${user.name} · ${g.email ?? 'compte Google'} (Google)`, '/admin/utilisateurs?filtre=attente', ['ADMIN'])
    return res.status(202).json({ status: 'PENDING_APPROVAL' })
  }
  if (user.approvalStatus === 'PENDING') return res.status(202).json({ status: 'PENDING_APPROVAL' })
  assertCanSignIn(user)
  await startSession(res, user)
  res.json({ status: 'SIGNED_IN', user: publicUser(user) })
})
