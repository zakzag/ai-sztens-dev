/**
 * Texts of the catch-all page (AIS-171).
 *
 * Moved out of `app/app.const.ts`: the copy belongs to the page, and the `pages`
 * layer may not import the `app` layer (layer gate). The route registry keeps
 * the path (`*`) and the protection flag, nothing user-visible.
 */

/** Title of the catch-all route (unknown URL). */
export const NOT_FOUND_TITLE = 'Nem található';

/** Explanation under the title. */
export const NOT_FOUND_MESSAGE =
  'A keresett oldal nem létezik, vagy már elköltözött.';
