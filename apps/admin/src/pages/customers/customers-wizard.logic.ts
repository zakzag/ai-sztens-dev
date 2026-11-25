/**
 * Pure rules of the customers create wizard (AIS-182).
 *
 * Five jobs, all testable with values alone:
 *
 * 1. the **step order** — `nextStep` / `previousStep`, `null` at the boundaries;
 * 2. **step validation** — `canLeaveStep(draft, step)` runs the step's own schema,
 *    derived from the shared `createCustomerSchema` (AIS-112/AIS-131 rule), so the
 *    limits, the patterns and the Hungarian copy stay in the contract;
 * 3. **reachability** — `toReachableStep` / `isStepReachable` answer which steps
 *    the draft already unlocks, so the step strip can disable the rest. This is a
 *    **derived** value, not a second store field: the page store keeps the exact
 *    contract AIS-19 gave it;
 * 4. the **payload** — `toCreateCustomerPayload` turns the draft into the one
 *    `POST /api/admin/customers` body (`D-W6`), omitting every field the operator
 *    left empty;
 * 5. the **failure routing** — `toWizardServerError` maps a rejection onto the
 *    step whose input can fix it (`D8`), using the shared `toFieldErrors`.
 *
 * No JSX, no hook, no I/O. Copy lives in `customers.const.ts`, the entity labels
 * come from `entities/customer`, and the field union belongs to `features`.
 */

import {
  CUSTOMER_ADDRESS_CITY_MAX_LENGTH,
  CUSTOMER_ADDRESS_LINE_MAX_LENGTH,
  CUSTOMER_DEFAULT_COUNTRY,
  CUSTOMER_EU_VAT_NUMBER_MAX_LENGTH,
  CUSTOMER_LEGAL_FORM_MAX_LENGTH,
  CUSTOMER_LEGAL_NAME_MAX_LENGTH,
  CUSTOMER_REGISTRATION_NUMBER_MAX_LENGTH,
  CUSTOMER_SHORT_NAME_MAX_LENGTH,
  createCustomerSchema,
  customerCountrySchema,
  huPostalCodeSchema,
  huTaxNumberSchema,
  nonEmptyTextSchema,
  trimmedStringSchema,
  type CreateCustomerInput,
} from '@callback/shared';
import type { DescriptionListItem } from '@callback/ui';
import type { z } from 'zod';
import {
  CUSTOMER_DETAIL_FIELD_LABELS,
  CUSTOMER_TYPE_LABELS,
} from '../../entities/customer/customer.const.js';
import {
  CUSTOMER_CREATE_DEFAULT_PATH_BY_CODE,
  CUSTOMER_CREATE_FIELD_PATHS,
} from '../../features/customers/customers.const.js';
import type { CustomerCreateFieldName } from '../../features/customers/customers.interface.js';
import { toFieldErrors } from '../../lib/field-errors.logic.js';
import { toOptionalFormatSchema } from '../../lib/optional-format.schema.js';
import {
  CUSTOMER_WIZARD_STEP_VALUES,
  CUSTOMERS_WIZARD_DEFAULT_STEP,
  CUSTOMERS_WIZARD_EMPTY_VALUE,
} from './customers.const.js';
import type {
  CustomerAddressValues,
  CustomerNameValues,
  CustomerWizardServerError,
} from './customers.interface.js';
import { CustomersWizardIncompleteError } from './customers-wizard.errors.js';
import type { CustomerWizardStep } from './customers-wizard.interface.js';
import { toCustomerType } from './customers.logic.js';

/**
 * Field rules of step 1.
 *
 * Picked from the request schema, so the closed value set (and `.strict()`) is
 * the contract's: `type` is the only field the step owns.
 */
export const customerTypeStepSchema = createCustomerSchema.pick({ type: true });

/**
 * Field rules of step 2 (*Név és adószám*).
 *
 * `legalName` stays required (a customer without a name cannot be stored), while
 * every other field is optional **and** may be empty — the only way a text input
 * can say “no value yet”. `taxNumber` keeps the shared format copy through
 * {@link toOptionalFormatSchema}.
 */
