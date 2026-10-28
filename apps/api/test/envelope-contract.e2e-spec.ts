import 'reflect-metadata';
import { DiscoveryModule, DiscoveryService } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import {
  API_ENDPOINTS,
  ENVELOPE_EXEMPTIONS,
  apiKeySchema,
  findEndpoint,
} from '@callback/shared';
import type { ApiKey, ApiEndpointContract } from '@callback/shared';
import { assertResponseMatchesContract } from '../src/common/openapi/response-assert.logic.js';
import { toApiKeyResponse } from '../src/api-keys/api-keys.mapper.js';
import type { ApiKeyRow } from '../src/db/schema.js';
import { loadAppModuleOrSkip } from './lib/app-module-gate.js';
import {
  BareBodyProbeController,
  UnlistedExemptController,
} from './lib/audit-fixtures.js';
import { auditEnvelopeContract } from './lib/controller-audit.js';
import type { AuditViolationCode } from './lib/controller-audit.js';

/**
 * The CI gate and the contract-drift fixture (AIS-97, DoD 3 and 4).
 *
 * Two independent guarantees:
 *
 * 1. **No undocumented route.** Every controller the booted `AppModule` actually
 *    contains must either be registered in `API_ENDPOINTS` (verb + path) or carry
 *    `@SkipEnvelope()` *and* an `ENVELOPE_EXEMPTIONS` entry with a reason. The
 *    audit reads Nest's own metadata, so a refactor cannot fool it. The negative
 *    cases below prove the gate fails when it should — they are permanent
 *    fixtures, not a controller deleted after one manual run.
 * 2. **No drift between the mapper and the schema.** The `api-keys` mapper output
 *    is pushed through the *shared* schema and through the same assertion the dev
 *    response validator uses, so a renamed or dropped field fails here instead of
 *    in the browser.
 *
 * Self-skips on Node < 24.9 like every `AppModule` suite (see
 * `test/lib/app-module-gate.ts`).
 */

/**
 * @param violations - audit output.
 * @returns the violation codes, for compact assertions.
 */
function codesOf(
  violations: readonly { readonly code: AuditViolationCode }[],
): readonly AuditViolationCode[] {
  return violations.map((violation) => violation.code);
}

/**
 * @param operationId - registry id.
 * @returns its contract entry.
 */
function entryOrThrow(operationId: string): ApiEndpointContract {
  const entry = findEndpoint(operationId);

  if (entry === undefined) {
    throw new Error(`registry entry "${operationId}" is missing`);
  }

  return entry;
}

/** A DB row shaped like `platform.api_keys`, for the mapper drift fixture. */
const ROW_FIXTURE: ApiKeyRow = {
  id: '5d0f8f0e-9a2b-4c7e-8f3a-1b2c3d4e5f60',
  name: 'Vapi prod',
  identifier: 'vapi-prod',
  description: null,
  apiKey: 'sk-live-abcdef123456',
  expiresAt: null,
  createdAt: new Date('2026-10-21T15:00:00.000Z'),
  updatedAt: new Date('2026-10-21T15:00:00.000Z'),
};

/** Fixed envelope meta, so the drift assertion has no clock dependency. */
const META_FIXTURE = {
  requestId: '0192f3c4-0000-7000-8000-000000000000',
  timestamp: '2026-10-26T15:21:48.752Z',
} as const;

