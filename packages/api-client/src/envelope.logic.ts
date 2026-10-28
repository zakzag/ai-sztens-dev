/**
 * Pure decoding of a successful response body — the single unwrap point of the
 * client (plan `D12`).
 *
 * There is no `Response`, no `fetch`, no clock and no env read here: the
 * transport feeds it an already-parsed body, which makes every contract-drift
 * case testable without a transport double.
 *
 * Two parses, on purpose:
 *
 * 1. the **envelope** (`successEnvelopeSchema`) proves the body is
 *    `{ data, meta }` — a bare payload or a missing key is a drift, not a
 *    success, because a caller must never receive `undefined`;
 * 2. the **payload** is re-validated with the caller's bare schema, so a
 *    `data: null` is only accepted where the caller expects it (a delete),
 *    never where a resource is required.
 */

import { type z } from 'zod';
import { successEnvelopeSchema } from '@callback/shared';
import type { ApiErrorDetail } from '@callback/shared';
import type { EnvelopeUnwrapResult } from './envelope.logic.interface.js';

/** Key the envelope wraps the payload in; wrapped zod paths start with it. */
const ENVELOPE_DATA_KEY = 'data';

/**
 * Renders a zod issue path as a payload-relative dot path.
 *
 * The envelope schema validates the caller's schema *inside* `data`, so zod
 * reports `['data', 'identifier']`. Dropping that first segment yields the path
 * the UI can map onto a form field; a payload-level issue (wrong type, `null`
 * where an object is required) becomes the empty path, i.e. “the whole body”.
 *
 * @param path - `issue.path` of a zod issue.
 * @returns dot-joined path without the envelope wrapper, `''` for the payload itself.
 */
export function toPayloadRelativePath(
  path: readonly (string | number)[],
): string {
  const [first, ...rest] = path;
  const segments = first === ENVELOPE_DATA_KEY ? rest : path;
  return segments.map((segment) => String(segment)).join('.');
}

/**
 * Maps a zod error onto the contract's field-issue shape.
 *
 * `details: string[]` is the rendered projection of exactly this list, so the
 * two can never disagree.
 *
 * @param error - the zod error of either parse.
 * @returns one `{ path, message }` entry per issue, in zod order.
 */
export function toIssueDetails(error: z.ZodError): readonly ApiErrorDetail[] {
  return error.issues.map((issue) => ({
    path: toPayloadRelativePath(issue.path),
    message: issue.message,
  }));
}

/**
 * Unwraps a success envelope and validates its payload.
 *
 * @param schema - the endpoint's `data` schema (what the service expects).
 * @param body - untrusted body of a 2xx response, or `null` when it was empty
 *   or not JSON.
 * @returns `{ ok: true, data }` on success, `{ ok: false, issues, cause }` on
 *   envelope **or** payload drift — never `undefined` for either.
 */
export function unwrapEnvelope<T>(
  schema: z.ZodType<T>,
  body: unknown,
): EnvelopeUnwrapResult<T> {
  const envelope = successEnvelopeSchema(schema).safeParse(body);

  if (!envelope.success) {
    return { ok: false, issues: toIssueDetails(envelope.error), cause: envelope.error };
  }

  const payload = schema.safeParse(envelope.data.data);

  if (!payload.success) {
    return { ok: false, issues: toIssueDetails(payload.error), cause: payload.error };
  }

  return { ok: true, data: payload.data };
}
