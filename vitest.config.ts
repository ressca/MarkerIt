import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    setupFiles: ['./apps/app/vitest.setup.ts'],
    include: ['apps/app/**/*.test.{ts,tsx}', 'apps/landing/**/*.test.{ts,tsx}', 'packages/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: [
        'apps/**/*.{ts,tsx}',
        'packages/**/*.{ts,tsx}',
      ],
      exclude: ['**/*.test.{ts,tsx}', '**/*.d.ts', '**/.next/**', '**/next.config.ts'],
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
      reporter: ['text', 'html'],
    },
  },
});
