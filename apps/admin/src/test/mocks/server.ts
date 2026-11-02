/**
 * The shared MSW server of the admin tests.
 *
 * The default set only registers the resource-specific handlers; the generic
 * wildcard handlers (any URL under the `/api/` prefix) are opt-in via
 * `server.use(...)` so they can never shadow a resource handler by accident.
 *
 * `src/test/setup.ts` owns the lifecycle (`listen` / `resetHandlers` / `close`);
 * this module only decides *what* the default network looks like.
 */

import { setupServer } from 'msw/node';
import { apiKeysHandlers } from './handlers/api-keys.handlers.js';

/** Shared server instance; imported by the setup file and the test helpers. */
export const server = setupServer(...apiKeysHandlers);
