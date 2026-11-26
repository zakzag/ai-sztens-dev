import {
  VALIDATION_MESSAGE_CATALOGUE,
  computeIbanRemainder,
  ibanSchema,
  isValidIban,
  normalizeIban,
} from '../src/index.js';
import {
  firstMessage,
  parsedValue,
} from './lib/validation.helper.js';

/**
 * Unit tests of `ibanSchema` (AIS-112 plan `D4`).
 *
 * The three accepted IBANs are published examples (HU, DE, GB) whose check
 * digits were verified with the implementation itself before being frozen here;
 * the last case flips one digit so the mod-97 must fail — that is the DoD item
 * “a wrong check digit fails”.
 */

const ENGLISH = VALIDATION_MESSAGE_CATALOGUE.en;
const HU_IBAN = 'HU42117730161111101800000000';
const DE_IBAN = 'DE89370400440532013000';
const GB_IBAN = 'GB82WEST12345698765432';

describe('ibanSchema', () => {
  it('accepts a Hungarian IBAN', () => {
    expect(parsedValue(ibanSchema, HU_IBAN)).toBe(HU_IBAN);
  });

  it('accepts a German and a British IBAN', () => {
    expect(ibanSchema.safeParse(DE_IBAN).success).toBe(true);
    expect(ibanSchema.safeParse(GB_IBAN).success).toBe(true);
  });

  it('accepts the grouped, spacy form and returns the canonical one', () => {
    expect(parsedValue(ibanSchema, 'HU42 1177 3016 1111 1018 0000 0000')).toBe(
      HU_IBAN,
    );
  });

  it('upper-cases a lower-case value', () => {
    expect(parsedValue(ibanSchema, 'hu42117730161111101800000000')).toBe(HU_IBAN);
  });

  it('rejects a wrong check digit with the checksum copy', () => {
    expect(firstMessage(ibanSchema, 'HU42117730161111101800000001')).toBe(
      ENGLISH.IBAN_CHECKSUM,
    );
  });

  it('rejects a value that is too short with the IBAN copy', () => {
    expect(firstMessage(ibanSchema, 'HU42')).toBe(ENGLISH.IBAN);
  });

  it('rejects a value with an illegal character', () => {
    expect(firstMessage(ibanSchema, 'HU42-1177-3016')).toBe(ENGLISH.IBAN);
  });

  it('rejects an empty value', () => {
    expect(firstMessage(ibanSchema, '')).toBe(ENGLISH.IBAN);
  });
});

describe('iban helpers', () => {
  it('strips whitespace and upper-cases', () => {
    expect(normalizeIban(' hu42 1177 ')).toBe('HU421177');
  });

  it('leaves remainder 1 for a valid IBAN', () => {
    expect(computeIbanRemainder(HU_IBAN)).toBe(1);
  });

  it('detects an invalid IBAN through the boolean helper', () => {
    expect(isValidIban(HU_IBAN)).toBe(true);
    expect(isValidIban('HU42117730161111101800000001')).toBe(false);
  });
});
