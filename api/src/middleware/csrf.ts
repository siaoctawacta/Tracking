import type { RequestHandler, Response } from 'express'
import { config } from '../config'
import { randomToken, safeEqual } from '../lib/security'
import { HttpError } from './errors'

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Double-submit CSRF protection (defence in depth on top of SameSite=Strict).
 * The token is stored in an HttpOnly cookie and handed to the SPA in a JSON body, so it also
 * works when the SPA and API live on different origins. The SPA echoes it in `X-CSRF-Token`.
 */
export function issueCsrf(res: Response): string {
  const token = randomToken(24)
  res.cookie(config.cookies.csrf, token, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'strict',
    path: '/',
    maxAge: config.refreshTtlSec * 1000,
  })
  return token
}

export const csrfProtection: RequestHandler = (req, _res, next) => {
  if (SAFE.has(req.method)) return next()
  const cookie = req.cookies?.[config.cookies.csrf]
  const header = req.get('x-csrf-token')
  if (typeof cookie !== 'string' || !header || !safeEqual(cookie, header)) {
    throw new HttpError(403, 'Jeton CSRF invalide', 'csrf_invalid')
  }
  next()
}
