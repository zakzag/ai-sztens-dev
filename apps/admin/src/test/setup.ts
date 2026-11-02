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
import { afterAll, afterEach } from 'vitest';
import { server } from './mocks/server.js';

process.env.TZ = 'Europe/Budapest';

// `listen()` runs at module scope on purpose, **not** inside `beforeAll`:
// `services/api-client.ts` captures `globalThis.fetch` the moment it is imported
// (the composition root creates the client once). The setup file executes
// before any test module, so patching `fetch` here guarantees the captured
// reference is already the MSW interceptor — a `beforeAll` hook would run after
// the imports and the client would hold the unpatched Node `fetch`, which
// cannot resolve the relative `/api/...` URL.
server.listen({ onUnhandledRequest: 'error' });

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
