/**
 * The shared calendar-day schema (AIS-112).
 *
 * `YYYY-MM-DD` **and** a day that exists. The second half is not cosmetic: a
 * shape-only rule accepts `2026-02-29` and `2026-04-31`, which Postgres then
 * rejects (or, in a `date` column with a lenient cast, silently rolls over) —
 * long after the form said the value was fine.
 */

import { z } from 'zod';
import { addValidationIssue } from './format-check.helper.js';
import { isValidDateOnly } from './date-only.helper.js';

/** A real calendar day, formatted `YYYY-MM-DD`. */
export const dateOnlySchema = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    if (!isValidDateOnly(value)) {
      addValidationIssue(ctx, 'DATE_ONLY');
    }
  });
