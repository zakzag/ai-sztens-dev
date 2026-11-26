import type {
  AuditRequestFacts,
  AuditWriteInput,
} from '../audit/audit.interface.js';
import type { AuditWriter } from '../audit/audit-writer.interface.js';
import { CUSTOMER_USERS_TABLE_NAME } from './customers-users.const.js';
import {
  CustomerOwnerConflictError,
  CustomerUserEmailConflictError,
  CustomerUserInUseError,
} from './customers-users.errors.js';
import { CustomerUsersService } from './customers-users.service.js';
import {
  CUSTOMER_USER_ID,
  USERS_CUSTOMER_ID,
  USER_INVITED_AT,
  buildCustomerUserRowFixture,
  buildInviteInput,
  buildUpdateCustomerUserInput,
  createCustomerUsersRepositoryMock,
} from './test/mocks/customers-users.mock.js';

/**
 * Unit tests of the customer-user orchestration (AIS-178, slice e).
 *
 * The rules worth protecting live here, not in SQL: the invitation state is
 * server-written, only a pending invitation may be revoked, an empty patch is a
 * no-op, and the three domain failures become the three `409` codes. All of it is
 * asserted with a plain repository double and a recording writer.
 */

/** Fixed request facts, so the assertions need no header parsing. */
const FACTS: AuditRequestFacts = {
  ipAddress: '10.9.8.7',
  userAgent: 'users-service-spec',
  requestId: '0192f3c4-0000-4000-8000-000000000006',
  source: 'admin_api',
};

interface ServiceFixture {
  readonly service: CustomerUsersService;
  readonly mocks: ReturnType<typeof createCustomerUsersRepositoryMock>;
  readonly writes: AuditWriteInput[];
}

/**
 * @returns the service under test plus its doubles.
 */
function createFixture(): ServiceFixture {
  const mocks = createCustomerUsersRepositoryMock();
  const writes: AuditWriteInput[] = [];
  const writer: AuditWriter = {
    write: (input) => {
      writes.push(input);
      return Promise.resolve();
    },
  };

  return {
    service: new CustomerUsersService(mocks.repository, writer),
    mocks,
    writes,
  };
}

