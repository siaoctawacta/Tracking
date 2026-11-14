// Consistent online backup of the SQLite database (safe while the API is running).
//   node scripts/backup.mjs /var/backups/kader-cargo/kader-2026-11-14.db
import 'dotenv/config'
import Database from 'better-sqlite3'

const target = process.argv[2]
if (!target) {
  console.error('Usage: node scripts/backup.mjs <fichier-de-sauvegarde.db>')
  process.exit(1)
}
const file = (process.env.DATABASE_URL ?? 'file:./dev.db').replace(/^file:/, '')
const db = new Database(file, { readonly: true, fileMustExist: true })
await db.backup(target)
db.close()
console.log(`Base sauvegardée → ${target}`)
