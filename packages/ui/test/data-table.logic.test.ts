/**
 * Tests of the pure data-table rules.
 *
 * Sorting is a value transformation here (decision D2): the table reports the
 * requested order and never re-orders the rows it was given.
 */

import { describe, expect, it } from 'vitest';
import {
  toAriaSort,
  toNextSort,
} from '../src/components/data-table/data-table.logic.js';

describe('toAriaSort', () => {
  it('reports no sort for an unsorted list', () => {
    expect(toAriaSort('name', null)).toBe('none');
  });

  it('reports no sort for a column that is not the sorted one', () => {
    expect(toAriaSort('name', { columnId: 'identifier', order: 'asc' })).toBe(
      'none',
    );
  });

  it('reports ascending for the sorted column', () => {
    expect(toAriaSort('name', { columnId: 'name', order: 'asc' })).toBe(
      'ascending',
    );
  });

  it('reports descending for the sorted column', () => {
    expect(toAriaSort('name', { columnId: 'name', order: 'desc' })).toBe(
      'descending',
    );
  });
});

describe('toNextSort', () => {
  it('starts a new column ascending', () => {
    expect(toNextSort('name', null)).toEqual({ columnId: 'name', order: 'asc' });
  });

  it('starts another column ascending instead of carrying the direction over', () => {
    expect(
      toNextSort('name', { columnId: 'identifier', order: 'desc' }),
    ).toEqual({ columnId: 'name', order: 'asc' });
  });

  it('flips ascending to descending on the sorted column', () => {
    expect(toNextSort('name', { columnId: 'name', order: 'asc' })).toEqual({
      columnId: 'name',
      order: 'desc',
    });
  });

  it('flips descending back to ascending', () => {
    expect(toNextSort('name', { columnId: 'name', order: 'desc' })).toEqual({
      columnId: 'name',
      order: 'asc',
    });
  });
});
