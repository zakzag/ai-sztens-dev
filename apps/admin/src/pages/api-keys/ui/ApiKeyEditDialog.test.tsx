/**
 * Tests of the edit overlay `/api-keys/:identifier/edit` (AIS-172).
 *
 * The suite replaces the component-level one of the old inline editor, promoted
 * from a component contract to a route-level one: the window is mounted behind
 * its real pattern, the detail read and the `PATCH` both go through MSW, so the
 * real query hook, the mutation hook, the transport and `useAppForm` all run;
 * only the wire is replaced.
 *
 * What is pinned here:
 *
 * | outcome                     | field | `formError` | toast | dialog |
 * | --------------------------- | ----- | ----------- | ----- | ------ |
 * | success                     | —     | —           | yes   | closes |
 * | client-side invalid         | yes   | —           | —     | open   |
 * | `422` blaming `expiresAt`   | yes   | —           | —     | open   |
 * | `409 STALE_WRITE`           | —     | —           | yes   | open, refetched |
 * | `500` on the read           | —     | —           | —     | retryable |
 *
 * The `409` row is the one that changed meaning in AIS-172: `STALE_WRITE` has no
 * `fieldMessage` in `ERROR_CODE_CATALOGUE`, so `toErrorSurface` classifies it as
 * `page` and the capture toast is the only surface — plus an immediate re-read,
 * because the cache only invalidates after a **successful** write.
 */

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { VALID_API_KEY, VALIDATION_MESSAGE_CATALOGUE } from '@callback/shared';
import { ENTITY_DIALOG_CANCEL_LABEL } from '@callback/ui';
import {
  FIELD_INVALID_MESSAGE,
  STALE_WRITE_MESSAGE,
} from '../../../lib/error-message.const.js';
import { PAGE_ERROR_RETRY_LABEL } from '../../../lib/error-surface.const.js';
import {
  API_KEY_AFTER_STALE_WRITE,
  apiKeysDetailNotFound,
  apiKeysDetailServerError,
  apiKeysUpdatePending,
  apiKeysUpdateSemanticInvalid,
  apiKeysUpdateStaleWrite,
  createApiKeysDetailRefetchHandler,
} from '../../../test/mocks/handlers/api-keys.handlers.js';
import { createRequestRecorder } from '../../../test/mocks/request-recorder.js';
import {
  renderWithProviders,
  type RenderWithProvidersResult,
} from '../../../test/mocks/render-with-providers.js';
import { server } from '../../../test/mocks/server.js';
import {
  API_KEYS_LIST_ROUTE_PATH,
  API_KEY_DETAIL_ERROR_TITLE,
  API_KEY_DETAIL_NOT_FOUND_TITLE,
  API_KEY_EDIT_DIALOG_PENDING_LABEL,
  API_KEY_EDIT_DIALOG_SUBMIT_LABEL,
  API_KEY_EDIT_DIALOG_TITLE,
  API_KEY_EDIT_FORM_ERROR_TITLE,
  API_KEY_EDIT_FORM_LABELS,
  API_KEY_EDIT_FORM_SUCCESS_MESSAGE,
  API_KEY_EDIT_ROUTE_PATH,
} from '../api-keys.const.js';
import { ApiKeyEditDialog } from './ApiKeyEditDialog.js';

/** Hungarian validation copy, i.e. what this bundle renders. */
const HUNGARIAN = VALIDATION_MESSAGE_CATALOGUE.hu;

/**
 * Identifier the overlay is mounted with.
 *
 * Deliberately different from the fixture row's own `identifier`: the detail
 * handler answers any `:identifier`, and the assertions below prove that the
 * `PATCH` addresses **the URL parameter** the window was opened with.
 */
const OVERLAY_IDENTIFIER = 'vapi-prod-ident';

/** URL the overlay is mounted at. */
const OVERLAY_PATH = `/api-keys/${OVERLAY_IDENTIFIER}/edit`;

/** Publishes the current pathname for the close-navigation assertions. */
function LocationProbe(): ReactNode {
  const location = useLocation();

  return <div data-testid="location">{location.pathname}</div>;
}

