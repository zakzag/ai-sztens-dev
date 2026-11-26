/**
 * The edit form of one customer (AIS-21).
 *
 * `useAppForm` owns the values, the validation, the failure → field mapping, the
 * first-error focus, the reset and the single announcement; this component owns
 * the layout and the one failure the pattern cannot express: the **stale write**.
 *
 * Four decisions are worth keeping:
 *
 * - **four sections**, not one long column: *Azonosítók* is the read-only summary
 *   (a `DescriptionList` + the status badge), the other three hold the inputs in
 *   the order `CUSTOMER_UPDATE_FIELD_PATHS` declares;
 * - `Input` carries its own label, hint and error wiring, so it is **not** wrapped
 *   in `FormField` (that primitive is for controls without a label — it is used
 *   for the three `Select`s only, which is the same split `CustomersFilters` makes);
 * - `409 STALE_WRITE` is **not** a field error: the path it blames (`updatedAt`)
 *   is rendered nowhere, so the form shows a warning `Alert` with a reload
 *   action and still re-throws, which keeps `useAppForm` in charge of the tier
 *   mapping;
 * - the id is bound by the mutation hook, never carried in the body.
 */

import { useNotifier } from '@callback/notifications/react';
import {
  Alert,
  Button,
  DescriptionList,
  FormActions,
  FormField,
  FormSection,
  Input,
  Select,
} from '@callback/ui';
import { useState } from 'react';
import { CustomerStatusBadge } from '../../../entities/customer/components/CustomerStatusBadge.js';
import {
  CUSTOMER_DETAIL_FIELD_LABELS,
  CUSTOMER_DETAIL_OVERVIEW_LABELS,
} from '../../../entities/customer/customer.const.js';
import {
  CUSTOMERS_UPDATE_SUCCESS_MESSAGE,
  CUSTOMER_UPDATE_DEFAULT_PATH_BY_CODE,
  CUSTOMER_UPDATE_FIELD_PATHS,
} from '../../../features/customers/customers.const.js';
import { useUpdateCustomerMutation } from '../../../features/customers/use-update-customer.js';
import { useAppForm } from '../../../features/forms/use-app-form.js';
import { isStaleWriteFailure } from '../../../lib/error-surface.logic.js';
import {
  customerEditFormSchema,
  toCountryOptions,
  toCustomerEditValues,
  toReadOnlyItems,
  toUpdateCustomerPayload,
} from '../customer-edit.logic.js';
import {
  CUSTOMER_EDIT_CANCEL_LABEL,
  CUSTOMER_EDIT_FIELD_HINTS,
  CUSTOMER_EDIT_FIELD_IDS,
  CUSTOMER_EDIT_FORM_ERROR_TITLE,
  CUSTOMER_EDIT_HEADCOUNT_OPTIONS,
  CUSTOMER_EDIT_SECTION_TITLES,
  CUSTOMER_EDIT_SOURCE_OPTIONS,
  CUSTOMER_EDIT_STALE_DESCRIPTION,
  CUSTOMER_EDIT_STALE_RELOAD_LABEL,
  CUSTOMER_EDIT_STALE_TITLE,
  CUSTOMER_EDIT_SUBMIT_LABEL,
  CUSTOMER_TYPE_FILTER_OPTIONS,
} from '../customers.const.js';
import type {
  CustomerEditFormProps,
  CustomerEditValues,
} from '../customers.interface.js';

/**
 * @param props - see {@link CustomerEditFormProps}.
 */
