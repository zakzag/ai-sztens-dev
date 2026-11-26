import type {
  AuditRequestFacts,
  AuditWriteInput,
} from '../audit/audit.interface.js';
import type { AuditWriter } from '../audit/audit-writer.interface.js';
import { ApiResponseService } from '../common/http/api-response.service.js';
import type { RequestContext } from '../common/http/request-context.interface.js';
import { CustomerTagsController } from './customers-tags.controller.js';
import { CustomerTagsService } from './customers-tags.service.js';
import {
  TAG_ID,
  TAGS_CUSTOMER_ID,
  buildCreateTagInput,
  buildTagRow,
  createCustomerTagsRepositoryMock,
} from './test/mocks/customers-tags.mock.js';

/**
 * Unit tests for the tag HTTP layer's delegation **and** its wrapping
 * (AIS-178, slice e).
 *
 * The controller is built over a real service (repository doubled) and a real
 * `ApiResponseService`, so the suite proves what the controller owns: the context
 * ends up in `meta`, the payload in `data`, and the audit facts are built from the
 * raw request. HTTP status codes are covered end-to-end by
 * `test/customer-tags.e2e-spec.ts`, where they are observable.
 */

/** Fixed request context, so `meta` assertions need no clock mocking. */
const CTX: RequestContext = {
  requestId: '0192f3c4-0000-4000-8000-000000000005',
  timestamp: '2026-11-23T16:00:00.000Z',
  path: '/api/admin/customers/0d9f3a2e/tags',
  method: 'POST',
};

/** The raw request subset the handlers read for the audit facts. */
const REQUEST = {
  headers: { 'user-agent': 'Mozilla/5.0 (tags controller spec)' },
  ip: '10.9.8.7',
} as const;

interface ControllerFixture {
  readonly controller: CustomerTagsController;
  readonly writes: AuditWriteInput[];
  readonly facts: readonly AuditRequestFacts[];
}

/**
 * @returns the controller under test plus its recording writer.
 */
function createFixture(): ControllerFixture {
  const mocks = createCustomerTagsRepositoryMock();
  const writes: AuditWriteInput[] = [];
  const facts: AuditRequestFacts[] = [];
  const writer: AuditWriter = {
    write: (input, _tx, requestFacts) => {
      writes.push(input);
      facts.push(requestFacts);
      return Promise.resolve();
    },
  };
  const service = new CustomerTagsService(mocks.repository, writer);

  return {
    controller: new CustomerTagsController(service, new ApiResponseService()),
    writes,
    facts,
  };
}

describe('CustomerTagsController', () => {
  it('wraps the tag in `data` and the context in `meta`', async () => {
    const fixture = createFixture();

    const result = await fixture.controller.create(
      TAGS_CUSTOMER_ID,
      buildCreateTagInput(),
      REQUEST,
      CTX,
    );

    expect(result.data).toEqual(buildTagRow());
    expect(result.meta).toEqual({
      requestId: CTX.requestId,
      timestamp: CTX.timestamp,
    });
  });

  it('builds the audit facts from the raw request', async () => {
    const fixture = createFixture();

    await fixture.controller.create(
      TAGS_CUSTOMER_ID,
      buildCreateTagInput(),
      REQUEST,
      CTX,
    );

    expect(fixture.facts[0]).toMatchObject({
      ipAddress: '10.9.8.7',
      userAgent: 'Mozilla/5.0 (tags controller spec)',
      requestId: CTX.requestId,
      source: 'admin_api',
    });
  });

  it('passes the body tag id to the attach use case', async () => {
    const fixture = createFixture();

    const result = await fixture.controller.attach(
      TAGS_CUSTOMER_ID,
      { tagId: TAG_ID },
      REQUEST,
      CTX,
    );

    expect(result.data.id).toBe(TAG_ID);
    expect(fixture.writes[0]?.tableName).toBe('customer_tags');
  });

  it('answers a detach with a null payload', async () => {
    const fixture = createFixture();

    const result = await fixture.controller.detach(
      TAGS_CUSTOMER_ID,
      TAG_ID,
      REQUEST,
      CTX,
    );

    expect(result.data).toBeNull();
    expect(fixture.writes[0]?.operation).toBe('delete');
  });
});
