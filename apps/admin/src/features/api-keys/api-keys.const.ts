import {
  API_ERROR_CODE,
  type ApiKey,
  type ApiKeyListQuery,
} from '@callback/shared';
import type { ApiKeyFormFieldName } from './api-keys.interface.js';

/**
 * Constants of the `api-keys` use case.
 *
 * The query keys are declared **once** here: an inline array in a component or
 * a hook would silently break the cache invalidation after a successful create
 * (TanStack Query matches prefixes, so it only works while the literals agree).
 *
 * `all` is the prefix of every `api-keys` query, `list` and `detail` are the
 * concrete queries — invalidating `all` therefore refreshes both without knowing
 * their shape. `list` is a **factory**, because the list response depends on the
 * query (page, sort, filter): a key that ignored those would serve page 1 for
 * page 2.
 */

/** Cache keys of the `api-keys` queries. */
export const API_KEYS_QUERY_KEYS = {
  /** Prefix shared by every `api-keys` query; use it for invalidation. */
  all: ['api-keys'] as const,
  /** `GET /api/api-keys?page=…&sort=…` — one key per distinct query. */
  list: (params: ApiKeyListQuery) =>
    ['api-keys', 'list', { ...params }] as const,
  /** `GET /api/api-keys/:identifier`. */
  detail: (identifier: string) => ['api-keys', 'detail', identifier] as const,
} as const;

/**
 * Field-level message for a duplicate identifier (409).
 *
 * Re-exported from [`error-message.const.ts`](../../lib/error-message.const.ts)
 * because all Hungarian UI copy lives in that one file (plan `D4`); the name is
 * kept so existing callers do not have to change.
 */
export { API_KEY_IDENTIFIER_FIELD_MESSAGE as API_KEY_IDENTIFIER_CONFLICT_MESSAGE } from '../../lib/error-message.const.js';

/**
 * Every input the create form owns, i.e. every `path` a server `details[]`
 * entry can legally address.
 *
 * The order is the visual order of the fields, so a form-level focus can rely
 * on it.
 */
export const API_KEY_FIELD_PATHS: readonly ApiKeyFormFieldName[] =
  Object.freeze(['name', 'identifier', 'description', 'apiKey', 'expiresAt']);

/**
 * Path a code blames when the server sent no `details[]` (plan `D2`).
 *
 * A duplicate identifier is about one input by definition, so it keeps landing
 * on that input even against an older server. `VALIDATION_FAILED` has no default:
 * without a path there is nothing to highlight.
 */
export const DEFAULT_FIELD_PATH_BY_CODE: Readonly<
  Record<string, ApiKeyFormFieldName>
> = Object.freeze({
  [API_ERROR_CODE.API_KEY_IDENTIFIER_CONFLICT]: 'identifier',
});

/**
 * Stable “no data” list.
 *
 * Returned by the query hook instead of a fresh `[]`, so the table does not see
 * a new array identity on every render (which would defeat memoisation) — and
 * frozen, so a consumer cannot mutate cache-adjacent state by accident.
 */
export const EMPTY_API_KEY_LIST: readonly ApiKey[] = Object.freeze([]);
