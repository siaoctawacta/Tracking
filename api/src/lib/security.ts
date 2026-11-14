import crypto from 'node:crypto'
import { Algorithm, hash, verify } from '@node-rs/argon2'
import jwt from 'jsonwebtoken'
import { config } from '../config'
import type { Role } from './domain'

// Argon2id, 64 MiB memory, 3 passes — above OWASP minimums. A fresh 16-byte CSPRNG salt per hash.
const ARGON_OPTS = { algorithm: Algorithm.Argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1, outputLen: 32 }

export async function hashPassword(password: string): Promise<string> {
  return hash(password, { ...ARGON_OPTS, salt: crypto.randomBytes(16) })
}

export async function verifyPassword(hashStr: string, password: string): Promise<boolean> {
  try {
    return await verify(hashStr, password)
  } catch {
    return false
  }
}

// Used when the user does not exist, so response timing does not reveal valid identifiers.
let dummyHash: Promise<string> | undefined
export function getDummyHash() {
  dummyHash ??= hashPassword(crypto.randomBytes(16).toString('hex'))
  return dummyHash
}

export interface AccessClaims {
  sub: string
  role: Role
  name: string
}

export function signAccessToken(claims: AccessClaims): string {
  return jwt.sign(claims, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: config.accessTtlSec,
    issuer: 'benit-cargo',
    audience: 'benit-cargo-web',
    jwtid: crypto.randomUUID(),
  })
}

export function verifyAccessToken(token: string): AccessClaims | null {
  try {
    const p = jwt.verify(token, config.jwtSecret, {
      algorithms: ['HS256'],
      issuer: 'benit-cargo',
      audience: 'benit-cargo-web',
    }) as jwt.JwtPayload
    return { sub: String(p.sub), role: p.role as Role, name: String(p.name ?? '') }
  } catch {
    return null
  }
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url')
}

export function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

export function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb)
}
