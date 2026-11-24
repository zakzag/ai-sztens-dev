/**
 * Constants of the `customers` use case (AIS-19).
 *
 * The query keys are declared **once** here and derived from the resource
 * namespace by {@link createEntityQueryKeys}, so `list`/`detail` always start
 * with `all` and an invalidation can never stop matching because of a mistyped
 * literal (AIS-175).
 *
 * The page sizes are injected by the consumer of the pager, exactly as
 * `api-keys.const.ts` does: `packages/ui` must not import `@callback/shared`, so
 * the numbers are named here, where the contract is already known.
 */

import {
  LIST_QUERY_DEFAULT_LIMIT,
  LIST_QUERY_MAX_LIMIT,
  type Customer,
  type CustomerListQuery,
} from '@callback/shared';
import { createEntityQueryKeys } from '../api/create-entity-query-keys.js';

/**
 * Cache keys of the `customers` queries.
 *
 * `all` is the prefix every `customers` query shares; `list` is a factory
 * because the response depends on the query (page, sort, filters, search), and
 * `detail` is reserved for AIS-20 — it is declared by the factory, not by hand.
 */
export const CUSTOMERS_QUERY_KEYS = createEntityQueryKeys<CustomerListQuery>(
  'customers',
);

/**
 * Rows returned while there is no data yet (loading or failed).
 *
 * A frozen constant, not a fresh `[]`: `useApiList` requires a stable reference,
 * otherwise the table sees a new array identity on every render.
 */
export const EMPTY_CUSTOMER_LIST: readonly Customer[] = Object.freeze([]);

/** Page sizes the customers pager offers: default, a middle value, the maximum. */
export const CUSTOMERS_LIMIT_OPTIONS: readonly number[] = Object.freeze([
  LIST_QUERY_DEFAULT_LIMIT,
  50,
  LIST_QUERY_MAX_LIMIT,
]);

/**
 * Success message of the archive write.
 *
 * Lives here (and not in the page) because the mutation owns its own feedback:
 * the page only triggers the write, and the notification capture renders
 * `meta.successMessage` once.
 */
export const CUSTOMERS_ARCHIVE_SUCCESS_MESSAGE = 'A cég archiválva.';
