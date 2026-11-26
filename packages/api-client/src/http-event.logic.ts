/**
 * Pure derivation of the `HttpEvent` payload (AIS-152).
 *
 * Why these live apart from `http-client.ts`: the transport's job is to *run* an
 * attempt, and every rule about **what of the attempt may be recorded** is a
 * decision that deserves its own branch-level tests. Kept pure — no `fetch`, no
 * clock, no globals — so the whole privacy story of the event is provable with
 * plain values.
 *
 * The three guarantees implemented here:
 *
 * 1. a credential never enters the preview: a top-level `token`/`password`/
 *    `secret`/`apiKey`/`authorization` key is masked **before** serialisation;
 * 2. nothing unbounded enters the event: query and body are truncated and the
 *    truncation is visible;
 * 3. a malformed envelope yields `null` instead of a half-read meta.
 */

import { responseMetaSchema } from '@callback/shared';
import {
  HTTP_BODY_PREVIEW_MAX_LENGTH,
  HTTP_EVENT_TRUNCATION_SUFFIX,
  HTTP_PREVIEW_REDACTED_PLACEHOLDER,
  HTTP_PREVIEW_SENSITIVE_KEY_PATTERN,
  HTTP_QUERY_MAX_LENGTH,
} from './http-event.const.js';
import type { HttpEventResponseMeta } from './http-client.interface.js';

/**
 * @param value - anything a caller passed as a body.
 * @returns `true` when the value can be indexed as a record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * @param text - the value to shorten.
 * @param maxLength - allowed length without the suffix.
 * @returns the text unchanged when it fits, otherwise a prefix plus `…`.
 */
function truncateForEvent(text: string, maxLength: number): string {
  return text.length > maxLength
    ? `${text.slice(0, maxLength)}${HTTP_EVENT_TRUNCATION_SUFFIX}`
    : text;
}

/**
 * Extracts the query string of the attempt path.
 *
 * The path may already carry the query the transport generated for a list call,
 * so this is the single place that separates the two — the same rule for a
 * hand-written query and for a `getList` one.
 *
 * @param path - the path handed to the transport, with or without `?`.
 * @returns the encoded query **without** the `?`, `''` when there is none, and
 *   a truncated copy when it exceeds {@link HTTP_QUERY_MAX_LENGTH}.
 */
export function toEventQuery(path: string): string {
  const queryIndex = path.indexOf('?');

  if (queryIndex === -1) {
    return '';
  }

  return truncateForEvent(path.slice(queryIndex + 1), HTTP_QUERY_MAX_LENGTH);
}

/**
 * Replaces the value of every sensitive top-level key with a placeholder.
 *
 * Shallow on purpose: masking nested structures would have to rebuild arbitrary
 * shapes, and the event only ever carries a human-sized prefix of a flat-ish
 * payload. A nested secret is still covered when the top-level key names it.
 *
 * @param body - the request payload as the caller built it.
 * @returns a copy with masked values; the input is never mutated.
 */
function maskSensitiveKeys(body: unknown): unknown {
  if (!isRecord(body)) {
    return body;
  }

  const masked: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(body)) {
    masked[key] = HTTP_PREVIEW_SENSITIVE_KEY_PATTERN.test(key)
      ? HTTP_PREVIEW_REDACTED_PLACEHOLDER
      : value;
  }

  return masked;
}

/**
 * Builds the truncated, masked prefix of the request body that was actually sent.
 *
 * @param body - the payload the verb handed to `JSON.stringify`, or `undefined`
 *   for a body-less call.
 * @returns the prefix plus `…` when shortened, `null` when there is no body or it
 *   cannot be serialised.
 */
export function toBodyPreview(body: unknown): string | null {
  if (body === undefined) {
    return null;
  }

  let serialised: string | undefined;

  try {
    serialised = JSON.stringify(maskSensitiveKeys(body));
  } catch {
    // A circular or BigInt body would make `JSON.stringify` throw; the request
    // itself fails for the same reason, so “no preview” is the honest answer.
    return null;
  }

  if (serialised === undefined || serialised.length === 0) {
    return null;
  }

  return truncateForEvent(serialised, HTTP_BODY_PREVIEW_MAX_LENGTH);
}

/**
 * Reads the traceable part of a success envelope.
 *
 * Validated with the shared `responseMetaSchema`, the same schema the envelope
 * unwrap uses, so the event can never report a `meta` the rest of the client
 * would reject.
 *
 * @param body - the parsed response body, envelope or not.
 * @returns the meta, or `null` when the body carries no valid `meta` (a proxy
 *   error page, a non-contract response, an error body).
 */
export function toResponseMeta(body: unknown): HttpEventResponseMeta | null {
  if (!isRecord(body)) {
    return null;
  }

  const parsed = responseMetaSchema.safeParse(body['meta']);

  if (!parsed.success) {
    return null;
  }

  return {
    requestId: parsed.data.requestId,
    timestamp: parsed.data.timestamp,
    totalItems: parsed.data.pagination?.total ?? null,
  };
}
