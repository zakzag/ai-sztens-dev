import { useNotifier } from '@callback/notifications/react';
import { Alert, EntityDialog, Input, Textarea } from '@callback/ui';
import { API_KEY_EDIT_FIELD_PATHS } from '../../../features/api-keys/api-keys.const.js';
import { useUpdateApiKeyMutation } from '../../../features/api-keys/use-api-keys.js';
import { useAppForm } from '../../../features/forms/use-app-form.js';
import { isStaleWriteFailure } from '../../../lib/error-surface.logic.js';
import {
  API_KEY_EDIT_DIALOG_FORM_ID,
  API_KEY_EDIT_DIALOG_PENDING_LABEL,
  API_KEY_EDIT_DIALOG_SUBMIT_LABEL,
  API_KEY_EDIT_DIALOG_TITLE,
  API_KEY_EDIT_FORM_ERROR_TITLE,
  API_KEY_EDIT_FORM_FIELD_IDS,
  API_KEY_EDIT_FORM_HINTS,
  API_KEY_EDIT_FORM_LABELS,
  API_KEY_EDIT_FORM_SUCCESS_MESSAGE,
} from '../api-keys.const.js';
import type {
  ApiKeyEditDialogFormProps,
  ApiKeyEditValues,
} from '../api-keys.interface.js';
import {
  apiKeyEditFormSchema,
  toApiKeyEditValues,
  toUpdateApiKeyInput,
} from '../api-keys.logic.js';

/**
 * The form window of the edit overlay (AIS-172).
 *
 * The counterpart of `ApiKeyCreateDialog`: `useAppForm` owns the values, the
 * validation, the field-error mapping, the first-error focus, the reset and the
 * single announcement; `EntityDialog` owns the frame and the footer, whose
 * `Módosítás` button submits the `<form>` in the body through its id. No submit
 * button is rendered inside the form, because the pending label and `aria-busy`
 * of that one button follow `formState.isSubmitting`, which only this component
 * knows.
 *
 * Three decisions worth keeping:
 *
 * - only `name`, `description` and `expiresAt` are editable — `identifier` is the
 *   address of the resource and `apiKey` is a secret that is rotated, never
 *   patched (`PATCH` is `.strict()`);
 * - the `updatedAt` the user was looking at travels inside the request body, so
 *   a concurrent write is refused with `409 STALE_WRITE` instead of silently
 *   winning; the refusal is then answered by a re-read (`onStaleWrite`), because
 *   the cache only invalidates after a **successful** write;
 * - the window is **remounted** by its parent on every new `updatedAt`, which is
 *   how a refreshed row reaches the inputs — `useAppForm` seeds `defaultValues`
 *   only on mount.
 *
 * @param props - see {@link ApiKeyEditDialogFormProps}.
 */
export function ApiKeyEditDialogForm({
  data,
  identifier,
  onClose,
  onStaleWrite,
}: ApiKeyEditDialogFormProps) {
  const notify = useNotifier();
  const { updateApiKey } = useUpdateApiKeyMutation(identifier);

  /**
   * Sends the values with the version the form was seeded from.
   *
   * A refused version is reported to the owner **and re-thrown**: the owner
   * re-reads the row, while the re-throw keeps `useAppForm` in charge of the
   * announce-and-map step (`page` tier → the capture toast, field errors → the
   * inputs).
   *
   * @param values - validated form values.
   * @returns the written row.
   */
  const submit = async (values: ApiKeyEditValues): Promise<unknown> => {
    try {
      return await updateApiKey(toUpdateApiKeyInput(values, data.updatedAt));
    } catch (error) {
      if (isStaleWriteFailure(error)) {
        onStaleWrite();
      }

      throw error;
    }
  };

  const { register, handleSubmit, errors, formState, formError } =
    useAppForm<ApiKeyEditValues>({
      schema: apiKeyEditFormSchema,
      defaultValues: toApiKeyEditValues(data),
      fieldPaths: API_KEY_EDIT_FIELD_PATHS,
      submit,
      notify,
      successMessage: API_KEY_EDIT_FORM_SUCCESS_MESSAGE,
      onSuccess: onClose,
    });

  return (
    <EntityDialog
      title={API_KEY_EDIT_DIALOG_TITLE}
      description={identifier}
      onClose={onClose}
      submit={{
        label: API_KEY_EDIT_DIALOG_SUBMIT_LABEL,
        formId: API_KEY_EDIT_DIALOG_FORM_ID,
        pendingLabel: API_KEY_EDIT_DIALOG_PENDING_LABEL,
        isSubmitting: formState.isSubmitting,
      }}
    >
      <form
        id={API_KEY_EDIT_DIALOG_FORM_ID}
        className="space-y-4"
        onSubmit={handleSubmit}
        noValidate
      >
        {formError === null ? null : (
          <Alert variant="danger" title={API_KEY_EDIT_FORM_ERROR_TITLE}>
            {formError}
          </Alert>
        )}

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
      </form>
    </EntityDialog>
  );
}
