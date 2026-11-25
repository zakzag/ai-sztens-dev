/**
 * Pure rules of the customer **edit** surface (AIS-21).
 *
 * Four jobs, all testable with values alone:
 *
 * 1. `customerEditFormSchema` — **derived** from the shared `updateCustomerSchema`
 *    (AIS-112/AIS-131 rule): the limits, the patterns and one half of the copy
 *    stay in the contract, and only what genuinely differs in a form is
 *    restated. Two things differ:
 *    - `updatedAt` is a hidden concurrency token, bound at submit time, so it is
 *      not an input;
 *    - an optional format field may be **empty** (`''`), which is the only way a
 *      text input can say “no value”. `toOptionalFormatSchema()` keeps the shared
 *      schema's own issues for every non-empty value, so a mistyped tax number
 *      still gets the contract's `TAX_NUMBER` / `TAX_NUMBER_CHECKSUM` sentence.
 * 2. `toCustomerEditValues` — record → form values (`null` becomes `''`).
 * 3. `toUpdateCustomerPayload` — form values → `PATCH` body, always carrying the
 *    `updatedAt` token; `''` becomes `null` (“clear it”), never `undefined`
 *    (“leave it”), because the form shows the whole record.
 * 4. `toCountryOptions` — the controlled country list, extended with the record's
 *    own value when it is not in it: the wire field is a free ISO code, so a
 *    customer outside the market list must never lose its country on save.
 *
 * No JSX, no hook, no I/O. Copy lives in `customers.const.ts`, codes in
 * `lib/`, and the narrowing helpers are shared with `customers.logic.ts`.
 */

import {
  CUSTOMER_ADDRESS_CITY_MAX_LENGTH,
  CUSTOMER_ADDRESS_LINE_MAX_LENGTH,
  CUSTOMER_EU_VAT_NUMBER_MAX_LENGTH,
  CUSTOMER_INDUSTRY_MAX_LENGTH,
  CUSTOMER_LEGAL_FORM_MAX_LENGTH,
  CUSTOMER_LEGAL_NAME_MAX_LENGTH,
  CUSTOMER_REGISTRATION_NUMBER_MAX_LENGTH,
  CUSTOMER_SHORT_NAME_MAX_LENGTH,
  HEADCOUNT_RANGE_VALUES,
  customerCountrySchema,
  customerSourceSchema,
  customerTypeSchema,
  headcountRangeSchema,
  huPostalCodeSchema,
  huTaxNumberSchema,
  nonEmptyTextSchema,
  trimmedStringSchema,
  updateCustomerSchema,
  updateCustomerStatusSchema,
  type CustomerDetail,
  type HeadcountRange,
  type UpdateCustomerInput,
} from '@callback/shared';
import type { DescriptionListItem, SelectOption } from '@callback/ui';
import { z } from 'zod';
import {
  CUSTOMER_DETAIL_FIELD_LABELS,
} from '../../entities/customer/customer.const.js';
import { formatDateTime } from '../../lib/date.js';
import { CUSTOMER_COUNTRY_OPTIONS } from './customers.const.js';
import type {
  CustomerEditValues,
  CustomerStatusFormValues,
} from './customers.interface.js';
import { toCustomerSource, toCustomerType } from './customers.logic.js';

/**
 * Wraps a shared format schema so that the empty string is accepted.
 *
 * A text input cannot express “absent” any other way, so `''` short-circuits the
 * check; every non-empty value is validated by the **same** schema the request
 * uses, and its issues are re-added verbatim — that is what keeps the Hungarian
 * format copy (`TAX_NUMBER`, `TAX_NUMBER_CHECKSUM`, `POSTAL_CODE`) in the shared
 * catalogue instead of a second table here.
 *
 * @param schema - the shared format schema of the field.
 * @returns a string schema that accepts `''` and otherwise defers to `schema`.
 */
