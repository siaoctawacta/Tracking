import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { config } from './config'
import { authenticate, requireRole } from './middleware/auth'
import { csrfProtection } from './middleware/csrf'
import { errorHandler, notFound } from './middleware/errors'
import { accountRouter } from './routes/account'
import { authRouter } from './routes/auth'
import { containersRouter } from './routes/containers'
import { cronRouter } from './routes/cron'
import { shipmentsRouter } from './routes/shipments'
import { staffNotificationsRouter } from './routes/staffNotifications'
import { trackingRouter } from './routes/tracking'
import { usersRouter } from './routes/users'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', config.trustProxy)
  app.set('etag', false)

  // JSON-only API: lock the CSP down completely.
  app.use(
    helmet({
      contentSecurityPolicy: { useDefaults: false, directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      frameguard: { action: 'deny' },
      strictTransportSecurity: { maxAge: 63072000, includeSubDomains: true, preload: true },
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  )
  if (config.corsOrigins.length) {
    app.use(cors({ origin: config.corsOrigins, credentials: true, methods: ['GET', 'POST', 'PATCH', 'DELETE'], allowedHeaders: ['Content-Type', 'X-CSRF-Token'] }))
  }
  app.use(express.json({ limit: '100kb' }))
  app.use(cookieParser())

  const api = express.Router()
  api.get('/health', (_req, res) => res.json({ ok: true }))
  api.use('/cron', cronRouter)
  api.use(csrfProtection)
  api.use('/auth', authRouter)
  api.use('/tracking', trackingRouter)
  api.use('/shipments', authenticate, shipmentsRouter)
  api.use('/containers', authenticate, containersRouter)
  api.use('/users', authenticate, usersRouter)
  api.use('/account', authenticate, accountRouter)
  api.use('/staff/notifications', authenticate, requireRole('AGENT_GZ', 'AGENT_LOME', 'ADMIN'), staffNotificationsRouter)

  app.use('/api/v1', api)
  app.use(notFound)
  app.use(errorHandler)
  return app
}
