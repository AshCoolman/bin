import { defineConfig } from 'vitest/config.js'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@catlens/core': path.resolve('./packages/core/src/index.ts'),
    },
  },
  test: {
    include: ['packages/*/src/**/*.test.ts', 'test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts'],
      exclude: [
        'packages/*/src/**/*.test.ts',
        'packages/core/src/query/ast.ts',
        'packages/core/src/query/result.ts',
        'packages/core/src/lenses/types.ts',
        'packages/cli/src/index.ts',
      ],
      thresholds: {
        statements: 95,
        branches: 95,
      },
    },
  },
})
