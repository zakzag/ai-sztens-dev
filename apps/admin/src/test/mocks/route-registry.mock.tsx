import type { RouteEntry } from '../../app/router/route-entry.interface.js';

/**
 * A minimal route registry for the component tests.
 *
 * The real registry is the application's route table; the components take it
 * as a prop precisely so a test can replace it with this three-entry stub
 * instead of rendering the whole application.
 */

/** Path of the stub landing route. */
export const MOCK_HOME_PATH = '/';

/** Path of the stub second route. */
export const MOCK_DETAIL_PATH = '/detail';

/** Path of the stub hidden route. */
export const MOCK_HIDDEN_PATH = '/hidden';

/** Label of the stub landing route. */
export const MOCK_HOME_LABEL = 'Kezdőlap';

/** Label of the stub second route. */
export const MOCK_DETAIL_LABEL = 'Részletek';

/** A route with a label — it appears in the navigation. */
export const MOCK_VISIBLE_ROUTE: RouteEntry = {
  path: MOCK_HOME_PATH,
  navLabel: MOCK_HOME_LABEL,
  element: <p>mock home</p>,
  protected: true,
};

/** A second visible route — it also appears in the navigation. */
export const MOCK_SECOND_VISIBLE_ROUTE: RouteEntry = {
  path: MOCK_DETAIL_PATH,
  navLabel: MOCK_DETAIL_LABEL,
  element: <p>mock detail</p>,
  protected: true,
};

/** A route without a label — it must not appear in the navigation. */
export const MOCK_UNLABELLED_ROUTE: RouteEntry = {
  path: '/unlabelled',
  navLabel: null,
  element: <p>mock unlabelled</p>,
  protected: true,
};

/** A route that has a label but is explicitly hidden from the navigation. */
export const MOCK_HIDDEN_ROUTE: RouteEntry = {
  path: MOCK_HIDDEN_PATH,
  navLabel: 'Rejtett',
  element: <p>mock hidden</p>,
  protected: true,
  hidden: true,
};

/** The stub registry used by the layout, nav and router tests. */
export const MOCK_ROUTE_ENTRIES: readonly RouteEntry[] = [
  MOCK_VISIBLE_ROUTE,
  MOCK_SECOND_VISIBLE_ROUTE,
  MOCK_UNLABELLED_ROUTE,
  MOCK_HIDDEN_ROUTE,
];
