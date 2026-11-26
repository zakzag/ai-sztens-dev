import {
  NotFoundAppError,
  StaleWriteAppError,
} from '../common/http/app-error.js';
import type {
  AuditRequestFacts,
  AuditWriteInput,
} from '../audit/audit.interface.js';
import type { AuditWriter } from '../audit/audit-writer.interface.js';
import { CustomerActivitiesService } from './customers-activities.service.js';
import {
  ACTIVITY_CREATED_AT,
  ACTIVITY_CUSTOMER_ID,
  ACTIVITY_EDITED_AT,
  ACTIVITY_ID,
  OPERATOR_AUDIT_ACTOR,
  buildActivityListQuery,
  buildActivityRowFixture,
  buildCreateActivityInput,
  buildUpdateActivityInput,
  createAuditActorProviderMock,
  createCustomerActivitiesRepositoryMock,
} from './test/mocks/customers-activities.mock.js';

/**
 * Unit tests of the activity orchestration (AIS-178, slice f).
 *
 * Everything is doubled except the service: the repository, the ledger writer and
 * the actor provider. What is asserted is exactly what the service owns — the
 * author comes from the provider (never the body), one ledger row per write on the
 * same transaction, a stale token is refused **before** any write, and an empty
 * patch is not a write at all.
 */

/** Fixed request facts, so the ledger assertions need no clock or socket. */
const FACTS: AuditRequestFacts = {
  ipAddress: '10.9.8.7',
  userAgent: 'activity service spec',
  requestId: '0192f3c4-0000-4000-8000-000000000004',
  source: 'admin_api',
};

interface ServiceFixture {
  readonly service: CustomerActivitiesService;
  readonly mocks: ReturnType<typeof createCustomerActivitiesRepositoryMock>;
  readonly actors: ReturnType<typeof createAuditActorProviderMock>;
  readonly writes: AuditWriteInput[];
}

/**
 * @returns the service under test plus its doubles.
 */
function createFixture(): ServiceFixture {
  const mocks = createCustomerActivitiesRepositoryMock();
  const actors = createAuditActorProviderMock();
  const writes: AuditWriteInput[] = [];
  const writer: AuditWriter = {
    write: (input) => {
      writes.push(input);
      return Promise.resolve();
    },
  };

  return {
    service: new CustomerActivitiesService(
      mocks.repository,
      writer,
      actors.provider,
    ),
    mocks,
    actors,
    writes,
  };
}

describe('CustomerActivitiesService — list', () => {
  it('rejects an unknown customer before reading the feed', async () => {
    const fixture = createFixture();
    fixture.mocks.customerExists.mockResolvedValue(false);

    await expect(
      fixture.service.list(ACTIVITY_CUSTOMER_ID, buildActivityListQuery()),
    ).rejects.toBeInstanceOf(NotFoundAppError);
    expect(fixture.mocks.findPage).not.toHaveBeenCalled();
  });

  it('maps the page and builds the pagination block', async () => {
    const fixture = createFixture();
    fixture.mocks.findPage.mockResolvedValue({
      rows: [buildActivityRowFixture()],
      total: 7,
    });

    const result = await fixture.service.list(
      ACTIVITY_CUSTOMER_ID,
      buildActivityListQuery({ page: 2, limit: 5 }),
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe(ACTIVITY_ID);
    expect(result.pagination).toEqual({
      page: 2,
      limit: 5,
      total: 7,
      totalPages: 2,
    });
  });
});

describe('CustomerActivitiesService — create', () => {
  it('writes the entry with the provider author and one ledger row', async () => {
    const fixture = createFixture();
    fixture.actors.resolve.mockReturnValue(OPERATOR_AUDIT_ACTOR);

    const created = await fixture.service.create(
      ACTIVITY_CUSTOMER_ID,
      buildCreateActivityInput(),
      FACTS,
    );

    expect(fixture.actors.resolve).toHaveBeenCalledTimes(1);
    expect(fixture.mocks.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        customerId: ACTIVITY_CUSTOMER_ID,
        authorType: 'operator',
        operatorId: OPERATOR_AUDIT_ACTOR.id,
        authorName: OPERATOR_AUDIT_ACTOR.name,
      }),
    );
    expect(fixture.writes).toHaveLength(1);
    expect(fixture.writes[0]).toEqual(
      expect.objectContaining({
        customerId: ACTIVITY_CUSTOMER_ID,
        tableName: 'activities',
        operation: 'insert',
        before: null,
      }),
    );
    expect(created.id).toBe(ACTIVITY_ID);
  });

  it('never takes the author from the body', async () => {
    const fixture = createFixture();

    await fixture.service.create(
      ACTIVITY_CUSTOMER_ID,
      buildCreateActivityInput(),
      FACTS,
    );

    // The second argument is the insert payload; the first is the transaction.
    const [, inserted] = fixture.mocks.create.mock.calls[0] ?? [];

    expect(inserted).toEqual(
      expect.objectContaining({ authorType: 'system', authorName: 'system' }),
    );
  });

  it('leaves the ledger untouched when the parent is unknown', async () => {
    const fixture = createFixture();
    fixture.mocks.customerExists.mockResolvedValue(false);

    await expect(
      fixture.service.create(
        ACTIVITY_CUSTOMER_ID,
        buildCreateActivityInput(),
        FACTS,
      ),
    ).rejects.toBeInstanceOf(NotFoundAppError);
    expect(fixture.writes).toHaveLength(0);
  });
});

