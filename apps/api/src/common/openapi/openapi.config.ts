/**
 * Configuration of the generated OpenAPI document and of the two surfaces that
 * consume it (AIS-98, plan §8.3 / §8.6).
 *
 * Everything here is a constant or a **pure** predicate: the document generator,
 * the Swagger UI registration and the tests all read the same values, so the
 * served spec cannot disagree with the guard that decides whether the UI is
 * mounted.
 *
 * `APP_ENV` is the only environment input. The two exposure predicates take the
 * env as a parameter (instead of reading the module-level constant) so a unit
 * test can prove the prod behaviour without booting a prod process.
 */

import { API_PATH_PREFIX } from '@callback/shared';
import type { AppEnv } from '../../config/app-env.js';
import { APP_ENV } from '../../config/app-env.js';

/** Nest route segment of the machine-readable document. */
export const OPENAPI_JSON_ROUTE = 'openapi.json';

/**
 * Full path of the machine-readable document (`/api/openapi.json`).
 *
 * Derived from the shared global prefix, never written twice: the controller
 * declares {@link OPENAPI_JSON_ROUTE} and `main.ts` applies the prefix.
 */
export const OPENAPI_JSON_PATH = `${API_PATH_PREFIX}/${OPENAPI_JSON_ROUTE}`;

/** Route prefix the Swagger UI is mounted under (`/api/docs`). */
export const SWAGGER_UI_ROUTE_PREFIX = `${API_PATH_PREFIX}/docs`;

/** OpenAPI version emitted by the generator (plan `D6` / §8.3). */
export const OPENAPI_VERSION = '3.1.0';

/** `info.title` of the document. */
export const OPENAPI_TITLE = 'AIsztens API';

/** `info.version`; tracks the API package version, not the OpenAPI spec version. */
export const OPENAPI_INFO_VERSION = '0.0.1';

/** `info.description` — short, because the convention doc carries the detail. */
export const OPENAPI_DESCRIPTION =
  'Enveloped JSON API of AIsztens. Every response is either { data, meta } or { error } — see docs/Specs/API-Convention.md.';

/**
 * `servers`.
 *
 * A relative URL on purpose: the document is served by the very process it
 * describes, so the origin is always correct (local, dev droplet, prod) with no
 * per-env build step and no chance of a stale host name.
 */
export const OPENAPI_SERVERS = [
  { url: '/', description: 'The origin this document was served from' },
] as const;

/** `tags` — one per resource namespace of the registry. */
export const OPENAPI_TAGS = [
  {
    name: 'api-keys',
    description: 'Stored API keys used by the voice provider integration.',
  },
] as const;

/** Component name of the bearer scheme prepared for the future auth story. */
export const OPENAPI_SECURITY_SCHEME_NAME = 'bearerAuth';

/** `components.securitySchemes`; documented but not required by any operation yet. */
export const OPENAPI_SECURITY_SCHEMES = {
  [OPENAPI_SECURITY_SCHEME_NAME]: {
    type: 'http',
    scheme: 'bearer',
    description:
      'Reserved for the admin authentication story (AIS-73/74). No operation requires it yet.',
  },
} as const;

/**
 * Whether the Swagger UI (`/api/docs`) is mounted in an environment.
 *
 * Prod is excluded by decision: the UI hands out a map of the admin surface for
 * free, and the machine-readable document is already available for tooling.
 *
 * @param env - the environment the API boots in.
 * @returns `true` for `local` and `dev`, `false` for `prod`.
 */
export function isOpenApiDocsEnabled(env: AppEnv): boolean {
  return env !== 'prod';
}

/**
 * Whether the outgoing-body validator is registered in an environment.
 *
 * Same rule as the UI, different reason: the interceptor costs a second parse on
 * every response and it deliberately *fails* a request whose body breaks the
 * contract — acceptable in dev, unacceptable on a live call.
 *
 * @param env - the environment the API boots in.
 * @returns `true` for `local` and `dev`, `false` for `prod`.
 */
export function isResponseAssertEnabled(env: AppEnv): boolean {
  return env !== 'prod';
}

/** {@link isOpenApiDocsEnabled} for the environment of this process. */
export const OPENAPI_DOCS_ENABLED: boolean = isOpenApiDocsEnabled(APP_ENV);

/** {@link isResponseAssertEnabled} for the environment of this process. */
export const RESPONSE_ASSERT_ENABLED: boolean =
  isResponseAssertEnabled(APP_ENV);
