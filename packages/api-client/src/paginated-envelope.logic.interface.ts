/**
 * Shapes of the pure paginated unwrap (AIS-109).
 *
 * The failure branch is the **same** type the single-resource unwrap uses, so a
 * caller can handle a drift from either endpoint without knowing which verb it
 * came from.
 */

import type { ApiResult } from '@callback/shared';
import type { EnvelopeUnwrapFailure } from './envelope.logic.interface.js';

/** The body was a valid paginated envelope: rows plus a guaranteed pager block. */
export type PaginatedUnwrapSuccess<TRows> = ApiResult<TRows> & {
  readonly ok: true;
};

/** Either the paginated result or the reasons it could not be produced. */
export type PaginatedUnwrapResult<TRows> =
  PaginatedUnwrapSuccess<TRows> | EnvelopeUnwrapFailure;
