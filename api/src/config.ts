import crypto from 'node:crypto'

const env = process.env
const isProd = env.NODE_ENV === 'production'
const isTest = env.NODE_ENV === 'test' || !!env.VITEST

function jwtSecret(): string {
  const s = env.JWT_SECRET ?? ''
  if (s.length >= 32 && !s.startsWith('change-me')) return s
  if (isProd) throw new Error('JWT_SECRET must be set to a strong random value (>= 32 chars) in production')
  if (!isTest) console.warn('[config] JWT_SECRET missing/weak — using an ephemeral random secret (dev only)')
  return crypto.randomBytes(48).toString('base64url')
}

// Always Secure in production; may be relaxed only for plain-http local development.
const cookieSecure = isProd || env.COOKIE_SECURE === 'true'

export const config = {
  isProd,
  isTest,
  port: Number(env.PORT ?? 4000),
  corsOrigins: (env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  trustProxy: Number(env.TRUST_PROXY ?? 0),
  jwtSecret: jwtSecret(),
  accessTtlSec: 15 * 60,
  refreshTtlSec: 7 * 24 * 60 * 60,
  cookieSecure,
  // The __Host- prefix forces Secure + Path=/ + no Domain: the strongest cookie scoping browsers offer.
  cookies: {
    access: cookieSecure ? '__Host-jwt' : 'jwt',
    refresh: cookieSecure ? '__Host-rt' : 'rt',
    csrf: cookieSecure ? '__Host-csrf' : 'csrf',
  },
  loginRateLimit: Number(env.LOGIN_RATE_LIMIT ?? 5),
  uploadDir: new URL('../uploads/', import.meta.url).pathname,
  maxPhotoBytes: 5 * 1024 * 1024,
  twilio: {
    sid: env.TWILIO_ACCOUNT_SID ?? '',
    token: env.TWILIO_AUTH_TOKEN ?? '',
    from: env.TWILIO_WHATSAPP_FROM ?? '',
  },
}
