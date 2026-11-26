/**
 * Read-only window onto the current URL (AIS-19).
 *
 * Page tests assert *what the URL became* after an interaction — the URL is the
 * state owner for lists, so a component test that only looked at the rendered
 * cells would not prove anything about it. Rendered next to the page under test,
 * it reports `pathname + search` through a test id.
 */

import { useLocation } from 'react-router-dom';

/** Test id the probe renders into. */
export const LOCATION_PROBE_TEST_ID = 'location-probe';

/**
 * @returns a span holding the current path and query string.
 */
export function LocationProbe() {
  const location = useLocation();

  return (
    <span data-testid={LOCATION_PROBE_TEST_ID}>
      {`${location.pathname}${location.search}`}
    </span>
  );
}
