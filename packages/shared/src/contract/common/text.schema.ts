/**
 * Free-text and identifier schemas (AIS-112).
 *
 * Trimming happens **before** the length checks (`z.string().trim()` is a check
 * that mutates the value, so later checks see the trimmed string), which is why
 * a name of spaces is rejected instead of being stored as `'   '` — plan
 * decision `D6`.
 *
 * The length violations carry **no** explicit message: they surface as zod's
 * `too_small` / `too_big` issues, which
 * [`validation-error-map.const.ts`](packages/shared/src/contract/common/validation-error-map.const.ts:1)
 * translates in the active locale. Only the pattern rule needs explicit copy,
 * because zod cannot know what an identifier is.
 */

import { z } from 'zod';
import { patternCheck } from './format-check.helper.js';
import type {
  IdentifierSchemaOptions,
  TextSchemaOptions,
} from './format-schema.interface.js';

/**
 * A string that may be empty, but never contains leading/trailing whitespace.
 *
 * @param options - the upper bound.
 * @returns a string schema trimmed and capped at `options.max`.
 */
export function trimmedStringSchema(options: TextSchemaOptions): z.ZodString {
  return z.string().trim().max(options.max);
}

/**
 * A string that must carry something after trimming.
 *
 * @param options - the upper bound.
 * @returns a string schema with a `min(1)` check, so whitespace-only input
 *   fails with the `REQUIRED` copy.
 */
export function nonEmptyTextSchema(options: TextSchemaOptions): z.ZodString {
  return z.string().trim().min(1).max(options.max);
}

/**
 * A URL-safe technical identifier (`api-keys` `identifier`, slugs, …).
 *
 * @param options - allowed pattern and upper bound.
 * @returns a trimmed string schema that reports the locale's `IDENTIFIER` copy
 *   when the pattern does not match.
 */
export function identifierSchema(options: IdentifierSchemaOptions) {
  return z
    .string()
    .trim()
    .min(1)
    .max(options.max)
    .superRefine(patternCheck(options.pattern, 'IDENTIFIER'));
}
