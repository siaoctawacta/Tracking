/** "Mon compte": manage every way a user can sign in, all linked to the same account. */
import { Router } from 'express'
import { z } from 'zod'
import { config } from '../config'
import { prisma } from '../db'
import { googleEnabled, verifyGoogleCredential } from '../lib/google'
import { maskIdentifier, parseIdentifier, whereIdentifier } from '../lib/identifiers'
import { consumeOtp, issueOtp } from '../lib/otp'
import { hashPassword, verifyPassword } from '../lib/security'
import { HttpError } from '../middleware/errors'

export const accountRouter = Router()

async function me(id: string) {
  const u = await prisma.user.findUnique({ where: { id } })
  if (!u || !u.active) throw new HttpError(401, 'Authentification requise', 'unauthenticated')
  return u
}

function view(u: Awaited<ReturnType<typeof me>>) {
  return {
    user: { id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role },
    methods: {
      phone: u.phone ? { value: u.phone, verifiedAt: u.phoneVerifiedAt } : null,
      email: u.email ? { value: u.email, verifiedAt: u.emailVerifiedAt } : null,
      google: !!u.googleSub,
      password: !!u.passwordHash,
    },
    googleClientId: googleEnabled() ? config.googleClientId : null,
  }
}

accountRouter.get('/', async (req, res) => {
  res.json(view(await me(req.user!.sub)))
})

const LinkStart = z.object({ identifier: z.string().trim().min(3).max(160) }).strict()

/** Sends a code to the phone (WhatsApp) or e-mail being added. */
accountRouter.post('/link/start', async (req, res) => {
  const user = await me(req.user!.sub)
  const id = parseIdentifier(LinkStart.parse(req.body).identifier)
  if ((id.kind === 'phone' && user.phone === id.value) || (id.kind === 'email' && user.email === id.value)) {
    throw new HttpError(409, 'Cet identifiant est déjà lié à votre compte', 'already_linked')
  }
  if (await prisma.user.findUnique({ where: whereIdentifier(id) })) throw new HttpError(409, 'Cet identifiant est déjà utilisé par un autre compte', 'conflict')
  const issued = await issueOtp(id, 'LINK', { userId: user.id })
  res.json({ ...issued, destination: maskIdentifier(id) })
})

const LinkVerify = z.object({ identifier: z.string().trim().min(3).max(160), code: z.string().trim().regex(/^\d{6}$/) }).strict()

accountRouter.post('/link/verify', async (req, res) => {
  const user = await me(req.user!.sub)
  const { identifier, code } = LinkVerify.parse(req.body)
  const id = parseIdentifier(identifier)
  const otp = await consumeOtp(id, 'LINK', code)
  if (otp.userId !== user.id) throw new HttpError(400, 'Code invalide ou expiré', 'otp_invalid')
  const now = new Date()
  const updated = await prisma.user
    .update({ where: { id: user.id }, data: id.kind === 'phone' ? { phone: id.value, phoneVerifiedAt: now } : { email: id.value, emailVerifiedAt: now } })
    .catch(() => {
      throw new HttpError(409, 'Cet identifiant est déjà utilisé par un autre compte', 'conflict')
    })
  res.json(view(updated))
})

accountRouter.post('/link/google', async (req, res) => {
  const user = await me(req.user!.sub)
  const { credential } = z.object({ credential: z.string().min(20).max(4096) }).strict().parse(req.body)
  const g = await verifyGoogleCredential(credential)
  const owner = await prisma.user.findUnique({ where: { googleSub: g.sub } })
  if (owner && owner.id !== user.id) throw new HttpError(409, 'Ce compte Google est déjà lié à un autre compte', 'conflict')
  const addEmail = !user.email && g.email && g.emailVerified && !(await prisma.user.findUnique({ where: { email: g.email } }))
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { googleSub: g.sub, ...(addEmail ? { email: g.email!, emailVerifiedAt: new Date() } : {}) },
  })
  res.json(view(updated))
})

accountRouter.delete('/link/google', async (req, res) => {
  const user = await me(req.user!.sub)
  if (!user.phone && !user.email) throw new HttpError(409, 'Ajoutez d’abord un téléphone ou un e-mail pour ne pas perdre l’accès à votre compte', 'last_method')
  res.json(view(await prisma.user.update({ where: { id: user.id }, data: { googleSub: null } })))
})

const PasswordBody = z
  .object({
    currentPassword: z.string().max(256).optional(),
    newPassword: z.string().min(10, 'Au moins 10 caractères').max(256),
  })
  .strict()

accountRouter.post('/password', async (req, res) => {
  const user = await me(req.user!.sub)
  const body = PasswordBody.parse(req.body)
  if (user.passwordHash && !(await verifyPassword(user.passwordHash, body.currentPassword ?? ''))) {
    throw new HttpError(400, 'Mot de passe actuel incorrect', 'bad_password')
  }
  res.json(view(await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(body.newPassword) } })))
})
