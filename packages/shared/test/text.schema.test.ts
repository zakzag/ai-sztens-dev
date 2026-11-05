import {
  VALIDATION_MESSAGE_CATALOGUE,
  formatMessage,
  identifierSchema,
  nonEmptyTextSchema,
  trimmedStringSchema,
} from '../src/index.js';
import {
  firstMessage,
  parsedValue,
} from './lib/validation.helper.js';

/**
 * Unit tests of the text schema factories (AIS-112 plan `D6`).
 *
 * `trimmedStringSchema` and `nonEmptyTextSchema` carry **no** message of their
 * own: the length rules surface as zod's `too_small` / `too_big` issues, which
 * the error map translates. The tests therefore assert the mapped sentence.
 */

const ENGLISH = VALIDATION_MESSAGE_CATALOGUE.en;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9._-]{1,20}$/;

describe('trimmedStringSchema', () => {
  const schema = trimmedStringSchema({ max: 5 });

  it('trims the value', () => {
    expect(parsedValue(schema, '  ab  ')).toBe('ab');
  });

  it('accepts an empty value', () => {
    expect(schema.safeParse('').success).toBe(true);
  });

  it('accepts exactly the maximum length', () => {
    expect(schema.safeParse('12345').success).toBe(true);
  });

  it('rejects one character over the maximum', () => {
    expect(firstMessage(schema, '123456')).toBe(
      formatMessage(ENGLISH.TOO_LONG_TEMPLATE, { max: 5 }),
    );
  });

  it('measures the trimmed value, not the raw input', () => {
    expect(schema.safeParse('  12345  ').success).toBe(true);
  });
});

describe('nonEmptyTextSchema', () => {
  const schema = nonEmptyTextSchema({ max: 5 });

  it('accepts a filled value', () => {
    expect(parsedValue(schema, '  abc ')).toBe('abc');
  });

  it('rejects an empty value with the REQUIRED copy', () => {
    expect(firstMessage(schema, '')).toBe(ENGLISH.REQUIRED);
  });

  it('rejects a whitespace-only value with the REQUIRED copy', () => {
    expect(firstMessage(schema, '   ')).toBe(ENGLISH.REQUIRED);
  });

  it('rejects a value over the maximum', () => {
    expect(firstMessage(schema, 'abcdef')).toBe(
      formatMessage(ENGLISH.TOO_LONG_TEMPLATE, { max: 5 }),
    );
  });
});

describe('identifierSchema', () => {
  const schema = identifierSchema({ pattern: IDENTIFIER_PATTERN, max: 20 });

  it('accepts a URL-safe identifier', () => {
    expect(parsedValue(schema, 'vapi.prod_1-x')).toBe('vapi.prod_1-x');
  });

  it('trims before the pattern check', () => {
    expect(parsedValue(schema, '  vapi-prod  ')).toBe('vapi-prod');
  });

  it('rejects a space inside the identifier', () => {
    expect(firstMessage(schema, 'vapi prod')).toBe(ENGLISH.IDENTIFIER);
  });

  it('rejects a slash, because the identifier is a path parameter', () => {
    expect(firstMessage(schema, 'vapi/prod')).toBe(ENGLISH.IDENTIFIER);
  });

  it('proves the factory is generic: a different pattern gives a different rule', () => {
    const digitsOnly = identifierSchema({ pattern: /^\d{1,4}$/, max: 4 });

    expect(digitsOnly.safeParse('1234').success).toBe(true);
    expect(digitsOnly.safeParse('12a4').success).toBe(false);
  });
});
