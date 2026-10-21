/**
 * Constants for the `api-keys` feature.
 *
 * Everything that would otherwise be a literal repeated across the repository,
 * the DTO and the tests lives here, so the limits cannot drift apart: the DTO
 * rejects with the same number the controller documents, and the tests assert
 * against the same symbol the production code uses.
 */

/**
 * DI token of the {@link ApiKeysRepository} implementation.
 *
 * A string token (not the class) is what makes the service depend on the
 * *interface*: the module binds the Drizzle implementation here, while the
 * service spec injects a plain mock object without Nest.
 */
export const API_KEYS_REPOSITORY = 'API_KEYS_REPOSITORY';

/**
 * Controller route segment.
 *
 * The global prefix (`api`, see `main.ts`) turns this into `/api/api-keys`.
 */
export const API_KEYS_ROUTE = 'api-keys';

/** Max length of `name`; matches `text` in the DB but is enforced at the edge. */
export const API_KEY_NAME_MAX_LENGTH = 200;

/** Max length of `identifier`, the human search key. */
export const API_KEY_IDENTIFIER_MAX_LENGTH = 200;

/**
 * Allowed `identifier` shape.
 *
 * Kept URL-safe on purpose: the identifier is the `:identifier` path parameter
 * of `GET /api/api-keys/:identifier`, so a slash or a space would produce an
 * unroutable resource.
 */
export const API_KEY_IDENTIFIER_PATTERN = /^[A-Za-z0-9._-]{1,200}$/;

/** Max length of the optional free-text `description`. */
export const API_KEY_DESCRIPTION_MAX_LENGTH = 2000;

/**
 * Max length of the token value itself.
 *
 * Generous (provider tokens are long), but bounded so an accidental file paste
 * cannot be stored as an API key.
 */
export const API_KEY_VALUE_MAX_LENGTH = 4000;

/** Postgres SQLSTATE for a unique-constraint violation. */
export const PG_UNIQUE_VIOLATION_CODE = '23505';

/**
 * Name of the unique constraint on `identifier` (AIS-39).
 *
 * Used as the secondary signal next to {@link PG_UNIQUE_VIOLATION_CODE}: a
 * `23505` from a different constraint must not be reported as an identifier
 * conflict. The constraint name is stable because the schema spells it out.
 */
export const API_KEY_IDENTIFIER_CONSTRAINT = 'api_keys_identifier_key';
