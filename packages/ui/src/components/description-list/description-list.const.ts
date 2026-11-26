/**
 * Constants of {@link DescriptionList}.
 *
 * The copy lives here (not in JSX) so a test can assert against the same string
 * the component renders, and so the default empty text can be overridden by the
 * caller without touching the component.
 */

/** How many skeleton rows a loading list shows. */
export const DESCRIPTION_LIST_LOADING_ROWS = 3;

/** Fallback text when the list is empty and the caller supplies no `empty`. */
export const DESCRIPTION_LIST_EMPTY_MESSAGE = 'Nincs megjeleníthető adat.';
