/**
 * Tests of the create form.
 *
 * The service module is replaced at the boundary, so the form is exercised
 * against the shared double and no request is made. Covered: client-side
 * validation (nothing is submitted), the exact payload of a successful submit,
 * the form reset, the field-level 409, a page-level 5xx and the pending state.
 */

import type { QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_KEY_IDENTIFIER_CONFLICT_MESSAGE } from '../../../features/api-keys/api-keys.const.js';
import {
  FIELD_INVALID_MESSAGE,
  SERVER_ERROR_MESSAGE,
  VALIDATION_MESSAGE,
} from '../../../lib/error-message.const.js';
import {
  createConflictError,
  createLegacyConflictError,
  createMultiFieldValidationError,
  createServerError,
  createValidationError,
} from '../../../test/mocks/api-error.mock.js';
import {
  API_KEYS_SERVICE_MOCK,
  resetApiKeysServiceMock,
} from '../../../test/mocks/api-keys.mock.js';
import {
  createTestQueryClient,
  TestQueryProvider,
} from '../../../test/mocks/query-client.mock.js';
import {
  API_KEY_FORM_ERROR_TITLE,
  API_KEY_FORM_LABELS,
  API_KEY_FORM_PENDING_LABEL,
  API_KEY_FORM_SUBMIT_LABEL,
  API_KEY_FORM_SUCCESS_MESSAGE,
  API_KEY_FORM_VALIDATION_MESSAGES,
} from '../api-keys.const.js';
import { ApiKeyForm } from './ApiKeyForm.js';

/**
 * Replaces the composition root so the mutation talks to the double. The factory
 * imports the mock module dynamically because `vi.mock` calls are hoisted.
 */
vi.mock('../../../services/api-client.js', async () => {
  const { API_KEYS_SERVICE_MOCK: serviceMock } = await import(
    '../../../test/mocks/api-keys.mock.js'
  );

  return { apiKeysService: serviceMock.service };
});

/**
 * @returns the rendered form inside an isolated query context.
 */
function renderForm(): { client: QueryClient } {
  const client = createTestQueryClient();

  render(
    <TestQueryProvider client={client}>
      <ApiKeyForm />
    </TestQueryProvider>,
  );

  return { client };
}

/**
 * @returns the submit button of the form.
 */
function getSubmitButton(): HTMLElement {
  return screen.getByRole('button', { name: API_KEY_FORM_SUBMIT_LABEL });
}

/**
 * Fills the three required fields with valid values.
 *
 * @param overrides - values that differ from the defaults.
 */
async function fillRequiredFields(overrides: {
  readonly name?: string;
  readonly identifier?: string;
  readonly apiKey?: string;
} = {}): Promise<void> {
  await userEvent.type(
    screen.getByLabelText(API_KEY_FORM_LABELS.name),
    overrides.name ?? 'Vapi staging',
  );
  await userEvent.type(
    screen.getByLabelText(API_KEY_FORM_LABELS.identifier),
    overrides.identifier ?? 'vapi-staging',
  );
  await userEvent.type(
    screen.getByLabelText(API_KEY_FORM_LABELS.apiKey),
    overrides.apiKey ?? 'sk-stage-42',
  );
}

