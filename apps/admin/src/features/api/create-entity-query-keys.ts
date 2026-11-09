/**
 * The one query-key factory of the admin app (AIS-175).
 *
 * ## Why a factory and not a hand-written object
 *
 * Every use case used to declare its cache keys by typing the namespace literal
 * once per key:
 *
 * ```ts
 * export const X_QUERY_KEYS = {
 *   all: ['x'] as const,
 *   list: (params) => ['x', 'list', { ...params }] as const,
 *   detail: (identifier) => ['x', 'detail', identifier] as const,
 * };
 * ```
 *
 * TanStack Query matches `invalidateQueries` **by prefix**, so a typo in `all`
 * turns every write's invalidation into a no-op: the list keeps serving the page
 * it had before the write, and nothing throws, so no test notices. A typo in
 * `list` or `detail` splits the cache in two, and one screen stops seeing what
 * the other read.
 *
 * Deriving all three keys from a single `namespace` parameter removes the
 * possibility rather than documenting it. The prefix relationship — every
 * `list`/`detail` key starts with `all` — is therefore true by construction and
 * is asserted by the unit tests, not assumed.
 *
 * ## What stays with the use case
 *
 * The namespace (it mirrors the API resource, e.g. `'api-keys'`) and the shape of
 * the list params (the resource's validated list query). The factory knows
 * neither, so it adds no domain knowledge to the shared layer.
 */

import type { EntityQueryKeys } from './create-entity-query-keys.interface.js';
import {
  ENTITY_QUERY_DETAIL_SEGMENT,
  ENTITY_QUERY_LIST_SEGMENT,
} from './create-entity-query-keys.const.js';

/**
 * Builds the cache keys of one entity.
 *
 * @param namespace - the entity's cache namespace, matching its API resource
 *   (kebab-case, plural, e.g. `'api-keys'`). It is stored **once**: `all`,
 *   `list` and `detail` are all derived from it, which is what makes
 *   invalidation-by-prefix reliable.
 * @returns the three keys of {@link EntityQueryKeys}; `all` for invalidation,
 *   `list`/`detail` for reading.
 * @typeParam TListParams - the validated list query; it becomes part of the key,
 *   so a page/sort/filter change produces a new cache entry.
 *
 * @example
 * ```ts
 * export const API_KEYS_QUERY_KEYS =
 *   createEntityQueryKeys<ApiKeyListQuery>('api-keys');
 * ```
 */
export function createEntityQueryKeys<TListParams extends object>(
  namespace: string,
): EntityQueryKeys<TListParams> {
  return {
    all: [namespace] as const,

    /*
      The params are copied, not referenced: the caller's object is the URL-derived
      query and may be replaced in place by a future setter, which would otherwise
      mutate the key of an existing cache entry.

      The copy is annotated instead of inferred so the returned tuple keeps the
      `TListParams` type rather than a widened object literal.
    */
    list: (params: TListParams) => {
      const keyParams: TListParams = { ...params };

      return [namespace, ENTITY_QUERY_LIST_SEGMENT, keyParams] as const;
    },

    detail: (identifier: string) =>
      [namespace, ENTITY_QUERY_DETAIL_SEGMENT, identifier] as const,
  };
}
