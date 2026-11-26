/**
 * The client-side view of a paginated response (AIS-106).
 *
 * The wire format is the success envelope: `{ data, meta }`, where `meta`
 * carries `requestId`, `timestamp` and — on a paginated list — `pagination`.
 * The server leaves `data` a plain array, so nothing about the response shape
 * changes (plan `D1`).
 *
 * What changes is the **client's** view: `ApiResult<TRows>` pairs the rows with
 * the pagination block, so a caller gets `total` and `totalPages` without
 * digging through the envelope and without a type assertion.
 */

import type { PaginationMeta, ResponseMeta } from './envelope.interface.js';

/**
 * A paginated response, seen from the client.
 *
 * `data` is never `null` here (a paginated list always has an array, even an
 * empty one) and `meta.pagination` is always present — a response without it
 * is a contract violation and fails the parse.
 *
 * @typeParam TRows - the row array of the current page.
 */
export interface ApiResult<TRows> {
  /** The rows of the current page. */
  readonly data: TRows;

  /** The response metadata, with the pagination block guaranteed to be there. */
  readonly meta: ResponseMeta & { readonly pagination: PaginationMeta };
}
