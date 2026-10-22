import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Vitest configuration for the admin SPA.
 *
 * Deliberately separate from `vite.config.ts`: the dev server needs the
 * `/api` proxy and the Tailwind plugin, tests need neither. `jsdom` gives the
 * components a DOM, and `src/test/setup.ts` installs the jest-dom matchers and
 * the per-test cleanup.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    clearMocks: true,
    // `pnpm sonar:coverage` consumes this report; scripts/sonar/lcov-merge.mjs
    // rewrites its paths to be repo-root relative for SonarQube.
    coverage: {
      provider: 'v8',
      reporter: ['lcov'],
      reportsDirectory: '../../coverage/admin',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/vite-env.d.ts'],
    },
  },
});
