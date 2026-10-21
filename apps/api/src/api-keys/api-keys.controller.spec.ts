import { plainToInstance } from 'class-transformer';
import { jest } from '@jest/globals';
import type { ApiKeyRow, NewApiKeyRow } from '../db/schema.js';
import { ApiKeysController } from './api-keys.controller.js';
import { ApiKeysService } from './api-keys.service.js';
import type { ApiKeysRepository } from './api-keys.repository.interface.js';
import { CreateApiKeyDto } from './dto/create-api-key.dto.js';
import {
  buildApiKeyResponse,
  buildApiKeyRow,
  buildCreateApiKeyInput,
} from './test/mocks/api-keys.mock.js';

/**
 * Unit tests for the HTTP layer's delegation.
 *
 * The controller is built over a real `ApiKeysService` whose repository is
 * mocked, so the test proves the wiring *and* the throughput of the request
 * body — without a Nest container.
 *
 * HTTP status codes are intentionally **not** asserted here (they would require
 * poking Nest's metadata keys): `POST` → 201, `GET` → 200, duplicate → 409 and
 * validation → 400 are covered end-to-end by `test/api-keys.e2e-spec.ts`, where
 * they are actually observable.
 */

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
    controller: new ApiKeysController(service),
    create,
    findAll,
    findByIdentifier,
  };
}

describe('ApiKeysController', () => {
  it('returns the service list result unchanged', async () => {
    const fixture = createFixture();
    fixture.findAll.mockResolvedValue([
      buildApiKeyRow({ identifier: 'one' }),
      buildApiKeyRow({ identifier: 'two' }),
    ]);

    const result = await fixture.controller.list();

    expect(result.map((item) => item.identifier)).toEqual(['one', 'two']);
  });

  it('passes the path parameter through to the lookup', async () => {
    const fixture = createFixture();
    fixture.findByIdentifier.mockResolvedValue(buildApiKeyRow());

    const result = await fixture.controller.findByIdentifier('vapi-prod');

    expect(fixture.findByIdentifier).toHaveBeenCalledWith('vapi-prod');
    expect(result).toEqual(buildApiKeyResponse());
  });

  it('maps the validated body into the repository payload and returns the response', async () => {
    const fixture = createFixture();
    fixture.create.mockResolvedValue(buildApiKeyRow());
    const payload: Record<string, unknown> = { ...buildCreateApiKeyInput() };
    const dto = plainToInstance(CreateApiKeyDto, payload);

    const result = await fixture.controller.create(dto);

    expect(fixture.create).toHaveBeenCalledTimes(1);
    expect(fixture.create.mock.calls[0]?.[0]).toMatchObject({
      identifier: 'vapi-prod',
      name: 'Vapi prod',
      apiKey: 'tok_123',
    });
    expect(result).toEqual(buildApiKeyResponse());
  });

  it('lets the service exception bubble up (no swallowing in the controller)', async () => {
    const fixture = createFixture();
    const driverError = new Error('boom');
    fixture.findByIdentifier.mockRejectedValue(driverError);

    await expect(fixture.controller.findByIdentifier('vapi-prod')).rejects.toBe(
      driverError,
    );
  });
});
