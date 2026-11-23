/**
 * Server-side view types of the customer audit-log read (AIS-178, slice f).
 *
 * The wire type lives in `@callback/shared` (`AuditLog`); what is declared here is
 * what the **repository** returns and what the **service** hands to the
 * controller.
 */

import type { AuditLog, PaginationMeta } from '@callback/shared';
import type { AuditLogRow } from '../db/schema.js';

/** One page of ledger rows plus the size of the whole result set. */
export interface AuditLogPage {
  /** The ledger rows of the requested page, in the requested order. */
  readonly rows: readonly AuditLogRow[];

  /** Matching rows across all pages. */
  readonly total: number;
}

/** The service's answer to the controller: payload rows plus the pager. */
export interface PaginatedAuditLogs {
  /** The **mapped** ledger rows of the page, ready for the envelope. */
  readonly items: readonly AuditLog[];

  /** Paging block built by the shared `toPaginationMeta`. */
  readonly pagination: PaginationMeta;
}
