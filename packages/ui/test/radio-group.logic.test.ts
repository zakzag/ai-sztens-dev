import { describe, expect, it } from 'vitest';
import {
  nextOptionValue,
  toRadioId,
} from '../src/components/radio-group/radio-group.logic.js';
import { FORM_RADIO_OPTIONS } from './mocks/form-options.mock.js';

describe('radio-group logic', () => {
  it('builds the option id from the group name and the value', () => {
    expect(toRadioId('role', 'owner')).toBe('role-owner');
  });

  it('moves forward to the next enabled option', () => {
    expect(nextOptionValue(FORM_RADIO_OPTIONS, 'owner', 1)).toBe('admin');
  });

  it('wraps forward from the last option to the first', () => {
    expect(nextOptionValue(FORM_RADIO_OPTIONS, 'viewer', 1)).toBe('owner');
  });

  it('wraps backward from the first option to the last', () => {
    expect(nextOptionValue(FORM_RADIO_OPTIONS, 'owner', -1)).toBe('viewer');
  });

  it('selects the first option when nothing is selected and the key goes down', () => {
    expect(nextOptionValue(FORM_RADIO_OPTIONS, '', 1)).toBe('owner');
  });

  it('selects the last option when nothing is selected and the key goes up', () => {
    expect(nextOptionValue(FORM_RADIO_OPTIONS, '', -1)).toBe('viewer');
  });

  it('skips disabled options', () => {
    const options = [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B', disabled: true },
      { value: 'c', label: 'C' },
    ];

    expect(nextOptionValue(options, 'a', 1)).toBe('c');
    expect(nextOptionValue(options, 'c', -1)).toBe('a');
  });

  it('returns null when every option is disabled', () => {
    const options = [{ value: 'a', label: 'A', disabled: true }];

    expect(nextOptionValue(options, 'a', 1)).toBeNull();
  });

  it('returns null for an empty option list', () => {
    expect(nextOptionValue([], '', 1)).toBeNull();
  });

  it('treats a single enabled option as its own neighbour', () => {
    const options = [{ value: 'only', label: 'Egyetlen' }];

    expect(nextOptionValue(options, 'only', 1)).toBe('only');
    expect(nextOptionValue(options, 'only', -1)).toBe('only');
  });
});
