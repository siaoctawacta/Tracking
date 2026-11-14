import crypto from 'node:crypto'

const env = process.env

function parseJson<T>(raw: string | undefined): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    throw new Error('Invalid JSON in environment variable')
  }
}
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
  /** Quality-control photos. In production, point it outside the code folder (e.g. /var/lib/kader-cargo/uploads). */
  uploadDir: env.UPLOAD_DIR || new URL('../uploads/', import.meta.url).pathname,
  maxPhotoBytes: 5 * 1024 * 1024,
  /** Public URL of the SPA, used for tracking links in WhatsApp messages (omitted when empty). */
  publicWebUrl: (env.PUBLIC_WEB_URL ?? '').replace(/\/+$/, ''),
  /** E-mail (OTP codes, account notices). Without SMTP_HOST, e-mails are simulated (logged). Gmail: smtp.gmail.com + app password. */
  mail: {
    host: env.SMTP_HOST ?? '',
    port: Number(env.SMTP_PORT ?? 465),
    secure: (env.SMTP_SECURE ?? 'true') === 'true',
    user: env.SMTP_USER ?? '',
    pass: env.SMTP_PASS ?? '',
    from: env.MAIL_FROM ?? 'Kader Cargo <no-reply@kadercargo.com>',
  },
  /** "Continuer avec Google" — OAuth client ID from Google Cloud Console (disabled when empty). */
  googleClientId: env.GOOGLE_CLIENT_ID ?? '',
  otp: {
    ttlMs: 10 * 60 * 1000,
    maxAttempts: 5,
    resendCooldownMs: 60 * 1000,
    maxPerHour: 5,
  },
  whatsapp: {
    /** 'twilio' | 'meta' | 'simulated' — auto-detected from the credentials when unset. */
    provider: env.WHATSAPP_PROVIDER ?? '',
    twilio: {
      sid: env.TWILIO_ACCOUNT_SID ?? '',
      token: env.TWILIO_AUTH_TOKEN ?? '',
      from: env.TWILIO_WHATSAPP_FROM ?? '',
      /** Optional JSON map step → approved Content template SID, e.g. {"READY":"HX…"} */
      contentSids: parseJson<Record<string, string>>(env.TWILIO_CONTENT_SIDS) ?? {},
    },
    meta: {
      token: env.META_WHATSAPP_TOKEN ?? '',
      phoneNumberId: env.META_WHATSAPP_PHONE_NUMBER_ID ?? '',
      /** Approved templates are named `${prefix}${step}` (e.g. kader_ready). Empty = free-form text (24h window only). */
      templatePrefix: env.META_TEMPLATE_PREFIX ?? 'kader_',
      language: env.META_TEMPLATE_LANGUAGE ?? 'fr',
    },
  },
}
