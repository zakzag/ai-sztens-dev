import {
  CallbackRequestNotFoundError,
  CallbackRequestNotPersistedError,
  InvalidCallbackRequestIdError,
} from './callback-requests.errors.js';
import { DrizzleCallbackRequestsRepository } from './callback-requests.repository.js';
import { callbackRequests } from './schema.js';
import {
  buildCallbackRequestRow,
  buildCreateInput,
  OTHER_CALLBACK_REQUEST_ID,
  VALID_CALLBACK_REQUEST_ID,
} from './test/mocks/callback-requests.mock.js';
import {
  createCallbackRequestsQueryMock,
  type CallbackRequestsQueryMock,
} from './test/mocks/database.mock.js';

/**
 * Unit tests for the Drizzle callback-request repository (AIS-37).
 *
 * Every case runs against the scripted handle from
 * `test/mocks/database.mock.ts`: no Postgres, no connection string, no Docker.
 * What these tests guarantee is the *contract* — which query is issued, what is
 * returned, and how each failure surfaces. That the SQL also runs against a real
 * database is proven separately by `db:migrate` and the AIS-38 e2e suite.
 *
 * The `created_at DESC` direction of `findAll` is asserted structurally (the
 * `orderBy` step is reached, with the right table); the resulting SQL text is
 * covered by the integration run, because comparing Drizzle's internal `SQL`
 * chunk objects would couple these tests to Drizzle's private representation.
 */

describe('DrizzleCallbackRequestsRepository', () => {
  let query: CallbackRequestsQueryMock;
  let repository: DrizzleCallbackRequestsRepository;

  beforeEach(() => {
    query = createCallbackRequestsQueryMock();
    repository = new DrizzleCallbackRequestsRepository(query.db);
  });

  describe('create', () => {
    it('inserts the input into callback_requests and returns the persisted row', async () => {
      const input = buildCreateInput();
      const row = buildCallbackRequestRow();
      query.mockCreateResult([row]);

      await expect(repository.create(input)).resolves.toEqual(row);

      expect(query.insert).toHaveBeenCalledWith(callbackRequests);
      expect(query.insertValues).toHaveBeenCalledWith(input);
      expect(query.insertReturning).toHaveBeenCalledTimes(1);
    });

    it('returns the database-assigned id, status and createdAt, not the input', async () => {
      const row = buildCallbackRequestRow({
        id: OTHER_CALLBACK_REQUEST_ID,
        status: 'dialing',
        createdAt: new Date('2026-10-21T09:30:00.000Z'),
      });
      query.mockCreateResult([row]);

      const created = await repository.create(buildCreateInput());

      expect(created.id).toBe(OTHER_CALLBACK_REQUEST_ID);
      expect(created.status).toBe('dialing');
      expect(created.createdAt).toEqual(new Date('2026-10-21T09:30:00.000Z'));
    });

    it('throws CallbackRequestNotPersistedError when the insert returns no row', async () => {
      query.mockCreateResult([]);

      await expect(
        repository.create(buildCreateInput()),
      ).rejects.toBeInstanceOf(CallbackRequestNotPersistedError);
    });

    it('propagates a transport-level database error unchanged', async () => {
      const failure = new Error('connect ECONNREFUSED 127.0.0.1:5432');
      query.mockInsertFailure(failure);

      await expect(repository.create(buildCreateInput())).rejects.toBe(failure);
    });

    it('propagates a query-level database error unchanged', async () => {
      const failure = new Error(
        'null value in column "email" violates not-null',
      );
      query.mockCreateFailure(failure);

      await expect(repository.create(buildCreateInput())).rejects.toBe(failure);
    });
  });

  describe('findAll', () => {
    it('returns every row the database returned', async () => {
      const rows = [
        buildCallbackRequestRow({ id: OTHER_CALLBACK_REQUEST_ID }),
        buildCallbackRequestRow(),
      ];
      query.mockSelectResult(rows);

      await expect(repository.findAll()).resolves.toEqual(rows);

      expect(query.select).toHaveBeenCalledTimes(1);
      expect(query.selectFrom).toHaveBeenCalledWith(callbackRequests);
      expect(query.selectOrderBy).toHaveBeenCalledTimes(1);
    });

    it('returns an empty array for an empty table', async () => {
      query.mockSelectResult([]);

      await expect(repository.findAll()).resolves.toEqual([]);
    });

    it('does not filter with a where clause', async () => {
      // Guards the contract: findAll must stay an unfiltered listing; filtering
      // arrives with its own explicit method in AIS-38+.
      query.mockSelectResult([]);

      await repository.findAll();

      expect(query.selectWhere).not.toHaveBeenCalled();
      expect(query.selectLimit).not.toHaveBeenCalled();
    });

    it('propagates a database error unchanged', async () => {
      const failure = new Error(
        'relation "callback.callback_requests" does not exist',
      );
      query.mockSelectFailure(failure);

      await expect(repository.findAll()).rejects.toBe(failure);
    });
  });

  describe('findOne', () => {
    it('returns the matching row for a valid id', async () => {
      const row = buildCallbackRequestRow();
      query.mockSelectResult([row]);

      await expect(
        repository.findOne(VALID_CALLBACK_REQUEST_ID),
      ).resolves.toEqual(row);

      expect(query.selectFrom).toHaveBeenCalledWith(callbackRequests);
      expect(query.selectWhere).toHaveBeenCalledTimes(1);
      expect(query.selectLimit).toHaveBeenCalledWith(1);
    });

    it('throws CallbackRequestNotFoundError carrying the id when no row matches', async () => {
      query.mockSelectResult([]);

      const promise = repository.findOne(OTHER_CALLBACK_REQUEST_ID);

      await expect(promise).rejects.toBeInstanceOf(
        CallbackRequestNotFoundError,
      );
      await expect(promise).rejects.toMatchObject({
        id: OTHER_CALLBACK_REQUEST_ID,
        message: `Callback request ${OTHER_CALLBACK_REQUEST_ID} not found`,
      });
    });

    it('throws InvalidCallbackRequestIdError and issues no query for a malformed id', async () => {
      const promise = repository.findOne('missing-id');

      await expect(promise).rejects.toBeInstanceOf(
        InvalidCallbackRequestIdError,
      );
      await expect(promise).rejects.toMatchObject({ value: 'missing-id' });
      expect(query.select).not.toHaveBeenCalled();
    });

    it('rejects the empty id without touching the database', async () => {
      await expect(repository.findOne('')).rejects.toBeInstanceOf(
        InvalidCallbackRequestIdError,
      );
      expect(query.select).not.toHaveBeenCalled();
    });

    it('propagates a database error unchanged', async () => {
      const failure = new Error(
        'terminating connection due to administrator command',
      );
      query.mockSelectFailure(failure);

      await expect(repository.findOne(VALID_CALLBACK_REQUEST_ID)).rejects.toBe(
        failure,
      );
    });
  });
});
