import {
  ALLOWED_URL_PROTOCOLS,
  URL_MAX_LENGTH,
  VALIDATION_MESSAGE_CATALOGUE,
  urlSchema,
} from '../src/index.js';
import { firstMessage } from './lib/validation.helper.js';

/**
 * Unit tests of `urlSchema` (AIS-112).
 *
 * Two groups: shape (is it a URL at all) and protocol (may a link use it).
 * The second group is a security rule — `javascript:` and `data:` URLs parse
 * perfectly well, and they must never reach an `href`.
 */

const ENGLISH = VALIDATION_MESSAGE_CATALOGUE.en;

describe('urlSchema', () => {
  it('allows https and http only', () => {
    expect(ALLOWED_URL_PROTOCOLS).toEqual(['https://', 'http://']);
  });

  it('accepts an https URL', () => {
    expect(urlSchema.safeParse('https://pelda.hu').success).toBe(true);
  });

  it('accepts an http URL with a path', () => {
    expect(urlSchema.safeParse('http://pelda.hu/ut?x=1').success).toBe(true);
  });

  it('trims surrounding whitespace', () => {
    expect(urlSchema.safeParse('  https://pelda.hu ').success).toBe(true);
  });

  it('rejects a value without a protocol', () => {
    expect(firstMessage(urlSchema, 'pelda.hu')).toBe(ENGLISH.URL);
  });

  it('rejects a javascript: URL', () => {
    expect(firstMessage(urlSchema, 'javascript:alert(1)')).toBe(ENGLISH.URL);
  });

  it('rejects a data: URL', () => {
    expect(firstMessage(urlSchema, 'data:text/html,<h1>x</h1>')).toBe(
      ENGLISH.URL,
    );
  });

  it('rejects an ftp: URL', () => {
    expect(firstMessage(urlSchema, 'ftp://pelda.hu/file')).toBe(ENGLISH.URL);
  });

  it('rejects an empty value', () => {
    expect(urlSchema.safeParse('').success).toBe(false);
  });

  it('rejects a value over the length limit', () => {
    const tooLong = `https://pelda.hu/${'a'.repeat(URL_MAX_LENGTH)}`;

    expect(urlSchema.safeParse(tooLong).success).toBe(false);
  });
});
