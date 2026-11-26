/**
 * Step 2 of the create wizard — *Név és adószám* (AIS-182).
 *
 * A real `useAppForm`: the values are seeded from the page store (react-hook-form
 * reads `defaultValues` on mount only, which is exactly why the draft exists),
 * validated against the step's own schema — derived from `createCustomerSchema` —
 * and written back into the draft on submit. *Tovább* therefore cannot move on
 * with an invalid step.
 *
 * Two details worth keeping:
 *
 * - the **legal form is a closed select** (`D5`): the contract stores a bounded
 *   free text, but an operator typing “Kft” and “kft.” would produce two
 *   spellings of one form. The empty option is an `<option>`, not a placeholder,
 *   because `Select` renders its placeholder disabled and the field could never be
 *   cleared again;
 * - a `409`/`422` the page routed here arrives as `serverError` and is handed to
 *   `useAppForm.setServerError`, so the field mapping and the first-error focus
 *   stay the hook's (`D8`) — this component owns no mapping table.
 */

import { Card, FormActions, FormField, Input, Select } from '@callback/ui';
import { useEffect } from 'react';
import { CUSTOMER_DETAIL_FIELD_LABELS } from '../../../entities/customer/customer.const.js';
import { useAppForm } from '../../../features/forms/use-app-form.js';
import {
  CUSTOMER_LEGAL_FORM_EMPTY_LABEL,
  CUSTOMER_LEGAL_FORM_OPTIONS,
  CUSTOMERS_WIZARD_BACK_STEP_LABEL,
  CUSTOMERS_WIZARD_NEXT_LABEL,
  CUSTOMERS_WIZARD_STEP_TITLES,
  CUSTOMER_WIZARD_FIELD_IDS,
} from '../customers.const.js';
import type {
  CustomerNameValues,
  CustomerWizardStepFormProps,
} from '../customers.interface.js';
import { useCustomersWizardStore } from '../customers-wizard.provider.js';
import {
  CUSTOMER_NAME_STEP_FIELD_PATHS,
  customerNameStepSchema,
  toNameValues,
} from '../customers-wizard.logic.js';

/** The legal-form list, prefixed with the “not set yet” option. */
const LEGAL_FORM_OPTIONS = Object.freeze([
  { value: '', label: CUSTOMER_LEGAL_FORM_EMPTY_LABEL },
  ...CUSTOMER_LEGAL_FORM_OPTIONS,
]);

/**
 * @param props - see {@link CustomerWizardStepFormProps}.
 */
export function CustomerNameStep({
  onNext,
  onBack,
  serverError,
}: CustomerWizardStepFormProps) {
  const draft = useCustomersWizardStore((state) => state.draft);
  const setDraft = useCustomersWizardStore((state) => state.setDraft);

  /**
   * Records the step's fields and moves on.
   *
   * `setDraft` **merges**, so the type chosen on step 1 and the address entered
   * later survive this step's write.
   *
   * @param values - validated form values.
   * @returns the values, so the hook can finish its own bookkeeping.
   */
  const submit = async (values: CustomerNameValues): Promise<unknown> => {
    setDraft(values);
    onNext();

    return values;
  };

  const { register, handleSubmit, errors, formState, setServerError } =
    useAppForm<CustomerNameValues>({
      schema: customerNameStepSchema,
      defaultValues: toNameValues(draft),
      fieldPaths: CUSTOMER_NAME_STEP_FIELD_PATHS,
      submit,
    });

  useEffect(() => {
    if (serverError !== undefined) {
      setServerError(serverError);
    }
  }, [serverError, setServerError]);

  return (
    <Card title={CUSTOMERS_WIZARD_STEP_TITLES['2']}>
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            {...register('legalName')}
            id={CUSTOMER_WIZARD_FIELD_IDS.legalName}
            label={CUSTOMER_DETAIL_FIELD_LABELS.legalName}
            error={errors.legalName?.message}
            autoComplete="off"
          />

          <Input
            {...register('shortName')}
            id={CUSTOMER_WIZARD_FIELD_IDS.shortName}
            label={CUSTOMER_DETAIL_FIELD_LABELS.shortName}
            error={errors.shortName?.message}
            autoComplete="off"
          />

          <Input
            {...register('taxNumber')}
            id={CUSTOMER_WIZARD_FIELD_IDS.taxNumber}
            label={CUSTOMER_DETAIL_FIELD_LABELS.taxNumber}
            error={errors.taxNumber?.message}
            autoComplete="off"
          />

          <Input
            {...register('euVatNumber')}
            id={CUSTOMER_WIZARD_FIELD_IDS.euVatNumber}
            label={CUSTOMER_DETAIL_FIELD_LABELS.euVatNumber}
            error={errors.euVatNumber?.message}
            autoComplete="off"
          />

          <Input
            {...register('companyRegistrationNumber')}
            id={CUSTOMER_WIZARD_FIELD_IDS.companyRegistrationNumber}
            label={CUSTOMER_DETAIL_FIELD_LABELS.companyRegistrationNumber}
            error={errors.companyRegistrationNumber?.message}
            autoComplete="off"
          />

          <FormField
            id={CUSTOMER_WIZARD_FIELD_IDS.legalForm}
            label={CUSTOMER_DETAIL_FIELD_LABELS.legalForm}
            error={errors.legalForm?.message}
          >
            {(field) => (
              <Select
                {...register('legalForm')}
                id={field.id}
                invalid={field.invalid}
                describedBy={field.describedBy}
                options={LEGAL_FORM_OPTIONS}
              />
            )}
          </FormField>
        </div>

        <FormActions
          submitLabel={CUSTOMERS_WIZARD_NEXT_LABEL}
          cancelLabel={CUSTOMERS_WIZARD_BACK_STEP_LABEL}
          onCancel={onBack}
          isSubmitting={formState.isSubmitting}
        />
      </form>
    </Card>
  );
}
