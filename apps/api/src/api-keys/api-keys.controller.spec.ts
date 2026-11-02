import { jest } from '@jest/globals';
import type { ApiKeyRow, NewApiKeyRow } from '../db/schema.js';
import { ApiResponseService } from '../common/http/api-response.service.js';
import type { RequestContext } from '../common/http/request-context.interface.js';
import { ApiKeysController } from './api-keys.controller.js';
import { ApiKeysService } from './api-keys.service.js';
import type {
  ApiKeyPage,
  ApiKeysRepository,
} from './api-keys.repository.interface.js';
import {
  buildApiKeyResponse,
  buildApiKeyRow,
  buildCreateApiKeyInput,
  buildListQuery,
} from './test/mocks/api-keys.mock.js';

/**
 * Unit tests for the HTTP layer's delegation **and** its wrapping.
 *
 * The controller is built over a real `ApiKeysService` (repository mocked) and a
 * real `ApiResponseService`, so the suite proves the two things the controller
 * owns: the request context ends up in `meta`, and the payload ends up in
 * `data`. HTTP status codes are covered end-to-end by
 * `test/api-keys.e2e-spec.ts`, where they are observable.
 */

/** Fixed request context, so `meta` assertions need no clock mocking. */
const CTX: RequestContext = {
  requestId: '0192f3c4-0000-4000-8000-000000000001',
  timestamp: '2026-10-27T10:00:00.000Z',
  path: '/api/api-keys',
  method: 'GET',
};

interface ControllerFixture {
  readonly controller: ApiKeysController;
  readonly create: jest.Mock<(input: NewApiKeyRow) => Promise<ApiKeyRow>>;
  readonly findPage: jest.Mock<(query: unknown) => Promise<ApiKeyPage>>;
  readonly findByIdentifier: jest.Mock<
    (identifier: string) => Promise<ApiKeyRow | null>
  >;
}

function createFixture(): ControllerFixture {
  const create = jest.fn<(input: NewApiKeyRow) => Promise<ApiKeyRow>>();
  const findPage = jest.fn<(query: unknown) => Promise<ApiKeyPage>>();
  const findByIdentifier =
    jest.fn<(identifier: string) => Promise<ApiKeyRow | null>>();

  const repository: ApiKeysRepository = { create, findPage, findByIdentifier };
  const service = new ApiKeysService(repository);

  return {
    controller: new ApiKeysController(service, new ApiResponseService()),
    create,
    findPage,
    findByIdentifier,
  };
}

describe('ApiKeysController', () => {
  it('wraps the page in `data` and the paging block in `meta.pagination`', async () => {
    const fixture = createFixture();
    fixture.findPage.mockResolvedValue({
      rows: [
        buildApiKeyRow({ identifier: 'one' }),
        buildApiKeyRow({ identifier: 'two' }),
      ],
      total: 12,
    });

    const result = await fixture.controller.list(
      buildListQuery({ page: 2, limit: 10 }),
      CTX,
    );

    expect(result.data?.map((item) => item.identifier)).toEqual(['one', 'two']);
    expect(result.meta).toEqual({
      requestId: CTX.requestId,
      timestamp: CTX.timestamp,
      pagination: { page: 2, limit: 10, total: 12, totalPages: 2 },
    });
  });

  it('passes the validated query through to the service', async () => {
    const fixture = createFixture();
    fixture.findPage.mockResolvedValue({ rows: [], total: 0 });
    const query = buildListQuery({ sort: 'name', order: 'asc', q: 'vapi' });

    await fixture.controller.list(query, CTX);

    expect(fixture.findPage).toHaveBeenCalledWith(query);
  });

  it('returns an empty page as `data: []`, never null', async () => {
    const fixture = createFixture();
    fixture.findPage.mockResolvedValue({ rows: [], total: 0 });

    const result = await fixture.controller.list(buildListQuery(), CTX);

    expect(result.data).toEqual([]);
    expect(result.meta.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
  });

  it('passes the path parameter through to the lookup and wraps the result', async () => {
    const fixture = createFixture();
    fixture.findByIdentifier.mockResolvedValue(buildApiKeyRow());

    const result = await fixture.controller.findByIdentifier('vapi-prod', CTX);

    expect(fixture.findByIdentifier).toHaveBeenCalledWith('vapi-prod');
    expect(result.data).toEqual(buildApiKeyResponse());
    expect(result.meta.requestId).toBe(CTX.requestId);
  });

  it('maps the validated body into the repository payload and wraps the created row', async () => {
    const fixture = createFixture();
    fixture.create.mockResolvedValue(buildApiKeyRow());

    const result = await fixture.controller.create(
      buildCreateApiKeyInput(),
      CTX,
    );

    expect(fixture.create).toHaveBeenCalledTimes(1);
    expect(fixture.create.mock.calls[0]?.[0]).toMatchObject({
      identifier: 'vapi-prod',
      name: 'Vapi prod',
      apiKey: 'tok_123',
    });
    expect(result.data).toEqual(buildApiKeyResponse());
  });

  it('lets the service error bubble up (the filter wraps it, not the controller)', async () => {
    const fixture = createFixture();
    const driverError = new Error('boom');
    fixture.findByIdentifier.mockRejectedValue(driverError);

    await expect(
      fixture.controller.findByIdentifier('vapi-prod', CTX),
    ).rejects.toBe(driverError);
  });
});
