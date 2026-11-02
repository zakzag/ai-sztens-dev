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
import { EMPTY_VALUE_LABEL } from './api-key.const.js';
import { toApiKeyViewModel, toApiKeyViewModels } from './api-key.mapper.js';

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
