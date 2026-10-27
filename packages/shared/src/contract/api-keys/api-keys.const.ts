/**
 * Contract limits of the `api-keys` resource, mirrored from the backend.
 *
 * The API validates `POST /api/api-keys` with class-validator
 * ([`apps/api/src/api-keys/api-keys.const.ts`](../../../../../apps/api/src/api-keys/api-keys.const.ts));
 * the browser has to enforce the *same* numbers, otherwise the user gets a 400
 * only after a submit that the UI could have caught locally.
 *
 * The values are duplicated rather than imported, because `apps/api` is a
 * separate application bundle and must not depend on the shared package's build
 * for its own validation. Keeping the literals in one shared symbol here means
 * every frontend consumer (schema, form, tests) reads the same number, and a
 * backend change breaks exactly one file plus its tests.
 */

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
