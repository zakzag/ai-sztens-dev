import { describe, expect, it } from 'vitest';
import { applyTabWrite, parseAllowedValue } from './use-tab-param.logic.js';

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

describe('applyTabWrite', () => {
  it('sets the parameter and keeps the foreign ones', () => {
    const next = applyTabWrite(new URLSearchParams('tab=overview&q=x'), {
      paramName: 'tab',
      value: 'activity',
      fallback: 'overview',
    });

    expect(next.get('tab')).toBe('activity');
    expect(next.get('q')).toBe('x');
  });

  it('removes the parameter when the fallback is written', () => {
    const next = applyTabWrite(new URLSearchParams('tab=audit'), {
      paramName: 'tab',
      value: 'overview',
      fallback: 'overview',
    });

    expect(next.toString()).toBe('');
  });

  it('clears the named params in the same write', () => {
    const next = applyTabWrite(
      new URLSearchParams('tab=activity&page=3&limit=50'),
      {
        paramName: 'tab',
        value: 'audit',
        fallback: 'overview',
        clearParams: ['page', 'limit', 'order'],
      },
    );

    expect(next.get('tab')).toBe('audit');
    expect(next.get('page')).toBeNull();
    expect(next.get('limit')).toBeNull();
  });

  it('does not touch a param it was not asked to clear', () => {
    const next = applyTabWrite(new URLSearchParams('page=3'), {
      paramName: 'tab',
      value: 'audit',
      fallback: 'overview',
      clearParams: ['limit'],
    });

    expect(next.get('page')).toBe('3');
  });

  it('does not mutate the current search params', () => {
    const current = new URLSearchParams('tab=activity&page=2');

    applyTabWrite(current, {
      paramName: 'tab',
      value: 'audit',
      fallback: 'overview',
      clearParams: ['page'],
    });

    expect(current.toString()).toBe('tab=activity&page=2');
  });
});
