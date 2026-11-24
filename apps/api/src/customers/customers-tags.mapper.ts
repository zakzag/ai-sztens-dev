/**
 * Pure mapping of the customer-tag aggregate (AIS-178, slice e).
 *
 * Row → wire payload, a name → an insert payload, and the two records the audit
 * diff compares. No I/O, no Nest, no Drizzle query building, so every branch is
 * trivial to unit test.
 *
 * The output type comes from `@callback/shared` (`CustomerTag`), so this module
 * can only ever *produce* the contract shape, never a second copy of it.
 */

import type { CustomerTag } from '@callback/shared';
import type { NewTagRow, TagRow } from '../db/schema.js';

/**
 * Maps a tag row to the wire payload.
 *
 * @param row - the catalogue row as read or as written.
 * @returns the `CustomerTag` payload.
 */
export function toCustomerTag(row: TagRow): CustomerTag {
  return {
    id: row.id,
    name: row.name,
    isActive: row.isActive,
  };
}

/**
 * Maps a validated label name to an insert payload.
 *
 * `isActive` is not request data: a label an operator just created is active by
 * definition, and deactivating it is a catalogue decision that has no endpoint
 * yet (AIS-178/e `E2`, the catalogue read is deferred as well).
 *
 * @param name - the validated, trimmed name.
 * @returns insert payload for `customer.tags`.
 */
export function toNewTagRow(name: string): NewTagRow {
  return { name, isActive: true };
}

/**
 * Flattens a tag row into the payload the audit diff compares.
 *
 * @param row - the row as read or as written.
 * @returns a plain record of the business columns.
 */
export function toTagAuditPayload(
  row: TagRow,
): Readonly<Record<string, unknown>> {
  return {
    id: row.id,
    name: row.name,
    isActive: row.isActive,
  };
}

/**
 * Describes one `customer_tags` link for the ledger.
 *
 * The table has a **composite** primary key and therefore no uuid identity, so
 * the audit row carries `record_id = null` and the pair in `before`/`after` —
 * exactly the case `audit_logs.record_id` is nullable for (AIS-177).
 *
 * @param customerId - the customer holding the link.
 * @param tagId - the attached label.
 * @returns a plain record of the link pair.
 */
export function toLinkAuditPayload(
  customerId: string,
  tagId: string,
): Readonly<Record<string, unknown>> {
  return { customerId, tagId };
}
