import { PrismaPg } from '@prisma/adapter-pg'
import type { PoolConfig } from 'pg'
import { PrismaClient } from './generated/prisma/client'

/**
 * PostgreSQL connection (Supabase in production).
 *
 * - DATABASE_URL: on Vercel, Supabase's "Transaction pooler" string (port 6543).
 * - SSL: DATABASE_SSL=off | require (encrypted) | verify (encrypted + certificate checked against
 *   DATABASE_CA_CERT, Supabase's CA in PEM). Defaults to "require" for Supabase hosts, "off" otherwise.
 *   The sslmode parameter is removed from the URL so that these settings always apply.
 * - Serverless: each function instance keeps a tiny pool; Supabase's pooler multiplexes connections.
 */
function poolConfig(): PoolConfig {
  const raw = process.env.DATABASE_URL ?? 'postgresql://kader:kader@localhost:5432/kader_cargo'
  const url = new URL(raw)
  url.searchParams.delete('sslmode')
  url.searchParams.delete('pgbouncer')
  const isSupabase = /supabase\.(co|com)$/.test(url.hostname)
  const mode = process.env.DATABASE_SSL ?? (isSupabase ? 'require' : 'off')
  const ca = process.env.DATABASE_CA_CERT?.replace(/\\n/g, '\n')
  let ssl: PoolConfig['ssl'] = false
  if (mode === 'verify') {
    if (!ca) throw new Error('DATABASE_SSL=verify requires DATABASE_CA_CERT (Supabase CA certificate, PEM)')
    ssl = { ca, rejectUnauthorized: true }
  } else if (mode === 'require') {
    ssl = { rejectUnauthorized: false }
  }
  const serverless = process.env.VERCEL === '1'
  return {
    connectionString: url.toString(),
    ssl,
    max: Number(process.env.DB_POOL_MAX ?? (serverless ? 2 : 10)),
    idleTimeoutMillis: serverless ? 5_000 : 30_000,
    connectionTimeoutMillis: 10_000,
  }
}

// All queries go through Prisma: parameterised statements, no string-built SQL.
export const prisma = new PrismaClient({ adapter: new PrismaPg(poolConfig()) })
