/**
 * Wire-shape helpers of the MSW handlers.
 *
 * Every handler builds its body through `toSuccessEnvelope` / `toErrorEnvelope`
 * from `@callback/shared` — the same factories the server uses — so a test
 * response is byte-identical to what the API sends, and a contract change breaks
 * one helper instead of nine hand-written bodies.
 *
 * A list response additionally carries `meta.pagination` (AIS-114): the client
 * transport validates that block as a **required** field, so a handler that
 * forgets it produces an `UNEXPECTED_PAYLOAD` instead of an empty pager.
 *
 * Nothing here touches the clock: the request id and timestamp are fixed
 * constants so assertions stay deterministic.
 */

import { HttpResponse } from 'msw';
import type { ApiErrorDetail, PaginationMeta } from '@callback/shared';
import { toErrorEnvelope, toSuccessEnvelope } from '@callback/shared';

/** Correlation id every handler stamps into its envelope. */
export const TEST_REQUEST_ID = 'req-test';

/** Fixed UTC timestamp stamped into every envelope. */
export const TEST_TIMESTAMP = '2026-11-02T14:00:00.000Z';

/** Options of {@link successResponse}. */
export interface SuccessResponseOptions {
  /** HTTP status; defaults to `200`. */
  readonly status?: number;
  /** Envelope `requestId`; defaults to {@link TEST_REQUEST_ID}. */
  readonly requestId?: string;
  /**
   * `meta.pagination` — supply it for a **list** response only.
   *
   * Omitted for a detail/mutation body: the transport's single-resource unwrap
   * does not require the block, and inventing one would make the fixture lie
   * about the endpoint.
   */
  readonly pagination?: PaginationMeta;
}

/**
 * Builds a `2xx` response wrapped in the shared success envelope.
 *
 * @param data - the `data` payload of the envelope.
 * @param options - optional status, request id and pagination overrides.
 * @returns an MSW JSON response ready to be returned from a handler.
 */
export function successResponse(
  data: unknown,
  options: SuccessResponseOptions = {},
) {
  return HttpResponse.json(
    toSuccessEnvelope(data, {
      requestId: options.requestId ?? TEST_REQUEST_ID,
      timestamp: TEST_TIMESTAMP,
      ...(options.pagination === undefined
        ? {}
        : { pagination: options.pagination }),
    }),
    { status: options.status ?? 200 },
  );
}

/** Options of {@link errorResponse}. */
export interface ErrorResponseOptions {
  /** Field-level details; omitted means “no field is at fault”. */
  readonly details?: readonly ApiErrorDetail[];
  /** Envelope `requestId`; defaults to {@link TEST_REQUEST_ID}. */
  readonly requestId?: string;
  /** Requested route written into the envelope; defaults to `/api/api-keys`. */
  readonly path?: string;
}

/**
 * Builds an error response whose status is derived from the code, exactly like
 * the server does (`resolveApiErrorStatus`).
 *
 * @param code - one of the shared `API_ERROR_CODE` catalogue values.
 * @param message - English developer message (never rendered as user copy).
 * @param options - optional details, request id and route.
 * @returns an MSW JSON response with the contract error envelope.
 */
export function errorResponse(
  code: string,
  message: string,
  options: ErrorResponseOptions = {},
) {
  const envelope = toErrorEnvelope(
    { code, message, details: options.details },
    {
      requestId: options.requestId ?? TEST_REQUEST_ID,
      timestamp: TEST_TIMESTAMP,
      path: options.path ?? '/api/api-keys',
    },
  );

  return HttpResponse.json(envelope, { status: envelope.error.status });
}
