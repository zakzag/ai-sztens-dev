import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ENTITY_DIALOG_CLOSE_REPLACE } from './entity-dialog.const.js';
import type { UseEntityDialogResult } from './entity-dialog.interface.js';

/**
 * The close behaviour of a route-mounted entity dialog (AIS-155 `D7`).
 *
 * A dialog route (`/api-keys/new`, `/api-keys/:identifier/view`) is a URL, so
 * closing it means **navigating back to the list** — never `history.back()`:
 *
 * - a deep link (`/api-keys/new` opened from a bookmark) has no list entry in
 *   the history, so `back()` would leave the app;
 * - `replace` keeps the closed dialog out of the history, so "back" after
 *   closing does not re-open it.
 *
 * The hook lives in `features/` because a page may import a feature but not the
 * `app` layer, and because `features/api/use-list-params.ts` already owns the
 * URL of the same page. It holds no state: the URL is the state.
 *
 * @param listPath - the list route the overlay returns to, e.g. `/api-keys`.
 * @returns {@link UseEntityDialogResult} — the single close handler of the page.
 */
export function useEntityDialog(listPath: string): UseEntityDialogResult {
  const navigate = useNavigate();

  const closeDialog = useCallback((): void => {
    navigate(listPath, { replace: ENTITY_DIALOG_CLOSE_REPLACE });
  }, [listPath, navigate]);

  return { closeDialog };
}
