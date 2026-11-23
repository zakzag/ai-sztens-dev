/**
 * Registry entries of the `customers` resource (AIS-178, slice a).
 *
 * Six operations — the `customers` aggregate itself: list, read, create, edit,
 * status change, archive. The child resources (contacts, tags, activities,
 * audit log, customer users) are registered by the later slices of the same
 * ticket, because the contract gate demands that a registry entry, its client
 * service and its controller land together.
 *
 * Paths include the global `api` prefix and the `admin` segment
 * ({@link CUSTOMERS_PATH}), and use Nest's `:id` placeholder — the OpenAPI
 * generator converts it to `{id}`.
 *
 * `errors` names only the codes a route can **actually** answer with, taken from
 * the catalogue. The two customer-specific `409`s are the named unique
 * constraints (`customers_customer_number_key`,
 * `customers_tax_number_key`), never a pre-check.
 */

import { API_ERROR_CODE } from '../error-code.const.js';
import type { ApiEndpointContract } from '../endpoint.interface.js';
import { LIST_QUERY_PARAMETERS } from '../list-query.parameters.js';
import { noPayloadSchema } from '../no-payload.schema.js';
import {
  CUSTOMERS_CONTACT_ID_PARAM,
  CUSTOMERS_ID_PARAM,
  CUSTOMERS_PATH,
} from './customers.const.js';
import {
  VALID_CONTACT,
  VALID_CONTACT_LIST,
  VALID_CREATE_CONTACT_REQUEST,
  VALID_CREATE_CUSTOMER_REQUEST,
  VALID_CUSTOMER,
  VALID_CUSTOMER_DETAIL,
  VALID_CUSTOMER_LIST,
  VALID_UPDATE_CONTACT_REQUEST,
  VALID_UPDATE_CUSTOMER_REQUEST,
} from './customers.fixture.js';
import { CUSTOMER_LIST_QUERY_PARAMETERS } from './customers.list-query.js';
import {
  contactListSchema,
  contactSchema,
  createContactSchema,
  createCustomerSchema,
  customerDetailSchema,
  customerListSchema,
  customerSchema,
  updateContactSchema,
  updateCustomerSchema,
  updateCustomerStatusSchema,
} from './customers.schema.js';

/** Path of the single-customer route, in Nest's `:param` notation. */
const CUSTOMER_PATH = `${CUSTOMERS_PATH}/${CUSTOMERS_ID_PARAM}`;

/** Path of the dedicated status change — never a field of the edit form. */
const CUSTOMER_STATUS_PATH = `${CUSTOMER_PATH}/status`;

/** Path of the contact collection of one customer (AIS-178, slice d). */
const CUSTOMER_CONTACTS_PATH = `${CUSTOMER_PATH}/contacts`;

/** Path of one contact inside its customer. */
const CUSTOMER_CONTACT_PATH = `${CUSTOMER_CONTACTS_PATH}/${CUSTOMERS_CONTACT_ID_PARAM}`;

/** Failures every route can produce, regardless of what it does. */
const COMMON_ERRORS = [
  API_ERROR_CODE.INTERNAL_ERROR,
  API_ERROR_CODE.SERVICE_UNAVAILABLE,
] as const;

/**
 * Sample `meta.pagination` of the list endpoint.
 *
 * Two rows, one page: the smallest honest example, derived from
 * {@link VALID_CUSTOMER_LIST}.
 */
const LIST_EXAMPLE_PAGINATION = {
  page: 1,
  limit: 20,
  total: VALID_CUSTOMER_LIST.length,
  totalPages: 1,
} as const;

/**
 * All documented endpoints of the `customers` aggregate.
 *
 * `as const satisfies` keeps the literal type of every entry (notably the
 * concrete zod type of `requestSchema`), so `RequestBodyOf<'customers.create'>`
 * resolves to {@link VALID_CREATE_CUSTOMER_REQUEST}'s type instead of `never`.
 */
