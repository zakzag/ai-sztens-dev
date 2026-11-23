/**
 * Server-side view types of the customer-tags feature (AIS-178, slice e).
 *
 * The wire contract lives in `@callback/shared` (`CustomerTag`); what is declared
 * here is what the **repository** returns and what the **service** hands to the
 * controller. Nothing here is a second copy of a contract type.
 */

import type { TagRow } from '../db/schema.js';

/**
 * The outcome of one create-or-attach step.
 *
 * Two independent facts, which is why it is an object and not the row alone: the
 * label may be **reused** while the link is **new** (the usual case), both may be
 * new, or the link may already exist (the idempotent repeat). The service audits
 * exactly the facts that are `true`.
 */
export interface TagAttachment {
  /** The catalogue row, as stored (freshly inserted or reused). */
  readonly tag: TagRow;

  /** `true` when this call created the `customer_tags` link. */
  readonly linked: boolean;
}
