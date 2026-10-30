/**
 * Global test setup for the admin SPA.
 *
 * Responsibilities:
 * - install the jest-dom matchers (`toBeInTheDocument`, `toHaveValue`, …),
 * - unmount every rendered tree after each test, so a leaked component cannot
 *   make the next test pass by accident,
 * - pin the timezone, so the `expiresAt` local⇄UTC conversion tests do not
 *   depend on the machine running them.
 *
 * Mocks and fixtures never live here: they belong in `src/test/mocks/`.
 */

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

process.env.TZ = 'Europe/Budapest';

afterEach(() => {
  cleanup();
});
