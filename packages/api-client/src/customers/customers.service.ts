/**
 * Implementation of {@link CustomersService} (AIS-178/c).
 *
 * The service contains no logic of its own: it names the endpoints, binds them to
 * the shared zod schemas and passes the caller's options through. Validating a
 * request payload is the backend's job (and the form's, for UX); parsing of the
 * *response* is this layer's, so a contract drift surfaces here — as an
 * `ApiError` — instead of inside a component as `undefined`.
 *
 * `list` goes through `getList` and not `get`: the pager block
 * (`meta.pagination`) only exists on the list response, and dropping it here
 * would make it unobservable for every consumer above. The resource filters
 * (`type`, `status`, `source`, `responsibleOperatorId`) travel because
 * `toListQueryParams` appends them (AIS-178/c `D3`) — before that they were
 * silently dropped, which is the one defect this slice had to fix outside the
 * package.
 *
 * `update` and `remove` address the **same** detail route as `findById`, so they
 * reuse `toCustomerDetailPath` instead of declaring a second path constant: one
 * route, one place that knows how `:id` looks.
 */

import {
  LIST_QUERY_DEFAULTS,
  contactListSchema,
  contactSchema,
  createContactSchema,
  customerDetailSchema,
  customerListSchema,
  customerSchema,
  customerTagSchema,
  customerUserSchema,
  noPayloadSchema,
  updateContactSchema,
  type ApiResult,
  type AttachCustomerTagInput,
  type Contact,
  type CreateContactInput,
  type CreateCustomerInput,
  type CreateCustomerTagInput,
  type Customer,
  type CustomerDetail,
  type CustomerListQuery,
  type CustomerTag,
  type CustomerUser,
  type InviteCustomerUserInput,
  type ListQuery,
  type UpdateContactInput,
  type UpdateCustomerInput,
  type UpdateCustomerUserInput,
  type UpdateCustomerStatusInput,
} from '@callback/shared';
import {
  CUSTOMERS_PATH,
  CUSTOMER_LIST_QUERY_DEFAULTS,
} from './customers.const.js';
import type { CustomersService } from './customers.interface.js';
import {
  toCustomerContactPath,
  toCustomerContactsPath,
  toCustomerDetailPath,
  toCustomerStatusPath,
  toCustomerTagPath,
  toCustomerTagsPath,
  toCustomerUserPath,
  toCustomerUsersPath,
} from './customers.path.js';
import type { HttpClient, RequestOptions } from '../http-client.interface.js';

/**
 * Creates the service on top of an injected transport.
 *
 * @param client - HTTP transport (base URL and token supplier already bound).
 * @returns the service consumed by the query hooks.
 *
 * @example
 * ```ts
 * const customers = createCustomersService(httpClient);
 * const page = await customers.list({ page: 1, limit: 20, sort: 'createdAt', order: 'desc' });
 * ```
 */
