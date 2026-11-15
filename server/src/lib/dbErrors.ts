/** Collects codes and messages along an error's cause chain (Prisma keeps the driver error in meta). */
function describe(err: unknown): string {
  const parts: string[] = []
  const queue: unknown[] = [err]
  for (let i = 0; queue.length && i < 12; i++) {
    const o = queue.shift() as { code?: unknown; message?: unknown; cause?: unknown; originalCode?: unknown; originalMessage?: unknown; kind?: unknown; meta?: { driverAdapterError?: unknown } } | null
    if (!o || typeof o !== 'object') continue
    for (const v of [o.code, o.originalCode, o.kind, o.originalMessage, o.message]) if (typeof v === 'string') parts.push(v)
    queue.push(o.cause, o.meta?.driverAdapterError)
  }
  return parts.join(' | ')
}

/**
 * Translates a database failure into a short, secret-free diagnosis for the operator
 * (never the raw message, which may contain host names, user names or SQL).
 */
export function diagnoseDbError(err: unknown): string {
  const d = describe(err)
  if (/P1000|28P01|AuthenticationFailed|password authentication failed/i.test(d)) return 'Mot de passe de la base refusé : vérifiez le mot de passe dans DATABASE_URL'
  if (/tenant or user not found/i.test(d)) return 'Utilisateur inconnu du pooler Supabase : l’utilisateur doit être postgres.<identifiant du projet>, comme dans la chaîne copiée depuis Supabase'
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(d)) return 'Hôte de la base introuvable : vérifiez l’adresse dans DATABASE_URL'
  if (/P2021|42P01|TableDoesNotExist|relation .* does not exist/i.test(d)) return 'Tables absentes : les migrations n’ont pas été appliquées (DIRECT_URL manquante au moment du build ?)'
  if (/self[- ]signed|certificate|SSL|TLS/i.test(d)) return 'Erreur SSL vers la base : vérifiez DATABASE_SSL et DATABASE_CA_CERT'
  if (/P1001|P1002|DatabaseNotReachable|ECONNREFUSED|ETIMEDOUT|timeout|ECONNRESET/i.test(d)) return 'Base injoignable : vérifiez l’hôte et le port de DATABASE_URL (chaîne « Transaction pooler », port 6543)'
  return 'Erreur de base de données : consultez les journaux de la fonction'
}

/** True when the failure means the database cannot be used at all (not a query-level error). */
export function isDbUnavailable(err: unknown): boolean {
  const name = (err as { name?: unknown })?.name
  if (name === 'PrismaClientInitializationError') return true
  return /P1000|P1001|P1002|P1017|AuthenticationFailed|DatabaseNotReachable|28P01|tenant or user not found|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|ECONNRESET|Connection terminated|timeout exceeded when trying to connect/i.test(describe(err))
}
