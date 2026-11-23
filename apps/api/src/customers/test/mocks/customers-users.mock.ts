import { jest } from '@jest/globals';
import type {
  InviteCustomerUserInput,
  UpdateCustomerUserInput,
} from '@callback/shared';
import type { DatabaseTransaction } from '../../../audit/audit-transaction.interface.js';
import type { Database } from '../../../db/database.interface.js';
import { customerUsers, customers } from '../../../db/schema.js';
import type {
  CustomerUserRow,
  NewCustomerUserRow,
} from '../../../db/schema.js';
import type { CustomerUserPatch } from '../../customers-users.interface.js';
import type { CustomerUsersRepository } from '../../customers-users.repository.interface.js';

/**
 * Fixtures and doubles for the customer-user specs (AIS-178, slice e).
 *
 * Centralised here (coding standard: no fixtures inline in spec files) so the row
 * shape stays in sync with `schema.ts`, and so the service, controller and
 * repository specs share one description of "an invited login user".
 */

/** Fixed customer uuid the users belong to. */
export const USERS_CUSTOMER_ID = '0d9f3a2e-6b41-4c8a-9f2d-7c5e1a3b4d60';

/** Fixed uuid of the invited user fixture. */
export const CUSTOMER_USER_ID = 'f4a5b6c7-d8e9-4f0a-8b1c-2d3e4f5a6b70';

/** Fixed invitation instant (the mapper must emit exactly this as ISO). */
export const USER_INVITED_AT = new Date('2026-11-18T10:20:00.000Z');

/** Fixed creation/update timestamp — also the concurrency token. */
export const USER_UPDATED_AT = new Date('2026-11-18T10:20:00.000Z');

/** A stand-in transaction handle (the service only passes it around). */
export const TRANSACTION = {} as DatabaseTransaction;

/**
 * @param overrides - fields to replace on the default row.
 * @returns a complete `iam.customer_users` row in the `invited` state.
 */
export function buildCustomerUserRowFixture(
  overrides: Partial<CustomerUserRow> = {},
): CustomerUserRow {
  return {
    id: CUSTOMER_USER_ID,
    customerId: USERS_CUSTOMER_ID,
    name: 'Kiss Péter',
    email: 'peter.kiss@pelda.hu',
    passwordHash: null,
    role: 'owner',
    status: 'invited',
    invitedByOperatorId: null,
    invitedAt: USER_INVITED_AT,
    acceptedAt: null,
    lastLoginAt: null,
    createdAt: USER_INVITED_AT,
    updatedAt: USER_UPDATED_AT,
    ...overrides,
  };
}

/**
 * @param overrides - fields to replace on the default body.
 * @returns a valid `POST …/customer-users` body.
 */
export function buildInviteInput(
  overrides: Partial<InviteCustomerUserInput> = {},
): InviteCustomerUserInput {
  return {
    name: 'Kiss Péter',
    email: 'peter.kiss@pelda.hu',
    role: 'member',
    ...overrides,
  };
}

/**
 * @param overrides - fields to replace on the default body.
 * @returns a valid `PATCH …/customer-users/:customerUserId` body.
 */
export function buildUpdateCustomerUserInput(
  overrides: Partial<UpdateCustomerUserInput> = {},
): UpdateCustomerUserInput {
  return {
    status: 'active',
    updatedAt: USER_UPDATED_AT.toISOString(),
    ...overrides,
  };
}

/** The jest doubles of one {@link CustomerUsersRepository}. */
export interface CustomerUsersRepositoryMock {
  readonly repository: CustomerUsersRepository;
  readonly customerExists: jest.Mock<(customerId: string) => Promise<boolean>>;
  readonly findById: jest.Mock<
    (
      customerId: string,
      customerUserId: string,
    ) => Promise<CustomerUserRow | null>
  >;
  readonly insert: jest.Mock<
    (
      tx: DatabaseTransaction,
      input: NewCustomerUserRow,
    ) => Promise<CustomerUserRow>
  >;
  readonly updateById: jest.Mock<
    (
      tx: DatabaseTransaction,
      customerId: string,
      customerUserId: string,
      patch: CustomerUserPatch,
      expectedUpdatedAt: Date,
    ) => Promise<CustomerUserRow | null>
  >;
  readonly deleteById: jest.Mock<
    (
      tx: DatabaseTransaction,
      customerId: string,
      customerUserId: string,
    ) => Promise<CustomerUserRow | null>
  >;
}

/**
 * Builds a repository double whose defaults describe a working happy path: the
 * parent exists, the user is `invited`, and every write returns the fixture row.
 *
 * @returns the doubles plus the `CustomerUsersRepository` they implement.
 */
export function createCustomerUsersRepositoryMock(): CustomerUsersRepositoryMock {
  const customerExists = jest.fn(() => Promise.resolve(true));
  const findById = jest.fn(() =>
    Promise.resolve<CustomerUserRow | null>(buildCustomerUserRowFixture()),
  );
  const insert = jest.fn(() => Promise.resolve(buildCustomerUserRowFixture()));
  const updateById = jest.fn(() =>
    Promise.resolve<CustomerUserRow | null>(
      buildCustomerUserRowFixture({ status: 'active' }),
    ),
  );
  const deleteById = jest.fn(() =>
    Promise.resolve<CustomerUserRow | null>(buildCustomerUserRowFixture()),
  );

  const repository: CustomerUsersRepository = {
    customerExists,
    findById,
    insert,
    updateById,
    deleteById,
    runInTransaction: async (work) => work(TRANSACTION),
  };

  return {
    repository,
    customerExists,
    findById,
    insert,
    updateById,
    deleteById,
  };
}

