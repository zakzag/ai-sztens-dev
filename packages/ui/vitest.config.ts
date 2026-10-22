import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Vitest configuration for the UI kit.
 *
 * The package is source-only (see plan decision D14): consumers bundle the
 * TypeScript sources through Vite, so there is no build artifact to test
 * against — the tests import exactly what the apps import.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    clearMocks: true,
    // `pnpm sonar:coverage` consumes this report; scripts/sonar/lcov-merge.mjs
    // rewrites its paths to be repo-root relative for SonarQube.
    coverage: {
      provider: 'v8',
      reporter: ['lcov'],
      reportsDirectory: '../../coverage/ui',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'test/**'],
    },
  },
});
