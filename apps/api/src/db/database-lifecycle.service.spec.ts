import { jest } from '@jest/globals';
import { DatabaseLifecycleService } from './database-lifecycle.service.js';
import { createSqlClientMock } from './test/mocks/postgres.mock.js';

describe('DatabaseLifecycleService', () => {
  it('closes the client once with a hard timeout', async () => {
    const sql = createSqlClientMock();
    const service = new DatabaseLifecycleService(sql.client);

    await service.onApplicationShutdown();

    expect(sql.end).toHaveBeenCalledTimes(1);
    expect(sql.end).toHaveBeenCalledWith({ timeout: 5 });
  });

  it('is idempotent: a second shutdown does not close again', async () => {
    const sql = createSqlClientMock();
    const service = new DatabaseLifecycleService(sql.client);

    await service.onApplicationShutdown();
    await service.onApplicationShutdown();

    expect(sql.end).toHaveBeenCalledTimes(1);
  });

  it('swallows a failing close so SIGTERM never looks like a crash', async () => {
    const sql = createSqlClientMock('reject');
    const service = new DatabaseLifecycleService(sql.client);

    await expect(service.onApplicationShutdown()).resolves.toBeUndefined();
    expect(sql.end).toHaveBeenCalledTimes(1);
  });

  it('logs a non-Error rejection without throwing', async () => {
    // Deliberately rejecting with a string: the service must stringify it.
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    const end = jest.fn<() => Promise<void>>(() => Promise.reject('boom'));
    const client = Object.assign(jest.fn(), {
      end,
      options: { parsers: {}, serializers: {} },
    }) as unknown as ConstructorParameters<typeof DatabaseLifecycleService>[0];

    const service = new DatabaseLifecycleService(client);

    await expect(service.onApplicationShutdown()).resolves.toBeUndefined();
  });
});
