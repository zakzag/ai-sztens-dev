/**
 * Pure rules of the *Tevékenység* form (AIS-181).
 *
 * The screen shows two controls and the wire wants two fields, so the only real
 * work here is the **schema**: it is derived from the shared request schemas, which
 * means the limits and the rejection copy come from `@callback/shared` and cannot
 * drift from what the API accepts.
 *
 * Two deliberate narrowings on top of the contract:
 *
 * - the `type` select offers the four **operator-writable** kinds only; the
 *   server-written `status_change` and `system` are not selectable
 *   ({@link CUSTOMER_ACTIVITY_WRITABLE_TYPES});
 * - the edit form's `body` is **required**, although `updateActivitySchema` makes
 *   it optional — that optionality exists for a patch that carries `metadata`
 *   alone, which this form never sends.
 */

import {
  createActivitySchema,
  type CreateActivityInput,
  type UpdateActivityInput,
} from '@callback/shared';
import type { SelectOption } from '@callback/ui';
import { z } from 'zod';
import {
  CUSTOMER_ACTIVITY_TYPE_LABELS,
  CUSTOMER_ACTIVITY_WRITABLE_TYPES,
} from '../../entities/customer/customer.const.js';
import type { CustomerActivityViewModel } from '../../entities/customer/customer.interface.js';
import type {
  CustomerActivityEditFormValues,
  CustomerActivityFormValues,
} from './customers.interface.js';

/**
 * The note form's schema.
 *
 * `body` is the very field of `createActivitySchema`, so the max length and the
 * “required” message are the contract's own.
 */
export const customerActivityFormSchema = z.object({
  type: z.enum(CUSTOMER_ACTIVITY_WRITABLE_TYPES),
  body: createActivitySchema.shape.body,
});

/** The inline editor's schema: the same body rules, no type control. */
export const customerActivityEditSchema = z.object({
  body: createActivitySchema.shape.body,
});

/** Values a fresh form starts from: a note with an empty body. */
export const EMPTY_ACTIVITY_FORM_VALUES: CustomerActivityFormValues =
  Object.freeze({
    type: 'note',
    body: '',
  });

/**
 * The options of the type select, in contract order.
 *
 * @returns one option per writable kind, labelled from the entity's copy table.
 */
export function toActivityTypeOptions(): readonly SelectOption[] {
  return CUSTOMER_ACTIVITY_WRITABLE_TYPES.map((value) => ({
    value,
    label: CUSTOMER_ACTIVITY_TYPE_LABELS[value],
  }));
}

/**
 * @param activity - the row being edited, already mapped.
 * @returns the values the inline editor is seeded with.
 */
export function toCustomerActivityFormValues(
  activity: CustomerActivityViewModel,
): CustomerActivityEditFormValues {
  return { body: activity.body };
}

/**
 * Builds the create body.
 *
 * The author is absent by construction: the request schema is `.strict()` and the
 * server stamps `author_*` from the request context.
 *
 * @param values - the validated form values.
 * @returns the body of `POST /:id/activities`.
 */
export function toCreateActivityInput(
  values: CustomerActivityFormValues,
): CreateActivityInput {
  return { type: values.type, body: values.body.trim() };
}

/**
 * Builds the edit body.
 *
 * @param values - the validated form values.
 * @param updateToken - `updatedAt ?? createdAt` of the entry (AIS-181 `D13`).
 * @returns the body of `PATCH /:id/activities/:activityId`.
 */
export function toUpdateActivityInput(
  values: CustomerActivityEditFormValues,
  updateToken: string,
): UpdateActivityInput {
  return { body: values.body.trim(), updatedAt: updateToken };
}
