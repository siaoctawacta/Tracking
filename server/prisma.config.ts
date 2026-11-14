import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Default lets `prisma generate` run on a fresh clone before server/.env exists.
    url: process.env.DATABASE_URL ?? 'file:./dev.db',
  },
})
