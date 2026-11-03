/**
 * Constants of the `api-keys` service.
 *
 * The paths are **derived** from the endpoint registry (`AIS-89`): each route is
 * written down once in `@callback/shared`, and `clientPathOf()` converts it to
 * the shape the transport expects. The base URL already contains the global
 * `/api` prefix, so the effective request is `/api/api-keys`.
 *
 * The transport convention (AIS-109) is that a list call reports which fields
 * are still at their default, so the URL only carries what the user changed —
 * which is why the defaults of the query are a constant of the *service*, next
 * to the path it belongs to.
 */

import {
  API_KEY_DEFAULT_SORT,
  LIST_QUERY_DEFAULTS,
  type ListQueryDefaults,
} from '@callback/shared';
import { clientPathOf } from '../endpoint-path.js';

/** Path of the collection endpoint, relative to the injected base URL. */
export const API_KEYS_PATH = clientPathOf('apiKeys.list');

/**
 * Path of the single-resource endpoint, still carrying `:identifier`.
 *
 * The placeholder is substituted by {@link toApiKeyDetailPath}; the transport
 * additionally refuses to send an unresolved placeholder.
 */
export const API_KEYS_DETAIL_PATH = clientPathOf('apiKeys.findByIdentifier');

/**
 * Values that count as “unchanged” in the `api-keys` list query.
 *
 * The resource default sort is layered onto the shared list defaults, so
 * `page`/`limit`/`order` keep the contract-wide values while `sort` reflects the
 * column the resource actually sorts by.
 */
export const API_KEY_LIST_QUERY_DEFAULTS: ListQueryDefaults = {
  ...LIST_QUERY_DEFAULTS,
  sort: API_KEY_DEFAULT_SORT,
};
