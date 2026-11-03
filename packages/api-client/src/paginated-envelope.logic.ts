/**
 * Pure decoding of a paginated list response (AIS-109).
 *
 * A separate entry point from {@link unwrapEnvelope}, because a list body is not
 * “an envelope around a payload” the way a detail body is: it has to carry
 * `meta.pagination`, and the client's contract is the shared `ApiResult`. Wrapping
 * the single-resource unwrap would validate the body twice and still not produce
 * the pager block.
 *
 * There is no `try`/`catch` here: the missing-pagination rule lives in
 * `paginatedSchema` as a **required field**, so a violation arrives as an ordinary
 * zod issue whose path is `meta.pagination` — mappable onto the pager, and never
 * dependent on the text of an error message.
 */

import { type z } from 'zod';
import { paginatedSchema } from '@callback/shared';
import type { PaginatedUnwrapResult } from './paginated-envelope.logic.interface.js';
import { toIssueDetails } from './envelope.logic.js';

/**
 * Unwraps a paginated success body and validates its rows.
 *
 * @param rowsSchema - schema of the **row array** (input equals output, which is
 *   what `paginatedSchema` requires).
 * @param body - untrusted body of a 2xx response, or `null` when it was empty or
 *   not JSON.
 * @returns `{ ok: true, data, meta }` on success, `{ ok: false, issues, cause }`
 *   on envelope, pagination or row drift.
 */
export function unwrapPaginatedEnvelope<TRows>(
  rowsSchema: z.ZodType<TRows, z.ZodTypeDef, TRows>,
  body: unknown,
): PaginatedUnwrapResult<TRows> {
  const parsed = paginatedSchema(rowsSchema).safeParse(body);

  if (!parsed.success) {
    return {
      ok: false,
      issues: toIssueDetails(parsed.error),
      cause: parsed.error,
    };
  }

  return { ok: true, data: parsed.data.data, meta: parsed.data.meta };
}
