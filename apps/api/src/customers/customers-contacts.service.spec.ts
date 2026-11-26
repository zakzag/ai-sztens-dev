import type { AuditRequestFacts } from '../audit/audit.interface.js';
import type { AuditWriteInput } from '../audit/audit.interface.js';
import type { AuditWriter } from '../audit/audit-writer.interface.js';
import {
  CONTACTS_TABLE_NAME,
  CONTACT_ROLES_TABLE_NAME,
} from './customers-contacts.const.js';
import {
  ContactUserMismatchError,
  PrimaryContactConflictError,
} from './customers-contacts.errors.js';
import { CustomerContactsService } from './customers-contacts.service.js';
import {
  CONTACT_DELETED_AT,
  CONTACT_ID,
  CONTACT_UPDATED_AT,
  buildContactRow,
  buildContactWithRoles,
  buildCreateContactInput,
  buildRoleRows,
  buildUpdateContactInput,
  createCustomerContactsRepositoryMock,
} from './test/mocks/customers-contacts.mock.js';

/**
 * Unit tests of the contact orchestration (AIS-178, slice d).
 *
 * The service owns three things the repository cannot: the “parent exists”
 * decision, the composition of business write + ledger rows in one transaction,
 * and the translation of the two domain failures into `AppError`s. All three are
 * asserted here with a plain repository double and a recording writer — no Nest,
 * no database.
 */

/** Fixed request facts, so the assertions need no header parsing. */
const FACTS: AuditRequestFacts = {
  ipAddress: '10.9.8.7',
  userAgent: 'contacts-service-spec',
  requestId: '0192f3c4-0000-4000-8000-000000000002',
  source: 'admin_api',
};

/** The default list query (no sort allow-list for contacts). */
const LIST_QUERY = { page: 1, limit: 20, order: 'desc' as const };

interface ServiceFixture {
  readonly service: CustomerContactsService;
  readonly mocks: ReturnType<typeof createCustomerContactsRepositoryMock>;
  readonly writes: AuditWriteInput[];
}

/**
 * @returns the service under test plus its doubles.
 */
function createFixture(): ServiceFixture {
  const mocks = createCustomerContactsRepositoryMock();
  const writes: AuditWriteInput[] = [];
  const writer: AuditWriter = {
    write: (input) => {
      writes.push(input);
      return Promise.resolve();
    },
  };

  return {
    service: new CustomerContactsService(mocks.repository, writer),
    mocks,
    writes,
  };
}

