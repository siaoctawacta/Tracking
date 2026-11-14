import { execSync } from 'node:child_process'
import fs from 'node:fs'

// Fresh, throwaway database for every run.
export default function setup() {
  const env = { ...process.env, DATABASE_URL: 'file:./test.db', NODE_ENV: 'test' }
  for (const f of ['test.db', 'test.db-journal']) fs.rmSync(f, { force: true })
  execSync('npx prisma migrate deploy', { env, stdio: 'ignore' })
  execSync('npx tsx prisma/seed.ts', { env, stdio: 'ignore' })
}
