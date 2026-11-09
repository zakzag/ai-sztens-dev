import { VALID_UPDATE_API_KEY_REQUEST } from '@callback/shared';
import type { RequestBodyOf } from '@callback/shared';

/**
 * Compile-time tests of `RequestBodyOf` (AIS-109).
 *
 * This file runs like any other spec, but its real assertion happens in `tsc`:
 * ts-jest type-checks the specs, so a wrong assignment fails the run and a
 * **stale** `@ts-expect-error` fails it too. That is what proves the request body
 * of a service comes from the endpoint registry and not from `unknown`.
 */

describe('RequestBodyOf', () => {
  it('accepts a body that matches the registry schema', () => {
    const body: RequestBodyOf<'apiKeys.update'> = {
      ...VALID_UPDATE_API_KEY_REQUEST,
    };

    expect(body.updatedAt).toBe(VALID_UPDATE_API_KEY_REQUEST.updatedAt);
    expect(body.name).toBe(VALID_UPDATE_API_KEY_REQUEST.name);
  });

  it('requires the concurrency token of the update endpoint', () => {
    // @ts-expect-error `updatedAt` is the optimistic-concurrency token: the
    // registry schema requires it, so omitting it is a compile error.
    const body: RequestBodyOf<'apiKeys.update'> = { name: 'Vapi production' };

    expect('updatedAt' in body).toBe(false);
  });

  it('rejects a server-owned field the schema is strict about', () => {
    // @ts-expect-error `identifier` is not part of the patch contract: the row is
    // addressed by the URL, so a body claiming to rename it is a compile error.
    const body: RequestBodyOf<'apiKeys.update'> = {
      updatedAt: VALID_UPDATE_API_KEY_REQUEST.updatedAt,
      identifier: 'renamed',
    };

    expect('identifier' in body).toBe(true);
  });

  it('resolves a bodyless endpoint to never', () => {
    // @ts-expect-error a GET has no request body, so any value is a compile error.
    const body: RequestBodyOf<'apiKeys.list'> = { name: 'nope' };

    expect(body).toEqual({ name: 'nope' });
  });
});