/**
 * Renders the overlay behind its real route pattern.
 *
 * @param path - the URL the memory router starts at.
 * @returns the render result.
 */
function renderOverlay(path = OVERLAY_PATH): RenderWithProvidersResult {
  return renderWithProviders(
    <>
      <LocationProbe />
      <Routes>
        <Route path={API_KEY_EDIT_ROUTE_PATH} element={<ApiKeyEditDialog />} />
      </Routes>
    </>,
    { initialEntries: [path] },
  );
}

/** @returns the pathname the probe currently publishes. */
function currentPath(): string {
  return screen.getByTestId('location').textContent ?? '';
}

/** @returns the name input, i.e. the moment the form finished loading. */
async function findNameInput(): Promise<HTMLElement> {
  return screen.findByLabelText(API_KEY_EDIT_FORM_LABELS.name);
}

/** @returns the footer submit button the overlay renders. */
function getSubmitButton(): HTMLElement {
  return screen.getByRole('button', { name: API_KEY_EDIT_DIALOG_SUBMIT_LABEL });
}

/**
 * @param recorder - the active request recorder.
 * @param method - HTTP method to filter by.
 * @returns the requests the client actually sent with that method.
 */
function requestsByMethod(
  recorder: ReturnType<typeof createRequestRecorder>,
  method: string,
) {
  return recorder.requests.filter((request) => request.method === method);
}

