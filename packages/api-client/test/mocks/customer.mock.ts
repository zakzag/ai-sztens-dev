/**
 * `Customer` fixtures for the service tests (AIS-178/c).
 *
 * The sample payloads themselves live in `@callback/shared`
 * (`customers.fixture.ts`): the very same objects are the published `example` of
 * every `customers` registry entry and the inputs of the shared schema tests, so
 * writing a second copy here would let the documented example drift away from
 * the schema it illustrates. This module only re-exports them under the names the
 * client tests read naturally, and adds the one value the shared file has no
 * reason to know about: the row the server returns **after** a successful
 * `PATCH`.
 */

import {
  INVITED_CUSTOMER_USER,
  SECOND_CONTACT,
  SECOND_CUSTOMER,
  VALID_ACTIVITY,
  VALID_ACTIVITY_LIST,
  VALID_ATTACH_CUSTOMER_TAG_REQUEST,
  VALID_AUDIT_LOG_LIST,
  VALID_CONTACT,
  VALID_CONTACT_LIST,
  VALID_CREATE_CONTACT_REQUEST,
  VALID_CREATE_CUSTOMER_REQUEST,
  VALID_CREATE_CUSTOMER_TAG_REQUEST,
  VALID_CUSTOMER,
  VALID_CUSTOMER_DETAIL,
  VALID_CUSTOMER_LIST,
  VALID_CUSTOMER_TAG,
  VALID_INVITE_CUSTOMER_USER_REQUEST,
  VALID_UPDATE_CONTACT_REQUEST,
  VALID_UPDATE_CUSTOMER_REQUEST,
  VALID_UPDATE_CUSTOMER_USER_REQUEST,
  type Activity,
  type AttachCustomerTagInput,
  type CreateActivityInput,
  type CreateContactInput,
  type CreateCustomerInput,
  type CreateCustomerTagInput,
  type Customer,
  type CustomerTag,
  type CustomerUser,
  type InviteCustomerUserInput,
  type UpdateActivityInput,
  type UpdateContactInput,
  type UpdateCustomerInput,
  type UpdateCustomerUserInput,
} from '@callback/shared';

export {
  INVITED_CUSTOMER_USER,
  SECOND_CONTACT,
  SECOND_CUSTOMER,
  VALID_ACTIVITY,
  VALID_ACTIVITY_LIST,
  VALID_AUDIT_LOG_LIST,
  VALID_CONTACT,
  VALID_CONTACT_LIST,
  VALID_CUSTOMER,
  VALID_CUSTOMER_DETAIL,
  VALID_CUSTOMER_LIST,
  VALID_CUSTOMER_TAG,
};

/** A minimal, valid `POST /api/admin/customers` body. */
export const VALID_CREATE_INPUT: CreateCustomerInput =
  VALID_CREATE_CUSTOMER_REQUEST;

/**
 * A valid `PATCH /api/admin/customers/:id` body.
 *
 * `updatedAt` repeats {@link VALID_CUSTOMER}'s version on purpose: the body is
 * what a client sends *after* reading that row, and the two values belonging
 * together is the whole point of the concurrency token.
 */
export const VALID_UPDATE_INPUT: UpdateCustomerInput =
  VALID_UPDATE_CUSTOMER_REQUEST;

/**
 * The version the server reports after a successful `PATCH`.
 *
 * `updatedAt` differs from {@link VALID_CUSTOMER}'s so a test can prove the
 * patched row (and not the pre-image) is what the transport returned.
 */
export const UPDATED_CUSTOMER: Customer = {
  ...VALID_CUSTOMER,
  shortName: 'Példa Kft. (új)',
  updatedAt: '2026-11-20T11:00:00.000Z',
};

/** A valid `POST /api/admin/customers/:id/contacts` body. */
export const VALID_CREATE_CONTACT_INPUT: CreateContactInput =
  VALID_CREATE_CONTACT_REQUEST;

/** A valid `PATCH /api/admin/customers/:id/contacts/:contactId` body. */
export const VALID_UPDATE_CONTACT_INPUT: UpdateContactInput =
  VALID_UPDATE_CONTACT_REQUEST;

/** A valid `POST /api/admin/customers/:id/tags` body (create-or-attach). */
export const VALID_CREATE_TAG_INPUT: CreateCustomerTagInput =
  VALID_CREATE_CUSTOMER_TAG_REQUEST;

/** A valid `PATCH /api/admin/customers/:id/tags` body (attach existing). */
export const VALID_ATTACH_TAG_INPUT: AttachCustomerTagInput =
  VALID_ATTACH_CUSTOMER_TAG_REQUEST;

/** A valid `POST /api/admin/customers/:id/customer-users` body. */
export const VALID_INVITE_USER_INPUT: InviteCustomerUserInput =
  VALID_INVITE_CUSTOMER_USER_REQUEST;

/** A valid `PATCH …/customer-users/:customerUserId` body (activation). */
export const VALID_UPDATE_USER_INPUT: UpdateCustomerUserInput =
  VALID_UPDATE_CUSTOMER_USER_REQUEST;

/** The version the server reports after a successful activation. */
export const ACTIVATED_CUSTOMER_USER: CustomerUser = {
  ...INVITED_CUSTOMER_USER,
  status: 'active',
  updatedAt: '2026-11-20T11:00:00.000Z',
};

/** The tag payload the endpoints return (the reused `premium` label). */
export const RETURNED_TAG: CustomerTag = VALID_CUSTOMER_TAG;

/** The activity payload the create/update routes answer with (AIS-178/f). */
export const RETURNED_ACTIVITY: Activity = VALID_ACTIVITY;

/** A valid `POST /api/admin/customers/:id/activities` body. */
export const VALID_CREATE_ACTIVITY_INPUT: CreateActivityInput = {
  type: 'note',
  body: 'Called the owner about the missing invoice.',
};

/**
 * A valid `PATCH …/activities/:activityId` body.
 *
 * The token is the row's **last write instant**; for a never-edited entry that is
 * its `createdAt` (`F4`).
 */
export const VALID_UPDATE_ACTIVITY_INPUT: UpdateActivityInput = {
  body: 'Called again; the invoice was sent.',
  updatedAt: VALID_ACTIVITY.createdAt,
};