describe('CustomerActivitiesService — update', () => {
  it('rejects an archived entry as not found', async () => {
    const fixture = createFixture();
    fixture.mocks.findAnyById.mockResolvedValue(
      buildActivityRowFixture({ deletedAt: ACTIVITY_EDITED_AT }),
    );

    await expect(
      fixture.service.update(
        ACTIVITY_CUSTOMER_ID,
        ACTIVITY_ID,
        buildUpdateActivityInput({ body: 'Edited.' }),
        FACTS,
        ACTIVITY_EDITED_AT,
      ),
    ).rejects.toBeInstanceOf(NotFoundAppError);
    expect(fixture.mocks.updateById).not.toHaveBeenCalled();
  });

  it('answers 409 STALE_WRITE for an outdated token', async () => {
    const fixture = createFixture();

    await expect(
      fixture.service.update(
        ACTIVITY_CUSTOMER_ID,
        ACTIVITY_ID,
        buildUpdateActivityInput({
          body: 'Edited.',
          updatedAt: ACTIVITY_EDITED_AT.toISOString(),
        }),
        FACTS,
        ACTIVITY_EDITED_AT,
      ),
    ).rejects.toBeInstanceOf(StaleWriteAppError);
    expect(fixture.mocks.updateById).not.toHaveBeenCalled();
    expect(fixture.writes).toHaveLength(0);
  });

  it('accepts the first edit of a never-edited entry with its createdAt token', async () => {
    const fixture = createFixture();

    await fixture.service.update(
      ACTIVITY_CUSTOMER_ID,
      ACTIVITY_ID,
      buildUpdateActivityInput({
        body: 'Edited.',
        updatedAt: ACTIVITY_CREATED_AT.toISOString(),
      }),
      FACTS,
      ACTIVITY_EDITED_AT,
    );

    expect(fixture.mocks.updateById).toHaveBeenCalledWith(
      expect.anything(),
      ACTIVITY_CUSTOMER_ID,
      ACTIVITY_ID,
      { body: 'Edited.' },
      ACTIVITY_CREATED_AT,
      ACTIVITY_EDITED_AT,
    );
  });

  it('writes nothing when the body carries only the token', async () => {
    const fixture = createFixture();

    const result = await fixture.service.update(
      ACTIVITY_CUSTOMER_ID,
      ACTIVITY_ID,
      buildUpdateActivityInput(),
      FACTS,
      ACTIVITY_EDITED_AT,
    );

    expect(result.id).toBe(ACTIVITY_ID);
    expect(fixture.mocks.updateById).not.toHaveBeenCalled();
    expect(fixture.writes).toHaveLength(0);
  });

  it('audits the changed columns of one entry', async () => {
    const fixture = createFixture();

    await fixture.service.update(
      ACTIVITY_CUSTOMER_ID,
      ACTIVITY_ID,
      buildUpdateActivityInput({
        body: 'Edited.',
        updatedAt: ACTIVITY_CREATED_AT.toISOString(),
      }),
      FACTS,
      ACTIVITY_EDITED_AT,
    );

    expect(fixture.writes).toHaveLength(1);
    expect(fixture.writes[0]).toEqual(
      expect.objectContaining({
        tableName: 'activities',
        recordId: ACTIVITY_ID,
        operation: 'update',
      }),
    );
    expect(fixture.writes[0]?.before).toEqual(
      expect.objectContaining({
        body: 'Called the owner about the missing invoice.',
      }),
    );
  });

  it('answers 409 when the guarded write matched no row', async () => {
    const fixture = createFixture();
    fixture.mocks.updateById.mockResolvedValue(null);

    await expect(
      fixture.service.update(
        ACTIVITY_CUSTOMER_ID,
        ACTIVITY_ID,
        buildUpdateActivityInput({
          body: 'Edited.',
          updatedAt: ACTIVITY_CREATED_AT.toISOString(),
        }),
        FACTS,
        ACTIVITY_EDITED_AT,
      ),
    ).rejects.toBeInstanceOf(StaleWriteAppError);
    expect(fixture.writes).toHaveLength(0);
  });

  it('rethrows an unknown failure untouched', async () => {
    const fixture = createFixture();
    const failure = new Error('connection reset');
    fixture.mocks.updateById.mockRejectedValue(failure);

    await expect(
      fixture.service.update(
        ACTIVITY_CUSTOMER_ID,
        ACTIVITY_ID,
        buildUpdateActivityInput({
          body: 'Edited.',
          updatedAt: ACTIVITY_CREATED_AT.toISOString(),
        }),
        FACTS,
        ACTIVITY_EDITED_AT,
      ),
    ).rejects.toBe(failure);
  });
});

