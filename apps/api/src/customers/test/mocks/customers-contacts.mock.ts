import { jest } from '@jest/globals';
import type {
  ContactRole,
  CreateContactInput,
  UpdateContactInput,
} from '@callback/shared';
import type { DatabaseTransaction } from '../../../audit/audit-transaction.interface.js';
import type { ContactRoleRow, ContactRow } from '../../../db/schema.js';
import type { ContactWithRoles } from '../../customers.interface.js';
import type { ContactPatch } from '../../customers-contacts.interface.js';
import type { CustomerContactsRepository } from '../../customers-contacts.repository.interface.js';

/**
 * Fixtures and doubles for the customer-contacts specs (AIS-178, slice d).
 *
 * Centralised here (coding standard: no fixtures inline in spec files) so the row
 * shape stays in sync with `schema.ts`: a column added there breaks this file
 * first, not every assertion.
 *
 * Every timestamp is a fixed `Date`, so the mapper assertions can compare against
 * the exact ISO string instead of a regex.
 */

/** Fixed customer uuid the contacts belong to. */
export const CONTACT_CUSTOMER_ID = '0d9f3a2e-6b41-4c8a-9f2d-7c5e1a3b4d60';

/** Fixed uuid of the default contact. */
export const CONTACT_ID = 'c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f';

/** Fixed uuid of the second contact (the "another primary" case). */
export const SECOND_CONTACT_ID = 'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f60';

/** Fixed creation timestamp (the mapper must emit exactly this as ISO). */
export const CONTACT_CREATED_AT = new Date('2026-11-01T08:30:00.000Z');

/** Fixed update timestamp — also the optimistic-concurrency token. */
export const CONTACT_UPDATED_AT = new Date('2026-11-01T08:30:00.000Z');

/** Fixed deletion timestamp, for the archived branches. */
export const CONTACT_DELETED_AT = new Date('2026-11-20T12:00:00.000Z');

/** A stand-in transaction handle (the service only passes it around). */
export const TRANSACTION = {} as DatabaseTransaction;

/**
 * @param overrides - fields to replace on the default row.
 * @returns a complete `customer.contacts` row.
 */
export function buildContactRow(
  overrides: Partial<ContactRow> = {},
): ContactRow {
  return {
    id: CONTACT_ID,
    customerId: CONTACT_CUSTOMER_ID,
    name: 'Nagy Anna',
    position: 'Ügyvezető',
    email: 'anna.nagy@pelda.hu',
    phone: '+36301234567',
    customerUserId: null,
    isActive: true,
    createdAt: CONTACT_CREATED_AT,
    updatedAt: CONTACT_UPDATED_AT,
    deletedAt: null,
    ...overrides,
  };
}

/**
 * @param roles - the role set of the fixture.
 * @param overrides - fields to replace on the contact row.
 * @returns a contact row with its roles.
 */
export function buildContactWithRoles(
  roles: readonly ContactRole[] = ['primary'],
  overrides: Partial<ContactRow> = {},
): ContactWithRoles {
  return { contact: buildContactRow(overrides), roles: [...roles] };
}

/**
 * @param roles - the roles the fixture rows describe.
 * @returns the `contact_roles` rows of the default contact.
 */
export function buildRoleRows(
  roles: readonly ContactRole[] = ['primary'],
): readonly ContactRoleRow[] {
  return roles.map((role) => ({
    contactId: CONTACT_ID,
    customerId: CONTACT_CUSTOMER_ID,
    role,
  }));
}

/**
 * @param overrides - fields to replace on the default patch.
 * @returns a column subset a `PATCH` may write.
 */
export function buildContactPatch(
  overrides: Partial<ContactPatch> = {},
): ContactPatch {
  return { position: 'Ügyvezető helyettes', ...overrides };
}

/**
 * @param overrides - fields to replace on the default body.
 * @returns a valid `POST …/contacts` body.
 */
export function buildCreateContactInput(
  overrides: Partial<CreateContactInput> = {},
): CreateContactInput {
  return { name: 'Szabó Judit', roles: ['technical'], ...overrides };
}

