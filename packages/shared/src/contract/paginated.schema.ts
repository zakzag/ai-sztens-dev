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
import { responseMetaSchema } from './envelope.schema.js';

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
      meta: responseMetaSchema,
    })
    .transform((body): ApiResult<TRows> => {
      if (body.meta.pagination === undefined) {
        throw new Error('a paginated response must carry meta.pagination');
      }

      return {
        data: body.data ?? ([] as unknown as TRows),
        meta: { ...body.meta, pagination: body.meta.pagination },
      };
    });
}
