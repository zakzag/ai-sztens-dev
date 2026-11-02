import { jest } from '@jest/globals';
import { API_ERROR_CODE } from '@callback/shared';
import type { ApiKeyRow, NewApiKeyRow } from '../db/schema.js';
import {
  ConflictAppError,
  NotFoundAppError,
} from '../common/http/app-error.js';
import { ApiKeyIdentifierConflictError } from './api-keys.errors.js';
import { ApiKeysService } from './api-keys.service.js';
import type {
  ApiKeyPage,
  ApiKeysRepository,
} from './api-keys.repository.interface.js';
import {
  API_KEY_CREATED_AT,
  API_KEY_EXPIRES_AT,
  buildApiKeyResponse,
  buildApiKeyRow,
  buildCreateApiKeyInput,
  buildListQuery,
} from './test/mocks/api-keys.mock.js';

/**
 * Unit tests for the service layer.
 *
 * The repository is a plain object mock (the service depends on the
 * `ApiKeysRepository` interface), so no Nest container and no database is
 * involved. What is verified here is exactly the orchestration: the payload that
 * reaches the repository, the **AppError** translation (code + status + field
 * details, never an HTTP exception), and the response mapping.
 */

interface RepositoryMock {
  readonly repository: ApiKeysRepository;
  readonly create: jest.Mock<(input: NewApiKeyRow) => Promise<ApiKeyRow>>;
  readonly findPage: jest.Mock<(query: unknown) => Promise<ApiKeyPage>>;
  readonly findByIdentifier: jest.Mock<
    (identifier: string) => Promise<ApiKeyRow | null>
  >;
}

function createRepositoryMock(): RepositoryMock {
  const create = jest.fn<(input: NewApiKeyRow) => Promise<ApiKeyRow>>();
  const findPage = jest.fn<(query: unknown) => Promise<ApiKeyPage>>();
  const findByIdentifier =
    jest.fn<(identifier: string) => Promise<ApiKeyRow | null>>();

  return {
    repository: { create, findPage, findByIdentifier },
    create,
    findPage,
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

    it('translates an identifier conflict into the domain-specific 409 code', async () => {
      const mocks = createRepositoryMock();
      mocks.create.mockRejectedValue(
        new ApiKeyIdentifierConflictError('vapi-prod', new Error('23505')),
      );
      const service = new ApiKeysService(mocks.repository);

      const error = await service
        .create(buildCreateApiKeyInput())
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ConflictAppError);
      expect(error).toMatchObject({
        code: API_ERROR_CODE.API_KEY_IDENTIFIER_CONFLICT,
        status: 409,
      });
      expect((error as ConflictAppError).details).toEqual([
        { path: 'identifier', message: 'This identifier is already taken.' },
      ]);
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
    it('forwards the query and maps the rows of the page', async () => {
      const mocks = createRepositoryMock();
      mocks.findPage.mockResolvedValue({
        rows: [
          buildApiKeyRow({ identifier: 'newer' }),
          buildApiKeyRow({ identifier: 'older' }),
        ],
        total: 2,
      });
      const service = new ApiKeysService(mocks.repository);

      const query = buildListQuery({ page: 1, limit: 20, sort: 'name' });
      const result = await service.list(query);

      expect(mocks.findPage).toHaveBeenCalledWith(query);
      expect(result.items.map((item) => item.identifier)).toEqual([
        'newer',
        'older',
      ]);
    });

    it('turns the total into `meta.pagination` for the current page', async () => {
      const mocks = createRepositoryMock();
      mocks.findPage.mockResolvedValue({ rows: [], total: 42 });
      const service = new ApiKeysService(mocks.repository);

      const result = await service.list(buildListQuery({ page: 3, limit: 10 }));

      expect(result.pagination).toEqual({
        page: 3,
        limit: 10,
        total: 42,
        totalPages: 5,
      });
    });

    it('answers an empty page as `items: []` with a zero total', async () => {
      const mocks = createRepositoryMock();
      mocks.findPage.mockResolvedValue({ rows: [], total: 0 });
      const service = new ApiKeysService(mocks.repository);

      await expect(service.list(buildListQuery())).resolves.toEqual({
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
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

    it('translates a missing row into a NOT_FOUND AppError', async () => {
      const mocks = createRepositoryMock();
      mocks.findByIdentifier.mockResolvedValue(null);
      const service = new ApiKeysService(mocks.repository);

      const error = await service
        .findByIdentifier('nope')
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(NotFoundAppError);
      expect(error).toMatchObject({
        code: API_ERROR_CODE.NOT_FOUND,
        status: 404,
      });
    });
  });
});
