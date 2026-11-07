import { DescriptionList, EmptyState, EntityDialog } from '@callback/ui';
import { buttonVariants } from '@callback/ui';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageErrorState } from '../../../components/error/PageErrorState.js';
import { toApiKeyDetailViewModel } from '../../../entities/api-key/api-key.mapper.js';
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
  API_KEY_VIEW_CLOSE_LABEL,
  API_KEY_VIEW_DELETE_LINK_LABEL,
  API_KEY_VIEW_DIALOG_TITLE,
  API_KEYS_LIST_ROUTE_PATH,
} from '../api-keys.const.js';
import { toApiKeyDetailRoute } from '../api-keys.logic.js';
import { ApiKeyDetailFields } from './ApiKeyDetailFields.js';

/**
 * `/api-keys/:identifier/view` — the read-only overlay of one key (AIS-155).
 *
 * The window is deliberately **not destructive**: it has no submit button, only
 * `Bezárás`, so it cannot be the place where data disappears. Deleting stays on
 * the legacy detail page, which the footer's left-hand action opens — that is
 * how the delete path survives while the old page is still being retired
 * (AIS-155 `D8`).
 *
 * All four data states are rendered (loading, not found, page error, success):
 * the overlay is a page-like surface, and a window that silently shows an empty
 * body would be indistinguishable from a hung request.
 *
 * @returns the overlay, mounted as the `/api-keys/:identifier/view` route element.
 */
export function ApiKeyViewDialog() {
  const params = useParams();
  const identifier = params[API_KEY_DETAIL_PARAM] ?? '';
  const { closeDialog } = useEntityDialog(API_KEYS_LIST_ROUTE_PATH);

  const detail = useApiKeyDetailQuery(identifier, identifier.length > 0);
  const data = detail.data;
  const viewModel = data === null ? null : toApiKeyDetailViewModel(data);
  const pageErrorMessage =
    detail.errorSurface === 'page' ? detail.errorMessage : null;

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
  } else if (viewModel === null) {
    content = (
      <EmptyState
        title={API_KEY_DETAIL_NOT_FOUND_TITLE}
        description={API_KEY_DETAIL_NOT_FOUND_MESSAGE}
        action={{ label: API_KEY_DETAIL_BACK_LABEL, onAction: closeDialog }}
      />
    );
  } else {
    content = <ApiKeyDetailFields viewModel={viewModel} />;
  }

  return (
    <EntityDialog
      title={viewModel?.name ?? API_KEY_VIEW_DIALOG_TITLE}
      description={identifier}
      onClose={closeDialog}
      cancelLabel={API_KEY_VIEW_CLOSE_LABEL}
      submit={null}
      footerExtras={
        <Link
          to={toApiKeyDetailRoute(identifier)}
          className={buttonVariants({ variant: 'secondary' })}
        >
          {API_KEY_VIEW_DELETE_LINK_LABEL}
        </Link>
      }
    >
      {content}
    </EntityDialog>
  );
}