describe('ApiKeyForm', () => {
  beforeEach(() => {
    resetApiKeysServiceMock();
  });

  it('blocks the submit and reports every missing required field', async () => {
    renderForm();

    await userEvent.click(getSubmitButton());

    expect(await screen.findByText(API_KEY_FORM_VALIDATION_MESSAGES.nameRequired)).toBeInTheDocument();
    expect(
      screen.getByText(API_KEY_FORM_VALIDATION_MESSAGES.identifierRequired),
    ).toBeInTheDocument();
    expect(screen.getByText(API_KEY_FORM_VALIDATION_MESSAGES.apiKeyRequired)).toBeInTheDocument();
    expect(API_KEYS_SERVICE_MOCK.createMock).not.toHaveBeenCalled();
  });

  it('rejects an identifier that the backend would refuse', async () => {
    renderForm();

    await fillRequiredFields({ identifier: 'vapi staging' });
    await userEvent.click(getSubmitButton());

    expect(
      await screen.findByText(API_KEY_FORM_VALIDATION_MESSAGES.identifierInvalid),
    ).toBeInTheDocument();
    expect(API_KEYS_SERVICE_MOCK.createMock).not.toHaveBeenCalled();
  });

  it('submits the mapped payload, shows the success alert and resets the fields', async () => {
    renderForm();

    await fillRequiredFields();
    await userEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(API_KEYS_SERVICE_MOCK.createMock).toHaveBeenCalledTimes(1);
    });

    expect(API_KEYS_SERVICE_MOCK.createMock).toHaveBeenCalledWith({
      name: 'Vapi staging',
      identifier: 'vapi-staging',
      apiKey: 'sk-stage-42',
    });

    expect(await screen.findByText(API_KEY_FORM_SUCCESS_MESSAGE)).toBeInTheDocument();
    expect(screen.getByLabelText(API_KEY_FORM_LABELS.name)).toHaveValue('');
    expect(screen.getByLabelText(API_KEY_FORM_LABELS.identifier)).toHaveValue('');
    expect(screen.getByLabelText(API_KEY_FORM_LABELS.apiKey)).toHaveValue('');
  });

  it('sends the description and the expiry as an ISO instant when they are filled', async () => {
    renderForm();

    await fillRequiredFields();
    await userEvent.type(screen.getByLabelText(API_KEY_FORM_LABELS.description), 'Éles kulcs');
    fireEvent.change(screen.getByLabelText(API_KEY_FORM_LABELS.expiresAt), {
      target: { value: '2027-01-31' },
    });
    await userEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(API_KEYS_SERVICE_MOCK.createMock).toHaveBeenCalledTimes(1);
    });

    const payload = API_KEYS_SERVICE_MOCK.createMock.mock.calls[0]?.[0];

    expect(payload?.description).toBe('Éles kulcs');
    expect(payload?.expiresAt).toBeDefined();

    const expiry = new Date(payload?.expiresAt ?? '');

    expect(expiry.getFullYear()).toBe(2027);
    expect(expiry.getMonth()).toBe(0);
    expect(expiry.getDate()).toBe(31);
  });

  it('maps a 409 onto the identifier field instead of the page', async () => {
    API_KEYS_SERVICE_MOCK.createMock.mockRejectedValueOnce(createConflictError());

    renderForm();

    await fillRequiredFields();
    await userEvent.click(getSubmitButton());

    expect(await screen.findByText(API_KEY_IDENTIFIER_CONFLICT_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(API_KEY_FORM_ERROR_TITLE)).not.toBeInTheDocument();
    expect(screen.getByLabelText(API_KEY_FORM_LABELS.identifier)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('shows a page-level error for a non-conflict failure', async () => {
    API_KEYS_SERVICE_MOCK.createMock.mockRejectedValueOnce(createServerError());

    renderForm();

    await fillRequiredFields();
    await userEvent.click(getSubmitButton());

    expect(await screen.findByText(API_KEY_FORM_ERROR_TITLE)).toBeInTheDocument();
    expect(screen.getByText(SERVER_ERROR_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(API_KEY_IDENTIFIER_CONFLICT_MESSAGE)).not.toBeInTheDocument();
    expect(screen.getByLabelText(API_KEY_FORM_LABELS.identifier)).not.toHaveAttribute(
      'aria-invalid',
    );
  });

  it('keeps a legacy 409 without details on the identifier field', async () => {
    API_KEYS_SERVICE_MOCK.createMock.mockRejectedValueOnce(createLegacyConflictError());

    renderForm();

    await fillRequiredFields();
    await userEvent.click(getSubmitButton());

    expect(await screen.findByText(API_KEY_IDENTIFIER_CONFLICT_MESSAGE)).toBeInTheDocument();
    expect(screen.getByLabelText(API_KEY_FORM_LABELS.identifier)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.queryByText(API_KEY_FORM_ERROR_TITLE)).not.toBeInTheDocument();
  });

  it('puts every addressable field of a 400 on its own input', async () => {
    API_KEYS_SERVICE_MOCK.createMock.mockRejectedValueOnce(
      createMultiFieldValidationError(),
    );

    renderForm();

    await fillRequiredFields();
    await userEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(screen.getAllByText(FIELD_INVALID_MESSAGE)).toHaveLength(2);
    });

    expect(screen.getByLabelText(API_KEY_FORM_LABELS.name)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.getByLabelText(API_KEY_FORM_LABELS.apiKey)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    // The path no input owns is the only thing the page alert carries.
    expect(screen.getByText(API_KEY_FORM_ERROR_TITLE)).toBeInTheDocument();
    expect(screen.getByText(VALIDATION_MESSAGE)).toBeInTheDocument();
  });

  it('shows no page alert when the server blamed a field only', async () => {
    API_KEYS_SERVICE_MOCK.createMock.mockRejectedValueOnce(createValidationError());

    renderForm();

    await fillRequiredFields();
    await userEvent.click(getSubmitButton());

    expect(await screen.findByText(FIELD_INVALID_MESSAGE)).toBeInTheDocument();
    expect(screen.getByLabelText(API_KEY_FORM_LABELS.identifier)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.queryByText(API_KEY_FORM_ERROR_TITLE)).not.toBeInTheDocument();
  });

  it('re-enables the submit button after a field-level failure', async () => {
    API_KEYS_SERVICE_MOCK.createMock.mockRejectedValueOnce(createConflictError());

    renderForm();

    await fillRequiredFields();
    await userEvent.click(getSubmitButton());

    await screen.findByText(API_KEY_IDENTIFIER_CONFLICT_MESSAGE);

    await waitFor(() => {
      expect(getSubmitButton()).toBeEnabled();
    });
  });

  it('never renders the server text of a 5xx', async () => {
    API_KEYS_SERVICE_MOCK.createMock.mockRejectedValueOnce(createServerError(500, true));

    renderForm();

    await fillRequiredFields();
    await userEvent.click(getSubmitButton());

    expect(await screen.findByText(SERVER_ERROR_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(/Database is unavailable/)).not.toBeInTheDocument();
  });

  it('disables the submit and shows the pending label while the request is in flight', async () => {
    API_KEYS_SERVICE_MOCK.createMock.mockImplementationOnce(
      () => new Promise(() => undefined),
    );

    renderForm();

    await fillRequiredFields();
    await userEvent.click(getSubmitButton());

    const pendingButton = await screen.findByRole('button', {
      name: API_KEY_FORM_PENDING_LABEL,
    });

    expect(pendingButton).toBeDisabled();
  });
});
