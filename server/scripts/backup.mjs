// PostgreSQL backup (custom format, restorable with pg_restore). Needs the pg_dump client tool.
//   node scripts/backup.mjs sauvegarde.dump
// Uses DIRECT_URL (Supabase "Session pooler" / direct connection) or DATABASE_URL.
import 'dotenv/config'
import { spawnSync } from 'node:child_process'

const target = process.argv[2]
if (!target) {
  console.error('Usage: node scripts/backup.mjs <fichier.dump>')
  process.exit(1)
}
const url = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!url) {
  console.error('DIRECT_URL ou DATABASE_URL manquant')
  process.exit(1)
}
const r = spawnSync('pg_dump', ['--format=custom', '--no-owner', '--no-privileges', '--file', target, url], { stdio: 'inherit' })
if (r.error) {
  console.error('pg_dump introuvable : installez le client PostgreSQL (apt install postgresql-client)')
  process.exit(1)
}
if (r.status !== 0) process.exit(r.status ?? 1)
console.log(`Base sauvegardée → ${target}`)
