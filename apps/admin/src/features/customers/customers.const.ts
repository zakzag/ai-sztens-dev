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
  API_ERROR_CODE,
  LIST_QUERY_DEFAULT_LIMIT,
  LIST_QUERY_MAX_LIMIT,
  type Customer,
  type CustomerListQuery,
} from '@callback/shared';
import { createEntityQueryKeys } from '../api/create-entity-query-keys.js';
import type { CustomerUpdateFieldName } from './customers.interface.js';

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

/**
 * Success copy of the field update (AIS-21).
 *
 * Handed to `useAppForm`'s notify port — **not** to the mutation's `meta`: a page
 * never sets `meta.successMessage` (`New-Admin-Page.md` step 15 / AIS-136), the
 * form's port owns the announcement, and the two must not both speak.
 */
export const CUSTOMERS_UPDATE_SUCCESS_MESSAGE = 'A cég adatai mentve.';

/** Success copy of the dedicated status change (AIS-21). */
export const CUSTOMERS_STATUS_SUCCESS_MESSAGE = 'A cég státusza módosítva.';

/**
 * Every input the **edit** form owns, in visual order (AIS-21).
 *
 * The order is the contract of the focus behaviour: server errors are applied in
 * this order and only the first one takes focus (AIS-111 `D3`), so a component
 * cannot change the outcome by reordering its markup.
 *
 * The read-only-by-contract fields (`customerNumber`, `status`, `createdAt`,
 * `updatedAt`, `hasMissingData`) are absent — the request schema is `.strict()`
 * and rejects them, so they can never be an error target.
 */
export const CUSTOMER_UPDATE_FIELD_PATHS: readonly CustomerUpdateFieldName[] =
  Object.freeze([
    'type',
    'legalName',
    'shortName',
    'taxNumber',
    'euVatNumber',
    'companyRegistrationNumber',
    'legalForm',
    'registeredAddressZip',
    'registeredAddressCity',
    'registeredAddressLine',
    'registeredAddressCountry',
    'industry',
    'headcountRange',
    'source',
  ]);

/**
 * Path a code blames when the response carried no `details[]` (AIS-21).
 *
 * Only the duplicate tax number has an input to blame. `STALE_WRITE` is not
 * listed: the path it would blame (`updatedAt`) is rendered nowhere, which is
 * exactly why the form answers it with a page-level notice instead of a field
 * message.
 */
export const CUSTOMER_UPDATE_DEFAULT_PATH_BY_CODE: Readonly<
  Record<string, CustomerUpdateFieldName>
> = Object.freeze({
  [API_ERROR_CODE.CUSTOMER_TAX_NUMBER_CONFLICT]: 'taxNumber',
});
