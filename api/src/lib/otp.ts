/**
 * One-time verification codes (6 digits) sent by WhatsApp or e-mail.
 * - Only an HMAC of the code is stored; codes expire after 10 minutes and allow 5 attempts.
 * - Resend cooldown of 60 s and at most 5 codes per destination per hour.
 */
import crypto from 'node:crypto'
import { config } from '../config'
import { prisma } from '../db'
import { HttpError } from '../middleware/errors'
import type { Identifier } from './identifiers'
import { brandedHtml, mailEnabled, sendMail } from './mailer'
import { safeEqual } from './security'
import { activeProvider, sendWhatsAppNow } from './whatsapp'

export type OtpPurpose = 'REGISTER' | 'LOGIN' | 'LINK'

const hmac = (code: string, destination: string) => crypto.createHmac('sha256', config.jwtSecret).update(`${destination}:${code}`).digest('hex')

const PURPOSE_TEXT: Record<OtpPurpose, string> = {
  REGISTER: 'pour créer votre compte',
  LOGIN: 'pour vous connecter',
  LINK: 'pour ajouter ce moyen de connexion à votre compte',
}

/** True when the code really leaves the server (otherwise it is printed in the API console). */
function channelLive(id: Identifier) {
  return id.kind === 'email' ? mailEnabled() : activeProvider() !== 'simulated'
}

async function deliverCode(id: Identifier, code: string, purpose: OtpPurpose) {
  const why = PURPOSE_TEXT[purpose]
  if (id.kind === 'phone') {
    const body = `🔐 *Kader Cargo* — Votre code de vérification ${why} : *${code}*\n\nIl expire dans 10 minutes. Ne le communiquez à personne, même à un agent Kader Cargo.`
    return sendWhatsAppNow(id.value, body, 'OTP', [code])
  }
  const text = `Votre code de vérification Kader Cargo ${why} : ${code}\n\nIl expire dans 10 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.`
  const html = brandedHtml('Votre code de vérification', [`Voici votre code ${why}. Il expire dans 10 minutes.`], code)
  return sendMail(id.value, `${code} est votre code Kader Cargo`, text, html)
}

/** Sends a plain notice instead of a code (e.g. "you already have an account") — keeps responses identical. */
export async function sendNotice(id: Identifier, title: string, message: string) {
  if (id.kind === 'phone') return sendWhatsAppNow(id.value, `*Kader Cargo* — ${title}\n\n${message}`, 'ACCOUNT', [title, message])
  return sendMail(id.value, `Kader Cargo — ${title}`, message, brandedHtml(title, [message]))
}

export interface IssuedOtp {
  channel: 'WHATSAPP' | 'EMAIL'
  /** Only in non-production when the channel is simulated, so the demo works without WhatsApp/SMTP. */
  devCode?: string
}

export async function issueOtp(id: Identifier, purpose: OtpPurpose, opts: { userId?: string; payload?: unknown } = {}): Promise<IssuedOtp> {
  const now = Date.now()
  const recent = await prisma.otpCode.findMany({
    where: { destination: id.value, createdAt: { gte: new Date(now - 3600_000) } },
    orderBy: { createdAt: 'desc' },
  })
  if (recent[0] && now - recent[0].createdAt.getTime() < config.otp.resendCooldownMs) {
    const wait = Math.ceil((config.otp.resendCooldownMs - (now - recent[0].createdAt.getTime())) / 1000)
    throw new HttpError(429, `Patientez ${wait} s avant de demander un nouveau code`, 'otp_cooldown')
  }
  if (recent.length >= config.otp.maxPerHour) throw new HttpError(429, 'Trop de codes demandés. Réessayez dans une heure.', 'otp_rate_limited')

  // A new code invalidates the previous ones for the same destination and purpose.
  await prisma.otpCode.updateMany({ where: { destination: id.value, purpose, consumedAt: null }, data: { consumedAt: new Date() } })
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
  await prisma.otpCode.create({
    data: {
      channel: id.kind === 'phone' ? 'WHATSAPP' : 'EMAIL',
      destination: id.value,
      purpose,
      codeHash: hmac(code, id.value),
      payload: opts.payload ? JSON.stringify(opts.payload) : null,
      userId: opts.userId,
      expiresAt: new Date(now + config.otp.ttlMs),
    },
  })
  try {
    await deliverCode(id, code, purpose)
  } catch (e) {
    console.error('[otp] delivery failed:', e instanceof Error ? e.message : e)
    throw new HttpError(502, id.kind === 'phone' ? 'Impossible d’envoyer le code WhatsApp. Réessayez.' : 'Impossible d’envoyer l’e-mail. Réessayez.', 'otp_delivery_failed')
  }
  return {
    channel: id.kind === 'phone' ? 'WHATSAPP' : 'EMAIL',
    ...(!config.isProd && !channelLive(id) ? { devCode: code } : {}),
  }
}

/** Checks a code; on success marks it used and returns the stored row (payload, userId). */
export async function consumeOtp(id: Identifier, purpose: OtpPurpose, code: string) {
  const row = await prisma.otpCode.findFirst({
    where: { destination: id.value, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  })
  const invalid = new HttpError(400, 'Code invalide ou expiré', 'otp_invalid')
  if (!row) throw invalid
  if (row.attempts >= config.otp.maxAttempts) {
    await prisma.otpCode.update({ where: { id: row.id }, data: { consumedAt: new Date() } })
    throw new HttpError(400, 'Trop d’essais. Demandez un nouveau code.', 'otp_locked')
  }
  if (!/^\d{6}$/.test(code) || !safeEqual(hmac(code, id.value), row.codeHash)) {
    await prisma.otpCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } })
    throw invalid
  }
  // Atomic: a code can only be redeemed once even under concurrent requests.
  const { count } = await prisma.otpCode.updateMany({ where: { id: row.id, consumedAt: null }, data: { consumedAt: new Date() } })
  if (!count) throw invalid
  return row
}
