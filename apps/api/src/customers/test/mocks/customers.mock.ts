import { jest } from '@jest/globals';
import type {
  CreateCustomerInput,
  Customer,
  CustomerListQuery,
  UpdateCustomerInput,
  UpdateCustomerStatusInput,
} from '@callback/shared';
import type { DatabaseTransaction } from '../../../audit/audit-transaction.interface.js';
import type {
  AuditRequestFacts,
  AuditWriteInput,
} from '../../../audit/audit.interface.js';
import type { AuditWriter } from '../../../audit/audit-writer.interface.js';
import type {
  ContactRow,
  CustomerRow,
  CustomerUserRow,
  TagRow,
} from '../../../db/schema.js';
import type {
  ContactRoleJoinRow,
  CustomerDetailRows,
  CustomerListRow,
  CustomerPatch,
  CustomerStatusPatch,
} from '../../customers.interface.js';
import type {
  CustomerPage,
  CustomersRepository,
} from '../../customers.repository.interface.js';

/**
 * Fixtures for the `customers` specs (AIS-178).
 *
 * Centralised here (coding standard: no fixtures inline in test files) so the
 * row shape stays in sync with `schema.ts` — if a column is added, only this file
 * needs updating and every spec keeps compiling with a meaningful default.
 *
 * The payload types come from `@callback/shared` (`Customer`, the input types),
 * not from a local interface: a fixture is a value of the **contract** type, so a
 * schema change breaks this file first instead of silently diverging.
 */

/** Fixed customer uuid, so assertions need no regex noise. */
export const CUSTOMER_ROW_ID = '0d9f3a2e-6b41-4c8a-9f2d-7c5e1a3b4d60';

/** Fixed customer number of the default row. */
export const CUSTOMER_NUMBER = 'AIS-202611-001';

/** Fixed creation timestamp (the mapper must emit exactly this as ISO). */
export const CUSTOMER_CREATED_AT = new Date('2026-11-01T08:00:00.000Z');

/** Fixed update timestamp — also the optimistic-concurrency token. */
export const CUSTOMER_UPDATED_AT = new Date('2026-11-15T09:00:00.000Z');

/** Fixed status-change timestamp. */
export const CUSTOMER_STATUS_CHANGED_AT = new Date('2026-11-15T09:00:00.000Z');

/** Fixed last-activity timestamp (the projection of the default row). */
export const CUSTOMER_LAST_ACTIVITY_AT = new Date('2026-11-17T14:30:00.000Z');

/** Fixed deletion timestamp, for the archived branches. */
export const CUSTOMER_DELETED_AT = new Date('2026-11-20T12:00:00.000Z');

/** Fixed uuid of the default contact. */
export const CONTACT_ROW_ID = 'c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f';

/** Fixed uuid of the default login user. */
export const CUSTOMER_USER_ROW_ID = 'e3f4a5b6-c7d8-4e9f-8a0b-1c2d3e4f5a60';

/** Fixed uuid of the default tag. */
export const TAG_ROW_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

/**
 * @param overrides - fields to replace on the default row.
 * @returns a complete `customer.customers` row **with** both projections.
 */
export function buildCustomerRow(
  overrides: Partial<CustomerListRow> = {},
): CustomerListRow {
  return {
    id: CUSTOMER_ROW_ID,
    customerNumber: CUSTOMER_NUMBER,
    type: 'company',
    legalName: 'Példa Szolgáltató Kft.',
    shortName: 'Példa Kft.',
    taxNumber: '10773381-2-44',
    euVatNumber: 'HU10773381',
    companyRegistrationNumber: '01-09-123456',
    legalForm: 'Kft.',
    registeredAddressZip: '1051',
    registeredAddressCity: 'Budapest',
    registeredAddressLine: 'Széchenyi István tér 1.',
    registeredAddressCountry: 'HU',
    industry: 'Szoftverfejlesztés',
    headcountRange: '2_5',
    source: 'website',
    responsibleOperatorId: 'b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e',
    status: 'active',
    statusChangedAt: CUSTOMER_STATUS_CHANGED_AT,
    createdAt: CUSTOMER_CREATED_AT,
    updatedAt: CUSTOMER_UPDATED_AT,
    deletedAt: null,
    lastActivityAt: CUSTOMER_LAST_ACTIVITY_AT,
    primaryContactName: 'Nagy Anna',
    ...overrides,
  };
}

