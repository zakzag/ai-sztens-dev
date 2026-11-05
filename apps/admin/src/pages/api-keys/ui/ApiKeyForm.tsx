import { useNotifier } from '@callback/notifications/react';
import { Alert, Card, FormActions, Input, Textarea } from '@callback/ui';
import {
  API_KEY_FIELD_PATHS,
  DEFAULT_FIELD_PATH_BY_CODE,
} from '../../../features/api-keys/api-keys.const.js';
import { useCreateApiKeyMutation } from '../../../features/api-keys/use-api-keys.js';
import { useAppForm } from '../../../features/forms/use-app-form.js';
import {
  API_KEY_FORM_DEFAULTS,
  API_KEY_FORM_ERROR_TITLE,
  API_KEY_FORM_FIELD_IDS,
  API_KEY_FORM_HINTS,
  API_KEY_FORM_LABELS,
  API_KEY_FORM_PENDING_LABEL,
  API_KEY_FORM_SUBMIT_LABEL,
  API_KEY_FORM_SUCCESS_MESSAGE,
  API_KEY_FORM_TITLE,
} from '../api-keys.const.js';
import type { ApiKeyFormValues } from '../api-keys.interface.js';
import { apiKeyFormSchema, toCreateApiKeyInput } from '../api-keys.logic.js';

/**
 * Create form of the API key page — the reference implementation of the shared
 * form pattern (AIS-115) wired into the notification system (AIS-85).
 *
 * The component owns **no** validation, no field-error loop and no error state:
 * it declares the schema, the ordered field paths, the submit call and one
 * notification port, and {@link useAppForm} does the rest (resolver with the
 * Hungarian error map, `toFieldErrors` mapping, first-error focus, the
 * reset → notify order).
 *
 * Who speaks after a submit (AIS-85 `D1`/`D2`):
 *
 * - **success** → `notify.success` from the hook, i.e. one toast plus one log
 *   entry. No `meta.successMessage` is set on the mutation, so the cache-level
 *   callback stays silent and there is exactly one announcement.
 * - **field-addressable failure** (`400` issues, `409` duplicate identifier) →
 *   `setError` on the input, first invalid one focused, **no toast**: the global
 *   capture is log-only for a `field` surface.
 * - **page failure** (`5xx`, network) → the capture toasts it; the hook leaves
 *   `formError` empty, so the same sentence is never rendered twice.
 * - **the residue** of a `field` failure whose issue names no rendered input →
 *   the one `Alert` below, because nothing else owns that message.
 *
 * `Input`/`Textarea` carry their own label, hint and error wiring (AIS-113), so
 * the fields are not wrapped in `FormField`: that primitive is for controls that
 * do not bundle a label, and wrapping would render two labels and drop the
 * `aria-describedby` the primitive already sets.
 *
 * @returns the form card.
 */
export function ApiKeyForm() {
  const notify = useNotifier();
  const { createApiKey } = useCreateApiKeyMutation();

  const { register, handleSubmit, errors, formState, formError } =
    useAppForm<ApiKeyFormValues>({
      schema: apiKeyFormSchema,
      defaultValues: API_KEY_FORM_DEFAULTS,
      fieldPaths: API_KEY_FIELD_PATHS,
      defaultPathByCode: DEFAULT_FIELD_PATH_BY_CODE,
      submit: (values) => createApiKey(toCreateApiKeyInput(values)),
      notify,
      successMessage: API_KEY_FORM_SUCCESS_MESSAGE,
    });

  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-semibold text-text-primary">
        {API_KEY_FORM_TITLE}
      </h2>

      {formError !== null ? (
        <Alert variant="danger" title={API_KEY_FORM_ERROR_TITLE}>
          {formError}
        </Alert>
      ) : null}

      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <Input
          {...register('name')}
          id={API_KEY_FORM_FIELD_IDS.name}
          label={API_KEY_FORM_LABELS.name}
          hint={API_KEY_FORM_HINTS.name}
          error={errors.name?.message}
          autoComplete="off"
        />

        <Input
          {...register('identifier')}
          id={API_KEY_FORM_FIELD_IDS.identifier}
          label={API_KEY_FORM_LABELS.identifier}
          hint={API_KEY_FORM_HINTS.identifier}
          error={errors.identifier?.message}
          autoComplete="off"
        />

        <Textarea
          {...register('description')}
          id={API_KEY_FORM_FIELD_IDS.description}
          label={API_KEY_FORM_LABELS.description}
          hint={API_KEY_FORM_HINTS.description}
          error={errors.description?.message}
        />

        <Input
          {...register('apiKey')}
          id={API_KEY_FORM_FIELD_IDS.apiKey}
          label={API_KEY_FORM_LABELS.apiKey}
          hint={API_KEY_FORM_HINTS.apiKey}
          error={errors.apiKey?.message}
          type="text"
          autoComplete="off"
          spellCheck={false}
        />

        <Input
          {...register('expiresAt')}
          id={API_KEY_FORM_FIELD_IDS.expiresAt}
          label={API_KEY_FORM_LABELS.expiresAt}
          hint={API_KEY_FORM_HINTS.expiresAt}
          error={errors.expiresAt?.message}
          type="date"
        />

        <FormActions
          submitLabel={
            formState.isSubmitting
              ? API_KEY_FORM_PENDING_LABEL
              : API_KEY_FORM_SUBMIT_LABEL
          }
          isSubmitting={formState.isSubmitting}
        />
      </form>
    </Card>
  );
}
