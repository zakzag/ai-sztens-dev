import {
  PHONE_DEFAULT_COUNTRY,
  VALIDATION_MESSAGE_CATALOGUE,
  isValidPhone,
  normalizePhone,
  phoneSchema,
} from '../src/index.js';
import {
  firstMessage,
  parsedValue,
} from './lib/validation.helper.js';

/**
 * Unit tests of `phoneSchema` and `normalizePhone` (AIS-112 plan `D3`).
 *
 * The DoD asks for the Hungarian `+36` shapes — spaces, dashes, brackets — to
 * be accepted **and normalised to E.164**, which is exactly what the first
 * block asserts: every variant must produce the same stored string.
 */

const ENGLISH = VALIDATION_MESSAGE_CATALOGUE.en;
const E164_MOBILE = '+36301234567';

describe('phoneSchema', () => {
  it('defaults to Hungary', () => {
    expect(PHONE_DEFAULT_COUNTRY).toBe('HU');
  });

  it('normalises the international form', () => {
    expect(parsedValue(phoneSchema, '+36301234567')).toBe(E164_MOBILE);
  });

  it('normalises a spaced international form', () => {
    expect(parsedValue(phoneSchema, '+36 30 123 4567')).toBe(E164_MOBILE);
  });

  it('normalises the domestic 06 form with dashes', () => {
    expect(parsedValue(phoneSchema, '06-30-123-4567')).toBe(E164_MOBILE);
  });

  it('normalises the domestic 06 form with brackets', () => {
    expect(parsedValue(phoneSchema, '(06 30) 123 4567')).toBe(E164_MOBILE);
  });

  it('normalises a Budapest landline', () => {
    expect(parsedValue(phoneSchema, '06 1 234 5678')).toBe('+3612345678');
  });

  it('trims surrounding whitespace before parsing', () => {
    expect(parsedValue(phoneSchema, '  +36 30 123 4567 ')).toBe(E164_MOBILE);
  });

  it('rejects an empty value', () => {
    expect(firstMessage(phoneSchema, '')).toBe(ENGLISH.PHONE);
  });

  it('rejects a value without digits', () => {
    expect(firstMessage(phoneSchema, 'nem telefonszám')).toBe(ENGLISH.PHONE);
  });

  it('rejects a truncated number', () => {
    expect(phoneSchema.safeParse('06 30 123').success).toBe(false);
  });

  it('rejects a number with an unknown Hungarian prefix', () => {
    expect(phoneSchema.safeParse('+36 99 999 9999').success).toBe(false);
  });

  it('rejects a value over the input length limit', () => {
    expect(phoneSchema.safeParse(`+36${'1'.repeat(40)}`).success).toBe(false);
  });
});

describe('normalizePhone', () => {
  it('returns the E.164 form for a valid number', () => {
    expect(normalizePhone('+36 30 123 4567')).toBe(E164_MOBILE);
  });

  it('returns null for an invalid number', () => {
    expect(normalizePhone('+36 99 999 9999')).toBeNull();
  });

  it('agrees with isValidPhone', () => {
    expect(isValidPhone('+36 30 123 4567')).toBe(true);
    expect(isValidPhone('+36 99 999 9999')).toBe(false);
  });
});
