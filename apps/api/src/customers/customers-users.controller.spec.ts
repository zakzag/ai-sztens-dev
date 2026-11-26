import type {
  AuditRequestFacts,
  AuditWriteInput,
} from '../audit/audit.interface.js';
import type { AuditWriter } from '../audit/audit-writer.interface.js';
import { ApiResponseService } from '../common/http/api-response.service.js';
import type { RequestContext } from '../common/http/request-context.interface.js';
import { CustomerUsersController } from './customers-users.controller.js';
import { CustomerUsersService } from './customers-users.service.js';
import {
  CUSTOMER_USER_ID,
  USERS_CUSTOMER_ID,
  USER_INVITED_AT,
  buildInviteInput,
  buildUpdateCustomerUserInput,
  createCustomerUsersRepositoryMock,
} from './test/mocks/customers-users.mock.js';

/**
 * Unit tests for the customer-user HTTP layer's delegation **and** its wrapping
 * (AIS-178, slice e).
 *
 * HTTP status codes are covered end-to-end by `test/customer-users.e2e-spec.ts`,
 * where they are observable; here the controller's own three jobs are asserted —
 * `data`/`meta` wrapping, the ids and body reaching the use case, and the audit
 * facts being built from the raw request.
 */

/** Fixed request context, so `meta` assertions need no clock mocking. */
const CTX: RequestContext = {
  requestId: '0192f3c4-0000-4000-8000-000000000007',
  timestamp: '2026-11-23T16:30:00.000Z',
  path: '/api/admin/customers/0d9f3a2e/customer-users',
  method: 'POST',
};

/** The raw request subset the handlers read for the audit facts. */
const REQUEST = {
  headers: { 'user-agent': 'Mozilla/5.0 (users controller spec)' },
  ip: '10.9.8.7',
} as const;

interface ControllerFixture {
  readonly controller: CustomerUsersController;
  readonly writes: AuditWriteInput[];
  readonly facts: readonly AuditRequestFacts[];
}

/**
 * @returns the controller under test plus its recording writer.
 */
function createFixture(): ControllerFixture {
  const mocks = createCustomerUsersRepositoryMock();
  const writes: AuditWriteInput[] = [];
  const facts: AuditRequestFacts[] = [];
  const writer: AuditWriter = {
    write: (input, _tx, requestFacts) => {
      writes.push(input);
      facts.push(requestFacts);
      return Promise.resolve();
    },
  };
  const service = new CustomerUsersService(mocks.repository, writer);

  return {
    controller: new CustomerUsersController(service, new ApiResponseService()),
    writes,
    facts,
  };
}

describe('CustomerUsersController', () => {
  it('wraps the invited user in `data` and the context in `meta`', async () => {
    const fixture = createFixture();

    const result = await fixture.controller.invite(
      USERS_CUSTOMER_ID,
      buildInviteInput(),
      REQUEST,
      CTX,
    );

    expect(result.data.status).toBe('invited');
    expect(result.data.invitedAt).toBe(USER_INVITED_AT.toISOString());
    expect(result.meta).toEqual({
      requestId: CTX.requestId,
      timestamp: CTX.timestamp,
    });
  });

  it('builds the audit facts from the raw request', async () => {
    const fixture = createFixture();

    await fixture.controller.invite(
      USERS_CUSTOMER_ID,
      buildInviteInput(),
      REQUEST,
      CTX,
    );

    expect(fixture.facts[0]).toMatchObject({
      ipAddress: '10.9.8.7',
      userAgent: 'Mozilla/5.0 (users controller spec)',
      requestId: CTX.requestId,
      source: 'admin_api',
    });
  });

  it('passes both ids and the body to the update use case', async () => {
    const fixture = createFixture();

    const result = await fixture.controller.update(
      USERS_CUSTOMER_ID,
      CUSTOMER_USER_ID,
      buildUpdateCustomerUserInput(),
      REQUEST,
      CTX,
    );

    expect(result.data).toMatchObject({
      id: CUSTOMER_USER_ID,
      customerId: USERS_CUSTOMER_ID,
      status: 'active',
    });
    // The controller receives the mapped payload, so the timestamps are ISO
    // strings — not the `Date` values the row fixture carries.
    expect(result.data.updatedAt).toBe(USER_INVITED_AT.toISOString());
    expect(fixture.writes[0]?.operation).toBe('update');
  });

  it('answers a revoke with a null payload', async () => {
    const fixture = createFixture();

    const result = await fixture.controller.remove(
      USERS_CUSTOMER_ID,
      CUSTOMER_USER_ID,
      REQUEST,
      CTX,
    );

    expect(result.data).toBeNull();
    expect(fixture.writes[0]?.operation).toBe('delete');
  });
});
