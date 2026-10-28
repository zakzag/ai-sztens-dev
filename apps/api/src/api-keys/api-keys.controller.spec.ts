import { jest } from '@jest/globals';
import type { ApiKeyRow, NewApiKeyRow } from '../db/schema.js';
import { ApiResponseService } from '../common/http/api-response.service.js';
import type { RequestContext } from '../common/http/request-context.interface.js';
import { ApiKeysController } from './api-keys.controller.js';
import { ApiKeysService } from './api-keys.service.js';
import type { ApiKeysRepository } from './api-keys.repository.interface.js';
import {
  buildApiKeyResponse,
  buildApiKeyRow,
  buildCreateApiKeyInput,
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
  readonly findAll: jest.Mock<() => Promise<ApiKeyRow[]>>;
  readonly findByIdentifier: jest.Mock<
    (identifier: string) => Promise<ApiKeyRow | null>
  >;
}

function createFixture(): ControllerFixture {
  const create = jest.fn<(input: NewApiKeyRow) => Promise<ApiKeyRow>>();
  const findAll = jest.fn<() => Promise<ApiKeyRow[]>>();
  const findByIdentifier =
    jest.fn<(identifier: string) => Promise<ApiKeyRow | null>>();

  const repository: ApiKeysRepository = { create, findAll, findByIdentifier };
  const service = new ApiKeysService(repository);

  return {
    controller: new ApiKeysController(service, new ApiResponseService()),
    create,
    findAll,
    findByIdentifier,
  };
}

describe('ApiKeysController', () => {
  it('wraps the list in `data` and echoes the request context in `meta`', async () => {
    const fixture = createFixture();
    fixture.findAll.mockResolvedValue([
      buildApiKeyRow({ identifier: 'one' }),
      buildApiKeyRow({ identifier: 'two' }),
    ]);

    const result = await fixture.controller.list(CTX);

    expect(result.data?.map((item) => item.identifier)).toEqual(['one', 'two']);
    expect(result.meta).toEqual({
      requestId: CTX.requestId,
      timestamp: CTX.timestamp,
    });
  });

  it('returns an empty list as `data: []`, never null', async () => {
    const fixture = createFixture();
    fixture.findAll.mockResolvedValue([]);

    const result = await fixture.controller.list(CTX);

    expect(result.data).toEqual([]);
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