function toOptionalFormatSchema(
  schema: z.ZodType<string>,
): z.ZodEffects<z.ZodString, string, string> {
  return z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      if (value.length === 0) {
        return;
      }

      const result = schema.safeParse(value);

      if (!result.success) {
        result.error.issues.forEach((issue) => {
          ctx.addIssue(issue);
        });
      }
    });
}

/**
 * Field rules of the edit form.
 *
 * Built with `omit` + `extend` on the request schema, so the unknown-key policy
 * (`.strict()`) and every untouched rule survive. The three fields that carry a
 * contract-level requirement stay required here as well: a customer always has a
 * `type`, a `legalName` and a registered country, so an empty select is not a
 * state the form may produce.
 */
export const customerEditFormSchema: z.ZodType<CustomerEditValues> =
  updateCustomerSchema.omit({ updatedAt: true }).extend({
    type: customerTypeSchema,
    legalName: nonEmptyTextSchema({ max: CUSTOMER_LEGAL_NAME_MAX_LENGTH }),
    shortName: trimmedStringSchema({ max: CUSTOMER_SHORT_NAME_MAX_LENGTH }),
    taxNumber: toOptionalFormatSchema(huTaxNumberSchema),
    euVatNumber: trimmedStringSchema({ max: CUSTOMER_EU_VAT_NUMBER_MAX_LENGTH }),
    companyRegistrationNumber: trimmedStringSchema({
      max: CUSTOMER_REGISTRATION_NUMBER_MAX_LENGTH,
    }),
    legalForm: trimmedStringSchema({ max: CUSTOMER_LEGAL_FORM_MAX_LENGTH }),
    registeredAddressZip: toOptionalFormatSchema(huPostalCodeSchema),
    registeredAddressCity: trimmedStringSchema({
      max: CUSTOMER_ADDRESS_CITY_MAX_LENGTH,
    }),
    registeredAddressLine: trimmedStringSchema({
      max: CUSTOMER_ADDRESS_LINE_MAX_LENGTH,
    }),
    registeredAddressCountry: customerCountrySchema,
    industry: trimmedStringSchema({ max: CUSTOMER_INDUSTRY_MAX_LENGTH }),
    // A `<select>` either names a contract value or is empty; the union keeps the
    // empty option legal without inventing a sentinel value the server would see.
    headcountRange: headcountRangeSchema.or(z.literal('')),
    source: customerSourceSchema.or(z.literal('')),
  });

/**
 * Field rules of the status-change form (AIS-21).
 *
 * Derived from the shared `updateCustomerStatusSchema` with only the hidden
 * concurrency token removed: the status is the whole body, and the closed value
 * set must come from the contract — a `<select>` may not invent a status.
 */
export const customerStatusFormSchema: z.ZodType<CustomerStatusFormValues> =
  updateCustomerStatusSchema.omit({ updatedAt: true });

/**
 * @param dto - the record the edit page read.
 * @returns form values: every `null` as the empty string, so the inputs render
 *   the same way for “absent” and “emptied”.
 */
export function toCustomerEditValues(dto: CustomerDetail): CustomerEditValues {
  return {
    type: dto.type,
    legalName: dto.legalName,
    shortName: dto.shortName ?? '',
    taxNumber: dto.taxNumber ?? '',
    euVatNumber: dto.euVatNumber ?? '',
    companyRegistrationNumber: dto.companyRegistrationNumber ?? '',
    legalForm: dto.legalForm ?? '',
    registeredAddressZip: dto.registeredAddressZip ?? '',
    registeredAddressCity: dto.registeredAddressCity ?? '',
    registeredAddressLine: dto.registeredAddressLine ?? '',
    registeredAddressCountry: dto.registeredAddressCountry,
    industry: dto.industry ?? '',
    headcountRange: dto.headcountRange ?? '',
    source: dto.source ?? '',
  };
}

/**
 * @param value - a raw `<select>` value; `''` means “not set”.
 * @returns the matching headcount band, or `null`.
 */
function toHeadcountRange(value: string): HeadcountRange | null {
  return HEADCOUNT_RANGE_VALUES.find((candidate) => candidate === value) ?? null;
}

