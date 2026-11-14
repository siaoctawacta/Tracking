/**
 * Scheduled maintenance, called by Vercel Cron (or any scheduler) with
 * "Authorization: Bearer <CRON_SECRET>". Disabled (404) while CRON_SECRET is not set.
 */
import { Router } from 'express'
import { config } from '../config'
import { prisma } from '../db'
import { safeEqual } from '../lib/security'
import { retryStuckAlerts } from '../lib/whatsapp'
import { HttpError } from '../middleware/errors'

export const cronRouter = Router()

cronRouter.get('/maintenance', async (req, res) => {
  const expected = config.cronSecret
  if (!expected) throw new HttpError(404, 'Ressource introuvable', 'not_found')
  if (!safeEqual(req.get('authorization') ?? '', `Bearer ${expected}`)) throw new HttpError(401, 'Authentification requise', 'unauthenticated')

  const now = new Date()
  const day = 24 * 3600_000
  const [otp, tokens, limits] = await prisma.$transaction([
    prisma.otpCode.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - day) } } }),
    prisma.refreshToken.deleteMany({ where: { OR: [{ expiresAt: { lt: now } }, { revokedAt: { lt: new Date(now.getTime() - 30 * day) } }] } }),
    prisma.rateLimit.deleteMany({ where: { resetAt: { lt: now } } }),
  ])
  const retried = await retryStuckAlerts()
  res.json({ ok: true, retriedAlerts: retried, purged: { otpCodes: otp.count, refreshTokens: tokens.count, rateLimits: limits.count } })
})
