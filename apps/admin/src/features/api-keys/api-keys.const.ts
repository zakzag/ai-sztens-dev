import { API_ERROR_CODE } from '@callback/shared';
import type { ApiKey } from '@callback/shared';
import { FIELD_SURFACE_CODES } from '../../lib/error-surface.const.js';
import type { ApiKeyFormFieldName } from './api-keys.interface.js';

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
 * The only error codes allowed to produce field errors (plan `D1`).
 *
 * Everything else — a `409` from a proxy, a `500`, a forged `CONFLICT` with
 * suspicious paths — stays page-level, because a field error claims “this
 * specific input is wrong”, which only these two codes can honestly say.
 *
 * Re-exported from [`error-surface.const.ts`](../../lib/error-surface.const.ts):
 * `toErrorSurface` classifies the same codes into the `field` tier, so the list
 * has exactly one definition and the two decisions cannot drift apart.
 */
export const FIELD_ERROR_CODES: readonly string[] = FIELD_SURFACE_CODES;

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
