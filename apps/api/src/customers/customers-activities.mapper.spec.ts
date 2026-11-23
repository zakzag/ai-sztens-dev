import { ActivityAuthorIncompleteError } from './customers-activities.errors.js';
import {
  hasActivityPatch,
  lastWriteOf,
  toActivity,
  toActivityAuditPayload,
  toActivityAuthorColumns,
  toActivityPatch,
  toNewActivityRow,
} from './customers-activities.mapper.js';
import {
  ACTIVITY_CREATED_AT,
  ACTIVITY_CUSTOMER_ID,
  ACTIVITY_EDITED_AT,
  ACTIVITY_ID,
  OPERATOR_AUDIT_ACTOR,
  OPERATOR_ID,
  SYSTEM_AUDIT_ACTOR,
  buildActivityRowFixture,
  buildCreateActivityInput,
  buildUpdateActivityInput,
} from './test/mocks/customers-activities.mock.js';

/**
 * Unit tests of the activity mapper (AIS-178, slice f).
 *
 * Pure functions only: every branch of the row → payload mapping, the author
 * snapshot, the `undefined`/`null` distinction of `metadata`, and the nullable
 * `updatedAt` that makes `lastWriteOf` necessary.
 */

describe('toActivity', () => {
  it('maps a stored row to the wire payload', () => {
    const row = buildActivityRowFixture({
      updatedAt: ACTIVITY_EDITED_AT,
      metadata: { durationSeconds: 92 },
    });

    expect(toActivity(row)).toEqual({
      id: ACTIVITY_ID,
      customerId: ACTIVITY_CUSTOMER_ID,
      type: 'note',
      body: 'Called the owner about the missing invoice.',
      authorType: 'system',
      operatorId: null,
      customerUserId: null,
      authorName: 'system',
      metadata: { durationSeconds: 92 },
      createdAt: ACTIVITY_CREATED_AT.toISOString(),
      updatedAt: ACTIVITY_EDITED_AT.toISOString(),
    });
  });

  it('keeps a never-edited row readable (`updatedAt: null`)', () => {
    expect(toActivity(buildActivityRowFixture()).updatedAt).toBeNull();
  });

  it('narrows a non-record metadata value to null', () => {
    const row = buildActivityRowFixture({ metadata: ['not', 'a', 'record'] });

    expect(toActivity(row).metadata).toBeNull();
  });
});

describe('lastWriteOf', () => {
  it('falls back to createdAt while the row was never edited', () => {
    expect(lastWriteOf(buildActivityRowFixture())).toBe(ACTIVITY_CREATED_AT);
  });

  it('answers the update instant once the row has been edited', () => {
    const row = buildActivityRowFixture({ updatedAt: ACTIVITY_EDITED_AT });

    expect(lastWriteOf(row)).toBe(ACTIVITY_EDITED_AT);
  });
});

describe('toActivityAuthorColumns', () => {
  it('leaves both references empty for the system actor', () => {
    expect(toActivityAuthorColumns(SYSTEM_AUDIT_ACTOR)).toEqual({
      authorType: 'system',
      operatorId: null,
      customerUserId: null,
      authorName: 'system',
    });
  });

  it('writes operator_id for an operator actor', () => {
    expect(toActivityAuthorColumns(OPERATOR_AUDIT_ACTOR)).toEqual({
      authorType: 'operator',
      operatorId: OPERATOR_ID,
      customerUserId: null,
      authorName: 'Kiss Anna',
    });
  });

  it('writes customer_user_id for a customer-user actor', () => {
    const columns = toActivityAuthorColumns({
      type: 'customer_user',
      id: OPERATOR_ID,
      name: 'Nagy Péter',
    });

    expect(columns).toEqual({
      authorType: 'customer_user',
      operatorId: null,
      customerUserId: OPERATOR_ID,
      authorName: 'Nagy Péter',
    });
  });

  it('leaves both references empty for an api-key actor', () => {
    const columns = toActivityAuthorColumns({
      type: 'api_key',
      id: null,
      name: 'integration-key',
    });

    expect(columns.operatorId).toBeNull();
    expect(columns.customerUserId).toBeNull();
  });

  it('rejects an operator actor without an id', () => {
    expect(() =>
      toActivityAuthorColumns({
        type: 'operator',
        id: null,
        name: 'Kiss Anna',
      }),
    ).toThrow(ActivityAuthorIncompleteError);
  });

  it('rejects a customer-user actor without an id', () => {
    expect(() =>
      toActivityAuthorColumns({
        type: 'customer_user',
        id: null,
        name: 'Nagy Péter',
      }),
    ).toThrow(ActivityAuthorIncompleteError);
  });
});

describe('toNewActivityRow', () => {
  it('takes the author from the actor and leaves the timestamps to the server', () => {
    const row = toNewActivityRow(
      ACTIVITY_CUSTOMER_ID,
      buildCreateActivityInput({ metadata: { channel: 'phone' } }),
      SYSTEM_AUDIT_ACTOR,
    );

    expect(row).toEqual({
      customerId: ACTIVITY_CUSTOMER_ID,
      type: 'note',
      body: 'Called the owner about the missing invoice.',
      authorType: 'system',
      operatorId: null,
      customerUserId: null,
      authorName: 'system',
      metadata: { channel: 'phone' },
    });
    expect(row).not.toHaveProperty('createdAt');
    expect(row).not.toHaveProperty('updatedAt');
    expect(row).not.toHaveProperty('deletedAt');
  });

  it('stores null when the body carries no metadata', () => {
    const row = toNewActivityRow(
      ACTIVITY_CUSTOMER_ID,
      buildCreateActivityInput(),
      SYSTEM_AUDIT_ACTOR,
    );

    expect(row.metadata).toBeNull();
  });
});

describe('toActivityPatch', () => {
  it('writes only the columns the body carried', () => {
    expect(
      toActivityPatch(buildUpdateActivityInput({ body: 'Called again.' })),
    ).toEqual({ body: 'Called again.' });
  });

  it('keeps `undefined` (leave alone) and `null` (clear) apart', () => {
    const cleared = toActivityPatch(
      buildUpdateActivityInput({ metadata: null }),
    );
    const untouched = toActivityPatch(buildUpdateActivityInput());

    expect(cleared).toEqual({ metadata: null });
    expect(untouched).toEqual({});
  });
});

describe('hasActivityPatch', () => {
  it('is false for a token-only body', () => {
    expect(hasActivityPatch(toActivityPatch(buildUpdateActivityInput()))).toBe(
      false,
    );
  });

  it('is true as soon as one column is written', () => {
    expect(
      hasActivityPatch(
        toActivityPatch(buildUpdateActivityInput({ body: 'Edited.' })),
      ),
    ).toBe(true);
    expect(
      hasActivityPatch(
        toActivityPatch(buildUpdateActivityInput({ metadata: null })),
      ),
    ).toBe(true);
  });
});

describe('toActivityAuditPayload', () => {
  it('carries the business columns only', () => {
    const payload = toActivityAuditPayload(
      buildActivityRowFixture({ metadata: { channel: 'phone' } }),
    );

    expect(payload).toEqual({
      id: ACTIVITY_ID,
      customerId: ACTIVITY_CUSTOMER_ID,
      type: 'note',
      body: 'Called the owner about the missing invoice.',
      authorType: 'system',
      operatorId: null,
      customerUserId: null,
      authorName: 'system',
      metadata: { channel: 'phone' },
    });
    expect(payload).not.toHaveProperty('createdAt');
    expect(payload).not.toHaveProperty('deletedAt');
  });
});