export function createCustomersService(client: HttpClient): CustomersService {
  return {
    list: async (
      query: CustomerListQuery,
      options?: RequestOptions,
    ): Promise<ApiResult<readonly Customer[]>> =>
      client.getList(
        CUSTOMERS_PATH,
        customerListSchema,
        { query, defaults: CUSTOMER_LIST_QUERY_DEFAULTS },
        options,
      ),

    findById: async (
      id: string,
      options?: RequestOptions,
    ): Promise<CustomerDetail> =>
      client.get(toCustomerDetailPath(id), customerDetailSchema, options),

    create: async (
      input: CreateCustomerInput,
      options?: RequestOptions,
    ): Promise<Customer> =>
      client.post(CUSTOMERS_PATH, input, customerSchema, options),

    // `PATCH`, not `PUT`: the convention is a partial update guarded by
    // `updatedAt`, and the transport validates the response with the same schema
    // as the reads, so a drift in the updated row surfaces here.
    update: async (
      id: string,
      input: UpdateCustomerInput,
      options?: RequestOptions,
    ): Promise<Customer> =>
      client.patch(toCustomerDetailPath(id), input, customerSchema, options),

    // The status route is separate from the detail route: the server writes
    // `statusChangedAt` and audits the change on its own.
    updateStatus: async (
      id: string,
      input: UpdateCustomerStatusInput,
      options?: RequestOptions,
    ): Promise<Customer> =>
      client.patch(toCustomerStatusPath(id), input, customerSchema, options),

    // `noPayloadSchema` is `z.null()`: the transport re-validates `data` with the
    // bare schema, so a `204`, a missing `data` key or an object payload is a
    // contract violation instead of a silent success.
    remove: async (id: string, options?: RequestOptions): Promise<null> =>
      client.delete(toCustomerDetailPath(id), noPayloadSchema, options),

    // ---- contacts (AIS-178, slice d) -------------------------------------
    // The contact list paginates like every other collection, so it goes
    // through `getList`: `meta.pagination` is what the tab's pager reads.
    listContacts: async (
      customerId: string,
      query: ListQuery,
      options?: RequestOptions,
    ): Promise<ApiResult<readonly Contact[]>> =>
      client.getList(
        toCustomerContactsPath(customerId),
        contactListSchema,
        { query, defaults: LIST_QUERY_DEFAULTS },
        options,
      ),

    createContact: async (
      customerId: string,
      input: CreateContactInput,
      options?: RequestOptions,
    ): Promise<Contact> =>
      client.post(
        toCustomerContactsPath(customerId),
        input,
        contactSchema,
        options,
      ),

    // One request replaces the role set; a second `primary` is refused by the
    // server with `409 CUSTOMER_PRIMARY_CONTACT_CONFLICT`, not by the client.
    updateContact: async (
      customerId: string,
      contactId: string,
      input: UpdateContactInput,
      options?: RequestOptions,
    ): Promise<Contact> =>
      client.patch(
        toCustomerContactPath(customerId, contactId),
        input,
        contactSchema,
        options,
      ),

    removeContact: async (
      customerId: string,
      contactId: string,
      options?: RequestOptions,
    ): Promise<null> =>
      client.delete(
        toCustomerContactPath(customerId, contactId),
        noPayloadSchema,
        options,
      ),

    // ---- tags (AIS-178, slice e) ------------------------------------------
    // `POST` is create-or-attach: the server reuses an existing label of the same
    // name, so a retry cannot turn into a `409`.
    createTag: async (
      customerId: string,
      input: CreateCustomerTagInput,
      options?: RequestOptions,
    ): Promise<CustomerTag> =>
      client.post(
        toCustomerTagsPath(customerId),
        input,
        customerTagSchema,
        options,
      ),

    attachTag: async (
      customerId: string,
      input: AttachCustomerTagInput,
      options?: RequestOptions,
    ): Promise<CustomerTag> =>
      client.patch(
        toCustomerTagsPath(customerId),
        input,
        customerTagSchema,
        options,
      ),

    // The tag id is a **path** parameter here (and a body field above): the two
    // routes address different resources — one link, versus the customer's tag
    // collection.
    detachTag: async (
      customerId: string,
      tagId: string,
      options?: RequestOptions,
    ): Promise<null> =>
      client.delete(
        toCustomerTagPath(customerId, tagId),
        noPayloadSchema,
        options,
      ),

    // ---- customer users (AIS-178, slice e) --------------------------------
    inviteCustomerUser: async (
      customerId: string,
      input: InviteCustomerUserInput,
      options?: RequestOptions,
    ): Promise<CustomerUser> =>
      client.post(
        toCustomerUsersPath(customerId),
        input,
        customerUserSchema,
        options,
      ),

    // `PATCH` accepts `active` / `inactive` only; a second active owner is refused
    // by the server with `409 CUSTOMER_OWNER_CONFLICT`, not by the client.
    updateCustomerUser: async (
      customerId: string,
      customerUserId: string,
      input: UpdateCustomerUserInput,
      options?: RequestOptions,
    ): Promise<CustomerUser> =>
      client.patch(
        toCustomerUserPath(customerId, customerUserId),
        input,
        customerUserSchema,
        options,
      ),

    removeCustomerUser: async (
      customerId: string,
      customerUserId: string,
      options?: RequestOptions,
    ): Promise<null> =>
      client.delete(
        toCustomerUserPath(customerId, customerUserId),
        noPayloadSchema,
        options,
      ),
  };
}
