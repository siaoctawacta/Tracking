import { execSync } from 'node:child_process'
import pg from 'pg'

// Fresh, throwaway schema for every run (test database only).
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://kader:kader@localhost:5432/kader_cargo_test'
  if (!/test/i.test(new URL(url).pathname)) throw new Error(`Refusing to wipe a database whose name does not contain "test": ${url}`)
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  await client.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;')
  await client.end()
  const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url, NODE_ENV: 'test' }
  execSync('npx prisma migrate deploy', { env, stdio: 'ignore' })
  execSync('npx tsx prisma/seed.ts', { env, stdio: 'ignore' })
}
