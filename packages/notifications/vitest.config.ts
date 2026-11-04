import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for the notification package.
 *
 * The package is source-only (see AIS-79 plan decision D14): consumers bundle
 * the TypeScript sources, so the tests import exactly what an app imports.
 *
 * The global environment is deliberately `node` — a DOM environment would hide an
 * accidental `window`/`document`/`localStorage` reference in `src/core`, which the
 * package boundary forbids. The React binding suites opt into `jsdom` per file
 * with a `// @vitest-environment jsdom` docblock (AIS-83 decision D15); that keeps
 * the core tests DOM-free while `environmentMatchGlobs` (deprecated in Vitest 3)
 * is avoided.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    restoreMocks: true,
    clearMocks: true,
    // `pnpm sonar:coverage` consumes this report; scripts/sonar/lcov-merge.mjs
    // rewrites its paths to be repo-root relative for SonarQube.
    coverage: {
      provider: 'v8',
      reporter: ['lcov'],
      reportsDirectory: '../../coverage/notifications',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'test/**'],
    },
  },
});
