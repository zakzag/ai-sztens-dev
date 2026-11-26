import { PageShell } from '@callback/ui';
import { NOT_FOUND_MESSAGE, NOT_FOUND_TITLE } from './not-found.const.js';

/**
 * The catch-all page: an unknown URL answers with a short message instead of an
 * empty screen (AIS-171).
 *
 * It is a page folder so the route registry holds no page markup — the entry
 * only says *which* component answers, the component says *what* it looks like.
 * Rendered inside the authenticated layout, so it goes through `PageShell` like
 * every other page.
 *
 * @returns the not-found page content.
 */
export function NotFoundPage() {
  return (
    <PageShell title={NOT_FOUND_TITLE}>
      <p className="text-text-secondary">{NOT_FOUND_MESSAGE}</p>
    </PageShell>
  );
}
