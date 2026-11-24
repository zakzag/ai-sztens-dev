import { describe, expect, it } from 'vitest';
import { parseAllowedValue } from './use-tab-param.logic.js';

/** The `?step=` allow-list, as the wizard declares it. */
const ALLOWED = ['1', '2', '3', '4'] as const;

describe('parseAllowedValue', () => {
  it('accepts a value the set contains', () => {
    expect(parseAllowedValue('3', ALLOWED, '1')).toBe('3');
  });

  it('falls back when the parameter is missing', () => {
    expect(parseAllowedValue(null, ALLOWED, '1')).toBe('1');
  });

  it('falls back for a value outside the set instead of throwing', () => {
    // A hand-edited or stale link must still render, not blow up the page.
    expect(parseAllowedValue('9', ALLOWED, '1')).toBe('1');
  });

  it('treats an empty string as invalid', () => {
    expect(parseAllowedValue('', ALLOWED, '1')).toBe('1');
  });

  it('keeps the caller’s fallback, not the first allowed value', () => {
    expect(parseAllowedValue('nope', ALLOWED, '4')).toBe('4');
  });
});
