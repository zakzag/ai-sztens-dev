/**
 * Tests of the audit-ledger mapper (AIS-181).
 *
 * The diff builder is the part worth pinning: the ledger stores only the columns
 * that changed, so an insert has no `before`, a deletion has no `after`, and an
 * unchanged pair must never reach the screen. The second half of the file covers
 * the operation → severity table and the derived author options, because both are
 * decisions the components must not make.
 */

import {
  AUDIT_LOG_TABLE_VALUES,
  AUDIT_OPERATION_VALUES,
  VALID_AUDIT_LOG,
  type AuditLog,
} from '@callback/shared';
import { describe, expect, it } from 'vitest';
import { formatDateTime } from '../../lib/date.js';
import {
  CUSTOMER_AUDIT_NO_VALUE_LABEL,
  CUSTOMER_AUDIT_OPERATION_LABELS,
  CUSTOMER_AUDIT_OPERATION_LEVELS,
  CUSTOMER_AUDIT_TABLE_LABELS,
} from './customer.const.js';
import {
  toAuditActorOptions,
  toAuditDiffText,
  toAuditDiffValueText,
  toAuditLogDiffFields,
  toCustomerAuditLogViewModels,
} from './customer-audit-log.mapper.js';

/**
 * @param overrides - fields to replace on the fixture row.
 * @returns a complete audit-log row.
 */
function buildRow(overrides: Partial<AuditLog> = {}): AuditLog {
  return { ...VALID_AUDIT_LOG, ...overrides };
}

describe('toAuditLogDiffFields', () => {
  it('renders an insert as “no value → new value” rows', () => {
    const fields = toAuditLogDiffFields(null, { legal_name: 'AIS Kft.' });

    expect(fields).toHaveLength(1);
    expect(fields[0]?.beforeText).toBe(CUSTOMER_AUDIT_NO_VALUE_LABEL);
    expect(fields[0]?.afterText).toBe('AIS Kft.');
  });

  it('renders a deletion as “old value → no value” rows', () => {
    const fields = toAuditLogDiffFields({ legal_name: 'AIS Kft.' }, null);

    expect(fields[0]?.beforeText).toBe('AIS Kft.');
    expect(fields[0]?.afterText).toBe(CUSTOMER_AUDIT_NO_VALUE_LABEL);
  });

  it('keeps both sides of a changed column', () => {
    const fields = toAuditLogDiffFields(
      { status: 'trial' },
      { status: 'active' },
    );

    expect(fields).toEqual([
      { label: 'Státusz', beforeText: 'trial', afterText: 'active' },
    ]);
  });

  it('omits a column whose two sides render the same', () => {
    const fields = toAuditLogDiffFields(
      { status: 'active', legal_name: 'AIS Kft.' },
      { status: 'active', legal_name: 'AIS Zrt.' },
    );

    expect(fields.map((field) => field.label)).toEqual(['Jogi név']);
  });

  it('lists the `after` keys first and the `before`-only keys after them', () => {
    const fields = toAuditLogDiffFields(
      { dropped_column: 'régi', legal_name: 'AIS Kft.' },
      { legal_name: 'AIS Zrt.', status: 'active' },
    );

    expect(fields.map((field) => field.label)).toEqual([
      'Jogi név',
      'Státusz',
      // Ismeretlen kulcs: a wire-név jelenik meg, nem `undefined`.
      'dropped_column',
    ]);
  });

  it('stringifies an object value instead of rendering [object Object]', () => {
    const fields = toAuditLogDiffFields(
      { metadata: { from: 'trial' } },
      { metadata: { from: 'active' } },
    );

    expect(fields[0]?.afterText).toBe('{"from":"active"}');
  });

  it('answers an empty list when neither side exists', () => {
    expect(toAuditLogDiffFields(null, null)).toEqual([]);
  });
});

