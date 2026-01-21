import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/backend/**/__tests__/**/*.test.ts', 'src/backend/**/?(*.)+(spec|test).ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/backend/**/*.ts'],
      exclude: [
        'src/backend/**/*.d.ts',
        'src/backend/**/index.ts',
      ],
    },
    setupFiles: ['./src/backend/__tests__/setup.ts'],
    globals: true,
  },
});
