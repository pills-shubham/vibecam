import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@vibecam/types': resolve(__dirname, 'packages/types/src/index.ts'),
      '@vibecam/shared': resolve(__dirname, 'packages/shared/src/index.ts'),
      '@vibecam/config': resolve(__dirname, 'packages/config/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
});