describe('CustomerContactsService — list', () => {
  it('rejects an unknown customer before reading contacts', async () => {
    const fixture = createFixture();
    fixture.mocks.customerExists.mockResolvedValue(false);

    await expect(
      fixture.service.list('missing', LIST_QUERY),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(fixture.mocks.findPage).not.toHaveBeenCalled();
  });

  it('maps the page and builds the pagination block', async () => {
    const fixture = createFixture();
    fixture.mocks.findPage.mockResolvedValue({
      rows: [buildContactWithRoles()],
      total: 3,
    });

    const result = await fixture.service.list('customer', {
      page: 2,
      limit: 2,
      order: 'asc',
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.roles).toEqual(['primary']);
    expect(result.pagination).toEqual({
      page: 2,
      limit: 2,
      total: 3,
      totalPages: 2,
    });
  });
});

describe('CustomerContactsService — create', () => {
  it('writes the contact and its roles, one ledger row per table', async () => {
    const fixture = createFixture();

    const created = await fixture.service.create(
      'customer',
      buildCreateContactInput({ roles: ['primary'] }),
      FACTS,
    );

    expect(fixture.mocks.create).toHaveBeenCalledTimes(1);
    expect(fixture.mocks.replaceRoles).toHaveBeenCalledWith(
      expect.anything(),
      CONTACT_ID,
      expect.any(String),
      ['primary'],
    );
    expect(fixture.writes.map((write) => write.tableName)).toEqual([
      CONTACTS_TABLE_NAME,
      CONTACT_ROLES_TABLE_NAME,
    ]);
    expect(fixture.writes[0]?.operation).toBe('insert');
    expect(fixture.writes[1]?.recordId).toBeNull();
    expect(created.roles).toEqual(['primary']);
  });

  it('writes only the contact row when no role is given', async () => {
    const fixture = createFixture();

    await fixture.service.create(
      'customer',
      buildCreateContactInput({ roles: [] }),
      FACTS,
    );

    expect(fixture.mocks.replaceRoles).not.toHaveBeenCalled();
    expect(fixture.writes).toHaveLength(1);
    expect(fixture.writes[0]?.tableName).toBe(CONTACTS_TABLE_NAME);
  });

  it('answers 409 when another contact already holds the primary role', async () => {
    const fixture = createFixture();
    fixture.mocks.replaceRoles.mockRejectedValue(
      new PrimaryContactConflictError(CONTACT_ID, new Error('23505')),
    );

    await expect(
      fixture.service.create(
        'customer',
        buildCreateContactInput({ roles: ['primary'] }),
        FACTS,
      ),
    ).rejects.toMatchObject({
      code: 'CUSTOMER_PRIMARY_CONTACT_CONFLICT',
      status: 409,
    });
  });

  it('answers 422 when the login user belongs to another customer', async () => {
    const fixture = createFixture();
    fixture.mocks.create.mockRejectedValue(
      new ContactUserMismatchError(
        'user-of-another-customer',
        new Error('23503'),
      ),
    );

    await expect(
      fixture.service.create('customer', buildCreateContactInput(), FACTS),
    ).rejects.toMatchObject({
      code: 'SEMANTIC_VALIDATION_FAILED',
      status: 422,
      details: [{ path: 'customerUserId' }],
    });
  });

  it('leaves the ledger untouched when the parent is unknown', async () => {
    const fixture = createFixture();
    fixture.mocks.customerExists.mockResolvedValue(false);

    await expect(
      fixture.service.create('missing', buildCreateContactInput(), FACTS),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(fixture.writes).toHaveLength(0);
  });
});

describe('CustomerContactsService — update', () => {
  it('rejects an archived contact as not found', async () => {
    const fixture = createFixture();
    fixture.mocks.findAnyById.mockResolvedValue(
      buildContactRow({ deletedAt: CONTACT_DELETED_AT }),
    );

    await expect(
      fixture.service.update(
        'customer',
        CONTACT_ID,
        buildUpdateContactInput(),
        FACTS,
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('answers 409 STALE_WRITE when the token no longer matches', async () => {
    const fixture = createFixture();

    await expect(
      fixture.service.update(
        'customer',
        CONTACT_ID,
        buildUpdateContactInput({ updatedAt: '2026-01-01T00:00:00.000Z' }),
        FACTS,
      ),
    ).rejects.toMatchObject({ code: 'STALE_WRITE' });
  });

  it('writes nothing when neither a column nor the role set changed', async () => {
    const fixture = createFixture();
    fixture.mocks.findRoles.mockResolvedValue(buildRoleRows(['primary']));

    await fixture.service.update(
      'customer',
      CONTACT_ID,
      buildUpdateContactInput({ position: undefined, roles: ['primary'] }),
      FACTS,
    );

    expect(fixture.mocks.updateById).not.toHaveBeenCalled();
    expect(fixture.mocks.replaceRoles).not.toHaveBeenCalled();
    expect(fixture.writes).toHaveLength(0);
  });

  it('replaces the role set and audits it without touching the row', async () => {
    const fixture = createFixture();
    fixture.mocks.findRoles.mockResolvedValue(buildRoleRows(['primary']));

    await fixture.service.update(
      'customer',
      CONTACT_ID,
      buildUpdateContactInput({ position: undefined, roles: ['technical'] }),
      FACTS,
    );

    expect(fixture.mocks.replaceRoles).toHaveBeenCalledWith(
      expect.anything(),
      CONTACT_ID,
      'customer',
      ['technical'],
    );
    expect(fixture.mocks.updateById).not.toHaveBeenCalled();
    expect(fixture.writes).toHaveLength(1);
    expect(fixture.writes[0]?.tableName).toBe(CONTACT_ROLES_TABLE_NAME);
    expect(fixture.writes[0]?.operation).toBe('update');
    expect(fixture.writes[0]?.before).toMatchObject({ roles: ['primary'] });
    expect(fixture.writes[0]?.after).toMatchObject({ roles: ['technical'] });
  });

  it('writes the column and audits the contact row', async () => {
    const fixture = createFixture();

    await fixture.service.update(
      'customer',
      CONTACT_ID,
      {
        position: 'Ügyvezető helyettes',
        updatedAt: CONTACT_UPDATED_AT.toISOString(),
      },
      FACTS,
    );

    expect(fixture.mocks.updateById).toHaveBeenCalledWith(
      expect.anything(),
      'customer',
      CONTACT_ID,
      { position: 'Ügyvezető helyettes' },
      CONTACT_UPDATED_AT,
    );
    expect(fixture.writes).toHaveLength(1);
    expect(fixture.writes[0]?.tableName).toBe(CONTACTS_TABLE_NAME);
  });

  it('answers 409 when the guarded write matched no row', async () => {
    const fixture = createFixture();
    fixture.mocks.updateById.mockResolvedValue(null);

    await expect(
      fixture.service.update(
        'customer',
        CONTACT_ID,
        { position: 'Új', updatedAt: CONTACT_UPDATED_AT.toISOString() },
        FACTS,
      ),
    ).rejects.toMatchObject({ code: 'STALE_WRITE' });
  });
});

describe('CustomerContactsService — remove', () => {
  it('drops the roles, archives the contact and writes two ledger rows', async () => {
    const fixture = createFixture();

    const result = await fixture.service.remove(
      'customer',
      CONTACT_ID,
      FACTS,
      new Date('2026-11-21T10:00:00.000Z'),
    );

    expect(result).toBeNull();
    expect(fixture.mocks.deleteRoles).toHaveBeenCalledWith(
      expect.anything(),
      CONTACT_ID,
    );
    expect(fixture.mocks.softDeleteById).toHaveBeenCalledWith(
      expect.anything(),
      'customer',
      CONTACT_ID,
      new Date('2026-11-21T10:00:00.000Z'),
    );
    expect(fixture.writes.map((write) => write.tableName)).toEqual([
      CONTACT_ROLES_TABLE_NAME,
      CONTACTS_TABLE_NAME,
    ]);
    expect(fixture.writes[0]?.operation).toBe('delete');
    expect(fixture.writes[1]?.operation).toBe('soft_delete');
  });

  it('still archives a contact that has no roles, with one ledger row', async () => {
    const fixture = createFixture();
    fixture.mocks.findRoles.mockResolvedValue([]);

    await fixture.service.remove('customer', CONTACT_ID, FACTS);

    expect(fixture.writes).toHaveLength(1);
    expect(fixture.writes[0]?.operation).toBe('soft_delete');
  });

  it('answers 404 on a repeat delete', async () => {
    const fixture = createFixture();
    fixture.mocks.findAnyById.mockResolvedValue(
      buildContactRow({ deletedAt: CONTACT_DELETED_AT }),
    );

    await expect(
      fixture.service.remove('customer', CONTACT_ID, FACTS),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(fixture.mocks.deleteRoles).not.toHaveBeenCalled();
  });
});
