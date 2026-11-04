import {
  HU_POSTAL_CODE_LENGTH,
  VALIDATION_MESSAGE_CATALOGUE,
  huPostalCodeSchema,
} from '../src/index.js';
import { firstMessage } from './lib/validation.helper.js';

/**
 * Unit tests of `huPostalCodeSchema` (AIS-112).
 *
 * Shape only — the range is deliberately not checked, so the suite asserts four
 * digits and nothing about the value's meaning.
 */

const ENGLISH = VALIDATION_MESSAGE_CATALOGUE.en;

describe('huPostalCodeSchema', () => {
  it('declares the expected length', () => {
    expect(HU_POSTAL_CODE_LENGTH).toBe(4);
  });

  it.each(['1011', '1052', '9985', '0001'])('accepts the code %s', (code) => {
    expect(huPostalCodeSchema.safeParse(code).success).toBe(true);
  });

  it('trims surrounding whitespace', () => {
    expect(huPostalCodeSchema.safeParse(' 1011 ').success).toBe(true);
  });

  it('rejects three digits', () => {
    expect(firstMessage(huPostalCodeSchema, '111')).toBe(ENGLISH.POSTAL_CODE);
  });

  it('rejects five digits', () => {
    expect(firstMessage(huPostalCodeSchema, '11111')).toBe(ENGLISH.POSTAL_CODE);
  });

  it('rejects letters', () => {
    expect(firstMessage(huPostalCodeSchema, 'abcd')).toBe(ENGLISH.POSTAL_CODE);
  });

  it('rejects a grouped form', () => {
    expect(firstMessage(huPostalCodeSchema, '10-11')).toBe(ENGLISH.POSTAL_CODE);
  });

  it('rejects an empty value', () => {
    expect(firstMessage(huPostalCodeSchema, '')).toBe(ENGLISH.POSTAL_CODE);
  });
});
