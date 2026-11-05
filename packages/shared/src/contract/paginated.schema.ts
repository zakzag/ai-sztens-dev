/**
 * The client-side schema of a paginated response (AIS-106).
 *
 * It reuses the success envelope's building blocks — the same `responseMetaSchema`
 * for the metadata — so the `meta` of a paginated body is validated by exactly
 * the same rules as every other response, and the two cannot drift apart.
 *
 * The one thing this schema adds is the guarantee that `meta.pagination` is
 * **there**: a list response without it is a contract violation, and the parse
 * fails (plan `D6`).
 */

import { z } from 'zod';
import type { ApiResult } from './api-result.interface.js';
import { paginationMetaSchema, responseMetaSchema } from './envelope.schema.js';

/**
 * `meta` of a paginated response: the shared meta **plus a required pagination**.
 *
 * Deriving it with `.extend()` instead of re-declaring the fields keeps
 * `requestId`/`timestamp` validated by exactly the same schema as every other
 * response. Overriding `pagination` from `.optional()` to required is what makes
 * a missing block a normal zod issue at path `meta.pagination` (AIS-109).
 *
 * Why it is not a `throw` inside the transform any more: zod reports a thrown
 * error as a `custom` issue with an **empty** path, so a client could only find
 * out *where* the contract broke by matching the message string. A required
 * field produces the path for free.
 */
const paginatedMetaSchema = responseMetaSchema.extend({
  pagination: paginationMetaSchema,
});

/**
 * Builds the schema of one paginated list response.
 *
 * The parameter is the schema of the **whole row array** (`z.array(itemSchema)`),
 * not of one row. Parameterizing over a single item and calling `.array()`
 * inside widens the element type by one array dimension in zod — the transform
 * would then describe `TItem[][]` while the wire carries `TItem[]`. Taking the
 * array schema as it is keeps the type exact.
 *
 * The rows are nullable in the **input**, like the envelope's payload: zod's
 * `addQuestionMarks` cannot prove that a generic payload excludes `undefined`.
 * A paginated list always has rows on the wire, so a `null` never survives the
 * transform — it becomes an empty array.
 *
 * @param rowsSchema - schema of the row array.
 * @returns the schema of the whole response body.
 */
export function paginatedSchema<TRows>(
  rowsSchema: z.ZodType<TRows, z.ZodTypeDef, TRows>,
): z.ZodType<ApiResult<TRows>, z.ZodTypeDef, unknown> {
  return z
    .object({
      data: rowsSchema.nullable(),
      meta: paginatedMetaSchema,
    })
    .transform((body): ApiResult<TRows> => ({
      data: body.data ?? ([] as unknown as TRows),
      meta: body.meta,
    }));
}
