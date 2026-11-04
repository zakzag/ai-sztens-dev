/**
 * Tests of the shared form pattern (AIS-115).
 *
 * The suite drives the **real** hook through the consumer harness, so every
 * assertion is about what a page renders or receives:
 *
 * 1. the submit convention — validate → submit → reset → notify → `onSuccess`;
 * 2. the failure routing — an addressable issue lands on its input, everything
 *    else becomes one page-level message and **nothing** is announced;
 * 3. the pending state — `isSubmitting` disables the trigger while the write is
 *    in flight;
 * 4. the deterministic focus of `D3` — the declared order wins over the server's
 *    `issues[]` order.
 *
 * Nothing hits the network: the write is a mock, so no MSW handler is needed and
 * an accidental request fails the suite (`onUnhandledRequest: 'error'`).
 */

import { VALIDATION_MESSAGE_CATALOGUE } from '@callback/shared';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  API_KEY_IDENTIFIER_FIELD_MESSAGE,
  FIELD_INVALID_MESSAGE,
  IDENTIFIER_CONFLICT_MESSAGE,
  SERVER_ERROR_MESSAGE,
} from '../../lib/error-message.const.js';
import {
  createCodedError,
  createConflictError,
  createLegacyConflictError,
  createServerError,
} from '../../test/mocks/api-error.mock.js';
import {
  APP_FORM_EMPTY_VALUES,
  APP_FORM_EXTERNAL_ERROR_LABEL,
  APP_FORM_FIELD_PATHS,
  APP_FORM_FILLED_VALUES,
  APP_FORM_LABELS,
  APP_FORM_PENDING_LABEL,
  APP_FORM_SUBMIT_LABEL,
  APP_FORM_SUCCESS_MESSAGE,
} from '../../test/mocks/app-form.fixture.js';
import type {
  AppFormFieldName,
  AppFormValues,
} from '../../test/mocks/app-form.fixture.js';
import { AppFormHarness } from '../../test/mocks/app-form-harness.mock.js';
import { createDeferred } from '../../test/mocks/deferred.mock.js';
import { createFormNotifierMock } from '../../test/mocks/form-notifier.mock.js';

/**
 * @param field - the fixture field to locate.
 * @returns its input, found through the label the harness renders.
 */
function getInput(field: AppFormFieldName): HTMLInputElement {
  return screen.getByLabelText(APP_FORM_LABELS[field]) as HTMLInputElement;
}

/** @returns the submit trigger in its idle state. */
function getSubmitButton(): HTMLElement {
  return screen.getByRole('button', { name: APP_FORM_SUBMIT_LABEL });
}

describe('useAppForm — submit convention', () => {
  it('submits the parsed values, resets the form and announces success', async () => {
    const submit = vi.fn(async (values: AppFormValues) => values);
    const notify = createFormNotifierMock();
    const onSuccess = vi.fn();

    render(
      <AppFormHarness
        submit={submit}
        defaultValues={APP_FORM_FILLED_VALUES}
        notify={notify}
        successMessage={APP_FORM_SUCCESS_MESSAGE}
        onSuccess={onSuccess}
      />,
    );

    await userEvent.type(getInput('note'), ' plusz');
    const typedNote = getInput('note').value;

    await userEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(submit).toHaveBeenCalledTimes(1);
    });

    expect(submit).toHaveBeenCalledWith({
      ...APP_FORM_FILLED_VALUES,
      note: typedNote,
    });
    // The success convention: the fields are back on their defaults before the
    // caller is told anything, so the announcement can never precede the reset.
    expect(getInput('note').value).toBe(APP_FORM_FILLED_VALUES.note);
    expect(notify.success).toHaveBeenCalledWith(APP_FORM_SUCCESS_MESSAGE);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('does not announce when no success copy was declared', async () => {
    const submit = vi.fn(async () => undefined);
    const notify = createFormNotifierMock();

    render(
      <AppFormHarness
        submit={submit}
        defaultValues={APP_FORM_FILLED_VALUES}
        notify={notify}
      />,
    );

    await userEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(submit).toHaveBeenCalledTimes(1);
    });
    expect(notify.success).not.toHaveBeenCalled();
  });

  it('stays silent and does not throw when no notification port is wired', async () => {
    const submit = vi.fn(async () => undefined);
    const onSuccess = vi.fn();

    render(
      <AppFormHarness
        submit={submit}
        defaultValues={APP_FORM_FILLED_VALUES}
        successMessage={APP_FORM_SUCCESS_MESSAGE}
        onSuccess={onSuccess}
      />,
    );

    await userEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText(APP_FORM_SUCCESS_MESSAGE)).toBeNull();
  });

  it('blocks an invalid submit with the shared Hungarian copy on every field', async () => {
    const submit = vi.fn(async () => undefined);

    render(
      <AppFormHarness submit={submit} defaultValues={APP_FORM_EMPTY_VALUES} />,
    );

    await userEvent.click(getSubmitButton());

    const messages = await screen.findAllByText(
      VALIDATION_MESSAGE_CATALOGUE.hu.REQUIRED,
    );

    expect(messages).toHaveLength(APP_FORM_FIELD_PATHS.length);
    expect(submit).not.toHaveBeenCalled();
  });

  it('keeps the trigger disabled and pending while the write is in flight', async () => {
    const deferred = createDeferred<unknown>();
    const submit = vi.fn(() => deferred.promise);

    render(
      <AppFormHarness submit={submit} defaultValues={APP_FORM_FILLED_VALUES} />,
    );

    await userEvent.click(getSubmitButton());

    const pending = await screen.findByRole('button', {
      name: APP_FORM_PENDING_LABEL,
    });
    expect(pending).toBeDisabled();

    await act(async () => {
      deferred.resolve(undefined);
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: APP_FORM_SUBMIT_LABEL }),
      ).toBeEnabled();
    });
  });
});

