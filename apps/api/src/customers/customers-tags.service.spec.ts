import type {
  AuditRequestFacts,
  AuditWriteInput,
} from '../audit/audit.interface.js';
import type { AuditWriter } from '../audit/audit-writer.interface.js';
import {
  CUSTOMER_TAGS_TABLE_NAME,
  TAGS_TABLE_NAME,
} from './customers-tags.const.js';
import { TagNameRaceError } from './customers-tags.errors.js';
import { CustomerTagsService } from './customers-tags.service.js';
import {
  TAG_ID,
  TAGS_CUSTOMER_ID,
  buildCreateTagInput,
  buildTagRow,
  createCustomerTagsRepositoryMock,
} from './test/mocks/customers-tags.mock.js';

/**
 * Unit tests of the tag orchestration (AIS-178, slice e).
 *
 * The service owns the parts the repository cannot: the parent check, the
 * create-or-reuse decision (including losing the "same name" race), the
 * "a no-op writes no ledger row" rule and the `404`/`422` translation. All of it
 * is asserted with a plain repository double and a recording writer — no Nest, no
 * database.
 */

/** Fixed request facts, so the assertions need no header parsing. */
const FACTS: AuditRequestFacts = {
  ipAddress: '10.9.8.7',
  userAgent: 'tags-service-spec',
  requestId: '0192f3c4-0000-4000-8000-000000000004',
  source: 'admin_api',
};

interface ServiceFixture {
  readonly service: CustomerTagsService;
  readonly mocks: ReturnType<typeof createCustomerTagsRepositoryMock>;
  readonly writes: AuditWriteInput[];
}

/**
 * @returns the service under test plus its doubles.
 */
function createFixture(): ServiceFixture {
  const mocks = createCustomerTagsRepositoryMock();
  const writes: AuditWriteInput[] = [];
  const writer: AuditWriter = {
    write: (input) => {
      writes.push(input);
      return Promise.resolve();
    },
  };

  return {
    service: new CustomerTagsService(mocks.repository, writer),
    mocks,
    writes,
  };
}

