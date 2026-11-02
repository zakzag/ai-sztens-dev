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

/**
 * The column subset a `PATCH` may write (AIS-108, plan `D5`).
 *
 * Two things are deliberately **absent**, and both are type-level guarantees
 * rather than review notes:
 *
 * - `identifier` — the identifier *is* the address; renaming it is a delete +
 *   create, so it is not patchable;
 * - timestamps (`updatedAt`, `createdAt`, `deletedAt`) — `updatedAt` is
 *   maintained by the database (`$onUpdate`), and the client's copy is only
 *   ever compared against it, never written.
 *
 * Every field is optional in the `undefined` sense: an absent key means “leave
 * the column untouched”, while an explicit `null` clears it. The mapper is the
 * only place that builds this shape, so those two cases cannot be confused.
 */
export interface ApiKeyPatch {
  /** New display name, when the request changes it. */
  readonly name?: string;

  /** New description; `null` clears it. */
  readonly description?: string | null;

  /** New token value, when the request rotates it. */
  readonly apiKey?: string;

  /** New expiry; `null` clears it. */
  readonly expiresAt?: Date | null;
}
