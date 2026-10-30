/**
 * Composition-root constants for the admin API client.
 *
 * The base URL itself is *configuration* (`VITE_API_BASE_URL`, baked in at build
 * time), not a literal at the call site: it varies per environment. Only the
 * fallback used when the variable is missing lives here.
 */

/**
 * Fallback base URL.
 *
 * `/api` is what the local stack expects: `vite.config.ts` proxies it to the
 * NestJS API, so a developer who forgot to copy `.env.example` still gets a
 * working app instead of `undefined/api-keys` requests.
 */
export const DEFAULT_API_BASE_URL = '/api';
