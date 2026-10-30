import { jest } from '@jest/globals';
import type { DatabaseEnvSource } from '../../database.factory.js';

/**
 * Minimal configuration stand-in for the database factory tests.
 *
 * Typed as `DatabaseEnvSource` (a one-method structural interface) rather than
 * `ConfigService`, so the unit suite never imports `@nestjs/config` — that
 * CommonJS-only package can only be loaded by the Jest ESM runner on
 * Node >= 24.9, and the factory tests must run everywhere.
 */
export interface ConfigServiceMockValues {
  readonly DATABASE_URL?: string;
  readonly DATABASE_POOL_MAX?: string;
}

export interface DatabaseEnvSourceMock {
  /** The object handed to the factory. */
  readonly source: DatabaseEnvSource;
  /** The spy, so a test can assert which keys were read. */
  readonly get: jest.Mock<(key: string) => unknown>;
}

/** Builds an env source whose `get` returns the supplied values. */
export function createEnvSourceMock(
  values: ConfigServiceMockValues = {},
): DatabaseEnvSourceMock {
  const get = jest.fn<(key: string) => unknown>(
    (key: string) => values[key as keyof ConfigServiceMockValues],
  );

  return { get, source: { get } };
}
