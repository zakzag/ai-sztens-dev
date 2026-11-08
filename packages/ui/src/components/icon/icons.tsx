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
 * Every icon comes from the same 24×24 stroke grid, so the geometry
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
 * Layers icon — the “Üveg” (glass) theme option.
 *
 * Geometry copied from Lucide `layers` (https://lucide.dev/icons/layers),
 * ISC licence — Copyright (c) Lucide Contributors. Stacked panes read as
 * *translucent planes*, which is what the glass appearance actually changes,
 * whereas a droplet or a sparkle would suggest a colour rather than a material.
 *
 * @param props - see {@link IconProps}.
 */
export function LayersIcon({ className }: IconProps) {
  return (
    <svg {...ICON_BASE_PROPS} className={cn(ICON_BASE_CLASS, className)}>
      <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
      <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
    </svg>
  );
}

/**
 * Snowflake icon — the “Fagyott üveg” (frost) theme option (AIS-169).
 *
 * Geometry copied from Lucide `snowflake` (https://lucide.dev/icons/snowflake),
 * ISC licence — Copyright (c) Lucide Contributors.
 *
 * @param props - see {@link IconProps}.
 */
export function SnowflakeIcon({ className }: IconProps) {
  return (
    <svg {...ICON_BASE_PROPS} className={cn(ICON_BASE_CLASS, className)}>
      <path d="M12 2v20" />
      <path d="m4.93 4.93 14.14 14.14" />
      <path d="m19.07 4.93-14.14 14.14" />
      <path d="M2 12h20" />
      <path d="m9 5 3-3 3 3" />
      <path d="m9 19 3 3 3-3" />
      <path d="m5 9-3 3 3 3" />
      <path d="m19 9 3 3-3 3" />
    </svg>
  );
}

/**
 * Droplet icon — the “Kristályüveg” (crystal) theme option (AIS-169).
 *
 * Geometry copied from Lucide `droplet` (https://lucide.dev/icons/droplet),
 * ISC licence — Copyright (c) Lucide Contributors.
 *
 * @param props - see {@link IconProps}.
 */
export function DropletIcon({ className }: IconProps) {
  return (
    <svg {...ICON_BASE_PROPS} className={cn(ICON_BASE_CLASS, className)}>
      <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />
    </svg>
  );
}

/**
 * Cloud icon — the “Füstüveg” (smoke) theme option (AIS-169).
 *
 * Geometry copied from Lucide `cloud` (https://lucide.dev/icons/cloud),
 * ISC licence — Copyright (c) Lucide Contributors.
 *
 * @param props - see {@link IconProps}.
 */
export function CloudIcon({ className }: IconProps) {
  return (
    <svg {...ICON_BASE_PROPS} className={cn(ICON_BASE_CLASS, className)}>
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
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

/**
 * Plus icon — the "add a new entity" affordance of a list page (AIS-155).
 *
 * Always rendered **inside** a control that carries the accessible name (e.g.
 * `Button` with an `icon` prop), because the glyph itself is decorative.
 *
 * Geometry copied from Lucide `plus` (https://lucide.dev/icons/plus),
 * ISC licence — Copyright (c) Lucide Contributors.
 *
 * @param props - see {@link IconProps}.
 */
export function PlusIcon({ className }: IconProps) {
  return (
    <svg {...ICON_BASE_PROPS} className={cn(ICON_BASE_CLASS, className)}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

/**
 * Close icon — the SVG replacement of the `✕` text glyph in an overlay header
 * (AIS-155).
 *
 * The control that renders it must carry its own accessible name (`aria-label`
 * or a visible label); the icon is decorative and never announced.
 *
 * Geometry copied from Lucide `x` (https://lucide.dev/icons/x),
 * ISC licence — Copyright (c) Lucide Contributors.
 *
 * @param props - see {@link IconProps}.
 */
export function CloseIcon({ className }: IconProps) {
  return (
    <svg {...ICON_BASE_PROPS} className={cn(ICON_BASE_CLASS, className)}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
