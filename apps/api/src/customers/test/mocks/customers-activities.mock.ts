import { jest } from '@jest/globals';
import type {
  ActivityListQuery,
  CreateActivityInput,
  UpdateActivityInput,
} from '@callback/shared';
import type { AuditActorProvider } from '../../../audit/audit-actor.interface.js';
import type { AuditActor } from '../../../audit/audit.interface.js';
import type { DatabaseTransaction } from '../../../audit/audit-transaction.interface.js';
import type { Database } from '../../../db/database.interface.js';
import { activities, customers } from '../../../db/schema.js';
import type { ActivityRow, NewActivityRow } from '../../../db/schema.js';
import type {
  ActivityPage,
  ActivityPatch,
} from '../../customers-activities.interface.js';
import type { CustomerActivitiesRepository } from '../../customers-activities.repository.interface.js';

/**
 * Fixtures and doubles for the customer-activity specs (AIS-178, slice f).
 *
 * Centralised here (coding standard: no fixtures inline in spec files) so the row
 * shape stays in sync with `schema.ts`, and so the service, controller and
 * repository specs share one description of "an activity".
 */

/** Fixed customer uuid the feed belongs to. */
export const ACTIVITY_CUSTOMER_ID = '5c7e1b90-2f4a-4d38-9b61-8e2f0a7c4d31';

/** Fixed uuid of the activity fixture. */
export const ACTIVITY_ID = 'b1f2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

/** A second activity, used where the order or the token has to differ. */
export const SECOND_ACTIVITY_ID = 'c2a3b4d5-6f70-4b8c-9d0e-1f2a3b4c5d6e';

/** Creation instant of the fixture (`activities.created_at`). */
export const ACTIVITY_CREATED_AT = new Date('2026-11-23T09:00:00.000Z');

/** First-edit instant, i.e. the `updated_at` a `PATCH` writes. */
export const ACTIVITY_EDITED_AT = new Date('2026-11-23T10:30:00.000Z');

/** Fixed operator uuid, for the operator-author branches. */
export const OPERATOR_ID = '7d8e9f01-2a3b-4c5d-8e6f-7a8b9c0d1e2f';

/** A stand-in transaction handle (the service only passes it around). */
export const TRANSACTION = {} as DatabaseTransaction;

/** The actor the provider resolves while the admin API has no auth. */
export const SYSTEM_AUDIT_ACTOR: AuditActor = {
  type: 'system',
  id: null,
  name: 'system',
};

/** An operator actor, to prove the author columns follow the actor type. */
export const OPERATOR_AUDIT_ACTOR: AuditActor = {
  type: 'operator',
  id: OPERATOR_ID,
  name: 'Kiss Anna',
};

/**
 * @param overrides - fields to replace on the default row.
 * @returns a complete `activity.activities` row.
 */
export function buildActivityRowFixture(
  overrides: Partial<ActivityRow> = {},
): ActivityRow {
  return {
    id: ACTIVITY_ID,
    customerId: ACTIVITY_CUSTOMER_ID,
    type: 'note',
    body: 'Called the owner about the missing invoice.',
    authorType: 'system',
    operatorId: null,
    customerUserId: null,
    authorName: 'system',
    metadata: null,
    createdAt: ACTIVITY_CREATED_AT,
    updatedAt: null,
    deletedAt: null,
    ...overrides,
  };
}

/**
 * @param overrides - fields to replace on the default body.
 * @returns a valid `POST …/activities` body.
 */
export function buildCreateActivityInput(
  overrides: Partial<CreateActivityInput> = {},
): CreateActivityInput {
  return {
    type: 'note',
    body: 'Called the owner about the missing invoice.',
    ...overrides,
  };
}

/**
 * @param overrides - fields to replace on the default body.
 * @returns a valid `PATCH …/activities/:activityId` body.
 */
export function buildUpdateActivityInput(
  overrides: Partial<UpdateActivityInput> = {},
): UpdateActivityInput {
  return {
    updatedAt: ACTIVITY_CREATED_AT.toISOString(),
    ...overrides,
  };
}

/**
 * @param overrides - fields to replace on the default query.
 * @returns a validated activity-list query.
 */
export function buildActivityListQuery(
  overrides: Partial<ActivityListQuery> = {},
): ActivityListQuery {
  return { page: 1, limit: 20, order: 'desc', ...overrides };
}

/** The reusable double of the actor provider. */
export interface AuditActorProviderMock {
  readonly provider: AuditActorProvider;
  readonly resolve: jest.Mock<() => AuditActor>;
}

/**
 * @param actor - what the provider resolves; defaults to the system actor.
 * @returns the provider double plus its `resolve` spy.
 */
export function createAuditActorProviderMock(
  actor: AuditActor = SYSTEM_AUDIT_ACTOR,
): AuditActorProviderMock {
  const resolve = jest.fn(() => actor);

  return { provider: { resolve }, resolve };
}

