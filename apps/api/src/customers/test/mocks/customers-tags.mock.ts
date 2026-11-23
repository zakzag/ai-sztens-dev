import { jest } from '@jest/globals';
import type { CreateCustomerTagInput } from '@callback/shared';
import type { DatabaseTransaction } from '../../../audit/audit-transaction.interface.js';
import type { Database } from '../../../db/database.interface.js';
import { customerTags, customers, tags } from '../../../db/schema.js';
import type { NewTagRow, TagRow } from '../../../db/schema.js';
import type { CustomerTagsRepository } from '../../customers-tags.repository.interface.js';

/**
 * Fixtures and doubles for the customer-tags specs (AIS-178, slice e).
 *
 * Centralised here (coding standard: no fixtures inline in spec files) so the row
 * shape stays in sync with `schema.ts`, and so the service, controller and
 * repository specs share one description of "a tag".
 */

/** Fixed customer uuid the links belong to. */
export const TAGS_CUSTOMER_ID = '0d9f3a2e-6b41-4c8a-9f2d-7c5e1a3b4d60';

/** Fixed uuid of the tag fixture. */
export const TAG_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

/** A stand-in transaction handle (the service only passes it around). */
export const TRANSACTION = {} as DatabaseTransaction;

/**
 * @param overrides - fields to replace on the default row.
 * @returns a complete `customer.tags` row.
 */
export function buildTagRow(overrides: Partial<TagRow> = {}): TagRow {
  return { id: TAG_ID, name: 'vip', isActive: true, ...overrides };
}

/**
 * @param overrides - fields to replace on the default body.
 * @returns a valid `POST …/tags` body.
 */
export function buildCreateTagInput(
  overrides: Partial<CreateCustomerTagInput> = {},
): CreateCustomerTagInput {
  return { name: 'vip', ...overrides };
}

/** The jest doubles of one {@link CustomerTagsRepository}. */
export interface CustomerTagsRepositoryMock {
  readonly repository: CustomerTagsRepository;
  readonly customerExists: jest.Mock<(customerId: string) => Promise<boolean>>;
  readonly findTagByName: jest.Mock<(name: string) => Promise<TagRow | null>>;
  readonly findTagById: jest.Mock<(tagId: string) => Promise<TagRow | null>>;
  readonly insertTag: jest.Mock<
    (tx: DatabaseTransaction, input: NewTagRow) => Promise<TagRow>
  >;
  readonly attach: jest.Mock<
    (
      tx: DatabaseTransaction,
      customerId: string,
      tagId: string,
    ) => Promise<boolean>
  >;
  readonly detach: jest.Mock<
    (
      tx: DatabaseTransaction,
      customerId: string,
      tagId: string,
    ) => Promise<boolean>
  >;
}

/**
 * Builds a repository double whose defaults describe the **new label** path: the
 * parent exists, the name is unknown, the insert succeeds and the link is created.
 * A test that needs another branch overrides one method with `mockResolvedValue`.
 *
 * @returns the doubles plus the `CustomerTagsRepository` they implement.
 */
export function createCustomerTagsRepositoryMock(): CustomerTagsRepositoryMock {
  const customerExists = jest.fn(() => Promise.resolve(true));
  const findTagByName = jest.fn(() => Promise.resolve<TagRow | null>(null));
  const findTagById = jest.fn(() =>
    Promise.resolve<TagRow | null>(buildTagRow()),
  );
  const insertTag = jest.fn(() => Promise.resolve(buildTagRow()));
  const attach = jest.fn(() => Promise.resolve(true));
  const detach = jest.fn(() => Promise.resolve(true));

  const repository: CustomerTagsRepository = {
    customerExists,
    findTagByName,
    findTagById,
    insertTag,
    attach,
    detach,
    runInTransaction: async (work) => work(TRANSACTION),
  };

  return {
    repository,
    customerExists,
    findTagByName,
    findTagById,
    insertTag,
    attach,
    detach,
  };
}

/** Scripted outcomes of one tags database double. */
export interface TagsDatabaseMockOptions {
  /** Rows resolved by the `customers` existence select. */
  readonly customerRows?: readonly { readonly id: string }[];
  /** Rows resolved by a `tags` select. */
  readonly tagRows?: readonly TagRow[];
  /** Rows returned by `insert(tags)…returning()`; defaults to one tag. */
  readonly insertedTagRows?: readonly TagRow[];
  /** Error rejected by the tag insert (the `23505` race). */
  readonly insertError?: unknown;
  /** Whether `insert(customer_tags)…returning()` reports a new link; default `true`. */
  readonly linked?: boolean;
  /** Whether `delete(customer_tags)…returning()` removed a link; default `true`. */
  readonly detached?: boolean;
  /** Error rejected by the link delete. */
  readonly deleteError?: unknown;
}

