/**
 * Zod schema and pure factory of the success envelope (D2, D6).
 *
 * The factory is deliberately trivial and **pure**: no Nest, no `process.env`,
 * no I/O, no clock. The server's `ApiResponseService` and a test in this package
 * call the exact same function, so “what the wire looks like” cannot differ
 * between production and test.
 */

import { z } from 'zod';
import { isoDateTimeSchema } from './datetime.schema.js';
import type { ApiEnvelope, ResponseMeta } from './envelope.interface.js';

/** `meta.pagination`, shared by server and client. */
export const paginationMetaSchema = z.object({
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
});

/**
 * `meta` — always present, `pagination` only on paginated lists.
 *
 * `requestId` and `timestamp` are required because a response without them
 * cannot be correlated to a server log line.
 */
export const responseMetaSchema = z.object({
  requestId: z.string().min(1),
  timestamp: isoDateTimeSchema,
  pagination: paginationMetaSchema.optional(),
});

/**
 * Builds the envelope schema for one endpoint's `data` schema.
 *
 * `data` is nullable so the “success with nothing to return” case (D4) is
 * expressible at type level instead of as an exception; it is never *absent*,
 * which is why a body without `data` is rejected.
 *
 * The closing `transform` is an identity mapping with an explicit return type,
 * and it is there for one reason only: zod's `objectUtil.addQuestionMarks`
 * cannot prove that a *generic* payload excludes `undefined`, so the inferred
 * type of `z.object({...})` marks `data` optional. Annotating the transform
 * keeps the published type — `ApiEnvelope<TPayload>` with a required `data` —
 * exactly equal to what the schema accepts, without a type assertion.
 *
 * `TPayload` is deliberately **unconstrained**: the client transport wraps
 * whatever schema a service passes (`apiKeyListSchema`, `apiKeySchema`, a
 * `z.null()` for a delete), so restricting it to objects would force a cast at
 * the one place that must not need one.
 *
 * @param dataSchema - schema of the payload this endpoint returns.
 * @returns schema of the whole response body.
 */
export function successEnvelopeSchema<TPayload>(
  dataSchema: z.ZodType<TPayload, z.ZodTypeDef, unknown>,
): z.ZodType<ApiEnvelope<TPayload>, z.ZodTypeDef, unknown> {
  return z
    .object({
      data: dataSchema.nullable(),
      meta: responseMetaSchema,
    })
    .transform((body): ApiEnvelope<TPayload> => ({
      data: body.data ?? null,
      meta: body.meta,
    }));
}

/**
 * Wraps a payload into the success envelope.
 *
 * @param data - payload, or `null` for a success without a payload.
 * @param meta - `requestId` + `timestamp` (+ `pagination` when applicable).
 * @returns the response body as it goes on the wire.
 */
export function toSuccessEnvelope<T>(
  data: T,
  meta: ResponseMeta,
): ApiEnvelope<T> {
  return { data, meta };
}
