// Génère docs/supabase/schema.sql : toutes les migrations Prisma en un seul
// script à coller dans l'éditeur SQL de Supabase (solution de secours).
// Le script enregistre aussi chaque migration dans _prisma_migrations avec la
// bonne empreinte, pour que « prisma migrate deploy » ne la rejoue pas ensuite.
// Usage : node server/scripts/supabase-sql.mjs
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const dir = join(root, 'server', 'prisma', 'migrations')
const names = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()

const out = [
  '-- Kader Cargo : schéma complet de la base (généré, ne pas modifier à la main)',
  '-- À n’utiliser QUE si les migrations automatiques du déploiement Vercel n’ont pas tourné.',
  '-- Supabase → SQL Editor → New query → coller ce fichier → Run. À exécuter sur une base vide.',
  '-- Régénérer : node server/scripts/supabase-sql.mjs',
  '',
  'BEGIN;',
  '',
  'CREATE TABLE IF NOT EXISTS "_prisma_migrations" (',
  '    "id" VARCHAR(36) PRIMARY KEY NOT NULL,',
  '    "checksum" VARCHAR(64) NOT NULL,',
  '    "finished_at" TIMESTAMPTZ,',
  '    "migration_name" VARCHAR(255) NOT NULL,',
  '    "logs" TEXT,',
  '    "rolled_back_at" TIMESTAMPTZ,',
  '    "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),',
  '    "applied_steps_count" INTEGER NOT NULL DEFAULT 0',
  ');',
]
for (const name of names) {
  const sql = readFileSync(join(dir, name, 'migration.sql'), 'utf8')
  const checksum = createHash('sha256').update(sql).digest('hex')
  const h = createHash('sha256').update(name).digest('hex')
  const id = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`
  out.push('', `-- ===== Migration ${name} =====`, sql.trimEnd(), '',
    `INSERT INTO "_prisma_migrations" ("id","checksum","finished_at","migration_name","applied_steps_count")`,
    `VALUES ('${id}','${checksum}',now(),'${name}',1);`)
}
out.push('', 'COMMIT;', '')
const target = join(root, 'docs', 'supabase', 'schema.sql')
writeFileSync(target, out.join('\n'))
console.log(`${names.length} migration(s) → ${target}`)
