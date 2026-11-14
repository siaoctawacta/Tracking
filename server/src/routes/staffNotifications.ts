/** Back-office notification feed (bell + sound). Polled by the SPA every few seconds. */
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db'

export const staffNotificationsRouter = Router()

const Query = z.object({ after: z.string().datetime().optional() })

staffNotificationsRouter.get('/', async (req, res) => {
  const { after } = Query.parse(req.query)
  const role = req.user!.role
  const me = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.sub }, select: { notificationsSeenAt: true, createdAt: true } })
  const audience = { roles: { contains: role } }
  const seen = me.notificationsSeenAt ?? me.createdAt
  const [items, unread] = await prisma.$transaction([
    prisma.staffNotification.findMany({
      where: { ...audience, ...(after && { createdAt: { gt: new Date(after) } }) },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    prisma.staffNotification.count({ where: { ...audience, createdAt: { gt: seen } } }),
  ])
  res.set('Cache-Control', 'no-store').json({
    notifications: items.map(({ roles: _r, ...n }) => ({ ...n, unread: n.createdAt > seen })),
    unread,
    serverTime: new Date().toISOString(),
  })
})

staffNotificationsRouter.post('/read', async (req, res) => {
  await prisma.user.update({ where: { id: req.user!.sub }, data: { notificationsSeenAt: new Date() } })
  res.status(204).end()
})
