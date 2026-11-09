import type { BreadcrumbItem } from '../../src/components/breadcrumb/breadcrumb.interface.js';

/**
 * A one-crumb trail: only the current page, no link.
 */
export const BREADCRUMB_SINGLE_ITEM: readonly BreadcrumbItem[] = [
  { label: 'Áttekintés' },
];

/**
 * A three-crumb trail where every non-last crumb has a target.
 *
 * The labels are distinct and free of separators, so the accessible name of the
 * `<nav>` can be asserted without ambiguity.
 */
export const BREADCRUMB_THREE_ITEMS: readonly BreadcrumbItem[] = [
  { label: 'Kezdőlap', to: '/' },
  { label: 'API kulcsok', to: '/api-keys' },
  { label: 'Szerkesztés' },
];

/**
 * A trail whose middle crumb has **no** `to`: it must render as text, not as a
 * dead link, while its neighbours stay links.
 */
export const BREADCRUMB_MIDDLE_WITHOUT_TO: readonly BreadcrumbItem[] = [
  { label: 'Kezdőlap', to: '/' },
  { label: 'Beállítások' },
  { label: 'Profil' },
];