describe('CustomerUsersService — invite', () => {
  it('rejects an unknown customer before writing anything', async () => {
    const fixture = createFixture();
    fixture.mocks.customerExists.mockResolvedValue(false);

    await expect(
      fixture.service.invite(USERS_CUSTOMER_ID, buildInviteInput(), FACTS),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(fixture.mocks.insert).not.toHaveBeenCalled();
  });

  it('writes the invitation and exactly one ledger row', async () => {
    const fixture = createFixture();

    const created = await fixture.service.invite(
      USERS_CUSTOMER_ID,
      buildInviteInput(),
      FACTS,
      USER_INVITED_AT,
    );

    expect(created.status).toBe('invited');
    expect(fixture.mocks.insert).toHaveBeenCalledTimes(1);
    expect(fixture.writes).toHaveLength(1);
    expect(fixture.writes[0]).toMatchObject({
      tableName: CUSTOMER_USERS_TABLE_NAME,
      operation: 'insert',
      recordId: CUSTOMER_USER_ID,
      before: null,
    });
  });

  it('stamps the invitation instant and leaves the operation to the server', async () => {
    const fixture = createFixture();

    await fixture.service.invite(
      USERS_CUSTOMER_ID,
      buildInviteInput({ role: 'admin' }),
      FACTS,
      USER_INVITED_AT,
    );

    const payload = fixture.mocks.insert.mock.calls[0]?.[1];

    expect(payload).toMatchObject({
      status: 'invited',
      invitedAt: USER_INVITED_AT,
      invitedByOperatorId: null,
      passwordHash: null,
      role: 'admin',
    });
  });

  it('maps a duplicate e-mail to its own 409 code', async () => {
    const fixture = createFixture();
    fixture.mocks.insert.mockRejectedValue(
      new CustomerUserEmailConflictError('peter.kiss@pelda.hu', new Error()),
    );

    await expect(
      fixture.service.invite(USERS_CUSTOMER_ID, buildInviteInput(), FACTS),
    ).rejects.toMatchObject({
      code: 'CUSTOMER_USER_EMAIL_CONFLICT',
      details: [{ path: 'email' }],
    });
  });

  it('rethrows an unrelated failure untouched', async () => {
    const fixture = createFixture();
    const driverError = new Error('connection terminated');
    fixture.mocks.insert.mockRejectedValue(driverError);

    await expect(
      fixture.service.invite(USERS_CUSTOMER_ID, buildInviteInput(), FACTS),
    ).rejects.toBe(driverError);
  });
});

describe('CustomerUsersService — update', () => {
  it('rejects an unknown user with 404', async () => {
    const fixture = createFixture();
    fixture.mocks.findById.mockResolvedValue(null);

    await expect(
      fixture.service.update(
        USERS_CUSTOMER_ID,
        CUSTOMER_USER_ID,
        buildUpdateCustomerUserInput(),
        FACTS,
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects a stale token with 409 STALE_WRITE', async () => {
    const fixture = createFixture();

    await expect(
      fixture.service.update(
        USERS_CUSTOMER_ID,
        CUSTOMER_USER_ID,
        buildUpdateCustomerUserInput({
          updatedAt: '2026-11-01T00:00:00.000Z',
        }),
        FACTS,
      ),
    ).rejects.toMatchObject({ code: 'STALE_WRITE' });
    expect(fixture.mocks.updateById).not.toHaveBeenCalled();
  });

  it('treats a token-only patch as a no-op: no write, no ledger row', async () => {
    const fixture = createFixture();

    const result = await fixture.service.update(
      USERS_CUSTOMER_ID,
      CUSTOMER_USER_ID,
      { updatedAt: USER_INVITED_AT.toISOString() },
      FACTS,
    );

    expect(result.status).toBe('invited');
    expect(fixture.mocks.updateById).not.toHaveBeenCalled();
    expect(fixture.writes).toHaveLength(0);
  });

  it('writes the patch and records the changed keys', async () => {
    const fixture = createFixture();

    const result = await fixture.service.update(
      USERS_CUSTOMER_ID,
      CUSTOMER_USER_ID,
      buildUpdateCustomerUserInput(),
      FACTS,
    );

    expect(result.status).toBe('active');
    expect(fixture.writes).toHaveLength(1);
    expect(fixture.writes[0]).toMatchObject({
      tableName: CUSTOMER_USERS_TABLE_NAME,
      operation: 'update',
      recordId: CUSTOMER_USER_ID,
    });
  });

  it('maps a lost guarded update to 409 STALE_WRITE', async () => {
    const fixture = createFixture();
    fixture.mocks.updateById.mockResolvedValue(null);

    await expect(
      fixture.service.update(
        USERS_CUSTOMER_ID,
        CUSTOMER_USER_ID,
        buildUpdateCustomerUserInput(),
        FACTS,
      ),
    ).rejects.toMatchObject({ code: 'STALE_WRITE' });
  });

  it('maps the owner index to its own 409 code', async () => {
    const fixture = createFixture();
    fixture.mocks.updateById.mockRejectedValue(
      new CustomerOwnerConflictError(USERS_CUSTOMER_ID, new Error()),
    );

    await expect(
      fixture.service.update(
        USERS_CUSTOMER_ID,
        CUSTOMER_USER_ID,
        buildUpdateCustomerUserInput({ role: 'owner' }),
        FACTS,
      ),
    ).rejects.toMatchObject({
      code: 'CUSTOMER_OWNER_CONFLICT',
      details: [{ path: 'role' }],
    });
  });
});

describe('CustomerUsersService — remove', () => {
  it('revokes a pending invitation and records it', async () => {
    const fixture = createFixture();

    await expect(
      fixture.service.remove(USERS_CUSTOMER_ID, CUSTOMER_USER_ID, FACTS),
    ).resolves.toBeNull();
    expect(fixture.writes).toHaveLength(1);
    expect(fixture.writes[0]).toMatchObject({
      tableName: CUSTOMER_USERS_TABLE_NAME,
      operation: 'delete',
      recordId: CUSTOMER_USER_ID,
      after: null,
    });
  });

  it('refuses to delete an activated user with 422 and audits nothing', async () => {
    const fixture = createFixture();
    fixture.mocks.findById.mockResolvedValue(
      buildCustomerUserRowFixture({ status: 'active' }),
    );

    await expect(
      fixture.service.remove(USERS_CUSTOMER_ID, CUSTOMER_USER_ID, FACTS),
    ).rejects.toMatchObject({
      code: 'SEMANTIC_VALIDATION_FAILED',
      details: [{ path: 'status' }],
    });
    expect(fixture.mocks.deleteById).not.toHaveBeenCalled();
    expect(fixture.writes).toHaveLength(0);
  });

  it('maps a still-referenced user to its own 409 code', async () => {
    const fixture = createFixture();
    fixture.mocks.deleteById.mockRejectedValue(
      new CustomerUserInUseError(CUSTOMER_USER_ID, new Error()),
    );

    await expect(
      fixture.service.remove(USERS_CUSTOMER_ID, CUSTOMER_USER_ID, FACTS),
    ).rejects.toMatchObject({
      code: 'CUSTOMER_USER_IN_USE_CONFLICT',
      details: [{ path: 'id' }],
    });
  });

  it('answers 404 when the row disappeared between the read and the delete', async () => {
    const fixture = createFixture();
    fixture.mocks.deleteById.mockResolvedValue(null);

    await expect(
      fixture.service.remove(USERS_CUSTOMER_ID, CUSTOMER_USER_ID, FACTS),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(fixture.writes).toHaveLength(0);
  });
});
