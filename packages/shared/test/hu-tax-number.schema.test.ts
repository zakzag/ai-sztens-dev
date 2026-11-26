import {
  VALIDATION_MESSAGE_CATALOGUE,
  computeHuTaxNumberCheckDigit,
  huTaxNumberSchema,
  isValidHuTaxNumber,
} from '../src/index.js';
import { firstMessage } from './lib/validation.helper.js';

/**
 * Unit tests of `huTaxNumberSchema` (AIS-112).
 *
 * The three accepted numbers are published Hungarian tax numbers of large
 * taxpayers, and all three satisfy
 * `check = (10 - (Σ digitᵢ × weightᵢ mod 10)) mod 10` with the weights
 * `9, 7, 3, 1, 9, 7, 3`. They are the regression net for the algorithm: if a
 * future refactor breaks the weights, these fail before a user ever sees an
 * accepted-but-invalid tax number.
 */

const ENGLISH = VALIDATION_MESSAGE_CATALOGUE.en;

const VALID_TAX_NUMBERS = [
  // Magyar Telekom Nyrt.
  '10773381-2-44',
  // OTP Bank Nyrt.
  '10537914-4-44',
  // Richter Gedeon Nyrt.
  '10484823-2-44',
] as const;

describe('huTaxNumberSchema', () => {
  it.each(VALID_TAX_NUMBERS)('accepts the real tax number %s', (taxNumber) => {
    expect(huTaxNumberSchema.safeParse(taxNumber).success).toBe(true);
  });

  it('trims surrounding whitespace', () => {
    expect(huTaxNumberSchema.safeParse(' 10773381-2-44 ').success).toBe(true);
  });

  it('rejects a wrong check digit with the checksum copy', () => {
    expect(firstMessage(huTaxNumberSchema, '10773382-2-44')).toBe(
      ENGLISH.TAX_NUMBER_CHECKSUM,
    );
  });

  it('rejects a VAT code of zero with the format copy', () => {
    expect(firstMessage(huTaxNumberSchema, '10773381-0-44')).toBe(
      ENGLISH.TAX_NUMBER,
    );
  });

  it('rejects a VAT code above five', () => {
    expect(firstMessage(huTaxNumberSchema, '10773381-6-44')).toBe(
      ENGLISH.TAX_NUMBER,
    );
  });

  it('rejects an area code of zero', () => {
    expect(firstMessage(huTaxNumberSchema, '10773381-2-00')).toBe(
      ENGLISH.TAX_NUMBER,
    );
  });

  it('rejects an area code above forty-four', () => {
    expect(firstMessage(huTaxNumberSchema, '10773381-2-45')).toBe(
      ENGLISH.TAX_NUMBER,
    );
  });

  it('rejects a value without dashes', () => {
    expect(firstMessage(huTaxNumberSchema, '10773381244')).toBe(
      ENGLISH.TAX_NUMBER,
    );
  });

  it('rejects a nine-digit body', () => {
    expect(firstMessage(huTaxNumberSchema, '107733810-2-44')).toBe(
      ENGLISH.TAX_NUMBER,
    );
  });

  it('rejects letters', () => {
    expect(firstMessage(huTaxNumberSchema, 'abcdefgh-1-23')).toBe(
      ENGLISH.TAX_NUMBER,
    );
  });

  it('rejects an empty value', () => {
    expect(firstMessage(huTaxNumberSchema, '')).toBe(ENGLISH.TAX_NUMBER);
  });
});

describe('computeHuTaxNumberCheckDigit', () => {
  it('derives the eighth digit of a real tax number', () => {
    expect(computeHuTaxNumberCheckDigit('1077338')).toBe(1);
    expect(computeHuTaxNumberCheckDigit('1053791')).toBe(4);
    expect(computeHuTaxNumberCheckDigit('1048482')).toBe(3);
  });
});

describe('isValidHuTaxNumber', () => {
  it('combines shape, check digit and code ranges', () => {
    expect(isValidHuTaxNumber('10773381-2-44')).toBe(true);
    expect(isValidHuTaxNumber('10773382-2-44')).toBe(false);
    expect(isValidHuTaxNumber('10773381-0-44')).toBe(false);
  });
});