/**
 * @param value - a trimmed form text.
 * @returns the text, or `null` when it is empty.
 */
function toNullableText(value: string): string | null {
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Builds the body of `PATCH /api/admin/customers/:id`.
 *
 * The whole editable record travels, not a diff: the form shows every current
 * value, so an emptied field is an explicit `null` (“clear it”) and an unchanged
 * one cannot be confused with it. The server's audit writer keeps only the keys
 * that actually changed, so a full body records no false change — which is why
 * this deliberately differs from the wave plan's “changed fields only”.
 *
 * @param values - validated form values.
 * @param updatedAt - the version the form was seeded from; the server's
 *   `STALE_WRITE` check compares it against the stored row.
 * @returns the request body, always carrying the concurrency token.
 * @throws {RangeError} when `type` is not a contract value — unreachable behind
 *   {@link customerEditFormSchema}, and deliberately loud if it happens.
 */
export function toUpdateCustomerPayload(
  values: CustomerEditValues,
  updatedAt: string,
): UpdateCustomerInput {
  const type = toCustomerType(values.type);

  if (type === undefined) {
    throw new RangeError(`Unknown customer type: ${values.type}`);
  }

  return {
    type,
    legalName: values.legalName.trim(),
    shortName: toNullableText(values.shortName),
    taxNumber: toNullableText(values.taxNumber),
    euVatNumber: toNullableText(values.euVatNumber),
    companyRegistrationNumber: toNullableText(
      values.companyRegistrationNumber,
    ),
    legalForm: toNullableText(values.legalForm),
    registeredAddressZip: toNullableText(values.registeredAddressZip),
    registeredAddressCity: toNullableText(values.registeredAddressCity),
    registeredAddressLine: toNullableText(values.registeredAddressLine),
    registeredAddressCountry: values.registeredAddressCountry.trim(),
    industry: toNullableText(values.industry),
    headcountRange: toHeadcountRange(values.headcountRange),
    source: toCustomerSource(values.source) ?? null,
    updatedAt,
  };
}

/**
 * The country options of one record.
 *
 * The list is a convenience, not a contract enum, so a record whose country is
 * not on it keeps that value as an extra option. Without this the select would
 * show the first option instead of the stored one and a save would silently move
 * the customer to Hungary.
 *
 * @param current - the country the record currently holds.
 * @returns the fixed list, or the list plus the record's own code.
 */
export function toCountryOptions(current: string): readonly SelectOption[] {
  const code = current.trim().toUpperCase();

  if (
    code.length === 0 ||
    CUSTOMER_COUNTRY_OPTIONS.some((option) => option.value === code)
  ) {
    return CUSTOMER_COUNTRY_OPTIONS;
  }

  return Object.freeze([
    ...CUSTOMER_COUNTRY_OPTIONS,
    { value: code, label: code },
  ]);
}

/**
 * The read-only summary of the *Azonosítók* section.
 *
 * These four values are not inputs (`updateCustomerSchema` is `.strict()` and
 * rejects them), but the operator still needs them while editing — so they are
 * rendered as a `DescriptionList` beside the form. The status is **not** here:
 * it is a badge (a React node), and this module stays JSX-free; the form renders
 * `CustomerStatusBadge` for it.
 *
 * @param dto - the record the edit page read.
 * @returns the pairs, in the detail page's own order, dates already formatted.
 */
export function toReadOnlyItems(
  dto: CustomerDetail,
): readonly DescriptionListItem[] {
  return [
    {
      label: CUSTOMER_DETAIL_FIELD_LABELS.customerNumber,
      value: dto.customerNumber,
    },
    {
      label: CUSTOMER_DETAIL_FIELD_LABELS.createdAt,
      value: formatDateTime(dto.createdAt),
    },
    {
      label: CUSTOMER_DETAIL_FIELD_LABELS.updatedAt,
      value: formatDateTime(dto.updatedAt),
    },
  ];
}
