import { jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import { DatabaseLifecycleService } from './database-lifecycle.service.js';
import { createSqlClientMock } from './test/mocks/postgres.mock.js';

/**
 * The failure paths below log on purpose (`Logger.error`), and the global Jest
 * setup installs Nest's `NoopLogger`, so the console stays quiet. Instead of
 * losing that signal, every error branch asserts the log call itself: the
 * message that used to be noise is now covered behaviour.
 */

/**
 * Captures the messages a logger method is called with.
 *
 * A local recorder is used instead of asserting on the spy object, so the
 * assertions need no `jest.SpyInstance` typing and no casts.
 *
 * @param method - logger method to intercept on the prototype.
 * @returns the array the interceptor appends every first argument to.
 */
function captureLogMessages(method: 'error' | 'warn'): unknown[] {
  const messages: unknown[] = [];

  jest
    .spyOn(Logger.prototype, method)
    .mockImplementation((message?: unknown) => {
      messages.push(message);
    });

  return messages;
}

describe('DatabaseLifecycleService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

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
    const messages = captureLogMessages('error');
    const sql = createSqlClientMock('reject');
    const service = new DatabaseLifecycleService(sql.client);

    await expect(service.onApplicationShutdown()).resolves.toBeUndefined();

    expect(sql.end).toHaveBeenCalledTimes(1);
    expect(messages).toHaveLength(1);
    expect(String(messages[0])).toContain(
      'Could not close the Postgres client',
    );
  });

  it('logs a non-Error rejection without throwing', async () => {
    const messages = captureLogMessages('error');
    // Deliberately rejecting with a string: the service must stringify it.
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    const end = jest.fn<() => Promise<void>>(() => Promise.reject('boom'));
    const client = Object.assign(jest.fn(), {
      end,
      options: { parsers: {}, serializers: {} },
    }) as unknown as ConstructorParameters<typeof DatabaseLifecycleService>[0];

    const service = new DatabaseLifecycleService(client);

    await expect(service.onApplicationShutdown()).resolves.toBeUndefined();
    expect(String(messages[0])).toContain('boom');
  });
});
