import { describe, expect, it } from 'vitest';
import { cn } from '../src/lib/cn.js';

describe('cn', () => {
  it('joins plain class names', () => {
    expect(cn('p-2', 'text-sm')).toBe('p-2 text-sm');
  });

  it('drops falsy values', () => {
    expect(cn('p-2', false, undefined, null, '')).toBe('p-2');
  });

  it('resolves conflicting Tailwind utilities in favour of the last one', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('accepts conditional object syntax', () => {
    expect(cn({ 'opacity-60': true, 'opacity-100': false })).toBe('opacity-60');
  });

  it('flattens nested arrays', () => {
    expect(cn(['p-2', ['text-sm']])).toBe('p-2 text-sm');
  });
});
