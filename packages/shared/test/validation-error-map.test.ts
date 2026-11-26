import { z } from 'zod';
import {
  VALIDATION_ERROR_MAP,
  VALIDATION_MESSAGE_CATALOGUE,
  configureValidationLocale,
  formatMessage,
  getValidationLocale,
  identifierSchema,
  resetValidationLocale,
} from '../src/index.js';
import { firstMessage } from './lib/validation.helper.js';

/**
 * Unit tests of the bilingual message layer (AIS-112 plan `D2` / `D8`).
 *
 * The guard that matters most is the **first** one: the default locale must be
 * English, because that is the language the API puts into `details[].message`
 * ([`docs/Specs/API-Convention.md`](../../docs/Specs/API-Convention.md:83)).
 * If a future change made `hu` the default, the server would start emitting
 * Hungarian developer text and this suite would fail.
 */

const ENGLISH = VALIDATION_MESSAGE_CATALOGUE.en;
const HUNGARIAN = VALIDATION_MESSAGE_CATALOGUE.hu;

describe('validation locale', () => {
  afterEach(() => {
    resetValidationLocale();
  });

  it('defaults to English, so the API never emits Hungarian text', () => {
    expect(getValidationLocale()).toBe('en');
  });

  it('switches to Hungarian on request and back again', () => {
    configureValidationLocale('hu');
    expect(getValidationLocale()).toBe('hu');

    resetValidationLocale();
    expect(getValidationLocale()).toBe('en');
  });

  it('substitutes the {min} and {max} placeholders', () => {
    expect(formatMessage('Legalább {min} karakter.', { min: 3 })).toBe(
      'Legalább 3 karakter.',
    );
    expect(formatMessage('Legfeljebb {max} karakter.', { max: 12 })).toBe(
      'Legfeljebb 12 karakter.',
    );
  });

  it('leaves a placeholder untouched when the value is missing', () => {
    expect(formatMessage('Legalább {min} karakter.')).toBe(
      'Legalább {min} karakter.',
    );
  });
});

describe('VALIDATION_ERROR_MAP', () => {
  afterEach(() => {
    resetValidationLocale();
  });

  it('translates a missing value to the REQUIRED copy', () => {
    const schema = z.string();

    expect(firstMessage(schema, undefined)).toBe(ENGLISH.REQUIRED);
  });

  it('translates a wrong type to the INVALID_TYPE copy', () => {
    const schema = z.string();

    expect(firstMessage(schema, 42)).toBe(ENGLISH.INVALID_TYPE);
  });

  it('translates a minimum length and interpolates the bound', () => {
    const schema = z.string().min(3);

    expect(firstMessage(schema, 'ab')).toBe(
      formatMessage(ENGLISH.TOO_SHORT_TEMPLATE, { min: 3 }),
    );
  });

  it('translates a maximum length and interpolates the bound', () => {
    const schema = z.string().max(2);

    expect(firstMessage(schema, 'abc')).toBe(
      formatMessage(ENGLISH.TOO_LONG_TEMPLATE, { max: 2 }),
    );
  });

  it('translates an invalid e-mail into the EMAIL copy', () => {
    expect(firstMessage(z.string().email(), 'nope')).toBe(ENGLISH.EMAIL);
  });

  it('translates an invalid URL into the URL copy', () => {
    expect(firstMessage(z.string().url(), 'nope')).toBe(ENGLISH.URL);
  });

  it('falls back to the zod default for an unmapped code', () => {
    const schema = z.union([z.string(), z.number()]);
    const result = schema.safeParse(true, { errorMap: VALIDATION_ERROR_MAP });

    expect(result.success).toBe(false);
    expect(result.success ? null : result.error.issues[0]?.message).toBe(
      'Invalid input',
    );
  });

  it('never overrides a message the schema itself supplied', () => {
    const schema = z.string().regex(/^a$/, 'only a single a');

    expect(firstMessage(schema, 'b')).toBe('only a single a');
  });

  it('renders the schema-supplied copy in Hungarian after the switch', () => {
    configureValidationLocale('hu');

    const schema = identifierSchema({ pattern: /^[a-z-]+$/, max: 10 });

    expect(firstMessage(schema, 'NOT VALID')).toBe(HUNGARIAN.IDENTIFIER);
    expect(HUNGARIAN.IDENTIFIER).not.toBe(ENGLISH.IDENTIFIER);
  });
});
