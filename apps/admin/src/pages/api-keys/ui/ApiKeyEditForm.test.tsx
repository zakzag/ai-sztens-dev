/**
 * Tests of the edit form (AIS-131).
 *
 * The write is injected (`submit`), so this suite needs no MSW: it asserts the
 * **contract of the component** — what it prefills, what it submits, and how it
 * distributes a rejection. The end-to-end path (real mutation + transport +
 * handler) is covered by `ApiKeyDetailPage.test.tsx`.
 *
 * Covered branches: prefill, successful submit, field-addressable rejection with
 * focus, unaddressable rejection as the page-level alert, pending state, and the
 * client-side block of an invalid name.
 */

import { HTTP_STATUS } from '@callback/api-client';
import { VALIDATION_MESSAGE_CATALOGUE } from '@callback/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FIELD_INVALID_MESSAGE } from '../../../lib/error-message.const.js';
import { createCodedError } from '../../../test/mocks/api-error.mock.js';
import { createDeferred } from '../../../test/mocks/deferred.mock.js';
import {
  API_KEY_EDIT_FORM_ERROR_TITLE,
  API_KEY_EDIT_FORM_LABELS,
  API_KEY_EDIT_FORM_PENDING_LABEL,
  API_KEY_EDIT_FORM_SUBMIT_LABEL,
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
 * @returns the render result.
 */
function renderForm(overrides: Partial<ApiKeyEditFormProps> = {}) {
  return render(
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

  it('renders an unaddressable failure as the page-level alert', async () => {
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

    expect(
      await screen.findByText(API_KEY_EDIT_FORM_ERROR_TITLE),
    ).toBeInTheDocument();
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
});