export const CUSTOMERS_ENDPOINTS = [
  {
    operationId: 'customers.list',
    method: 'GET',
    path: CUSTOMERS_PATH,
    summary:
      'List customers with server-side search, four filters, sorting and pagination',
    tag: 'customers',
    successStatus: 200,
    dataSchema: customerListSchema,
    example: VALID_CUSTOMER_LIST,
    queryParameters: CUSTOMER_LIST_QUERY_PARAMETERS,
    examplePagination: LIST_EXAMPLE_PAGINATION,
    errors: [API_ERROR_CODE.VALIDATION_FAILED, ...COMMON_ERRORS],
    envelope: true,
  },
  {
    operationId: 'customers.findById',
    method: 'GET',
    path: CUSTOMER_PATH,
    summary:
      'Read one customer with its tags, contacts and login users in one round trip',
    tag: 'customers',
    successStatus: 200,
    dataSchema: customerDetailSchema,
    example: VALID_CUSTOMER_DETAIL,
    errors: [API_ERROR_CODE.NOT_FOUND, ...COMMON_ERRORS],
    envelope: true,
  },
  {
    operationId: 'customers.create',
    method: 'POST',
    path: CUSTOMERS_PATH,
    summary:
      'Create a customer; the customer number, status and timestamps are server-managed',
    tag: 'customers',
    successStatus: 201,
    dataSchema: customerSchema,
    requestSchema: createCustomerSchema,
    example: VALID_CUSTOMER,
    errors: [
      API_ERROR_CODE.VALIDATION_FAILED,
      API_ERROR_CODE.CUSTOMER_NUMBER_CONFLICT,
      API_ERROR_CODE.CUSTOMER_TAX_NUMBER_CONFLICT,
      ...COMMON_ERRORS,
    ],
    envelope: true,
  },
  {
    operationId: 'customers.update',
    method: 'PATCH',
    path: CUSTOMER_PATH,
    summary:
      'Update a customer (partial, guarded by the last known updatedAt)',
    tag: 'customers',
    successStatus: 200,
    dataSchema: customerSchema,
    requestSchema: updateCustomerSchema,
    example: VALID_UPDATE_CUSTOMER_REQUEST,
    errors: [
      API_ERROR_CODE.VALIDATION_FAILED,
      API_ERROR_CODE.NOT_FOUND,
      API_ERROR_CODE.STALE_WRITE,
      API_ERROR_CODE.CUSTOMER_TAX_NUMBER_CONFLICT,
      ...COMMON_ERRORS,
    ],
    envelope: true,
  },
  {
    operationId: 'customers.updateStatus',
    method: 'PATCH',
    path: CUSTOMER_STATUS_PATH,
    summary:
      'Change the lifecycle status; the service also writes statusChangedAt',
    tag: 'customers',
    successStatus: 200,
    dataSchema: customerSchema,
    requestSchema: updateCustomerStatusSchema,
    example: {
      ...VALID_CUSTOMER,
      status: 'active',
    },
    errors: [
      API_ERROR_CODE.VALIDATION_FAILED,
      API_ERROR_CODE.NOT_FOUND,
      API_ERROR_CODE.STALE_WRITE,
      ...COMMON_ERRORS,
    ],
    envelope: true,
  },
  {
    operationId: 'customers.remove',
    method: 'DELETE',
    path: CUSTOMER_PATH,
    summary:
      'Soft-delete (archive) a customer; the row disappears from every read and frees its tax number',
    tag: 'customers',
    successStatus: 200,
    dataSchema: noPayloadSchema,
    // `null` is the published sample: a `DELETE` has nothing to return, and the
    // envelope still carries `meta.requestId`.
    example: null,
    // No `STALE_WRITE`: a `DELETE` carries no body, so there is no token to
    // compare, and a soft delete loses no field value (AIS-178 `D5`). The only
    // documented failure is `404` — a repeat delete finds nothing to hide.
    errors: [API_ERROR_CODE.NOT_FOUND, ...COMMON_ERRORS],
    envelope: true,
  },
  {
    operationId: 'customers.listContacts',
    method: 'GET',
    path: CUSTOMER_CONTACTS_PATH,
    summary:
      'List the live contacts of one customer, paged and ordered by name',
    tag: 'customers',
    successStatus: 200,
    dataSchema: contactListSchema,
    example: VALID_CONTACT_LIST,
    queryParameters: LIST_QUERY_PARAMETERS,
    examplePagination: {
      page: 1,
      limit: 20,
      total: VALID_CONTACT_LIST.length,
      totalPages: 1,
    },
    errors: [
      API_ERROR_CODE.VALIDATION_FAILED,
      API_ERROR_CODE.NOT_FOUND,
      ...COMMON_ERRORS,
    ],
    envelope: true,
  },
  {
    operationId: 'customers.createContact',
    method: 'POST',
    path: CUSTOMER_CONTACTS_PATH,
    summary:
      'Add a contact to a customer; the role set is replaced atomically',
    tag: 'customers',
    successStatus: 201,
    dataSchema: contactSchema,
    requestSchema: createContactSchema,
    example: VALID_CONTACT,
    errors: [
      API_ERROR_CODE.VALIDATION_FAILED,
      API_ERROR_CODE.NOT_FOUND,
      API_ERROR_CODE.CUSTOMER_PRIMARY_CONTACT_CONFLICT,
      API_ERROR_CODE.SEMANTIC_VALIDATION_FAILED,
      ...COMMON_ERRORS,
    ],
    envelope: true,
  },
  {
    operationId: 'customers.updateContact',
    method: 'PATCH',
    path: CUSTOMER_CONTACT_PATH,
    summary:
      'Update a contact (partial, guarded by the last known updatedAt) and its roles',
    tag: 'customers',
    successStatus: 200,
    dataSchema: contactSchema,
    requestSchema: updateContactSchema,
    example: VALID_UPDATE_CONTACT_REQUEST,
    errors: [
      API_ERROR_CODE.VALIDATION_FAILED,
      API_ERROR_CODE.NOT_FOUND,
      API_ERROR_CODE.STALE_WRITE,
      API_ERROR_CODE.CUSTOMER_PRIMARY_CONTACT_CONFLICT,
      API_ERROR_CODE.SEMANTIC_VALIDATION_FAILED,
      ...COMMON_ERRORS,
    ],
    envelope: true,
  },
  {
    operationId: 'customers.removeContact',
    method: 'DELETE',
    path: CUSTOMER_CONTACT_PATH,
    summary:
      'Soft-delete a contact and drop its role rows, freeing the primary slot',
    tag: 'customers',
    successStatus: 200,
    dataSchema: noPayloadSchema,
    example: null,
    errors: [API_ERROR_CODE.NOT_FOUND, ...COMMON_ERRORS],
    envelope: true,
  },
] as const satisfies readonly ApiEndpointContract[];