export function CustomerEditForm({
  customer,
  onLeave,
  onReload,
}: CustomerEditFormProps) {
  const notify = useNotifier();
  const { updateCustomer } = useUpdateCustomerMutation(customer.id);
  const [isStale, setIsStale] = useState(false);

  /**
   * Sends the whole editable record with the version the form was seeded from.
   *
   * A refused version is reported **and re-thrown**: the notice explains what to
   * do, while the re-throw keeps the tier mapping in `useAppForm` (`page` tier →
   * the capture toast, field errors → the inputs).
   *
   * @param values - validated form values.
   * @returns the written row.
   */
  const submit = async (values: CustomerEditValues): Promise<unknown> => {
    try {
      return await updateCustomer(
        toUpdateCustomerPayload(values, customer.updatedAt),
      );
    } catch (error) {
      if (isStaleWriteFailure(error)) {
        setIsStale(true);
      }

      throw error;
    }
  };

  const { register, handleSubmit, errors, formState, formError } =
    useAppForm<CustomerEditValues>({
      schema: customerEditFormSchema,
      defaultValues: toCustomerEditValues(customer),
      fieldPaths: CUSTOMER_UPDATE_FIELD_PATHS,
      submit,
      defaultPathByCode: CUSTOMER_UPDATE_DEFAULT_PATH_BY_CODE,
      notify,
      successMessage: CUSTOMERS_UPDATE_SUCCESS_MESSAGE,
      onSuccess: onLeave,
    });

  const countryOptions = toCountryOptions(customer.registeredAddressCountry);

  return (
    <form className="space-y-8" onSubmit={handleSubmit} noValidate>
      {formError === null ? null : (
        <Alert variant="danger" title={CUSTOMER_EDIT_FORM_ERROR_TITLE}>
          {formError}
        </Alert>
      )}

      {isStale ? (
        <Alert variant="warning" title={CUSTOMER_EDIT_STALE_TITLE}>
          <div className="space-y-3">
            <p>{CUSTOMER_EDIT_STALE_DESCRIPTION}</p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setIsStale(false);
                onReload();
              }}
            >
              {CUSTOMER_EDIT_STALE_RELOAD_LABEL}
            </Button>
          </div>
        </Alert>
      ) : null}

      <FormSection legend={CUSTOMER_EDIT_SECTION_TITLES.identifiers}>
        <div className="space-y-4">
          <DescriptionList items={toReadOnlyItems(customer)} columns={2} />
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-text-secondary">
              {CUSTOMER_DETAIL_OVERVIEW_LABELS.status}
            </span>
            <CustomerStatusBadge status={customer.status} />
          </div>
        </div>
      </FormSection>

      <FormSection legend={CUSTOMER_EDIT_SECTION_TITLES.legal}>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            id={CUSTOMER_EDIT_FIELD_IDS.type}
            label={CUSTOMER_DETAIL_FIELD_LABELS.type}
            error={errors.type?.message}
          >
            {(field) => (
              <Select
                {...register('type')}
                id={field.id}
                invalid={field.invalid}
                describedBy={field.describedBy}
                options={CUSTOMER_TYPE_FILTER_OPTIONS}
              />
            )}
          </FormField>

          <Input
            {...register('legalName')}
            id={CUSTOMER_EDIT_FIELD_IDS.legalName}
            label={CUSTOMER_DETAIL_FIELD_LABELS.legalName}
            error={errors.legalName?.message}
            autoComplete="off"
          />

          <Input
            {...register('shortName')}
            id={CUSTOMER_EDIT_FIELD_IDS.shortName}
            label={CUSTOMER_DETAIL_FIELD_LABELS.shortName}
            error={errors.shortName?.message}
            autoComplete="off"
          />

          <Input
            {...register('taxNumber')}
            id={CUSTOMER_EDIT_FIELD_IDS.taxNumber}
            label={CUSTOMER_DETAIL_FIELD_LABELS.taxNumber}
            hint={CUSTOMER_EDIT_FIELD_HINTS.taxNumber}
            error={errors.taxNumber?.message}
            autoComplete="off"
          />

          <Input
            {...register('euVatNumber')}
            id={CUSTOMER_EDIT_FIELD_IDS.euVatNumber}
            label={CUSTOMER_DETAIL_FIELD_LABELS.euVatNumber}
            error={errors.euVatNumber?.message}
            autoComplete="off"
          />

          <Input
            {...register('companyRegistrationNumber')}
            id={CUSTOMER_EDIT_FIELD_IDS.companyRegistrationNumber}
            label={CUSTOMER_DETAIL_FIELD_LABELS.companyRegistrationNumber}
            error={errors.companyRegistrationNumber?.message}
            autoComplete="off"
          />

          <Input
            {...register('legalForm')}
            id={CUSTOMER_EDIT_FIELD_IDS.legalForm}
            label={CUSTOMER_DETAIL_FIELD_LABELS.legalForm}
            error={errors.legalForm?.message}
            autoComplete="off"
          />
        </div>
      </FormSection>

      <FormSection legend={CUSTOMER_EDIT_SECTION_TITLES.address}>
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            {...register('registeredAddressZip')}
            id={CUSTOMER_EDIT_FIELD_IDS.registeredAddressZip}
            label={CUSTOMER_DETAIL_FIELD_LABELS.zip}
            hint={CUSTOMER_EDIT_FIELD_HINTS.registeredAddressZip}
            error={errors.registeredAddressZip?.message}
            autoComplete="off"
            inputMode="numeric"
          />

          <Input
            {...register('registeredAddressCity')}
            id={CUSTOMER_EDIT_FIELD_IDS.registeredAddressCity}
            label={CUSTOMER_DETAIL_FIELD_LABELS.city}
            error={errors.registeredAddressCity?.message}
            autoComplete="off"
          />

          <Input
            {...register('registeredAddressLine')}
            id={CUSTOMER_EDIT_FIELD_IDS.registeredAddressLine}
            label={CUSTOMER_DETAIL_FIELD_LABELS.addressLine}
            error={errors.registeredAddressLine?.message}
            autoComplete="off"
          />

          <FormField
            id={CUSTOMER_EDIT_FIELD_IDS.registeredAddressCountry}
            label={CUSTOMER_DETAIL_FIELD_LABELS.country}
            hint={CUSTOMER_EDIT_FIELD_HINTS.registeredAddressCountry}
            error={errors.registeredAddressCountry?.message}
          >
            {(field) => (
              <Select
                {...register('registeredAddressCountry')}
                id={field.id}
                invalid={field.invalid}
                describedBy={field.describedBy}
                options={countryOptions}
              />
            )}
          </FormField>
        </div>
      </FormSection>

      <FormSection legend={CUSTOMER_EDIT_SECTION_TITLES.classification}>
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            {...register('industry')}
            id={CUSTOMER_EDIT_FIELD_IDS.industry}
            label={CUSTOMER_DETAIL_FIELD_LABELS.industry}
            error={errors.industry?.message}
            autoComplete="off"
          />

          <FormField
            id={CUSTOMER_EDIT_FIELD_IDS.headcountRange}
            label={CUSTOMER_DETAIL_FIELD_LABELS.headcountRange}
            error={errors.headcountRange?.message}
          >
            {(field) => (
              <Select
                {...register('headcountRange')}
                id={field.id}
                invalid={field.invalid}
                describedBy={field.describedBy}
                options={CUSTOMER_EDIT_HEADCOUNT_OPTIONS}
              />
            )}
          </FormField>

          <FormField
            id={CUSTOMER_EDIT_FIELD_IDS.source}
            label={CUSTOMER_DETAIL_FIELD_LABELS.source}
            error={errors.source?.message}
          >
            {(field) => (
              <Select
                {...register('source')}
                id={field.id}
                invalid={field.invalid}
                describedBy={field.describedBy}
                options={CUSTOMER_EDIT_SOURCE_OPTIONS}
              />
            )}
          </FormField>
        </div>
      </FormSection>

      <FormActions
        submitLabel={CUSTOMER_EDIT_SUBMIT_LABEL}
        cancelLabel={CUSTOMER_EDIT_CANCEL_LABEL}
        onCancel={onLeave}
        isSubmitting={formState.isSubmitting}
      />
    </form>
  );
}
