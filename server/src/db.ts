import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from './generated/prisma/client'

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? 'file:./dev.db' })

// All queries go through Prisma: parameterised prepared statements, no string-built SQL.
export const prisma = new PrismaClient({ adapter })
