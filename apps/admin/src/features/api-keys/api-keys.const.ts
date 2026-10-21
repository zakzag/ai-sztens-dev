import type { ApiKey } from '@callback/shared';

/**
 * Constants of the `api-keys` use case.
 *
 * The query keys are declared **once** here: an inline array in a component or
 * a hook would silently break the cache invalidation after a successful create
 * (TanStack Query matches prefixes, so it only works while the literals agree).
 *
 * `all` is the prefix of every `api-keys` query, `list` is the concrete list
 * query — invalidating `all` therefore refreshes the list without knowing its
 * shape.
 */

/** Cache keys of the `api-keys` queries. */
export const API_KEYS_QUERY_KEYS = {
  /** Prefix shared by every `api-keys` query; use it for invalidation. */
  all: ['api-keys'] as const,
  /** `GET /api/api-keys`. */
  list: ['api-keys', 'list'] as const,
} as const;

/**
 * Field-level message for a duplicate identifier (409).
 *
 * Kept next to the query keys because the form and the logic helper must show
 * the exact same sentence.
 */
export const API_KEY_IDENTIFIER_CONFLICT_MESSAGE =
  'Ez az identifier már foglalt. Adj meg egyedit.';

/**
 * Stable “no data” list.
 *
 * Returned by the query hook instead of a fresh `[]`, so the table does not see
 * a new array identity on every render (which would defeat memoisation) — and
 * frozen, so a consumer cannot mutate cache-adjacent state by accident.
 */
export const EMPTY_API_KEY_LIST: readonly ApiKey[] = Object.freeze([]);
