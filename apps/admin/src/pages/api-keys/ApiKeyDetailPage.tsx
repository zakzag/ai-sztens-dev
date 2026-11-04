import { Alert, Button, Card, DescriptionList, EmptyState } from '@callback/ui';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageErrorState } from '../../components/error/PageErrorState.js';
import { toApiKeyDetailViewModel } from '../../entities/api-key/api-key.mapper.js';
import {
  useApiKeyDetailQuery,
  useDeleteApiKeyMutation,
  useUpdateApiKeyMutation,
} from '../../features/api-keys/use-api-keys.js';
import {
  isNotFoundFailure,
  isStaleWriteFailure,
} from '../../lib/error-surface.logic.js';
import {
  API_KEY_DETAIL_BACK_ARIA_LABEL,
  API_KEY_DETAIL_BACK_LABEL,
  API_KEY_DETAIL_ERROR_TITLE,
  API_KEY_DETAIL_LOADING_MESSAGE,
  API_KEY_DETAIL_NOT_FOUND_MESSAGE,
  API_KEY_DETAIL_NOT_FOUND_TITLE,
  API_KEY_DETAIL_PARAM,
  API_KEY_DETAIL_STALE_WRITE_ACTION,
  API_KEY_DETAIL_STALE_WRITE_MESSAGE,
  API_KEY_DETAIL_STALE_WRITE_TITLE,
  API_KEY_DETAIL_SUBTITLE,
  API_KEY_DETAIL_TITLE,
  API_KEYS_LIST_ROUTE_PATH,
  API_KEY_EDIT_FORM_SUCCESS_MESSAGE,
} from './api-keys.const.js';
import type { ApiKeyEditFormValues } from './api-keys.interface.js';
import {
  toApiKeyEditFormValues,
  toUpdateApiKeyInput,
} from './api-keys.logic.js';
import { ApiKeyDeleteDialog } from './ui/ApiKeyDeleteDialog.js';
import { ApiKeyDetailCard } from './ui/ApiKeyDetailCard.js';
import { ApiKeyEditForm } from './ui/ApiKeyEditForm.js';

/**
 * `/api-keys/:identifier` — one stored key, editable and deletable (AIS-131).
 *
 * This is the **reference detail page**: every later resource (companies first,
 * AIS-20/21) copies this shape.
 *
 * State buckets, in the order the rules require:
 * - the identifier is in the **URL** (`useParams`), so a detail link is
 *   shareable and survives a reload;
 * - the resource itself is **server state** in the TanStack Query cache — never
 *   copied into `useState`;
 * - the form values belong to **react-hook-form** (inside `ApiKeyEditForm`);
 * - the three flags here are transient page UI (`useState`): the dialog is open,
 *   the last write was refused as stale, the last write succeeded. None of them
 *   survives a navigation, and none of them is a copy of server data — which is
 *   why this page has no store either.
 *
 * Failure routing follows the classifier (`toErrorSurface`): only the `page`
 * tier is rendered here, and the two cases the user can act on get their own
 * branch —
 * - **404** → “not found” with a way back (an empty description list would look
 *   like a page that is still loading);
 * - **409 `STALE_WRITE`** → a reload offer next to the form, decided by
 *   `isStaleWriteFailure` in the allowlisted decision module (never by comparing
 *   `error.code` in this component).
 *
 * After a successful `PATCH` the edit form is remounted (`key={updatedAt}`),
 * because `useAppForm` closes a submit with `reset(defaultValues)`.
 *
 * @returns the page content.
 */
