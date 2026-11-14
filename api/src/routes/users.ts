import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db'
import { normalizePhone, ROLES } from '../lib/domain'
import { hashPassword } from '../lib/security'
import { requireRole } from '../middleware/auth'
import { HttpError } from '../middleware/errors'
import { publicUser } from './auth'

export const usersRouter = Router()
usersRouter.use(requireRole('ADMIN'))

usersRouter.get('/', async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } })
  res.json({ users: users.map((u) => ({ ...publicUser(u), active: u.active, createdAt: u.createdAt })) })
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

usersRouter.post('/', async (req, res) => {
  const body = CreateBody.parse(req.body)
  const phone = body.phone ? normalizePhone(body.phone) : undefined
  const clash = await prisma.user.findFirst({ where: { OR: [body.email ? { email: body.email } : {}, phone ? { phone } : {}].filter((o) => Object.keys(o).length) } })
  if (clash) throw new HttpError(409, 'Un compte existe déjà avec cet email ou ce téléphone', 'conflict')
  const user = await prisma.user.create({
    data: { name: body.name, email: body.email, phone, role: body.role, passwordHash: await hashPassword(body.password) },
  })
  res.status(201).json({ user: publicUser(user) })
})

usersRouter.patch('/:id', async (req, res) => {
  const { active } = z.object({ active: z.boolean() }).strict().parse(req.body)
  if (req.params.id === req.user!.sub) throw new HttpError(409, 'Vous ne pouvez pas désactiver votre propre compte', 'conflict')
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { active } }).catch(() => null)
  if (!user) throw new HttpError(404, 'Utilisateur introuvable', 'not_found')
  if (!active) await prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } })
  res.json({ user: { ...publicUser(user), active: user.active } })
})
