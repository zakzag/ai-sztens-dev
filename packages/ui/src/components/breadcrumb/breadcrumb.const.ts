/**
 * Constants of {@link Breadcrumb}.
 *
 * Copy and the four class recipes live here so the component stays markup and
 * the tests assert against the same literals the UI renders. Every recipe is
 * built from `theme.css` tokens — no palette utility, no colour literal.
 */

/** Accessible name of the breadcrumb `<nav>`. */
export const BREADCRUMB_DEFAULT_ARIA_LABEL = 'Útvonal';

/** The `<ol>`: horizontal trail that wraps instead of overflowing. */
export const BREADCRUMB_LIST_CLASSES =
  'flex flex-wrap items-center gap-2 text-sm';

/** A crumb that leads somewhere — link affordance, muted until hovered. */
export const BREADCRUMB_LINK_CLASSES =
  'rounded-control text-text-secondary transition-colors duration-fast hover:text-text-primary focus-visible:outline-none focus-visible:shadow-focus-ring';

/** A crumb that leads nowhere (no `to`): readable, not interactive. */
export const BREADCRUMB_STATIC_CLASSES = 'text-text-secondary';

/** The last crumb: the current page, emphasised and not interactive. */
export const BREADCRUMB_CURRENT_CLASSES = 'text-text-primary';

/**
 * Separator cell. Only the colour is set here — the chevron icon already
 * carries its own size (`ICON_BASE_CLASS`) and `aria-hidden`.
 */
export const BREADCRUMB_SEPARATOR_CLASSES = 'text-text-muted';
