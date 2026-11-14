import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'
import { config } from '../config'
import { HttpError } from '../middleware/errors'

export interface GoogleProfile {
  sub: string
  email: string | null
  emailVerified: boolean
  name: string | null
}

let keys: JWTVerifyGetKey | null = null

/** Test seam: lets tests verify tokens signed with a local key. */
export function setGoogleKeysForTests(k: JWTVerifyGetKey | null) {
  keys = k
}

export const googleEnabled = () => !!config.googleClientId

/** Verifies a Google Identity Services ID token (signature, audience, issuer, expiry). */
export async function verifyGoogleCredential(credential: string): Promise<GoogleProfile> {
  if (!googleEnabled()) throw new HttpError(400, 'La connexion Google n’est pas activée', 'google_disabled')
  keys ??= createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))
  try {
    const { payload } = await jwtVerify(credential, keys, {
      audience: config.googleClientId,
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
    })
    return {
      sub: String(payload.sub),
      email: typeof payload.email === 'string' ? payload.email.toLowerCase() : null,
      emailVerified: payload.email_verified === true,
      name: typeof payload.name === 'string' ? payload.name : null,
    }
  } catch {
    throw new HttpError(401, 'Connexion Google invalide', 'google_invalid')
  }
}
