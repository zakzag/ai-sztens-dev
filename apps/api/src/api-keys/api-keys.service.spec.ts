import { ConflictException, NotFoundException } from '@nestjs/common';
import { jest } from '@jest/globals';
import type { ApiKeyRow, NewApiKeyRow } from '../db/schema.js';
import { ApiKeyIdentifierConflictError } from './api-keys.errors.js';
import { ApiKeysService } from './api-keys.service.js';
import type { ApiKeysRepository } from './api-keys.repository.interface.js';
import {
  API_KEY_CREATED_AT,
  API_KEY_EXPIRES_AT,
  buildApiKeyResponse,
  buildApiKeyRow,
  buildCreateApiKeyInput,
} from './test/mocks/api-keys.mock.js';

/**
 * Unit tests for the service layer.
 *
 * The repository is a plain object mock (the service depends on the
 * `ApiKeysRepository` interface), so no Nest container and no database is
 * involved. What is verified here is exactly the orchestration: the payload that
 * reaches the repository, the HTTP exception translation, and the response
 * mapping.
 */

interface RepositoryMock {
  readonly repository: ApiKeysRepository;
  readonly create: jest.Mock<(input: NewApiKeyRow) => Promise<ApiKeyRow>>;
  readonly findAll: jest.Mock<() => Promise<ApiKeyRow[]>>;
  readonly findByIdentifier: jest.Mock<
    (identifier: string) => Promise<ApiKeyRow | null>
  >;
}

function createRepositoryMock(): RepositoryMock {
  const create = jest.fn<(input: NewApiKeyRow) => Promise<ApiKeyRow>>();
  const findAll = jest.fn<() => Promise<ApiKeyRow[]>>();
  const findByIdentifier =
    jest.fn<(identifier: string) => Promise<ApiKeyRow | null>>();

  return {
    repository: { create, findAll, findByIdentifier },
    create,
    findAll,
    findByIdentifier,
  };
}

describe('ApiKeysService', () => {
  describe('create', () => {
    it('passes the mapped row to the repository and returns the wire shape', async () => {
      const mocks = createRepositoryMock();
      const row = buildApiKeyRow();
      mocks.create.mockResolvedValue(row);
      const service = new ApiKeysService(mocks.repository);

      const result = await service.create(buildCreateApiKeyInput());

      expect(mocks.create).toHaveBeenCalledTimes(1);

      const passedRow = mocks.create.mock.calls[0]?.[0];
      expect(passedRow).toMatchObject({
        name: 'Vapi prod',
        identifier: 'vapi-prod',
        description: 'primary',
        apiKey: 'tok_123',
      });
      expect(passedRow?.expiresAt?.toISOString()).toBe(
        API_KEY_EXPIRES_AT.toISOString(),
      );

      expect(result).toEqual(buildApiKeyResponse());
      expect(result.createdAt).toBe(API_KEY_CREATED_AT.toISOString());
    });

    it('stores null for an omitted description and expiry', async () => {
      const mocks = createRepositoryMock();
      mocks.create.mockResolvedValue(
        buildApiKeyRow({ description: null, expiresAt: null }),
      );
      const service = new ApiKeysService(mocks.repository);

      const result = await service.create(
        buildCreateApiKeyInput({
          description: undefined,
          expiresAt: undefined,
        }),
      );

      const passedRow = mocks.create.mock.calls[0]?.[0];
      expect(passedRow?.description).toBeNull();
      expect(passedRow?.expiresAt).toBeNull();
      expect(result.description).toBeNull();
      expect(result.expiresAt).toBeNull();
    });

    it('translates an identifier conflict into a 409 ConflictException', async () => {
      const mocks = createRepositoryMock();
      mocks.create.mockRejectedValue(
        new ApiKeyIdentifierConflictError('vapi-prod', new Error('23505')),
      );
      const service = new ApiKeysService(mocks.repository);

      await expect(
        service.create(buildCreateApiKeyInput()),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('propagates any other repository error unchanged', async () => {
      const mocks = createRepositoryMock();
      const driverError = new Error('connection terminated');
      mocks.create.mockRejectedValue(driverError);
      const service = new ApiKeysService(mocks.repository);

      await expect(service.create(buildCreateApiKeyInput())).rejects.toBe(
        driverError,
      );
    });
  });

  describe('list', () => {
    it('maps every row and preserves the repository order', async () => {
      const mocks = createRepositoryMock();
      mocks.findAll.mockResolvedValue([
        buildApiKeyRow({ identifier: 'newer' }),
        buildApiKeyRow({ identifier: 'older' }),
      ]);
      const service = new ApiKeysService(mocks.repository);

      const result = await service.list();

      expect(result.map((item) => item.identifier)).toEqual(['newer', 'older']);
    });

    it('returns an empty array when there are no rows', async () => {
      const mocks = createRepositoryMock();
      mocks.findAll.mockResolvedValue([]);
      const service = new ApiKeysService(mocks.repository);

      await expect(service.list()).resolves.toEqual([]);
    });
  });

  describe('findByIdentifier', () => {
    it('returns the mapped row when found', async () => {
      const mocks = createRepositoryMock();
      mocks.findByIdentifier.mockResolvedValue(buildApiKeyRow());
      const service = new ApiKeysService(mocks.repository);

      const result = await service.findByIdentifier('vapi-prod');

      expect(mocks.findByIdentifier).toHaveBeenCalledWith('vapi-prod');
      expect(result).toEqual(buildApiKeyResponse());
    });

    it('translates a missing row into a 404 NotFoundException', async () => {
      const mocks = createRepositoryMock();
      mocks.findByIdentifier.mockResolvedValue(null);
      const service = new ApiKeysService(mocks.repository);

      await expect(service.findByIdentifier('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
