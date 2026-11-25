/**
 * The form-side wrapper of a shared **format** schema that a text input may
 * leave empty.
 *
 * A text input cannot express “absent” any other way than `''`, while the shared
 * request schema validates a format (`huTaxNumberSchema`, `huPostalCodeSchema`,
 * …) and would reject the empty string. This helper bridges the two without
 * inventing a second validation table:
 *
 * - `''` short-circuits the check and is accepted, because “no tax number yet”
 *   is a real state of a prospect (AIS-16 `D1`);
 * - every non-empty value is validated by the **same** schema the request uses,
 *   and its issues are re-added verbatim, so the Hungarian format copy
 *   (`TAX_NUMBER`, `TAX_NUMBER_CHECKSUM`, `POSTAL_CODE`) stays in the shared
 *   catalogue.
 *
 * Extracted from `pages/customers/customer-edit.logic.ts` by AIS-182: the
 * customers **wizard** needs exactly the same behaviour on two of its inputs, and
 * a copy would have to be kept in step in two places.
 */

import type { z } from 'zod';
import { z as zod } from 'zod';

/**
 * Wraps a shared format schema so that the empty string is accepted.
 *
 * @param schema - the shared format schema of the field (e.g. `huTaxNumberSchema`).
 * @returns a string schema that accepts `''` and otherwise defers to `schema`,
 *   re-adding every issue it produced.
 */
export function toOptionalFormatSchema(
  schema: z.ZodType<string>,
): z.ZodEffects<z.ZodString, string, string> {
  return zod
    .string()
    .trim()
    .superRefine((value, ctx) => {
      if (value.length === 0) {
        return;
      }

      const result = schema.safeParse(value);

      if (!result.success) {
        result.error.issues.forEach((issue) => {
          ctx.addIssue(issue);
        });
      }
    });
}
