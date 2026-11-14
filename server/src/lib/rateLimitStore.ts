import type { ClientRateLimitInfo, Options, Store } from 'express-rate-limit'
import { prisma } from '../db'

/**
 * express-rate-limit store backed by PostgreSQL, so that limits hold across every API instance
 * (serverless functions on Vercel scale horizontally; in-memory counters would be per instance).
 * One atomic upsert per counted request.
 */
export class PostgresStore implements Store {
  windowMs = 60_000
  localKeys = false

  constructor(readonly prefix: string) {}

  init(options: Options) {
    this.windowMs = options.windowMs
  }

  private k(key: string) {
    return `${this.prefix}:${key}`
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const row = await prisma.rateLimit.findUnique({ where: { key: this.k(key) } })
    if (!row || row.resetAt <= new Date()) return undefined
    return { totalHits: row.hits, resetTime: row.resetAt }
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const rows = await prisma.$queryRaw<{ hits: number; resetAt: Date }[]>`
      INSERT INTO "RateLimit" ("key", "hits", "resetAt")
      VALUES (${this.k(key)}, 1, now() + (${this.windowMs}::int * interval '1 millisecond'))
      ON CONFLICT ("key") DO UPDATE SET
        "hits" = CASE WHEN "RateLimit"."resetAt" <= now() THEN 1 ELSE "RateLimit"."hits" + 1 END,
        "resetAt" = CASE WHEN "RateLimit"."resetAt" <= now() THEN EXCLUDED."resetAt" ELSE "RateLimit"."resetAt" END
      RETURNING "hits", "resetAt"`
    return { totalHits: Number(rows[0].hits), resetTime: rows[0].resetAt }
  }

  async decrement(key: string) {
    await prisma.$executeRaw`UPDATE "RateLimit" SET "hits" = GREATEST("hits" - 1, 0) WHERE "key" = ${this.k(key)}`
  }

  async resetKey(key: string) {
    await prisma.rateLimit.deleteMany({ where: { key: this.k(key) } })
  }
}
