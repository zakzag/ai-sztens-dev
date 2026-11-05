import {
  clampActiveIndex,
  filterOptions,
  nextActiveIndex,
  normalizeQuery,
  toComboboxOptionId,
} from '../src/components/combobox/combobox.logic.js';
import { describe, expect, it } from 'vitest';
import { FORM_COMBOBOX_OPTIONS } from './mocks/form-options.mock.js';

describe('combobox logic', () => {
  describe('normalizeQuery', () => {
    it('lowercases and strips accents', () => {
      expect(normalizeQuery('Áttekintő')).toBe('attekinto');
    });

    it('trims surrounding whitespace', () => {
      expect(normalizeQuery('  owner  ')).toBe('owner');
    });

    it('returns an empty string for an empty query', () => {
      expect(normalizeQuery('')).toBe('');
    });
  });

  describe('filterOptions', () => {
    it('returns every option for an empty query', () => {
      expect(filterOptions(FORM_COMBOBOX_OPTIONS, '')).toHaveLength(
        FORM_COMBOBOX_OPTIONS.length,
      );
    });

    it('returns a copy, never the caller array', () => {
      expect(filterOptions(FORM_COMBOBOX_OPTIONS, '')).not.toBe(
        FORM_COMBOBOX_OPTIONS,
      );
    });

    it('matches case-insensitively', () => {
      expect(filterOptions(FORM_COMBOBOX_OPTIONS, 'TULAJD')).toHaveLength(1);
    });

    it('matches without accents', () => {
      expect(filterOptions(FORM_COMBOBOX_OPTIONS, 'attekinto')).toHaveLength(1);
    });

    it('keeps disabled options visible', () => {
      expect(
        filterOptions(FORM_COMBOBOX_OPTIONS, 'adminisztrator'),
      ).toHaveLength(1);
    });

    it('returns an empty list when nothing matches', () => {
      expect(filterOptions(FORM_COMBOBOX_OPTIONS, 'zzz')).toEqual([]);
    });
  });

  describe('clampActiveIndex', () => {
    it('returns -1 for an empty list', () => {
      expect(clampActiveIndex(0, 0)).toBe(-1);
    });

    it('clamps a negative index to the first option', () => {
      expect(clampActiveIndex(-5, 3)).toBe(0);
    });

    it('clamps an oversized index to the last option', () => {
      expect(clampActiveIndex(9, 3)).toBe(2);
    });

    it('keeps an in-range index', () => {
      expect(clampActiveIndex(1, 3)).toBe(1);
    });
  });

  describe('nextActiveIndex', () => {
    it('returns -1 for an empty list', () => {
      expect(nextActiveIndex(-1, 1, 0)).toBe(-1);
    });

    it('starts at the first option when nothing is active and the key goes down', () => {
      expect(nextActiveIndex(-1, 1, 3)).toBe(0);
    });

    it('starts at the last option when nothing is active and the key goes up', () => {
      expect(nextActiveIndex(-1, -1, 3)).toBe(2);
    });

    it('wraps forward from the last option', () => {
      expect(nextActiveIndex(2, 1, 3)).toBe(0);
    });

    it('wraps backward from the first option', () => {
      expect(nextActiveIndex(0, -1, 3)).toBe(2);
    });

    it('moves one step inside the list', () => {
      expect(nextActiveIndex(1, 1, 3)).toBe(2);
    });
  });

  describe('toComboboxOptionId', () => {
    it('builds a stable option id', () => {
      expect(toComboboxOptionId('role-listbox', 2)).toBe(
        'role-listbox-option-2',
      );
    });
  });
});