/**
 * @param overrides - fields to replace on the default row.
 * @returns the same row **without** the derived projections, as a write returns
 *   it (`INSERT`/`UPDATE … RETURNING` cannot compute them).
 */
export function buildRawCustomerRow(
  overrides: Partial<CustomerRow> = {},
): CustomerRow {
  const { lastActivityAt, primaryContactName, ...row } = buildCustomerRow();

  void lastActivityAt;
  void primaryContactName;

  return { ...row, ...overrides };
}

/**
 * @param overrides - fields to replace on the default payload.
 * @returns the payload `toCustomer(buildCustomerRow())` produces.
 */
export function buildCustomerResponse(
  overrides: Partial<Customer> = {},
): Customer {
  return {
    id: CUSTOMER_ROW_ID,
    customerNumber: CUSTOMER_NUMBER,
    type: 'company',
    legalName: 'Példa Szolgáltató Kft.',
    shortName: 'Példa Kft.',
    taxNumber: '10773381-2-44',
    euVatNumber: 'HU10773381',
    companyRegistrationNumber: '01-09-123456',
    legalForm: 'Kft.',
    registeredAddressZip: '1051',
    registeredAddressCity: 'Budapest',
    registeredAddressLine: 'Széchenyi István tér 1.',
    registeredAddressCountry: 'HU',
    industry: 'Szoftverfejlesztés',
    headcountRange: '2_5',
    source: 'website',
    responsibleOperatorId: 'b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e',
    status: 'active',
    statusChangedAt: CUSTOMER_STATUS_CHANGED_AT.toISOString(),
    createdAt: CUSTOMER_CREATED_AT.toISOString(),
    updatedAt: CUSTOMER_UPDATED_AT.toISOString(),
    lastActivityAt: CUSTOMER_LAST_ACTIVITY_AT.toISOString(),
    hasMissingData: false,
    primaryContactName: 'Nagy Anna',
    ...overrides,
  };
}

/**
 * @param overrides - fields to replace on the default contact row.
 * @returns a complete `customer.contacts` row.
 */
export function buildContactRow(
  overrides: Partial<ContactRow> = {},
): ContactRow {
  return {
    id: CONTACT_ROW_ID,
    customerId: CUSTOMER_ROW_ID,
    name: 'Nagy Anna',
    position: 'Ügyvezető',
    email: 'anna.nagy@pelda.hu',
    phone: '+36301234567',
    customerUserId: null,
    isActive: true,
    createdAt: CUSTOMER_CREATED_AT,
    updatedAt: CUSTOMER_CREATED_AT,
    deletedAt: null,
    ...overrides,
  };
}

/**
 * @param overrides - fields to replace on the default tag row.
 * @returns a complete `customer.tags` row.
 */
export function buildTagRow(overrides: Partial<TagRow> = {}): TagRow {
  return {
    id: TAG_ROW_ID,
    name: 'premium',
    isActive: true,
    ...overrides,
  };
}

/**
 * @param overrides - fields to replace on the default login user row.
 * @returns a complete `iam.customer_users` row.
 */
export function buildCustomerUserRow(
  overrides: Partial<CustomerUserRow> = {},
): CustomerUserRow {
  return {
    id: CUSTOMER_USER_ROW_ID,
    customerId: CUSTOMER_ROW_ID,
    name: 'Nagy Anna',
    email: 'anna.nagy@pelda.hu',
    passwordHash: null,
    role: 'owner',
    status: 'active',
    invitedByOperatorId: null,
    invitedAt: CUSTOMER_CREATED_AT,
    acceptedAt: CUSTOMER_CREATED_AT,
    lastLoginAt: null,
    createdAt: CUSTOMER_CREATED_AT,
    updatedAt: CUSTOMER_CREATED_AT,
    ...overrides,
  };
}

