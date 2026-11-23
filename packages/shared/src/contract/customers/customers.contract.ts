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
  CUSTOMERS_ACTIVITY_ID_PARAM,
  CUSTOMERS_CONTACT_ID_PARAM,
  CUSTOMERS_CUSTOMER_USER_ID_PARAM,
  CUSTOMERS_ID_PARAM,
  CUSTOMERS_PATH,
  CUSTOMERS_TAG_ID_PARAM,
} from './customers.const.js';
import {
  INVITED_CUSTOMER_USER,
  SECOND_CUSTOMER_TAG,
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
  VALID_CUSTOMER_USER,
  VALID_INVITE_CUSTOMER_USER_REQUEST,
  VALID_UPDATE_CONTACT_REQUEST,
  VALID_UPDATE_CUSTOMER_REQUEST,
  VALID_UPDATE_CUSTOMER_USER_REQUEST,
} from './customers.fixture.js';
import {
  ACTIVITY_LIST_QUERY_PARAMETERS,
  AUDIT_LOG_LIST_QUERY_PARAMETERS,
  CUSTOMER_LIST_QUERY_PARAMETERS,
} from './customers.list-query.js';
import {
  activityListSchema,
  activitySchema,
  attachCustomerTagSchema,
  auditLogListSchema,
  contactListSchema,
  contactSchema,
  createActivitySchema,
  createContactSchema,
  createCustomerSchema,
  createCustomerTagSchema,
  customerDetailSchema,
  customerListSchema,
  customerSchema,
  customerTagSchema,
  customerUserSchema,
  inviteCustomerUserSchema,
  updateActivitySchema,
  updateContactSchema,
  updateCustomerSchema,
  updateCustomerUserSchema,
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

/** Path of the tag collection of one customer (AIS-178, slice e). */
const CUSTOMER_TAGS_PATH = `${CUSTOMER_PATH}/tags`;

/** Path of one tag **link** inside its customer — detach addresses it by id. */
const CUSTOMER_TAG_PATH = `${CUSTOMER_TAGS_PATH}/${CUSTOMERS_TAG_ID_PARAM}`;

/** Path of the login-user collection of one customer. */
const CUSTOMER_USERS_PATH = `${CUSTOMER_PATH}/customer-users`;

/** Path of one login user inside its customer. */
const CUSTOMER_USER_PATH = `${CUSTOMER_USERS_PATH}/${CUSTOMERS_CUSTOMER_USER_ID_PARAM}`;

/** Path of the activity feed of one customer (AIS-178, slice f). */
const CUSTOMER_ACTIVITIES_PATH = `${CUSTOMER_PATH}/activities`;

/** Path of one activity inside its customer. */
const CUSTOMER_ACTIVITY_PATH = `${CUSTOMER_ACTIVITIES_PATH}/${CUSTOMERS_ACTIVITY_ID_PARAM}`;

/** Path of the read-only ledger view of one customer. */
const CUSTOMER_AUDIT_LOGS_PATH = `${CUSTOMER_PATH}/audit-logs`;

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
  {
    operationId: 'customers.createTag',
    method: 'POST',
    path: CUSTOMER_TAGS_PATH,
    summary:
      'Attach a tag by name to a customer, creating the label only when it does not exist yet',
    tag: 'customers',
    successStatus: 201,
    dataSchema: customerTagSchema,
    requestSchema: createCustomerTagSchema,
    example: SECOND_CUSTOMER_TAG,
    // No conflict code: a name that already exists is **reused**, so the
    // catalogue's `tags_name_key` can never surface as a client error (AIS-178/e
    // `E7`).
    errors: [API_ERROR_CODE.VALIDATION_FAILED, API_ERROR_CODE.NOT_FOUND, ...COMMON_ERRORS],
    envelope: true,
  },
  {
    operationId: 'customers.attachTag',
    method: 'PATCH',
    path: CUSTOMER_TAGS_PATH,
    summary: 'Attach an already existing tag of the catalogue to a customer',
    tag: 'customers',
    successStatus: 200,
    dataSchema: customerTagSchema,
    requestSchema: attachCustomerTagSchema,
    example: VALID_CUSTOMER_TAG,
    errors: [
      API_ERROR_CODE.VALIDATION_FAILED,
      API_ERROR_CODE.NOT_FOUND,
      API_ERROR_CODE.SEMANTIC_VALIDATION_FAILED,
      ...COMMON_ERRORS,
    ],
    envelope: true,
  },
  {
    operationId: 'customers.detachTag',
    method: 'DELETE',
    path: CUSTOMER_TAG_PATH,
    summary:
      'Detach a tag from a customer; the catalogue label itself is never deleted',
    tag: 'customers',
    successStatus: 200,
    dataSchema: noPayloadSchema,
    example: null,
    errors: [
      API_ERROR_CODE.VALIDATION_FAILED,
      API_ERROR_CODE.NOT_FOUND,
      ...COMMON_ERRORS,
    ],
    envelope: true,
  },
  {
    operationId: 'customers.inviteCustomerUser',
    method: 'POST',
    path: CUSTOMER_USERS_PATH,
    summary:
      'Invite a login user to a customer; the row starts in the invited state',
    tag: 'customers',
    successStatus: 201,
    dataSchema: customerUserSchema,
    requestSchema: inviteCustomerUserSchema,
    example: VALID_CUSTOMER_USER,
    errors: [
      API_ERROR_CODE.VALIDATION_FAILED,
      API_ERROR_CODE.NOT_FOUND,
      API_ERROR_CODE.CUSTOMER_USER_EMAIL_CONFLICT,
      ...COMMON_ERRORS,
    ],
    envelope: true,
  },
  {
    operationId: 'customers.updateCustomerUser',
    method: 'PATCH',
    path: CUSTOMER_USER_PATH,
    summary:
      'Update a login user (name, role, status) — guarded by the last known updatedAt',
    tag: 'customers',
    successStatus: 200,
    dataSchema: customerUserSchema,
    requestSchema: updateCustomerUserSchema,
    example: VALID_UPDATE_CUSTOMER_USER_REQUEST,
    errors: [
      API_ERROR_CODE.VALIDATION_FAILED,
      API_ERROR_CODE.NOT_FOUND,
      API_ERROR_CODE.STALE_WRITE,
      API_ERROR_CODE.CUSTOMER_OWNER_CONFLICT,
      ...COMMON_ERRORS,
    ],
    envelope: true,
  },
  {
    operationId: 'customers.removeCustomerUser',
    method: 'DELETE',
    path: CUSTOMER_USER_PATH,
    summary:
      'Revoke a still pending invitation; a user that has ever been activated cannot be deleted',
    tag: 'customers',
    successStatus: 200,
    dataSchema: noPayloadSchema,
    example: null,
    errors: [
      API_ERROR_CODE.VALIDATION_FAILED,
      API_ERROR_CODE.NOT_FOUND,
      API_ERROR_CODE.SEMANTIC_VALIDATION_FAILED,
      API_ERROR_CODE.CUSTOMER_USER_IN_USE_CONFLICT,
      ...COMMON_ERRORS,
    ],
    envelope: true,
  },
  {
    operationId: 'customers.listActivities',
    method: 'GET',
    path: CUSTOMER_ACTIVITIES_PATH,
    summary:
      'List the activity feed of one customer, newest first and paged',
    tag: 'customers',
    successStatus: 200,
    dataSchema: activityListSchema,
    example: VALID_ACTIVITY_LIST,
    queryParameters: ACTIVITY_LIST_QUERY_PARAMETERS,
    examplePagination: {
      page: 1,
      limit: 20,
      total: VALID_ACTIVITY_LIST.length,
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
    operationId: 'customers.createActivity',
    method: 'POST',
    path: CUSTOMER_ACTIVITIES_PATH,
    summary:
      'Record an activity (a note, a call, a mail, a meeting) for one customer',
    tag: 'customers',
    successStatus: 201,
    dataSchema: activitySchema,
    requestSchema: createActivitySchema,
    example: VALID_ACTIVITY,
    errors: [
      API_ERROR_CODE.VALIDATION_FAILED,
      API_ERROR_CODE.NOT_FOUND,
      ...COMMON_ERRORS,
    ],
    envelope: true,
  },
  {
    operationId: 'customers.updateActivity',
    method: 'PATCH',
    path: CUSTOMER_ACTIVITY_PATH,
    summary:
      'Edit the body or the metadata of an activity (guarded by the last known write instant)',
    tag: 'customers',
    successStatus: 200,
    dataSchema: activitySchema,
    requestSchema: updateActivitySchema,
    example: VALID_ACTIVITY,
    errors: [
      API_ERROR_CODE.VALIDATION_FAILED,
      API_ERROR_CODE.NOT_FOUND,
      API_ERROR_CODE.STALE_WRITE,
      ...COMMON_ERRORS,
    ],
    envelope: true,
  },
  {
    operationId: 'customers.removeActivity',
    method: 'DELETE',
    path: CUSTOMER_ACTIVITY_PATH,
    summary:
      'Soft-delete an activity; the feed and lastActivityAt both fall back to the previous entry',
    tag: 'customers',
    successStatus: 200,
    dataSchema: noPayloadSchema,
    example: null,
    errors: [
      API_ERROR_CODE.VALIDATION_FAILED,
      API_ERROR_CODE.NOT_FOUND,
      ...COMMON_ERRORS,
    ],
    envelope: true,
  },
  {
    operationId: 'customers.listAuditLogs',
    method: 'GET',
    path: CUSTOMER_AUDIT_LOGS_PATH,
    summary:
      'Read the append-only audit ledger of one customer (no write path exists)',
    tag: 'customers',
    successStatus: 200,
    dataSchema: auditLogListSchema,
    example: VALID_AUDIT_LOG_LIST,
    queryParameters: AUDIT_LOG_LIST_QUERY_PARAMETERS,
    examplePagination: {
      page: 1,
      limit: 20,
      total: VALID_AUDIT_LOG_LIST.length,
      totalPages: 1,
    },
    errors: [
      API_ERROR_CODE.VALIDATION_FAILED,
      API_ERROR_CODE.NOT_FOUND,
      API_ERROR_CODE.SEMANTIC_VALIDATION_FAILED,
      ...COMMON_ERRORS,
    ],
    envelope: true,
  },
] as const satisfies readonly ApiEndpointContract[];
