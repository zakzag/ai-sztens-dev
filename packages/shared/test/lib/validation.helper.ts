/**
 * Test helper for the common format schemas (AIS-112).
 *
 * Every assertion in the suites of this folder is about **which sentence** the
 * user sees, not only whether parsing succeeded — so the helper parses with the
 * production error map attached, exactly like the admin form does.
 */

import type { z } from 'zod';
import { VALIDATION_ERROR_MAP } from '../../src/index.js';

/** One failed parse, flattened into something a test can assert on. */
export interface IssueSummary {
  /** Dot path of the offending field (`''` for the whole value). */
  readonly path: string;
  /** The sentence the UI would show. */
  readonly message: string;
}

/**
 * @param schema - the schema under test.
 * @param value - the value to parse.
 * @returns every issue, in zod order; empty when the value is accepted.
 */
export function parseIssues(
  schema: z.ZodTypeAny,
  value: unknown,
): readonly IssueSummary[] {
  const result = schema.safeParse(value, { errorMap: VALIDATION_ERROR_MAP });

  return result.success
    ? []
    : result.error.issues.map((issue) => ({
        path: issue.path.map(String).join('.'),
        message: issue.message,
      }));
}

/**
 * @param schema - the schema under test.
 * @param value - the value to parse.
 * @returns the first message, or `null` when the value is accepted.
 */
export function firstMessage(
  schema: z.ZodTypeAny,
  value: unknown,
): string | null {
  return parseIssues(schema, value)[0]?.message ?? null;
}

/**
 * @param schema - the schema under test.
 * @param value - the value to parse.
 * @returns the parsed value, or `null` when parsing failed.
 */
export function parsedValue<T>(schema: z.ZodType<T>, value: unknown): T | null {
  const result = schema.safeParse(value, { errorMap: VALIDATION_ERROR_MAP });

  return result.success ? result.data : null;
}