/** Scripted outcomes of one users database double. */
export interface UsersDatabaseMockOptions {
  /** Rows resolved by the `customers` existence select. */
  readonly customerRows?: readonly { readonly id: string }[];
  /** Rows resolved by a `customer_users` select. */
  readonly userRows?: readonly CustomerUserRow[];
  /** Rows returned by `insert(customer_users)…returning()`; default one user. */
  readonly insertedRows?: readonly CustomerUserRow[];
  /** Error rejected by the insert (the email / owner index). */
  readonly insertError?: unknown;
  /** Rows returned by `update(…).returning()`; default one user. */
  readonly updatedRows?: readonly CustomerUserRow[];
  /** Error rejected by the update (the owner index). */
  readonly updateError?: unknown;
  /** Rows returned by `delete(…).returning()`; default one user. */
  readonly deletedRows?: readonly CustomerUserRow[];
  /** Error rejected by the delete (the referencing foreign keys). */
  readonly deleteError?: unknown;
}

/** Handle exposing the injected values and the recorded calls. */
export interface UsersDatabaseMock {
  /** Value to inject as `DATABASE`. */
  readonly db: Database;
  /** The transaction handle the mocked `db.transaction()` hands out. */
  readonly tx: DatabaseTransaction;
  /** Values passed to the user insert. */
  readonly insertedValues: readonly NewCustomerUserRow[];
  /** Patches passed to `update(…).set()`. */
  readonly updateSetValues: readonly CustomerUserPatch[];
  /** `WHERE` expressions of every update, in call order. */
  readonly updateExpressions: readonly unknown[];
  /** `WHERE` expressions of every delete, in call order. */
  readonly deleteExpressions: readonly unknown[];
}

/**
 * Chainable `Database` double for the users repository spec.
 *
 * Routing is by **table identity** and by the operation, never by call order.
 *
 * @param options - scripted rows/errors; the defaults describe a successful
 *   invite.
 * @returns the injected handles plus what was recorded.
 */
export function createUsersDatabaseMock(
  options: UsersDatabaseMockOptions = {},
): UsersDatabaseMock {
  const insertedValues: NewCustomerUserRow[] = [];

  /**
   * Scripted failures may be plain driver-shaped objects (a `code` +
   * `constraint_name` pair), but a promise must reject with an `Error`. The value
   * is attached as the `cause`, which is where the production driver puts it.
   */
  const rejectWith = (reason: unknown): Promise<never> =>
    Promise.reject(
      reason instanceof Error
        ? reason
        : new Error('mocked database failure', { cause: reason }),
    );
  const updateSetValues: CustomerUserPatch[] = [];
  const updateExpressions: unknown[] = [];
  const deleteExpressions: unknown[] = [];

  const resolveSelect = (table: object): Promise<unknown[]> => {
    if (table === customers) {
      return Promise.resolve([...(options.customerRows ?? [])]);
    }

    if (table === customerUsers) {
      return Promise.resolve([...(options.userRows ?? [])]);
    }

    return Promise.reject(
      new Error('createUsersDatabaseMock: unmocked table in a select'),
    );
  };

  const from = jest.fn((table: object) => {
    const limit = jest.fn(() => resolveSelect(table));
    const where = jest.fn(() => ({ limit }));

    return { where };
  });

  const select = jest.fn(() => ({ from }));

  const insert = jest.fn((table: object) => ({
    values: (values: NewCustomerUserRow) => {
      if (table !== customerUsers) {
        throw new Error('createUsersDatabaseMock: unmocked table in an insert');
      }

      insertedValues.push(values);

      return {
        returning: () =>
          options.insertError !== undefined
            ? rejectWith(options.insertError)
            : Promise.resolve([
                ...(options.insertedRows ?? [buildCustomerUserRowFixture()]),
              ]),
      };
    },
  }));

  const update = jest.fn((table: object) => ({
    set: (patch: CustomerUserPatch) => {
      if (table !== customerUsers) {
        throw new Error('createUsersDatabaseMock: unmocked table in an update');
      }

      updateSetValues.push(patch);

      return {
        where: (expression: unknown) => {
          updateExpressions.push(expression);

          return {
            returning: () =>
              options.updateError !== undefined
                ? rejectWith(options.updateError)
                : Promise.resolve([
                    ...(options.updatedRows ?? [
                      buildCustomerUserRowFixture({ status: 'active' }),
                    ]),
                  ]),
          };
        },
      };
    },
  }));

  const remove = jest.fn((table: object) => ({
    where: (expression: unknown) => {
      if (table !== customerUsers) {
        throw new Error('createUsersDatabaseMock: unmocked table in a delete');
      }

      deleteExpressions.push(expression);

      return {
        returning: () =>
          options.deleteError !== undefined
            ? rejectWith(options.deleteError)
            : Promise.resolve([
                ...(options.deletedRows ?? [buildCustomerUserRowFixture()]),
              ]),
      };
    },
  }));

  const handle = {
    select,
    insert,
    update,
    delete: remove,
  } as unknown as DatabaseTransaction;

  const transaction = jest.fn(
    async <T>(work: (tx: DatabaseTransaction) => Promise<T>): Promise<T> =>
      work(handle),
  );

  const db = {
    select,
    insert,
    update,
    delete: remove,
    transaction,
  } as unknown as Database;

  return {
    db,
    tx: handle,
    insertedValues,
    updateSetValues,
    updateExpressions,
    deleteExpressions,
  };
}
