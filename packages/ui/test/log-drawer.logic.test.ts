import { describe, expect, it } from 'vitest';
import {
  LOG_DRAWER_WIDTH_CSS_VAR,
  LOG_DRAWER_WIDTH_DEFAULT,
  LOG_DRAWER_WIDTH_MAX,
  LOG_DRAWER_WIDTH_MIN,
  LOG_DRAWER_WIDTH_STEP,
  LOG_DRAWER_WIDTH_STEP_LARGE,
} from '../src/components/log-drawer/log-drawer.const.js';
import {
  clampDrawerWidth,
  toWidthFromDrag,
  toWidthFromKey,
  toWidthStyle,
} from '../src/components/log-drawer/log-drawer.logic.js';
import type { LogDrawerSizeRange } from '../src/components/log-drawer/log-drawer.interface.js';

/** The production range, so the tests assert the shipped numbers. */
const RANGE: LogDrawerSizeRange = {
  min: LOG_DRAWER_WIDTH_MIN,
  max: LOG_DRAWER_WIDTH_MAX,
  initial: LOG_DRAWER_WIDTH_DEFAULT,
};

describe('clampDrawerWidth', () => {
  it('keeps a value inside the range untouched', () => {
    expect(clampDrawerWidth(500, RANGE)).toBe(500);
  });

  it('raises a value below the minimum to the minimum', () => {
    expect(clampDrawerWidth(120, RANGE)).toBe(LOG_DRAWER_WIDTH_MIN);
    expect(clampDrawerWidth(-40, RANGE)).toBe(LOG_DRAWER_WIDTH_MIN);
  });

  it('lowers a value above the maximum to the maximum', () => {
    expect(clampDrawerWidth(1_600, RANGE)).toBe(LOG_DRAWER_WIDTH_MAX);
  });

  it('keeps the exact bounds', () => {
    expect(clampDrawerWidth(LOG_DRAWER_WIDTH_MIN, RANGE)).toBe(
      LOG_DRAWER_WIDTH_MIN,
    );
    expect(clampDrawerWidth(LOG_DRAWER_WIDTH_MAX, RANGE)).toBe(
      LOG_DRAWER_WIDTH_MAX,
    );
  });

  it('falls back to the initial width for NaN', () => {
    expect(clampDrawerWidth(Number.NaN, RANGE)).toBe(LOG_DRAWER_WIDTH_DEFAULT);
  });

  it('falls back to the initial width for both infinities', () => {
    expect(clampDrawerWidth(Number.POSITIVE_INFINITY, RANGE)).toBe(
      LOG_DRAWER_WIDTH_DEFAULT,
    );
    expect(clampDrawerWidth(Number.NEGATIVE_INFINITY, RANGE)).toBe(
      LOG_DRAWER_WIDTH_DEFAULT,
    );
  });

  it('clamps the fallback itself into a range that excludes it', () => {
    const shifted: LogDrawerSizeRange = { min: 500, max: 900, initial: 400 };

    expect(clampDrawerWidth(Number.NaN, shifted)).toBe(500);
  });
});

describe('toWidthFromDrag', () => {
  const start = LOG_DRAWER_WIDTH_DEFAULT;

  it('keeps the start width while the pointer does not travel', () => {
    expect(toWidthFromDrag(600, 600, start, RANGE)).toBe(start);
  });

  it('widens the panel when the pointer travels left', () => {
    expect(toWidthFromDrag(600, 550, start, RANGE)).toBe(start + 50);
  });

  it('narrows the panel when the pointer travels right', () => {
    expect(toWidthFromDrag(600, 650, start, RANGE)).toBe(start - 50);
  });

  it('ignores the absolute pointer position', () => {
    expect(toWidthFromDrag(120, 100, start, RANGE)).toBe(
      toWidthFromDrag(1_020, 1_000, start, RANGE),
    );
  });

  it('clamps a long drag to the maximum', () => {
    expect(toWidthFromDrag(600, -400, start, RANGE)).toBe(LOG_DRAWER_WIDTH_MAX);
  });

  it('clamps a long drag to the minimum', () => {
    expect(toWidthFromDrag(600, 4_000, start, RANGE)).toBe(LOG_DRAWER_WIDTH_MIN);
  });

  it('falls back to the initial width for a non-finite coordinate', () => {
    expect(toWidthFromDrag(600, Number.NaN, start, RANGE)).toBe(
      LOG_DRAWER_WIDTH_DEFAULT,
    );
    expect(toWidthFromDrag(Number.POSITIVE_INFINITY, 600, start, RANGE)).toBe(
      LOG_DRAWER_WIDTH_DEFAULT,
    );
  });
});

describe('toWidthFromKey', () => {
  const current = LOG_DRAWER_WIDTH_DEFAULT;

  it('widens the panel with ArrowLeft by one step', () => {
    expect(toWidthFromKey('ArrowLeft', current, RANGE)).toBe(
      current + LOG_DRAWER_WIDTH_STEP,
    );
  });

  it('narrows the panel with ArrowRight by one step', () => {
    expect(toWidthFromKey('ArrowRight', current, RANGE)).toBe(
      current - LOG_DRAWER_WIDTH_STEP,
    );
  });

  it('uses the large step while Shift is held', () => {
    expect(toWidthFromKey('ArrowLeft', current, RANGE, true)).toBe(
      current + LOG_DRAWER_WIDTH_STEP_LARGE,
    );
    expect(toWidthFromKey('ArrowRight', current, RANGE, true)).toBe(
      current - LOG_DRAWER_WIDTH_STEP_LARGE,
    );
  });

  it('jumps to the bounds with Home and End', () => {
    expect(toWidthFromKey('Home', current, RANGE)).toBe(LOG_DRAWER_WIDTH_MIN);
    expect(toWidthFromKey('End', current, RANGE)).toBe(LOG_DRAWER_WIDTH_MAX);
  });

  it('leaves the width unchanged for an unrelated key', () => {
    expect(toWidthFromKey('a', current, RANGE)).toBe(current);
    expect(toWidthFromKey('Enter', current, RANGE)).toBe(current);
  });

  it('never overshoots a bound', () => {
    expect(toWidthFromKey('ArrowLeft', LOG_DRAWER_WIDTH_MAX, RANGE, true)).toBe(
      LOG_DRAWER_WIDTH_MAX,
    );
    expect(toWidthFromKey('ArrowRight', LOG_DRAWER_WIDTH_MIN, RANGE, true)).toBe(
      LOG_DRAWER_WIDTH_MIN,
    );
  });
});

describe('toWidthStyle', () => {
  it('publishes the width as the shared custom property', () => {
    expect(toWidthStyle(480)).toEqual({ [LOG_DRAWER_WIDTH_CSS_VAR]: '480px' });
  });

  it('produces exactly one property', () => {
    expect(Object.keys(toWidthStyle(LOG_DRAWER_WIDTH_DEFAULT))).toHaveLength(1);
  });
});