/**
 * @param overrides - fields to replace on the default join row.
 * @returns one `contacts ⋈ contact_roles` row.
 */
export function buildContactJoinRow(
  overrides: Partial<ContactRoleJoinRow> = {},
): ContactRoleJoinRow {
  return { contact: buildContactRow(), role: 'primary', ...overrides };
}

/**
 * @param overrides - fields to replace on the default detail read.
 * @returns the four reads of `findById`, in the shape the service receives.
 */
export function buildCustomerDetailRows(
  overrides: Partial<CustomerDetailRows> = {},
): CustomerDetailRows {
  return {
    customer: buildCustomerRow(),
    tags: [buildTagRow()],
    contacts: [{ contact: buildContactRow(), roles: ['primary'] }],
    customerUsers: [buildCustomerUserRow()],
    ...overrides,
  };
}

/**
 * @param overrides - fields to replace on the default create body.
 * @returns a valid `POST /api/admin/customers` body.
 */
export function buildCreateCustomerInput(
  overrides: Partial<CreateCustomerInput> = {},
): CreateCustomerInput {
  return {
    type: 'company',
    legalName: 'Új Ügyfél Kft.',
    shortName: 'Új Ügyfél',
    taxNumber: '10537914-4-44',
    registeredAddressZip: '4024',
    registeredAddressCity: 'Debrecen',
    registeredAddressLine: 'Piac utca 20.',
    headcountRange: '6_20',
    source: 'manual',
    ...overrides,
  };
}

/**
 * @param overrides - fields to replace on the default `PATCH` body.
 * @returns a valid `PATCH /api/admin/customers/:id` body whose `updatedAt`
 *   matches {@link buildCustomerRow} by default.
 */
export function buildUpdateCustomerInput(
  overrides: Partial<UpdateCustomerInput> = {},
): UpdateCustomerInput {
  return {
    legalName: 'Példa Szolgáltató Zrt.',
    updatedAt: CUSTOMER_UPDATED_AT.toISOString(),
    ...overrides,
  };
}

/**
 * @param overrides - fields to replace on the default status body.
 * @returns a valid `PATCH /api/admin/customers/:id/status` body.
 */
export function buildUpdateStatusInput(
  overrides: Partial<UpdateCustomerStatusInput> = {},
): UpdateCustomerStatusInput {
  return {
    status: 'suspended',
    updatedAt: CUSTOMER_UPDATED_AT.toISOString(),
    ...overrides,
  };
}

/**
 * @param overrides - fields to replace on the default list query.
 * @returns the query a request without parameters produces.
 */
export function buildCustomerListQuery(
  overrides: Partial<CustomerListQuery> = {},
): CustomerListQuery {
  return {
    page: 1,
    limit: 20,
    order: 'desc',
    sort: 'createdAt',
    q: undefined,
    ...overrides,
  };
}

/**
 * @param overrides - fields to replace on the default audit facts.
 * @returns the facts the controller builds from a request.
 */
export function buildAuditFacts(
  overrides: Partial<AuditRequestFacts> = {},
): AuditRequestFacts {
  return {
    ipAddress: '10.1.2.3',
    userAgent: 'Mozilla/5.0 (test)',
    requestId: 'req-customers-1',
    source: 'admin_api',
    ...overrides,
  };
}

/** The repository double: one `jest.fn()` per interface method. */
export interface CustomersRepositoryMock {
  /** The interface the service depends on. */
  readonly repository: CustomersRepository;

