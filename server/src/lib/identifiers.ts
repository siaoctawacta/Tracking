import { z } from 'zod'
import { normalizePhone } from './domain'
import { HttpError } from '../middleware/errors'

export type Identifier = { kind: 'phone'; value: string } | { kind: 'email'; value: string }

const email = z.string().email()

/** "90 11 22 33", "+228…", "afi@gmail.com" → normalised phone (E.164) or lower-cased e-mail. */
export function parseIdentifier(input: string): Identifier {
  const raw = input.trim()
  if (raw.includes('@')) {
    const value = raw.toLowerCase()
    if (!email.safeParse(value).success) throw new HttpError(400, 'Adresse e-mail invalide', 'bad_identifier')
    return { kind: 'email', value }
  }
  if (!/^[+\d\s().-]{6,25}$/.test(raw)) throw new HttpError(400, 'Numéro de téléphone ou e-mail invalide', 'bad_identifier')
  const value = normalizePhone(raw)
  if (!/^\+\d{8,15}$/.test(value)) throw new HttpError(400, 'Numéro de téléphone invalide', 'bad_identifier')
  return { kind: 'phone', value }
}

export const whereIdentifier = (id: Identifier) => (id.kind === 'email' ? { email: id.value } : { phone: id.value })

/** "+22890112233" → "+228 •• •• 33", "afi.mensah@gmail.com" → "af•••@gmail.com" */
export function maskIdentifier(id: Identifier) {
  if (id.kind === 'phone') return `${id.value.slice(0, 4)} •• •• ${id.value.slice(-2)}`
  const [user, domain] = id.value.split('@')
  return `${user.slice(0, 2)}•••@${domain}`
}