/**
 * @param overrides - fields to replace on the default body.
 * @returns a valid `PATCH …/contacts/:contactId` body.
 */
export function buildUpdateContactInput(
  overrides: Partial<UpdateContactInput> = {},
): UpdateContactInput {
  return {
    position: 'Ügyvezető helyettes',
    updatedAt: CONTACT_UPDATED_AT.toISOString(),
    ...overrides,
  };
}

/** The jest doubles of one {@link CustomerContactsRepository}. */
export interface CustomerContactsRepositoryMock {
  readonly repository: CustomerContactsRepository;
  readonly customerExists: jest.Mock<(customerId: string) => Promise<boolean>>;
  readonly findPage: jest.Mock<
    (
      customerId: string,
      query: unknown,
    ) => Promise<{ rows: readonly ContactWithRoles[]; total: number }>
  >;
  readonly findById: jest.Mock<
    (customerId: string, contactId: string) => Promise<ContactWithRoles | null>
  >;
  readonly findAnyById: jest.Mock<
    (customerId: string, contactId: string) => Promise<ContactRow | null>
  >;
  readonly findRoles: jest.Mock<
    (contactId: string) => Promise<readonly ContactRoleRow[]>
  >;
  readonly create: jest.Mock<
    (tx: DatabaseTransaction, input: unknown) => Promise<ContactRow>
  >;
  readonly updateById: jest.Mock<
    (
      tx: DatabaseTransaction,
      customerId: string,
      contactId: string,
      patch: ContactPatch,
      expectedUpdatedAt: Date,
    ) => Promise<ContactRow | null>
  >;
  readonly softDeleteById: jest.Mock<
    (
      tx: DatabaseTransaction,
      customerId: string,
      contactId: string,
      deletedAt: Date,
    ) => Promise<ContactRow | null>
  >;
  readonly replaceRoles: jest.Mock<
    (
      tx: DatabaseTransaction,
      contactId: string,
      customerId: string,
      roles: readonly ContactRole[],
    ) => Promise<void>
  >;
  readonly deleteRoles: jest.Mock<
    (tx: DatabaseTransaction, contactId: string) => Promise<void>
  >;
}

/**
 * Builds a repository double whose defaults describe a working happy path:
 * the parent exists, the contact has the `primary` role, and every write returns
 * the fixture row.
 *
 * @returns the doubles plus the `CustomerContactsRepository` they implement.
 */
export function createCustomerContactsRepositoryMock(): CustomerContactsRepositoryMock {
  // `Promise.resolve` instead of an `async` arrow: nothing here awaits, and the
  // `require-await` rule treats a needless `async` as a smell.
  const customerExists = jest.fn(() => Promise.resolve(true));
  const findPage = jest.fn(() =>
    Promise.resolve({ rows: [buildContactWithRoles()], total: 1 }),
  );
  const findById = jest.fn(() => Promise.resolve(buildContactWithRoles()));
  const findAnyById = jest.fn(() => Promise.resolve(buildContactRow()));
  const findRoles = jest.fn(() => Promise.resolve(buildRoleRows()));
  const create = jest.fn(() => Promise.resolve(buildContactRow()));
  const updateById = jest.fn(() => Promise.resolve(buildContactRow()));
  const softDeleteById = jest.fn(() =>
    Promise.resolve(buildContactRow({ deletedAt: CONTACT_DELETED_AT })),
  );
  const replaceRoles = jest.fn(() => Promise.resolve());
  const deleteRoles = jest.fn(() => Promise.resolve());

  const repository: CustomerContactsRepository = {
    customerExists,
    findPage,
    findById,
    findAnyById,
    findRoles,
    create,
    updateById,
    softDeleteById,
    replaceRoles,
    deleteRoles,
    runInTransaction: async (work) => work(TRANSACTION),
  };

  return {
    repository,
    customerExists,
    findPage,
    findById,
    findAnyById,
    findRoles,
    create,
    updateById,
    softDeleteById,
    replaceRoles,
    deleteRoles,
  };
}
