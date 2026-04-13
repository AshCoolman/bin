import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@catlens/core': path.resolve('./packages/core/src/index.ts'),
    },
  },
  test: {
    include: ['test/integration/**/*.test.ts'],
    pool: 'forks',
    testTimeout: 30_000,
  },
})
