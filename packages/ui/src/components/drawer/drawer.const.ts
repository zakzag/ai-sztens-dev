import type { DrawerSide } from './drawer.variants.js';

/** Edge the panel slides in from when the caller passes no `side`. */
export const DRAWER_DEFAULT_SIDE: DrawerSide = 'right';

/** The body is the scroll container: a long form must not push the footer away. */
export const DRAWER_BODY_CLASS = 'flex-1 overflow-y-auto';
