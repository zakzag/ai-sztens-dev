import { Alert, Input, Textarea } from '@callback/ui';
import {
  API_KEY_FORM_ERROR_TITLE,
  API_KEY_FORM_FIELD_IDS,
  API_KEY_FORM_HINTS,
  API_KEY_FORM_LABELS,
} from '../api-keys.const.js';
import type { ApiKeyFormFieldsProps } from '../api-keys.interface.js';

/**
 * The five inputs of the create form, plus the one `Alert` for a residue
 * failure (AIS-155).
 *
 * The component is presentation only: it holds no form state, no schema and no
 * submit. Its owner — the create overlay — runs `useAppForm`, renders the
 * `<form>` around these fields and puts the submit button in the overlay footer,
 * which is why `isSubmitting` never has to travel down into this file.
 *
 * `Input`/`Textarea` carry their own label, hint and error wiring (AIS-113), so
 * the fields are not wrapped in `FormField`: that primitive is for controls that
 * do not bundle a label, and wrapping would render two labels and drop the
 * `aria-describedby` the primitive already sets.
 *
 * @param props - see {@link ApiKeyFormFieldsProps}.
 * @returns the field list of the create form.
 */
export function ApiKeyFormFields({
  register,
  errors,
  formError,
}: ApiKeyFormFieldsProps) {
  return (
    <>
      {formError === null ? null : (
        <Alert variant="danger" title={API_KEY_FORM_ERROR_TITLE}>
          {formError}
        </Alert>
      )}

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
    </>
  );
}
