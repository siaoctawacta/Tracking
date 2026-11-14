import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Migrations need a session connection: with Supabase, DIRECT_URL is the "Session pooler" string
    // (port 5432) while DATABASE_URL is the "Transaction pooler" used by the app at runtime.
    // The local default lets `prisma generate` run on a fresh clone before server/.env exists.
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || 'postgresql://kader:kader@localhost:5432/kader_cargo',
  },
})
