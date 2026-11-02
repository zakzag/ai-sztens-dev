/**
 * Tests of the API key table.
 *
 * The component is props-driven, so every data state is one `render` away and no
 * service or query client is involved. The failed-read state is *not* covered
 * here: it belongs to the page (`PageErrorState`), see its own test file.
 *
 * The negative assertion — the token must not appear in the DOM — is checked
 * against the fixtures the view models were built from. Fixtures come from the
 * shared contract (`@callback/shared`), the single source of sample rows.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  FILLED_API_KEY,
  SECOND_API_KEY,
  VALID_API_KEY_PAIR,
} from '@callback/shared';
import { toApiKeyViewModels } from '../../../entities/api-key/api-key.mapper.js';
import {
  API_KEYS_EMPTY_MESSAGE,
  API_KEYS_LOADING_MESSAGE,
  API_KEY_COLUMNS,
} from '../api-keys.const.js';
import { ApiKeysTable } from './ApiKeysTable.js';

/** View models of both fixtures, as the page would pass them. */
const VIEW_MODELS = toApiKeyViewModels(VALID_API_KEY_PAIR);

describe('ApiKeysTable', () => {
  it('renders the loading message and no table', () => {
    render(<ApiKeysTable apiKeys={[]} isLoading />);

    expect(screen.getByText(API_KEYS_LOADING_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders the empty state when the list is empty', () => {
    render(<ApiKeysTable apiKeys={[]} isLoading={false} />);

    expect(screen.getByText(API_KEYS_EMPTY_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders one row per key with the column headers', () => {
    render(<ApiKeysTable apiKeys={VIEW_MODELS} isLoading={false} />);

    expect(
      screen.getByRole('columnheader', { name: API_KEY_COLUMNS.name }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: API_KEY_COLUMNS.identifier }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: API_KEY_COLUMNS.description }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: API_KEY_COLUMNS.expiresAt }),
    ).toBeInTheDocument();

    expect(screen.getAllByRole('row')).toHaveLength(VIEW_MODELS.length + 1);
    expect(screen.getByText(FILLED_API_KEY.name)).toBeInTheDocument();
    expect(screen.getByText(FILLED_API_KEY.identifier)).toBeInTheDocument();
    expect(screen.getByText(SECOND_API_KEY.identifier)).toBeInTheDocument();
  });

  it('renders the fallback for a key without description and without expiry', () => {
    render(<ApiKeysTable apiKeys={VIEW_MODELS} isLoading={false} />);

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('nincs lejárat')).toBeInTheDocument();
  });

  it('never renders the apiKey token value', () => {
    const { container } = render(
      <ApiKeysTable apiKeys={VIEW_MODELS} isLoading={false} />,
    );

    expect(container.textContent).not.toContain(FILLED_API_KEY.apiKey);
    expect(container.textContent).not.toContain(SECOND_API_KEY.apiKey);
  });
});
