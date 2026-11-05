/**
 * Persistence contract of the `api-keys` feature.
 *
 * The service depends on this interface only (plan D2), which is what makes the
 * service spec a plain object mock — no Nest, no Drizzle, no socket. The
 * implementation owns the SQL; this file owns the *promises* the SQL makes.
 *
 * Contract for implementers:
 * - return rows / `null`, never HTTP concepts — no `@nestjs/common` import here
 *   or in the implementation (plan D3);
 * - a duplicate `identifier` is reported as `ApiKeyIdentifierConflictError`,
 *   every other failure is propagated unchanged so the original stack survives.
 */

import type { ApiKeyListQuery } from '@callback/shared';
import type { ApiKeyRow, NewApiKeyRow } from '../db/schema.js';
import type { ApiKeyPatch } from './api-keys.interface.js';

/**
 * One page of stored keys plus the size of the whole result set.
 *
 * `total` is counted with a second query over the **same** filter, so the
 * client's pager can compute `totalPages` without walking the table itself.
 */
export interface ApiKeyPage {
  /** The rows of the requested page (empty when the page is past the end). */
  readonly rows: readonly ApiKeyRow[];

  /** Matching rows across all pages. */
  readonly total: number;
}

export interface ApiKeysRepository {
  /**
   * Inserts one row and returns it as stored (server defaults included).
   *
   * @param input - insert payload, already normalised by the mapper.
   * @returns the persisted row.
   * @throws {ApiKeyIdentifierConflictError} when `identifier` already exists.
   * @throws {ApiKeyRowMissingError} when `INSERT … RETURNING` yields no row.
   */
  create(input: NewApiKeyRow): Promise<ApiKeyRow>;

  /**
   * Returns one page of rows plus the total count (AIS-107).
   *
   * The order is **always** deterministic: the requested column first, then
   * `id` as the tie-breaker. Without the tie-breaker two rows sharing a
   * timestamp could swap places between two requests and a page boundary would
   * silently skip or repeat a row.
   *
   * `query.q` is a case-insensitive substring filter over `name` and
   * `identifier` — it is **applied**, not ignored: the contract accepts the
   * field, so a silently unfiltered list would be a lie the client cannot see.
   *
   * @param query - the validated list query (paging, sort, filter).
   * @returns the page and the total number of matching rows.
   */
  findPage(query: ApiKeyListQuery): Promise<ApiKeyPage>;

  /**
   * Looks a **live** row up by its unique `identifier` (AIS-108).
   *
   * “Live” is part of the contract, not an implementation detail: a
   * soft-deleted row must answer `null` here, so the service's “not found”
   * answer and the repository's answer agree without the service re-checking
   * `deletedAt`.
   *
   * @param identifier - search key; blank/whitespace input must short-circuit
   *   to `null` **without** a query (plan D5).
   * @returns the matching live row, or `null` when there is none (or it was
   *   deleted).
   */
  findByIdentifier(identifier: string): Promise<ApiKeyRow | null>;

  /**
   * Writes the given columns, but only if the stored version still matches
   * (AIS-108, plan `D5`).
   *
   * One atomic statement — `WHERE identifier = … AND deleted_at IS NULL AND
   * updated_at = expected` — so there is no window between a read and the
   * write in which another writer could slip in. A read-compare-write in the
   * service would reintroduce exactly the lost update this method exists to
   * prevent.
   *
   * @param identifier - the row to update (the address, never patched).
   * @param patch - the columns to write; absent keys are **left untouched**.
   *   `updatedAt` is never part of it: the column is owned by `$onUpdate`.
   * @param expectedUpdatedAt - the version the client last saw; compared, never
   *   written.
   * @returns the updated row, or `null` when nothing matched (absent, deleted
   *   or a different version — the caller classifies which).
   */
  updateByIdentifier(
    identifier: string,
    patch: ApiKeyPatch,
    expectedUpdatedAt: Date,
  ): Promise<ApiKeyRow | null>;

  /**
   * Marks a live row as deleted and returns it (AIS-108).
   *
   * @param identifier - the row to hide.
   * @param deletedAt - deletion timestamp, injected so the caller (and tests)
   *   own the clock.
   * @returns the row as stored after the write, or `null` when no live row
   *   matched (absent, or already deleted — both are a `404` for the caller).
   */
  softDeleteByIdentifier(
    identifier: string,
    deletedAt: Date,
  ): Promise<ApiKeyRow | null>;

  /**
   * Looks a row up by identifier **including deleted ones** (AIS-108).
   *
   * Exists only for the classification of a failed
   * {@link updateByIdentifier}: the update returns `null` for three different
   * situations (absent, deleted, stale), and the caller needs one extra read to
   * tell them apart and answer `404` or `409 STALE_WRITE` accordingly.
   *
   * @param identifier - search key.
   * @returns the row whichever state it is in, or `null` when it never existed.
   */
  findAnyByIdentifier(identifier: string): Promise<ApiKeyRow | null>;
}
