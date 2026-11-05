/**
 * Page-level integration test of `/api-keys/:identifier` (AIS-131).
 *
 * This is the suite that proves the CRUD reference slice end to end: URL →
 * `useApiKeyDetailQuery` → `DescriptionList` / `StatusBadge`, the edit form →
 * `PATCH` with the `updatedAt` token, and the confirmation dialog → `DELETE`.
 * The mock point is the **network** (MSW), so the real service, transport, hooks
 * and `useAppForm` all run; only the wire is replaced.
 *
 * The four failure branches the ticket asks for are separate tests on purpose:
 * - a `404` is “not found”, not an empty page;
 * - a `500` is the retryable page error;
 * - a `409 STALE_WRITE` is a page alert with a reload, **never** a field error;
 * - a `422` is a field error on the blamed input.
 */

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { VALID_API_KEY } from '@callback/shared';
import { FIELD_INVALID_MESSAGE } from '../../lib/error-message.const.js';
import {
  apiKeysDeleteNotFound,
  apiKeysDetailNotFound,
  apiKeysDetailServerError,
  apiKeysUpdateSemanticInvalid,
  apiKeysUpdateStaleWrite,
} from '../../test/mocks/handlers/api-keys.handlers.js';
import { createRequestRecorder } from '../../test/mocks/request-recorder.js';
import { renderWithProviders } from '../../test/mocks/render-with-providers.js';
import { server } from '../../test/mocks/server.js';
import {
  API_KEYS_LIST_ROUTE_PATH,
  API_KEY_DELETE_CANCEL_LABEL,
  API_KEY_DELETE_CONFIRM_LABEL,
  API_KEY_DELETE_DIALOG_TITLE,
  API_KEY_DELETE_LABEL,
  API_KEY_DETAIL_ERROR_TITLE,
  API_KEY_DETAIL_FIELD_LABELS,
  API_KEY_DETAIL_NOT_FOUND_TITLE,
  API_KEY_DETAIL_STALE_WRITE_ACTION,
  API_KEY_DETAIL_STALE_WRITE_TITLE,
  API_KEY_EDIT_FORM_LABELS,
  API_KEY_EDIT_FORM_SUBMIT_LABEL,
  API_KEY_EDIT_FORM_SUCCESS_MESSAGE,
} from './api-keys.const.js';
import { ApiKeyDetailPage } from './ApiKeyDetailPage.js';

/** Fixture row the default detail handler answers with. */
const DETAIL_PATH = '/api-keys/vapi-prod-ident';

/** Publishes the current pathname for the post-delete navigation assertion. */
function LocationProbe(): ReactNode {
  const location = useLocation();

  return <div data-testid="location">{location.pathname}</div>;
}

/**
 * Renders the page behind the real route pattern.
 *
 * @param path - the URL the memory router starts at.
 * @returns the render result.
 */
function renderPage(path = DETAIL_PATH) {
  return renderWithProviders(
    <>
      <LocationProbe />
      <Routes>
        <Route path="/api-keys/:identifier" element={<ApiKeyDetailPage />} />
      </Routes>
    </>,
    { initialEntries: [path] },
  );
}

/** @returns the requests the client actually sent, by method. */
function requestsByMethod(
  recorder: ReturnType<typeof createRequestRecorder>,
  method: string,
) {
  return recorder.requests.filter((request) => request.method === method);
}

/**
 * Edits the name field of the form.
 *
 * @param name - the new value.
 */
async function editName(name: string): Promise<void> {
  const input = screen.getByLabelText(API_KEY_EDIT_FORM_LABELS.name);

  await userEvent.clear(input);
  await userEvent.type(input, name);
}

