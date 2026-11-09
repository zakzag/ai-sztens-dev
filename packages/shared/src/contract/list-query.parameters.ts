/**
 * OpenAPI descriptors of the list-query fields (AIS-107).
 *
 * Why descriptors and not the zod schema: the documented parameters must show
 * the **same** bounds and defaults the `ZodQueryPipe` enforces, but they cannot
 * be generated from `listQuerySchema` — the `q` field ends in a `transform`
 * (`ZodEffects`), which the OpenAPI generator cannot render as a parameter.
 *
 * So the numbers and enumerations are **not** repeated here: every descriptor
 * below is built from the very constants the validation schema is built from.
 * Change `LIST_QUERY_MAX_LIMIT` and both the `400` and the published document
 * move together.
 */

import type { ApiQueryParameterContract } from './endpoint.interface.js';
import {
  LIST_QUERY_DEFAULT_LIMIT,
  LIST_QUERY_DEFAULT_ORDER,
  LIST_QUERY_DEFAULT_PAGE,
  LIST_QUERY_MAX_LIMIT,
  LIST_QUERY_MAX_SEARCH_LENGTH,
  LIST_QUERY_ORDER_VALUES,
} from './list-query.schema.js';

/** The `page` query parameter. */
export const LIST_QUERY_PAGE_PARAMETER: ApiQueryParameterContract = {
  name: 'page',
  description: 'Page number, 1-based.',
  required: false,
  schema: {
    type: 'integer',
    minimum: LIST_QUERY_DEFAULT_PAGE,
    default: LIST_QUERY_DEFAULT_PAGE,
  },
};

/** The `limit` query parameter. */
export const LIST_QUERY_LIMIT_PARAMETER: ApiQueryParameterContract = {
  name: 'limit',
  description: `Page size, 1…${LIST_QUERY_MAX_LIMIT}.`,
  required: false,
  schema: {
    type: 'integer',
    minimum: 1,
    maximum: LIST_QUERY_MAX_LIMIT,
    default: LIST_QUERY_DEFAULT_LIMIT,
  },
};

/** The `order` query parameter. */
export const LIST_QUERY_ORDER_PARAMETER: ApiQueryParameterContract = {
  name: 'order',
  description: 'Sort direction.',
  required: false,
  schema: {
    type: 'string',
    enum: [...LIST_QUERY_ORDER_VALUES],
    default: LIST_QUERY_DEFAULT_ORDER,
  },
};

/** The `q` query parameter. */
export const LIST_QUERY_SEARCH_PARAMETER: ApiQueryParameterContract = {
  name: 'q',
  description:
    'Free-text filter. Trimmed; an empty value means *no filter* and is never sent.',
  required: false,
  schema: { type: 'string', maxLength: LIST_QUERY_MAX_SEARCH_LENGTH },
};

/**
 * Every list-query parameter **except** `sort`.
 *
 * `sort` is resource-specific, so a resource appends its own descriptor to this
 * list instead of redefining the four shared ones.
 */
export const LIST_QUERY_PARAMETERS: readonly ApiQueryParameterContract[] = [
  LIST_QUERY_PAGE_PARAMETER,
  LIST_QUERY_LIMIT_PARAMETER,
  LIST_QUERY_ORDER_PARAMETER,
  LIST_QUERY_SEARCH_PARAMETER,
];