describe('useAppForm — failure routing', () => {
  it('maps a server issue onto its input and shows no page-level message', async () => {
    const submit = vi.fn(async () => {
      throw createCodedError({
        status: 400,
        code: 'VALIDATION_FAILED',
        issues: [{ path: 'email', message: 'backend English text' }],
      });
    });

    render(
      <AppFormHarness submit={submit} defaultValues={APP_FORM_FILLED_VALUES} />,
    );

    await userEvent.click(getSubmitButton());

    expect(await screen.findByText(FIELD_INVALID_MESSAGE)).toBeInTheDocument();
    expect(getInput('email')).toHaveAttribute('aria-invalid', 'true');
    // The page alert must stay empty: the failure was fully explained by a field.
    expect(
      screen.queryByText(VALIDATION_MESSAGE_CATALOGUE.hu.INVALID_FORMAT),
    ).toBeNull();
  });

  it('reports a failure whose path no field owns as one page-level message', async () => {
    const submit = vi.fn(async () => {
      throw createConflictError();
    });

    render(
      <AppFormHarness submit={submit} defaultValues={APP_FORM_FILLED_VALUES} />,
    );

    await userEvent.click(getSubmitButton());

    expect(
      await screen.findByText(IDENTIFIER_CONFLICT_MESSAGE),
    ).toBeInTheDocument();
    expect(screen.queryByText(FIELD_INVALID_MESSAGE)).toBeNull();
  });

  it('falls back to the page-level copy for a backend failure', async () => {
    const submit = vi.fn(async () => {
      throw createServerError();
    });

    render(
      <AppFormHarness submit={submit} defaultValues={APP_FORM_FILLED_VALUES} />,
    );

    await userEvent.click(getSubmitButton());

    expect(await screen.findByText(SERVER_ERROR_MESSAGE)).toBeInTheDocument();
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('blames the declared path when the envelope named none', async () => {
    const submit = vi.fn(async () => {
      throw createLegacyConflictError();
    });

    render(
      <AppFormHarness submit={submit} defaultValues={APP_FORM_FILLED_VALUES} />,
    );

    await userEvent.click(getSubmitButton());

    // `defaultPathByCode` maps the conflict onto `name`; the message is the
    // catalogue's field copy, never the server's English `issue.message`.
    expect(
      await screen.findByText(API_KEY_IDENTIFIER_FIELD_MESSAGE),
    ).toBeInTheDocument();
    expect(screen.queryByText(IDENTIFIER_CONFLICT_MESSAGE)).toBeNull();
  });

  it('focuses the first invalid input in the declared order, not the server order', async () => {
    const submit = vi.fn(async () => {
      throw createCodedError({
        status: 400,
        code: 'VALIDATION_FAILED',
        // The server blames `note` first; the declared order starts with `name`.
        issues: [
          { path: 'note', message: 'server text' },
          { path: 'name', message: 'server text' },
        ],
      });
    });

    render(
      <AppFormHarness submit={submit} defaultValues={APP_FORM_FILLED_VALUES} />,
    );

    await userEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(screen.getAllByText(FIELD_INVALID_MESSAGE)).toHaveLength(2);
    });
    expect(document.activeElement).toBe(getInput('name'));
  });

  it('clears the page-level message when the user retries', async () => {
    const submit = vi
      .fn<(values: AppFormValues) => Promise<unknown>>()
      .mockRejectedValueOnce(createServerError())
      .mockResolvedValueOnce(undefined);

    render(
      <AppFormHarness submit={submit} defaultValues={APP_FORM_FILLED_VALUES} />,
    );

    await userEvent.click(getSubmitButton());
    expect(await screen.findByText(SERVER_ERROR_MESSAGE)).toBeInTheDocument();

    await userEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(submit).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByText(SERVER_ERROR_MESSAGE)).toBeNull();
  });

  it('applies an out-of-band failure through the same mapping', async () => {
    const submit = vi.fn(async () => undefined);

    render(
      <AppFormHarness
        submit={submit}
        defaultValues={APP_FORM_FILLED_VALUES}
        externalError={createLegacyConflictError()}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: APP_FORM_EXTERNAL_ERROR_LABEL }),
    );

    expect(
      await screen.findByText(API_KEY_IDENTIFIER_FIELD_MESSAGE),
    ).toBeInTheDocument();
    // `setServerError` is not a submit: the write must not have been attempted.
    expect(submit).not.toHaveBeenCalled();
  });
});
