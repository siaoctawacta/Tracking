import nodemailer, { type Transporter } from 'nodemailer'
import { config } from '../config'

let transport: Transporter | null = null

export const mailEnabled = () => !!config.mail.host

/** Sends an e-mail (SMTP — e.g. Gmail with an app password). Simulated (logged) without SMTP settings. */
export async function sendMail(to: string, subject: string, text: string, html?: string): Promise<'SENT' | 'SIMULATED'> {
  if (!mailEnabled()) {
    if (!config.isTest) console.info(`[mail:simulated] → ${to} · ${subject}\n${text}\n`)
    return 'SIMULATED'
  }
  transport ??= nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.secure,
    auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass } : undefined,
  })
  await transport.sendMail({ from: config.mail.from, to, subject, text, html })
  return 'SENT'
}

/** Minimal branded HTML wrapper (bordeaux header, white body). */
export function brandedHtml(title: string, paragraphs: string[], highlight?: string) {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
  return `<!doctype html><html><body style="margin:0;background:#fbf8f9;font-family:Arial,Helvetica,sans-serif;color:#2a2225">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eee5e8">
  <tr><td style="background:#8b1538;padding:20px 28px;color:#ffffff;font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:bold;letter-spacing:2px">✈ KADER CARGO</td></tr>
  <tr><td style="padding:28px">
  <h1 style="margin:0 0 16px;font-size:20px;color:#2b0c16">${esc(title)}</h1>
  ${paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55">${esc(p)}</p>`).join('')}
  ${highlight ? `<p style="margin:20px 0;font-size:32px;font-weight:bold;letter-spacing:8px;color:#8b1538;text-align:center">${esc(highlight)}</p>` : ''}
  <p style="margin:24px 0 0;font-size:12px;color:#7a6a70">Kader Cargo · Express Air Cargo Guangzhou → Lomé · WhatsApp +228 90 94 44 48</p>
  </td></tr></table></td></tr></table></body></html>`
}
