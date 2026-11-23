/**
 * Contract of the `customers` service (AIS-178/c).
 *
 * The interface is what React hooks depend on; the implementation
 * (`createCustomersService`) is only referenced by the composition root and by
 * the test that builds it over a doubled `fetch`. That keeps every consumer
 * testable with a plain object double.
 *
 * The reads follow the transport convention (AIS-109):
 *
 * - `list` returns the shared `ApiResult`, because a paginated list is the only
 *   call where `meta.pagination` is meaningful — the generic hook layer reads
 *   exactly that block;
 * - `findById` returns the detail payload, because a single resource never needs
 *   a pager.
 *
 * The writes follow `docs/Specs/API-Convention.md` §4.2 (AIS-108/110):
 *
 * - `update` and `updateStatus` send only the fields that change plus the
 *   **required** `updatedAt` concurrency token, so a stale edit can never
 *   silently overwrite a newer one — a mismatch is `409 STALE_WRITE`;
 * - `remove` is a **soft** delete that answers `200` with `data: null`, never
 *   `204`, so the envelope (and `meta.requestId`) survives. `null` is therefore
 *   the honest return type, not `void`.
 *
 * Failures are not translated here. The transport throws `ApiError`, and the
 * caller can rely on:
 *
 * - `404 NOT_FOUND` — no live customer owns the id (`findById`, `update`,
 *   `updateStatus`, `remove`);
 * - `409 STALE_WRITE` — the `updatedAt` the caller sent is no longer current;
 * - `409 CUSTOMER_NUMBER_CONFLICT` — the monthly number sequence could not be
 *   allocated (`create`);
 * - `409 CUSTOMER_TAX_NUMBER_CONFLICT` — another live customer owns the tax
 *   number (`create`, `update`), with `details[0].path === 'taxNumber'`.
 *
 * Every method accepts optional `RequestOptions` so the caller can pass an abort
 * `signal` (a TanStack Query cancellation) without the service having to know
 * about React.
 */

import type {
  ApiResult,
  AttachCustomerTagInput,
  Contact,
  CreateContactInput,
  CreateCustomerInput,
  CreateCustomerTagInput,
  Customer,
  CustomerDetail,
  CustomerListQuery,
  CustomerTag,
  CustomerUser,
  InviteCustomerUserInput,
  ListQuery,
  UpdateContactInput,
  UpdateCustomerInput,
  UpdateCustomerUserInput,
  UpdateCustomerStatusInput,
} from '@callback/shared';
import type { RequestOptions } from '../http-client.interface.js';

/** Reads, creates, updates, changes the status of and archives customers. */
export interface CustomersService {
  /**
   * `GET /api/admin/customers` — one page of customers, plus `meta.pagination`.
   *
   * Every filter of the query travels in the URL (`type`, `status`, `source`,
   * `responsibleOperatorId`, `q`); a field still at its default is omitted, so
   * the URL only carries what the operator actually changed.
   *
   * @param query - the validated list query.
   * @param options - optional abort signal / extra headers.
   * @throws {import('../api-error.js').ApiError} `400 VALIDATION_FAILED` for an
   *   unknown sort column or an invalid filter value.
   */
  list(
    query: CustomerListQuery,
    options?: RequestOptions,
  ): Promise<ApiResult<readonly Customer[]>>;

  /**
   * `GET /api/admin/customers/:id` — one customer with its tags, contacts and
   * login users in a single round trip.
   *
   * @param id - the customer's uuid.
   * @param options - optional abort signal / extra headers.
   * @throws {import('../api-error.js').ApiError} `404 NOT_FOUND` when no live
   *   row owns the id.
   */
  findById(id: string, options?: RequestOptions): Promise<CustomerDetail>;

  /**
   * `POST /api/admin/customers` — persists a customer.
   *
   * `customerNumber`, `statusChangedAt`, `createdAt` and `updatedAt` are
   * server-managed and are rejected by the request schema, not by this layer.
   *
   * @param input - the create payload.
   * @param options - optional abort signal / extra headers.
   * @throws {import('../api-error.js').ApiError} the two `409` conflicts above.
   */
  create(input: CreateCustomerInput, options?: RequestOptions): Promise<Customer>;