/** The jest doubles of one {@link CustomerActivitiesRepository}. */
export interface CustomerActivitiesRepositoryMock {
  readonly repository: CustomerActivitiesRepository;
  readonly customerExists: jest.Mock<(customerId: string) => Promise<boolean>>;
  readonly findPage: jest.Mock<
    (customerId: string, query: ActivityListQuery) => Promise<ActivityPage>
  >;
  readonly findAnyById: jest.Mock<
    (customerId: string, activityId: string) => Promise<ActivityRow | null>
  >;
  readonly create: jest.Mock<
    (tx: DatabaseTransaction, input: NewActivityRow) => Promise<ActivityRow>
  >;
  readonly updateById: jest.Mock<
    (
      tx: DatabaseTransaction,
      customerId: string,
      activityId: string,
      patch: ActivityPatch,
      expectedLastWrite: Date,
      now: Date,
    ) => Promise<ActivityRow | null>
  >;
  readonly softDeleteById: jest.Mock<
    (
      tx: DatabaseTransaction,
      customerId: string,
      activityId: string,
      deletedAt: Date,
    ) => Promise<ActivityRow | null>
  >;
}

/**
 * Builds a repository double whose defaults describe the **happy** path: the
 * parent exists, one entry is stored, and every guarded write matches.
 *
 * @returns the doubles plus the `CustomerActivitiesRepository` they implement.
 */
export function createCustomerActivitiesRepositoryMock(): CustomerActivitiesRepositoryMock {
  const customerExists = jest.fn(() => Promise.resolve(true));
  const findPage = jest.fn(() =>
    Promise.resolve<ActivityPage>({
      rows: [buildActivityRowFixture()],
      total: 1,
    }),
  );
  const findAnyById = jest.fn(() =>
    Promise.resolve<ActivityRow | null>(buildActivityRowFixture()),
  );
  const create = jest.fn(() => Promise.resolve(buildActivityRowFixture()));
  const updateById = jest.fn(() =>
    Promise.resolve<ActivityRow | null>(
      buildActivityRowFixture({
        body: 'Called again; the invoice was sent.',
        updatedAt: ACTIVITY_EDITED_AT,
      }),
    ),
  );
  const softDeleteById = jest.fn(() =>
    Promise.resolve<ActivityRow | null>(
      buildActivityRowFixture({ deletedAt: ACTIVITY_EDITED_AT }),
    ),
  );

  const repository: CustomerActivitiesRepository = {
    customerExists,
    findPage,
    findAnyById,
    create,
    updateById,
    softDeleteById,
    runInTransaction: async (work) => work(TRANSACTION),
  };

  return {
    repository,
    customerExists,
    findPage,
    findAnyById,
    create,
    updateById,
    softDeleteById,
  };
}

/** Scripted outcomes of one activities database double. */
export interface ActivitiesDatabaseMockOptions {
  /** Rows resolved by the `customers` existence select. */
  readonly customerRows?: readonly { readonly id: string }[];
  /** Rows resolved by an `activities` row select (page and single-entry read). */
  readonly activityRows?: readonly ActivityRow[];
  /** Total reported by the `count(*)` select; defaults to the row count. */
  readonly total?: number;
  /** Error rejected by any `activities` read. */
  readonly selectError?: unknown;
  /** Rows returned by `insert(activities)…returning()`; defaults to one entry. */
  readonly insertedRows?: readonly ActivityRow[];
  /** Error rejected by the insert. */
  readonly insertError?: unknown;
  /** Rows returned by `update(activities)…returning()`; `[]` models a miss. */
  readonly updatedRows?: readonly ActivityRow[];
  /** Error rejected by the update. */
  readonly updateError?: unknown;
  /** Rows returned by the soft-delete update; `[]` models a repeat delete. */
  readonly deletedRows?: readonly ActivityRow[];
}

/** Handle exposing the injected values and the recorded calls. */
export interface ActivitiesDatabaseMock {
  /** Value to inject as `DATABASE`. */
  readonly db: Database;
  /** The transaction handle the mocked `db.transaction()` hands out. */
  readonly tx: DatabaseTransaction;
  /** `WHERE` expressions of every select, in build order. */
  readonly selectExpressions: readonly unknown[];
  /** `WHERE` expressions of every update, in build order. */
  readonly updateExpressions: readonly unknown[];
  /** `SET` payloads of every update, in build order. */
  readonly updatePatches: readonly unknown[];
  /** Values passed to `insert(activities)`. */
  readonly insertedValues: readonly unknown[];
  /** Arguments of every `orderBy`, in build order. */
  readonly orderByArguments: readonly (readonly unknown[])[];
}

/**
 * Chainable `Database` double for the activities repository spec.
 *
 * Routing is by **table identity** and by the shape of the `select` projection
 * (`{ total }` is the count, `{ id }` is the parent probe, no projection is a row
 * read), never by call order: the repository asks several different questions and
 * a queue would make the assertions depend on which branch ran first.
 *
 * @param options - scripted rows/errors; the defaults describe a successful write.
 * @returns the injected handles plus what was recorded.
 */
