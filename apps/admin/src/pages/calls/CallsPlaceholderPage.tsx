import { PageShell } from '@callback/ui';
import {
  CALLS_PLACEHOLDER_MESSAGE,
  CALLS_PLACEHOLDER_TITLE,
} from './calls.const.js';

/**
 * `/calls` — the placeholder of the call list (AIS-171).
 *
 * The route used to carry its markup as a literal `element: <p …>`, which made
 * the route registry a page file. It is a page folder now, so the registry only
 * instantiates a component and the registry test can keep asserting data, not
 * JSX.
 *
 * @returns the placeholder page content.
 */
export function CallsPlaceholderPage() {
  return (
    <PageShell title={CALLS_PLACEHOLDER_TITLE}>
      <p className="text-text-secondary">{CALLS_PLACEHOLDER_MESSAGE}</p>
    </PageShell>
  );
}