  /**
   * `PATCH /api/admin/customers/:id` — partial, version-guarded update.
   *
   * `undefined` means “leave the value alone”, `null` means “clear it”, and
   * `updatedAt` is the version the caller last read.
   *
   * @param id - the customer's uuid.
   * @param input - the changed fields plus the required `updatedAt` token.
   * @param options - optional abort signal / extra headers.
   * @throws {import('../api-error.js').ApiError} `404`, `409 STALE_WRITE` or
   *   `409 CUSTOMER_TAX_NUMBER_CONFLICT`.
   */
  update(
    id: string,
    input: UpdateCustomerInput,
    options?: RequestOptions,
  ): Promise<Customer>;

  /**
   * `PATCH /api/admin/customers/:id/status` — the dedicated status change.
   *
   * A route of its own: the server also writes `statusChangedAt` and records the
   * change as its own audit entry, which a generic field edit must not do.
   *
   * @param id - the customer's uuid.
   * @param input - the new status plus the required `updatedAt` token.
   * @param options - optional abort signal / extra headers.
   * @throws {import('../api-error.js').ApiError} `404` or `409 STALE_WRITE`.
   */
  updateStatus(
    id: string,
    input: UpdateCustomerStatusInput,
    options?: RequestOptions,
  ): Promise<Customer>;

  /**
   * `DELETE /api/admin/customers/:id` — archives the customer (soft delete).
   *
   * The row disappears from every read and frees its tax number, but keeps its
   * customer number and its ledger rows. A repeat delete answers `404`: the row
   * is already invisible, so reporting success would claim an effect the call
   * did not have.
   *
   * There is no body parameter — the convention has no body-carrying delete —
   * and the resolved value is `null` because the success envelope carries
   * `data: null`. The transport validates that shape, so a `204` or a non-`null`
   * payload is a contract violation instead of a silent success.
   *
   * @param id - the customer's uuid.
   * @param options - optional abort signal / extra headers.
   * @throws {import('../api-error.js').ApiError} `404 NOT_FOUND`.
   */
  remove(id: string, options?: RequestOptions): Promise<null>;

  /**
   * `GET /api/admin/customers/:id/contacts` — one page of the customer's
   * contacts, each with its role set.
   *
   * @param customerId - the customer's uuid.
   * @param query - the validated list query (`page`, `limit`, `order`, `q`).
   * @param options - optional abort signal / extra headers.
   * @throws {import('../api-error.js').ApiError} `404 NOT_FOUND` when the
   *   customer is not live, `400 VALIDATION_FAILED` for a bad query.
   */
  listContacts(
    customerId: string,
    query: ListQuery,
    options?: RequestOptions,
  ): Promise<ApiResult<readonly Contact[]>>;

  /**
   * `POST /api/admin/customers/:id/contacts` — adds a contact.
   *
   * `roles` is the whole role set of the new contact; `isActive` starts `true`
   * (the server decides that, not the caller).
   *
   * @param customerId - the customer's uuid.
   * @param input - the create payload.
   * @param options - optional abort signal / extra headers.
   * @throws {import('../api-error.js').ApiError} `404`, `409
   *   CUSTOMER_PRIMARY_CONTACT_CONFLICT`, `422 SEMANTIC_VALIDATION_FAILED` for a
   *   `customerUserId` of another customer.
   */
  createContact(
    customerId: string,
    input: CreateContactInput,
    options?: RequestOptions,
  ): Promise<Contact>;

  /**
   * `PATCH /api/admin/customers/:id/contacts/:contactId` — partial update.
   *
   * `roles`, when present, **replaces** the role set; `updatedAt` is the version
   * the caller last read, and a mismatch is `409 STALE_WRITE`.
   *
   * @param customerId - the customer's uuid.
   * @param contactId - the contact's uuid.
   * @param input - the changed fields, the role set to write and the token.
   * @param options - optional abort signal / extra headers.
   * @throws {import('../api-error.js').ApiError} `404`, `409 STALE_WRITE`, `409
   *   CUSTOMER_PRIMARY_CONTACT_CONFLICT`, `422 SEMANTIC_VALIDATION_FAILED`.
   */
  updateContact(
    customerId: string,
    contactId: string,
    input: UpdateContactInput,
    options?: RequestOptions,
  ): Promise<Contact>;

  /**
   * `DELETE /api/admin/customers/:id/contacts/:contactId` — archives the contact
   * and drops its role rows, freeing the `primary` slot.
   *
   * @param customerId - the customer's uuid.
   * @param contactId - the contact's uuid.
   * @param options - optional abort signal / extra headers.
   * @throws {import('../api-error.js').ApiError} `404 NOT_FOUND` (including a
   *   repeat delete).
   */
  removeContact(
    customerId: string,
    contactId: string,
    options?: RequestOptions,
  ): Promise<null>;