describe('ApiKeyDetailPage', () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  it('renders the stored key with its fields and an edit form', async () => {
    renderPage();

    expect(await screen.findByText(VALID_API_KEY.name)).toBeInTheDocument();
    expect(screen.getByText(VALID_API_KEY.identifier)).toBeInTheDocument();
    expect(
      screen.getByText(API_KEY_DETAIL_FIELD_LABELS.expiry),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(API_KEY_EDIT_FORM_LABELS.name),
    ).toBeInTheDocument();
  });

  it('renders a dedicated not-found branch for a 404', async () => {
    server.use(apiKeysDetailNotFound);
    renderPage();

    expect(
      await screen.findByText(API_KEY_DETAIL_NOT_FOUND_TITLE),
    ).toBeInTheDocument();
    // Not an empty description list and not a retry button: a missing key is a
    // dead end, so the only way forward is back to the list.
    expect(
      screen.queryByLabelText(API_KEY_EDIT_FORM_LABELS.name),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(API_KEY_DETAIL_ERROR_TITLE),
    ).not.toBeInTheDocument();
  });

  it('renders the retryable page error when the read fails', async () => {
    server.use(apiKeysDetailServerError);
    renderPage();

    expect(
      await screen.findByText(API_KEY_DETAIL_ERROR_TITLE),
    ).toBeInTheDocument();
  });

  it('patches the key with the version token and confirms the save', async () => {
    const recorder = createRequestRecorder();
    renderPage();

    await screen.findByLabelText(API_KEY_EDIT_FORM_LABELS.name);
    await editName('Vapi staging');
    await userEvent.click(
      screen.getByRole('button', { name: API_KEY_EDIT_FORM_SUBMIT_LABEL }),
    );

    // AIS-136 `AIS136-D1` (owner decision): the page keeps its success `Alert`
    // **and** the form's notify port adds a toast, so the same sentence appears
    // twice on purpose — the `Alert` marks the saved state, the toast the moment.
    const successSurfaces = await screen.findAllByText(
      API_KEY_EDIT_FORM_SUCCESS_MESSAGE,
    );

    expect(successSurfaces).toHaveLength(2);

    await waitFor(() => {
      expect(requestsByMethod(recorder, 'PATCH')).toHaveLength(1);
    });
    const [patch] = requestsByMethod(recorder, 'PATCH');
    expect(patch.body).toMatchObject({ name: 'Vapi staging' });
    expect(patch.body).toHaveProperty('updatedAt');

    recorder.stop();
  });

  it('offers a reload instead of a field error on a stale write', async () => {
    server.use(apiKeysUpdateStaleWrite);
    renderPage();

    await screen.findByLabelText(API_KEY_EDIT_FORM_LABELS.name);
    await editName('Vapi staging');
    await userEvent.click(
      screen.getByRole('button', { name: API_KEY_EDIT_FORM_SUBMIT_LABEL }),
    );

    expect(
      await screen.findByText(API_KEY_DETAIL_STALE_WRITE_TITLE),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: API_KEY_DETAIL_STALE_WRITE_ACTION }),
    ).toBeInTheDocument();
    // The blamed `updatedAt` is a hidden token, so nothing may appear under an
    // input the user can see — that would be a field error for a field that
    // does not exist.
    expect(screen.queryByText(FIELD_INVALID_MESSAGE)).not.toBeInTheDocument();
  });

  it('maps a semantic validation failure onto the blamed field', async () => {
    server.use(apiKeysUpdateSemanticInvalid);
    renderPage();

    await screen.findByLabelText(API_KEY_EDIT_FORM_LABELS.name);
    await userEvent.click(
      screen.getByRole('button', { name: API_KEY_EDIT_FORM_SUBMIT_LABEL }),
    );

    expect(await screen.findByText(FIELD_INVALID_MESSAGE)).toBeInTheDocument();
    expect(
      screen.queryByText(API_KEY_DETAIL_STALE_WRITE_TITLE),
    ).not.toBeInTheDocument();
  });

  it('sends no request when the confirmation is cancelled', async () => {
    const recorder = createRequestRecorder();
    renderPage();

    await screen.findByLabelText(API_KEY_EDIT_FORM_LABELS.name);
    await userEvent.click(
      screen.getByRole('button', { name: API_KEY_DELETE_LABEL }),
    );
    expect(
      await screen.findByText(API_KEY_DELETE_DIALOG_TITLE),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: API_KEY_DELETE_CANCEL_LABEL }),
    );
    await waitFor(() => {
      expect(
        screen.queryByText(API_KEY_DELETE_DIALOG_TITLE),
      ).not.toBeInTheDocument();
    });
    expect(requestsByMethod(recorder, 'DELETE')).toHaveLength(0);

    recorder.stop();
  });

  it('deletes the key after confirmation and returns to the list', async () => {
    const recorder = createRequestRecorder();
    renderPage();

    await screen.findByLabelText(API_KEY_EDIT_FORM_LABELS.name);
    await userEvent.click(
      screen.getByRole('button', { name: API_KEY_DELETE_LABEL }),
    );
    await screen.findByText(API_KEY_DELETE_DIALOG_TITLE);
    await userEvent.click(
      screen.getByRole('button', { name: API_KEY_DELETE_CONFIRM_LABEL }),
    );

    await waitFor(() => {
      expect(requestsByMethod(recorder, 'DELETE')).toHaveLength(1);
    });
    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        API_KEYS_LIST_ROUTE_PATH,
      );
    });

    recorder.stop();
  });

  it('keeps the dialog open and shows the failure when the delete fails', async () => {
    server.use(apiKeysDeleteNotFound);
    renderPage();

    await screen.findByLabelText(API_KEY_EDIT_FORM_LABELS.name);
    await userEvent.click(
      screen.getByRole('button', { name: API_KEY_DELETE_LABEL }),
    );
    await screen.findByText(API_KEY_DELETE_DIALOG_TITLE);
    await userEvent.click(
      screen.getByRole('button', { name: API_KEY_DELETE_CONFIRM_LABEL }),
    );

    // The dialog stays open and its description becomes the mapped failure: the
    // question must not disappear while the answer is unknown.
    expect(
      await screen.findByText(API_KEY_DELETE_DIALOG_TITLE),
    ).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(DETAIL_PATH);
  });
});
