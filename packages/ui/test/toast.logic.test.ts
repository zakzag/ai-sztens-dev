import { describe, expect, it } from 'vitest';
import { toToastDepth } from '../src/components/toast/toast.logic.js';

describe('toToastDepth', () => {
  it.each([
    [0, 0],
    [-1, 0],
    [1, 1],
    [2, 2],
    [3, 2],
    [99, 2],
  ] as const)('maps index %i to depth %i', (index, expected) => {
    expect(toToastDepth(index)).toBe(expected);
  });

  it('never returns a value outside the depth union', () => {
    const depths = new Set(
      [-2, 0, 1, 2, 5].map((index) => toToastDepth(index)),
    );

    expect([...depths].sort()).toEqual([0, 1, 2]);
  });
});
