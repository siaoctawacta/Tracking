import { prisma } from '../db'
import { diagnoseDbError } from './dbErrors'

/** Checks that the database answers and that the schema exists. */
export async function checkDatabase(): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    await prisma.user.count({ take: 1 })
    return { ok: true }
  } catch (err) {
    console.error('[health] database check failed:', err)
    return { ok: false, reason: diagnoseDbError(err) }
  }
}
