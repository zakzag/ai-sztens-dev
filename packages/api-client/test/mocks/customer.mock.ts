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
  SECOND_CONTACT,
  SECOND_CUSTOMER,
  VALID_CONTACT,
  VALID_CONTACT_LIST,
  VALID_CREATE_CONTACT_REQUEST,
  VALID_CREATE_CUSTOMER_REQUEST,
  VALID_CUSTOMER,
  VALID_CUSTOMER_DETAIL,
  VALID_CUSTOMER_LIST,
  VALID_UPDATE_CONTACT_REQUEST,
  VALID_UPDATE_CUSTOMER_REQUEST,
  type CreateContactInput,
  type CreateCustomerInput,
  type Customer,
  type UpdateContactInput,
  type UpdateCustomerInput,
} from '@callback/shared';

export {
  SECOND_CONTACT,
  SECOND_CUSTOMER,
  VALID_CONTACT,
  VALID_CONTACT_LIST,
  VALID_CUSTOMER,
  VALID_CUSTOMER_DETAIL,
  VALID_CUSTOMER_LIST,
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
