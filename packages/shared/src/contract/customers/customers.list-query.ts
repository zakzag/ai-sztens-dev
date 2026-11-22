/**
 * List-query contract of the `customers` resource (AIS-16).
 *
 * The generic paging fields (`page`, `limit`, `order`, `q`) come from
 * `../list-query.schema.ts` **unchanged**; this file adds what is specific to
 * customers: the sortable-column allow-list and the four filters the list screen
 * needs (type, status, source, responsible operator).
 *
 * Why `listQuerySchema.extend()` and not `createListQuerySchema()`: the factory
 * returns a `ZodType` (it exists to carry the literal `sort` union through a
 * generic), and a `ZodType` cannot be extended with the extra filters. Extending
 * the base object here keeps the same shared fields — the one thing that must
 * not be duplicated — while the `sort` enum still narrows to
 * {@link CustomerSortField} because it is declared inline.
 *
 * The filters are **optional and independent**: an absent filter means “no
 * filter”, never “match null”. A filter for “no responsible operator” would need
 * a distinct parameter name; adding one later is additive.
 */

import type { ApiQueryParameterContract } from '../endpoint.interface.js';
import {
  LIST_QUERY_LIMIT_PARAMETER,
  LIST_QUERY_ORDER_PARAMETER,
  LIST_QUERY_PAGE_PARAMETER,
  LIST_QUERY_SEARCH_PARAMETER,
} from '../list-query.parameters.js';
import { listQuerySchema } from '../list-query.schema.js';
import { z } from 'zod';
import {
  CUSTOMER_DEFAULT_SORT,
  CUSTOMER_SORT_FIELDS,
} from './customers.const.js';
import {
  CUSTOMER_SOURCE_VALUES,
  CUSTOMER_STATUS_VALUES,
  CUSTOMER_TYPE_VALUES,
  customerSourceSchema,
  customerStatusSchema,
  customerTypeSchema,
} from './customers.enums.js';

/**
 * The validated query of `GET /api/admin/customers`.
 *
 * `ZodQueryPipe` parses the raw query string with this schema, which is why
 * `page`/`limit` arrive as numbers and `sort`/`order` already carry their
 * defaults when the controller sees them.
 */
export const customerListQuerySchema = listQuerySchema.extend({
  sort: z.enum(CUSTOMER_SORT_FIELDS).default(CUSTOMER_DEFAULT_SORT),
  type: customerTypeSchema.optional(),
  status: customerStatusSchema.optional(),
  source: customerSourceSchema.optional(),
  responsibleOperatorId: z.string().uuid().optional(),
});

/** The validated query of `GET /api/admin/customers`, as the controller sees it. */
export type CustomerListQuery = z.infer<typeof customerListQuerySchema>;

/** The `sort` query parameter of the `customers` list. */
export const CUSTOMER_SORT_PARAMETER: ApiQueryParameterContract = {
  name: 'sort',
  description: `Sortable column: ${CUSTOMER_SORT_FIELDS.join(', ')}.`,
  required: false,
  schema: {
    type: 'string',
    enum: [...CUSTOMER_SORT_FIELDS],
    default: CUSTOMER_DEFAULT_SORT,
  },
};

/** The `type` query parameter. */
export const CUSTOMER_TYPE_PARAMETER: ApiQueryParameterContract = {
  name: 'type',
  description: 'Filter by customer type; omit for every type.',
  required: false,
  schema: { type: 'string', enum: [...CUSTOMER_TYPE_VALUES] },
};

/** The `status` query parameter. */
export const CUSTOMER_STATUS_PARAMETER: ApiQueryParameterContract = {
  name: 'status',
  description: 'Filter by lifecycle status; omit for every status.',
  required: false,
  schema: { type: 'string', enum: [...CUSTOMER_STATUS_VALUES] },
};

/** The `source` query parameter. */
export const CUSTOMER_SOURCE_PARAMETER: ApiQueryParameterContract = {
  name: 'source',
  description: 'Filter by acquisition channel; omit for every channel.',
  required: false,
  schema: { type: 'string', enum: [...CUSTOMER_SOURCE_VALUES] },
};

/** The `responsibleOperatorId` query parameter. */
export const CUSTOMER_RESPONSIBLE_OPERATOR_PARAMETER: ApiQueryParameterContract = {
  name: 'responsibleOperatorId',
  description: 'Filter by the responsible operator id; omit for every operator.',
  required: false,
  schema: { type: 'string', format: 'uuid' },
};

/**
 * Every query parameter of `GET /api/admin/customers`, in publication order.
 *
 * `sort` sits between `limit` and `order` (how a reader thinks about a paged,
 * sorted list); the four filters follow the free-text search because they
 * narrow it.
 */
export const CUSTOMER_LIST_QUERY_PARAMETERS: readonly ApiQueryParameterContract[] =
  [
    LIST_QUERY_PAGE_PARAMETER,
    LIST_QUERY_LIMIT_PARAMETER,
    CUSTOMER_SORT_PARAMETER,
    LIST_QUERY_ORDER_PARAMETER,
    LIST_QUERY_SEARCH_PARAMETER,
    CUSTOMER_TYPE_PARAMETER,
    CUSTOMER_STATUS_PARAMETER,
    CUSTOMER_SOURCE_PARAMETER,
    CUSTOMER_RESPONSIBLE_OPERATOR_PARAMETER,
  ];