/** Handle exposing the injected values and the recorded calls. */
export interface TagsDatabaseMock {
  /** Value to inject as `DATABASE`. */
  readonly db: Database;
  /** The transaction handle the mocked `db.transaction()` hands out. */
  readonly tx: DatabaseTransaction;
  /** Values passed to `insert(tags)`. */
  readonly insertedTagValues: readonly NewTagRow[];
  /** Values passed to `insert(customer_tags)`. */
  readonly attachedValues: readonly unknown[];
  /** `WHERE` expressions of every select, in build order. */
  readonly selectExpressions: readonly unknown[];
  /** `WHERE` expressions of every delete, in build order. */
  readonly deleteExpressions: readonly unknown[];
}

/**
 * Chainable `Database` double for the tags repository spec.
 *
 * Routing is by **table identity**, never by call order: the repository asks three
 * different questions (`customers` exists, `tags` by name/id, links) and a queue
 * would make the assertions depend on which branch ran first.
 *
 * @param options - scripted rows/errors; the defaults describe a successful
 *   create-or-attach.
 * @returns the injected handles plus what was recorded.
 */
export function createTagsDatabaseMock(
  options: TagsDatabaseMockOptions = {},
): TagsDatabaseMock {
  const insertedTagValues: NewTagRow[] = [];

  /**
   * Scripted failures may be plain driver-shaped objects (a `code` +
   * `constraint_name` pair), but a promise must reject with an `Error`. The value
   * is therefore attached as the `cause`, which is exactly where the production
   * driver puts it — `findPostgresError` walks that chain.
   */
  const rejectWith = (reason: unknown): Promise<never> =>
    Promise.reject(
      reason instanceof Error
        ? reason
        : new Error('mocked database failure', { cause: reason }),
    );
  const attachedValues: unknown[] = [];
  const selectExpressions: unknown[] = [];
  const deleteExpressions: unknown[] = [];

  const resolveSelect = (table: object): Promise<unknown[]> => {
    if (table === customers) {
      return Promise.resolve([...(options.customerRows ?? [])]);
    }

    if (table === tags) {
      return Promise.resolve([...(options.tagRows ?? [])]);
    }

    return Promise.reject(
      new Error('createTagsDatabaseMock: unmocked table in a select'),
    );
  };

  const from = jest.fn((table: object) => {
    const limit = jest.fn(() => resolveSelect(table));
    const where = jest.fn((expression: unknown) => {
      selectExpressions.push(expression);
      return { limit };
    });

    return { where };
  });

  const select = jest.fn(() => ({ from }));

  const insert = jest.fn((table: object) => {
    if (table === tags) {
      return {
        values: (values: NewTagRow) => {
          insertedTagValues.push(values);

          return {
            returning: () =>
              options.insertError === undefined
                ? Promise.resolve([
                    ...(options.insertedTagRows ?? [buildTagRow()]),
                  ])
                : rejectWith(options.insertError),
          };
        },
      };
    }

    if (table === customerTags) {
      return {
        values: (values: unknown) => {
          attachedValues.push(values);

          return {
            onConflictDoNothing: () => ({
              returning: () =>
                Promise.resolve(
                  options.linked === false ? [] : [{ tagId: TAG_ID }],
                ),
            }),
          };
        },
      };
    }

    throw new Error('createTagsDatabaseMock: unmocked table in an insert');
  });

  const remove = jest.fn((table: object) => ({
    where: (expression: unknown) => {
      if (table !== customerTags) {
        throw new Error('createTagsDatabaseMock: unmocked table in a delete');
      }

      deleteExpressions.push(expression);

      return {
        returning: () =>
          options.deleteError !== undefined
            ? rejectWith(options.deleteError)
            : Promise.resolve(
                options.detached === false ? [] : [{ tagId: TAG_ID }],
              ),
      };
    },
  }));

  const handle = {
    select,
    insert,
    delete: remove,
  } as unknown as DatabaseTransaction;

  const transaction = jest.fn(
    async <T>(work: (tx: DatabaseTransaction) => Promise<T>): Promise<T> =>
      work(handle),
  );

  const db = {
    select,
    insert,
    delete: remove,
    transaction,
  } as unknown as Database;

  return {
    db,
    tx: handle,
    insertedTagValues,
    attachedValues,
    selectExpressions,
    deleteExpressions,
  };
}