export function createActivitiesDatabaseMock(
  options: ActivitiesDatabaseMockOptions = {},
): ActivitiesDatabaseMock {
  /**
   * Scripted failures may be plain driver-shaped objects, but a promise must
   * reject with an `Error`. The value is therefore attached as the `cause`, which
   * is exactly where the production driver puts it.
   */
  const rejectWith = (reason: unknown): Promise<never> =>
    Promise.reject(
      reason instanceof Error
        ? reason
        : new Error('mocked database failure', { cause: reason }),
    );
  const selectExpressions: unknown[] = [];
  const updateExpressions: unknown[] = [];
  const updatePatches: unknown[] = [];
  const insertedValues: unknown[] = [];
  const orderByArguments: (readonly unknown[])[] = [];
  const activityRows = options.activityRows ?? [buildActivityRowFixture()];

  const select = jest.fn((fields?: unknown) => ({
    from: jest.fn((table: object) => {
      if (table === customers) {
        return {
          where: jest.fn(() => ({
            limit: jest.fn(() =>
              Promise.resolve([...(options.customerRows ?? [])]),
            ),
          })),
        };
      }

      if (table !== activities) {
        throw new Error(
          'createActivitiesDatabaseMock: unmocked table in a select',
        );
      }

      const settle = (): Promise<unknown[]> => {
        if (options.selectError !== undefined) {
          return rejectWith(options.selectError);
        }

        if (isCountProjection(fields)) {
          return Promise.resolve([
            { total: options.total ?? activityRows.length },
          ]);
        }

        return Promise.resolve([...activityRows]);
      };

      const chain = {
        orderBy: jest.fn((...args: unknown[]) => {
          orderByArguments.push(args);

          return chain;
        }),
        limit: jest.fn(() => chain),
        offset: jest.fn(() => settle()),
        then: (
          onFulfilled: (rows: unknown[]) => unknown,
          onRejected: (reason: unknown) => unknown,
        ): Promise<unknown> => settle().then(onFulfilled, onRejected),
      };

      return {
        where: jest.fn((expression: unknown) => {
          selectExpressions.push(expression);

          return chain;
        }),
      };
    }),
  }));

  const insert = jest.fn((table: object) => {
    if (table !== activities) {
      throw new Error(
        'createActivitiesDatabaseMock: unmocked table in an insert',
      );
    }

    return {
      values: jest.fn((values: unknown) => {
        insertedValues.push(values);

        return {
          returning: () =>
            options.insertError !== undefined
              ? rejectWith(options.insertError)
              : Promise.resolve([
                  ...(options.insertedRows ?? [buildActivityRowFixture()]),
                ]),
        };
      }),
    };
  });

  const update = jest.fn((table: object) => {
    if (table !== activities) {
      throw new Error(
        'createActivitiesDatabaseMock: unmocked table in an update',
      );
    }

    return {
      set: jest.fn((patch: unknown) => {
        updatePatches.push(patch);

        return {
          where: jest.fn((expression: unknown) => {
            updateExpressions.push(expression);

            return {
              returning: () => {
                if (options.updateError !== undefined) {
                  return rejectWith(options.updateError);
                }

                const deleted = isDeletePatch(patch);

                return Promise.resolve([
                  ...(deleted
                    ? (options.deletedRows ?? [
                        buildActivityRowFixture({
                          deletedAt: ACTIVITY_EDITED_AT,
                        }),
                      ])
                    : (options.updatedRows ?? [
                        buildActivityRowFixture({
                          updatedAt: ACTIVITY_EDITED_AT,
                        }),
                      ])),
                ]);
              },
            };
          }),
        };
      }),
    };
  });

  const handle = { insert, update, select } as unknown as DatabaseTransaction;

  const transaction = jest.fn(
    async <T>(work: (tx: DatabaseTransaction) => Promise<T>): Promise<T> =>
      work(handle),
  );

  const db = { select, transaction } as unknown as Database;

  return {
    db,
    tx: handle,
    selectExpressions,
    updateExpressions,
    updatePatches,
    insertedValues,
    orderByArguments,
  };
}

/**
 * @param fields - the `select` projection the repository passed.
 * @returns `true` when the projection is the `count(*)` one.
 */
function isCountProjection(fields: unknown): boolean {
  return (
    typeof fields === 'object' &&
    fields !== null &&
    Object.hasOwn(fields, 'total')
  );
}

/**
 * @param patch - the `SET` payload of an update.
 * @returns `true` when the payload is the soft-delete one.
 */
function isDeletePatch(patch: unknown): boolean {
  return (
    typeof patch === 'object' &&
    patch !== null &&
    Object.hasOwn(patch, 'deletedAt') &&
    !Object.hasOwn(patch, 'updatedAt')
  );
}
