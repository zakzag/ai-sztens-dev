/**
 * Tests of {@link toOptionalFormatSchema} (AIS-182).
 *
 * Two things are proved: the empty string is a legal “no value yet”, and every
 * non-empty value is judged by the **shared** schema, with its own catalogue
 * sentence — the wrapper must not invent copy of its own.
 */

import { huPostalCodeSchema, huTaxNumberSchema } from '@callback/shared';
import { describe, expect, it } from 'vitest';
import { toOptionalFormatSchema } from './optional-format.schema.js';

/** A real, checksum-valid Hungarian tax number (Magyar Telekom Nyrt.). */
const VALID_TAX_NUMBER = '10773381-2-44';

/**
 * @param schema - the shared schema whose copy the wrapper must keep.
 * @param value - the offending value.
 * @returns the first issue message of the shared schema, or `undefined`.
 */
function sharedMessage(
  schema: typeof huTaxNumberSchema,
  value: string,
): string | undefined {
  const result = schema.safeParse(value);

  return result.success ? undefined : result.error.issues[0]?.message;
}

describe('toOptionalFormatSchema', () => {
  it('accepts the empty string as a missing value', () => {
    const result = toOptionalFormatSchema(huTaxNumberSchema).safeParse('');

    expect(result.success).toBe(true);
    expect(result.success ? result.data : null).toBe('');
  });

  it('accepts a valid value and returns it trimmed', () => {
    const result = toOptionalFormatSchema(huTaxNumberSchema).safeParse(
      `  ${VALID_TAX_NUMBER}  `,
    );

    expect(result.success).toBe(true);
    expect(result.success ? result.data : null).toBe(VALID_TAX_NUMBER);
  });

  it('rejects an invalid value with the shared schema copy', () => {
    const result = toOptionalFormatSchema(huTaxNumberSchema).safeParse('x');

    expect(result.success).toBe(false);
    expect(result.success ? undefined : result.error.issues[0]?.message).toBe(
      sharedMessage(huTaxNumberSchema, 'x'),
    );
  });

  it('keeps every issue the shared schema produced', () => {
    const wrapped = toOptionalFormatSchema(huPostalCodeSchema).safeParse('1');
    const shared = huPostalCodeSchema.safeParse('1');

    expect(wrapped.success).toBe(false);
    expect(shared.success).toBe(false);

    if (wrapped.success || shared.success) {
      return;
    }

    expect(wrapped.error.issues.map((issue) => issue.message)).toEqual(
      shared.error.issues.map((issue) => issue.message),
    );
  });
});
