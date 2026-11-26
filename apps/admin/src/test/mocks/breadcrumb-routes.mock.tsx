import type { RouteEntry } from '../../app/router/route-entry.interface.js';

/**
 * Route fixtures for the breadcrumb logic tests (AIS-146).
 *
 * Every branch of {@link toBreadcrumbItems} has its own entry here: a static
 * root, a static child, a dynamic child with a resolver, a parent that is
 * skipped but still continues the chain, an orphan parent pointer, a
 * two-entry cycle, and a dynamic entry that carries only a static label.
 */

/** Path of the fixture root. */
export const MOCK_CRUMB_ROOT_PATH = '/';

/** Path of the fixture list page. */
export const MOCK_CRUMB_LIST_PATH = '/api-keys';

/** Template of the fixture detail page. */
export const MOCK_CRUMB_DETAIL_PATH = '/api-keys/:identifier';

/** Path of the fixture page that is skipped from the trail. */
export const MOCK_CRUMB_PLAIN_PATH = '/plain';

/** Template of the fixture page under the skipped one. */
export const MOCK_CRUMB_PLAIN_DETAIL_PATH = '/plain/:id';

/** Path of the fixture route whose parent does not exist. */
export const MOCK_CRUMB_ORPHAN_PATH = '/orphan';

/** First path of the fixture cycle. */
export const MOCK_CRUMB_CYCLE_A_PATH = '/cycle-a';

/** Second path of the fixture cycle. */
export const MOCK_CRUMB_CYCLE_B_PATH = '/cycle-b';

/** Template of the fixture dynamic route that has no resolver. */
export const MOCK_CRUMB_STATIC_LABEL_DETAIL_PATH = '/labelled/:id';

/** Label of the fixture root. */
export const MOCK_CRUMB_ROOT_LABEL = 'Kezdőlap';

/** Label of the fixture list page. */
export const MOCK_CRUMB_LIST_LABEL = 'API kulcsok';

/** Label of the fixture orphan route. */
export const MOCK_CRUMB_ORPHAN_LABEL = 'Árva';

/** Label of the first cycle entry. */
export const MOCK_CRUMB_CYCLE_A_LABEL = 'Ciklus A';

/** Label of the second cycle entry. */
export const MOCK_CRUMB_CYCLE_B_LABEL = 'Ciklus B';

/** Static label of the resolver-less dynamic route. */
export const MOCK_CRUMB_STATIC_LABEL_DETAIL_LABEL = 'Címkézett';

/** The fixture registry — root first, parents declared on the children. */
export const MOCK_CRUMB_ROUTES: readonly RouteEntry[] = [
  {
    path: MOCK_CRUMB_ROOT_PATH,
    navLabel: MOCK_CRUMB_ROOT_LABEL,
    element: <p>mock root</p>,
    protected: true,
    breadcrumbLabel: MOCK_CRUMB_ROOT_LABEL,
  },
  {
    path: MOCK_CRUMB_LIST_PATH,
    navLabel: MOCK_CRUMB_LIST_LABEL,
    element: <p>mock list</p>,
    protected: true,
    breadcrumbLabel: MOCK_CRUMB_LIST_LABEL,
    breadcrumbParentPath: MOCK_CRUMB_ROOT_PATH,
  },
  {
    path: MOCK_CRUMB_DETAIL_PATH,
    navLabel: null,
    element: <p>mock detail</p>,
    protected: true,
    breadcrumbLabel: null,
    breadcrumbParentPath: MOCK_CRUMB_LIST_PATH,
    resolveBreadcrumbLabel: (params) => params.identifier,
  },
  {
    // No crumb of its own: the trail must skip it and keep walking to the root.
    path: MOCK_CRUMB_PLAIN_PATH,
    navLabel: null,
    element: <p>mock plain</p>,
    protected: true,
    breadcrumbLabel: null,
    breadcrumbParentPath: MOCK_CRUMB_ROOT_PATH,
  },
  {
    path: MOCK_CRUMB_PLAIN_DETAIL_PATH,
    navLabel: null,
    element: <p>mock plain detail</p>,
    protected: true,
    breadcrumbLabel: null,
    breadcrumbParentPath: MOCK_CRUMB_PLAIN_PATH,
    resolveBreadcrumbLabel: (params) => params.id,
  },
  {
    path: MOCK_CRUMB_ORPHAN_PATH,
    navLabel: null,
    element: <p>mock orphan</p>,
    protected: true,
    breadcrumbLabel: MOCK_CRUMB_ORPHAN_LABEL,
    breadcrumbParentPath: '/does-not-exist',
  },
  {
    path: MOCK_CRUMB_CYCLE_A_PATH,
    navLabel: null,
    element: <p>mock cycle a</p>,
    protected: true,
    breadcrumbLabel: MOCK_CRUMB_CYCLE_A_LABEL,
    breadcrumbParentPath: MOCK_CRUMB_CYCLE_B_PATH,
  },
  {
    path: MOCK_CRUMB_CYCLE_B_PATH,
    navLabel: null,
    element: <p>mock cycle b</p>,
    protected: true,
    breadcrumbLabel: MOCK_CRUMB_CYCLE_B_LABEL,
    breadcrumbParentPath: MOCK_CRUMB_CYCLE_A_PATH,
  },
  {
    // A dynamic path with a static label instead of a resolver.
    path: MOCK_CRUMB_STATIC_LABEL_DETAIL_PATH,
    navLabel: null,
    element: <p>mock labelled detail</p>,
    protected: true,
    breadcrumbLabel: MOCK_CRUMB_STATIC_LABEL_DETAIL_LABEL,
    breadcrumbParentPath: MOCK_CRUMB_ROOT_PATH,
  },
];
