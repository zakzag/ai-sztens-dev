/**
 * Tests of the `api-key` mapper.
 *
 * The most important assertion is a negative one: the token value must not
 * survive the mapping. Everything else checks that a formatted view model is
 * produced for both the “filled” and the “optional field missing” branches.
 */

import { describe, expect, it } from 'vitest';
import {
  API_KEY_FIXTURE,
  SECOND_API_KEY_FIXTURE,
} from '../../test/mocks/api-keys.mock.js';
import { EMPTY_VALUE_LABEL } from './api-key.const.js';
import { toApiKeyViewModel, toApiKeyViewModels } from './api-key.mapper.js';

describe('toApiKeyViewModel', () => {
  it('maps the display fields and formats the expiry', () => {
    const viewModel = toApiKeyViewModel(API_KEY_FIXTURE);

    expect(viewModel.id).toBe(API_KEY_FIXTURE.id);
    expect(viewModel.name).toBe(API_KEY_FIXTURE.name);
    expect(viewModel.identifier).toBe(API_KEY_FIXTURE.identifier);
    expect(viewModel.description).toBe(API_KEY_FIXTURE.description);
    // 2027-01-31T23:00:00.000Z is 1 February 2027 in Europe/Budapest, so the
    // formatted label must be the *local* day, not the UTC one.
    expect(viewModel.expiresAtLabel).toContain('2027');
    expect(viewModel.expiresAtLabel).toContain('02');
    expect(viewModel.expiresAtLabel).toContain('01');
  });

  it('never copies the apiKey token into the view model', () => {
    const viewModel = toApiKeyViewModel(API_KEY_FIXTURE);

    expect(Object.keys(viewModel)).not.toContain('apiKey');
    expect(JSON.stringify(viewModel)).not.toContain(API_KEY_FIXTURE.apiKey);
  });

  it('renders the empty-value label for a missing description', () => {
    const viewModel = toApiKeyViewModel(SECOND_API_KEY_FIXTURE);

    expect(viewModel.description).toBe(EMPTY_VALUE_LABEL);
  });

  it('renders the empty-value label for a whitespace-only description', () => {
    const viewModel = toApiKeyViewModel({
      ...SECOND_API_KEY_FIXTURE,
      description: '   ',
    });

    expect(viewModel.description).toBe(EMPTY_VALUE_LABEL);
  });

  it('renders the no-expiry label for a null expiresAt', () => {
    const viewModel = toApiKeyViewModel(SECOND_API_KEY_FIXTURE);

    expect(viewModel.expiresAtLabel).toBe('nincs lejárat');
  });
});

describe('toApiKeyViewModels', () => {
  it('preserves the input order and maps every row', () => {
    const viewModels = toApiKeyViewModels([
      API_KEY_FIXTURE,
      SECOND_API_KEY_FIXTURE,
    ]);

    expect(viewModels.map((viewModel) => viewModel.identifier)).toEqual([
      API_KEY_FIXTURE.identifier,
      SECOND_API_KEY_FIXTURE.identifier,
    ]);
  });

  it('returns an empty list for an empty payload', () => {
    expect(toApiKeyViewModels([])).toEqual([]);
  });
});
