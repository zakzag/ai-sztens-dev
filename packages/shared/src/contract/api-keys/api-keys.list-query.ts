/**
 * List-query contract of the `api-keys` resource (AIS-107).
 *
 * The generic list query lives in `../list-query.schema.ts`; this file adds what
 * is *resource-specific*: the **sortable columns**. They are an allow-list, so an
 * unknown `sort` value is a `400` with the permitted set in the message instead
 * of a Postgres error surfacing as a `500`.
 *
 * A separate file on purpose: `api-keys.schema.ts` is also touched by AIS-75
 * (the write-only `apiKey` change), and two tickets editing one file would
 * collide for no benefit.
 */

import type { ApiQueryParameterContract } from '../endpoint.interface.js';
import {
  LIST_QUERY_LIMIT_PARAMETER,
  LIST_QUERY_ORDER_PARAMETER,
  LIST_QUERY_PAGE_PARAMETER,
  LIST_QUERY_SEARCH_PARAMETER,
} from '../list-query.parameters.js';
import {
  createListQuerySchema,
  type ListQuery,
} from '../list-query.schema.js';

/**
 * The columns `GET /api/api-keys` can be sorted by.
 *
 * Deliberately a closed tuple: it feeds both the zod enum (validation) and the
 * OpenAPI enum (documentation), and the server's column map is typed against
 * it, so a column cannot be documented without being sortable.
 */
export const API_KEY_SORT_FIELDS = [
  'name',
  'identifier',
  'createdAt',
  'updatedAt',
  'expiresAt',
] as const;

/** One sortable column of the `api-keys` list. */
export type ApiKeySortField = (typeof API_KEY_SORT_FIELDS)[number];

/** The column the list is sorted by when the request does not say. */
export const API_KEY_DEFAULT_SORT: ApiKeySortField = 'createdAt';

/**
 * The validated query of `GET /api/api-keys`.
 *
 * `ZodQueryPipe` parses the raw query string with this schema, which is why
 * `page`/`limit` are coerced numbers and `sort`/`order` already carry their
 * defaults when the controller receives them.
 */
export const apiKeyListQuerySchema = createListQuerySchema(
  API_KEY_SORT_FIELDS,
  API_KEY_DEFAULT_SORT,
);

/** The validated query of `GET /api/api-keys`, as the controller sees it. */
export type ApiKeyListQuery = ListQuery & { readonly sort: ApiKeySortField };

/** The `sort` query parameter of the `api-keys` list. */
export const API_KEY_SORT_PARAMETER: ApiQueryParameterContract = {
  name: 'sort',
  description: `Sortable column: ${API_KEY_SORT_FIELDS.join(', ')}.`,
  required: false,
  schema: {
    type: 'string',
    enum: [...API_KEY_SORT_FIELDS],
    default: API_KEY_DEFAULT_SORT,
  },
};

/**
 * Every query parameter of `GET /api/api-keys`, in publication order.
 *
 * `sort` sits between `limit` and `order` because that is how a reader thinks
 * about a paged, sorted list.
 */
export const API_KEY_LIST_QUERY_PARAMETERS: readonly ApiQueryParameterContract[] =
  [
    LIST_QUERY_PAGE_PARAMETER,
    LIST_QUERY_LIMIT_PARAMETER,
    API_KEY_SORT_PARAMETER,
    LIST_QUERY_ORDER_PARAMETER,
    LIST_QUERY_SEARCH_PARAMETER,
  ];
