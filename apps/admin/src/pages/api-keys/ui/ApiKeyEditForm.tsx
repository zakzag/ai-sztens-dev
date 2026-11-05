import { useNotifier } from '@callback/notifications/react';
import { Alert, Card, FormActions, Input, Textarea } from '@callback/ui';
import { API_KEY_EDIT_FIELD_PATHS } from '../../../features/api-keys/api-keys.const.js';
import { useAppForm } from '../../../features/forms/use-app-form.js';
import {
  API_KEY_EDIT_FORM_ERROR_TITLE,
  API_KEY_EDIT_FORM_FIELD_IDS,
  API_KEY_EDIT_FORM_HINTS,
  API_KEY_EDIT_FORM_LABELS,
  API_KEY_EDIT_FORM_PENDING_LABEL,
  API_KEY_EDIT_FORM_SUBMIT_LABEL,
  API_KEY_EDIT_FORM_SUCCESS_MESSAGE,
  API_KEY_EDIT_FORM_TITLE,
} from '../api-keys.const.js';
import type {
  ApiKeyEditFormProps,
  ApiKeyEditFormValues,
} from '../api-keys.interface.js';
import { apiKeyEditFormSchema } from '../api-keys.logic.js';

/**
 * Edit form of one API key (AIS-131, notify port since AIS-136).
 *
 * Built on {@link useAppForm}, so the five decisions of the shared form pattern
 * (resolver with the Hungarian error map, `toFieldErrors` mapping, first-error
 * focus, success convention, notification port) are not re-implemented here. The
 * component adds nothing but markup and the three inputs a `PATCH` may change:
 * `identifier` is the URL of the resource and `apiKey` is a secret, so neither is
 * rendered (decision `D3`).
 *
 * The write itself is the page's `submit`: the page holds the `updatedAt`
 * concurrency token and decides what a `409 STALE_WRITE` means, while this form
 * only reports the values. A rejection is re-thrown by `submit`, so `useAppForm`
 * still maps it onto the fields.
 *
 * Since AIS-136 the form owns the notification port as well (`useNotifier()`),
 * exactly like `ApiKeyForm` (AIS-85): a successful `PATCH` produces one toast and
 * one log entry. The mutation carries **no** `meta.successMessage`, so the
 * cache-level callback stays silent and cannot duplicate the announcement.
 * The page's own success `Alert` stays (`AIS136-D1`): the toast marks the moment,
 * the `Alert` marks the state of the row that was just saved.
 *
 * The form is remounted by the page (`key={updatedAt}`) after every successful
 * save, because `useAppForm` closes a submit with `reset(defaultValues)`: with a
 * static `defaultValues` that reset would restore the **pre-edit** values.
 *
 * @param props - see {@link ApiKeyEditFormProps}.
 */
export function ApiKeyEditForm({ values, submit, onSaved }: ApiKeyEditFormProps) {
  const notify = useNotifier();

  const { register, handleSubmit, errors, formState, formError } =
    useAppForm<ApiKeyEditFormValues>({
      schema: apiKeyEditFormSchema,
      defaultValues: values,
      fieldPaths: API_KEY_EDIT_FIELD_PATHS,
      submit,
      notify,
      successMessage: API_KEY_EDIT_FORM_SUCCESS_MESSAGE,
      onSuccess: onSaved,
    });

  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-semibold text-text-primary">
        {API_KEY_EDIT_FORM_TITLE}
      </h2>

      {formError !== null ? (
        <Alert variant="danger" title={API_KEY_EDIT_FORM_ERROR_TITLE}>
          {formError}
        </Alert>
      ) : null}

      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <Input
          {...register('name')}
          id={API_KEY_EDIT_FORM_FIELD_IDS.name}
          label={API_KEY_EDIT_FORM_LABELS.name}
          hint={API_KEY_EDIT_FORM_HINTS.name}
          error={errors.name?.message}
          autoComplete="off"
        />

        <Textarea
          {...register('description')}
          id={API_KEY_EDIT_FORM_FIELD_IDS.description}
          label={API_KEY_EDIT_FORM_LABELS.description}
          hint={API_KEY_EDIT_FORM_HINTS.description}
          error={errors.description?.message}
        />

        <Input
          {...register('expiresAt')}
          id={API_KEY_EDIT_FORM_FIELD_IDS.expiresAt}
          label={API_KEY_EDIT_FORM_LABELS.expiresAt}
          hint={API_KEY_EDIT_FORM_HINTS.expiresAt}
          error={errors.expiresAt?.message}
          type="date"
        />

        <FormActions
          submitLabel={
            formState.isSubmitting
              ? API_KEY_EDIT_FORM_PENDING_LABEL
              : API_KEY_EDIT_FORM_SUBMIT_LABEL
          }
          isSubmitting={formState.isSubmitting}
        />
      </form>
    </Card>
  );
}
