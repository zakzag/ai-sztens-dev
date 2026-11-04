import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for the framework-independent notification core.
 *
 * The package is source-only (see AIS-79 plan decision D14): consumers bundle
 * the TypeScript sources, so the tests import exactly what an app imports.
 *
 * The environment is deliberately `node` — a DOM environment would hide an
 * accidental `window`/`document`/`localStorage` reference that the package
 * boundary forbids.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    restoreMocks: true,
    clearMocks: true,
    // `pnpm sonar:coverage` consumes this report; scripts/sonar/lcov-merge.mjs
    // rewrites its paths to be repo-root relative for SonarQube.
    coverage: {
      provider: 'v8',
      reporter: ['lcov'],
      reportsDirectory: '../../coverage/notifications',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'test/**'],
    },
  },
});
