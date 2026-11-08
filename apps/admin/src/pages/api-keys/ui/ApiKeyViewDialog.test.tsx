/**
 * Tests of the read-only overlay `/api-keys/:identifier/view` (AIS-155, AIS-173).
 *
 * The suite pins the promises of the window: it shows the stored key and nothing
 * else, it has **no submit button**, every way out — `Bezárás`, `Esc`, the header
 * `X` — lands on the list URL, and since AIS-173 it is also the section's **only
 * destructive surface**: the footer action opens a confirmation whose outcome is
 * reported inside the window.
 *
 * The delete cases were ported here from the retired `ApiKeyDetailPage.test.tsx`
 * (AIS-173 `D-C`) rather than dropped: the 404 branch, the retryable page error,
 * the cancel, the success and the failed delete all still have to hold.
 *
 * The mock point is the network (MSW), like every other admin test, so the real
 * service, transport and query hook run.
 */

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { VALID_API_KEY } from '@callback/shared';
import { DIALOG_CLOSE_LABEL } from '@callback/ui';
import {
  apiKeysDeleteNotFound,
  apiKeysDeletePending,
  apiKeysDetailNotFound,
  apiKeysDetailServerError,
} from '../../../test/mocks/handlers/api-keys.handlers.js';
import { PAGE_ERROR_RETRY_LABEL } from '../../../lib/error-surface.const.js';
import { createRequestRecorder } from '../../../test/mocks/request-recorder.js';
import { renderWithProviders } from '../../../test/mocks/render-with-providers.js';
import { server } from '../../../test/mocks/server.js';
import {
  API_KEYS_LIST_ROUTE_PATH,
  API_KEY_DELETE_CANCEL_LABEL,
  API_KEY_DELETE_CONFIRM_LABEL,
  API_KEY_DELETE_DIALOG_DESCRIPTION,
  API_KEY_DELETE_DIALOG_TITLE,
  API_KEY_DELETE_LABEL,
  API_KEY_DETAIL_ERROR_TITLE,
  API_KEY_DETAIL_FIELD_LABELS,
  API_KEY_DETAIL_NOT_FOUND_TITLE,
  API_KEY_VIEW_CLOSE_LABEL,
  API_KEY_VIEW_EDIT_LINK_LABEL,
  API_KEY_VIEW_ROUTE_PATH,
} from '../api-keys.const.js';
import { ApiKeyViewDialog } from './ApiKeyViewDialog.js';

/**
 * Identifier the overlay is mounted with.
 *
 * Deliberately different from the fixture row's own `identifier` field: the
 * detail handler answers any `:identifier`, and the test must prove that the
 * window links and deletes on **the URL parameter** it was opened with.
 */
const OVERLAY_IDENTIFIER = 'vapi-prod-ident';

/** URL the overlay is mounted at. */
const OVERLAY_PATH = `/api-keys/${OVERLAY_IDENTIFIER}/view`;

/** Publishes the current pathname for the navigation assertions. */
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
function renderOverlay(path = OVERLAY_PATH) {
  return renderWithProviders(
    <>
      <LocationProbe />
      <Routes>
        <Route path={API_KEY_VIEW_ROUTE_PATH} element={<ApiKeyViewDialog />} />
      </Routes>
    </>,
    { initialEntries: [path] },
  );
}

/** @returns the pathname the probe currently publishes. */
function currentPath(): string {
  return screen.getByTestId('location').textContent ?? '';
}

/** @returns the requests the client actually sent, by method. */
function requestsByMethod(
  recorder: ReturnType<typeof createRequestRecorder>,
  method: string,
) {
  return recorder.requests.filter((request) => request.method === method);
}

/** @returns the rendered dialog, i.e. the moment the row finished loading. */
async function waitForDialog(): Promise<HTMLElement> {
  return screen.findByRole('dialog', { name: VALID_API_KEY.name });
}

/** Opens the delete confirmation from the footer action. */
async function openConfirmation(): Promise<void> {
  await waitForDialog();
  await userEvent.click(
    screen.getByRole('button', { name: API_KEY_DELETE_LABEL }),
  );
  await screen.findByText(API_KEY_DELETE_DIALOG_TITLE);
}

