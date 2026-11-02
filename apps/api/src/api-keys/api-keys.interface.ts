/**
 * Server-side view types of the `api-keys` feature (AIS-107).
 *
 * The wire contract lives in `@callback/shared` (`ApiKey`); what is declared
 * here is the shape the **service** hands to the controller: the mapped rows
 * plus the paging block, so the controller never has to do arithmetic and never
 * has to reach into the repository result.
 */

import type { ApiKey, PaginationMeta } from '@callback/shared';

/** One page of API keys, ready to be wrapped in the success envelope. */
export interface PaginatedApiKeys {
  /** The rows of the requested page, mapped to the wire contract. */
  readonly items: readonly ApiKey[];

  /** The `meta.pagination` block of the response. */
  readonly pagination: PaginationMeta;
}
