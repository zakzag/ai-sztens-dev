/**
 * Shared select / radio / combobox option fixtures for the UI kit tests.
 *
 * Tests must never declare their own option arrays (see the testing rules):
 * a single fixture keeps the assertions about labels and values stable.
 */

import type { SelectOption } from '../../src/components/select/select.interface.js';
import type { RadioOption } from '../../src/components/radio-group/radio-group.interface.js';
import type { ComboboxOption } from '../../src/components/combobox/combobox.interface.js';

/** Three plain options, deliberately out of alphabetical order. */
export const FORM_OPTIONS: readonly SelectOption[] = [
  { value: 'owner', label: 'Tulajdonos' },
  { value: 'admin', label: 'Adminisztrátor' },
  { value: 'viewer', label: 'Megtekintő' },
];

/** Same fixture in the radio-group shape (identical structure, own type). */
export const FORM_RADIO_OPTIONS: readonly RadioOption[] = [
  { value: 'owner', label: 'Tulajdonos' },
  { value: 'admin', label: 'Adminisztrátor' },
  { value: 'viewer', label: 'Megtekintő' },
];

/** Combobox fixture, includes a disabled option and an accented label. */
export const FORM_COMBOBOX_OPTIONS: readonly ComboboxOption[] = [
  { value: 'owner', label: 'Tulajdonos' },
  { value: 'admin', label: 'Adminisztrátor', disabled: true },
  { value: 'viewer', label: 'Megtekintő' },
  { value: 'auditor', label: 'Áttekintő' },
];

/** Option list that is empty on purpose (empty-state assertions). */
export const EMPTY_OPTIONS: readonly SelectOption[] = [];