describe('Envelope contract gate (e2e)', () => {
  it('registers or excuses every route of the real module graph', async () => {
    const AppModule = await loadAppModuleOrSkip();
    if (AppModule === null) return; // runtime limitation, warning already logged

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, DiscoveryModule],
    }).compile();

    try {
      const discovery = moduleRef.get(DiscoveryService);
      const controllers = discovery
        .getControllers()
        .map((wrapper) => wrapper.metatype);

      const result = auditEnvelopeContract(controllers);

      expect(result.violations).toEqual([]);
      // Guards against a discovery failure making the audit trivially pass.
      expect(result.routes.length).toBeGreaterThan(0);
    } finally {
      await moduleRef.close();
    }
  });

  it('fails when a non-exempt route answers with a bare body', () => {
    const result = auditEnvelopeContract([BareBodyProbeController], {
      exemptions: [],
    });

    expect(codesOf(result.violations)).toEqual([
      'UNREGISTERED_ENVELOPED_ROUTE',
    ]);
    expect(result.violations[0]?.path).toBe('/api/probe-bare');
    expect(result.violations[0]?.method).toBe('GET');
    expect(result.violations[0]?.detail).toContain('BareBodyProbeController');
  });

  it('fails when an exempt route is missing from the allow-list', () => {
    const result = auditEnvelopeContract([UnlistedExemptController], {
      exemptions: [],
    });

    expect(codesOf(result.violations)).toEqual(['EXEMPT_ROUTE_NOT_LISTED']);
    expect(result.violations[0]?.path).toBe('/api/probe-exempt-unlisted');
  });

  it('accepts that same route once its exemption is written down', () => {
    const result = auditEnvelopeContract([UnlistedExemptController], {
      exemptions: [
        {
          path: '/api/probe-exempt-unlisted',
          reason: 'fixture: raw on purpose',
        },
      ],
    });

    expect(result.violations).toEqual([]);
    // `ENVELOPE_EXEMPTIONS` is not consulted when an explicit list is passed,
    // so the real allow-list is only asserted by the module-graph test above.
    expect(ENVELOPE_EXEMPTIONS.length).toBeGreaterThan(0);
  });

  it('fails on an allow-list entry that no route carries', () => {
    const result = auditEnvelopeContract([], {
      endpoints: API_ENDPOINTS,
      exemptions: [
        { path: '/api/ghost', reason: 'fixture: no route mounts this path' },
      ],
      allowedUnexplainedPaths: [],
    });

    expect(codesOf(result.violations)).toEqual(['ORPHANED_EXEMPTION']);
    expect(result.violations[0]?.path).toBe('/api/ghost');
  });

  it('accepts a registered route with the matching verb', () => {
    const result = auditEnvelopeContract([BareBodyProbeController], {
      endpoints: [
        {
          ...entryOrThrow('apiKeys.list'),
          operationId: 'probe.list',
          method: 'GET',
          path: '/api/probe-bare',
        },
      ],
      exemptions: [],
      allowedUnexplainedPaths: [],
    });

    expect(result.violations).toEqual([]);
  });

  it('flags a route whose registered verb differs', () => {
    const result = auditEnvelopeContract([BareBodyProbeController], {
      endpoints: [
        {
          ...entryOrThrow('apiKeys.list'),
          operationId: 'probe.create',
          method: 'POST',
          path: '/api/probe-bare',
        },
      ],
      exemptions: [],
      allowedUnexplainedPaths: [],
    });

    expect(codesOf(result.violations)).toEqual([
      'UNREGISTERED_ENVELOPED_ROUTE',
    ]);
  });

  it('keeps the mapper output inside the shared response schema', () => {
    const mapped: ApiKey = toApiKeyResponse(ROW_FIXTURE);

    // `toEqual` rather than the schema alone: the contract is what the client
    // parses, so both the shape *and* the exact null/ISO handling are pinned.
    expect(apiKeySchema.parse(mapped)).toEqual(mapped);
    expect(mapped.description).toBeNull();
    expect(mapped.expiresAt).toBeNull();
    expect(mapped.createdAt).toBe('2026-10-21T15:00:00.000Z');
  });

  it('passes the mapper output through the same assertion the dev validator uses', () => {
    const entry = entryOrThrow('apiKeys.list');

    expect(() =>
      assertResponseMatchesContract(entry, {
        data: [toApiKeyResponse(ROW_FIXTURE)],
        meta: META_FIXTURE,
      }),
    ).not.toThrow();

    // …and a drifted payload fails: this is the "fixture" half of the guard.
    expect(() =>
      assertResponseMatchesContract(entry, {
        data: [{ ...toApiKeyResponse(ROW_FIXTURE), expiresAt: 'not-a-date' }],
        meta: META_FIXTURE,
      }),
    ).toThrow(/data\.0\.expiresAt/);
  });
});
