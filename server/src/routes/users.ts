import { Router } from 'express'
import { z } from 'zod'
import { config } from '../config'
import { prisma } from '../db'
import { normalizePhone, ROLES } from '../lib/domain'
import { sendNotice } from '../lib/otp'
import { hashPassword } from '../lib/security'
import { requireRole } from '../middleware/auth'
import { HttpError } from '../middleware/errors'
import { publicUser } from './auth'

export const usersRouter = Router()
usersRouter.use(requireRole('ADMIN'))

type U = Awaited<ReturnType<typeof prisma.user.findFirstOrThrow>>
const adminView = (u: U) => ({
  ...publicUser(u),
  active: u.active,
  approvalStatus: u.approvalStatus,
  signupMethod: u.signupMethod,
  phoneVerified: !!u.phoneVerifiedAt,
  emailVerified: !!u.emailVerifiedAt,
  google: !!u.googleSub,
  createdAt: u.createdAt,
})

usersRouter.get('/', async (req, res) => {
  const { status } = z.object({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional() }).parse(req.query)
  const [users, pending] = await prisma.$transaction([
    prisma.user.findMany({ where: status ? { approvalStatus: status } : {}, orderBy: [{ createdAt: 'desc' }] }),
    prisma.user.count({ where: { approvalStatus: 'PENDING' } }),
  ])
  res.json({ users: users.map(adminView), pending })
})

const CreateBody = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().email().max(160).optional().or(z.literal('').transform(() => undefined)),
    phone: z.string().trim().max(25).regex(/^[+\d\s().-]*$/).optional().or(z.literal('').transform(() => undefined)),
    role: z.enum(ROLES),
    password: z.string().min(10, 'Au moins 10 caractères').max(256),
  })
  .strict()
  .refine((b) => b.email || b.phone, { message: 'Email ou téléphone requis', path: ['email'] })

/** Accounts created by an admin are trusted (identifiers vouched for by staff) and active at once. */
usersRouter.post('/', async (req, res) => {
  const body = CreateBody.parse(req.body)
  const phone = body.phone ? normalizePhone(body.phone) : undefined
  const clash = await prisma.user.findFirst({ where: { OR: [body.email ? { email: body.email } : {}, phone ? { phone } : {}].filter((o) => Object.keys(o).length) } })
  if (clash) throw new HttpError(409, 'Un compte existe déjà avec cet email ou ce téléphone', 'conflict')
  const now = new Date()
  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      phone,
      role: body.role,
      passwordHash: await hashPassword(body.password),
      approvalStatus: 'APPROVED',
      approvedAt: now,
      approvedById: req.user!.sub,
      signupMethod: 'ADMIN',
      emailVerifiedAt: body.email ? now : null,
      phoneVerifiedAt: phone ? now : null,
    },
  })
  res.status(201).json({ user: publicUser(user) })
})

const ApprovalBody = z.object({ decision: z.enum(['APPROVE', 'REJECT']), reason: z.string().trim().max(280).optional() }).strict()

/** Validates (or refuses) a self-registered client account, then tells the client. */
usersRouter.post('/:id/approval', async (req, res) => {
  const { decision, reason } = ApprovalBody.parse(req.body)
  const user = await prisma.user.findUnique({ where: { id: req.params.id } })
  if (!user) throw new HttpError(404, 'Utilisateur introuvable', 'not_found')
  const approve = decision === 'APPROVE'
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { approvalStatus: approve ? 'APPROVED' : 'REJECTED', approvedAt: new Date(), approvedById: req.user!.sub },
  })
  if (!approve) await prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } })

  const first = user.name.split(' ')[0]
  const login = config.publicWebUrl ? `${config.publicWebUrl}/connexion` : 'notre site'
  const [title, message] = approve
    ? ['Votre compte est activé ✅', `Bonjour ${first}, votre compte Kader Cargo est validé. Connectez-vous sur ${login} pour suivre vos colis, vos photos de contrôle et vos factures.`]
    : ['Demande de compte', `Bonjour ${first}, votre demande de compte Kader Cargo n’a pas pu être validée${reason ? ` : ${reason}` : ''}. Pour toute question, écrivez-nous sur WhatsApp au +228 90 94 44 48.`]
  let notified = false
  for (const id of [user.phone ? { kind: 'phone' as const, value: user.phone } : null, user.email ? { kind: 'email' as const, value: user.email } : null]) {
    if (!id) continue
    try {
      await sendNotice(id, title, message)
      notified = true
      break
    } catch (e) {
      console.error('[approval] notice failed', e instanceof Error ? e.message : e)
    }
  }
  res.json({ user: adminView(updated), notified })
})

usersRouter.patch('/:id', async (req, res) => {
  const { active } = z.object({ active: z.boolean() }).strict().parse(req.body)
  if (req.params.id === req.user!.sub) throw new HttpError(409, 'Vous ne pouvez pas désactiver votre propre compte', 'conflict')
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { active } }).catch(() => null)
  if (!user) throw new HttpError(404, 'Utilisateur introuvable', 'not_found')
  if (!active) await prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } })
  res.json({ user: adminView(user) })
})
