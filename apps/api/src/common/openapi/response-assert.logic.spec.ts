import { VALID_API_KEY } from '@callback/shared';
import type { ApiEndpointContract } from '@callback/shared';
import { z } from 'zod';
import { ContractViolationError } from './contract-violation.error.js';
import { assertResponseMatchesContract } from './response-assert.logic.js';
import {
  entryOrThrow,
  FIXTURE_META,
  VALID_LIST_ENVELOPE,
} from './test/mocks/openapi.mock.js';

/**
 * Job 4 of the plan: the server checks its own output. Every case below is a
 * real mistake someone can make in a controller or a mapper — a forgotten
 * `responses.ok()`, a dropped field, an unexpected one — plus the two things
 * that must *not* fail (an additive field, a route outside the envelope).
 */

describe('assertResponseMatchesContract', () => {
  const listEntry = entryOrThrow('apiKeys.list');

  it('accepts a body that matches the enveloped contract', () => {
    expect(() =>
      assertResponseMatchesContract(listEntry, VALID_LIST_ENVELOPE),
    ).not.toThrow();
  });

  it('rejects a bare payload from a controller that forgot responses.ok()', () => {
    expect(() =>
      assertResponseMatchesContract(listEntry, [VALID_API_KEY]),
    ).toThrow(ContractViolationError);
  });

  it('rejects a body whose data field is missing', () => {
    expect(() =>
      assertResponseMatchesContract(listEntry, { meta: FIXTURE_META }),
    ).toThrow(ContractViolationError);
  });

  it('rejects a payload field the mapper dropped', () => {
    const incomplete = {
      data: [{ ...VALID_API_KEY, name: undefined }],
      meta: FIXTURE_META,
    };

    expect(() => assertResponseMatchesContract(listEntry, incomplete)).toThrow(
      ContractViolationError,
    );
  });

  it('names the offending field in the error message', () => {
    expect(() =>
      assertResponseMatchesContract(listEntry, {
        data: [{ ...VALID_API_KEY, identifier: 'not valid!' }],
        meta: FIXTURE_META,
      }),
    ).toThrow(/data\.0\.identifier/);
  });

  it('rejects a missing meta block', () => {
    expect(() =>
      assertResponseMatchesContract(listEntry, { data: [VALID_API_KEY] }),
    ).toThrow(ContractViolationError);
  });

  it('tolerates an additive field because the response schema strips it', () => {
    const additive = {
      data: [{ ...VALID_API_KEY, futureField: 'from a newer server' }],
      meta: { ...FIXTURE_META, pagination: undefined },
    };

    expect(() =>
      assertResponseMatchesContract(listEntry, additive),
    ).not.toThrow();
  });

  it('validates the raw body of an endpoint outside the envelope', () => {
    const rawEntry: ApiEndpointContract = {
      ...listEntry,
      envelope: false,
      dataSchema: z.object({ status: z.string() }),
    };

    expect(() =>
      assertResponseMatchesContract(rawEntry, { status: 'oks' }),
    ).not.toThrow();
    expect(() =>
      assertResponseMatchesContract(rawEntry, { status: 1 }),
    ).toThrow(ContractViolationError);
  });
});
