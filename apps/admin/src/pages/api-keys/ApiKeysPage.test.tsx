/**
 * Page-level integration test of `/api-keys`.
 *
 * This is the test that proves the whole loop of AIS-116: URL → `useListParams`
 * → `useApiKeysQuery` → `DataTable` / `Pagination` → URL. The mock point is the
 * **network** (MSW, decision `D1`), so the real service, transport and hooks all
 * run; only the wire is replaced.
 *
 * A `SearchProbe` publishes `location.search`, which is how a test asserts what
 * the pager and the sort header actually wrote into the URL — the URL is the
 * source of truth of the list state, so that is the observable that matters.
 */

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import {
  API_KEYS_PATH,
  FILLED_API_KEY,
  VALID_API_KEY_PAIR,
  toPaginationMeta,
} from '@callback/shared';
import { PAGINATION_NEXT_LABEL } from '@callback/ui';
import {
  apiKeysListEmpty,
  apiKeysListServerError,
} from '../../test/mocks/handlers/api-keys.handlers.js';
import { successResponse } from '../../test/mocks/handlers/handler-envelope.js';
import { renderWithProviders } from '../../test/mocks/render-with-providers.js';
import { server } from '../../test/mocks/server.js';
import {
  API_KEYS_CREATE_LABEL,
  API_KEYS_CREATE_ROUTE_PATH,
  API_KEYS_EMPTY_MESSAGE,
  API_KEYS_ERROR_TITLE,
  API_KEYS_PAGE_TITLE,
  API_KEY_COLUMNS,
  API_KEY_FORM_LABELS,
} from './api-keys.const.js';
import { ApiKeysPage } from './ApiKeysPage.js';

/**
 * Total the mocked pager reports.
 *
 * Deliberately larger than the two fixture rows: the point of the test is the
 * pager and the sort round-trip, so the control must have a second page to go to.
 */
const MOCK_TOTAL_ROWS = 137;

/** Publishes the current `location.search` for assertions. */
function SearchProbe(): ReactNode {
  const location = useLocation();

  return <div data-testid="search">{location.search}</div>;
}

/**
 * @param initialEntry - the URL the memory router starts at.
 * @returns the render result.
 */
function renderPage(initialEntry = '/api-keys') {
  return renderWithProviders(
    <>
      <SearchProbe />
      <ApiKeysPage />
    </>,
    { initialEntries: [initialEntry] },
  );
}

/** @returns the current `location.search`. */
function currentSearch(): string {
  return screen.getByTestId('search').textContent ?? '';
}

/**
 * Replaces the list handler with one that echoes the requested page and records
 * every requested query string.
 *
 * @returns the recorded query strings, appended in request order.
 */
function recordListRequests(): string[] {
  const queries: string[] = [];

  server.use(
    http.get(API_KEYS_PATH, ({ request }) => {
      const url = new URL(request.url);
      const page = Number(url.searchParams.get('page') ?? '1');
      queries.push(url.search);

      return successResponse(VALID_API_KEY_PAIR, {
        pagination: toPaginationMeta({ page, limit: 20 }, MOCK_TOTAL_ROWS),
      });
    }),
  );

  return queries;
}

describe('ApiKeysPage', () => {
  it('renders the rows the list endpoint returned', async () => {
    renderPage();

    expect(await screen.findByText(FILLED_API_KEY.name)).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('sends the page of a deep link', async () => {
    const queries = recordListRequests();
    renderPage('/api-keys?page=2');

    await waitFor(() => {
      expect(queries).not.toHaveLength(0);
    });
    expect(queries[queries.length - 1]).toContain('page=2');
  });

  it('writes the next page into the URL and requests it', async () => {
    const queries = recordListRequests();
    renderPage();

    await screen.findByText(FILLED_API_KEY.name);
    await userEvent.click(
      screen.getByRole('button', { name: PAGINATION_NEXT_LABEL }),
    );

    await waitFor(() => {
      expect(currentSearch()).toContain('page=2');
    });
    await waitFor(() => {
      expect(queries[queries.length - 1]).toContain('page=2');
    });
  });

  it('writes sort and order together and resets the page', async () => {
    recordListRequests();
    renderPage('/api-keys?page=2');

    await screen.findByText(FILLED_API_KEY.name);
    await userEvent.click(
      screen.getByRole('button', { name: API_KEY_COLUMNS.name }),
    );

    await waitFor(() => {
      const search = new URLSearchParams(currentSearch());

      expect(search.get('sort')).toBe('name');
      expect(search.get('order')).toBe('asc');
      expect(search.get('page')).toBeNull();
    });
  });

  it('renders the empty state for an empty page', async () => {
    server.use(apiKeysListEmpty);
    renderPage();

    expect(await screen.findByText(API_KEYS_EMPTY_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders the page error state when the list fails', async () => {
    server.use(apiKeysListServerError);
    renderPage();

    expect(await screen.findByText(API_KEYS_ERROR_TITLE)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders the create action next to the page title and no inline form', async () => {
    renderPage();

    await screen.findByText(FILLED_API_KEY.name);

    const createLink = screen.getByRole('link', {
      name: API_KEYS_CREATE_LABEL,
    });

    expect(createLink).toHaveAttribute('href', API_KEYS_CREATE_ROUTE_PATH);
    // AIS-155: the create form moved into the `/api-keys/new` overlay, so the
    // list page itself must not render a single input.
    expect(
      screen.queryByLabelText(API_KEY_FORM_LABELS.name),
    ).not.toBeInTheDocument();
  });

  it('renders the list at the titles level, inside the shared page shell', async () => {
    renderPage();

    const table = await screen.findByRole('table');
    const heading = screen.getByRole('heading', {
      level: 1,
      name: API_KEYS_PAGE_TITLE,
    });

    // AIS-171: the table is the `PageShell` `children` slot, so it comes after
    // the heading and never inside the header row.
    expect(
      (heading.compareDocumentPosition(table) &
        Node.DOCUMENT_POSITION_FOLLOWING) !==
        0,
    ).toBe(true);
    expect(heading.closest('header')?.contains(table)).toBe(false);
  });

  it('links every row to the read-only overlay of that key', async () => {
    renderPage();

    const rowLink = await screen.findByRole('link', {
      name: FILLED_API_KEY.name,
    });

    expect(rowLink).toHaveAttribute(
      'href',
      `/api-keys/${FILLED_API_KEY.identifier}/view`,
    );
  });

  it('renders no pager until the first response arrives', async () => {
    recordListRequests();
    renderPage();

    expect(
      screen.queryByRole('button', { name: PAGINATION_NEXT_LABEL }),
    ).not.toBeInTheDocument();

    await screen.findByText(FILLED_API_KEY.name);

    expect(
      screen.getByRole('button', { name: PAGINATION_NEXT_LABEL }),
    ).toBeInTheDocument();
  });
});
