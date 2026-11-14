import type { RequestHandler } from 'express'
import { config } from '../config'
import type { Role } from '../lib/domain'
import { verifyAccessToken, type AccessClaims } from '../lib/security'
import { HttpError } from './errors'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessClaims
    }
  }
}

/** Stateless: the identity comes only from the signed JWT in the HttpOnly cookie. */
export const authenticate: RequestHandler = (req, _res, next) => {
  const token = req.cookies?.[config.cookies.access]
  const claims = typeof token === 'string' ? verifyAccessToken(token) : null
  if (!claims) throw new HttpError(401, 'Authentification requise', 'unauthenticated')
  req.user = claims
  next()
}

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) throw new HttpError(403, 'Accès refusé', 'forbidden')
    next()
  }
}
