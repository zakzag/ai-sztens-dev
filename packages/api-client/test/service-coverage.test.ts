/**
 * The registry ⇄ service coverage gate (AIS-110).
 *
 * The first block is the actual gate: it builds every service from the real
 * factory map and compares the result with the real `API_ENDPOINTS`. It stays
 * green only while every registered operation has a service method — which is
 * exactly the invariant the ticket asks for, and the reason `apiKeys.update` and
 * `apiKeys.remove` are implemented in this change instead of being documented as
 * “later”.
 *
 * The remaining blocks drive the pure function with fixtures, because a gate that
 * is only ever proven green proves nothing: the negative cases are the contract.
 */

import { API_ENDPOINTS } from '@callback/shared';
import { createHttpClient } from '../src/http-client.js';
import {
  findCoverageGaps,
  toServiceMethodName,
  toServiceNamespace,
} from '../src/service-coverage.logic.js';
import { InvalidOperationIdError } from '../src/service-coverage.errors.js';
import { createServiceFactories } from '../src/service.registry.js';
import type { ServiceInstances } from '../src/service-coverage.interface.js';
import { createSequenceFetchMock } from './mocks/fetch.mock.js';

const BASE_URL = 'http://api.test/api';

/**
 * Builds every service the way the admin's composition root does.
 *
 * `fetch` is doubled, so building a service can never reach the network — the
 * gate only needs the method surface.
 */
function buildServices(): ServiceInstances {
  const fetchMock = createSequenceFetchMock([]);
  const client = createHttpClient({
    baseUrl: BASE_URL,
    fetchImpl: fetchMock.fetchImpl,
  });
  const factories = createServiceFactories();

  return Object.fromEntries(
    Object.entries(factories).map(([namespace, create]) => [
      namespace,
      create(client),
    ]),
  );
}

/**
 * @param run - a call expected to throw.
 * @returns whatever was thrown, so a test can assert on its fields.
 */
function captureError(run: () => unknown): unknown {
  try {
    run();
    throw new Error('expected the call to throw');
  } catch (error: unknown) {
    return error;
  }
}

describe('service coverage — the registry and the services agree (AIS-110)', () => {
  it('finds a service method for every registered operation', () => {
    const gaps = findCoverageGaps(
      API_ENDPOINTS.map((entry) => entry.operationId),
      buildServices(),
    );

    expect(gaps.missing).toEqual([]);
  });

  it('has no service method that the registry does not document', () => {
    const gaps = findCoverageGaps(
      API_ENDPOINTS.map((entry) => entry.operationId),
      buildServices(),
    );

    expect(gaps.orphan).toEqual([]);
  });

  it('registers a factory for exactly the namespaces the registry publishes', () => {
    const namespaces = [
      ...new Set(
        API_ENDPOINTS.map((entry) => toServiceNamespace(entry.operationId)),
      ),
    ].sort();

    expect(namespaces).toEqual(Object.keys(createServiceFactories()).sort());
  });
});

describe('findCoverageGaps — the gate fails when a method is missing', () => {
  it('reports a registered operation whose service has no method', () => {
    const gaps = findCoverageGaps(['apiKeys.list', 'apiKeys.update'], {
      apiKeys: { list: () => undefined },
    });

    expect(gaps.missing).toEqual([
      {
        operationId: 'apiKeys.update',
        namespace: 'apiKeys',
        method: 'update',
        reason: 'missing-method',
      },
    ]);
    expect(gaps.orphan).toEqual([]);
  });

  it('reports a registered operation whose namespace has no service', () => {
    const gaps = findCoverageGaps(['unknown.list'], {});

    expect(gaps.missing).toEqual([
      {
        operationId: 'unknown.list',
        namespace: 'unknown',
        method: 'list',
        reason: 'missing-service',
      },
    ]);
  });

  it('does not accept a non-function member as an implementation', () => {
    const gaps = findCoverageGaps(['apiKeys.list'], {
      apiKeys: { list: 'not-a-function' },
    });

    expect(gaps.missing[0]?.reason).toBe('missing-method');
  });

  it('does not accept an inherited member as an implementation', () => {
    const gaps = findCoverageGaps(['apiKeys.toString'], {
      apiKeys: { list: () => undefined },
    });

    expect(gaps.missing[0]?.reason).toBe('missing-method');
  });

  it('reports a service method no operation documents', () => {
    const gaps = findCoverageGaps(['apiKeys.list'], {
      apiKeys: { list: () => undefined, remove: () => undefined },
    });

    expect(gaps.orphan).toEqual(['apiKeys.remove']);
  });

  it('sorts the orphan list so the failure is stable', () => {
    const gaps = findCoverageGaps([], {
      apiKeys: { remove: () => undefined, create: () => undefined },
    });

    expect(gaps.orphan).toEqual(['apiKeys.create', 'apiKeys.remove']);
  });

  it('reports every gap at once instead of stopping at the first one', () => {
    const gaps = findCoverageGaps(
      ['apiKeys.list', 'apiKeys.update', 'unknown.list'],
      { apiKeys: { list: () => undefined } },
    );

    expect(gaps.missing.map((gap) => gap.operationId)).toEqual([
      'apiKeys.update',
      'unknown.list',
    ]);
  });
});

describe('operation id splitting', () => {
  it('derives the namespace from the first segment', () => {
    expect(toServiceNamespace('apiKeys.findByIdentifier')).toBe('apiKeys');
  });

  it('derives the method from the last segment', () => {
    expect(toServiceMethodName('apiKeys.findByIdentifier')).toBe(
      'findByIdentifier',
    );
  });

  it('rejects an id without a separator', () => {
    const error = captureError(() => toServiceNamespace('list'));

    expect(error).toBeInstanceOf(InvalidOperationIdError);
    expect((error as InvalidOperationIdError).reason).toBe('missing-separator');
  });

  it('rejects an id with an empty segment', () => {
    expect(() => toServiceMethodName('apiKeys.')).toThrow(
      InvalidOperationIdError,
    );
    expect(() => toServiceNamespace('.list')).toThrow(InvalidOperationIdError);
  });

  it('rejects an id with more than two segments', () => {
    const error = captureError(() => toServiceMethodName('apiKeys.list.extra'));

    expect((error as InvalidOperationIdError).reason).toBe('extra-segments');
  });

  it('carries the offending id on the error', () => {
    const error = captureError(() => toServiceNamespace('apiKeys'));

    expect((error as InvalidOperationIdError).operationId).toBe('apiKeys');
    expect((error as InvalidOperationIdError).name).toBe(
      'InvalidOperationIdError',
    );
  });
});