describe('ApiKeyEditDialog', () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  it('prefills the current values of the row behind its own window', async () => {
    renderOverlay();

    const dialog = await screen.findByRole('dialog', {
      name: API_KEY_EDIT_DIALOG_TITLE,
    });

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(await findNameInput()).toHaveValue(VALID_API_KEY.name);
    // The optional fields arrive as empty strings, never as `null`: the inputs
    // render a day and a text, not a wire shape.
    expect(
      screen.getByLabelText(API_KEY_EDIT_FORM_LABELS.description),
    ).toHaveValue('');
    expect(
      screen.getByLabelText(API_KEY_EDIT_FORM_LABELS.expiresAt),
    ).toHaveValue('');
    // Not editable: the address and the secret are not part of a `PATCH`, so
    // the window renders exactly three controls.
    expect(screen.getAllByRole('textbox')).toHaveLength(2);
  });

  it('patches with the version token, toasts once and closes to the list', async () => {
    const recorder = createRequestRecorder();
    const rendered = renderOverlay();

    const nameInput = await findNameInput();
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Vapi staging');
    await userEvent.click(getSubmitButton());

    // One surface only (AIS-172 `D-A`): the notify port's toast replaces the
    // page-level success `Alert` the legacy detail page used to render.
    expect(
      await screen.findByText(API_KEY_EDIT_FORM_SUCCESS_MESSAGE),
    ).toBeInTheDocument();

    const state = rendered.notifications.store.getSnapshot();

    expect(state.toasts).toHaveLength(1);
    expect(state.entries).toHaveLength(1);
    expect(state.entries[0]?.source).toBe('manual');

    await waitFor(() => {
      expect(requestsByMethod(recorder, 'PATCH')).toHaveLength(1);
    });
    const [patch] = requestsByMethod(recorder, 'PATCH');

    expect(patch?.url).toContain(`/api/api-keys/${OVERLAY_IDENTIFIER}`);
    expect(patch?.body).toMatchObject({ name: 'Vapi staging' });
    expect(patch?.body).toHaveProperty('updatedAt', VALID_API_KEY.updatedAt);

    await waitFor(() => {
      expect(currentPath()).toBe(API_KEYS_LIST_ROUTE_PATH);
    });

    recorder.stop();
  });

  it('blocks the submit for an empty name without calling the write', async () => {
    const recorder = createRequestRecorder();
    renderOverlay();

    await userEvent.clear(await findNameInput());
    await userEvent.click(getSubmitButton());

    expect(await screen.findByText(HUNGARIAN.REQUIRED)).toBeInTheDocument();
    expect(requestsByMethod(recorder, 'PATCH')).toHaveLength(0);

    recorder.stop();
  });

  it('maps a 422 onto the blamed field, focuses it and stays silent', async () => {
    server.use(apiKeysUpdateSemanticInvalid);
    const rendered = renderOverlay();

    await findNameInput();
    await userEvent.click(getSubmitButton());

    expect(await screen.findByText(FIELD_INVALID_MESSAGE)).toBeInTheDocument();
    expect(
      screen.getByLabelText(API_KEY_EDIT_FORM_LABELS.expiresAt),
    ).toHaveFocus();
    // A field-addressable failure is log-only: no toast, no residue alert.
    expect(
      screen.queryByText(API_KEY_EDIT_FORM_ERROR_TITLE),
    ).not.toBeInTheDocument();
    expect(rendered.notifications.store.getSnapshot().toasts).toHaveLength(0);
  });

  it('reports a stale write once, keeps the window open and re-reads the row', async () => {
    server.use(apiKeysUpdateStaleWrite, createApiKeysDetailRefetchHandler());
    const recorder = createRequestRecorder();
    const rendered = renderOverlay();

    const nameInput = await findNameInput();
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Vapi staging');
    await userEvent.click(getSubmitButton());

    // The capture toast is the single surface for a `page` failure.
    expect(await screen.findByText(STALE_WRITE_MESSAGE)).toBeInTheDocument();
    // The blamed `updatedAt` is a hidden token, so nothing may appear under a
    // visible input — that would be a field error for a field the user has not
    // typed into.
    expect(screen.queryByText(FIELD_INVALID_MESSAGE)).not.toBeInTheDocument();
    expect(
      screen.queryByText(API_KEY_EDIT_FORM_ERROR_TITLE),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('dialog', { name: API_KEY_EDIT_DIALOG_TITLE }),
    ).toBeInTheDocument();

    // The re-read brings the version somebody else saved, and the remount puts
    // it into the inputs — otherwise the form would carry a dead token forever.
    await waitFor(() => {
      expect(screen.getByLabelText(API_KEY_EDIT_FORM_LABELS.name)).toHaveValue(
        API_KEY_AFTER_STALE_WRITE.name,
      );
    });
    await waitFor(() => {
      expect(requestsByMethod(recorder, 'GET')).toHaveLength(2);
    });
    expect(requestsByMethod(recorder, 'PATCH')).toHaveLength(1);
    expect(rendered.notifications.store.getSnapshot().entries).toHaveLength(1);

    recorder.stop();
  });

  it('renders the not-found branch for a 404', async () => {
    server.use(apiKeysDetailNotFound);
    renderOverlay();

    expect(
      await screen.findByText(API_KEY_DETAIL_NOT_FOUND_TITLE),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(API_KEY_EDIT_FORM_LABELS.name),
    ).not.toBeInTheDocument();
  });

  it('renders the retryable page error when the read fails', async () => {
    server.use(apiKeysDetailServerError);
    renderOverlay();

    expect(
      await screen.findByText(API_KEY_DETAIL_ERROR_TITLE),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: PAGE_ERROR_RETRY_LABEL }),
    ).toBeInTheDocument();
  });

  it('keeps the footer submit busy while the write is in flight', async () => {
    server.use(apiKeysUpdatePending);
    renderOverlay();

    await findNameInput();
    await userEvent.click(getSubmitButton());

    expect(
      await screen.findByRole('button', {
        name: API_KEY_EDIT_DIALOG_PENDING_LABEL,
      }),
    ).toBeDisabled();
  });

  it('closes to the list without writing when dismissed', async () => {
    const recorder = createRequestRecorder();
    renderOverlay();

    await findNameInput();
    await userEvent.click(
      screen.getByRole('button', { name: ENTITY_DIALOG_CANCEL_LABEL }),
    );

    await waitFor(() => {
      expect(currentPath()).toBe(API_KEYS_LIST_ROUTE_PATH);
    });
    expect(requestsByMethod(recorder, 'PATCH')).toHaveLength(0);

    recorder.stop();
  });
});