export const customerNameStepSchema: z.ZodType<CustomerNameValues> =
  createCustomerSchema
    .pick({
      legalName: true,
      shortName: true,
      taxNumber: true,
      euVatNumber: true,
      companyRegistrationNumber: true,
      legalForm: true,
    })
    .extend({
      legalName: nonEmptyTextSchema({ max: CUSTOMER_LEGAL_NAME_MAX_LENGTH }),
      shortName: trimmedStringSchema({ max: CUSTOMER_SHORT_NAME_MAX_LENGTH }),
      taxNumber: toOptionalFormatSchema(huTaxNumberSchema),
      euVatNumber: trimmedStringSchema({
        max: CUSTOMER_EU_VAT_NUMBER_MAX_LENGTH,
      }),
      companyRegistrationNumber: trimmedStringSchema({
        max: CUSTOMER_REGISTRATION_NUMBER_MAX_LENGTH,
      }),
      legalForm: trimmedStringSchema({ max: CUSTOMER_LEGAL_FORM_MAX_LENGTH }),
    });

/**
 * Field rules of step 3 (*Cím*).
 *
 * The country is required here — every customer has a registered country — and
 * `toAddressValues` pre-fills the contract's default (`HU`), so an operator never
 * has to think about it.
 */
export const customerAddressStepSchema: z.ZodType<CustomerAddressValues> =
  createCustomerSchema
    .pick({
      registeredAddressZip: true,
      registeredAddressCity: true,
      registeredAddressLine: true,
      registeredAddressCountry: true,
    })
    .extend({
      registeredAddressZip: toOptionalFormatSchema(huPostalCodeSchema),
      registeredAddressCity: trimmedStringSchema({
        max: CUSTOMER_ADDRESS_CITY_MAX_LENGTH,
      }),
      registeredAddressLine: trimmedStringSchema({
        max: CUSTOMER_ADDRESS_LINE_MAX_LENGTH,
      }),
      registeredAddressCountry: customerCountrySchema,
    });

/** Every input of step 2, in visual order — the focus order of a `422`. */
export const CUSTOMER_NAME_STEP_FIELD_PATHS: readonly (keyof CustomerNameValues)[] =
  Object.freeze([
    'legalName',
    'shortName',
    'taxNumber',
    'euVatNumber',
    'companyRegistrationNumber',
    'legalForm',
  ]);

/** Every input of step 3, in visual order. */
export const CUSTOMER_ADDRESS_STEP_FIELD_PATHS: readonly (keyof CustomerAddressValues)[] =
  Object.freeze([
    'registeredAddressZip',
    'registeredAddressCity',
    'registeredAddressLine',
    'registeredAddressCountry',
  ]);

/**
 * Which step owns which input.
 *
 * A total `Record` over the feature's field union, so a field added there without
 * a step breaks the build instead of becoming unreachable on a `422`.
 */
const STEP_BY_FIELD: Readonly<
  Record<CustomerCreateFieldName, CustomerWizardStep>
> = Object.freeze({
  legalName: '2',
  shortName: '2',
  taxNumber: '2',
  euVatNumber: '2',
  companyRegistrationNumber: '2',
  legalForm: '2',
  registeredAddressZip: '3',
  registeredAddressCity: '3',
  registeredAddressLine: '3',
  registeredAddressCountry: '3',
});

/**
 * @param value - a raw form text.
 * @returns the trimmed text, or `undefined` when it is empty, i.e. “omit this
 *   field from the create body”.
 */
