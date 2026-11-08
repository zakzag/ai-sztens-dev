import { DescriptionList, EmptyState, EntityDialog } from '@callback/ui';
import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { PageErrorState } from '../../../components/error/PageErrorState.js';
import { useApiKeyDetailQuery } from '../../../features/api-keys/use-api-keys.js';
import { useEntityDialog } from '../../../features/entity-dialog/use-entity-dialog.js';
import { isNotFoundFailure } from '../../../lib/error-surface.logic.js';
import {
  API_KEY_DETAIL_BACK_LABEL,
  API_KEY_DETAIL_ERROR_TITLE,
  API_KEY_DETAIL_LOADING_MESSAGE,
  API_KEY_DETAIL_NOT_FOUND_MESSAGE,
  API_KEY_DETAIL_NOT_FOUND_TITLE,
  API_KEY_DETAIL_PARAM,
  API_KEY_EDIT_DIALOG_TITLE,
  API_KEYS_LIST_ROUTE_PATH,
} from '../api-keys.const.js';
import { ApiKeyEditDialogForm } from './ApiKeyEditDialogForm.js';

/**
 * `/api-keys/:identifier/edit` — the edit overlay of one key (AIS-172).
 *
 * The third overlay of the list, and the one that makes the CRUD entry points
 * uniform: create, view and edit are all URLs, all render into the list's
 * `<Outlet/>`, and all close through {@link useEntityDialog} — so the editor is
 * linkable, reloadable and never an inline card under a table again.
 *
 * This component owns the **data**: the identifier from the URL, the detail read
 * and its four states (loading, not found, retryable page error, success). The
 * form itself lives in {@link ApiKeyEditDialogForm}, for one reason: react-hook-
 * form seeds `defaultValues` only on mount, so a refreshed row can only reach
 * the inputs through a **remount** — and a component cannot remount its own
 * hooks. Hence `key={data.updatedAt}` on the child, which is also what makes a
 * `409 STALE_WRITE` re-render the fields with the version the server returned.
 *
 * There is no `isSaved`/`isStale` flag here: a successful write announces itself
 * through the form's notify port and closes the window, and a lost update is the
 * `page`-tier failure the capture toast already owns (AIS-172 `D-B`).
 *
 * @returns the overlay, mounted as the `/api-keys/:identifier/edit` route element.
 */
export function ApiKeyEditDialog() {
  const params = useParams();
  const identifier = params[API_KEY_DETAIL_PARAM] ?? '';
  const { closeDialog } = useEntityDialog(API_KEYS_LIST_ROUTE_PATH);

  const detail = useApiKeyDetailQuery(identifier, identifier.length > 0);
  const data = detail.data;
  const pageErrorMessage =
    detail.errorSurface === 'page' ? detail.errorMessage : null;

  // The happy path hands over to the form window, keyed by the version it was
  // seeded with. Every other state stays in this component, because it has no
  // form at all.
  if (!detail.isLoading && pageErrorMessage === null && data !== null) {
    return (
      <ApiKeyEditDialogForm
        key={data.updatedAt}
        data={data}
        identifier={identifier}
        onClose={closeDialog}
        onStaleWrite={detail.refetch}
      />
    );
  }

  let content: ReactNode;

  if (detail.isLoading) {
    content = (
      <>
        <p role="status" className="sr-only">
          {API_KEY_DETAIL_LOADING_MESSAGE}
        </p>
        <DescriptionList items={[]} isLoading />
      </>
    );
  } else if (pageErrorMessage !== null && isNotFoundFailure(detail.error)) {
    content = (
      <EmptyState
        title={API_KEY_DETAIL_NOT_FOUND_TITLE}
        description={API_KEY_DETAIL_NOT_FOUND_MESSAGE}
        action={{ label: API_KEY_DETAIL_BACK_LABEL, onAction: closeDialog }}
      />
    );
  } else if (pageErrorMessage !== null) {
    content = (
      <PageErrorState
        title={API_KEY_DETAIL_ERROR_TITLE}
        message={pageErrorMessage}
        onRetry={detail.refetch}
        isRetrying={detail.isFetching}
      />
    );
  } else {
    // No identifier in the URL or an empty response: the same dead end as a 404,
    // because there is nothing to edit and no request to retry.
    content = (
      <EmptyState
        title={API_KEY_DETAIL_NOT_FOUND_TITLE}
        description={API_KEY_DETAIL_NOT_FOUND_MESSAGE}
        action={{ label: API_KEY_DETAIL_BACK_LABEL, onAction: closeDialog }}
      />
    );
  }

  return (
    <EntityDialog
      title={API_KEY_EDIT_DIALOG_TITLE}
      description={identifier}
      onClose={closeDialog}
      submit={null}
    >
      {content}
    </EntityDialog>
  );
}
