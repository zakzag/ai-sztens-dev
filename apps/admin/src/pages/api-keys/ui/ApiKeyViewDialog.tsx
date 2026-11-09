import {
  Button,
  ConfirmDialog,
  DescriptionList,
  EmptyState,
  EntityDialog,
} from '@callback/ui';
import { buttonVariants } from '@callback/ui';
import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageErrorState } from '../../../components/error/PageErrorState.js';
import { toApiKeyDetailViewModel } from '../../../entities/api-key/api-key.mapper.js';
import {
  useApiKeyDetailQuery,
  useDeleteApiKeyMutation,
} from '../../../features/api-keys/use-api-keys.js';
import { useEntityDialog } from '../../../features/entity-dialog/use-entity-dialog.js';
import { isNotFoundFailure } from '../../../lib/error-surface.logic.js';
import {
  API_KEYS_LIST_ROUTE_PATH,
  API_KEY_DELETE_CANCEL_LABEL,
  API_KEY_DELETE_CONFIRM_LABEL,
  API_KEY_DELETE_DIALOG_DESCRIPTION,
  API_KEY_DELETE_DIALOG_TITLE,
  API_KEY_DELETE_LABEL,
  API_KEY_DETAIL_BACK_LABEL,
  API_KEY_DETAIL_ERROR_TITLE,
  API_KEY_DETAIL_LOADING_MESSAGE,
  API_KEY_DETAIL_NOT_FOUND_MESSAGE,
  API_KEY_DETAIL_NOT_FOUND_TITLE,
  API_KEY_DETAIL_PARAM,
  API_KEY_VIEW_CLOSE_LABEL,
  API_KEY_VIEW_DIALOG_TITLE,
  API_KEY_VIEW_EDIT_LINK_LABEL,
} from '../api-keys.const.js';
import { toApiKeyEditRoute } from '../api-keys.logic.js';
import { ApiKeyDetailFields } from './ApiKeyDetailFields.js';

/**
 * `/api-keys/:identifier/view` — the read-only overlay of one key (AIS-155).
 *
 * Since AIS-173 this window is the section's **only destructive surface**: its
 * left-hand footer action opens the confirmation (`ConfirmDialog`) and the
 * legacy detail page — which used to own the delete — no longer exists.
 *
 * The confirmation is deliberately **not** a route: it cannot be linked, reloaded
 * or bookmarked, and `isConfirmOpen` is transient local state. That is a
 * documented exception to "a dialog's open state lives in the URL", taken because
 * a `/delete` route would cost a registry entry, a breadcrumb and a test for a
 * window the user never navigates to. A failure is rendered **inside** the
 * confirmation as its description, and the window stays open — an answer whose
 * outcome is unknown must not erase the question.
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

  const [isConfirmOpen, setConfirmOpen] = useState(false);

  const detail = useApiKeyDetailQuery(identifier, identifier.length > 0);
  const data = detail.data;
  const viewModel = data === null ? null : toApiKeyDetailViewModel(data);
  const pageErrorMessage =
    detail.errorSurface === 'page' ? detail.errorMessage : null;

  const {
    deleteApiKey,
    isPending: isDeleting,
    errorMessage: deleteErrorMessage,
  } = useDeleteApiKeyMutation(identifier, { onDeleted: closeDialog });

  /**
   * Confirms the deletion.
   *
   * The rejection is deliberately swallowed **after** the mutation reported it:
   * `useApiMutation` keeps the error and the confirmation renders it as its own
   * description, so this handler only exists to prevent an unhandled promise
   * rejection — it deliberately changes no state.
   */
  const confirmDelete = (): void => {
    void deleteApiKey().catch(() => {
      // Rendered by the confirmation below from the mutation's `errorMessage`.
    });
  };

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

  /*
    The footer actions need a row: a missing or unreadable key offers no way into
    the edit overlay and nothing to delete, so a loading, `404` or page-error
    surface stays action-free instead of inviting a request that cannot succeed.
  */
  const footerActions =
    viewModel === null ? null : (
      /*
        One left-hand group holding two actions: the footer is a
        `justify-between` row, so a bare fragment would push the second action
        into the middle instead of keeping it beside the first.
      */
      <div className="flex items-center gap-2">
        <Button
          variant="danger"
          onClick={() => {
            setConfirmOpen(true);
          }}
        >
          {API_KEY_DELETE_LABEL}
        </Button>
        <Link
          to={toApiKeyEditRoute(identifier)}
          className={buttonVariants({ variant: 'secondary' })}
        >
          {API_KEY_VIEW_EDIT_LINK_LABEL}
        </Link>
      </div>
    );

  return (
    <>
      <EntityDialog
        title={viewModel?.name ?? API_KEY_VIEW_DIALOG_TITLE}
        description={identifier}
        onClose={closeDialog}
        cancelLabel={API_KEY_VIEW_CLOSE_LABEL}
        submit={null}
        footerExtras={footerActions}
      >
        {content}
      </EntityDialog>

      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setConfirmOpen}
        title={API_KEY_DELETE_DIALOG_TITLE}
        description={deleteErrorMessage ?? API_KEY_DELETE_DIALOG_DESCRIPTION}
        confirmLabel={API_KEY_DELETE_CONFIRM_LABEL}
        cancelLabel={API_KEY_DELETE_CANCEL_LABEL}
        tone="danger"
        isPending={isDeleting}
        onConfirm={confirmDelete}
      />
    </>
  );
}