describe('CustomerTagsService — parent guard', () => {
  it('rejects an unknown customer before touching the catalogue', async () => {
    const fixture = createFixture();
    fixture.mocks.customerExists.mockResolvedValue(false);

    await expect(
      fixture.service.create(TAGS_CUSTOMER_ID, buildCreateTagInput(), FACTS),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(fixture.mocks.findTagByName).not.toHaveBeenCalled();
    expect(fixture.mocks.insertTag).not.toHaveBeenCalled();
  });
});

describe('CustomerTagsService — create (create-or-attach)', () => {
  it('creates the label and the link, one ledger row per table', async () => {
    const fixture = createFixture();

    const tag = await fixture.service.create(
      TAGS_CUSTOMER_ID,
      buildCreateTagInput({ name: 'vip' }),
      FACTS,
    );

    expect(tag).toEqual({ id: TAG_ID, name: 'vip', isActive: true });
    expect(fixture.mocks.insertTag).toHaveBeenCalledTimes(1);
    expect(fixture.writes.map((write) => write.tableName)).toEqual([
      TAGS_TABLE_NAME,
      CUSTOMER_TAGS_TABLE_NAME,
    ]);
    expect(fixture.writes[0]?.operation).toBe('insert');
    expect(fixture.writes[0]?.recordId).toBe(TAG_ID);
    expect(fixture.writes[1]?.recordId).toBeNull();
    expect(fixture.writes[1]?.after).toEqual({
      customerId: TAGS_CUSTOMER_ID,
      tagId: TAG_ID,
    });
  });

  it('reuses an existing label instead of inserting a second row', async () => {
    const fixture = createFixture();
    fixture.mocks.findTagByName.mockResolvedValue(buildTagRow());

    await fixture.service.create(
      TAGS_CUSTOMER_ID,
      buildCreateTagInput(),
      FACTS,
    );

    expect(fixture.mocks.insertTag).not.toHaveBeenCalled();
    expect(fixture.writes).toHaveLength(1);
    expect(fixture.writes[0]?.tableName).toBe(CUSTOMER_TAGS_TABLE_NAME);
  });

  it('writes no ledger row when the link already exists', async () => {
    const fixture = createFixture();
    fixture.mocks.findTagByName.mockResolvedValue(buildTagRow());
    fixture.mocks.attach.mockResolvedValue(false);

    const tag = await fixture.service.create(
      TAGS_CUSTOMER_ID,
      buildCreateTagInput(),
      FACTS,
    );

    expect(tag.name).toBe('vip');
    expect(fixture.writes).toHaveLength(0);
  });

  it('reuses the winner of a name race instead of failing', async () => {
    const fixture = createFixture();
    const winner = buildTagRow({ id: 'a7b8c9d0-e1f2-4a3b-9c4d-5e6f7a8b9c0d' });

    fixture.mocks.findTagByName
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(winner);
    fixture.mocks.insertTag.mockRejectedValue(
      new TagNameRaceError('vip', new Error('23505')),
    );

    const tag = await fixture.service.create(
      TAGS_CUSTOMER_ID,
      buildCreateTagInput(),
      FACTS,
    );

    expect(tag.id).toBe(winner.id);
    // Only the link row: the catalogue row belongs to the winner's transaction.
    expect(fixture.writes).toHaveLength(1);
    expect(fixture.writes[0]?.tableName).toBe(CUSTOMER_TAGS_TABLE_NAME);
  });

  it('rethrows the race when the winner cannot be read either', async () => {
    const fixture = createFixture();
    const race = new TagNameRaceError('vip', new Error('23505'));

    fixture.mocks.findTagByName.mockResolvedValue(null);
    fixture.mocks.insertTag.mockRejectedValue(race);

    await expect(
      fixture.service.create(TAGS_CUSTOMER_ID, buildCreateTagInput(), FACTS),
    ).rejects.toBe(race);
  });

  it('rethrows an unrelated failure untouched', async () => {
    const fixture = createFixture();
    const driverError = new Error('permission denied for table tags');

    fixture.mocks.insertTag.mockRejectedValue(driverError);

    await expect(
      fixture.service.create(TAGS_CUSTOMER_ID, buildCreateTagInput(), FACTS),
    ).rejects.toBe(driverError);
  });
});

describe('CustomerTagsService — attach an existing label', () => {
  it('rejects an unknown tag with a field-level 422', async () => {
    const fixture = createFixture();
    fixture.mocks.findTagById.mockResolvedValue(null);

    await expect(
      fixture.service.attach(TAGS_CUSTOMER_ID, TAG_ID, FACTS),
    ).rejects.toMatchObject({
      code: 'SEMANTIC_VALIDATION_FAILED',
      details: [{ path: 'tagId' }],
    });
    expect(fixture.writes).toHaveLength(0);
  });

  it('rejects an inactive label with a field-level 422', async () => {
    const fixture = createFixture();
    fixture.mocks.findTagById.mockResolvedValue(
      buildTagRow({ isActive: false }),
    );

    await expect(
      fixture.service.attach(TAGS_CUSTOMER_ID, TAG_ID, FACTS),
    ).rejects.toMatchObject({
      code: 'SEMANTIC_VALIDATION_FAILED',
      details: [{ path: 'tagId' }],
    });
  });

  it('attaches a live label with exactly one ledger row', async () => {
    const fixture = createFixture();

    const tag = await fixture.service.attach(TAGS_CUSTOMER_ID, TAG_ID, FACTS);

    expect(tag.id).toBe(TAG_ID);
    expect(fixture.writes).toHaveLength(1);
    expect(fixture.writes[0]).toMatchObject({
      tableName: CUSTOMER_TAGS_TABLE_NAME,
      operation: 'insert',
      recordId: null,
    });
  });

  it('does not audit a repeat attach', async () => {
    const fixture = createFixture();
    fixture.mocks.attach.mockResolvedValue(false);

    await fixture.service.attach(TAGS_CUSTOMER_ID, TAG_ID, FACTS);

    expect(fixture.writes).toHaveLength(0);
  });
});

describe('CustomerTagsService — detach', () => {
  it('removes the link and records the pair', async () => {
    const fixture = createFixture();

    await expect(
      fixture.service.detach(TAGS_CUSTOMER_ID, TAG_ID, FACTS),
    ).resolves.toBeNull();
    expect(fixture.writes).toHaveLength(1);
    expect(fixture.writes[0]).toMatchObject({
      tableName: CUSTOMER_TAGS_TABLE_NAME,
      operation: 'delete',
      recordId: null,
      before: { customerId: TAGS_CUSTOMER_ID, tagId: TAG_ID },
      after: null,
    });
  });

  it('answers 404 when no such link exists and audits nothing', async () => {
    const fixture = createFixture();
    fixture.mocks.detach.mockResolvedValue(false);

    await expect(
      fixture.service.detach(TAGS_CUSTOMER_ID, TAG_ID, FACTS),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(fixture.writes).toHaveLength(0);
  });
});