function toOptionalText(value: string | undefined): string | undefined {
  const trimmed = (value ?? '').trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * @param value - the draft's country code, if any.
 * @returns the upper-cased ISO code, or the contract default when absent.
 */
function toCountryCode(value: string | undefined): string {
  const code = (value ?? '').trim().toUpperCase();

  return code.length > 0 ? code : CUSTOMER_DEFAULT_COUNTRY;
}

/**
 * @param value - a draft text.
 * @returns the value the review summary renders, or the placeholder.
 */
function toDisplayText(value: string | undefined): string {
  return toOptionalText(value) ?? CUSTOMERS_WIZARD_EMPTY_VALUE;
}

/**
 * @param step - the current step.
 * @returns the step after it, or `null` on the last one.
 */
export function nextStep(step: CustomerWizardStep): CustomerWizardStep | null {
  const index = CUSTOMER_WIZARD_STEP_VALUES.indexOf(step);

  return CUSTOMER_WIZARD_STEP_VALUES[index + 1] ?? null;
}

/**
 * @param step - the current step.
 * @returns the step before it, or `null` on the first one.
 */
export function previousStep(
  step: CustomerWizardStep,
): CustomerWizardStep | null {
  const index = CUSTOMER_WIZARD_STEP_VALUES.indexOf(step);

  return index <= 0 ? null : (CUSTOMER_WIZARD_STEP_VALUES[index - 1] ?? null);
}

/**
 * The draft's values as step 2's form shows them.
 *
 * @param draft - the values collected so far.
 * @returns every field as a string; an absent value becomes `''`.
 */
export function toNameValues(
  draft: Partial<CreateCustomerInput>,
): CustomerNameValues {
  return {
    legalName: draft.legalName ?? '',
    shortName: draft.shortName ?? '',
    taxNumber: draft.taxNumber ?? '',
    euVatNumber: draft.euVatNumber ?? '',
    companyRegistrationNumber: draft.companyRegistrationNumber ?? '',
    legalForm: draft.legalForm ?? '',
  };
}

/**
 * The draft's values as step 3's form shows them.
 *
 * @param draft - the values collected so far.
 * @returns the four address fields, with the contract's country default.
 */
export function toAddressValues(
  draft: Partial<CreateCustomerInput>,
): CustomerAddressValues {
  return {
    registeredAddressZip: draft.registeredAddressZip ?? '',
    registeredAddressCity: draft.registeredAddressCity ?? '',
    registeredAddressLine: draft.registeredAddressLine ?? '',
    registeredAddressCountry: toCountryCode(draft.registeredAddressCountry),
  };
}

/**
 * Answers whether the step's own inputs would pass the contract.
 *
 * Only the step's fields are validated: a later step's fields are legitimately
 * empty while the operator is still on this one.
 *
 * @param draft - the values collected so far.
 * @param step - the step the operator wants to leave.
 * @returns `true` when every field of that step is acceptable; step 4 always is
 *   (it has no input of its own — submitting is its action).
 */
export function canLeaveStep(
  draft: Partial<CreateCustomerInput>,
  step: CustomerWizardStep,
): boolean {
  switch (step) {
    case '1':
      return customerTypeStepSchema.safeParse({ type: draft.type }).success;
    case '2':
      return customerNameStepSchema.safeParse(toNameValues(draft)).success;
    case '3':
      return customerAddressStepSchema.safeParse(toAddressValues(draft)).success;
    case '4':
      return true;
  }
}

/**
 * The **last** step the draft already unlocks.
 *
 * Derived from the draft instead of stored, which is what keeps the page store's
 * AIS-19 contract intact while the step strip still forbids jumping ahead: a step
 * is reachable exactly when every step before it can be left.
 *
 * @param draft - the values collected so far.
 * @returns `1` for an empty draft, up to `4` once steps 1–3 are all valid.
 */
export function toReachableStep(
  draft: Partial<CreateCustomerInput>,
): CustomerWizardStep {
  let reachable: CustomerWizardStep = CUSTOMERS_WIZARD_DEFAULT_STEP;

  for (const step of CUSTOMER_WIZARD_STEP_VALUES) {
    if (step === '4' || !canLeaveStep(draft, step)) {
      break;
    }

    reachable = nextStep(step) ?? step;
  }

  return reachable;
}

/**
 * @param draft - the values collected so far.
 * @param step - the requested step.
 * @returns `true` when the step strip may jump there.
 */
export function isStepReachable(
  draft: Partial<CreateCustomerInput>,
  step: CustomerWizardStep,
): boolean {
  const reachable = toReachableStep(draft);

  return (
    CUSTOMER_WIZARD_STEP_VALUES.indexOf(step) <=
    CUSTOMER_WIZARD_STEP_VALUES.indexOf(reachable)
  );
}

/**
 * @param draft - the values collected so far.
 * @returns `true` when the review step may submit (`reachableStep === '4'`).
 */
export function isDraftComplete(
  draft: Partial<CreateCustomerInput>,
): boolean {
  return toReachableStep(draft) === '4';
}

/**
 * Builds the body of the **one** `POST /api/admin/customers` (AIS-182, `D-W6`).
 *
 * Only what the operator actually entered travels: an emptied or skipped field is
 * omitted, never sent as `''`, so the server's own defaults apply
 * (`registeredAddressCountry` and `status` in particular). The whole body is
 * re-validated against `createCustomerSchema` before it leaves — a hand-edited
 * `?step=4` must not reach the network with a body the contract refuses.
 *
 * @param draft - the values collected so far.
 * @returns the create body.
 * @throws {CustomersWizardIncompleteError} when a required part is missing or a
 *   format rule fails — unreachable through the wizard, and deliberately loud.
 */
export function toCreateCustomerPayload(
  draft: Partial<CreateCustomerInput>,
): CreateCustomerInput {
  const type = toCustomerType(draft.type ?? '');
  const legalName = (draft.legalName ?? '').trim();

  if (type === undefined) {
    throw new CustomersWizardIncompleteError(['type']);
  }

  if (legalName.length === 0) {
    throw new CustomersWizardIncompleteError(['legalName']);
  }

  const payload: CreateCustomerInput = {
    type,
    legalName,
    shortName: toOptionalText(draft.shortName),
    taxNumber: toOptionalText(draft.taxNumber),
    euVatNumber: toOptionalText(draft.euVatNumber),
    companyRegistrationNumber: toOptionalText(draft.companyRegistrationNumber),
    legalForm: toOptionalText(draft.legalForm),
    registeredAddressZip: toOptionalText(draft.registeredAddressZip),
    registeredAddressCity: toOptionalText(draft.registeredAddressCity),
    registeredAddressLine: toOptionalText(draft.registeredAddressLine),
    registeredAddressCountry: toCountryCode(draft.registeredAddressCountry),
  };

  const result = createCustomerSchema.safeParse(payload);

  if (!result.success) {
    throw new CustomersWizardIncompleteError(
      result.error.issues.map((issue) => issue.path.join('.')),
    );
  }

  return payload;
}

/**
 * The read-only summary the review step renders.
 *
 * Every value comes through the same label tables the detail page uses, so the
 * operator reviews the customer in the vocabulary they will see afterwards; a
 * value the draft does not hold renders as the placeholder instead of an empty
 * row.
 *
 * @param draft - the values collected so far.
 * @returns the label/value pairs, in the wizard's own order.
 */
export function toWizardSummary(
  draft: Partial<CreateCustomerInput>,
): readonly DescriptionListItem[] {
  const type = toCustomerType(draft.type ?? '');

  return [
    {
      label: CUSTOMER_DETAIL_FIELD_LABELS.type,
      value:
        type === undefined
          ? CUSTOMERS_WIZARD_EMPTY_VALUE
          : CUSTOMER_TYPE_LABELS[type],
    },
    {
      label: CUSTOMER_DETAIL_FIELD_LABELS.legalName,
      value: toDisplayText(draft.legalName),
    },
    {
      label: CUSTOMER_DETAIL_FIELD_LABELS.shortName,
      value: toDisplayText(draft.shortName),
    },
    {
      label: CUSTOMER_DETAIL_FIELD_LABELS.taxNumber,
      value: toDisplayText(draft.taxNumber),
    },
    {
      label: CUSTOMER_DETAIL_FIELD_LABELS.euVatNumber,
      value: toDisplayText(draft.euVatNumber),
    },
    {
      label: CUSTOMER_DETAIL_FIELD_LABELS.companyRegistrationNumber,
      value: toDisplayText(draft.companyRegistrationNumber),
    },
    {
      label: CUSTOMER_DETAIL_FIELD_LABELS.legalForm,
      value: toDisplayText(draft.legalForm),
    },
    {
      label: CUSTOMER_DETAIL_FIELD_LABELS.zip,
      value: toDisplayText(draft.registeredAddressZip),
    },
    {
      label: CUSTOMER_DETAIL_FIELD_LABELS.city,
      value: toDisplayText(draft.registeredAddressCity),
    },
    {
      label: CUSTOMER_DETAIL_FIELD_LABELS.addressLine,
      value: toDisplayText(draft.registeredAddressLine),
    },
    {
      label: CUSTOMER_DETAIL_FIELD_LABELS.country,
      value: toCountryCode(draft.registeredAddressCountry),
    },
  ];
}

/**
 * @param field - one of the wizard's inputs.
 * @returns the step that renders it.
 */
export function toWizardStepOfField(
  field: CustomerCreateFieldName,
): CustomerWizardStep {
  return STEP_BY_FIELD[field];
}

/**
 * Routes a failed create onto the step that can fix it (AIS-182, `D8`).
 *
 * The mapping itself is the shared one (`toFieldErrors` + the feature's field
 * paths and code table), so a `409 CUSTOMER_TAX_NUMBER_CONFLICT` without an
 * `issues[]` block still lands on `taxNumber` — and therefore on step 2. A
 * failure no input can fix stays on step 4, where the residue `Alert` renders it.
 *
 * @param error - whatever the mutation rejected with; never trusted.
 * @returns the step to navigate to plus the untouched raw error.
 */
export function toWizardServerError(error: unknown): CustomerWizardServerError {
  const { fields } = toFieldErrors<CustomerCreateFieldName>(error, {
    fieldPaths: CUSTOMER_CREATE_FIELD_PATHS,
    defaultPathByCode: CUSTOMER_CREATE_DEFAULT_PATH_BY_CODE,
  });

  const offending = CUSTOMER_CREATE_FIELD_PATHS.find(
    (path) => fields[path] !== undefined,
  );

  return {
    step: offending === undefined ? '4' : toWizardStepOfField(offending),
    error,
  };
}
