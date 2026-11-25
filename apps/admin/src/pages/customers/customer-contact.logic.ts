/**
 * Pure rules of the contact form (AIS-179).
 *
 * The form shows **one** shape — strings and three role booleans — and the wire
 * has another: a `roles[]` array plus `null` for an absent optional field. The two
 * converters in this file are the only place that boundary is crossed, so the
 * component stays markup and the rules are testable without React.
 *
 * Validation reuses the shared format schemas (`emailSchema`, `phoneSchema`
 * semantics) instead of inventing patterns: the copy comes from the shared
 * validation catalogue, so the form cannot word a rule differently from the API.
 * An empty string is a valid value for the optional inputs, which is why the
 * refinement is skipped for it.
 */

import {
  CONTACT_NAME_MAX_LENGTH,
  CONTACT_POSITION_MAX_LENGTH,
  emailSchema,
  isValidPhone,
  resolveMessage,
  type ContactRole,
  type CreateContactInput,
  type UpdateContactInput,
} from '@callback/shared';
import type { SelectOption } from '@callback/ui';
import { z } from 'zod';
import { CUSTOMER_EMPTY_VALUE_LABEL } from '../../entities/customer/customer.const.js';
import type {
  CustomerContactViewModel,
  CustomerUserViewModels,
} from '../../entities/customer/customer.interface.js';
import {
  CUSTOMER_CONTACT_NO_USER_LABEL,
  CUSTOMER_CONTACT_ROLE_FIELDS,
} from './customers.const.js';
import type { CustomerContactFormValues } from './customers.interface.js';

/** Optional e-mail: `''` is “not set”, anything else must be a valid address. */
const optionalEmailSchema = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    if (value.length === 0) {
      return;
    }

    if (!emailSchema.safeParse(value).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: resolveMessage('EMAIL'),
      });
    }
  });

/** Optional phone: `''` is “not set”, anything else must be a real number. */
const optionalPhoneSchema = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    if (value.length === 0) {
      return;
    }

    if (!isValidPhone(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: resolveMessage('PHONE'),
      });
    }
  });

/**
 * The contact form's own schema.
 *
 * `customerUserId` is a plain string because the select offers `''` for “no login
 * user”; `toCreateContactInput()` drops that key instead of sending an empty uuid.
 */
export const customerContactFormSchema = z.object({
  name: z.string().trim().min(1).max(CONTACT_NAME_MAX_LENGTH),
  position: z.string().trim().max(CONTACT_POSITION_MAX_LENGTH),
  email: optionalEmailSchema,
  phone: optionalPhoneSchema,
  customerUserId: z.string(),
  isPrimary: z.boolean(),
  isTechnical: z.boolean(),
  isAlerting: z.boolean(),
  isActive: z.boolean(),
});

/** The values a creation starts from: no roles, active by default. */
const EMPTY_CONTACT_FORM_VALUES: CustomerContactFormValues = Object.freeze({
  name: '',
  position: '',
  email: '',
  phone: '',
  customerUserId: '',
  isPrimary: false,
  isTechnical: false,
  isAlerting: false,
  isActive: true,
});

/**
 * @param contact - the row being edited, or `null` when the form creates one.
 * @returns the values the inputs are seeded with.
 */
export function toCustomerContactFormValues(
  contact: CustomerContactViewModel | null,
): CustomerContactFormValues {
  if (contact === null) {
    return EMPTY_CONTACT_FORM_VALUES;
  }

  const holds = (role: ContactRole): boolean =>
    contact.roleBadges.some((badge) => badge.role === role);

  return {
    name: contact.name,
    position:
      contact.positionText === CUSTOMER_EMPTY_VALUE_LABEL
        ? ''
        : contact.positionText,
    email:
      contact.emailText === CUSTOMER_EMPTY_VALUE_LABEL ? '' : contact.emailText,
    phone:
      contact.phoneText === CUSTOMER_EMPTY_VALUE_LABEL ? '' : contact.phoneText,
    customerUserId: '',
    isPrimary: holds('primary'),
    isTechnical: holds('technical'),
    isAlerting: holds('alerting'),
    isActive: contact.isActive,
  };
}

/**
 * @param values - the form values.
 * @returns the role set in contract order, flags only.
 */
export function toContactRoles(
  values: CustomerContactFormValues,
): readonly ContactRole[] {
  return CUSTOMER_CONTACT_ROLE_FIELDS.filter(
    (definition) => values[definition.field],
  ).map((definition) => definition.role);
}

/**
 * Builds the create body.
 *
 * An empty optional input is **omitted**, not sent as an empty string: the request
 * schema is `.strict()` and treats an absent key as “no value”, while `''` would
 * fail the format check.
 *
 * @param values - the validated form values.
 * @returns the body of `POST /:id/contacts`.
 */
export function toCreateContactInput(
  values: CustomerContactFormValues,
): CreateContactInput {
  const position = values.position.trim();
  const email = values.email.trim();
  const phone = values.phone.trim();

  return {
    name: values.name.trim(),
    roles: [...toContactRoles(values)],
    ...(position.length === 0 ? {} : { position }),
    ...(email.length === 0 ? {} : { email }),
    ...(phone.length === 0 ? {} : { phone }),
    ...(values.customerUserId.length === 0
      ? {}
      : { customerUserId: values.customerUserId }),
  };
}

/**
 * Builds the patch body — the mirror image of a creation.
 *
 * Here an empty optional input becomes an explicit `null`: the operator cleared
 * the field, and “absent” would mean “leave it as it was”. The concurrency token
 * is always sent (AIS-21 decision 2).
 *
 * @param values - the validated form values.
 * @param updatedAt - the version the form was seeded from.
 * @returns the body of `PATCH /:id/contacts/:contactId`.
 */
export function toUpdateContactInput(
  values: CustomerContactFormValues,
  updatedAt: string,
): UpdateContactInput {
  const position = values.position.trim();
  const email = values.email.trim();
  const phone = values.phone.trim();

  return {
    name: values.name.trim(),
    position: position.length === 0 ? null : position,
    email: email.length === 0 ? null : email,
    phone: phone.length === 0 ? null : phone,
    customerUserId:
      values.customerUserId.length === 0 ? null : values.customerUserId,
    isActive: values.isActive,
    roles: [...toContactRoles(values)],
    updatedAt,
  };
}

/**
 * Options of the “belépő felhasználó” select.
 *
 * The first entry is the clearable “none” option, so a contact can be detached
 * from a login user; the rest are the customer's own users, which is exactly the
 * set the server accepts (`422 SEMANTIC_VALIDATION_FAILED` otherwise).
 *
 * @param users - the customer's login users, already mapped.
 * @returns the select options, “none” first.
 */
export function toContactUserOptions(
  users: CustomerUserViewModels,
): readonly SelectOption[] {
  return [
    { value: '', label: CUSTOMER_CONTACT_NO_USER_LABEL },
    ...users.map((user) => ({ value: user.id, label: `${user.name} (${user.email})` })),
  ];
}
