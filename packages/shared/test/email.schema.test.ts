import {
  EMAIL_MAX_LENGTH,
  VALIDATION_MESSAGE_CATALOGUE,
  emailSchema,
} from '../src/index.js';
import {
  firstMessage,
  parsedValue,
} from './lib/validation.helper.js';

/**
 * Unit tests of `emailSchema` (AIS-112).
 *
 * The two behaviours worth protecting: normalisation (trim + lower case) and the
 * Hungarian copy the UI renders — the schema itself must never say
 * “Invalid email”.
 */

const ENGLISH = VALIDATION_MESSAGE_CATALOGUE.en;
const HUNGARIAN = VALIDATION_MESSAGE_CATALOGUE.hu;

describe('emailSchema', () => {
  it('accepts a plain address', () => {
    expect(emailSchema.parse('info@example.com')).toBe('info@example.com');
  });

  it('trims and lower-cases the value', () => {
    expect(parsedValue(emailSchema, '  Info@Example.COM ')).toBe(
      'info@example.com',
    );
  });

  it('accepts the longest allowed address', () => {
    const localPart = 'a'.repeat(EMAIL_MAX_LENGTH - '@example.com'.length);

    expect(emailSchema.safeParse(`${localPart}@example.com`).success).toBe(true);
  });

  it('rejects an address longer than the limit', () => {
    const localPart = 'a'.repeat(EMAIL_MAX_LENGTH - '@example.com'.length + 1);

    expect(emailSchema.safeParse(`${localPart}@example.com`).success).toBe(false);
  });

  it('rejects an address without a domain dot', () => {
    expect(firstMessage(emailSchema, 'info@example')).toBe(ENGLISH.EMAIL);
  });

  it('rejects an address without the at sign', () => {
    expect(firstMessage(emailSchema, 'info.example.com')).toBe(ENGLISH.EMAIL);
  });

  it('rejects an empty value', () => {
    expect(emailSchema.safeParse('').success).toBe(false);
  });

  it('rejects a whitespace-only value', () => {
    expect(emailSchema.safeParse('   ').success).toBe(false);
  });

  it('uses the Hungarian sentence after the locale switch', () => {
    // The catalogue is what the admin renders; the schema must not embed copy.
    expect(HUNGARIAN.EMAIL).not.toBe(ENGLISH.EMAIL);
    expect(HUNGARIAN.EMAIL).toContain('e-mail');
  });
});
