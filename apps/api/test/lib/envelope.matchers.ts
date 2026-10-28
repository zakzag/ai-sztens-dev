/**
 * Shared envelope assertions for the e2e suites (AIS-97, plan key decision 2).
 *
 * Every response in the API is either `{ data, meta }` or `{ error }`, and both
 * shapes have rules that are easy to restate slightly differently in each spec
 * (`expect(body.data).toBe(...)` twenty times is how a contract silently drifts).
 * These helpers assert the *whole* promise once, and return the narrowed body so
 * the caller only has to check its own payload.
 *
 * They are deliberately plain functions rather than custom jest matchers: a
 * custom matcher needs `expect.extend` in a setup file, and the e2e config has
 * none — a function keeps the failure message explicit at the call site.
 */

import { expect } from '@jest/globals';

/** `meta` of a success envelope. */
export interface EnvelopeMetaBody {
  /** Correlation id, echoed in `X-Request-Id`. */
  readonly requestId: string;
  /** ISO 8601 UTC timestamp of the response. */
  readonly timestamp: string;
}

/** A success body: `data` always present, `meta` always present. */
export interface SuccessEnvelopeBody<TData = unknown> {
  /** Payload; `null` means “success with nothing to return”. */
  readonly data: TData;
  /** Correlation metadata. */
  readonly meta: EnvelopeMetaBody;
}

/** One field-level error detail. */
export interface EnvelopeErrorDetailBody {
  /** Dot path of the offending field (`''` = whole payload). */
  readonly path: string;
  /** Developer-facing message. */
  readonly message: string;
}

/** The error body: one shape for every failure. */
export interface ErrorEnvelopeBody {
  readonly error: {
    readonly code: string;
    readonly status: number;
    readonly message: string;
    readonly details: readonly EnvelopeErrorDetailBody[];
    readonly requestId: string;
    readonly timestamp: string;
    readonly path: string;
  };
}

/**
 * @param value - any value from `JSON.parse`.
 * @returns `true` when the value is a non-null, non-array object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Asserts an ISO 8601 UTC timestamp.
 *
 * @param value - candidate value.
 * @returns `true` when it parses and is written in `Z` form.
 */
function isIsoUtc(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.endsWith('Z') &&
    !Number.isNaN(Date.parse(value))
  );
}

/**
 * Asserts the success envelope of a response body.
 *
 * Checks presence of `data` (not its type — that is the caller's business) and
 * that `meta` carries a non-empty `requestId` and an ISO UTC `timestamp`, which
 * is what makes a response traceable to a log line.
 *
 * @param body - parsed response body.
 * @returns the same body, narrowed.
 */
export function expectSuccessEnvelope<TData = unknown>(
  body: unknown,
): SuccessEnvelopeBody<TData> {
  expect(isRecord(body)).toBe(true);

  if (!isRecord(body)) {
    // Unreachable after the assertion above; keeps the types honest.
    throw new Error('response body is not an object');
  }

  expect(Object.hasOwn(body, 'data')).toBe(true);
  expect(Object.hasOwn(body, 'error')).toBe(false);
  expect(isRecord(body['meta'])).toBe(true);

  const meta = body['meta'];

  if (!isRecord(meta)) {
    throw new Error('response body has no `meta` object');
  }

  expect(typeof meta['requestId']).toBe('string');
  expect((meta['requestId'] as string).length).toBeGreaterThan(0);
  expect(isIsoUtc(meta['timestamp'])).toBe(true);

  return body as SuccessEnvelopeBody<TData>;
}

/**
 * Asserts the error envelope of a response body and the contract pair that
 * identifies it: the machine `code` **and** its status.
 *
 * @param body - parsed response body.
 * @param expected - the code and status the endpoint promised.
 * @returns the same body, narrowed.
 */
export function expectErrorEnvelope(
  body: unknown,
  expected: { readonly code: string; readonly status: number },
): ErrorEnvelopeBody {
  expect(isRecord(body)).toBe(true);

  if (!isRecord(body)) {
    throw new Error('response body is not an object');
  }

  expect(Object.hasOwn(body, 'data')).toBe(false);
  expect(isRecord(body['error'])).toBe(true);

  const error = body['error'];

  if (!isRecord(error)) {
    throw new Error('response body has no `error` object');
  }

  expect(error['code']).toBe(expected.code);
  expect(error['status']).toBe(expected.status);
  expect(typeof error['message']).toBe('string');
  expect((error['message'] as string).length).toBeGreaterThan(0);
  expect(Array.isArray(error['details'])).toBe(true);
  expect(typeof error['requestId']).toBe('string');
  expect((error['requestId'] as string).length).toBeGreaterThan(0);
  expect(isIsoUtc(error['timestamp'])).toBe(true);
  expect(typeof error['path']).toBe('string');

  return body as ErrorEnvelopeBody;
}

/**
 * Asserts that a body is **raw** — the regression guard for the exemptions.
 *
 * Health probes and provider webhooks are consumed by software that parses an
 * exact body, so “no `data`, no `error`” is the property that must not change
 * when the envelope machinery gains features.
 *
 * @param body - parsed response body.
 * @returns the same body, narrowed.
 */
export function expectRawBody(body: unknown): Record<string, unknown> {
  expect(isRecord(body)).toBe(true);

  if (!isRecord(body)) {
    throw new Error('response body is not an object');
  }

  expect(Object.hasOwn(body, 'data')).toBe(false);
  expect(Object.hasOwn(body, 'error')).toBe(false);

  return body;
}

/**
 * Asserts that `meta.requestId` and the `X-Request-Id` header agree — the
 * correlation promise a bug report depends on.
 *
 * @param body - parsed success envelope.
 * @param headers - response headers.
 */
export function expectRequestIdHeaderEcho(
  body: SuccessEnvelopeBody,
  headers: Record<string, unknown>,
): void {
  expect(headers['x-request-id']).toBe(body.meta.requestId);
}
