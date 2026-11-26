/**
 * Icon-bearing radio fixtures for the `RadioGroup` icon tests.
 *
 * The icons are the real `@callback/ui` icons on purpose: the point of these
 * fixtures is that an option icon is a decorative SVG, so a stand-in `<span>`
 * would prove nothing about `aria-hidden` or the accessible name.
 */

import {
  MoonIcon,
  SunIcon,
  SunsetIcon,
} from '../../src/components/icon/icons.js';
import type { RadioOption } from '../../src/components/radio-group/radio-group.interface.js';

/**
 * Three icon options mirroring a theme picker: no descriptions, so the
 * accessible-name assertions stay exact. The third option is disabled.
 */
export const ICON_RADIO_OPTIONS: readonly RadioOption[] = [
  { value: 'light', label: 'Világos', icon: <SunIcon /> },
  { value: 'dark', label: 'Sötét', icon: <MoonIcon /> },
  { value: 'ambient', label: 'Ambient', icon: <SunsetIcon />, disabled: true },
];

/**
 * One icon option that also carries a `description`, for the layout
 * regression: the description must stay a block line under the label and must
 * not become a flex sibling of the icon.
 */
export const ICON_RADIO_OPTIONS_WITH_DESCRIPTION: readonly RadioOption[] = [
  {
    value: 'light',
    label: 'Világos',
    description: 'Nappali, nagy kontrasztú téma',
    icon: <SunIcon />,
  },
];
