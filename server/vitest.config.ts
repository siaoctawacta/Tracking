import { defineConfig } from 'vitest/config'

// Tests run against a dedicated PostgreSQL database, wiped and recreated on every run.
// Override with TEST_DATABASE_URL (never point it at a database whose data matters).
const TEST_DB = process.env.TEST_DATABASE_URL ?? 'postgresql://kader:kader@localhost:5432/kader_cargo_test'

export default defineConfig({
  test: {
    env: { NODE_ENV: 'test', DATABASE_URL: TEST_DB, DIRECT_URL: TEST_DB, COOKIE_SECURE: 'false', TRUST_PROXY: '1', LOGIN_RATE_LIMIT: '5' },
    globalSetup: './test/global-setup.ts',
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
})
