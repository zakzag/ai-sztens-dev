import { cn } from '../../lib/cn.js';
import {
  ICON_BASE_CLASS,
  ICON_STROKE_WIDTH,
  ICON_VIEW_BOX,
} from './icon.const.js';
import type { IconProps } from './icon.interface.js';

/**
 * Attributes every icon shares.
 *
 * All five icons come from the same 24×24 stroke grid, so the geometry
 * attributes are declared once here instead of being retyped per icon — a new
 * icon cannot drift on the stroke width or the fill.
 *
 * `aria-hidden` + `focusable="false"` make the icon decorative: it never enters
 * the accessibility tree and never takes focus, so the accessible name of the
 * surrounding control stays the visible text.
 */
const ICON_BASE_PROPS = {
  viewBox: ICON_VIEW_BOX,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: ICON_STROKE_WIDTH,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  focusable: 'false',
  'aria-hidden': 'true',
} as const;

/**
 * Sun icon — the “Light” theme option.
 *
 * Geometry copied from Lucide `sun` (https://lucide.dev/icons/sun),
 * ISC licence — Copyright (c) Lucide Contributors.
 *
 * @param props - see {@link IconProps}.
 */
export function SunIcon({ className }: IconProps) {
  return (
    <svg {...ICON_BASE_PROPS} className={cn(ICON_BASE_CLASS, className)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

/**
 * Moon icon — the “Dark” theme option.
 *
 * Geometry copied from Lucide `moon` (https://lucide.dev/icons/moon),
 * ISC licence — Copyright (c) Lucide Contributors.
 *
 * @param props - see {@link IconProps}.
 */
export function MoonIcon({ className }: IconProps) {
  return (
    <svg {...ICON_BASE_PROPS} className={cn(ICON_BASE_CLASS, className)}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

/**
 * Sunset icon — the “Ambient” theme option.
 *
 * Geometry copied from Lucide `sunset` (https://lucide.dev/icons/sunset),
 * ISC licence — Copyright (c) Lucide Contributors.
 *
 * @param props - see {@link IconProps}.
 */
export function SunsetIcon({ className }: IconProps) {
  return (
    <svg {...ICON_BASE_PROPS} className={cn(ICON_BASE_CLASS, className)}>
      <path d="M12 10V2" />
      <path d="m4.93 10.93 1.41 1.41" />
      <path d="M2 18h2" />
      <path d="M20 18h2" />
      <path d="m19.07 10.93-1.41 1.41" />
      <path d="M22 22H2" />
      <path d="m16 6-4 4-4-4" />
      <path d="M16 18a4 4 0 0 0-8 0" />
    </svg>
  );
}

/**
 * Gear icon — the user-settings trigger of the admin header.
 *
 * Geometry copied from Lucide `settings` (https://lucide.dev/icons/settings),
 * ISC licence — Copyright (c) Lucide Contributors.
 *
 * @param props - see {@link IconProps}.
 */
export function SettingsIcon({ className }: IconProps) {
  return (
    <svg {...ICON_BASE_PROPS} className={cn(ICON_BASE_CLASS, className)}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/**
 * Chevron icon — the breadcrumb separator of the admin header.
 *
 * Geometry copied from Lucide `chevron-right`
 * (https://lucide.dev/icons/chevron-right),
 * ISC licence — Copyright (c) Lucide Contributors.
 *
 * @param props - see {@link IconProps}.
 */
export function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg {...ICON_BASE_PROPS} className={cn(ICON_BASE_CLASS, className)}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

/**
 * Chevron-down icon — the "opens below" affordance of the select trigger.
 *
 * Geometry copied from Lucide `chevron-down`
 * (https://lucide.dev/icons/chevron-down),
 * ISC licence — Copyright (c) Lucide Contributors.
 *
 * @param props - see {@link IconProps}.
 */
export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg {...ICON_BASE_PROPS} className={cn(ICON_BASE_CLASS, className)}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
