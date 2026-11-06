/**
 * Tests of the pure appearance-selector helpers.
 *
 * Every function is pure, so there is no router, no provider and no DOM
 * involved: the option mapping, the narrowing and the label lookup are tested
 * directly.
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THEME_OPTION,
  THEME_OPTION_AMBIENT,
  THEME_OPTION_AMBIENT_LABEL,
  THEME_OPTION_DARK_LABEL,
  THEME_OPTION_LIGHT,
  THEME_OPTION_LIGHT_LABEL,
  THEME_SELECTOR_OPTIONS,
} from './layout.const.js';
import { InvalidThemeOptionError } from './theme-selector.errors.js';
import {
  toThemeComboboxOptions,
  toThemeLabel,
  toThemeOption,
} from './theme-selector.logic.js';

describe('toThemeComboboxOptions', () => {
  it('maps every declared appearance to a plain value/label option', () => {
    const options = toThemeComboboxOptions();

    expect(options).toHaveLength(THEME_SELECTOR_OPTIONS.length);
    expect(options).toEqual([
      { value: THEME_OPTION_LIGHT, label: THEME_OPTION_LIGHT_LABEL },
      { value: DEFAULT_THEME_OPTION, label: THEME_OPTION_DARK_LABEL },
      { value: THEME_OPTION_AMBIENT, label: THEME_OPTION_AMBIENT_LABEL },
    ]);
  });

  it('carries no extra key a listbox option cannot render', () => {
    const options = toThemeComboboxOptions();

    expect(options.every((option) => Object.keys(option).length === 2)).toBe(
      true,
    );
  });
});

describe('toThemeOption', () => {
  it.each([THEME_OPTION_LIGHT, DEFAULT_THEME_OPTION, THEME_OPTION_AMBIENT])(
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

describe('toThemeLabel', () => {
  it.each([
    [THEME_OPTION_LIGHT, THEME_OPTION_LIGHT_LABEL],
    [DEFAULT_THEME_OPTION, THEME_OPTION_DARK_LABEL],
    [THEME_OPTION_AMBIENT, THEME_OPTION_AMBIENT_LABEL],
  ] as const)('reads the label of "%s"', (value, label) => {
    expect(toThemeLabel(value)).toBe(label);
  });
});
