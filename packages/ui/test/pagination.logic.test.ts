/**
 * Tests of the pure pager rules.
 *
 * Every branch of the three functions, including the degenerate shapes a real
 * response can carry: an empty result set (`totalPages = 0`), a single page, a
 * page beyond the last one, and both an odd and an even window size.
 */

import { describe, expect, it } from 'vitest';
import type { PaginationMeta } from '../src/components/pagination/pagination.interface.js';
import {
  clampLimit,
  toRangeLabel,
  toVisiblePages,
} from '../src/components/pagination/pagination.logic.js';

/**
 * @param patch - fields to override on a plausible pager block.
 * @returns the base block with the patch applied.
 */
function withMeta(patch: Partial<PaginationMeta> = {}): PaginationMeta {
  return { page: 1, limit: 20, total: 137, totalPages: 7, ...patch };
}

describe('toVisiblePages', () => {
  it('returns no pages for an empty result set', () => {
    expect(toVisiblePages(withMeta({ total: 0, totalPages: 0 }))).toEqual([]);
  });

  it('returns the single page of a one-page result set', () => {
    expect(toVisiblePages(withMeta({ totalPages: 1 }))).toEqual([1]);
  });

  it('returns every page when they fit in the window', () => {
    expect(toVisiblePages(withMeta({ totalPages: 3 }))).toEqual([1, 2, 3]);
  });

  it('starts the window at the first page', () => {
    expect(toVisiblePages(withMeta({ page: 1, totalPages: 10 }))).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ]);
  });

  it('keeps the current page inside the window', () => {
    expect(toVisiblePages(withMeta({ page: 5, totalPages: 10 }))).toEqual([
      2, 3, 4, 5, 6, 7, 8,
    ]);
  });

  it('centres the window once it no longer touches an edge', () => {
    expect(toVisiblePages(withMeta({ page: 8, totalPages: 10 }))).toEqual([
      4, 5, 6, 7, 8, 9, 10,
    ]);
  });

  it('ends the window at the last page', () => {
    expect(toVisiblePages(withMeta({ page: 10, totalPages: 10 }))).toEqual([
      4, 5, 6, 7, 8, 9, 10,
    ]);
  });

  it('keeps an even window length intact', () => {
    expect(
      toVisiblePages(withMeta({ page: 5, totalPages: 10 }), 6),
    ).toHaveLength(6);
  });

  it('never returns fewer than one page for a positive window size', () => {
    expect(toVisiblePages(withMeta({ totalPages: 10 }), 0)).toEqual([1]);
  });

  it('clamps a page beyond the last one', () => {
    expect(toVisiblePages(withMeta({ page: 99, totalPages: 10 }))).toEqual([
      4, 5, 6, 7, 8, 9, 10,
    ]);
  });
});

describe('toRangeLabel', () => {
  it('labels the first page', () => {
    expect(toRangeLabel(withMeta())).toBe('1–20 / 137');
  });

  it('labels a middle page', () => {
    expect(toRangeLabel(withMeta({ page: 2 }))).toBe('21–40 / 137');
  });

  it('stops the range at the total on the last page', () => {
    expect(toRangeLabel(withMeta({ page: 7 }))).toBe('121–137 / 137');
  });

  it('labels an empty result set without inventing a range', () => {
    expect(toRangeLabel(withMeta({ total: 0, totalPages: 0 }))).toBe('0 / 0');
  });
});

describe('clampLimit', () => {
  const options = [20, 50, 100] as const;

  it('keeps a limit that is one of the options', () => {
    expect(clampLimit(50, options)).toBe(50);
  });

  it('maps an unknown limit onto the nearest option', () => {
    expect(clampLimit(45, options)).toBe(50);
    expect(clampLimit(30, options)).toBe(20);
  });

  it('returns the limit unchanged when there are no options', () => {
    expect(clampLimit(30, [])).toBe(30);
  });
});
