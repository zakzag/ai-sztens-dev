/**
 * Fixtures and harness of the `SelectMenu` primitive tests.
 *
 * The icons are the real `@callback/ui` icons on purpose: the point of the
 * fixture is that an option icon is a decorative SVG and the accessible name
 * stays the label, so a stand-in `<span>` would prove nothing.
 */

import { useState } from 'react';
import { SelectMenu } from '../../src/components/select-menu/SelectMenu.js';
import {
  MoonIcon,
  SunIcon,
  SunsetIcon,
} from '../../src/components/icon/icons.js';
import type { SelectMenuOption } from '../../src/components/select-menu/select-menu.interface.js';

/** Accessible name the fixtures render the control with. */
export const SELECT_MENU_LABEL = 'Megjelenés';

/** Three icon options mirroring the admin appearance selector. */
export const SELECT_MENU_OPTIONS: readonly SelectMenuOption[] = [
  { value: 'light', label: 'Világos', icon: <SunIcon /> },
  { value: 'dark', label: 'Sötét', icon: <MoonIcon /> },
  { value: 'ambient', label: 'Ambient', icon: <SunsetIcon /> },
];

/** The same list with the last option disabled, for the negative branch. */
export const SELECT_MENU_OPTIONS_WITH_DISABLED: readonly SelectMenuOption[] = [
  ...SELECT_MENU_OPTIONS.slice(0, 2),
  { value: 'ambient', label: 'Ambient', icon: <SunsetIcon />, disabled: true },
];

/** Props of {@link SelectMenuHarness}. */
export interface SelectMenuHarnessProps {
  /** Options rendered by the menu. */
  readonly options: readonly SelectMenuOption[];
  /** Value the harness starts with. */
  readonly initialValue: string;
  /** Optional spy forwarded to the real `onValueChange`. */
  readonly onValueChange?: (value: string) => void;
}

/**
 * Stateful wrapper for the controlled `SelectMenu`.
 *
 * The primitive owns no selection state, so a test that wants to observe a real
 * change has to supply it — that harness lives here, not in the test file.
 *
 * @param props - see {@link SelectMenuHarnessProps}.
 */
export function SelectMenuHarness({
  options,
  initialValue,
  onValueChange,
}: SelectMenuHarnessProps) {
  const [value, setValue] = useState(initialValue);

  return (
    <SelectMenu
      label={SELECT_MENU_LABEL}
      options={options}
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onValueChange?.(next);
      }}
    />
  );
}