  /**
   * `POST /api/admin/customers/:id/tags` — **create-or-attach** a label by name.
   *
   * A name that already exists in the catalogue is reused, so the call is safe to
   * retry: the second attempt attaches the same label instead of failing. The
   * answer is `201` with the label either way.
   *
   * @param customerId - the customer's uuid.
   * @param input - the label name.
   * @param options - optional abort signal / extra headers.
   * @throws {import('../api-error.js').ApiError} `404 NOT_FOUND` when the customer
   *   is not live.
   */
  createTag(
    customerId: string,
    input: CreateCustomerTagInput,
    options?: RequestOptions,
  ): Promise<CustomerTag>;

  /**
   * `PATCH /api/admin/customers/:id/tags` — attaches an existing catalogue label.
   *
   * An already attached label is a no-op (`200`, same payload, no ledger row).
   *
   * @param customerId - the customer's uuid.
   * @param input - the label id to attach.
   * @param options - optional abort signal / extra headers.
   * @throws {import('../api-error.js').ApiError} `404`, `422
   *   SEMANTIC_VALIDATION_FAILED` for an unknown or inactive label.
   */
  attachTag(
    customerId: string,
    input: AttachCustomerTagInput,
    options?: RequestOptions,
  ): Promise<CustomerTag>;

  /**
   * `DELETE /api/admin/customers/:id/tags/:tagId` — detaches the label from **this**
   * customer. The catalogue row survives, so other customers keep their label.
   *
   * @param customerId - the customer's uuid.
   * @param tagId - the label's uuid.
   * @param options - optional abort signal / extra headers.
   * @throws {import('../api-error.js').ApiError} `404 NOT_FOUND` when the link
   *   does not exist (including a repeat detach).
   */
  detachTag(
    customerId: string,
    tagId: string,
    options?: RequestOptions,
  ): Promise<null>;

  /**
   * `POST /api/admin/customers/:id/customer-users` — invites a login user.
   *
   * The created row starts in the `invited` state; `invitedByOperatorId` is `null`
   * until the admin authentication lands, and no e-mail is sent by this API.
   *
   * @param customerId - the customer's uuid.
   * @param input - name, e-mail and (optionally) role.
   * @param options - optional abort signal / extra headers.
   * @throws {import('../api-error.js').ApiError} `404`, `409
   *   CUSTOMER_USER_EMAIL_CONFLICT` (the address is taken **globally**).
   */
  inviteCustomerUser(
    customerId: string,
    input: InviteCustomerUserInput,
    options?: RequestOptions,
  ): Promise<CustomerUser>;

  /**
   * `PATCH /api/admin/customers/:id/customer-users/:customerUserId` — name, role
   * and status of one login user.
   *
   * `status` accepts `active` / `inactive` only: `invited` is a server-written
   * state. `updatedAt` is required and never written.
   *
   * @param customerId - the customer's uuid.
   * @param customerUserId - the login user's uuid.
   * @param input - the changed fields plus the required `updatedAt` token.
   * @param options - optional abort signal / extra headers.
   * @throws {import('../api-error.js').ApiError} `404`, `409 STALE_WRITE`, `409
   *   CUSTOMER_OWNER_CONFLICT` when a second active owner would be created.
   */
  updateCustomerUser(
    customerId: string,
    customerUserId: string,
    input: UpdateCustomerUserInput,
    options?: RequestOptions,
  ): Promise<CustomerUser>;

  /**
   * `DELETE /api/admin/customers/:id/customer-users/:customerUserId` — revokes a
   * **pending invitation**.
   *
   * Anything that has ever been activated cannot be deleted; deactivating it is
   * `updateCustomerUser` with `status: 'inactive'`.
   *
   * @param customerId - the customer's uuid.
   * @param customerUserId - the login user's uuid.
   * @param options - optional abort signal / extra headers.
   * @throws {import('../api-error.js').ApiError} `404`, `422
   *   SEMANTIC_VALIDATION_FAILED` when the user is not `invited`, `409
   *   CUSTOMER_USER_IN_USE_CONFLICT` when a contact or an activity references it.
   */
  removeCustomerUser(
    customerId: string,
    customerUserId: string,
    options?: RequestOptions,
  ): Promise<null>;
}
