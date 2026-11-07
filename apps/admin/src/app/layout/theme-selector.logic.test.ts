/**
 * Tests of the pure appearance-selector helpers.
 *
 * Both functions are pure, so there is no router, no provider and no DOM
 * involved: the option mapping and the narrowing are tested directly.
 */

import { THEME_NAMES } from '@callback/ui';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THEME_OPTION,
  THEME_OPTION_AMBIENT,
  THEME_OPTION_AMBIENT_LABEL,
  THEME_OPTION_DARK_LABEL,
  THEME_OPTION_GLASS,
  THEME_OPTION_GLASS_LABEL,
  THEME_OPTION_LIGHT,
  THEME_OPTION_LIGHT_LABEL,
  THEME_SELECTOR_OPTIONS,
} from './layout.const.js';
import { InvalidThemeOptionError } from './theme-selector.errors.js';
import { toThemeOption, toThemeSelectOptions } from './theme-selector.logic.js';

describe('toThemeSelectOptions', () => {
  it('maps every declared appearance to an option with an icon', () => {
    const options = toThemeSelectOptions();

    expect(options).toHaveLength(THEME_SELECTOR_OPTIONS.length);
    expect(options.map((option) => option.value)).toEqual([
      THEME_OPTION_LIGHT,
      DEFAULT_THEME_OPTION,
      THEME_OPTION_AMBIENT,
      THEME_OPTION_GLASS,
    ]);
    expect(options.map((option) => option.label)).toEqual([
      THEME_OPTION_LIGHT_LABEL,
      THEME_OPTION_DARK_LABEL,
      THEME_OPTION_AMBIENT_LABEL,
      THEME_OPTION_GLASS_LABEL,
    ]);
    expect(options.every((option) => option.icon !== undefined)).toBe(true);
  });

  it('offers exactly the appearances the token file implements', () => {
    // The selector and the token file must not drift: a theme without a token
    // block would render as the default, a token block without an option would
    // be unreachable (AIS-167).
    expect(toThemeSelectOptions().map((option) => option.value)).toEqual([
      ...THEME_NAMES,
    ]);
  });

  it('gives every option its own icon element', () => {
    const options = toThemeSelectOptions();

    expect(options[0]?.icon).not.toBe(options[1]?.icon);
  });
});

describe('toThemeOption', () => {
  it.each([
    THEME_OPTION_LIGHT,
    DEFAULT_THEME_OPTION,
    THEME_OPTION_AMBIENT,
    THEME_OPTION_GLASS,
  ])(
    'narrows the declared value "%s"',
    (value) => {
      expect(toThemeOption(value)).toBe(value);
    },
  );

  it('rejects a value outside the union and names it', () => {
    expect(() => toThemeOption('sepia')).toThrow(InvalidThemeOptionError);
    expect(() => toThemeOption('sepia')).toThrow(/"sepia"/);
  });

  it('carries the rejected value on the error instance', () => {
    try {
      toThemeOption('sepia');
      expect.unreachable('the call must throw');
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidThemeOptionError);
      expect((error as InvalidThemeOptionError).value).toBe('sepia');
    }
  });
});