  readonly findPage: jest.Mock<
    (query: CustomerListQuery) => Promise<CustomerPage>
  >;
  readonly findById: jest.Mock<
    (id: string) => Promise<CustomerDetailRows | null>
  >;
  readonly findAnyById: jest.Mock<(id: string) => Promise<CustomerRow | null>>;
  readonly create: jest.Mock<
    (tx: DatabaseTransaction, input: unknown) => Promise<CustomerRow>
  >;
  readonly updateById: jest.Mock<
    (
      tx: DatabaseTransaction,
      id: string,
      patch: CustomerPatch,
      expectedUpdatedAt: Date,
    ) => Promise<CustomerRow | null>
  >;
  readonly updateStatusById: jest.Mock<
    (
      tx: DatabaseTransaction,
      id: string,
      patch: CustomerStatusPatch,
      expectedUpdatedAt: Date,
    ) => Promise<CustomerRow | null>
  >;
  readonly softDeleteById: jest.Mock<
    (
      tx: DatabaseTransaction,
      id: string,
      deletedAt: Date,
    ) => Promise<CustomerRow | null>
  >;
  readonly nextCustomerNumber: jest.Mock<
    (tx: DatabaseTransaction, prefix: string) => Promise<string | null>
  >;
  readonly runInTransaction: jest.Mock;
}

/**
 * @returns a repository double whose `runInTransaction` runs the callback with
 *   the mock transaction handle, so the service's composition is observable.
 */
export function createCustomersRepositoryMock(): CustomersRepositoryMock {
  const findPage =
    jest.fn<(query: CustomerListQuery) => Promise<CustomerPage>>();
  const findById =
    jest.fn<(id: string) => Promise<CustomerDetailRows | null>>();
  const findAnyById = jest.fn<(id: string) => Promise<CustomerRow | null>>();
  const create =
    jest.fn<
      (tx: DatabaseTransaction, input: unknown) => Promise<CustomerRow>
    >();
  const updateById =
    jest.fn<
      (
        tx: DatabaseTransaction,
        id: string,
        patch: CustomerPatch,
        expectedUpdatedAt: Date,
      ) => Promise<CustomerRow | null>
    >();
  const updateStatusById =
    jest.fn<
      (
        tx: DatabaseTransaction,
        id: string,
        patch: CustomerStatusPatch,
        expectedUpdatedAt: Date,
      ) => Promise<CustomerRow | null>
    >();
  const softDeleteById =
    jest.fn<
      (
        tx: DatabaseTransaction,
        id: string,
        deletedAt: Date,
      ) => Promise<CustomerRow | null>
    >();
  const nextCustomerNumber =
    jest.fn<
      (tx: DatabaseTransaction, prefix: string) => Promise<string | null>
    >();

  const transactionHandle = {} as DatabaseTransaction;
  const runInTransaction = jest.fn(
    async <T>(work: (tx: DatabaseTransaction) => Promise<T>): Promise<T> =>
      work(transactionHandle),
  );

  return {
    repository: {
      findPage,
      findById,
      findAnyById,
      create,
      updateById,
      updateStatusById,
      softDeleteById,
      nextCustomerNumber,
      runInTransaction,
    },
    findPage,
    findById,
    findAnyById,
    create,
    updateById,
    updateStatusById,
    softDeleteById,
    nextCustomerNumber,
    runInTransaction,
  };
}

/** The audit-writer double: records every payload and transaction handle. */
export interface AuditWriterMock {
  /** The interface the service depends on. */
  readonly writer: AuditWriter;

  /** Payloads passed to `write()`, in call order. */
  readonly calls: readonly AuditWriteInput[];

  /** Transaction handles passed to `write()`, in call order. */
  readonly transactions: readonly DatabaseTransaction[];

  /** Makes the next `write()` reject, to prove nothing is swallowed. */
  failNextWith(error: Error): void;
}

/**
 * @returns an audit-writer double that records its calls (and can fail once).
 */
export function createAuditWriterMock(): AuditWriterMock {
  const calls: AuditWriteInput[] = [];
  const transactions: DatabaseTransaction[] = [];
  let pendingFailure: Error | null = null;

  return {
    calls,
    transactions,
    failNextWith(error: Error): void {
      pendingFailure = error;
    },
    writer: {
      write: (
        input: AuditWriteInput,
        tx: DatabaseTransaction,
      ): Promise<void> => {
        calls.push(input);
        transactions.push(tx);

        if (pendingFailure !== null) {
          const failure = pendingFailure;
          pendingFailure = null;

          return Promise.reject(failure);
        }

        return Promise.resolve();
      },
    },
  };
}