describe('toAuditDiffValueText', () => {
  it('maps every empty-ish side to the placeholder', () => {
    expect(toAuditDiffValueText(null)).toBe(CUSTOMER_AUDIT_NO_VALUE_LABEL);
    expect(toAuditDiffValueText(undefined)).toBe(CUSTOMER_AUDIT_NO_VALUE_LABEL);
    expect(toAuditDiffValueText('')).toBe(CUSTOMER_AUDIT_NO_VALUE_LABEL);
  });

  it('renders numbers and booleans as text', () => {
    expect(toAuditDiffValueText(0)).toBe('0');
    expect(toAuditDiffValueText(false)).toBe('false');
  });
});

describe('toAuditDiffText', () => {
  it('joins the two sides with an arrow', () => {
    expect(
      toAuditDiffText({ label: 'Státusz', beforeText: 'a', afterText: 'b' }),
    ).toBe('a → b');
  });
});

describe('toCustomerAuditLogViewModels', () => {
  it('maps the operation to its label and severity for every value', () => {
    const rows = AUDIT_OPERATION_VALUES.map((operation) =>
      buildRow({ operation, id: AUDIT_OPERATION_VALUES.indexOf(operation) }),
    );

    const viewModels = toCustomerAuditLogViewModels(rows);

    for (const [index, operation] of AUDIT_OPERATION_VALUES.entries()) {
      expect(viewModels[index]?.operationLabel).toBe(
        CUSTOMER_AUDIT_OPERATION_LABELS[operation],
      );
      expect(viewModels[index]?.level).toBe(
        CUSTOMER_AUDIT_OPERATION_LEVELS[operation],
      );
    }
  });

  it('maps every audited table to its localised name', () => {
    const rows = AUDIT_LOG_TABLE_VALUES.map((tableName, index) =>
      buildRow({ tableName, id: index }),
    );

    const viewModels = toCustomerAuditLogViewModels(rows);

    for (const [index, tableName] of AUDIT_LOG_TABLE_VALUES.entries()) {
      expect(viewModels[index]?.tableLabel).toBe(
        CUSTOMER_AUDIT_TABLE_LABELS[tableName],
      );
    }
  });

  it('falls back to the wire name for an unknown table', () => {
    const [row] = toCustomerAuditLogViewModels([
      buildRow({ tableName: 'legacy_table' }),
    ]);

    expect(row?.tableLabel).toBe('legacy_table');
  });

  it('formats the instant and keeps it as epoch milliseconds', () => {
    const [row] = toCustomerAuditLogViewModels([buildRow()]);

    expect(row?.occurredAtText).toBe(formatDateTime(VALID_AUDIT_LOG.occurredAt));
    expect(row?.occurredAtMs).toBe(Date.parse(VALID_AUDIT_LOG.occurredAt));
  });

  it('uses the numeric ledger id as a string key', () => {
    const [row] = toCustomerAuditLogViewModels([buildRow({ id: 42 })]);

    expect(row?.id).toBe('42');
  });

  it('keeps a null record id and a null request id as null', () => {
    const [row] = toCustomerAuditLogViewModels([
      buildRow({ recordId: null, requestId: null }),
    ]);

    expect(row?.recordIdText).toBeNull();
    expect(row?.requestId).toBeNull();
  });
});

describe('toAuditActorOptions', () => {
  it('collects the distinct authors of the page', () => {
    const options = toAuditActorOptions([
      buildRow({ id: 1, actorId: 'actor-1', actorName: 'Kálmán Rák' }),
      buildRow({ id: 2, actorId: 'actor-1', actorName: 'Kálmán Rák' }),
      buildRow({ id: 3, actorId: 'actor-2', actorName: 'Anna Kovács' }),
    ]);

    expect(options).toEqual([
      { id: 'actor-1', name: 'Kálmán Rák' },
      { id: 'actor-2', name: 'Anna Kovács' },
    ]);
  });

  it('drops the rows without an actor id (§ system)', () => {
    const options = toAuditActorOptions([buildRow({ actorId: null })]);

    expect(options).toEqual([]);
  });
});
