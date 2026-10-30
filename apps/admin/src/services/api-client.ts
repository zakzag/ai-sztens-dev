/**
 * Composition root of the admin SPA.
 *
 * This is the **only** module allowed to know how the API is configured, and
 * the only place that calls `createHttpClient` / `createApiKeysService`.
 * Everything downstream (query hooks, pages, tests) depends on the exported
 * instances — or, in tests, on a double of them — never on `fetch` and never on
 * `import.meta.env`.
 *
 * Consequences, all intentional:
 * - no React import here, so the module stays usable from plain TS;
 * - the base URL is read once at module load (it is baked into the bundle at
 *   build time, there is no runtime override);
 * - the token supplier is a function, so a login during the session is picked
 *   up by the next request without re-creating the client.
 */

import {
  createApiKeysService,
  createHttpClient,
  type ApiKeysService,
  type HttpClient,
} from '@callback/api-client';
import { readSessionToken } from '../auth/session-token.js';
import { DEFAULT_API_BASE_URL } from './api-client.const.js';

/**
 * @returns `VITE_API_BASE_URL` when it is a non-empty string, otherwise
 *   {@link DEFAULT_API_BASE_URL}.
 */
function resolveBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL;

  if (typeof configured === 'string' && configured.trim().length > 0) {
    return configured;
  }

  return DEFAULT_API_BASE_URL;
}

/** Shared transport: one instance, so the token hook is evaluated per request. */
export const httpClient: HttpClient = createHttpClient({
  baseUrl: resolveBaseUrl(),
  getToken: readSessionToken,
});

/** `api-keys` service consumed by `features/api-keys`. */
export const apiKeysService: ApiKeysService = createApiKeysService(httpClient);
