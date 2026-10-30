/**
 * The global HTTP prefix of the API (AIS-89).
 *
 * The same fact needs two renderings, and they must not drift apart:
 *
 * - `API_GLOBAL_PREFIX` is what Nest's `setGlobalPrefix()` receives (`'api'`);
 * - `API_PATH_PREFIX` is how the prefix appears at the start of a registry
 *   `path` (`'/api'`), which is exactly what a client has to strip from a
 *   registry path to obtain a path relative to the base URL it was configured
 *   with (`packages/api-client`).
 *
 * `healthz` is deliberately excluded from the prefix in `apps/api/src/main.ts`,
 * so it is the only documented route that does **not** start with
 * `API_PATH_PREFIX`.
 */

/** Prefix handed to `app.setGlobalPrefix()` in the API bootstrap. */
export const API_GLOBAL_PREFIX = 'api';

/** The same prefix as it appears at the beginning of a registry `path`. */
export const API_PATH_PREFIX = `/${API_GLOBAL_PREFIX}`;
