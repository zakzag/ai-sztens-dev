/**
 * Tests of the create form.
 *
 * The mock point is the **network**, not the service (MSW harness, decision
 * `D1`): the form runs the real mutation hook + transport, and only the wire is
 * replaced by the handlers in `test/mocks/handlers`. A request recorder captures
 * the intercepted payload where the old service double used to assert the call.
 *
 * Covered: client-side validation (nothing is submitted), the exact payload of
 * a successful submit, the form reset, the field-level 409, a page-level 5xx
 * and the pending state.
 */

import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { API_KEY_IDENTIFIER_CONFLICT_MESSAGE } from '../../../features/api-keys/api-keys.const.js';
import {
  FIELD_INVALID_MESSAGE,
  SERVER_ERROR_MESSAGE,
  VALIDATION_MESSAGE,
} from '../../../lib/error-message.const.js';
import {
  apiKeysCreateConflict,
  apiKeysCreateFieldValidation,
  apiKeysCreateLegacyConflict,
  apiKeysCreateMultiFieldValidation,
  apiKeysCreatePending,
  apiKeysCreateServerError,
} from '../../../test/mocks/handlers/api-keys.handlers.js';
import { createRequestRecorder } from '../../../test/mocks/request-recorder.js';
import { server } from '../../../test/mocks/server.js';
import {
  API_KEY_FORM_ERROR_TITLE,
  API_KEY_FORM_LABELS,
  API_KEY_FORM_PENDING_LABEL,
  API_KEY_FORM_SUBMIT_LABEL,
  API_KEY_FORM_SUCCESS_MESSAGE,
  API_KEY_FORM_VALIDATION_MESSAGES,
} from '../api-keys.const.js';
import { ApiKeyForm } from './ApiKeyForm.js';
import { renderWithProviders } from '../../../test/mocks/render-with-providers.js';

/** Renders the form inside the full provider chain. */
function renderForm() {
  return renderWithProviders(<ApiKeyForm />);
}

/** @returns the submit button of the form. */
function getSubmitButton(): HTMLElement {
  return screen.getByRole('button', { name: API_KEY_FORM_SUBMIT_LABEL });
}

/**
 * Fills the three required fields with valid values.
 *
 * @param overrides - values that differ from the defaults.
 */
