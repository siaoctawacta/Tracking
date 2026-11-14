import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    env: { NODE_ENV: 'test', DATABASE_URL: 'file:./test.db', COOKIE_SECURE: 'false', TRUST_PROXY: '1', LOGIN_RATE_LIMIT: '5' },
    globalSetup: './test/global-setup.ts',
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
})
