/**
 * Server-side constants of the `api-keys` feature.
 *
 * Only what the **server** needs lives here: the DI token, the route segment and
 * the Postgres error identifiers. The contract limits (`name` length, identifier
 * pattern, …) are **not** duplicated any more — they are defined once in
 * `@callback/shared` and enforced by `createApiKeySchema` through `ZodBodyPipe`
 * (plan `D6`).
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
