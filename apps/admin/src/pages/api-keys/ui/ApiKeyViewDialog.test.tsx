/**
 * Tests of the read-only overlay `/api-keys/:identifier/view` (AIS-155).
 *
 * The suite pins the three promises of the window: it shows the stored key and
 * nothing else, it has **no submit button** (it is deliberately not destructive),
 * and every way out — `Bezárás`, `Esc`, the header `X` — lands on the list URL.
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
  apiKeysDetailNotFound,
  apiKeysDetailServerError,
} from '../../../test/mocks/handlers/api-keys.handlers.js';
import { PAGE_ERROR_RETRY_LABEL } from '../../../lib/error-surface.const.js';
import { renderWithProviders } from '../../../test/mocks/render-with-providers.js';
import { server } from '../../../test/mocks/server.js';
import {
  API_KEYS_LIST_ROUTE_PATH,
  API_KEY_DETAIL_ERROR_TITLE,
  API_KEY_DETAIL_FIELD_LABELS,
  API_KEY_DETAIL_NOT_FOUND_TITLE,
  API_KEY_VIEW_CLOSE_LABEL,
  API_KEY_VIEW_DELETE_LINK_LABEL,
  API_KEY_VIEW_ROUTE_PATH,
} from '../api-keys.const.js';
import { ApiKeyViewDialog } from './ApiKeyViewDialog.js';

/**
 * Identifier the overlay is mounted with.
 *
 * Deliberately different from the fixture row's own `identifier` field: the
 * detail handler answers any `:identifier`, and the test must prove that the
 * window links on with **the URL parameter** it was opened with.
 */
const OVERLAY_IDENTIFIER = 'vapi-prod-ident';

/** URL the overlay is mounted at. */
const OVERLAY_PATH = `/api-keys/${OVERLAY_IDENTIFIER}/view`;

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

    await screen.findByRole('dialog', { name: VALID_API_KEY.name });

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

    await screen.findByRole('dialog', { name: VALID_API_KEY.name });
    await userEvent.click(
      screen.getByRole('button', { name: API_KEY_VIEW_CLOSE_LABEL }),
    );

    await waitFor(() => {
      expect(currentPath()).toBe(API_KEYS_LIST_ROUTE_PATH);
    });
  });

  it('closes to the list from the header close control', async () => {
    renderOverlay();

    await screen.findByRole('dialog', { name: VALID_API_KEY.name });
    await userEvent.click(
      screen.getByRole('button', { name: DIALOG_CLOSE_LABEL }),
    );

    await waitFor(() => {
      expect(currentPath()).toBe(API_KEYS_LIST_ROUTE_PATH);
    });
  });

  it('closes to the list on Escape', async () => {
    renderOverlay();

    await screen.findByRole('dialog', { name: VALID_API_KEY.name });
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(currentPath()).toBe(API_KEYS_LIST_ROUTE_PATH);
    });
  });

  it('offers a way on to the editable detail page where deleting lives', async () => {
    renderOverlay();

    await screen.findByRole('dialog', { name: VALID_API_KEY.name });

    const link = screen.getByRole('link', {
      name: API_KEY_VIEW_DELETE_LINK_LABEL,
    });

    expect(link).toHaveAttribute('href', `/api-keys/${OVERLAY_IDENTIFIER}`);
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
  });
});
