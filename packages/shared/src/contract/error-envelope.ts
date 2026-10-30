/**
 * Zod schema, status resolver and pure factory of the error envelope (D3, D8).
 *
 * The status is **derived from the code**, never passed in: a service only says
 * *what* went wrong, the catalogue says which HTTP status that means. Nothing
 * here touches Nest, the clock or the environment, so the server filter and the
 * tests build byte-identical bodies.
 */

import { z } from 'zod';
import { isoDateTimeSchema } from './datetime.schema.js';
import {
  API_ERROR_CODE_STATUS,
  UNKNOWN_API_ERROR_CODE_STATUS,
} from './error-code.const.js';
import type {
  ApiErrorEnvelope,
  AppErrorShape,
  ErrorContext,
} from './error-envelope.interface.js';

/** One field-level issue. */
export const apiErrorDetailSchema = z.object({
  path: z.string(),
  message: z.string().min(1),
});

/**
 * The error body.
 *
 * `code` is a free string, not an enum: a code the client does not know yet must
 * parse successfully so it can fall back to status-based copy instead of
 * failing as a schema drift.
 */
export const apiErrorBodySchema = z.object({
  code: z.string().min(1),
  status: z.number().int().min(400).max(599),
  message: z.string().min(1),
  details: z.array(apiErrorDetailSchema),
  requestId: z.string().min(1),
  timestamp: isoDateTimeSchema,
  path: z.string().min(1),
});

/** Schema of the whole error response body. */
export const apiErrorEnvelopeSchema: z.ZodType<
  ApiErrorEnvelope,
  z.ZodTypeDef,
  unknown
> = z.object({ error: apiErrorBodySchema });

/**
 * Maps a code to its HTTP status.
 *
 * Only **own** keys of the catalogue count: a code such as `toString` must fall
 * back to `500` instead of resolving an inherited `Object.prototype` member.
 *
 * @param code - a catalogue code, or anything a newer server sent.
 * @returns the catalogue status, or `500` for an unknown code.
 */
export function resolveApiErrorStatus(code: string): number {
  const statuses: Readonly<Record<string, number>> = API_ERROR_CODE_STATUS;

  if (!Object.hasOwn(statuses, code)) {
    return UNKNOWN_API_ERROR_CODE_STATUS;
  }

  return statuses[code];
}

/**
 * Builds the error envelope.
 *
 * @param error - code, developer message and optional field details.
 * @param ctx - `requestId`, `timestamp` and `path` of the failed request.
 * @returns the response body as it goes on the wire.
 */
export function toErrorEnvelope(
  error: AppErrorShape,
  ctx: ErrorContext,
): ApiErrorEnvelope {
  return {
    error: {
      code: error.code,
      status: resolveApiErrorStatus(error.code),
      message: error.message,
      details: error.details === undefined ? [] : [...error.details],
      requestId: ctx.requestId,
      timestamp: ctx.timestamp,
      path: ctx.path,
    },
  };
}
