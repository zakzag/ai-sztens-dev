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
  },
});
