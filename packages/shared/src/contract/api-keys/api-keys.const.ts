/**
 * Constants of the `api-keys` resource: route, limits and identifier shape.
 *
 * Everything a server controller, a client service and the registry need is
 * defined **here**, once (plan `D6`). The API validates `POST /api/api-keys`
 * with `createApiKeySchema`, which is built from these very symbols, so the
 * browser and the server cannot enforce two different sets of numbers.
 */

/** Route of the collection, mounted under the global `api` prefix. */
export const API_KEYS_PATH = '/api/api-keys';

/** Nest path-parameter placeholder of the single-resource route. */
export const API_KEYS_IDENTIFIER_PARAM = ':identifier';

/** Max length of the human readable `name`. */
export const API_KEY_NAME_MAX_LENGTH = 200;

/** Max length of the unique, URL-safe `identifier`. */
export const API_KEY_IDENTIFIER_MAX_LENGTH = 200;

/**
 * Allowed `identifier` shape.
 *
 * URL-safe on purpose: the identifier is the `:identifier` path parameter of
 * `GET /api/api-keys/:identifier`, so a slash or a space would produce an
 * unroutable resource.
 */
export const API_KEY_IDENTIFIER_PATTERN = /^[A-Za-z0-9._-]{1,200}$/;

/** Max length of the optional free-text `description`. */
export const API_KEY_DESCRIPTION_MAX_LENGTH = 2000;

/** Max length of the token value itself. */
export const API_KEY_VALUE_MAX_LENGTH = 4000;
