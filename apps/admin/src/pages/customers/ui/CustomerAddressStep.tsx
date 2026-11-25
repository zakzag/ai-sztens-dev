/**
 * Step 3 of the create wizard — *Cím* (AIS-182).
 *
 * Same shape as step 2: `useAppForm` seeded from the draft, validated against the
 * step's schema, written back into the draft on submit.
 *
 * The registered address is **optional** in the contract (a prospect may be
 * registered before its address is known — that is what `hasMissingData` flags),
 * so every field may stay empty; only a *typed* postal code must be a valid one.
 * The country is pre-filled from the contract's default (`HU`), which is why the
 * operator never sees an empty select here.
 */

import { Card, FormActions, FormField, Input, Select } from '@callback/ui';
import { useEffect } from 'react';
import { CUSTOMER_DETAIL_FIELD_LABELS } from '../../../entities/customer/customer.const.js';
import { useAppForm } from '../../../features/forms/use-app-form.js';
import {
  CUSTOMERS_WIZARD_BACK_STEP_LABEL,
  CUSTOMERS_WIZARD_NEXT_LABEL,
  CUSTOMERS_WIZARD_STEP_TITLES,
  CUSTOMER_COUNTRY_OPTIONS,
  CUSTOMER_WIZARD_FIELD_IDS,
} from '../customers.const.js';
import type {
  CustomerAddressValues,
  CustomerWizardStepFormProps,
} from '../customers.interface.js';
import { useCustomersWizardStore } from '../customers-wizard.provider.js';
import {
  CUSTOMER_ADDRESS_STEP_FIELD_PATHS,
  customerAddressStepSchema,
  toAddressValues,
} from '../customers-wizard.logic.js';

/**
 * @param props - see {@link CustomerWizardStepFormProps}.
 */
export function CustomerAddressStep({
  onNext,
  onBack,
  serverError,
}: CustomerWizardStepFormProps) {
  const draft = useCustomersWizardStore((state) => state.draft);
  const setDraft = useCustomersWizardStore((state) => state.setDraft);

  /**
   * Records the step's fields and moves on.
   *
   * @param values - validated form values.
   * @returns the values, so the hook can finish its own bookkeeping.
   */
  const submit = async (values: CustomerAddressValues): Promise<unknown> => {
    setDraft(values);
    onNext();

    return values;
  };

  const { register, handleSubmit, errors, formState, setServerError } =
    useAppForm<CustomerAddressValues>({
      schema: customerAddressStepSchema,
      defaultValues: toAddressValues(draft),
      fieldPaths: CUSTOMER_ADDRESS_STEP_FIELD_PATHS,
      submit,
    });

  useEffect(() => {
    if (serverError !== undefined) {
      setServerError(serverError);
    }
  }, [serverError, setServerError]);

  return (
    <Card title={CUSTOMERS_WIZARD_STEP_TITLES['3']}>
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            {...register('registeredAddressZip')}
            id={CUSTOMER_WIZARD_FIELD_IDS.registeredAddressZip}
            label={CUSTOMER_DETAIL_FIELD_LABELS.zip}
            error={errors.registeredAddressZip?.message}
            autoComplete="off"
            inputMode="numeric"
          />

          <Input
            {...register('registeredAddressCity')}
            id={CUSTOMER_WIZARD_FIELD_IDS.registeredAddressCity}
            label={CUSTOMER_DETAIL_FIELD_LABELS.city}
            error={errors.registeredAddressCity?.message}
            autoComplete="off"
          />

          <Input
            {...register('registeredAddressLine')}
            id={CUSTOMER_WIZARD_FIELD_IDS.registeredAddressLine}
            label={CUSTOMER_DETAIL_FIELD_LABELS.addressLine}
            error={errors.registeredAddressLine?.message}
            autoComplete="off"
          />

          <FormField
            id={CUSTOMER_WIZARD_FIELD_IDS.registeredAddressCountry}
            label={CUSTOMER_DETAIL_FIELD_LABELS.country}
            error={errors.registeredAddressCountry?.message}
          >
            {(field) => (
              <Select
                {...register('registeredAddressCountry')}
                id={field.id}
                invalid={field.invalid}
                describedBy={field.describedBy}
                options={CUSTOMER_COUNTRY_OPTIONS}
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