describe('CustomerActivitiesService — remove', () => {
  it('soft-deletes the entry and audits it', async () => {
    const fixture = createFixture();

    await expect(
      fixture.service.remove(
        ACTIVITY_CUSTOMER_ID,
        ACTIVITY_ID,
        FACTS,
        ACTIVITY_EDITED_AT,
      ),
    ).resolves.toBeNull();
    expect(fixture.mocks.softDeleteById).toHaveBeenCalledWith(
      expect.anything(),
      ACTIVITY_CUSTOMER_ID,
      ACTIVITY_ID,
      ACTIVITY_EDITED_AT,
    );
    expect(fixture.writes).toEqual([
      expect.objectContaining({
        tableName: 'activities',
        recordId: ACTIVITY_ID,
        operation: 'soft_delete',
        after: null,
      }),
    ]);
  });

  it('answers 404 on a repeat delete', async () => {
    const fixture = createFixture();
    fixture.mocks.softDeleteById.mockResolvedValue(null);

    await expect(
      fixture.service.remove(
        ACTIVITY_CUSTOMER_ID,
        ACTIVITY_ID,
        FACTS,
        ACTIVITY_EDITED_AT,
      ),
    ).rejects.toBeInstanceOf(NotFoundAppError);
    expect(fixture.writes).toHaveLength(0);
  });

  it('answers 404 for an entry that is already archived', async () => {
    const fixture = createFixture();
    fixture.mocks.findAnyById.mockResolvedValue(
      buildActivityRowFixture({ deletedAt: ACTIVITY_EDITED_AT }),
    );

    await expect(
      fixture.service.remove(
        ACTIVITY_CUSTOMER_ID,
        ACTIVITY_ID,
        FACTS,
        ACTIVITY_EDITED_AT,
      ),
    ).rejects.toBeInstanceOf(NotFoundAppError);
    expect(fixture.mocks.softDeleteById).not.toHaveBeenCalled();
  });
});
