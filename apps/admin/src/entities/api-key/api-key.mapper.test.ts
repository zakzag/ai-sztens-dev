/**
 * Tests of the `api-key` mapper.
 *
 * The most important assertion is a negative one: the token value must not
 * survive the mapping. Everything else checks that a formatted view model is
 * produced for both the “filled” and the “optional field missing” branches.
 * The fixtures come from the shared contract (`@callback/shared`), the single
 * place that defines sample `ApiKey` rows.
 */

import { describe, expect, it } from 'vitest';
import { FILLED_API_KEY, SECOND_API_KEY } from '@callback/shared';
import { INVALID_EXPIRY_LABEL } from '../../lib/date.const.js';
import {
  EMPTY_VALUE_LABEL,
  EXPIRY_ACTIVE_LABEL,
  EXPIRY_EXPIRED_LABEL,
  EXPIRY_NONE_LABEL,
} from './api-key.const.js';
import {
  toApiKeyDetailViewModel,
  toApiKeyViewModel,
  toApiKeyViewModels,
  toExpiryBadge,
} from './api-key.mapper.js';

/** Fixed clock of the expiry tests, so no assertion depends on the real date. */
const NOW = Date.parse('2026-11-04T12:00:00.000Z');

describe('toApiKeyViewModel', () => {
  it('maps the display fields and formats the expiry', () => {
    const viewModel = toApiKeyViewModel(FILLED_API_KEY);

    expect(viewModel.id).toBe(FILLED_API_KEY.id);
    expect(viewModel.name).toBe(FILLED_API_KEY.name);
    expect(viewModel.identifier).toBe(FILLED_API_KEY.identifier);
    expect(viewModel.description).toBe(FILLED_API_KEY.description);
    // 2027-01-31T23:00:00.000Z is 1 February 2027 in Europe/Budapest, so the
    // formatted label must be the *local* day, not the UTC one.
    expect(viewModel.expiresAtLabel).toContain('2027');
    expect(viewModel.expiresAtLabel).toContain('02');
    expect(viewModel.expiresAtLabel).toContain('01');
  });

  it('never copies the apiKey token into the view model', () => {
    const viewModel = toApiKeyViewModel(FILLED_API_KEY);

    expect(Object.keys(viewModel)).not.toContain('apiKey');
    expect(JSON.stringify(viewModel)).not.toContain(FILLED_API_KEY.apiKey);
  });

  it('renders the empty-value label for a missing description', () => {
    const viewModel = toApiKeyViewModel(SECOND_API_KEY);

    expect(viewModel.description).toBe(EMPTY_VALUE_LABEL);
  });

  it('renders the empty-value label for a whitespace-only description', () => {
    const viewModel = toApiKeyViewModel({
      ...SECOND_API_KEY,
      description: '   ',
    });

    expect(viewModel.description).toBe(EMPTY_VALUE_LABEL);
  });

  it('renders the no-expiry label for a null expiresAt', () => {
    const viewModel = toApiKeyViewModel(SECOND_API_KEY);

    expect(viewModel.expiresAtLabel).toBe('nincs lejárat');
  });
});

describe('toApiKeyViewModels', () => {
  it('preserves the input order and maps every row', () => {
    const viewModels = toApiKeyViewModels([FILLED_API_KEY, SECOND_API_KEY]);

    expect(viewModels.map((viewModel) => viewModel.identifier)).toEqual([
      FILLED_API_KEY.identifier,
      SECOND_API_KEY.identifier,
    ]);
  });

  it('returns an empty list for an empty payload', () => {
    expect(toApiKeyViewModels([])).toEqual([]);
  });
});

describe('toExpiryBadge', () => {
  it('marks a future expiry as active', () => {
    expect(toExpiryBadge('2027-01-31T23:00:00.000Z', NOW)).toEqual({
      status: 'active',
      label: EXPIRY_ACTIVE_LABEL,
      variant: 'success',
    });
  });

  it('marks a past expiry as expired', () => {
    expect(toExpiryBadge('2026-01-01T00:00:00.000Z', NOW)).toEqual({
      status: 'expired',
      label: EXPIRY_EXPIRED_LABEL,
      variant: 'warning',
    });
  });

  it('treats the exact boundary instant as still active', () => {
    // `< now` and not `<= now`: a key that expires *right now* is valid for the
    // request being made at this instant.
    expect(toExpiryBadge(new Date(NOW).toISOString(), NOW).status).toBe('active');
  });

  it('reports a missing expiry as a neutral badge', () => {
    expect(toExpiryBadge(null, NOW)).toEqual({
      status: 'none',
      label: EXPIRY_NONE_LABEL,
      variant: 'neutral',
    });
  });

  it('flags an unparsable timestamp instead of calling it expired', () => {
    expect(toExpiryBadge('not-a-date', NOW)).toEqual({
      status: 'unknown',
      label: INVALID_EXPIRY_LABEL,
      variant: 'warning',
    });
  });
});

describe('toApiKeyDetailViewModel', () => {
  it('maps the display fields and formats both timestamps', () => {
    const viewModel = toApiKeyDetailViewModel(FILLED_API_KEY, NOW);

    expect(viewModel.name).toBe(FILLED_API_KEY.name);
    expect(viewModel.identifier).toBe(FILLED_API_KEY.identifier);
    expect(viewModel.description).toBe(FILLED_API_KEY.description);
    expect(viewModel.createdAtLabel).not.toBe('');
    expect(viewModel.updatedAtLabel).not.toBe('');
    expect(viewModel.expiry.status).toBe('active');
  });

  it('never copies the apiKey token into the detail view model', () => {
    const viewModel = toApiKeyDetailViewModel(FILLED_API_KEY, NOW);

    expect(JSON.stringify(viewModel)).not.toContain(FILLED_API_KEY.apiKey);
  });

  it('renders the fallbacks for a row without description and expiry', () => {
    const viewModel = toApiKeyDetailViewModel(SECOND_API_KEY, NOW);

    expect(viewModel.description).toBe(EMPTY_VALUE_LABEL);
    expect(viewModel.expiry).toEqual({
      status: 'none',
      label: EXPIRY_NONE_LABEL,
      variant: 'neutral',
    });
  });
});
