/**
 * Tests of the create form — the reference wiring of the shared form pattern
 * (AIS-115) into the notification system (AIS-85).
 *
 * The mock point is the **network**, not the service (MSW harness, decision
 * `D1`): the form runs the real mutation hook + transport, and only the wire is
 * replaced by the handlers in `test/mocks/handlers`. A request recorder captures
 * the intercepted payload where the old service double used to assert the call.
 *
 * Because `renderWithProviders` now mounts the provider **and** the host with the
 * real capture adapters bound to its store, every assertion below is about the
 * single-visible-surface rule of AIS-85:
 *
 * | outcome                | field | page `Alert` | toast | log entry |
 * | ---------------------- | ----- | ------------ | ----- | --------- |
 * | success                | —     | —            | yes   | yes       |
 * | `409`/`400` addressed  | yes   | —            | —     | yes       |
 * | `400` with residue     | yes   | yes          | —     | yes       |
 * | `5xx` / network        | —     | —            | yes   | yes       |
 */

import {
  API_KEY_NAME_MAX_LENGTH,
  VALIDATION_MESSAGE_CATALOGUE,
  formatMessage,
} from '@callback/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  API_KEYS_QUERY_KEYS,
  API_KEY_IDENTIFIER_CONFLICT_MESSAGE,
} from '../../../features/api-keys/api-keys.const.js';
import {
  FIELD_INVALID_MESSAGE,
  IDENTIFIER_CONFLICT_MESSAGE,
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
import {
  renderWithProviders,
  type RenderWithProvidersResult,
} from '../../../test/mocks/render-with-providers.js';
import { server } from '../../../test/mocks/server.js';
import {
  API_KEY_FORM_ERROR_TITLE,
  API_KEY_FORM_LABELS,
  API_KEY_FORM_PENDING_LABEL,
  API_KEY_FORM_SUBMIT_LABEL,
  API_KEY_FORM_SUCCESS_MESSAGE,
} from '../api-keys.const.js';
import { ApiKeyForm } from './ApiKeyForm.js';

/** Hungarian validation copy, i.e. what this bundle renders (AIS-112 `D2`). */
const HUNGARIAN_VALIDATION = VALIDATION_MESSAGE_CATALOGUE.hu;

/** The seed key the invalidation assertions watch. */
const SEEDED_LIST_KEY = API_KEYS_QUERY_KEYS.all;

/** Renders the form inside the full provider chain (provider + host). */
function renderForm(): RenderWithProvidersResult {
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

  it('blocks the submit and reports every missing required field in Hungarian', async () => {
    const recorder = createRequestRecorder();
    const rendered = renderForm();

    await userEvent.click(getSubmitButton());

    // The sentence comes from the shared catalogue (AIS-112): the form owns no
    // validation copy of its own any more, so all three fields share it.
    const requiredMessages = await screen.findAllByText(
      HUNGARIAN_VALIDATION.REQUIRED,
    );

    expect(requiredMessages).toHaveLength(3);
    expect(recorder.requests).toHaveLength(0);
    // A client-side rejection is not an event: nothing is announced or logged.
    expect(rendered.notifications.store.getSnapshot().entries).toHaveLength(0);

    recorder.stop();
  });

  it('rejects an identifier that the backend would refuse', async () => {
    const recorder = createRequestRecorder();

    renderForm();

    await fillRequiredFields({ identifier: 'vapi staging' });
    await userEvent.click(getSubmitButton());

    expect(
      await screen.findByText(HUNGARIAN_VALIDATION.IDENTIFIER),
    ).toBeInTheDocument();
    expect(recorder.requests).toHaveLength(0);

    recorder.stop();
  });

  it('renders the shared too-long copy for a name over the contract limit', async () => {
    const recorder = createRequestRecorder();

    renderForm();

    await fillRequiredFields({
      name: 'a'.repeat(API_KEY_NAME_MAX_LENGTH + 1),
    });
    await userEvent.click(getSubmitButton());

    // This message is produced by the zod-generated `too_big` issue, i.e. by
    // `VALIDATION_ERROR_MAP` — not by a hand-written string in the component.
    expect(
      await screen.findByText(
        formatMessage(HUNGARIAN_VALIDATION.TOO_LONG_TEMPLATE, {
          max: API_KEY_NAME_MAX_LENGTH,
        }),
      ),
    ).toBeInTheDocument();
    expect(recorder.requests).toHaveLength(0);

    recorder.stop();
  });

  it('submits the mapped payload, toasts once, logs once and resets the fields', async () => {
    const recorder = createRequestRecorder();
    const rendered = renderForm();
    // The invalidation of the list prefix is what refreshes the table, so the
    // real client method is watched instead of a seeded cache entry (the test
    // client has `gcTime: 0`, so an unobserved query would be collected).
    const invalidate = vi.spyOn(rendered.client, 'invalidateQueries');

    await fillRequiredFields();
    await userEvent.click(getSubmitButton());

    // One visible surface: the success text is the toast body.
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

    // Exactly one toast and exactly one log entry for one submit.
    const state = rendered.notifications.store.getSnapshot();

    expect(state.toasts).toHaveLength(1);
    expect(state.entries).toHaveLength(1);
    expect(state.entries[0]?.level).toBe('success');
    expect(state.entries[0]?.message).toBe(API_KEY_FORM_SUCCESS_MESSAGE);
    expect(state.entries[0]?.source).toBe('manual');

    // The list prefix was invalidated, so the table cannot show a stale page.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: SEEDED_LIST_KEY });

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

    const payload = recorder.requests.find((record) => record.method === 'POST')
      ?.body as { readonly description?: string; readonly expiresAt?: string };

    expect(payload?.description).toBe('Éles kulcs');
    expect(payload?.expiresAt).toBeDefined();

    const expiry = new Date(payload?.expiresAt ?? '');

    expect(expiry.getFullYear()).toBe(2027);
    expect(expiry.getMonth()).toBe(0);
    expect(expiry.getDate()).toBe(31);

    recorder.stop();
  });

  it('puts a 409 on the identifier field, focuses it and announces nothing', async () => {
    server.use(apiKeysCreateConflict);

    const rendered = renderForm();

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
    expect(document.activeElement).toBe(
      screen.getByLabelText(API_KEY_FORM_LABELS.identifier),
    );

    // The failure is addressable, so it is a log entry only — no toast.
    const state = rendered.notifications.store.getSnapshot();

    expect(state.toasts).toHaveLength(0);
    expect(state.entries).toHaveLength(1);
    expect(state.entries[0]?.toast).toBe(false);
    expect(state.entries[0]?.message).toBe(IDENTIFIER_CONFLICT_MESSAGE);
  });

  it('toasts a non-conflict failure and renders no page alert for the same reason', async () => {
    server.use(apiKeysCreateServerError);

    const rendered = renderForm();

    await fillRequiredFields();
    await userEvent.click(getSubmitButton());

    // AIS-85 `D2`: the capture toast is the only surface for a `page` failure.
    expect(await screen.findByText(SERVER_ERROR_MESSAGE)).toBeInTheDocument();
    expect(
      screen.queryByText(API_KEY_FORM_ERROR_TITLE),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(API_KEY_IDENTIFIER_CONFLICT_MESSAGE),
    ).not.toBeInTheDocument();
    expect(
      screen.getByLabelText(API_KEY_FORM_LABELS.identifier),
    ).not.toHaveAttribute('aria-invalid');

    const state = rendered.notifications.store.getSnapshot();

    expect(state.toasts).toHaveLength(1);
    expect(state.entries[0]?.level).toBe('error');
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

  it('puts every addressable field of a 400 on its own input and keeps the residue in one alert', async () => {
    server.use(apiKeysCreateMultiFieldValidation);

    const rendered = renderForm();

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
    // A field-surface failure is log-only: the alert speaks, the toast does not.
    expect(rendered.notifications.store.getSnapshot().toasts).toHaveLength(0);
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
