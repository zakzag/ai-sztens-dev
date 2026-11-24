/**
 * Tests of the URL-owned tab/step reader (AIS-19).
 *
 * The hook is mounted in a memory router and asserted through the URL it
 * writes, because “one user action = one URL write” is the whole guarantee.
 */

import { act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderHookWithRouter } from '../../test/mocks/app-router.mock.js';
import { useTabParam } from './use-tab-param.js';

const ALLOWED = ['1', '2', '3', '4'] as const;

describe('useTabParam', () => {
  it('reads the value from the URL', () => {
    const { result } = renderHookWithRouter(
      () =>
        useTabParam({ paramName: 'step', allowed: ALLOWED, fallback: '1' }),
      { initialEntries: ['/customers/new?step=3'] },
    );

    expect(result.current.value).toBe('3');
  });

  it('falls back to the default when the parameter is absent', () => {
    const { result } = renderHookWithRouter(
      () =>
        useTabParam({ paramName: 'step', allowed: ALLOWED, fallback: '1' }),
      { initialEntries: ['/customers/new'] },
    );

    expect(result.current.value).toBe('1');
  });

  it('falls back to the default when the parameter is invalid', () => {
    const { result } = renderHookWithRouter(
      () =>
        useTabParam({ paramName: 'step', allowed: ALLOWED, fallback: '1' }),
      { initialEntries: ['/customers/new?step=7'] },
    );

    expect(result.current.value).toBe('1');
  });

  it('writes the value to the URL', () => {
    const { result, getSearch } = renderHookWithRouter(
      () =>
        useTabParam({ paramName: 'step', allowed: ALLOWED, fallback: '1' }),
      { initialEntries: ['/customers/new'] },
    );

    act(() => {
      result.current.setValue('2');
    });

    expect(getSearch()).toContain('step=2');
  });

  it('removes the parameter when the fallback is written', () => {
    const { result, getSearch } = renderHookWithRouter(
      () =>
        useTabParam({ paramName: 'step', allowed: ALLOWED, fallback: '1' }),
      { initialEntries: ['/customers/new?step=3'] },
    );

    act(() => {
      result.current.setValue('1');
    });

    expect(getSearch()).not.toContain('step');
  });

  it('preserves the other parameters of the page', () => {
    const { result, getSearch } = renderHookWithRouter(
      () =>
        useTabParam({ paramName: 'step', allowed: ALLOWED, fallback: '1' }),
      { initialEntries: ['/customers/new?q=pelda'] },
    );

    act(() => {
      result.current.setValue('4');
    });

    expect(getSearch()).toContain('q=pelda');
    expect(getSearch()).toContain('step=4');
  });
});
