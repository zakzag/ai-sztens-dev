/**
 * Tests of the edit form (AIS-131, notify port since AIS-136).
 *
 * The write is injected (`submit`), so this suite needs no MSW: it asserts the
 * **contract of the component** — what it prefills, what it submits, and how it
 * distributes a rejection and a success. The end-to-end path (real mutation +
 * transport + handler) is covered by `ApiKeyDetailPage.test.tsx`.
 *
 * Since AIS-136 the form calls `useNotifier()`, so every render goes through
 * `renderWithProviders` (a missing provider would throw). That also gives the
 * assertions something to check: one success toast **and** one log entry per
 * save, and **no** toast for a field-addressable failure.
 *
 * Covered branches: prefill, successful submit with notification, field-addressable
 * rejection with focus and without a toast, a page-level rejection left to the
 * capture toast (AIS-85 `D2`), pending state, and the client-side block of an
 * invalid name.
 */

import { HTTP_STATUS } from '@callback/api-client';
import { VALIDATION_MESSAGE_CATALOGUE } from '@callback/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FIELD_INVALID_MESSAGE } from '../../../lib/error-message.const.js';
import { createCodedError } from '../../../test/mocks/api-error.mock.js';
import { createDeferred } from '../../../test/mocks/deferred.mock.js';
import {
  renderWithProviders,
  type RenderWithProvidersResult,
} from '../../../test/mocks/render-with-providers.js';
import {
  API_KEY_EDIT_FORM_ERROR_TITLE,
  API_KEY_EDIT_FORM_LABELS,
  API_KEY_EDIT_FORM_PENDING_LABEL,
  API_KEY_EDIT_FORM_SUBMIT_LABEL,
  API_KEY_EDIT_FORM_SUCCESS_MESSAGE,
} from '../api-keys.const.js';
import type {
  ApiKeyEditFormProps,
  ApiKeyEditFormValues,
} from '../api-keys.interface.js';
import { ApiKeyEditForm } from './ApiKeyEditForm.js';

/** Hungarian validation copy, i.e. what this bundle renders. */
const HUNGARIAN = VALIDATION_MESSAGE_CATALOGUE.hu;

/** The values the page seeds the form with. */
const VALUES: ApiKeyEditFormValues = {
  name: 'Vapi prod',
  description: 'Produkciós kulcs',
  expiresAt: '2027-02-01',
};

/**
 * @param overrides - props that differ from the defaults.
 * @returns the render result plus the notification harness of the tree.
 */
function renderForm(
  overrides: Partial<ApiKeyEditFormProps> = {},
): RenderWithProvidersResult {
  return renderWithProviders(
    <ApiKeyEditForm
      values={VALUES}
      submit={vi.fn().mockResolvedValue(undefined)}
      onSaved={() => undefined}
      {...overrides}
    />,
  );
}

/** @returns the submit button of the form. */
function getSubmitButton(): HTMLElement {
  return screen.getByRole('button', { name: API_KEY_EDIT_FORM_SUBMIT_LABEL });
}

describe('ApiKeyEditForm', () => {
  it('prefills the current values of the row', () => {
    renderForm();

    expect(screen.getByLabelText(API_KEY_EDIT_FORM_LABELS.name)).toHaveValue(
      VALUES.name,
    );
    expect(
      screen.getByLabelText(API_KEY_EDIT_FORM_LABELS.description),
    ).toHaveValue(VALUES.description);
    expect(
      screen.getByLabelText(API_KEY_EDIT_FORM_LABELS.expiresAt),
    ).toHaveValue(VALUES.expiresAt);
  });

  it('submits the edited values and reports the save', async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    const onSaved = vi.fn();
    renderForm({ submit, onSaved });

    const nameInput = screen.getByLabelText(API_KEY_EDIT_FORM_LABELS.name);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Vapi staging');
    await userEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(submit).toHaveBeenCalledWith({ ...VALUES, name: 'Vapi staging' });
    });
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledTimes(1);
    });
  });

  it('blocks the submit for an empty name without calling the write', async () => {
    const submit = vi.fn();
    renderForm({ submit });

    await userEvent.clear(screen.getByLabelText(API_KEY_EDIT_FORM_LABELS.name));
    await userEvent.click(getSubmitButton());

    expect(await screen.findByText(HUNGARIAN.REQUIRED)).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });

  it('maps a 422 onto the blamed field and focuses it', async () => {
    const submit = vi
      .fn()
      .mockRejectedValue(
        createCodedError({
          status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
          code: 'SEMANTIC_VALIDATION_FAILED',
          issues: [{ path: 'expiresAt', message: 'Must be in the future' }],
        }),
      );

    renderForm({ submit });
    await userEvent.click(getSubmitButton());

    expect(await screen.findByText(FIELD_INVALID_MESSAGE)).toBeInTheDocument();
    expect(
      screen.getByLabelText(API_KEY_EDIT_FORM_LABELS.expiresAt),
    ).toHaveFocus();
    expect(
      screen.queryByText(API_KEY_EDIT_FORM_ERROR_TITLE),
    ).not.toBeInTheDocument();
  });

  it('leaves a page failure to the capture toast instead of an inline alert', async () => {
    const submit = vi
      .fn()
      .mockRejectedValue(
        createCodedError({
          status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
          code: 'INTERNAL_ERROR',
        }),
      );

    renderForm({ submit });
    await userEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(submit).toHaveBeenCalledTimes(1);
    });

    // AIS-85 `D2`: `toFormErrorPlan` drops the page-level copy when the global
    // capture owns the surface, so the sentence is not rendered twice.
    expect(
      screen.queryByText(API_KEY_EDIT_FORM_ERROR_TITLE),
    ).not.toBeInTheDocument();
  });

  it('keeps the submit busy while the write is in flight', async () => {
    const deferred = createDeferred<unknown>();
    renderForm({ submit: vi.fn().mockReturnValue(deferred.promise) });

    await userEvent.click(getSubmitButton());

    expect(
      await screen.findByRole('button', { name: API_KEY_EDIT_FORM_PENDING_LABEL }),
    ).toBeDisabled();

    deferred.resolve(undefined);
  });

  it('emits one success toast and one log entry on save', async () => {
    const rendered = renderForm();

    await userEvent.click(getSubmitButton());

    // The toast is the visible surface; the log entry is the same announcement.
    expect(
      await screen.findByText(API_KEY_EDIT_FORM_SUCCESS_MESSAGE),
    ).toBeInTheDocument();

    const state = rendered.notifications.store.getSnapshot();

    expect(state.entries).toHaveLength(1);
    expect(state.entries[0]?.level).toBe('success');
    expect(state.entries[0]?.message).toBe(API_KEY_EDIT_FORM_SUCCESS_MESSAGE);
    // `manual`, i.e. the notifier port — not the `form.success` cache callback,
    // which stays silent because no `meta.successMessage` is set.
    expect(state.entries[0]?.source).toBe('manual');
    expect(state.toasts).toHaveLength(1);
  });

  it('shows a field message and no toast for a blamed input', async () => {
    const rendered = renderForm({
      submit: vi.fn().mockRejectedValue(
        createCodedError({
          status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
          code: 'SEMANTIC_VALIDATION_FAILED',
          issues: [{ path: 'name', message: 'Already taken' }],
        }),
      ),
    });

    await userEvent.click(getSubmitButton());

    expect(await screen.findByText(FIELD_INVALID_MESSAGE)).toBeInTheDocument();
    expect(
      rendered.notifications.store.getSnapshot().toasts,
    ).toHaveLength(0);
  });
});