describe('ApiKeyViewDialog', () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  it('renders the stored key as a read-only dialog titled with its name', async () => {
    renderOverlay();

    const dialog = await screen.findByRole('dialog', {
      name: VALID_API_KEY.name,
    });

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText(VALID_API_KEY.identifier)).toBeInTheDocument();
    expect(
      screen.getByText(API_KEY_DETAIL_FIELD_LABELS.expiry),
    ).toBeInTheDocument();
    // The token never reaches a read-only surface.
    expect(screen.queryByText(VALID_API_KEY.apiKey)).not.toBeInTheDocument();
  });

  it('renders no submit button, only the close action', async () => {
    renderOverlay();

    await waitForDialog();

    const submitButtons = screen
      .queryAllByRole('button')
      .filter((button) => button.getAttribute('type') === 'submit');

    expect(submitButtons).toHaveLength(0);
    expect(
      screen.getByRole('button', { name: API_KEY_VIEW_CLOSE_LABEL }),
    ).toBeInTheDocument();
  });

  it('closes to the list from the dismiss button', async () => {
    renderOverlay();

    await waitForDialog();
    await userEvent.click(
      screen.getByRole('button', { name: API_KEY_VIEW_CLOSE_LABEL }),
    );

    await waitFor(() => {
      expect(currentPath()).toBe(API_KEYS_LIST_ROUTE_PATH);
    });
  });

  it('closes to the list from the header close control', async () => {
    renderOverlay();

    await waitForDialog();
    await userEvent.click(
      screen.getByRole('button', { name: DIALOG_CLOSE_LABEL }),
    );

    await waitFor(() => {
      expect(currentPath()).toBe(API_KEYS_LIST_ROUTE_PATH);
    });
  });

  it('closes to the list on Escape', async () => {
    renderOverlay();

    await waitForDialog();
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(currentPath()).toBe(API_KEYS_LIST_ROUTE_PATH);
    });
  });

  it('offers a way on to the edit overlay of the same key', async () => {
    renderOverlay();

    await waitForDialog();

    const link = screen.getByRole('link', {
      name: API_KEY_VIEW_EDIT_LINK_LABEL,
    });

    expect(link).toHaveAttribute(
      'href',
      `/api-keys/${OVERLAY_IDENTIFIER}/edit`,
    );
  });

  it('renders the not-found branch for a 404', async () => {
    server.use(apiKeysDetailNotFound);
    renderOverlay();

    expect(
      await screen.findByText(API_KEY_DETAIL_NOT_FOUND_TITLE),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(API_KEY_DETAIL_FIELD_LABELS.expiry),
    ).not.toBeInTheDocument();
    // A missing key is a dead end: no field list, and nothing to edit or delete.
    expect(
      screen.queryByRole('button', { name: API_KEY_DELETE_LABEL }),
    ).not.toBeInTheDocument();
  });

  it('renders the retryable page error when the read fails', async () => {
    server.use(apiKeysDetailServerError);
    renderOverlay();

    expect(
      await screen.findByText(API_KEY_DETAIL_ERROR_TITLE),
    ).toBeInTheDocument();
    // The retry offer is the actionable part of that branch; the window still
    // has exactly one way out.
    expect(
      screen.getByRole('button', { name: PAGE_ERROR_RETRY_LABEL }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: API_KEY_VIEW_CLOSE_LABEL }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: API_KEY_DELETE_LABEL }),
    ).not.toBeInTheDocument();
  });

  describe('delete (AIS-173)', () => {
    it('opens the confirmation from the footer action without sending a request', async () => {
      const recorder = createRequestRecorder();
      renderOverlay();

      await openConfirmation();

      expect(requestsByMethod(recorder, 'DELETE')).toHaveLength(0);

      recorder.stop();
    });

    it('deletes the key after confirmation and returns to the list', async () => {
      const recorder = createRequestRecorder();
      renderOverlay();

      await openConfirmation();
      await userEvent.click(
        screen.getByRole('button', { name: API_KEY_DELETE_CONFIRM_LABEL }),
      );

      await waitFor(() => {
        expect(requestsByMethod(recorder, 'DELETE')).toHaveLength(1);
      });
      await waitFor(() => {
        expect(currentPath()).toBe(API_KEYS_LIST_ROUTE_PATH);
      });

      recorder.stop();
    });

    it('sends no request when the confirmation is cancelled', async () => {
      const recorder = createRequestRecorder();
      renderOverlay();

      await openConfirmation();
      await userEvent.click(
        screen.getByRole('button', { name: API_KEY_DELETE_CANCEL_LABEL }),
      );

      await waitFor(() => {
        expect(
          screen.queryByText(API_KEY_DELETE_DIALOG_TITLE),
        ).not.toBeInTheDocument();
      });
      expect(requestsByMethod(recorder, 'DELETE')).toHaveLength(0);
      // The overlay itself stays where it was — cancelling is not a close.
      expect(currentPath()).toBe(OVERLAY_PATH);

      recorder.stop();
    });

    it('keeps the confirmation open and shows the failure when the delete fails', async () => {
      server.use(apiKeysDeleteNotFound);
      renderOverlay();

      await openConfirmation();
      await userEvent.click(
        screen.getByRole('button', { name: API_KEY_DELETE_CONFIRM_LABEL }),
      );

      // The question must not disappear while the answer is unknown, and the
      // failure replaces the confirmation's description instead of opening a
      // page-level alert behind the overlay.
      await waitFor(() => {
        expect(
          screen.queryByText(API_KEY_DELETE_DIALOG_DESCRIPTION),
        ).not.toBeInTheDocument();
      });
      expect(
        screen.getByText(API_KEY_DELETE_DIALOG_TITLE),
      ).toBeInTheDocument();
      expect(currentPath()).toBe(OVERLAY_PATH);
    });

    it('disables both confirmation buttons while the delete is in flight', async () => {
      server.use(apiKeysDeletePending);
      renderOverlay();

      await openConfirmation();
      await userEvent.click(
        screen.getByRole('button', { name: API_KEY_DELETE_CONFIRM_LABEL }),
      );

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: API_KEY_DELETE_CONFIRM_LABEL }),
        ).toBeDisabled();
      });
      expect(
        screen.getByRole('button', { name: API_KEY_DELETE_CANCEL_LABEL }),
      ).toBeDisabled();
      expect(currentPath()).toBe(OVERLAY_PATH);
    });
  });
});
