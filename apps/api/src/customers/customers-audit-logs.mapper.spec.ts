import { toAuditLog } from './customers-audit-logs.mapper.js';
import {
  AUDIT_ACTOR_ID,
  AUDIT_CUSTOMER_ID,
  AUDIT_OCCURRED_AT,
  AUDIT_RECORD_ID,
  AUDIT_REQUEST_ID,
  buildAuditLogRowFixture,
} from './test/mocks/customers-audit-logs.mock.js';

/**
 * Unit tests of the audit-log mapper (AIS-178, slice f).
 *
 * Four boundaries matter here, and they are the four the contract can break on:
 * the `bigint` id crossing as a number, the `jsonb` payloads, the `Date` →
 * ISO 8601 conversion, and every nullable column (anonymisation clears
 * `customer_id`; a join row has no `record_id`; a script has no `request_id`).
 */

describe('toAuditLog', () => {
  it('maps a stored ledger row to the wire payload', () => {
    expect(toAuditLog(buildAuditLogRowFixture())).toEqual({
      id: 41,
      customerId: AUDIT_CUSTOMER_ID,
      tableName: 'customers',
      recordId: AUDIT_RECORD_ID,
      operation: 'insert',
      beforeData: null,
      afterData: { legalName: 'Példa Kft.' },
      actorType: 'system',
      actorId: null,
      actorName: 'system',
      occurredAt: AUDIT_OCCURRED_AT.toISOString(),
      ipAddress: '127.0.0.1',
      userAgent: 'jest/audit-logs',
      requestId: AUDIT_REQUEST_ID,
      source: 'admin_api',
    });
  });

  it('keeps the numeric id a number, never a string', () => {
    const payload = toAuditLog(
      buildAuditLogRowFixture({ id: 9007199254740991 }),
    );

    expect(payload.id).toBe(9007199254740991);
    expect(typeof payload.id).toBe('number');
  });

  it('passes both jsonb payloads through as records', () => {
    const payload = toAuditLog(
      buildAuditLogRowFixture({
        beforeData: { body: 'previous' },
        afterData: { body: 'edited' },
      }),
    );

    expect(payload.beforeData).toEqual({ body: 'previous' });
    expect(payload.afterData).toEqual({ body: 'edited' });
  });

  it('narrows a non-record jsonb value to null', () => {
    const payload = toAuditLog(
      buildAuditLogRowFixture({ beforeData: ['legacy', 'array'] }),
    );

    expect(payload.beforeData).toBeNull();
  });

  it('keeps every nullable column null', () => {
    const payload = toAuditLog(
      buildAuditLogRowFixture({
        customerId: null,
        recordId: null,
        ipAddress: null,
        userAgent: null,
        requestId: null,
        source: null,
      }),
    );

    expect(payload.customerId).toBeNull();
    expect(payload.recordId).toBeNull();
    expect(payload.ipAddress).toBeNull();
    expect(payload.userAgent).toBeNull();
    expect(payload.requestId).toBeNull();
    expect(payload.source).toBeNull();
  });

  it('carries the actor snapshot of an operator write', () => {
    const payload = toAuditLog(
      buildAuditLogRowFixture({
        actorType: 'operator',
        actorId: AUDIT_ACTOR_ID,
        actorName: 'Kiss Anna',
      }),
    );

    expect(payload.actorType).toBe('operator');
    expect(payload.actorId).toBe(AUDIT_ACTOR_ID);
    expect(payload.actorName).toBe('Kiss Anna');
  });
});
