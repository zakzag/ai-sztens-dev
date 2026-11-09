/**
 * Texts of the `/calls` placeholder page (AIS-171).
 *
 * The copy lives in the page folder, not in `app/app.const.ts`: a page may not
 * import the `app` layer (layer gate), and the navigation label it shares with
 * the breadcrumb stays in `app.const.ts` where the router owns it.
 */

/** Page title of `/calls`. */
export const CALLS_PLACEHOLDER_TITLE = 'Hívások';

/** Body line under the title while the feature is missing. */
export const CALLS_PLACEHOLDER_MESSAGE =
  'A hívások listája hamarosan elérhető lesz.';