async function fillRequiredFields(
  overrides: {
    readonly name?: string;
    readonly identifier?: string;
    readonly apiKey?: string;
  } = {},
): Promise<void> {
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
    server.resetHandlers();
  });

  it('blocks the submit and reports every missing required field', async () => {
    const recorder = createRequestRecorder();

    renderForm();

    await userEvent.click(getSubmitButton());

    expect(
      await screen.findByText(API_KEY_FORM_VALIDATION_MESSAGES.nameRequired),
    ).toBeInTheDocument();
    expect(
      screen.getByText(API_KEY_FORM_VALIDATION_MESSAGES.identifierRequired),
    ).toBeInTheDocument();
    expect(
      screen.getByText(API_KEY_FORM_VALIDATION_MESSAGES.apiKeyRequired),
    ).toBeInTheDocument();
    expect(recorder.requests).toHaveLength(0);

    recorder.stop();
  });

  it('rejects an identifier that the backend would refuse', async () => {
    const recorder = createRequestRecorder();

    renderForm();

    await fillRequiredFields({ identifier: 'vapi staging' });
    await userEvent.click(getSubmitButton());

    expect(
      await screen.findByText(
        API_KEY_FORM_VALIDATION_MESSAGES.identifierInvalid,
      ),
    ).toBeInTheDocument();
    expect(recorder.requests).toHaveLength(0);

    recorder.stop();
  });

  it('submits the mapped payload, shows the success alert and resets the fields', async () => {
    const recorder = createRequestRecorder();

    renderForm();

    await fillRequiredFields();
    await userEvent.click(getSubmitButton());

    expect(
      await screen.findByText(API_KEY_FORM_SUCCESS_MESSAGE),
    ).toBeInTheDocument();

    await waitFor(() => {
      const posts = recorder.requests.filter(
        (record) => record.method === 'POST',
      );
      expect(posts).toHaveLength(1);
      expect(posts[0]?.body).toEqual({
        name: 'Vapi staging',
        identifier: 'vapi-staging',
        apiKey: 'sk-stage-42',
      });
    });

    expect(screen.getByLabelText(API_KEY_FORM_LABELS.name)).toHaveValue('');
    expect(screen.getByLabelText(API_KEY_FORM_LABELS.identifier)).toHaveValue(
      '',
    );
    expect(screen.getByLabelText(API_KEY_FORM_LABELS.apiKey)).toHaveValue('');

    recorder.stop();
  });

  it('sends the description and the expiry as an ISO instant when they are filled', async () => {
    const recorder = createRequestRecorder();

    renderForm();

    await fillRequiredFields();
    await userEvent.type(
      screen.getByLabelText(API_KEY_FORM_LABELS.description),
      'Éles kulcs',
    );
    fireEvent.change(screen.getByLabelText(API_KEY_FORM_LABELS.expiresAt), {
      target: { value: '2027-01-31' },
    });
    await userEvent.click(getSubmitButton());

    await screen.findByText(API_KEY_FORM_SUCCESS_MESSAGE);

    await waitFor(() => {
      const post = recorder.requests.find((record) => record.method === 'POST');
      expect(post).toBeDefined();
    });

    const payload = recorder.requests.find(
      (record) => record.method === 'POST',
    )?.body as { readonly description?: string; readonly expiresAt?: string };

    expect(payload?.description).toBe('Éles kulcs');
    expect(payload?.expiresAt).toBeDefined();

    const expiry = new Date(payload?.expiresAt ?? '');

    expect(expiry.getFullYear()).toBe(2027);
    expect(expiry.getMonth()).toBe(0);
    expect(expiry.getDate()).toBe(31);

    recorder.stop();
  });

  it('maps a 409 onto the identifier field instead of the page', async () => {
    server.use(apiKeysCreateConflict);

    renderForm();

    await fillRequiredFields();
    await userEvent.click(getSubmitButton());

    expect(
      await screen.findByText(API_KEY_IDENTIFIER_CONFLICT_MESSAGE),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(API_KEY_FORM_ERROR_TITLE),
    ).not.toBeInTheDocument();
    expect(
      screen.getByLabelText(API_KEY_FORM_LABELS.identifier),
    ).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows a page-level error for a non-conflict failure', async () => {
    server.use(apiKeysCreateServerError);

    renderForm();

    await fillRequiredFields();
    await userEvent.click(getSubmitButton());

    expect(
      await screen.findByText(API_KEY_FORM_ERROR_TITLE),
    ).toBeInTheDocument();
    expect(screen.getByText(SERVER_ERROR_MESSAGE)).toBeInTheDocument();
    expect(
      screen.queryByText(API_KEY_IDENTIFIER_CONFLICT_MESSAGE),
    ).not.toBeInTheDocument();
    expect(
      screen.getByLabelText(API_KEY_FORM_LABELS.identifier),
    ).not.toHaveAttribute('aria-invalid');
  });

  it('keeps a legacy 409 without details on the identifier field', async () => {
    server.use(apiKeysCreateLegacyConflict);

    renderForm();

    await fillRequiredFields();
    await userEvent.click(getSubmitButton());

    expect(
      await screen.findByText(API_KEY_IDENTIFIER_CONFLICT_MESSAGE),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(API_KEY_FORM_LABELS.identifier),
    ).toHaveAttribute('aria-invalid', 'true');
    expect(
      screen.queryByText(API_KEY_FORM_ERROR_TITLE),
    ).not.toBeInTheDocument();
  });

  it('puts every addressable field of a 400 on its own input', async () => {
    server.use(apiKeysCreateMultiFieldValidation);

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
    server.use(apiKeysCreateFieldValidation);

    renderForm();

    await fillRequiredFields();
    await userEvent.click(getSubmitButton());

    expect(await screen.findByText(FIELD_INVALID_MESSAGE)).toBeInTheDocument();
    expect(
      screen.getByLabelText(API_KEY_FORM_LABELS.identifier),
    ).toHaveAttribute('aria-invalid', 'true');
    expect(
      screen.queryByText(API_KEY_FORM_ERROR_TITLE),
    ).not.toBeInTheDocument();
  });

  it('re-enables the submit button after a field-level failure', async () => {
    server.use(apiKeysCreateConflict);

    renderForm();

    await fillRequiredFields();
    await userEvent.click(getSubmitButton());

    await screen.findByText(API_KEY_IDENTIFIER_CONFLICT_MESSAGE);

    await waitFor(() => {
      expect(getSubmitButton()).toBeEnabled();
    });
  });

  it('never renders the server text of a 5xx', async () => {
    server.use(apiKeysCreateServerError);

    renderForm();

    await fillRequiredFields();
    await userEvent.click(getSubmitButton());

    expect(await screen.findByText(SERVER_ERROR_MESSAGE)).toBeInTheDocument();
    expect(
      screen.queryByText(/Database is unavailable/),
    ).not.toBeInTheDocument();
  });

  it('disables the submit and shows the pending label while the request is in flight', async () => {
    server.use(apiKeysCreatePending);

    renderForm();

    await fillRequiredFields();
    await userEvent.click(getSubmitButton());

    const pendingButton = await screen.findByRole('button', {
      name: API_KEY_FORM_PENDING_LABEL,
    });

    expect(pendingButton).toBeDisabled();
  });
});