export function ApiKeyDetailPage() {
  const params = useParams();
  const identifier = params[API_KEY_DETAIL_PARAM] ?? '';
  const navigate = useNavigate();

  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [isStale, setStale] = useState(false);
  const [isSaved, setSaved] = useState(false);

  const detail = useApiKeyDetailQuery(identifier, identifier.length > 0);

  const {
    deleteApiKey,
    isPending: isDeleting,
    errorMessage: deleteErrorMessage,
  } = useDeleteApiKeyMutation(identifier, {
    onDeleted: () => {
      setConfirmOpen(false);
      navigate(API_KEYS_LIST_ROUTE_PATH);
    },
  });

  const { updateApiKey } = useUpdateApiKeyMutation(identifier, {
    onUpdated: () => {
      setSaved(true);
    },
  });

  const data = detail.data;
  const viewModel = data === null ? null : toApiKeyDetailViewModel(data);
  const pageErrorMessage =
    detail.errorSurface === 'page' ? detail.errorMessage : null;
  const backToList = (): void => {
    navigate(API_KEYS_LIST_ROUTE_PATH);
  };

  /**
   * Sends the form values with the version the user was looking at.
   *
   * A `409 STALE_WRITE` is recorded **and re-thrown**: the flag drives the reload
   * offer, the re-throw keeps `useAppForm` in charge of the field/form messages.
   *
   * @param values - validated form values.
   * @returns the written row, or `undefined` when the row is not loaded (the
   *   form is only rendered with data, so this is a defensive branch).
   */
  const submit = async (
    values: ApiKeyEditFormValues,
  ): Promise<unknown> => {
    if (data === null) {
      return undefined;
    }

    setStale(false);
    setSaved(false);

    try {
      return await updateApiKey(toUpdateApiKeyInput(values, data.updatedAt));
    } catch (error) {
      if (isStaleWriteFailure(error)) {
        setStale(true);
      }

      throw error;
    }
  };

  /**
   * Confirms the deletion.
   *
   * The rejection is deliberately swallowed **after** the mutation reported it:
   * `useApiMutation` keeps the error and the dialog renders it as its own
   * description, so this handler only exists to prevent an unhandled promise
   * rejection — it deliberately changes no state.
   */
  const confirmDelete = (): void => {
    void deleteApiKey().catch(() => {
      // Rendered by `ApiKeyDeleteDialog` from the mutation's `errorMessage`.
    });
  };

  const notFoundState = (
    <EmptyState
      title={API_KEY_DETAIL_NOT_FOUND_TITLE}
      description={API_KEY_DETAIL_NOT_FOUND_MESSAGE}
      action={{ label: API_KEY_DETAIL_BACK_LABEL, onAction: backToList }}
    />
  );

  let content: ReactNode = notFoundState;

  if (detail.isLoading) {
    content = (
      <Card className="space-y-4">
        <p role="status" className="sr-only">
          {API_KEY_DETAIL_LOADING_MESSAGE}
        </p>
        <DescriptionList items={[]} isLoading />
      </Card>
    );
  } else if (pageErrorMessage !== null && isNotFoundFailure(detail.error)) {
    content = notFoundState;
  } else if (pageErrorMessage !== null) {
    content = (
      <PageErrorState
        title={API_KEY_DETAIL_ERROR_TITLE}
        message={pageErrorMessage}
        onRetry={detail.refetch}
        isRetrying={detail.isFetching}
      />
    );
  } else if (data !== null && viewModel !== null) {
    content = (
      <>
        <ApiKeyDetailCard
          viewModel={viewModel}
          onRequestDelete={() => {
            setConfirmOpen(true);
          }}
          isDeleting={isDeleting}
        />
        <ApiKeyEditForm
          key={data.updatedAt}
          values={toApiKeyEditFormValues(data)}
          submit={submit}
          onSaved={() => {
            setSaved(true);
          }}
        />
      </>
    );
  }

  return (
    <section className="space-y-6">
      <header>
        <Link
          to={API_KEYS_LIST_ROUTE_PATH}
          aria-label={API_KEY_DETAIL_BACK_ARIA_LABEL}
          className="text-sm text-text-secondary transition-colors duration-fast hover:text-text-primary"
        >
          {API_KEY_DETAIL_BACK_LABEL}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-text-primary">
          {API_KEY_DETAIL_TITLE}
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          {API_KEY_DETAIL_SUBTITLE}
        </p>
      </header>

      {isStale ? (
        <Alert variant="warning" title={API_KEY_DETAIL_STALE_WRITE_TITLE}>
          <p>{API_KEY_DETAIL_STALE_WRITE_MESSAGE}</p>
          <Button
            variant="secondary"
            className="mt-3"
            onClick={() => {
              setStale(false);
              detail.refetch();
            }}
          >
            {API_KEY_DETAIL_STALE_WRITE_ACTION}
          </Button>
        </Alert>
      ) : null}

      {isSaved ? (
        <Alert variant="success">{API_KEY_EDIT_FORM_SUCCESS_MESSAGE}</Alert>
      ) : null}

      {content}

      <ApiKeyDeleteDialog
        open={isConfirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={confirmDelete}
        isPending={isDeleting}
        errorMessage={deleteErrorMessage}
      />
    </section>
  );
}
