/**
 * Render harness of the {@link useAppForm} tests (AIS-115).
 *
 * It is the **consumer** side of the contract: a real `<form>` built from the
 * `packages/ui` primitives, wired only through the hook's return value. That makes
 * the tests assert what a page will actually see — the field messages under the
 * inputs, the page-level `Alert`, the pending submit label and `setServerError` —
 * instead of poking at react-hook-form internals.
 *
 * Everything domain-shaped (schema, field paths, labels, copy) comes from
 * `app-form.fixture.ts`; this file only decides layout.
 */

import { Alert, Button, FormField } from '@callback/ui';
import { useAppForm } from '../../features/forms/use-app-form.js';
import type { FormNotifier } from '../../features/forms/use-app-form.interface.js';
import {
  APP_FORM_DEFAULT_PATH_BY_CODE,
  APP_FORM_EMPTY_VALUES,
  APP_FORM_EXTERNAL_ERROR_LABEL,
  APP_FORM_LABELS,
  APP_FORM_PENDING_LABEL,
  APP_FORM_SCHEMA,
  APP_FORM_SUBMIT_LABEL,
  APP_FORM_FIELD_PATHS,
} from './app-form.fixture.js';
import type { AppFormFieldName, AppFormValues } from './app-form.fixture.js';

/** Props of the harness — one per hook option, plus the out-of-band error. */
export interface AppFormHarnessProps {
  /** The write the form performs; a mock in every test. */
  readonly submit: (values: AppFormValues) => Promise<unknown>;
  /** Defaults; an empty form blocks the submit, a filled one reaches `submit`. */
  readonly defaultValues?: AppFormValues;
  /** Notification port; `null` mirrors "AIS-84 not wired yet". */
  readonly notify?: FormNotifier | null;
  /** Success copy; only rendered when `notify` is given. */
  readonly successMessage?: string;
  /** Called after reset and notification. */
  readonly onSuccess?: () => void;
  /** Code → path map of the "feature"; mirrors `ApiKeyForm`'s own map. */
  readonly defaultPathByCode?: Readonly<Record<string, AppFormFieldName>>;
  /** When set, a button applies it through `setServerError` (plan `D9`). */
  readonly externalError?: unknown;
}

/**
 * Renders the fixture form through {@link useAppForm}.
 *
 * @param props - see {@link AppFormHarnessProps}.
 * @returns the form, with every UI state the hook can produce.
 */
export function AppFormHarness(props: AppFormHarnessProps) {
  const {
    submit,
    defaultValues = APP_FORM_EMPTY_VALUES,
    notify = null,
    successMessage,
    onSuccess,
    defaultPathByCode = APP_FORM_DEFAULT_PATH_BY_CODE,
    externalError,
  } = props;

  const form = useAppForm<AppFormValues>({
    schema: APP_FORM_SCHEMA,
    defaultValues,
    fieldPaths: APP_FORM_FIELD_PATHS,
    submit,
    defaultPathByCode,
    notify,
    successMessage,
    onSuccess,
  });

  return (
    <form onSubmit={form.handleSubmit} noValidate>
      {form.formError !== null ? (
        <Alert variant="danger">{form.formError}</Alert>
      ) : null}

      {externalError === undefined ? null : (
        <Button
          type="button"
          onClick={() => form.setServerError(externalError)}
        >
          {APP_FORM_EXTERNAL_ERROR_LABEL}
        </Button>
      )}

      {APP_FORM_FIELD_PATHS.map((field) => (
        <FormField
          key={field}
          id={field}
          label={APP_FORM_LABELS[field]}
          error={form.errors[field]?.message}
        >
          {(control) => (
            <input {...form.register(field)} {...control.ariaProps} />
          )}
        </FormField>
      ))}

      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting
          ? APP_FORM_PENDING_LABEL
          : APP_FORM_SUBMIT_LABEL}
      </Button>
    </form>
  );
}
